//! XInput access. Xbox pads on Windows expose the best-supported, most complete
//! data through XInput (including battery state and the Guide button via the
//! undocumented ordinal 100 "GetStateEx" entry point).

use crate::model::{Axes, InputState};
use std::collections::BTreeMap;
use windows_sys::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryW};
use windows_sys::Win32::UI::Input::XboxController::{
    XInputGetState, XINPUT_BATTERY_INFORMATION, XINPUT_CAPABILITIES, XINPUT_GAMEPAD, XINPUT_STATE,
};
type GetStateExFn = unsafe extern "system" fn(u32, *mut XINPUT_STATE) -> u32;
type GetCapsFn = unsafe extern "system" fn(u32, u32, *mut XINPUT_CAPABILITIES) -> u32;
type GetBatteryFn = unsafe extern "system" fn(u32, u8, *mut XINPUT_BATTERY_INFORMATION) -> u32;

const ERROR_SUCCESS: u32 = 0;
const BATTERY_DEVTYPE_GAMEPAD: u8 = 0;

const BTN_DPAD_UP: u16 = 0x0001;
const BTN_DPAD_DOWN: u16 = 0x0002;
const BTN_DPAD_LEFT: u16 = 0x0004;
const BTN_DPAD_RIGHT: u16 = 0x0008;
const BTN_START: u16 = 0x0010;
const BTN_BACK: u16 = 0x0020;
const BTN_LEFT_THUMB: u16 = 0x0040;
const BTN_RIGHT_THUMB: u16 = 0x0080;
const BTN_LEFT_SHOULDER: u16 = 0x0100;
const BTN_RIGHT_SHOULDER: u16 = 0x0200;
const BTN_GUIDE: u16 = 0x0400;
const BTN_A: u16 = 0x1000;
const BTN_B: u16 = 0x2000;
const BTN_X: u16 = 0x4000;
const BTN_Y: u16 = 0x8000;

pub struct XInputApi {
    get_state_ex: Option<GetStateExFn>,
    get_caps: GetCapsFn,
    get_battery: GetBatteryFn,
}

/// Public, hardware-derived facts about an XInput slot.
pub struct XInputDevice {
    pub index: u32,
    pub sub_type: u8,
    pub wireless_flag: bool,
}

impl XInputApi {
    pub fn load() -> Option<Self> {
        let module = unsafe {
            let name: Vec<u16> = "xinput1_4.dll\0".encode_utf16().collect();
            let mut h = LoadLibraryW(name.as_ptr());
            if h.is_null() {
                let fallback: Vec<u16> = "xinput1_3.dll\0".encode_utf16().collect();
                h = LoadLibraryW(fallback.as_ptr());
            }
            h
        };
        if module.is_null() {
            return None;
        }

        unsafe {
            let get_state_ex = GetProcAddress(module, 100 as *const u8)
                .map(|f| std::mem::transmute::<_, GetStateExFn>(f));
            let get_caps = GetProcAddress(module, c"XInputGetCapabilities".as_ptr() as *const u8)
                .map(|f| std::mem::transmute::<_, GetCapsFn>(f))?;
            let get_battery =
                GetProcAddress(module, c"XInputGetBatteryInformation".as_ptr() as *const u8)
                    .map(|f| std::mem::transmute::<_, GetBatteryFn>(f))
                    .unwrap_or_else(|| unused_battery);
            Some(Self {
                get_state_ex,
                get_caps,
                get_battery,
            })
        }
    }

    /// Diagnostic: raw result code for each slot (0 = connected, 1167 = empty).
    pub fn slot_codes(&self) -> Vec<u32> {
        (0..4u32)
            .map(|index| {
                let mut caps: XINPUT_CAPABILITIES = unsafe { std::mem::zeroed() };
                unsafe { (self.get_caps)(index, 0, &mut caps) }
            })
            .collect()
    }

    /// Connected slots with their subtype and wireless flag.
    pub fn devices(&self) -> Vec<XInputDevice> {
        let mut out = Vec::new();
        for index in 0..4u32 {
            let mut caps: XINPUT_CAPABILITIES = unsafe { std::mem::zeroed() };
            let rc = unsafe { (self.get_caps)(index, 0, &mut caps) };
            if rc != ERROR_SUCCESS {
                continue;
            }
            out.push(XInputDevice {
                index,
                sub_type: caps.SubType,
                wireless_flag: caps.Flags & 0x0002 != 0,
            });
        }
        out
    }

