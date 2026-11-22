//! Low level Windows HID access: interface enumeration, descriptor facts and
//! overlapped input-report reading. Used for PlayStation and generic pads,
//! which XInput does not cover.

use std::ffi::c_void;
use std::ptr::null_mut;
use windows_sys::Win32::Devices::DeviceAndDriverInstallation::{
    SetupDiDestroyDeviceInfoList, SetupDiEnumDeviceInterfaces, SetupDiGetClassDevsW,
    SetupDiGetDeviceInterfaceDetailW, SetupDiGetDeviceRegistryPropertyW, DIGCF_DEVICEINTERFACE,
    DIGCF_PRESENT, SPDRP_ENUMERATOR_NAME, SP_DEVICE_INTERFACE_DETAIL_DATA_W,
    SP_DEVICE_INTERFACE_DATA, SP_DEVINFO_DATA,
};
use windows_sys::Win32::Devices::HumanInterfaceDevice::{
    HidD_FreePreparsedData, HidD_GetAttributes, HidD_GetHidGuid, HidD_GetManufacturerString,
    HidD_GetPreparsedData, HidD_GetProductString, HidD_GetSerialNumberString, HidP_GetCaps,
    HIDD_ATTRIBUTES, HIDP_CAPS, PHIDP_PREPARSED_DATA,
};
use windows_sys::Win32::Foundation::{CloseHandle, GetLastError, HANDLE, INVALID_HANDLE_VALUE};
use windows_sys::Win32::Storage::FileSystem::{
    CreateFileW, FILE_FLAG_OVERLAPPED, FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING,
};
use windows_sys::Win32::System::IO::{CancelIoEx, GetOverlappedResult, OVERLAPPED};
use windows_sys::Win32::System::Threading::{CreateEventW, ResetEvent, WaitForSingleObject};

const GENERIC_READ: u32 = 0x8000_0000;
const GENERIC_WRITE: u32 = 0x4000_0000;
const WAIT_OBJECT_0: u32 = 0;
const WAIT_TIMEOUT: u32 = 258;
const ERROR_IO_PENDING: u32 = 997;

#[derive(Clone, Debug)]
pub struct HidDescriptor {
    pub path: String,
    pub vid: u16,
    pub pid: u16,
    pub version: u16,
    pub product: String,
    pub manufacturer: String,
    pub serial: Option<String>,
    pub usage_page: u16,
    pub usage: u16,
    pub input_len: u16,
    pub feature_len: u16,
    pub link_collections: u16,
    pub connection: String,
}

impl HidDescriptor {
    pub fn is_gamepad(&self) -> bool {
        match (self.usage_page, self.usage) {
            (0x01, 0x04) | (0x01, 0x05) | (0x01, 0x08) => true,
            // Vendor defined collections that still expose a gamepad link
            (0x01, 0x06) => false,
            _ => false,
        }
    }
}

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

unsafe fn read_string(
    handle: HANDLE,
    f: unsafe extern "system" fn(HANDLE, *mut c_void, u32) -> u8,
) -> Option<String> {
    let mut buf = [0u16; 256];
    let ok = f(handle, buf.as_mut_ptr() as *mut c_void, 256);
    if ok == 0 {
        return None;
    }
    let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    if len == 0 {
        return None;
    }
    let s = String::from_utf16_lossy(&buf[..len]).trim().to_string();
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}

/// Connection type from the SetupAPI enumerator that owns the interface.
/// Windows reports "USB", "BTHENUM" (classic Bluetooth) or "BTHLEDEVICE".
fn classify_connection(enumerator: &str, path: &str) -> String {
    let enumerator = enumerator.to_uppercase();
    if enumerator == "USB" {
        return "usb".into();
    }
    if enumerator.starts_with("BTH") {
        return "bluetooth".into();
    }
    let upper = path.to_uppercase();
    if upper.contains("BTHENUM") || upper.contains("BTHLE") {
        "bluetooth".into()
    } else if upper.contains("VID_") && upper.contains("IG_") {
        // XInput-compatible HID interface: the wired Xbox path.
        "usb".into()
    } else {
        "unknown".into()
    }
}

