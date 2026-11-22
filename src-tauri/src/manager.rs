//! Device registry. Polls XInput, enumerates HID interfaces for hot-plug
//! detection, keeps one reader thread per HID pad and publishes a snapshot to
//! the UI at a steady rate so continuous input never blocks rendering.

use crate::hid::{self, HidDescriptor, HidReader};
use crate::model::{now_ms, Battery, DeviceInfo, InputState, Snapshot};
use crate::parsers::{self, LearnedRanges};
use crate::xinput::{XInputApi, XInputDevice};
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

pub struct Shared {
    pub devices: Vec<DeviceInfo>,
    pub states: HashMap<String, InputState>,
    pub revision: u64,
}

impl Default for Shared {
    fn default() -> Self {
        Self {
            devices: Vec::new(),
            states: HashMap::new(),
            revision: 0,
        }
    }
}

static SHARED: OnceLock<Arc<Mutex<Shared>>> = OnceLock::new();

pub fn shared() -> Arc<Mutex<Shared>> {
    SHARED
        .get_or_init(|| Arc::new(Mutex::new(Shared::default())))
        .clone()
}

pub fn start(app: Option<AppHandle>) {
    let shared = shared();
    thread::Builder::new()
        .name("gamepad-registry".into())
        .spawn(move || run(app, shared))
        .ok();
}

struct ReaderHandle {
    stop: Arc<AtomicBool>,
    dead: Arc<AtomicBool>,
}

fn hash_path(path: &str) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    path.hash(&mut hasher);
    hasher.finish()
}

fn identify(vid: u16, pid: u16, product: &str, manufacturer: &str) -> (String, String, String) {
    let (family, model, maker): (&str, &str, &str) = match (vid, pid) {
        (0x054C, 0x05C4) => ("dualshock4", "DualShock 4 (CUH-ZCT1)", "Sony Interactive Entertainment"),
        (0x054C, 0x09CC) => ("dualshock4", "DualShock 4 v2 (CUH-ZCT2)", "Sony Interactive Entertainment"),
        (0x054C, 0x0CE6) => ("dualsense", "DualSense Wireless Controller", "Sony Interactive Entertainment"),
        (0x054C, 0x0DF2) => ("dualsense", "DualSense Edge Wireless Controller", "Sony Interactive Entertainment"),
        (0x054C, _) => ("dualsense", "PlayStation controller", "Sony Interactive Entertainment"),
        (0x045E, 0x028E) => ("xbox360", "Xbox 360 Controller", "Microsoft"),
        (0x045E, 0x028F) => ("xbox360", "Xbox 360 Wireless Controller", "Microsoft"),
        (0x045E, 0x0719) => ("xbox360", "Xbox 360 Wireless Receiver", "Microsoft"),
        (0x045E, 0x02D1) | (0x045E, 0x02DD) | (0x045E, 0x02FD) => {
            ("xboxone", "Xbox One Controller", "Microsoft")
        }
        (0x045E, 0x02EA) | (0x045E, 0x0B00) | (0x045E, 0x0B05) | (0x045E, 0x0B20) => {
            ("xboxone", "Xbox One S / Elite Controller", "Microsoft")
        }
        (0x045E, 0x0B12) => ("xboxseries", "Xbox Series X|S Controller", "Microsoft"),
        (0x045E, 0x0B13) => ("xboxseries", "Xbox Series X|S Controller", "Microsoft"),
        (0x045E, _) => ("xboxone", "Xbox controller", "Microsoft"),
        (0x057E, _) => ("generic", "Nintendo controller", "Nintendo"),
        (0x046D, _) => ("generic", "Logitech controller", "Logitech"),
        (0x0079, _) => ("generic", "Generic USB gamepad", "DragonRise"),
        (0x2DC8, _) => ("generic", "8BitDo controller", "8BitDo"),
        _ => ("generic", "Generic HID gamepad", "Unknown"),
    };
    let name = if !product.is_empty() {
        product.to_string()
    } else {
        model.to_string()
    };
    let maker = if !manufacturer.is_empty() {
        manufacturer.to_string()
    } else {
        maker.to_string()
    };
    (family.to_string(), name, maker)
}

fn model_for(family: &str, fallback: &str) -> String {
    match family {
        "dualshock4" => "DualShock 4".into(),
        "dualsense" => "DualSense".into(),
        "xbox360" => "Xbox 360".into(),
        "xboxone" => "Xbox One".into(),
        "xboxseries" => "Xbox Series X|S".into(),
        _ => fallback.to_string(),
    }
}

