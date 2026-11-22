import { useCallback, useEffect, useState } from "react";
import { useSnapshot } from "./lib/live";
import { session } from "./lib/session";
import { connectionLabel, isPlayStation, type DeviceInfo, type InputState } from "./lib/types";
import { Dashboard } from "./screens/Dashboard";
import { Tester } from "./screens/Tester";
import { Drift } from "./screens/Drift";
import { Triggers } from "./screens/Triggers";
import { ButtonTest } from "./screens/ButtonTest";
import { Monitor } from "./screens/Monitor";
import { Compare } from "./screens/Compare";
import { History } from "./screens/History";
import { SettingsScreen } from "./screens/Settings";

export type Page =
  | "dashboard"
  | "tester"
  | "drift"
  | "triggers"
  | "buttons"
  | "monitor"
  | "compare"
  | "history"
  | "settings";

const NAV: { id: Page; label: string; hint: string; group: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", hint: "Overview", group: "Overview", icon: "M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-4H4v4Zm10-11h6V4h-6v5Z" },
  { id: "tester", label: "Controller Tester", hint: "Live buttons", group: "Diagnostics", icon: "M7 8h10a5 5 0 0 1 0 10h-1l-2-3H10l-2 3H7a5 5 0 0 1 0-10Z" },
  { id: "drift", label: "Stick Drift", hint: "Analogue accuracy", group: "Diagnostics", icon: "M12 3v18M3 12h18M12 12l5-5" },
  { id: "triggers", label: "Trigger Tester", hint: "Analogue range", group: "Diagnostics", icon: "M5 17V7m7 10V5m7 12v-8" },
  { id: "buttons", label: "Button Diagnostics", hint: "Guided sweep", group: "Diagnostics", icon: "M5 6h14v12H5zM9 12l2 2 4-4" },
  { id: "monitor", label: "Advanced Monitor", hint: "Raw signals", group: "Tools", icon: "M3 12h4l2-5 3 10 2-5h7" },
  { id: "compare", label: "Comparison", hint: "Two pads", group: "Tools", icon: "M8 4v16M16 4v16M4 9h8M12 15h8" },
  { id: "history", label: "Test History", hint: "Saved reports", group: "Tools", icon: "M12 8v5l3 2M4 12a8 8 0 1 0 8-8 8 8 0 0 0-8 8Z" },
  { id: "settings", label: "Settings", hint: "Thresholds", group: "Tools", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 12h2m12 0h2M12 4v2m0 12v2" },
];

const TITLES: Record<Page, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Everything connected, at a glance" },
  tester: { title: "Controller Tester", subtitle: "Press anything — every input is live" },
  drift: { title: "Stick Drift", subtitle: "Measure what your sticks do when you let go" },
  triggers: { title: "Trigger Tester", subtitle: "Analogue travel, return and smoothness" },
  buttons: { title: "Button Diagnostics", subtitle: "A guided sweep of every physical button" },
  monitor: { title: "Advanced Monitor", subtitle: "Raw reports, indices and timestamps" },
  compare: { title: "Controller Comparison", subtitle: "Two pads, measured the same way" },
  history: { title: "Test History", subtitle: "Saved reports on this PC" },
  settings: { title: "Settings", subtitle: "Thresholds, mapping and data" },
};

function DeviceBadge({ device }: { device: DeviceInfo }) {
  const battery = device.battery?.level ?? null;
  return (
    <div className="device-badge">
      <span className={`status-dot ${device.id ? "on" : ""}`} />
      <div className="device-badge-text">
        <span className="device-badge-name">{device.name}</span>
        <span className="device-badge-meta">
          {connectionLabel(device.connection)} · {device.backend === "xinput" ? "XInput" : "HID"}
          {battery !== null ? ` · ${battery}%` : ""}
        </span>
      </div>
    </div>
  );
}

