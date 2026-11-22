// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let mut args = std::env::args().skip(1);
    if let Some(first) = args.next() {
        if first == "--watch" {
            let seconds = args.next().and_then(|v| v.parse().ok()).unwrap_or(20);
            gamepad_lab_lib::watch(seconds);
            return;
        }
        if first == "--where" {
            gamepad_lab_lib::where_data();
            return;
        }
        if first == "--xinput" {
            gamepad_lab_lib::xinput_probe();
            return;
        }
        if first == "--dump-hid" {
            gamepad_lab_lib::dump_hid();
            return;
        }
        if first == "--probe" {
            let seconds = args.next().and_then(|v| v.parse().ok()).unwrap_or(4);
            gamepad_lab_lib::probe(seconds);
            return;
        }
    }
    // Portable builds keep the webview profile (settings, window state) beside
    // the executable as well, so the whole folder can be moved or copied.
    if let Some(root) = gamepad_lab_lib::portable_root() {
        std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", root.join("webview"));
    }

    gamepad_lab_lib::run()
}
