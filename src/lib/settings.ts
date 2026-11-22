import { useSyncExternalStore } from "react";

export interface Settings {
  /** Percentage of full stick travel treated as sensor noise. */
  noiseThreshold: number;
  /** Percentage of full travel above which a stick is considered drifting. */
  driftThreshold: number;
  /** Default deadzone percentage shown in the tester. */
  deadzone: number;
  /** Seconds for the automated drift test. */
  sampleSeconds: number;
  /** Show the raw report by default in the advanced monitor. */
  showRaw: boolean;
  /** Which controller family art to use for unknown pads. */
  genericArt: "playstation" | "xbox";
  /** deviceId -> raw button index -> canonical button name */
  remaps: Record<string, Record<string, string>>;
}

const KEY = "driftbusters.settings.v1";

const DEFAULTS: Settings = {
  noiseThreshold: 2,
  driftThreshold: 4,
  deadzone: 5,
  sampleSeconds: 10,
  showRaw: true,
  genericArt: "xbox",
  remaps: {},
};

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed, remaps: parsed.remaps ?? {} };
  } catch {
    return { ...DEFAULTS };
  }
}

let current = read();
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  localStorage.setItem(KEY, JSON.stringify(current));
  listeners.forEach((l) => l());
}

export function resetSettings() {
  current = { ...DEFAULTS, remaps: {} };
  localStorage.setItem(KEY, JSON.stringify(current));
  listeners.forEach((l) => l());
}

export function setRemap(deviceId: string, rawIndex: number, logical: string | null) {
  const remaps = { ...current.remaps };
  const device = { ...(remaps[deviceId] ?? {}) };
  if (logical) device[String(rawIndex)] = logical;
  else delete device[String(rawIndex)];
  if (Object.keys(device).length) remaps[deviceId] = device;
  else delete remaps[deviceId];
  updateSettings({ remaps });
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => DEFAULTS
  );
}
