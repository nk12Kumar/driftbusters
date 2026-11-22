//! Shared data model exchanged between the native layer and the UI.
//! Everything is serialised as camelCase JSON for the React frontend.

use serde::Serialize;
use std::collections::BTreeMap;

/// Canonical button identifiers. The UI decides how to label them:
/// PlayStation shows Cross/Circle/Square/Triangle, Xbox shows A/B/X/Y.
pub const CANONICAL_BUTTONS: [&str; 21] = [
    "faceSouth",
    "faceEast",
    "faceNorth",
    "faceWest",
    "l1",
    "r1",
    "l2",
    "r2",
    "l3",
    "r3",
    "dpUp",
    "dpDown",
    "dpLeft",
    "dpRight",
    "menu",
    "view",
    "guide",
    "touchpad",
    "mute",
    "share",
    "paddle",
];

#[derive(Serialize, Clone, Default, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Battery {
    /// Percentage 0-100 when the device reports a level.
    pub level: Option<u8>,
    /// true charging, false discharging, None unknown.
    pub charging: Option<bool>,
    /// Human readable status: "Charging", "Full", "Discharging", "Unknown".
    pub status: String,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    /// Stable identifier used by the UI to select a controller.
    pub id: String,
    pub name: String,
    pub manufacturer: String,
    pub model: String,
    /// dualshock4 | dualsense | xbox360 | xboxone | xboxseries | generic
    pub family: String,
    /// usb | bluetooth | unknown
    pub connection: String,
    pub vid: u16,
    pub pid: u16,
    pub serial: Option<String>,
    /// xinput | hid
    pub backend: String,
    pub xinput_index: Option<u32>,
    pub path: Option<String>,
    pub usage_page: Option<u16>,
    pub usage: Option<u16>,
    pub input_report_length: Option<u16>,
    pub battery: Option<Battery>,
    /// Extra human-readable identification strings (PnP path, HID collections...).
    pub identities: Vec<String>,
    pub has_touchpad: bool,
    pub has_motion: bool,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Axes {
    pub lx: f32,
    pub ly: f32,
    pub rx: f32,
    pub ry: f32,
    /// Left trigger 0..1 (analogue where the pad provides it).
    pub lt: f32,
    /// Right trigger 0..1.
    pub rt: f32,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct RawState {
    pub report_id: u8,
    pub report: Vec<u8>,
    /// Raw logical axis values in report order (LX, LY, RX, RY, LT, RT).
    pub axes: Vec<i32>,
    /// Raw button indices / HID usage ids currently pressed.
    pub buttons: Vec<u32>,
    /// Raw battery nibble as reported by the device.
    pub power: Option<u8>,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct InputState {
    pub id: String,
    pub timestamp_ms: u64,
    pub packet: u32,
    pub axes: Axes,
    pub buttons: BTreeMap<String, bool>,
    pub raw: RawState,
    pub battery_level: Option<u8>,
    pub charging: Option<bool>,
    /// True when the pad reports it is running from USB power (XInput wired).
    pub powered: Option<bool>,
    /// True once at least one report has been received.
    pub live: bool,
}

impl InputState {
    pub fn new(id: &str) -> Self {
        let mut buttons = BTreeMap::new();
        for name in CANONICAL_BUTTONS {
            buttons.insert(name.to_string(), false);
        }
        Self {
            id: id.to_string(),
            buttons,
            ..Default::default()
        }
    }
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub devices: Vec<DeviceInfo>,
    pub states: Vec<InputState>,
    pub timestamp_ms: u64,
    pub revision: u64,
}

pub fn now_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