unsafe fn detail_path(
    device_info: isize,
    iface: &SP_DEVICE_INTERFACE_DATA,
) -> Option<(String, String)> {
    let mut required: u32 = 0;
    SetupDiGetDeviceInterfaceDetailW(
        device_info,
        iface,
        null_mut(),
        0,
        &mut required,
        null_mut(),
    );
    if required == 0 {
        return None;
    }
    let mut buf = vec![0u8; required as usize];
    let detail = buf.as_mut_ptr() as *mut SP_DEVICE_INTERFACE_DETAIL_DATA_W;
    (*detail).cbSize = std::mem::size_of::<SP_DEVICE_INTERFACE_DETAIL_DATA_W>() as u32;
    let mut devinfo: SP_DEVINFO_DATA = std::mem::zeroed();
    devinfo.cbSize = std::mem::size_of::<SP_DEVINFO_DATA>() as u32;
    let ok = SetupDiGetDeviceInterfaceDetailW(device_info, iface, detail, required, null_mut(), &mut devinfo);
    if ok == 0 {
        return None;
    }
    let path_ptr = (*detail).DevicePath.as_ptr();
    let mut len = 0usize;
    while *path_ptr.add(len) != 0 && len < 1024 {
        len += 1;
    }
    let path = String::from_utf16_lossy(std::slice::from_raw_parts(path_ptr, len));

    // Which bus enumerator owns this interface (USB, BTHLEDEVICE, ...).
    let mut buffer = [0u16; 256];
    let mut size: u32 = 0;
    let mut kind: u32 = 0;
    let enumerator_ok = SetupDiGetDeviceRegistryPropertyW(
        device_info,
        &devinfo,
        SPDRP_ENUMERATOR_NAME,
        &mut kind,
        buffer.as_mut_ptr() as *mut u8,
        (buffer.len() * 2) as u32,
        &mut size,
    ) != 0;
    let enumerator = if enumerator_ok {
        let end = buffer.iter().position(|&c| c == 0).unwrap_or(buffer.len());
        String::from_utf16_lossy(&buffer[..end])
    } else {
        String::new()
    };

    Some((path, enumerator))
}

/// Enumerate every present HID interface with descriptive facts.
pub fn enumerate() -> Vec<HidDescriptor> {
    let mut out = Vec::new();
    unsafe {
        let mut guid = std::mem::zeroed();
        HidD_GetHidGuid(&mut guid);
        let devs = SetupDiGetClassDevsW(&guid, std::ptr::null(), null_mut(), DIGCF_PRESENT | DIGCF_DEVICEINTERFACE);
        if devs == -1 || devs == 0 {
            return out;
        }

        let mut index: u32 = 0;
        loop {
            let mut iface: SP_DEVICE_INTERFACE_DATA = std::mem::zeroed();
            iface.cbSize = std::mem::size_of::<SP_DEVICE_INTERFACE_DATA>() as u32;
            if SetupDiEnumDeviceInterfaces(devs, null_mut(), &guid, index, &mut iface) == 0 {
                break;
            }
            index += 1;

            let Some((path, enumerator)) = detail_path(devs, &iface) else {
                continue;
            };
            if let Some(desc) = describe_path(&path, &enumerator) {
                if !out.iter().any(|d: &HidDescriptor| d.path == desc.path) {
                    out.push(desc);
                }
            }
        }
        SetupDiDestroyDeviceInfoList(devs);
    }
    out
}

unsafe fn describe_path(path: &str, enumerator: &str) -> Option<HidDescriptor> {
    let wpath = wide(path);
    let handle = CreateFileW(
        wpath.as_ptr(),
        GENERIC_READ | GENERIC_WRITE,
        FILE_SHARE_READ | FILE_SHARE_WRITE,
        null_mut(),
        OPEN_EXISTING,
        0,
        null_mut(),
    );
    if handle == INVALID_HANDLE_VALUE {
        return None;
    }

    let mut attrs: HIDD_ATTRIBUTES = std::mem::zeroed();
    attrs.Size = std::mem::size_of::<HIDD_ATTRIBUTES>() as u32;
    if HidD_GetAttributes(handle, &mut attrs) == 0 {
        CloseHandle(handle);
        return None;
    }

    let mut prepared: PHIDP_PREPARSED_DATA = std::mem::zeroed();
    let mut caps: HIDP_CAPS = std::mem::zeroed();
    let have_caps = HidD_GetPreparsedData(handle, &mut prepared) != 0
        && HidP_GetCaps(prepared, &mut caps) >= 0;
    if have_caps {
        HidD_FreePreparsedData(prepared);
    }

    let desc = HidDescriptor {
        path: path.to_string(),
        vid: attrs.VendorID,
        pid: attrs.ProductID,
        version: attrs.VersionNumber,
        product: read_string(handle, HidD_GetProductString).unwrap_or_default(),
        manufacturer: read_string(handle, HidD_GetManufacturerString).unwrap_or_default(),
        serial: read_string(handle, HidD_GetSerialNumberString),
        usage_page: if have_caps { caps.UsagePage } else { 0 },
        usage: if have_caps { caps.Usage } else { 0 },
        input_len: if have_caps { caps.InputReportByteLength } else { 0 },
        feature_len: if have_caps { caps.FeatureReportByteLength } else { 0 },
        link_collections: if have_caps {
            caps.NumberLinkCollectionNodes
        } else {
            0
        },
        connection: classify_connection(enumerator, path),
    };

    CloseHandle(handle);
    Some(desc)
}

