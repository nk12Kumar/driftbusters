import { useEffect, useMemo, useRef, useState } from "react";
import { ControllerArt } from "../components/ControllerArt";
import { PhotoPad } from "../components/PhotoPad";
import { artFamily } from "../lib/art";
import { PHOTOS } from "../lib/photos";
import { Card, Chip, Stat } from "../components/ui";
import { driftStats, triggerStats, type DriftStats, type TriggerStats } from "../lib/analysis";
import { live } from "../lib/live";
import { pct } from "../lib/format";
import { useSettings } from "../lib/settings";
import { buttonLabel, connectionLabel, type DeviceInfo, type InputState } from "../lib/types";

interface Props {
  devices: DeviceInfo[];
  states: InputState[];
}

interface Capture {
  deviceId: string;
  movedShare: number;
  left: DriftStats;
  right: DriftStats;
  lt: TriggerStats;
  rt: TriggerStats;
  presses: number;
}

export function Compare({ devices, states }: Props) {
  const settings = useSettings();
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const [captures, setCaptures] = useState<Record<string, Capture>>({});
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const samples = useRef<Record<string, { x: number[]; y: number[]; rx: number[]; ry: number[]; lt: number[]; rt: number[]; presses: number; last: Record<string, boolean> }>>({});
  const endRef = useRef(0);
  const runningRef = useRef(false);

  useEffect(() => {
    if (devices.length && !a) setA(devices[0].id);
    if (devices.length > 1 && !b) setB(devices[1].id);
  }, [devices, a, b]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!runningRef.current) return;
      const now = Date.now();
      const selected = [a, b].filter(Boolean) as string[];
      for (const deviceId of selected) {
        const state = live.state(deviceId);
        if (!state) continue;
        const bucket = (samples.current[deviceId] ??= { x: [], y: [], rx: [], ry: [], lt: [], rt: [], presses: 0, last: {} });
        bucket.x.push(state.axes.lx);
        bucket.y.push(state.axes.ly);
        bucket.rx.push(state.axes.rx);
        bucket.ry.push(state.axes.ry);
        bucket.lt.push(state.axes.lt);
        bucket.rt.push(state.axes.rt);
        for (const [name, down] of Object.entries(state.buttons)) {
          if (down && !bucket.last[name]) bucket.presses += 1;
        }
        bucket.last = { ...state.buttons };
      }
      setRemaining(Math.max(0, endRef.current - now));
      if (now >= endRef.current) {
        runningRef.current = false;
        setRunning(false);
        const next: Record<string, Capture> = {};
        for (const [deviceId, bucket] of Object.entries(samples.current)) {
          const toSamples = (xs: number[], ys: number[]) =>
            xs.map((x, i) => ({ t: i * 25, x, y: ys[i] ?? 0 }));
          const all = [
            ...bucket.x.map((x, i) => ({ x, y: bucket.y[i] ?? 0 })),
            ...bucket.rx.map((x, i) => ({ x, y: bucket.ry[i] ?? 0 })),
          ];
          const movedShare = all.length
            ? all.filter((s) => Math.hypot(s.x, s.y) > 0.2).length / all.length
            : 0;
          next[deviceId] = {
            deviceId,
            movedShare,
            left: driftStats(toSamples(bucket.x, bucket.y), settings.noiseThreshold, settings.driftThreshold),
            right: driftStats(toSamples(bucket.rx, bucket.ry), settings.noiseThreshold, settings.driftThreshold),
            lt: triggerStats(bucket.lt),
            rt: triggerStats(bucket.rt),
            presses: bucket.presses,
          };
        }
        setCaptures(next);
      }
    }, 25);
    return () => window.clearInterval(id);
  }, [a, b, settings.noiseThreshold, settings.driftThreshold]);

  const start = () => {
    samples.current = {};
    setCaptures({});
    runningRef.current = true;
    setRunning(true);
    endRef.current = Date.now() + 8000;
  };

  const deviceA = devices.find((d) => d.id === a) ?? null;
  const deviceB = devices.find((d) => d.id === b) ?? null;

  const rows = useMemo(() => {
    const build = (device: DeviceInfo | null) => {
      if (!device) return null;
      const cap = captures[device.id];
      const state = states.find((s) => s.id === device.id) ?? null;
      return { device, cap, state };
    };
    return [build(deviceA), build(deviceB)];
  }, [deviceA, deviceB, captures, states]);

  if (devices.length < 2) {
    return (
      <Card title="Connect two controllers" subtitle="Comparison needs two live pads">
        <p className="muted">
          Plug in or pair a second controller. Both pads are sampled with exactly the same code path,
          so differences come from the hardware rather than the test.
        </p>
        <ul className="plain-list">
          <li>Stick centring and resting offset</li>
          <li>Deadzone needed at rest</li>
          <li>Trigger range and return</li>
          <li>Button activity during the window</li>
        </ul>
      </Card>
    );
  }

  return (
    <div className="stack">
      <Card
        title="Side-by-side comparison"
        subtitle="Hold both pads still for eight seconds, then trigger them if you like"
        actions={
          <button className="btn primary" onClick={start} disabled={running || !a || !b}>
            {running ? `Sampling… ${(remaining / 1000).toFixed(1)}s` : "Start 8s comparison"}
          </button>
        }
      >
        <div className="compare-pickers">
          <Selector label="Controller A" devices={devices} value={a} onChange={setA} />
          <Selector label="Controller B" devices={devices} value={b} onChange={setB} />
        </div>
      </Card>

      <div className="compare-grid">
        {rows.map((row, i) =>
          row ? (
            <Card key={row.device.id} className="compare-card" title={`${i === 0 ? "A" : "B"} · ${row.device.name}`} subtitle={`${connectionLabel(row.device.connection)} · ${row.device.backend.toUpperCase()}`}>
              <div className="compare-art">
                {PHOTOS[artFamily(row.device)] ? (
                  <PhotoPad
                    family={artFamily(row.device)}
                    device={row.device}
                    pressed={row.state?.buttons ?? {}}
                    label={`${row.device.name} photo`}
                  />
                ) : (
                  <ControllerArt
                    family={artFamily(row.device)}
                    pressed={row.state?.buttons ?? {}}
                    axes={row.state?.axes}
                    label={`${row.device.name} comparison`}
                  />
                )}
              </div>
              <div className="compare-stats">
                <Stat label="Left offset" value={row.cap ? pct(row.cap.left.magnitude, 2) : "—"} tone={row.cap && row.cap.left.magnitude > settings.driftThreshold ? "bad" : "ok"} />
                <Stat label="Right offset" value={row.cap ? pct(row.cap.right.magnitude, 2) : "—"} tone={row.cap && row.cap.right.magnitude > settings.driftThreshold ? "bad" : "ok"} />
                <Stat label="Left trigger max" value={row.cap ? pct(row.cap.lt.max * 100, 0) : "—"} />
                <Stat label="Right trigger max" value={row.cap ? pct(row.cap.rt.max * 100, 0) : "—"} />
                <Stat label="Button edges" value={row.cap ? row.cap.presses : "—"} sub="presses seen" />
                <Stat label="Deadzone needed" value={row.cap ? pct(Math.max(row.cap.left.deadzoneNeeded, row.cap.right.deadzoneNeeded), 2) : "—"} />
                {row.cap && row.cap.movedShare > 0.05 && (
                  <Stat label="Validity" value="Moved" sub="run again at rest" tone="warn" />
                )}
              </div>
            </Card>
          ) : null
        )}
      </div>

      {Object.keys(captures).length > 0 && (
        <Card title="Measured differences" subtitle="Same test, same thresholds, both pads">
          <table className="table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>A</th>
                <th>B</th>
                <th>Winner</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Left stick offset", get: (c: Capture) => c.left.magnitude, lower: true, unit: "%" },
                { label: "Right stick offset", get: (c: Capture) => c.right.magnitude, lower: true, unit: "%" },
                { label: "Left deadzone needed", get: (c: Capture) => c.left.deadzoneNeeded, lower: true, unit: "%" },
                { label: "Right deadzone needed", get: (c: Capture) => c.right.deadzoneNeeded, lower: true, unit: "%" },
                { label: "Left trigger reach", get: (c: Capture) => c.lt.max * 100, lower: false, unit: "%" },
                { label: "Right trigger reach", get: (c: Capture) => c.rt.max * 100, lower: false, unit: "%" },
                { label: "Trigger smoothness", get: (c: Capture) => (c.lt.smoothness + c.rt.smoothness) / 2, lower: false, unit: "%" },
              ].map((metric) => {
                const ca = a ? captures[a] : undefined;
                const cb = b ? captures[b] : undefined;
                if (!ca || !cb) return null;
                const va = metric.get(ca);
                const vb = metric.get(cb);
                const winner = Math.abs(va - vb) < 0.05 ? "tie" : (metric.lower ? va < vb : va > vb) ? "A" : "B";
                return (
                  <tr key={metric.label}>
                    <td>{metric.label}</td>
                    <td className="mono">{va.toFixed(2)}{metric.unit}</td>
                    <td className="mono">{vb.toFixed(2)}{metric.unit}</td>
                    <td>
                      <Chip tone={winner === "tie" ? "neutral" : "ok"}>{winner === "tie" ? "level" : winner}</Chip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="footnote">
            Comparison numbers come from the same capture window. A pad that moved during the window is
            flagged "Moved" above — run it again with both pads resting for a meaningful offset.
          </p>
        </Card>
      )}
    </div>
  );
}

function Selector({
  label,
  devices,
  value,
  onChange,
}: {
  label: string;
  devices: DeviceInfo[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        {devices.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name} · {buttonLabel("faceSouth", d.family)} layout
          </option>
        ))}
      </select>
    </label>
  );
}
