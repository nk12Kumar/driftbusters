import { health, type HealthSummary } from "./analysis";
import type { DeviceInfo } from "./types";
import type { SessionData } from "./session";
import { buildReport, type DiagnosticReport } from "./report";
import { getSettings } from "./settings";
import { saveReport } from "./history";

/** Returns null when nothing has been measured, so no score is invented. */
export function healthFor(device: DeviceInfo | null, data: SessionData): HealthSummary | null {
  const measured = Boolean(data.drift || data.triggers || data.buttons.length);
  if (!measured) return null;
  return health({
    drift: data.drift ?? undefined,
    triggers: data.triggers ?? undefined,
    buttons: data.buttons.length ? data.buttons : undefined,
    batteryLevel: device?.battery?.level ?? null,
  });
}

export function healthForReport(device: DeviceInfo | null, data: SessionData): HealthSummary {
  return healthFor(device, data) ?? {
    score: 0,
    grade: "Poor" as const,
    issues: ["No measurements were recorded for this report."],
    summary: "No tests were completed, so no health score could be calculated.",
  };
}

export function currentReport(
  device: DeviceInfo,
  data: SessionData,
  notes?: string
): DiagnosticReport {
  const settings = getSettings();
  const summary = healthForReport(device, data);
  return buildReport({
    device,
    health: summary,
    buttons: data.buttons,
    drift: data.drift,
    triggers: data.triggers,
    settings: {
      noiseThreshold: settings.noiseThreshold,
      driftThreshold: settings.driftThreshold,
      deadzone: settings.deadzone,
    },
    notes: notes ?? data.notes,
  });
}

export async function saveCurrentReport(
  device: DeviceInfo,
  data: SessionData,
  notes?: string
): Promise<string> {
  const report = currentReport(device, data, notes);
  return saveReport(report);
}