export default function App() {
  const snapshot = useSnapshot();
  const [page, setPage] = useState<Page>("dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const devices = snapshot.devices;
  const active =
    devices.find((d) => d.id === selectedId) ?? devices[0] ?? null;
  const state: InputState | null =
    snapshot.states.find((s) => s.id === active?.id) ?? null;

  useEffect(() => {
    if (active && selectedId !== active.id) setSelectedId(active.id);
    if (active) session.setDevice(active.id);
  }, [active, selectedId]);

  const navigate = useCallback((next: Page) => {
    setPage(next);
    document.querySelector(".page")?.scrollTo({ top: 0 });
  }, []);

  const meta = TITLES[page];
  const groups = Array.from(new Set(NAV.map((n) => n.group)));

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            <svg viewBox="0 0 48 48" width="36" height="36">
              <defs>
                <linearGradient id="brandg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#3BE8B0" />
                  <stop offset="100%" stopColor="#7C5CFF" />
                </linearGradient>
              </defs>
              <rect x="2" y="2" width="44" height="44" rx="13" fill="#10151f" stroke="rgba(255,255,255,0.1)" />
              <circle cx="24" cy="24" r="13" fill="none" stroke="url(#brandg)" strokeWidth="2" opacity="0.7" />
              <path d="M14 27c0-5 3-8 10-8s10 3 10 8c0 4-3 6-5 3l-1-2h-8l-1 2c-2 3-5 1-5-3Z" fill="url(#brandg)" />
            </svg>
          </div>
          <div>
            <div className="brand-name">DRIFTBUSTERS</div>
            <div className="brand-tag">controller diagnostics</div>
          </div>
        </div>

        <nav className="nav">
          {groups.map((group) => (
            <div className="nav-group" key={group}>
              <div className="nav-group-label">{group}</div>
              {NAV.filter((n) => n.group === group).map((item) => (
                <button
                  key={item.id}
                  className={`nav-item${page === item.id ? " active" : ""}`}
                  onClick={() => navigate(item.id)}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                    <path d={item.icon} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="nav-text">
                    <span className="nav-label">{item.label}</span>
                    <span className="nav-hint">{item.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          {active ? (
            <>
              <DeviceBadge device={active} />
              {devices.length > 1 && (
                <select
                  className="device-select"
                  value={active.id}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="foot-art">
                <span className={isPlayStation(active.family) ? "foot-art-ps" : "foot-art-xb"}>
                  {isPlayStation(active.family) ? "PlayStation" : "Xbox"}
                </span>
              </div>
            </>
          ) : (
            <div className="foot-empty">
              <span className="status-dot" />
              No controller detected
            </div>
          )}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1 className="title">{meta.title}</h1>
            <p className="subtitle">{meta.subtitle}</p>
          </div>
          <div className="topbar-actions">
            {active && (
              <div className={`chip ${state?.live ? "ok" : "warn"}`}>
                <span className="chip-dot" />
                {state?.live ? "Receiving input" : "Waiting for input"}
              </div>
            )}
            <button className="btn primary" onClick={() => navigate("buttons")}>
              Start full diagnostic
            </button>
          </div>
        </header>

        <div className="page">
          {devices.length === 0 && page !== "history" && page !== "settings" ? (
            <div className="empty-state card">
              <svg viewBox="0 0 600 380" className="empty-art" aria-hidden>
                <ellipse cx="300" cy="320" rx="190" ry="22" fill="rgba(0,0,0,0.4)" />
                <path
                  d="M170 104 C216 80 384 80 430 104 C492 134 546 264 512 306 C487 336 440 306 402 254 C380 225 350 213 300 213 C250 213 220 225 198 254 C160 306 113 336 88 306 C54 264 108 134 170 104 Z"
                  fill="#141a23"
                  stroke="#2b3342"
                  strokeWidth="2"
                  strokeDasharray="8 6"
                />
                <circle cx="212" cy="252" r="30" fill="none" stroke="#2b3342" strokeWidth="2" />
                <circle cx="388" cy="252" r="30" fill="none" stroke="#2b3342" strokeWidth="2" />
              </svg>
              <h2>No controller detected yet</h2>
              <p>
                Plug a pad in with USB, or hold the pairing button and pair it over Bluetooth. Xbox
                pads are read through XInput; PlayStation pads through Windows HID. Detection is
                automatic — no need to restart.
              </p>
              <div className="empty-steps">
                <div><span>1</span>Connect the controller</div>
                <div><span>2</span>Wait for the status chip to turn green</div>
                <div><span>3</span>Press a button to confirm it is alive</div>
              </div>
            </div>
          ) : page === "dashboard" ? (
            <Dashboard devices={devices} active={active} state={state} navigate={navigate} />
          ) : page === "tester" ? (
            <Tester device={active} state={state} />
          ) : page === "drift" ? (
            <Drift device={active} state={state} />
          ) : page === "triggers" ? (
            <Triggers device={active} state={state} />
          ) : page === "buttons" ? (
            <ButtonTest device={active} state={state} navigate={navigate} />
          ) : page === "monitor" ? (
            <Monitor device={active} state={state} />
          ) : page === "compare" ? (
            <Compare devices={devices} states={snapshot.states} />
          ) : page === "history" ? (
            <History devices={devices} />
          ) : (
            <SettingsScreen />
          )}
        </div>
      </main>
    </div>
  );
}
