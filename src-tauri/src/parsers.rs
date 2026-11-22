//! Report parsers. PlayStation pads use documented, fixed report layouts;
//! generic HID pads are decoded through the HID usage tables so every physical
//! input stays identifiable without inventing a mapping.

use crate::model::{Axes, CANONICAL_BUTTONS};
use std::collections::BTreeMap;
use windows_sys::Win32::Devices::HumanInterfaceDevice::{
    HidP_GetUsageValue, HidP_GetUsages, HidP_Input, HIDP_CAPS, PHIDP_PREPARSED_DATA,
};

const HIDP_STATUS_SUCCESS: i32 = 0x0011_0000;

pub struct Parsed {
    pub axes: Axes,
    pub buttons: BTreeMap<String, bool>,
    pub raw_axes: Vec<i32>,
    pub raw_buttons: Vec<u32>,
    pub battery_level: Option<u8>,
    pub charging: Option<bool>,
    pub power: Option<u8>,
}

fn blank() -> BTreeMap<String, bool> {
    let mut m = BTreeMap::new();
    for name in CANONICAL_BUTTONS {
        m.insert(name.to_string(), false);
    }
    m
}

impl Default for Parsed {
    fn default() -> Self {
        Self {
            axes: Axes::default(),
            buttons: blank(),
            raw_axes: Vec::new(),
            raw_buttons: Vec::new(),
            battery_level: None,
            charging: None,
            power: None,
        }
    }
}

fn stick(v: u8) -> f32 {
    ((v as f32 - 127.5) / 127.5).clamp(-1.0, 1.0)
}

fn dpad(m: &mut BTreeMap<String, bool>, raw: &mut Vec<u32>, nibble: u8) {
    // 0 = up, clockwise, 8 = released.
    let dirs: [(u32, bool, &str); 4] = [
        (14, matches!(nibble, 7 | 0 | 1), "dpUp"),
        (15, matches!(nibble, 1 | 2 | 3), "dpRight"),
        (16, matches!(nibble, 3 | 4 | 5), "dpDown"),
        (17, matches!(nibble, 5 | 6 | 7), "dpLeft"),
    ];
    for (index, pressed, name) in dirs {
        m.insert(name.to_string(), pressed);
        if pressed {
            raw.push(index);
        }
    }
}

fn battery_from(byte: u8) -> (Option<u8>, Option<bool>, Option<u8>) {
    let level = byte & 0x0F;
    let plug = byte >> 4;
    let percent = (level.min(10) as u16 * 10).min(100) as u8;
    match plug {
        0 => (Some(percent), Some(false), Some(byte)),
        1 => (Some(percent), Some(true), Some(byte)),
        2 => (Some(100), Some(true), Some(byte)),
        _ => (Some(percent), None, Some(byte)),
    }
}

pub fn parse_dualshock4(report: &[u8]) -> Option<Parsed> {
    let id = *report.first()?;
    let base: usize = match id {
        0x11 => 3,
        0x01 | 0x02 => 1,
        _ => return None,
    };
    if report.len() < base + 10 {
        return None;
    }

    let mut p = Parsed {
        axes: Axes {
            lx: stick(report[base]),
            ly: stick(report[base + 1]),
            rx: stick(report[base + 2]),
            ry: stick(report[base + 3]),
            lt: report[base + 7] as f32 / 255.0,
            rt: report[base + 8] as f32 / 255.0,
        },
        raw_axes: vec![
            report[base] as i32,
            report[base + 1] as i32,
            report[base + 2] as i32,
            report[base + 3] as i32,
            report[base + 7] as i32,
            report[base + 8] as i32,
        ],
        ..Default::default()
    };

    let b0 = report[base + 4];
    let b1 = report[base + 5];
    let b2 = report[base + 6];

    let faces: [(u32, bool, &str); 4] = [
        (0, b0 & 0x20 != 0, "faceSouth"),
        (1, b0 & 0x40 != 0, "faceEast"),
        (2, b0 & 0x80 != 0, "faceNorth"),
        (3, b0 & 0x10 != 0, "faceWest"),
    ];
    for (index, pressed, name) in faces {
        p.buttons.insert(name.to_string(), pressed);
        if pressed {
            p.raw_buttons.push(index);
        }
    }

    let shoulders: [(u32, bool, &str); 8] = [
        (4, b1 & 0x01 != 0, "l1"),
        (5, b1 & 0x02 != 0, "r1"),
        (6, b1 & 0x04 != 0 || p.axes.lt > 0.08, "l2"),
        (7, b1 & 0x08 != 0 || p.axes.rt > 0.08, "r2"),
        (8, b1 & 0x10 != 0, "share"),
        (9, b1 & 0x20 != 0, "menu"),
        (10, b1 & 0x40 != 0, "l3"),
        (11, b1 & 0x80 != 0, "r3"),
    ];
    for (index, pressed, name) in shoulders {
        p.buttons.insert(name.to_string(), pressed);
        if pressed {
            p.raw_buttons.push(index);
        }
    }

    let extra: [(u32, bool, &str); 2] = [
        (12, b2 & 0x01 != 0, "guide"),
        (13, b2 & 0x02 != 0, "touchpad"),
    ];
    for (index, pressed, name) in extra {
        p.buttons.insert(name.to_string(), pressed);
        if pressed {
            p.raw_buttons.push(index);
        }
    }

    dpad(&mut p.buttons, &mut p.raw_buttons, b0 & 0x0F);

    if report.len() > base + 29 {
        let (level, charging, power) = battery_from(report[base + 29]);
        p.battery_level = level;
        p.charging = charging;
        p.power = power;
    }

    Some(p)
}

