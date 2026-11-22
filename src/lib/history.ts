import { invoke } from "@tauri-apps/api/core";

export interface StoredReport {
  id: string;
  createdAt: string;
  device: Record<string, unknown>;
  health: { score: number; grade: string; summary: string; issues: string[] };
  [key: string]: unknown;
}

export async function listReports(): Promise<StoredReport[]> {
  try {
    return await invoke<StoredReport[]>("list_reports");
  } catch (err) {
    console.error("list_reports failed", err);
    return [];
  }
}

export async function saveReport(report: unknown): Promise<string> {
  return invoke<string>("save_report", { report });
}

export async function deleteReport(id: string): Promise<void> {
  await invoke("delete_report", { id });
}

export async function clearReports(): Promise<void> {
  await invoke("clear_reports");
}

export async function appInfo(): Promise<Record<string, unknown>> {
  try {
    return await invoke<Record<string, unknown>>("app_info");
  } catch {
    return {};
  }
}
