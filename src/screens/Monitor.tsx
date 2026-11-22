import { useEffect, useRef, useState } from "react";
import { Card, Chip, KeyValue } from "../components/ui";
import { hexDump } from "../lib/format";
import { effectiveButtons } from "../lib/live";
import { useSettings } from "../lib/settings";
import { buttonLabel, type DeviceInfo, type InputState } from "../lib/types";

interface Props {
  device: DeviceInfo | null;
  state: InputState | null;
}

interface LogLine {
  id: number;
  at: number;
  text: string;
  tone: "down" | "up" | "info";
}

export function Monitor({ device, state }: Props) {
  const settings = useSettings();
  const [showRaw, setShowRaw] = useState(settings.showRaw);
  const [log, setLog] = useState<LogLine[]>([]);
  const [rate, setRate] = useState(0);
  const previous = useRef<Record<string, boolean>>({});
  const counter = useRef(0);
  const lastPacket = useRef({ packet: 0, at: Date.now() });

  const pressed = effectiveButtons(state, device);

  useEffect(() => {
    if (!state) return;
    const prev = previous.current;
    const now = Date.now();
    const events: LogLine[] = [];
    for (const [name, down] of Object.entries(state.buttons)) {
      if (down && !prev[name]) {
        events.push({
          id: counter.current++,
          at: now,
          text: `${buttonLabel(name, device?.family ?? "generic")} down · index ${state.raw.buttons.join("/") || "—"}`,
          tone: "down",
        });
      }
      if (!down && prev[name]) {
        events.push({
          id: counter.current++,
          at: now,
          text: `${buttonLabel(name, device?.family ?? "generic")} up`,
          tone: "up",
        });
      }
    }
    const held = Object.values(state.buttons).filter(Boolean).length;
    if (held >= 2) {
      events.push({
        id: counter.current++,
        at: now,
        text: `${held} buttons held simultaneously`,
        tone: "info",
      });
    }
    if (events.length) setLog((l) => [...events.reverse(), ...l].slice(0, 160));
    previous.current = { ...state.buttons };

    const delta = state.packet - lastPacket.current.packet;
    const elapsed = now - lastPacket.current.at;
    if (delta > 0 && elapsed > 500) {
      setRate(Math.round((delta / elapsed) * 1000));
      lastPacket.current = { packet: state.packet, at: now };
    }
  }, [state, device?.family]);

  if (!device) return null;

  const axisNames = ["LX", "LY", "RX", "RY", "LT", "RT"];
  const axisLabels = ["Left X", "Left Y", "Right X", "Right Y", "Left trigger", "Right trigger"];
  const rawAxes = state?.raw.axes ?? [];
  const norm = state ? [state.axes.lx, state.axes.ly, state.axes.rx, state.axes.ry, state.axes.lt, state.axes.rt] : [];

  return (
    <div className="stack">
      <div className="grid-3 monitor-top">
        <Card title="Signal" subtitle="Live link state">
          <KeyValue
            rows={[
              ["Device", device.name],
              ["Backend", device.backend === "xinput" ? "XInput" : "Windows HID"],
              ["Packet", state?.packet ?? 0],
              ["Rate", `${rate} / s`],
              ["Report id", state ? `0x${state.raw.reportId.toString(16).toUpperCase()}` : "—"],
              ["Report length", state ? `${state.raw.report.length} bytes` : "—"],
              ["Last packet", state ? `${Math.max(0, Date.now() - state.timestampMs)} ms ago` : "—"],
            ]}
          />
        </Card>

        <Card
          title="Raw axes"
          subtitle="Logical values straight from the report"
          actions={<Chip tone="info">{rawAxes.length} axes</Chip>}
        >
          <table className="table compact">
            <thead>
              <tr>
                <th>#</th>
                <th>Axis</th>
                <th>Raw</th>
                <th>Normalised</th>
              </tr>
            </thead>
            <tbody>
              {axisNames.map((name, i) => (
                <tr key={name}>
                  <td className="mono">{i}</td>
                  <td>{axisLabels[i]}</td>
                  <td className="mono">{rawAxes[i] ?? "—"}</td>
                  <td className="mono">{norm.length ? norm[i].toFixed(3) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Button indices" subtitle="What the pad reports right now">
          <div className="mono-block">
            <div>
              <span className="mini-label">Pressed raw indices</span>
              <p>{state?.raw.buttons.length ? state.raw.buttons.join(", ") : "none"}</p>
            </div>
            <div>
              <span className="mini-label">Pressed logical buttons</span>
              <p>{Object.entries(state?.buttons ?? {}).filter(([, v]) => v).map(([k]) => k).join(", ") || "none"}</p>
            </div>
            <div>
              <span className="mini-label">Simultaneous presses</span>
              <p>{Object.values(state?.buttons ?? {}).filter(Boolean).length}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid-2">
        <Card
          title="Diagnostic event log"
          subtitle="Newest first, with timestamps"
          actions={<button className="btn ghost small" onClick={() => setLog([])}>Clear</button>}
        >
          <div className="log">
            {log.length === 0 && <p className="muted small">Press buttons to populate the log.</p>}
            {log.map((line) => (
              <div key={line.id} className={`log-line ${line.tone}`}>
                <span className="log-time">
                  {new Date(line.at).toLocaleTimeString(undefined, {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    fractionalSecondDigits: 3,
                  })}
                </span>
                <span>{line.text}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Raw data mode"
          subtitle="Exact bytes received from the device"
          actions={
            <label className="switch">
              <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />
              <span />
            </label>
          }
        >
          {showRaw ? (
            <>
              <div className="hex">
                {state?.raw.report.length ? hexDump(state.raw.report) : "No raw report (XInput path reports structured data only)"}
              </div>
              <div className="hex-grid">
                {state?.raw.report.map((byte, i) => (
                  <span key={i} className={byte ? "hot" : ""}>
                    <em>{i.toString().padStart(2, "0")}</em>
                    {byte.toString(16).toUpperCase().padStart(2, "0")}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">Raw bytes hidden.</p>
          )}
          <p className="footnote">
            {device.backend === "xinput"
              ? "Xbox pads are polled through XInput, which exposes buttons and axes as a structure rather than a raw HID report."
              : "Offset column shows the byte position within the input report."}
          </p>
        </Card>
      </div>

      <Card title="All button states" subtitle="Includes buttons this pad does not physically have">
        <div className="state-grid">
          {Object.entries(pressed).map(([name, down]) => (
            <div key={name} className={`state-cell${down ? " on" : ""}`}>
              <span>{buttonLabel(name, device.family)}</span>
              <em>{name}</em>
              <strong>{down ? "1" : "0"}</strong>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