fn spawn_reader(
    desc: HidDescriptor,
    family: String,
    id: String,
    shared: Arc<Mutex<Shared>>,
    stop: Arc<AtomicBool>,
    dead: Arc<AtomicBool>,
) {
    thread::Builder::new()
        .name(format!("hid-{}", id))
        .spawn(move || {
            let Some(mut reader) = HidReader::open(&desc) else {
                dead.store(true, Ordering::Relaxed);
                return;
            };
            let mut ranges = LearnedRanges::default();
            let mut packet: u32 = 0;
            let caps = reader.caps;
            let prepared = reader.prepared;
            let mut buffer_fail = 0;

            while !stop.load(Ordering::Relaxed) {
                match reader.read(120) {
                    Some(bytes) => {
                        buffer_fail = 0;
                        if bytes.len() < 2 {
                            continue;
                        }
                        let parsed = match family.as_str() {
                            "dualshock4" => parsers::parse_dualshock4(&bytes),
                            "dualsense" => parsers::parse_dualsense(&bytes),
                            _ => parsers::parse_generic(&bytes, prepared, &caps, &mut ranges),
                        };
                        let Some(p) = parsed else { continue };

                        packet = packet.wrapping_add(1);
                        let mut state = InputState::new(&id);
                        state.packet = packet;
                        state.timestamp_ms = now_ms();
                        state.axes = p.axes;
                        state.buttons = p.buttons;
                        state.raw = crate::model::RawState {
                            report_id: bytes.first().copied().unwrap_or(0),
                            report: bytes.iter().take(80).copied().collect(),
                            axes: p.raw_axes,
                            buttons: p.raw_buttons,
                            power: p.power,
                        };
                        state.battery_level = p.battery_level;
                        state.charging = p.charging;
                        state.live = true;

                        if let Ok(mut guard) = shared.lock() {
                            guard.states.insert(id.clone(), state);
                        }
                    }
                    None => {
                        if reader.failed {
                            break;
                        }
                        buffer_fail += 1;
                        if buffer_fail > 40 {
                            break;
                        }
                    }
                }
            }

            if !stop.load(Ordering::Relaxed) {
                dead.store(true, Ordering::Relaxed);
            }
        })
        .ok();
}

fn battery_of(state: Option<&InputState>) -> Option<Battery> {
    let state = state?;
    let level = state.battery_level;
    let charging = state.charging;
    if level.is_none() && charging.is_none() {
        return None;
    }
    let status = if state.powered == Some(true) {
        "Wired".to_string()
    } else {
        match (charging, level) {
            (Some(true), Some(100)) => "Full".to_string(),
            (Some(true), _) => "Charging".to_string(),
            (Some(false), _) => "Discharging".to_string(),
            (None, _) => "Unknown".to_string(),
        }
    };
    Some(Battery {
        level,
        charging,
        status,
    })
}

