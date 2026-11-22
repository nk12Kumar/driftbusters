import { useSyncExternalStore } from "react";
import type { ButtonTestResult, DriftStats, TriggerStats } from "./analysis";

export interface SessionData {
  deviceId: string | null;
  drift: { left: DriftStats; right: DriftStats } | null;
  triggers: { lt: TriggerStats; rt: TriggerStats } | null;
  buttons: ButtonTestResult[];
  notes: string;
  updatedAt: number;
}

const EMPTY: SessionData = {
  deviceId: null,
  drift: null,
  triggers: null,
  buttons: [],
  notes: "",
  updatedAt: 0,
};

let current: SessionData = { ...EMPTY };
const listeners = new Set<() => void>();

function emit() {
  current = { ...current, updatedAt: Date.now() };
  listeners.forEach((l) => l());
}

export const session = {
  get: () => current,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  setDevice(deviceId: string | null) {
    if (current.deviceId === deviceId) return;
    current = { ...EMPTY, deviceId };
    emit();
  },
  setDrift(drift: { left: DriftStats; right: DriftStats }) {
    current = { ...current, drift };
    emit();
  },
  setTriggers(triggers: { lt: TriggerStats; rt: TriggerStats }) {
    current = { ...current, triggers };
    emit();
  },
  setButtons(buttons: ButtonTestResult[]) {
    current = { ...current, buttons };
    emit();
  },
  setNotes(notes: string) {
    current = { ...current, notes };
    emit();
  },
  reset() {
    current = { ...EMPTY, deviceId: current.deviceId };
    emit();
  },
};

export function useSession(): SessionData {
  return useSyncExternalStore(session.subscribe, session.get, () => EMPTY);
}
