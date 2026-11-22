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
    gamepad_lab_lib::run()
}
