import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useSyncExternalStore } from "react";
import type { DeviceInfo, InputState, Snapshot } from "./types";
import { getSettings } from "./settings";

const EMPTY: Snapshot = { devices: [], states: [], timestampMs: 0, revision: 0 };

class LiveStore {
  private snap: Snapshot = EMPTY;
  private listeners = new Set<() => void>();
  private started = false;
  private lastEmit = 0;
  private timer: number | null = null;

  start() {
    if (this.started) return;
    this.started = true;
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("mock")) {
      void import("./mock").then((m) => m.startMock((snapshot) => this.apply(snapshot)));
      return;
    }
    void invoke<Snapshot>("get_snapshot")
      .then((s) => this.apply(s))
      .catch(() => undefined);
    void listen<Snapshot>("gp://snapshot", (event) => this.apply(event.payload));
  }

  private apply(next: Snapshot) {
    this.snap = next;
    if (this.timer !== null) return;
    const wait = Math.max(0, 33 - (performance.now() - this.lastEmit));
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.lastEmit = performance.now();
      this.listeners.forEach((l) => l());
    }, wait);
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): Snapshot => this.snap;

  get = () => this.snap;

  device(id: string | null): DeviceInfo | null {
    if (!id) return null;
    return this.snap.devices.find((d) => d.id === id) ?? null;
  }

  state(id: string | null): InputState | null {
    if (!id) return null;
    return this.snap.states.find((s) => s.id === id) ?? null;
  }
}

export const live = new LiveStore();
live.start();

export function useSnapshot(): Snapshot {
  return useSyncExternalStore(live.subscribe, live.getSnapshot, () => EMPTY);
}

/** Button state with user remapping applied (used for unusual HID pads). */
export function effectiveButtons(
  state: InputState | null,
  device: DeviceInfo | null
): Record<string, boolean> {
  if (!state) return {};
  const buttons = { ...state.buttons };
  if (!device) return buttons;
  const remaps = getSettings().remaps[device.id];
  if (!remaps) return buttons;
  for (const [rawIndex, logical] of Object.entries(remaps)) {
    if (state.raw.buttons.includes(Number(rawIndex))) buttons[logical] = true;
  }
  return buttons;
}

export function pressedList(buttons: Record<string, boolean>): string[] {
  return Object.entries(buttons)
    .filter(([, v]) => v)
    .map(([k]) => k);
}