fn scan(
    shared: &Arc<Mutex<Shared>>,
    xinput: Option<&XInputApi>,
    xpads: &mut Vec<XInputDevice>,
    readers: &mut HashMap<String, ReaderHandle>,
) {
    let hid_all = hid::enumerate();
    let hid_pads: Vec<HidDescriptor> = hid_all
        .into_iter()
        .filter(|d| d.is_gamepad())
        .filter(|d| d.vid != 0x045E || !d.product.to_uppercase().contains("SYNTHETIC"))
        .collect();

    xpads.clear();
    if let Some(api) = xinput {
        *xpads = api.devices();
    }

    let mut devices: Vec<DeviceInfo> = Vec::new();
    let mut keep: Vec<String> = Vec::new();

    // Xbox pads: XInput is the authoritative input path. XInput does not expose
    // vendor/product ids, so the matching HID interface supplies identification.
    let mut xbox_hid: Vec<HidDescriptor> = hid_pads
        .iter()
        .filter(|d| d.vid == 0x045E)
        .cloned()
        .collect();
    xbox_hid.sort_by(|a, b| a.path.cmp(&b.path));

    for (slot, pad) in xpads.iter().enumerate() {
        let id = format!("xinput:{}", pad.index);
        let matched = xbox_hid.get(slot);
        let vid = matched.map(|d| d.vid).unwrap_or(0x045E);
        let pid = matched.map(|d| d.pid).unwrap_or(0);
        let (family, name, manufacturer) = identify(
            vid,
            pid,
            matched.map(|d| d.product.as_str()).unwrap_or("Xbox controller"),
            matched.map(|d| d.manufacturer.as_str()).unwrap_or("Microsoft"),
        );
        let connection = matched
            .map(|d| d.connection.clone())
            .unwrap_or_else(|| if pad.wireless_flag { "wireless".into() } else { "usb".into() });

        let state = shared.lock().ok().and_then(|g| g.states.get(&id).cloned());
        devices.push(DeviceInfo {
            id: id.clone(),
            name,
            manufacturer,
            model: model_for(&family, "Xbox controller"),
            family: family.clone(),
            connection,
            vid,
            pid,
            serial: matched.and_then(|d| d.serial.clone()),
            backend: "xinput".into(),
            xinput_index: Some(pad.index),
            path: matched.map(|d| d.path.clone()),
            usage_page: matched.map(|d| d.usage_page),
            usage: matched.map(|d| d.usage),
            input_report_length: matched.map(|d| d.input_len),
            battery: battery_of(state.as_ref()),
            identities: vec![
                format!("XInput slot {}", pad.index),
                format!("VID_{:04X}&PID_{:04X}", vid, pid),
                format!("Subtype {}", pad.sub_type),
            ],
            has_touchpad: false,
            has_motion: false,
        });
        keep.push(id);
    }

    // PlayStation and generic pads: read their HID input reports directly.
    for desc in hid_pads.iter() {
        // Xbox HID interfaces are only used for identification; XInput carries the input.
        if desc.vid == 0x045E && !xpads.is_empty() {
            continue;
        }
        let id = format!(
            "hid:{:04x}:{:04x}:{:08x}",
            desc.vid,
            desc.pid,
            (hash_path(&desc.path) & 0xffff_ffff) as u32
        );
        let (family, name, manufacturer) =
            identify(desc.vid, desc.pid, &desc.product, &desc.manufacturer);
        let state = shared.lock().ok().and_then(|g| g.states.get(&id).cloned());

        if !readers.contains_key(&id) {
            let stop = Arc::new(AtomicBool::new(false));
            let dead = Arc::new(AtomicBool::new(false));
            spawn_reader(
                desc.clone(),
                family.clone(),
                id.clone(),
                shared.clone(),
                stop.clone(),
                dead.clone(),
            );
            readers.insert(id.clone(), ReaderHandle { stop, dead });
        }

        devices.push(DeviceInfo {
            id: id.clone(),
            name,
            manufacturer,
            model: model_for(&family, &desc.product),
            family: family.clone(),
            connection: desc.connection.clone(),
            vid: desc.vid,
            pid: desc.pid,
            serial: desc.serial.clone(),
            backend: "hid".into(),
            xinput_index: None,
            path: Some(desc.path.clone()),
            usage_page: Some(desc.usage_page),
            usage: Some(desc.usage),
            input_report_length: Some(desc.input_len),
            battery: battery_of(state.as_ref()),
            identities: vec![
                format!("VID_{:04X}&PID_{:04X}", desc.vid, desc.pid),
                format!("HID usage {:04X}:{:04X}", desc.usage_page, desc.usage),
                format!("HID version {:#06x}", desc.version),
                desc.path.clone(),
            ],
            has_touchpad: matches!(family.as_str(), "dualshock4" | "dualsense"),
            has_motion: matches!(family.as_str(), "dualshock4" | "dualsense"),
        });
        keep.push(id);
    }

    if let Ok(mut guard) = shared.lock() {
        if guard.devices.len() != devices.len() {
            guard.revision += 1;
        }
        guard.devices = devices;
        guard.states.retain(|id, _| keep.contains(id));
    }

    readers.retain(|id, handle| {
        if keep.contains(id) {
            true
        } else {
            handle.stop.store(true, Ordering::Relaxed);
            false
        }
    });
}

fn run(app: Option<AppHandle>, shared: Arc<Mutex<Shared>>) {
    let xinput = XInputApi::load();
    let mut xpads: Vec<XInputDevice> = Vec::new();
    let mut readers: HashMap<String, ReaderHandle> = HashMap::new();
    let mut last_scan = Instant::now() - Duration::from_secs(5);
    let mut frame = 0u64;

    loop {
        if last_scan.elapsed() > Duration::from_millis(700) {
            scan(&shared, xinput.as_ref(), &mut xpads, &mut readers);
            last_scan = Instant::now();
        }

        // Drop readers whose device disappeared.
        let mut dead_ids: Vec<String> = Vec::new();
        for (id, handle) in readers.iter() {
            if handle.dead.load(Ordering::Relaxed) {
                handle.stop.store(true, Ordering::Relaxed);
                dead_ids.push(id.clone());
            }
        }
        for id in dead_ids {
            readers.remove(&id);
            if let Ok(mut guard) = shared.lock() {
                guard.states.remove(&id);
            }
            last_scan = Instant::now() - Duration::from_secs(5);
        }

        // Poll Xbox pads.
        if let Some(api) = xinput.as_ref() {
            for pad in xpads.iter() {
                let id = format!("xinput:{}", pad.index);
                if let Some(state) = api.poll(pad.index, &id) {
                    if let Ok(mut guard) = shared.lock() {
                        guard.states.insert(id, state);
                    }
                }
            }
        }

        // Publish the latest view of the world.
        if frame % 3 == 0 {
            let snapshot = {
                let mut guard = match shared.lock() {
                    Ok(g) => g,
                    Err(_) => continue,
                };
                let states = guard.states.clone();
                for device in guard.devices.iter_mut() {
                    device.battery = battery_of(states.get(&device.id));
                }
                Snapshot {
                    devices: guard.devices.clone(),
                    states: states.values().cloned().collect(),
                    timestamp_ms: now_ms(),
                    revision: guard.revision,
                }
            };
            if let Some(app) = app.as_ref() {
                let _ = app.emit("gp://snapshot", &snapshot);
            }
        }

        frame = frame.wrapping_add(1);
        thread::sleep(Duration::from_millis(16));
    }
}