pub fn parse_dualsense(report: &[u8]) -> Option<Parsed> {
    let id = *report.first()?;
    let base: usize = match id {
        0x31 => 2,
        0x01 | 0x02 => 1,
        _ => return None,
    };
    if report.len() < base + 10 {
        return None;
    }

    let mut p = Parsed {
        axes: Axes {
            lx: stick(report[base]),
            ly: stick(report[base + 1]),
            rx: stick(report[base + 2]),
            ry: stick(report[base + 3]),
            lt: report[base + 4] as f32 / 255.0,
            rt: report[base + 5] as f32 / 255.0,
        },
        raw_axes: vec![
            report[base] as i32,
            report[base + 1] as i32,
            report[base + 2] as i32,
            report[base + 3] as i32,
            report[base + 4] as i32,
            report[base + 5] as i32,
        ],
        ..Default::default()
    };

    let b0 = report[base + 7];
    let b1 = report[base + 8];
    let b2 = report[base + 9];

    let faces: [(u32, bool, &str); 4] = [
        (0, b0 & 0x20 != 0, "faceSouth"),
        (1, b0 & 0x40 != 0, "faceEast"),
        (2, b0 & 0x80 != 0, "faceNorth"),
        (3, b0 & 0x10 != 0, "faceWest"),
    ];
    for (index, pressed, name) in faces {
        p.buttons.insert(name.to_string(), pressed);
        if pressed {
            p.raw_buttons.push(index);
        }
    }

    let shoulders: [(u32, bool, &str); 8] = [
        (4, b1 & 0x01 != 0, "l1"),
        (5, b1 & 0x02 != 0, "r1"),
        (6, b1 & 0x04 != 0 || p.axes.lt > 0.08, "l2"),
        (7, b1 & 0x08 != 0 || p.axes.rt > 0.08, "r2"),
        (8, b1 & 0x10 != 0, "share"),
        (9, b1 & 0x20 != 0, "menu"),
        (10, b1 & 0x40 != 0, "l3"),
        (11, b1 & 0x80 != 0, "r3"),
    ];
    for (index, pressed, name) in shoulders {
        p.buttons.insert(name.to_string(), pressed);
        if pressed {
            p.raw_buttons.push(index);
        }
    }

    let extra: [(u32, bool, &str); 3] = [
        (12, b2 & 0x01 != 0, "guide"),
        (13, b2 & 0x02 != 0, "touchpad"),
        (18, b2 & 0x04 != 0, "mute"),
    ];
    for (index, pressed, name) in extra {
        p.buttons.insert(name.to_string(), pressed);
        if pressed {
            p.raw_buttons.push(index);
        }
    }

    dpad(&mut p.buttons, &mut p.raw_buttons, b0 & 0x0F);

    if report.len() > base + 52 {
        let (level, charging, power) = battery_from(report[base + 52]);
        p.battery_level = level;
        p.charging = charging;
        p.power = power;
    }

    Some(p)
}

/// Learned logical ranges, used to normalise pads with unknown report descriptors.
#[derive(Default, Clone)]
pub struct LearnedRanges {
    pub lx: (f32, f32),
    pub ly: (f32, f32),
    pub rx: (f32, f32),
    pub ry: (f32, f32),
    pub lt: (f32, f32),
    pub rt: (f32, f32),
}

fn learn(range: &mut (f32, f32), value: f32) {
    if range.0 == 0.0 && range.1 == 0.0 {
        *range = (value, value);
        return;
    }
    if value < range.0 {
        range.0 = value;
    }
    if value > range.1 {
        range.1 = value;
    }
}

fn normalise(range: (f32, f32), value: f32) -> f32 {
    let (min, max) = range;
    if (max - min).abs() < 4.0 {
        // Not enough travel observed yet: assume a symmetric 8-bit style axis.
        return 0.0;
    }
    let centre = (min + max) / 2.0;
    let half = (max - min) / 2.0;
    ((value - centre) / half).clamp(-1.0, 1.0)
}

fn usage_value(
    prepared: PHIDP_PREPARSED_DATA,
    report: &[u8],
    usage: u16,
    collections: u16,
) -> Option<u32> {
    let mut value: u32 = 0;
    for collection in 0..collections.max(1) {
        let status = unsafe {
            HidP_GetUsageValue(
                HidP_Input,
                0x01,
                collection,
                usage,
                &mut value,
                prepared,
                report.as_ptr(),
                report.len() as u32,
            )
        };
        if status == HIDP_STATUS_SUCCESS {
            return Some(value);
        }
    }
    None
}

