import { jsPDF } from "jspdf";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { ButtonTestResult, DriftStats, HealthSummary, TriggerStats } from "./analysis";
import { shortDate } from "./format";
import type { DeviceInfo } from "./types";
import { connectionLabel, familyLabel } from "./types";

export interface ReportDevice {
  id: string;
  name: string;
  model: string;
  manufacturer: string;
  family: string;
  familyLabel: string;
  connection: string;
  connectionLabel: string;
  vid: string;
  pid: string;
  serial: string | null;
  backend: string;
  batteryLevel: number | null;
  batteryStatus: string | null;
}

export interface DiagnosticReport {
  id: string;
  createdAt: string;
  app: string;
  version: string;
  device: ReportDevice;
  health: HealthSummary;
  buttons: ButtonTestResult[];
  drift: { left: DriftStats; right: DriftStats } | null;
  triggers: { lt: TriggerStats; rt: TriggerStats } | null;
  settings: { noiseThreshold: number; driftThreshold: number; deadzone: number };
  notes: string;
}

export function reportDevice(device: DeviceInfo): ReportDevice {
  return {
    id: device.id,
    name: device.name,
    model: device.model,
    manufacturer: device.manufacturer,
    family: device.family,
    familyLabel: familyLabel(device.family),
    connection: device.connection,
    connectionLabel: connectionLabel(device.connection),
    vid: device.vid.toString(16).toUpperCase().padStart(4, "0"),
    pid: device.pid.toString(16).toUpperCase().padStart(4, "0"),
    serial: device.serial,
    backend: device.backend === "xinput" ? "XInput" : "Windows HID",
    batteryLevel: device.battery?.level ?? null,
    batteryStatus: device.battery?.status ?? null,
  };
}

export function buildReport(input: {
  device: DeviceInfo;
  health: HealthSummary;
  buttons: ButtonTestResult[];
  drift?: { left: DriftStats; right: DriftStats } | null;
  triggers?: { lt: TriggerStats; rt: TriggerStats } | null;
  settings: { noiseThreshold: number; driftThreshold: number; deadzone: number };
  notes?: string;
}): DiagnosticReport {
  return {
    id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    app: "Driftbusters",
    version: "1.0.0",
    device: reportDevice(input.device),
    health: input.health,
    buttons: input.buttons,
    drift: input.drift ?? null,
    triggers: input.triggers ?? null,
    settings: input.settings,
    notes: input.notes ?? "",
  };
}

function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function reportToCsv(report: DiagnosticReport): string {
  const rows: string[][] = [];
  const push = (...cells: unknown[]) => rows.push(cells.map(csvEscape));

  push("Driftbusters controller health report");
  push("Generated", shortDate(report.createdAt));
  push("Report id", report.id);
  push("");
  push("IDENTIFICATION");
  push("Name", report.device.name);
  push("Model", report.device.model);
  push("Manufacturer", report.device.manufacturer);
  push("Family", report.device.familyLabel);
  push("Connection", report.device.connectionLabel);
  push("USB VID", report.device.vid);
  push("USB PID", report.device.pid);
  push("Serial", report.device.serial ?? "not exposed");
  push("Input API", report.device.backend);
  push("Battery", report.device.batteryLevel === null ? "not reported" : `${report.device.batteryLevel}%`);
  push("");
  push("HEALTH");
  push("Score", report.health.score);
  push("Grade", report.health.grade);
  push("Summary", report.health.summary);
  report.health.issues.forEach((issue, i) => push(`Issue ${i + 1}`, issue));
  push("");

  if (report.buttons.length) {
    push("BUTTON TESTS");
    push("Button", "Status", "Presses", "Release seen", "Response ms");
    for (const b of report.buttons) {
      push(b.label, b.status, b.presses, b.released ? "yes" : "no", b.responseMs ?? "");
    }
    push("");
  }

  if (report.drift) {
    push("STICK DRIFT");
    push("Stick", "Offset %", "Max dev %", "Avg dev %", "Deadzone needed %", "Verdict");
    for (const [name, s] of [
      ["Left", report.drift.left],
      ["Right", report.drift.right],
    ] as const) {
      push(name, s.magnitude.toFixed(2), s.maxDeviation.toFixed(2), s.avgDeviation.toFixed(2), s.deadzoneNeeded.toFixed(2), s.verdict);
    }
    push("");
  }

  if (report.triggers) {
    push("TRIGGERS");
    push("Trigger", "Min %", "Max %", "Final %", "Smoothness", "Range ok");
    for (const [name, s] of [
      ["Left trigger", report.triggers.lt],
      ["Right trigger", report.triggers.rt],
    ] as const) {
      push(name, (s.min * 100).toFixed(0), (s.max * 100).toFixed(0), (s.finalValue * 100).toFixed(0), s.smoothness, s.rangeOk ? "yes" : "no");
    }
    push("");
  }

  push("SETTINGS");
  push("Noise threshold %", report.settings.noiseThreshold);
  push("Drift threshold %", report.settings.driftThreshold);
  push("Deadzone %", report.settings.deadzone);
  if (report.notes) {
    push("");
    push("NOTES");
    push(report.notes);
  }
  return rows.map((r) => r.join(",")).join("\r\n");
}

