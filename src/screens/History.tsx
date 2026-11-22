import { useEffect, useState } from "react";
import { Card, Chip, KeyValue, Stat } from "../components/ui";
import { clearReports, deleteReport, listReports, type StoredReport } from "../lib/history";
import { exportReportCsv, exportReportPdf, type DiagnosticReport } from "../lib/report";
import { shortDate } from "../lib/format";
import type { DeviceInfo } from "../lib/types";

interface Props {
  devices: DeviceInfo[];
}

export function History({ devices }: Props) {
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string>("");
  const [filterDevice, setFilterDevice] = useState<string>("all");

  const refresh = async () => setReports(await listReports());

  useEffect(() => {
    void refresh();
  }, [devices.length]);

  const visible = reports.filter((r) => {
    if (filterDevice === "all") return true;
    const device = r.device as Record<string, unknown>;
    return String(device?.id ?? "") === filterDevice;
  });

  const exportAs = async (report: StoredReport, kind: "pdf" | "csv") => {
    setBusy(report.id);
    setNote("");
    try {
      const path =
        kind === "pdf"
          ? await exportReportPdf(report as unknown as DiagnosticReport)
          : await exportReportCsv(report as unknown as DiagnosticReport);
      if (path) setNote(`Saved to ${path}`);
    } catch (err) {
      setNote(`Export failed: ${String(err)}`);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    await deleteReport(id);
    await refresh();
  };

  const wipe = async () => {
    await clearReports();
    await refresh();
  };

  const scores = visible.slice(0, 12).reverse().map((r) => r.health.score);

  return (
    <div className="stack">
      <Card
        title="Saved reports"
        subtitle={`${reports.length} on this PC`}
        actions={
          <div className="row-actions">
            <select value={filterDevice} onChange={(e) => setFilterDevice(e.target.value)}>
              <option value="all">All controllers</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {reports.length > 0 && (
              <button className="btn ghost small" onClick={wipe}>
                Clear all
              </button>
            )}
          </div>
        }
      >
        {note && <p className="note">{note}</p>}
        {scores.length > 1 && (
          <div className="score-trend">
            <span className="mini-label">Health trend</span>
            <div className="trend-bars">
              {scores.map((s, i) => (
                <span
                  key={i}
                  className={`trend-bar ${s >= 85 ? "ok" : s >= 65 ? "warn" : "bad"}`}
                  style={{ height: `${Math.max(8, s)}%` }}
                  title={`${s}/100`}
                />
              ))}
            </div>
          </div>
        )}

        {visible.length === 0 ? (
          <p className="muted">
            No reports yet. Finish a guided button sweep and choose “Save report”, or export straight
            from a session.
          </p>
        ) : (
          <div className="history-list">
            {visible.map((report) => {
              const device = report.device as Record<string, unknown>;
              const expanded = open === report.id;
              return (
                <div key={report.id} className={`history-item${expanded ? " open" : ""}`}>
                  <button className="history-head" onClick={() => setOpen(expanded ? null : report.id)}>
                    <span className={`score score-${report.health.score >= 85 ? "ok" : report.health.score >= 65 ? "warn" : "bad"}`}>
                      {report.health.score}
                    </span>
                    <span className="history-title">
                      <strong>{String(device?.name ?? "Controller")}</strong>
                      <em>
                        {shortDate(report.createdAt)} · {String(device?.connectionLabel ?? "")}
                      </em>
                    </span>
                    <Chip tone={report.health.grade === "Excellent" ? "ok" : report.health.grade === "Good" ? "ok" : report.health.grade === "Fair" ? "warn" : "bad"}>
                      {report.health.grade}
                    </Chip>
                  </button>

                  {expanded && (
                    <div className="history-body">
                      <div className="history-summary">
                        <p>{report.health.summary}</p>
                        {report.health.issues.length > 0 ? (
                          <ul className="issue-list">
                            {report.health.issues.map((issue) => (
                              <li key={issue}>{issue}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="muted small">No issues were flagged in this report.</p>
                        )}
                      </div>

                      <div className="history-grid">
                        <div>
                          <span className="mini-label">Identification</span>
                          <KeyValue
                            rows={[
                              ["Model", String(device?.model ?? "—")],
                              ["Manufacturer", String(device?.manufacturer ?? "—")],
                              ["Family", String(device?.familyLabel ?? "—")],
                              ["USB IDs", `${String(device?.vid ?? "")} / ${String(device?.pid ?? "")}`],
                              ["Serial", String(device?.serial ?? "not exposed")],
                              ["Input API", String(device?.backend ?? "—")],
                            ]}
                          />
                        </div>
                        <div>
                          <span className="mini-label">Measurements</span>
                          <div className="mini-stats">
                            {report.drift ? (
                              <>
                                <Stat label="Left offset" value={`${(report.drift as DiagnosticReport["drift"] & object).left.magnitude.toFixed(2)}%`} />
                                <Stat label="Right offset" value={`${(report.drift as DiagnosticReport["drift"] & object).right.magnitude.toFixed(2)}%`} />
                              </>
                            ) : (
                              <Stat label="Drift" value="not tested" />
                            )}
                            {report.triggers ? (
                              <>
                                <Stat label="LT max" value={`${Math.round((report.triggers as DiagnosticReport["triggers"] & object).lt.max * 100)}%`} />
                                <Stat label="RT max" value={`${Math.round((report.triggers as DiagnosticReport["triggers"] & object).rt.max * 100)}%`} />
                              </>
                            ) : (
                              <Stat label="Triggers" value="not tested" />
                            )}
                            <Stat label="Buttons tested" value={Array.isArray(report.buttons) ? report.buttons.length : 0} />
                          </div>
                        </div>
                      </div>

                      <div className="row-actions">
                        <button className="btn small" disabled={busy === report.id} onClick={() => exportAs(report, "pdf")}>
                          Export PDF
                        </button>
                        <button className="btn small" disabled={busy === report.id} onClick={() => exportAs(report, "csv")}>
                          Export CSV
                        </button>
                        <button className="btn danger small" onClick={() => remove(report.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Where reports live" subtitle="Plain JSON on this machine, nothing uploaded">
        <p className="muted">
          Each saved report is stored in your Windows app-data folder under
          <span className="mono"> %APPDATA%\com.driftbusters.app\history.json</span>. Exporting writes a
          copy wherever you choose. Nothing leaves the PC and no account is needed.
        </p>
      </Card>
    </div>
  );
}
