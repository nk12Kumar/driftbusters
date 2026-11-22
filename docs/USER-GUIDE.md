# Driftbusters — quick guide

A plain-language walkthrough for anyone using the app for the first time.

## 1. Connect a controller

* **Xbox pad:** plug it in with a USB cable, or press the Xbox button and pair it in
  Windows Settings → Bluetooth & devices. The button should glow steady.
* **PlayStation pad:** connect with USB, or hold **PS + Share** until the light bar flashes, then pair
  in Windows Bluetooth settings.

The Dashboard updates by itself — you do not need to restart the app. If nothing appears, open
**Advanced Monitor**: if it is also empty, Windows has not connected the pad.

## 2. Start a full diagnostic

Click **Start full diagnostic** in the top-right (or on the Dashboard). The guided sweep asks for one
button at a time; press and release each one. When it finishes, it saves a report that also includes
any stick and trigger measurements you have taken.

Order that gives the most useful report:

1. **Stick Drift** — put the pad down, click *Start 10s test*, wait without touching it.
2. **Trigger Tester** — click *Start recording*, press each trigger slowly to the stop and release.
3. **Button Diagnostics** — run the sweep, then *Save report*.

## 3. Understand the numbers

| Reading | What it means |
| --- | --- |
| Offset % | How far a stick sits from its true centre when untouched, as a percentage of full travel |
| Max deviation % | The furthest any single sample wandered during the test |
| Deadzone needed % | How large a deadzone would be needed to hide the resting movement |
| Noise floor | Jitter below this is treated as normal sensor noise, not drift |
| Smoothness | How evenly a trigger sweeps; large jumps lower the score |

Default thresholds: **2%** noise, **4%** drift. A stick that rests under 2% is healthy; over 4% is
drifting and a game's deadzone may no longer cover it. Both thresholds are adjustable in Settings.

## 4. Reports

Reports are saved on the PC only (no account, no internet). Open **Test History** to:

* compare scores over time for the same pad,
* export a **PDF** for a repair shop or a buyer,
* export **CSV** for a spreadsheet,
* delete old reports.

## 5. If a pad's buttons look wrong

On the **Controller Tester**, the *Identify & remap* panel shows the raw index each button sends.
Press a button, then assign it to the right label. Your mapping is remembered per controller.

## 6. Honest limits

* Xbox pads are read through XInput, which exposes buttons, sticks and triggers — not the raw HID
  bytes, and not Bluetooth-vs-USB for every model.
* The Guide button uses an undocumented XInput entry point; a few old driver versions do not expose it.
* Battery is shown only when the device reports it.
* Touchpads, motion sensors and DualSense adaptive-trigger effects are not measured.