    pub fn poll(&self, index: u32, id: &str) -> Option<InputState> {
        let mut state: XINPUT_STATE = unsafe { std::mem::zeroed() };
        let rc = match self.get_state_ex {
            Some(f) => unsafe { f(index, &mut state) },
            None => unsafe { XInputGetState(index, &mut state) },
        };
        if rc != ERROR_SUCCESS {
            return None;
        }

        let g: XINPUT_GAMEPAD = state.Gamepad;
        let mut out = InputState::new(id);
        out.packet = state.dwPacketNumber;
        out.live = true;
        out.timestamp_ms = crate::model::now_ms();

        out.axes = Axes {
            lx: norm_axis(g.sThumbLX),
            ly: norm_axis(g.sThumbLY),
            rx: norm_axis(g.sThumbRX),
            ry: norm_axis(g.sThumbRY),
            lt: g.bLeftTrigger as f32 / 255.0,
            rt: g.bRightTrigger as f32 / 255.0,
        };

        let mut pressed = BTreeMap::new();
        let mut raw_buttons = Vec::new();
        let map: [(&str, u16, u32); 16] = [
            ("faceSouth", BTN_A, 0),
            ("faceEast", BTN_B, 1),
            ("faceWest", BTN_X, 2),
            ("faceNorth", BTN_Y, 3),
            ("l1", BTN_LEFT_SHOULDER, 4),
            ("r1", BTN_RIGHT_SHOULDER, 5),
            ("view", BTN_BACK, 6),
            ("menu", BTN_START, 7),
            ("l3", BTN_LEFT_THUMB, 8),
            ("r3", BTN_RIGHT_THUMB, 9),
            ("dpUp", BTN_DPAD_UP, 10),
            ("dpDown", BTN_DPAD_DOWN, 11),
            ("dpLeft", BTN_DPAD_LEFT, 12),
            ("dpRight", BTN_DPAD_RIGHT, 13),
            ("guide", BTN_GUIDE, 14),
            ("l2", 0, 15),
        ];
        for (name, bit, index_raw) in map {
            // Triggers are analogue: report as pressed past a light threshold.
            let is_pressed = if name == "l2" {
                g.bLeftTrigger > 20
            } else if name == "r2" {
                g.bRightTrigger > 20
            } else {
                g.wButtons & bit != 0
            };
            pressed.insert(name.to_string(), is_pressed);
            if is_pressed {
                raw_buttons.push(index_raw);
            }
        }
        pressed.insert("r2".into(), g.bRightTrigger > 20);
        if g.bRightTrigger > 20 {
            raw_buttons.push(16);
        }
        pressed.insert("touchpad".into(), false);
        pressed.insert("mute".into(), false);
        pressed.insert("share".into(), false);
        pressed.insert("paddle".into(), false);

        out.buttons = pressed;
        out.raw = crate::model::RawState {
            report_id: 0,
            report: Vec::new(),
            axes: vec![
                g.sThumbLX as i32,
                g.sThumbLY as i32,
                g.sThumbRX as i32,
                g.sThumbRY as i32,
                g.bLeftTrigger as i32,
                g.bRightTrigger as i32,
            ],
            buttons: raw_buttons,
            power: None,
        };

        let mut battery: XINPUT_BATTERY_INFORMATION = unsafe { std::mem::zeroed() };
        let rc = unsafe { (self.get_battery)(index, BATTERY_DEVTYPE_GAMEPAD, &mut battery) };
        if rc == ERROR_SUCCESS {
            // BatteryLevel: 0 empty, 1 low, 2 medium, 3 full; 4 = not applicable.
            let level = match battery.BatteryLevel {
                0 => Some(0u8),
                1 => Some(15),
                2 => Some(55),
                3 => Some(100),
                _ => None,
            };
            let charging = match battery.BatteryType {
                0 => Some(false), // disconnected/alkaline
                1 => Some(true),  // wired: powered over USB
                255 => None,
                _ => Some(true), // rechargeable
            };
            out.powered = match battery.BatteryType {
                0 | 1 => Some(true),
                _ => Some(false),
            };
            out.battery_level = level;
            out.charging = charging;
            out.raw.power = Some(battery.BatteryType);
        }

        Some(out)
    }
}

unsafe extern "system" fn unused_battery(
    _: u32,
    _: u8,
    _: *mut XINPUT_BATTERY_INFORMATION,
) -> u32 {
    1167 // ERROR_DEVICE_NOT_CONNECTED
}

fn norm_axis(value: i16) -> f32 {
    let v = value as f32;
    // Normalise to -1..1, keeping "up/right = positive".
    (v / if v < 0.0 { 32768.0 } else { 32767.0 }).clamp(-1.0, 1.0)
}