/// An open HID device ready for overlapped reads.
pub struct HidReader {
    handle: HANDLE,
    event: HANDLE,
    pub input_len: u16,
    pub prepared: PHIDP_PREPARSED_DATA,
    pub caps: HIDP_CAPS,
    buffer: Vec<u8>,
    overlapped: Box<OVERLAPPED>,
    pub failed: bool,
}

unsafe impl Send for HidReader {}

impl HidReader {
    pub fn open(desc: &HidDescriptor) -> Option<Self> {
        unsafe {
            let wpath = wide(&desc.path);
            let handle = CreateFileW(
                wpath.as_ptr(),
                GENERIC_READ | GENERIC_WRITE,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                null_mut(),
                OPEN_EXISTING,
                FILE_FLAG_OVERLAPPED,
                null_mut(),
            );
            if handle == INVALID_HANDLE_VALUE {
                return None;
            }
            let mut prepared: PHIDP_PREPARSED_DATA = std::mem::zeroed();
            let mut caps: HIDP_CAPS = std::mem::zeroed();
            if HidD_GetPreparsedData(handle, &mut prepared) == 0 {
                CloseHandle(handle);
                return None;
            }
            if HidP_GetCaps(prepared, &mut caps) < 0 {
                HidD_FreePreparsedData(prepared);
                CloseHandle(handle);
                return None;
            }
            let event = CreateEventW(null_mut(), 1, 0, std::ptr::null());
            if event.is_null() {
                HidD_FreePreparsedData(prepared);
                CloseHandle(handle);
                return None;
            }
            let mut overlapped: Box<OVERLAPPED> = Box::new(std::mem::zeroed());
            overlapped.hEvent = event;
            let len = caps.InputReportByteLength.max(64) as usize;
            Some(Self {
                handle,
                event,
                input_len: caps.InputReportByteLength,
                prepared,
                caps,
                buffer: vec![0u8; len],
                overlapped,
                failed: false,
            })
        }
    }

    /// Blocking-ish read with a timeout so the poll loop can stop cleanly.
    pub fn read(&mut self, timeout_ms: u32) -> Option<Vec<u8>> {
        unsafe {
            ResetEvent(self.event);
            let event = self.event;
            *self.overlapped = std::mem::zeroed();
            self.overlapped.hEvent = event;
            let mut read: u32 = 0;
            let ok = windows_sys::Win32::Storage::FileSystem::ReadFile(
                self.handle,
                self.buffer.as_mut_ptr(),
                self.buffer.len() as u32,
                &mut read,
                &mut *self.overlapped,
            );
            if ok != 0 {
                return Some(self.buffer[..read as usize].to_vec());
            }
            if GetLastError() != ERROR_IO_PENDING {
                self.failed = true;
                return None;
            }
            let wait = WaitForSingleObject(self.event, timeout_ms);
            if wait == WAIT_TIMEOUT {
                CancelIoEx(self.handle, &*self.overlapped);
                WaitForSingleObject(self.event, 50);
                return None;
            }
            if wait != WAIT_OBJECT_0 {
                self.failed = true;
                return None;
            }
            let mut got: u32 = 0;
            if GetOverlappedResult(self.handle, &*self.overlapped, &mut got, 0) == 0 {
                self.failed = true;
                return None;
            }
            Some(self.buffer[..got as usize].to_vec())
        }
    }
}

impl Drop for HidReader {
    fn drop(&mut self) {
        unsafe {
            CancelIoEx(self.handle, &*self.overlapped);
            CloseHandle(self.event);
            CloseHandle(self.handle);
            HidD_FreePreparsedData(self.prepared);
        }
    }
}