export function pdfBytes(report: DiagnosticReport): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const width = 210;
  const margin = 16;
  const right = width - margin;
  let y = 0;

  const ink = [231, 238, 248] as const;
  const muted = [138, 152, 173] as const;
  const accent = [59, 232, 176] as const;

  // Header band
  doc.setFillColor(11, 14, 20);
  doc.rect(0, 0, width, 46, "F");
  doc.setTextColor(...accent);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("DRIFTBUSTERS", margin, 20);
  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Controller health report", margin, 27);
  doc.setTextColor(...ink);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(report.device.name, margin, 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text(shortDate(report.createdAt), right, 20, { align: "right" });
  doc.text(`Report ${report.id}`, right, 26, { align: "right" });

  y = 56;

  const sectionTitle = (title: string) => {
    if (y > 238) {
      doc.addPage();
      y = 22;
    }
    doc.setTextColor(...accent);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title.toUpperCase(), margin, y);
    y += 2;
    doc.setDrawColor(35, 44, 60);
    doc.line(margin, y, right, y);
    y += 7;
    doc.setTextColor(30, 36, 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
  };

  const row = (label: string, value: string) => {
    if (y > 275) {
      doc.addPage();
      y = 22;
    }
    doc.setTextColor(110, 122, 140);
    doc.text(label, margin, y);
    doc.setTextColor(25, 30, 40);
    doc.text(value, margin + 62, y);
    y += 5.6;
  };

  const score = report.health.score;
  doc.setFillColor(score >= 85 ? 232 : score >= 65 ? 255 : 255, score >= 85 ? 250 : score >= 65 ? 244 : 235, score >= 85 ? 240 : score >= 65 ? 224 : 232);
  doc.roundedRect(margin, y - 4, right - margin, 20, 3, 3, "F");
  doc.setTextColor(25, 30, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`${score}/100  ${report.health.grade}`, margin + 5, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const summaryLines = doc.splitTextToSize(report.health.summary, right - margin - 70);
  doc.text(summaryLines.slice(0, 3), margin + 62, y + 3);
  y += 26;

  sectionTitle("Identification");
  row("Model", report.device.model);
  row("Manufacturer", report.device.manufacturer);
  row("Family", report.device.familyLabel);
  row("Connection", report.device.connectionLabel);
  row("USB IDs", `VID ${report.device.vid} / PID ${report.device.pid}`);
  row("Serial", report.device.serial ?? "not exposed by device");
  row("Input API", report.device.backend);
  row("Battery", report.device.batteryLevel === null ? "not reported" : `${report.device.batteryLevel}% (${report.device.batteryStatus ?? ""})`);
  y += 2;

  if (report.health.issues.length) {
    sectionTitle("Potential issues");
    for (const issue of report.health.issues) {
      const lines = doc.splitTextToSize(`- ${issue}`, right - margin);
      if (y + lines.length * 5 > 275) {
        doc.addPage();
        y = 22;
      }
      doc.text(lines, margin, y);
      y += lines.length * 5.2;
    }
    y += 2;
  }

  if (report.drift) {
    sectionTitle("Stick measurements");
    const s = report.drift;
    row("Left average offset", `${s.left.avgX.toFixed(2)}% x, ${s.left.avgY.toFixed(2)}% y`);
    row("Left magnitude / max", `${s.left.magnitude.toFixed(2)}% / ${s.left.maxDeviation.toFixed(2)}%`);
    row("Right average offset", `${s.right.avgX.toFixed(2)}% x, ${s.right.avgY.toFixed(2)}% y`);
    row("Right magnitude / max", `${s.right.magnitude.toFixed(2)}% / ${s.right.maxDeviation.toFixed(2)}%`);
    row("Deadzone needed", `${Math.max(s.left.deadzoneNeeded, s.right.deadzoneNeeded).toFixed(2)}%`);
    row("Verdicts", `left ${s.left.verdict}, right ${s.right.verdict}`);
    y += 2;
  }

  if (report.triggers) {
    sectionTitle("Trigger measurements");
    const t = report.triggers;
    row("Left trigger range", `${(t.lt.min * 100).toFixed(0)}% - ${(t.lt.max * 100).toFixed(0)}%`);
    row("Right trigger range", `${(t.rt.min * 100).toFixed(0)}% - ${(t.rt.max * 100).toFixed(0)}%`);
    row("Return to rest", `${t.lt.returnsToZero ? "yes" : "no"} / ${t.rt.returnsToZero ? "yes" : "no"}`);
    row("Smoothness", `${t.lt.smoothness}% / ${t.rt.smoothness}%`);
    y += 2;
  }

  if (report.buttons.length) {
    // Keep the button table on one page where it fits.
    if (y + report.buttons.length * 5 + 16 > 282) {
      doc.addPage();
      y = 22;
    }
    sectionTitle("Button tests");
    doc.setFontSize(8.5);
    for (const b of report.buttons) {
      if (y > 275) {
        doc.addPage();
        y = 22;
      }
      doc.setTextColor(25, 30, 40);
      doc.text(b.label, margin, y);
      doc.setTextColor(110, 122, 140);
      doc.text(
        `${b.status.toUpperCase()}  -  ${b.presses} press${b.presses === 1 ? "" : "es"}${
          b.responseMs !== null ? `, ${b.responseMs} ms` : ""
        }${b.released ? "" : ", release not seen"}`,
        margin + 62,
        y
      );
      y += 5;
    }
    y += 2;
  }

  sectionTitle("Test settings");
  row("Normal noise threshold", `${report.settings.noiseThreshold}% of travel`);
  row("Drift threshold", `${report.settings.driftThreshold}% of travel`);
  row("Deadzone reference", `${report.settings.deadzone}%`);

  if (report.notes) {
    if (y > 250) {
      doc.addPage();
      y = 22;
    }
    sectionTitle("Notes");
    const lines = doc.splitTextToSize(report.notes, right - margin);
    doc.text(lines, margin, y);
  }

  doc.setFontSize(7.5);
  doc.setTextColor(...muted);
  doc.text(
    "Values are measured from the controller's own reports on this PC. No values are estimated.",
    margin,
    288
  );
  return new Uint8Array(doc.output("arraybuffer"));
}

function stem(report: DiagnosticReport): string {
  const device = report.device.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  const date = report.createdAt.slice(0, 10);
  return `driftbusters-${device || "controller"}-${date}`;
}

export async function exportReportPdf(report: DiagnosticReport): Promise<string | null> {
  const path = await save({
    defaultPath: `${stem(report)}.pdf`,
    filters: [{ name: "PDF document", extensions: ["pdf"] }],
  });
  if (!path) return null;
  await invoke("save_bytes", { path, bytes: Array.from(pdfBytes(report)) });
  return path;
}

export async function exportReportCsv(report: DiagnosticReport): Promise<string | null> {
  const path = await save({
    defaultPath: `${stem(report)}.csv`,
    filters: [{ name: "CSV file", extensions: ["csv"] }],
  });
  if (!path) return null;
  await invoke("save_bytes", {
    path,
    bytes: Array.from(new TextEncoder().encode(reportToCsv(report))),
  });
  return path;
}
