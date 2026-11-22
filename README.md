# Driftbusters

Controller diagnostics for Windows 10 and 11. Tests, diagnoses and records the condition of
PlayStation and Xbox gamepads, entirely offline.

## Download

Windows 10/11 · 64-bit · **[Download the latest build](https://github.com/nk12Kumar/driftbusters/releases/latest)**

* **Installer** (`Driftbusters_1.0.0_x64-setup.exe`) — per-user install, no admin rights, adds Start-menu entry.
* **Portable** (`Driftbusters-Portable-1.0.0.exe`) — one file, no install. Reports and settings are kept in a
  `DriftbustersData` folder created beside the executable, so a copied folder carries everything with it.


Built with **Tauri 2 + React 19 + TypeScript**, with a native **Rust** hardware layer that reads
controllers through **XInput** (Xbox pads) and **Windows HID** (PlayStation and generic pads).

## What it does

| Screen | Purpose |
| --- | --- |
| Dashboard | Connected pads, live illustration, battery, health summary, recent reports |
| Controller Tester | Every button highlights on a custom SVG pad, with raw values and a remap tool |
| Stick Drift | Live XY graphs, automated 10-second hold test, offset/deviation/deadzone measurements |
| Trigger Tester | Analogue range, return-to-zero, smoothness and stuck-trigger detection |
| Button Diagnostics | Guided sweep with pass/warn/fail per button and response timing |
| Advanced Monitor | Button indices, raw axes, event log, hex report |
| Comparison | Two pads measured with the same code path, side by side |
| Test History | Saved reports with health trend, PDF and CSV export |
| Settings | Noise/drift thresholds, test length, raw data default, remapping |

## How detection works

* **Xbox pads** are read through `XInputGetStateEx` (ordinal 100) so the Guide button is included.
  Battery comes from `XInputGetBatteryInformation`; vendor/product IDs come from
  `XInputGetCapabilities`, so identification never relies on the device name.
* **PlayStation pads** (DualShock 4, DualSense, DualSense Edge) are read through Windows HID with
  their documented report layouts for both USB and Bluetooth report IDs.
* **Generic HID gamepads** are decoded through the HID usage tables (`HidP_GetUsages`,
  `HidP_GetUsageValue`), with ranges learned from the device itself.
* Hot-plugging is handled by re-enumerating HID interfaces and XInput slots every 700 ms; a pad that
  vanishes has its reader thread stopped and its state removed.

## Architecture

```
src-tauri/src/
  manager.rs   device registry, polling loop, snapshot events (60 Hz)
  xinput.rs    XInput loading, capabilities, battery, Guide button
  hid.rs       SetupAPI enumeration + overlapped HID reads
  parsers.rs   DualShock 4 / DualSense / generic HID report parsers
  store.rs     report history (JSON, atomic writes) and commands
  model.rs     shared data model
src/
  lib/live.ts      snapshot store bridging Tauri events into React
  lib/analysis.ts  drift, trigger and health maths
  lib/report.ts    PDF (jsPDF) and CSV export
  components/      controller SVG art, stick graph, canvas traces
  screens/         the nine screens
```

## Development

```bash
npm install
npm run tauri dev      # run the desktop app
npm run build          # type-check + bundle the frontend
npm run tauri build    # produce the Windows installer
```

The installer is written to `src-tauri/target/release/bundle/nsis/`.

For UI work without hardware, the Vite dev server accepts `?mock=1`, which feeds a clearly labelled
simulated pad. It is compiled out of release builds.

## Data

Reports are stored at `%APPDATA%\com.driftbusters.app\history.json`. Nothing is uploaded and no
account is required.

## Known limits

* The Guide button depends on the undocumented `XInputGetStateEx` entry point; older drivers may not
  expose it.
* Windows does not report Bluetooth vs USB for every HID device, so the connection field can read
  “unknown” rather than a guess.
* Battery is shown only when the device reports it.
* Touchpad surfaces, motion sensors and DualSense adaptive-trigger effects are not read.
