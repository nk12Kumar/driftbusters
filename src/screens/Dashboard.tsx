import { useEffect, useState } from "react";
import { ControllerArt } from "../components/ControllerArt";
import { artFamily } from "../lib/art";
import { Bar, Card, Chip, KeyValue, Stat } from "../components/ui";
import { healthFor } from "../lib/actions";
import { effectiveButtons } from "../lib/live";
import { listReports, type StoredReport } from "../lib/history";
import { useSession } from "../lib/session";
import { shortDate } from "../lib/format";
import {
  buttonLabel,
  connectionLabel,
  familyLabel,
  type DeviceInfo,
  type InputState,
} from "../lib/types";
import type { Page } from "../App";

interface Props {
  devices: DeviceInfo[];
  active: DeviceInfo | null;
  state: InputState | null;
  navigate: (page: Page) => void;
}

export function Dashboard({ devices, active, state, navigate }: Props) {
  const data = useSession();
  const [reports, setReports] = useState<StoredReport[]>([]);

  useEffect(() => {
    void listReports().then((r) => setReports(r.slice(0, 3)));
  }, [data.updatedAt]);

  const pressed = effectiveButtons(state, active);
  const summary = active ? healthFor(active, data) : null;
  const pressedNames = Object.entries(pressed)
    .filter(([, v]) => v)
    .map(([k]) => buttonLabel(k, active?.family ?? "generic"));

  return (
    <div className="stack">
      {active && (
        <div className="hero card">
          <div className="hero-art pad-shared">
            <ControllerArt
              family={artFamily(active)}
              pressed={pressed}
              axes={state?.axes}
              label={`${active.name} live illustration`}
            />
          </div>
          <div className="hero-info">
            <div className="hero-top">
              <div>
                <div className="eyebrow">{familyLabel(active.family)}</div>
                <h2 className="hero-title">{active.name}</h2>
                <p className="hero-sub">
                  {active.manufacturer} · {connectionLabel(active.connection)} ·{" "}
                  {active.backend === "xinput" ? "XInput" : "Windows HID"}
                </p>
              </div>
              <Chip tone={state?.live ? "ok" : "warn"}>
                {state?.live ? "Connected" : "Waiting"}
              </Chip>
            </div>

            <div className="hero-stats">
              <Stat
                label="Health"
                value={summary ? `${summary.score}` : "—"}
                sub={summary ? summary.grade : "Not tested yet"}
                tone={
                  summary
                    ? summary.score >= 85
                      ? "ok"
                      : summary.score >= 65
                        ? "warn"
                        : "bad"
                    : "neutral"
                }
              />
              <Stat
                label="Battery"
                value={active.battery?.level !== null && active.battery?.level !== undefined ? `${active.battery.level}%` : "—"}
                sub={active.battery?.status ?? "Not reported"}
              />
              <Stat label="USB IDs" value={`${active.vid.toString(16).toUpperCase().padStart(4, "0")}`} sub={`PID ${active.pid.toString(16).toUpperCase().padStart(4, "0")}`} />
              <Stat label="Report rate" value={state ? "live" : "idle"} sub={state ? `packet ${state.packet}` : "no packets"} />
            </div>

            <div className="hero-keys">
              <span className="mini-label">Currently held</span>
              <div className="key-row">
                {pressedNames.length ? (
                  pressedNames.map((n) => (
                    <span className="key" key={n}>
                      {n}
                    </span>
                  ))
                ) : (
                  <span className="muted">Nothing pressed</span>
                )}
              </div>
            </div>

            <div className="hero-actions">
              <button className="btn primary" onClick={() => navigate("buttons")}>
                Start full diagnostic
              </button>
              <button className="btn" onClick={() => navigate("tester")}>
                Open tester
              </button>
              <button className="btn ghost" onClick={() => navigate("drift")}>
                Check drift
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid-3">
        <Card title="Quick tests" subtitle="Jump straight to a measurement">
          <div className="quick-grid">
            <button className="quick" onClick={() => navigate("drift")}>
              <span className="quick-icon">◎</span>
              <span>
                <strong>Stick drift</strong>
                <em>10-second automated hold test</em>
              </span>
            </button>
            <button className="quick" onClick={() => navigate("triggers")}>
              <span className="quick-icon">▮</span>
              <span>
                <strong>Triggers</strong>
                <em>Range, return and smoothness</em>
              </span>
            </button>
            <button className="quick" onClick={() => navigate("buttons")}>
              <span className="quick-icon">⌘</span>
              <span>
                <strong>Button sweep</strong>
                <em>Every button, one by one</em>
              </span>
            </button>
            <button className="quick" onClick={() => navigate("monitor")}>
              <span className="quick-icon">⋮⋮</span>
              <span>
                <strong>Raw monitor</strong>
                <em>Indices, timestamps, reports</em>
              </span>
            </button>
          </div>
        </Card>

        <Card title="This session" subtitle="Measurements recorded since launch">
          {data.drift || data.triggers || data.buttons.length ? (
            <div className="session-list">
              <div className={`session-row ${data.drift ? "done" : ""}`}>
                <span>Stick drift</span>
                <span>
                  {data.drift
                    ? `${Math.max(data.drift.left.magnitude, data.drift.right.magnitude).toFixed(1)}% offset`
                    : "not measured"}
                </span>
              </div>
              <div className={`session-row ${data.triggers ? "done" : ""}`}>
                <span>Triggers</span>
                <span>
                  {data.triggers
                    ? `${(data.triggers.lt.max * 100).toFixed(0)}% / ${(data.triggers.rt.max * 100).toFixed(0)}% reach`
                    : "not measured"}
                </span>
              </div>
              <div className={`session-row ${data.buttons.length ? "done" : ""}`}>
                <span>Buttons</span>
                <span>
                  {data.buttons.length
                    ? `${data.buttons.filter((b) => b.status === "pass").length}/${data.buttons.length} passed`
                    : "not measured"}
                </span>
              </div>
              {summary && summary.issues.length > 0 && (
                <div className="issue-box">
                  <span className="mini-label">Flags</span>
                  <ul>
                    {summary.issues.slice(0, 4).map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="placeholder">
              <p>No measurements yet. The guided button sweep also records stick and trigger checks into one report.</p>
              <button className="btn primary small" onClick={() => navigate("buttons")}>
                Run the full diagnostic
              </button>
            </div>
          )}
        </Card>

        <Card title="Connected" subtitle={`${devices.length} controller${devices.length === 1 ? "" : "s"}`}>
          <div className="device-list">
            {devices.map((d) => (
              <div className="device-row" key={d.id}>
                <div>
                  <strong>{d.name}</strong>
                  <em>
                    {connectionLabel(d.connection)} · {familyLabel(d.family)}
                  </em>
                </div>
                <div className="device-row-right">
                  <Chip tone="ok">live</Chip>
                  {d.battery?.level !== null && d.battery?.level !== undefined && (
                    <span className="battery-mini">
                      <Bar value={d.battery.level} max={100} tone={d.battery.level < 20 ? "bad" : "ok"} />
                      <span>{d.battery.level}%</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
            {devices.length === 0 && <p className="muted">Nothing connected.</p>}
          </div>
        </Card>
      </div>

      <div className="grid-2">
        <Card
          title="Recent reports"
          subtitle="Saved on this PC"
          actions={
            <button className="btn ghost small" onClick={() => navigate("history")}>
              All reports
            </button>
          }
        >
          {reports.length ? (
            <div className="report-list">
              {reports.map((r) => (
                <div className="report-row" key={r.id}>
                  <div>
                    <strong>{String((r.device as Record<string, unknown>)?.name ?? "Controller")}</strong>
                    <em>{shortDate(r.createdAt)}</em>
                  </div>
                  <span className={`score score-${r.health.score >= 85 ? "ok" : r.health.score >= 65 ? "warn" : "bad"}`}>
                    {r.health.score}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No saved reports yet.</p>
          )}
        </Card>

        <Card title="Device details" subtitle="Reported by the hardware itself">
          {active ? (
            <KeyValue
              rows={[
                ["Model", active.model],
                ["Manufacturer", active.manufacturer],
                ["Input API", active.backend === "xinput" ? "XInput 1.4" : "Windows HID"],
                ["Connection", connectionLabel(active.connection)],
                ["VID / PID", `${active.vid.toString(16).toUpperCase().padStart(4, "0")} / ${active.pid.toString(16).toUpperCase().padStart(4, "0")}`],
                ["Serial", active.serial ?? "not exposed"],
                ["Input report", active.inputReportLength ? `${active.inputReportLength} bytes` : "—"],
                ["HID usage", active.usagePage ? `${active.usagePage.toString(16).toUpperCase()}:${(active.usage ?? 0).toString(16).toUpperCase().padStart(2, "0")}` : "—"],
              ]}
            />
          ) : (
            <p className="muted">Connect a controller to see its identifiers.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
