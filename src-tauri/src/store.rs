//! Local test-history storage. Reports are kept as JSON in the app data
//! directory; writes are atomic (write to a temp file, then rename).

use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn history_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data directory: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("cannot create {dir:?}: {e}"))?;
    Ok(dir.join("history.json"))
}

pub fn load(app: &AppHandle) -> Vec<Value> {
    let Ok(path) = history_file(app) else {
        return Vec::new();
    };
    let Ok(text) = fs::read_to_string(&path) else {
        return Vec::new();
    };
    serde_json::from_str::<Vec<Value>>(&text).unwrap_or_default()
}

fn save_all(app: &AppHandle, entries: &[Value]) -> Result<(), String> {
    let path = history_file(app)?;
    let text = serde_json::to_string_pretty(entries).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, text).map_err(|e| format!("cannot write history: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("cannot replace history: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn list_reports(app: AppHandle) -> Vec<Value> {
    load(&app)
}

#[tauri::command]
pub fn save_report(app: AppHandle, report: Value) -> Result<Value, String> {
    let mut entries = load(&app);
    let id = report
        .get("id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("report-{}", crate::model::now_ms()));
    let mut stored = report.clone();
    if let Some(obj) = stored.as_object_mut() {
        obj.insert("id".into(), Value::String(id.clone()));
    }
    entries.retain(|e| e.get("id").and_then(|v| v.as_str()) != Some(id.as_str()));
    entries.insert(0, stored);
    entries.truncate(200);
    save_all(&app, &entries)?;
    Ok(Value::String(id))
}

#[tauri::command]
pub fn delete_report(app: AppHandle, id: String) -> Result<(), String> {
    let mut entries = load(&app);
    entries.retain(|e| e.get("id").and_then(|v| v.as_str()) != Some(id.as_str()));
    save_all(&app, &entries)
}

#[tauri::command]
pub fn clear_reports(app: AppHandle) -> Result<(), String> {
    save_all(&app, &[])
}

/// Writes exported files (PDF/CSV) to a path the user picked in the save dialog.
/// Done in Rust so no filesystem scope can block a legitimate export.
#[tauri::command]
pub fn save_bytes(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let target = std::path::PathBuf::from(&path);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("cannot create folder: {e}"))?;
    }
    fs::write(&target, bytes).map_err(|e| format!("cannot write {path}: {e}"))
}

#[tauri::command]
pub fn app_info() -> Value {
    serde_json::json!({
        "name": "Gamepad Lab",
        "version": env!("CARGO_PKG_VERSION"),
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "inputApis": ["XInput 1.4", "Windows HID"],
    })
}
