#![cfg_attr(mobile, tauri::mobile_entry_point)]

mod hid;
mod manager;
mod model;
mod parsers;
mod store;
mod xinput;

pub use store::portable_root;
use manager::Shared;
use model::Snapshot;
use std::sync::Mutex;

#[tauri::command]
fn get_snapshot(shared: tauri::State<'_, Mutex<Shared>>) -> Snapshot {
    let guard = match shared.lock() {
        Ok(g) => g,
        Err(_) => return Snapshot::default(),
    };
    Snapshot {
        devices: guard.devices.clone(),
        states: guard.states.values().cloned().collect(),
        timestamp_ms: model::now_ms(),
        revision: guard.revision,
    }
}

/// Headless hardware probe: prints what the machine actually reports, no window.
pub fn probe(seconds: u64) {
    manager::start(None);
    let shared = manager::shared();
    std::thread::sleep(std::time::Duration::from_millis(1200));
    let mut last = String::new();
    for _ in 0..seconds * 4 {
        let snapshot = {
            let guard = match shared.lock() {
                Ok(g) => g,
                Err(_) => return,
            };
            Snapshot {
                devices: guard.devices.clone(),
                states: guard.states.values().cloned().collect(),
                timestamp_ms: model::now_ms(),
                revision: guard.revision,
            }
        };
        let text = serde_json::to_string(&snapshot).unwrap_or_default();
        if text != last {
            println!("{}", serde_json::to_string_pretty(&snapshot).unwrap_or_default());
            println!("---");
            last = text;
        }
        std::thread::sleep(std::time::Duration::from_millis(250));
    }
    let summary = {
        let guard = match shared.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        guard
            .devices
            .iter()
            .map(|d| format!("{} [{} / {}] VID_{:04X} PID_{:04X} packets={}", d.name, d.family, d.connection, d.vid, d.pid, guard.states.get(&d.id).map(|s| s.packet).unwrap_or(0)))
            .collect::<Vec<_>>()
    };
    println!("DETECTED {} device(s):", summary.len());
    for line in summary {
        println!("  {}", line);
    }
}

/// Lists every HID interface Windows exposes, for diagnosing detection issues.
pub fn dump_hid() {
    let all = hid::enumerate();
    println!("{} HID interface(s)", all.len());
    for d in all {
        println!(
            "{:04X}:{:04X} usage={:04X}:{:04X} gamepad={} conn={} product={:?} manufacturer={:?} in={}b path={}",
            d.vid, d.pid, d.usage_page, d.usage, d.is_gamepad(), d.connection,
            d.product, d.manufacturer, d.input_len, d.path
        );
    }
}

/// Prints live input changes so hardware behaviour can be verified headlessly.
pub fn watch(seconds: u64) {
    manager::start(None);
    let shared = manager::shared();
    std::thread::sleep(std::time::Duration::from_millis(1200));
    let started = std::time::Instant::now();
    let mut last = String::new();
    while started.elapsed().as_secs() < seconds {
        let line = {
            let guard = match shared.lock() {
                Ok(g) => g,
                Err(_) => return,
            };
            let Some(device) = guard.devices.first() else {
                drop(guard);
                println!("waiting for a controller...");
                std::thread::sleep(std::time::Duration::from_millis(500));
                continue;
            };
            let state = guard.states.get(&device.id);
            match state {
                None => format!("{} [{}] waiting for reports", device.name, device.connection),
                Some(s) => {
                    let pressed: Vec<&str> = s
                        .buttons
                        .iter()
                        .filter(|(_, v)| **v)
                        .map(|(k, _)| k.as_str())
                        .collect();
                    format!(
                        "{} | buttons={:?} | LX {:.2} LY {:.2} RX {:.2} RY {:.2} | LT {:.0}% RT {:.0}% | packet {}",
                        device.name,
                        pressed,
                        s.axes.lx,
                        s.axes.ly,
                        s.axes.rx,
                        s.axes.ry,
                        s.axes.lt * 100.0,
                        s.axes.rt * 100.0,
                        s.packet
                    )
                }
            }
        };
        if line != last {
            println!("[{:>5.1}s] {}", started.elapsed().as_secs_f32(), line);
            last = line;
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
}

/// Prints where this build stores its data (installed vs portable).
pub fn where_data() {
    match portable_root() {
        Some(root) => println!("mode: portable\ndata: {}", root.display()),
        None => println!("mode: installed\ndata: %APPDATA%\\com.driftbusters.app"),
    }
    if let Ok(exe) = std::env::current_exe() {
        println!("exe: {}", exe.display());
    }
}

pub fn xinput_probe() {
    match xinput::XInputApi::load() {
        None => println!("XInput DLL could not be loaded"),
        Some(api) => {
            let codes = api.slot_codes();
            println!("XInput slot result codes (0 = connected, 1167 = not connected): {:?}", codes);
            for (i, pad) in api.devices().iter().enumerate() {
                println!("slot {}: subtype {} wireless {}", i, pad.sub_type, pad.wireless_flag);
            }
        }
    }
}

pub fn run() {
    let shared = manager::shared();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(shared)
        .invoke_handler(tauri::generate_handler![
            get_snapshot,
            store::list_reports,
            store::save_report,
            store::delete_report,
            store::clear_reports,
            store::save_bytes,
            store::app_info
        ])
        .setup(|app| {
            manager::start(Some(app.handle().clone()));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Gamepad Lab");
}
