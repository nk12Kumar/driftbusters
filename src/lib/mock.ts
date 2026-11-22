import type { InputState, Snapshot } from "./types";

/**
 * Development-only preview data so the interface can be reviewed without a
 * physical controller. It is never bundled into a release build and is always
 * labelled as simulated in the UI.
 */
export function startMock(emit: (snapshot: Snapshot) => void) {
  const wantXbox = new URLSearchParams(window.location.search).get("mock") === "xbox";
  const started = Date.now();
  const buttons: Record<string, boolean> = {};
  const pressedLog: string[] = [];

  const state = (): InputState => {
    const t = (Date.now() - started) / 1000;
    const lx = Math.sin(t * 0.7) * 0.12 + 0.02;
    const ly = Math.cos(t * 0.53) * 0.08 - 0.01;
    const rx = Math.sin(t * 0.31 + 1) * 0.55;
    const ry = Math.cos(t * 0.44) * 0.42;
    const lt = Math.max(0, Math.sin(t * 0.6));
    const rt = Math.max(0, Math.sin(t * 0.4 + 2));

    const cycle = Math.floor(t * 1.4) % 12;
    const names = ["faceSouth", "faceEast", "faceWest", "faceNorth", "l1", "r1", "dpUp", "dpRight", "menu", "view", "l3", "r3"];
    const active = names[cycle];
    Object.keys(buttons).forEach((k) => {
      buttons[k] = false;
    });
    buttons[active] = true;
    buttons.l2 = lt > 0.4;
    buttons.r2 = rt > 0.4;
    buttons.guide = cycle === 11;
    if (pressedLog[pressedLog.length - 1] !== active) pressedLog.push(active);

    return {
      id: "mock:1",
      timestampMs: Date.now(),
      packet: Math.floor(t * 60),
      axes: { lx, ly, rx, ry, lt, rt },
      buttons: { ...buttons },
      raw: {
        reportId: 0x01,
        report: Array.from({ length: 64 }, (_, i) => (i * 7 + cycle * 13) % 256),
        axes: [
          Math.round((lx + 1) * 127.5),
          Math.round((ly + 1) * 127.5),
          Math.round((rx + 1) * 127.5),
          Math.round((ry + 1) * 127.5),
          Math.round(lt * 255),
          Math.round(rt * 255),
        ],
        buttons: [cycle % 18],
        power: 0x28,
      },
      batteryLevel: 78,
      charging: false,
      powered: false,
      live: true,
    };
  };

  window.setInterval(() => {
    emit({
      devices: [
        {
          id: "mock:1",
          name: wantXbox ? "Xbox controller (simulated preview)" : "DualSense (simulated preview)",
          manufacturer: wantXbox ? "Microsoft" : "Sony Interactive Entertainment",
          model: wantXbox ? "Xbox One" : "DualSense",
          family: wantXbox ? "xboxone" : "dualsense",
          connection: "usb",
          vid: wantXbox ? 0x045e : 0x054c,
          pid: wantXbox ? 0x02ff : 0x0ce6,
          serial: "PREVIEW-ONLY",
          backend: "hid",
          xinputIndex: null,
          path: "preview://dualsense",
          usagePage: 1,
          usage: 5,
          inputReportLength: wantXbox ? 16 : 64,
          battery: { level: 78, charging: false, status: "Discharging" },
          identities: ["preview data", "VID_054C&PID_0CE6"],
          hasTouchpad: true,
          hasMotion: true,
        },
      ],
      states: [state()],
      timestampMs: Date.now(),
      revision: 1,
    });
  }, 33);
}
