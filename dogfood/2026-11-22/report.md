# Dogfood report — Driftbusters (Gamepad Lab)

Date: 2026-11-22
Build: Vite dev preview `?mock=xbox` (simulated Xbox pad) + packaged exe check
Viewport: 1440×900, 1100×720
Tester: Hermes agent (no physical controller attached)

## Scope

All nine screens were walked, with console-error capture installed before navigation:

Dashboard · Controller Tester · Stick Drift · Trigger Tester · Button Diagnostics ·
Advanced Monitor · Controller Comparison · Test History · Settings

Interactions exercised: bottom-dock navigation, hotspot selection, photo calibration capture,
settings toggle + persistence, 10-second drift test (full run), narrow-window layout.

## Findings

| # | Severity | Category | Issue | Status |
|---|----------|----------|-------|--------|
| 1 | High | UX | With no controller attached, every screen was replaced by a generic "connect a controller" card, hiding the dashboard, the dock and the product photo | **Fixed** — dashboard always renders, dimmed, with a prompt |
| 2 | High | Functional | The 10 s drift test could show 0 samples / 0.0 s with no explanation and never finish | **Fixed** — progress from the first sample, stall note, redraws cut to a quarter |
| 3 | Low | Console | `list_reports failed … reading 'invoke'` in the browser preview (no Tauri IPC) | Accepted — expected outside the desktop shell; history renders its empty state |
| 4 | Low | Functional | When the window is hidden/backgrounded, timer throttling drops sampling to ~1/s and the test is discarded | Open — needs a `performance.now()` deadline or an explicit "keep this window visible" hint |
| 5 | Info | UX | Comparison needs two pads | Correct — clear empty state explaining it |

No layout overflow at either viewport (dashboard `hScroll = 0`, comparison `hScroll = 0`,
dock stays one row). No uncaught errors on any page.

## Evidence

- `screenshots/p1-dashboard.png` … `p9-settings.png` — one full-window capture per screen
- `screenshots/narrow-1100x720.png` — 1100×720, dock intact, no horizontal scroll
- `screenshots/01-dashboard-mock.png` — first pass, empty state before the fix

## Drift test verification

| Run | Samples / 10 s | Outcome |
|-----|----------------|---------|
| First (harness backgrounded) | 10 | Rejected: "Too few samples" — traced to browser timer throttling, not the app |
| After `Page.bringToFront` | 255 | Complete run; correctly discarded because the simulated sticks moved |

Sampling rate matches the 30 Hz mock emitter, so the sampler is healthy.

## Not tested

- Physical pad (XInput/HID) — nothing was connected during the pass
- Two-pad comparison with real hardware
- PDF/CSV export dialogs (native file dialog, cannot run in the browser preview)
- Installer upgrade path over an existing install