fn pressed_usages(
    prepared: PHIDP_PREPARSED_DATA,
    report: &[u8],
    collections: u16,
) -> Vec<u32> {
    let mut out: Vec<u32> = Vec::new();
    let mut buffer = vec![0u16; 128];
    for collection in 0..collections.max(1) {
        let mut len: u32 = buffer.len() as u32;
        let status = unsafe {
            HidP_GetUsages(
                HidP_Input,
                0x09,
                collection,
                buffer.as_mut_ptr(),
                &mut len,
                prepared,
                report.as_ptr() as *mut u8,
                report.len() as u32,
            )
        };
        if status == HIDP_STATUS_SUCCESS {
            for usage in &buffer[..(len as usize).min(buffer.len())] {
                let usage = *usage as u32;
                if !out.contains(&usage) {
                    out.push(usage);
                }
            }
        }
    }
    out
}

/// Decode any standard HID gamepad through usage tables. Values are normalised
/// against ranges learned from the device itself, so unusual pads still work.
pub fn parse_generic(
    report: &[u8],
    prepared: PHIDP_PREPARSED_DATA,
    caps: &HIDP_CAPS,
    ranges: &mut LearnedRanges,
) -> Option<Parsed> {
    let collections = caps.NumberLinkCollectionNodes.max(1);
    let x = usage_value(prepared, report, 0x30, collections);
    let y = usage_value(prepared, report, 0x31, collections);
    let z = usage_value(prepared, report, 0x32, collections);
    let rx = usage_value(prepared, report, 0x33, collections);
    let ry = usage_value(prepared, report, 0x34, collections);
    let rz = usage_value(prepared, report, 0x35, collections);
    let hat = usage_value(prepared, report, 0x39, collections);

    if x.is_none() && y.is_none() && pressed_usages(prepared, report, collections).is_empty() {
        return None;
    }

    if let Some(v) = x {
        learn(&mut ranges.lx, v as f32);
    }
    if let Some(v) = y {
        learn(&mut ranges.ly, v as f32);
    }
    if let Some(v) = rx {
        learn(&mut ranges.rx, v as f32);
    }
    if let Some(v) = ry {
        learn(&mut ranges.ry, v as f32);
    }
    if let Some(v) = z {
        learn(&mut ranges.lt, v as f32);
    }
    if let Some(v) = rz {
        learn(&mut ranges.rt, v as f32);
    }

    let mut p = Parsed::default();
    p.axes = Axes {
        lx: normalise(ranges.lx, x.unwrap_or(0) as f32),
        ly: normalise(ranges.ly, y.unwrap_or(0) as f32),
        rx: normalise(ranges.rx, rx.unwrap_or(0) as f32),
        ry: normalise(ranges.ry, ry.unwrap_or(0) as f32),
        lt: {
            let (min, max) = ranges.lt;
            if (max - min).abs() < 4.0 {
                0.0
            } else {
                ((z.unwrap_or(0) as f32 - min) / (max - min)).clamp(0.0, 1.0)
            }
        },
        rt: {
            let (min, max) = ranges.rt;
            if (max - min).abs() < 4.0 {
                0.0
            } else {
                ((rz.unwrap_or(0) as f32 - min) / (max - min)).clamp(0.0, 1.0)
            }
        },
    };

    p.raw_axes = vec![
        x.unwrap_or(0) as i32,
        y.unwrap_or(0) as i32,
        rx.unwrap_or(0) as i32,
        ry.unwrap_or(0) as i32,
        z.unwrap_or(0) as i32,
        rz.unwrap_or(0) as i32,
    ];

    let usages = pressed_usages(prepared, report, collections);
    p.raw_buttons = usages.clone();

    // Standard usage ids for the primary buttons on generic pads.
    let named: [(u32, &str); 16] = [
        (1, "faceSouth"),
        (2, "faceEast"),
        (4, "faceNorth"),
        (5, "faceWest"),
        (7, "l1"),
        (8, "r1"),
        (11, "l3"),
        (12, "r3"),
        (6, "view"),
        (10, "menu"),
        (13, "guide"),
        (9, "share"),
        (14, "touchpad"),
        (15, "mute"),
        (16, "paddle"),
        (17, "paddle"),
    ];
    for (usage, name) in named {
        let pressed = usages.contains(&usage);
        p.buttons.insert(name.to_string(), pressed);
    }

    if let Some(h) = hat {
        // Hat switches are usually 0..7 or 1..8, with 8 (or 0xF) meaning centred.
        let nibble = if h >= 0xF {
            8
        } else if h >= 1 && h <= 8 {
            // 1-based hats: 1 = up ... 8 = up-left
            ((h - 1) % 8) as u8
        } else {
            (h % 8) as u8
        };
        dpad(&mut p.buttons, &mut p.raw_buttons, nibble);
    }

    Some(p)
}
