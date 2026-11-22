import { useEffect, useMemo, useRef, useState } from "react";
import { StickGraph } from "../components/StickGraph";
import { TraceChart } from "../components/TraceChart";
import { Card, Chip, Stat } from "../components/ui";
import { driftStats, type DriftStats, type Sample } from "../lib/analysis";
import { live } from "../lib/live";
import { session, useSession } from "../lib/session";
import { saveCurrentReport } from "../lib/actions";
import { useSettings } from "../lib/settings";
import { pct, seconds, signed, toneFor } from "../lib/format";
import type { DeviceInfo, InputState } from "../lib/types";

interface Props {
  device: DeviceInfo | null;
  state: InputState | null;
}

type Trail = { x: number; y: number }[];

export function Drift({ device, state }: Props) {
  const settings = useSettings();
  const data = useSession();
  const [trailL, setTrailL] = useState<Trail>([]);
  const [trailR, setTrailR] = useState<Trail>([]);
  const [history, setHistory] = useState({ lx: [] as number[], ly: [] as number[], rx: [] as number[], ry: [] as number[] });
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [count, setCount] = useState(0);
  const [result, setResult] = useState<{ left: DriftStats; right: DriftStats } | null>(
    data.drift ?? null
  );
  const [savedNote, setSavedNote] = useState("");

  const samples = useRef<{ left: Sample[]; right: Sample[] }>({ left: [], right: [] });
  const runningRef = useRef(false);
  const endRef = useRef(0);
  const startRef = useRef(0);
  const tickRef = useRef(0);
  const lastPacket = useRef(-1);
  const deviceRef = useRef<string | null>(device?.id ?? null);
  deviceRef.current = device?.id ?? null;

  const threshold = settings.driftThreshold;
  const noise = settings.noiseThreshold;

  useEffect(() => {
    const id = window.setInterval(() => {
      const id0 = deviceRef.current;
      if (!id0) return;
      const snapshot = live.state(id0);
      if (!snapshot) return;
      const now = Date.now();
      const p = { x: snapshot.axes.lx, y: snapshot.axes.ly };
      const q = { x: snapshot.axes.rx, y: snapshot.axes.ry };

      tickRef.current += 1;
      if (tickRef.current % 2 === 0) {
        setTrailL((t) => [...t.slice(-220), p]);
        setTrailR((t) => [...t.slice(-220), q]);
      }
      if (tickRef.current % 4 === 0) {
        setHistory((h) => ({
          lx: [...h.lx.slice(-199), snapshot.axes.lx],
          ly: [...h.ly.slice(-199), snapshot.axes.ly],
          rx: [...h.rx.slice(-199), snapshot.axes.rx],
          ry: [...h.ry.slice(-199), snapshot.axes.ry],
        }));
      }

      if (runningRef.current) {
        // One sample per device packet keeps the maths honest.
        if (snapshot.packet !== lastPacket.current) {
          lastPacket.current = snapshot.packet;
          samples.current.left.push({ t: now, ...p });
          samples.current.right.push({ t: now, ...q });
        }
        const total = samples.current.left.length;
        if (total % 5 === 0) {
          setCount(total);
          setElapsed(now - startRef.current);
        }
        if (now >= endRef.current) {
          runningRef.current = false;
          setRunning(false);
          setElapsed(now - startRef.current);
          const left = driftStats(samples.current.left, noise, threshold);
          const right = driftStats(samples.current.right, noise, threshold);
          setResult({ left, right });
          session.setDrift({ left, right });
        }
      }
    }, 20);
    return () => window.clearInterval(id);
  }, [noise, threshold]);

  const start = () => {
    if (!device) return;
    samples.current = { left: [], right: [] };
    lastPacket.current = -1;
    setResult(null);
    setCount(0);
    setElapsed(0);
    const now = Date.now();
    startRef.current = now;
    endRef.current = now + settings.sampleSeconds * 1000;
    runningRef.current = true;
    setRunning(true);
  };

  const stop = () => {
    if (!runningRef.current) return;
    runningRef.current = false;
    setRunning(false);
    const left = driftStats(samples.current.left, noise, threshold);
    const right = driftStats(samples.current.right, noise, threshold);
    setResult({ left, right });
    session.setDrift({ left, right });
  };

  const progress = running
    ? Math.min(1, elapsed / (settings.sampleSeconds * 1000))
    : result
      ? 1
      : 0;

  const axes = state?.axes ?? { lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0 };
  const liveLeft = Math.hypot(axes.lx, axes.ly) * 100;
  const liveRight = Math.hypot(axes.rx, axes.ry) * 100;

  const suggestion = useMemo(() => {
    if (!result) return null;
    const worst = Math.max(result.left.deadzoneNeeded, result.right.deadzoneNeeded);
    return `Suggested deadzone: ${(Math.ceil(worst * 2) / 2).toFixed(1)}%`;
  }, [result]);

  return (
    <div className="stack">
      <Card
        title="Automated drift test"
        subtitle={`Leave both sticks untouched for ${settings.sampleSeconds} seconds`}
        actions={
          <div className="row-actions">
            {result && device && (
              <button
                className="btn ghost small"
                onClick={async () => {
                  try {
                    await saveCurrentReport(device, session.get());
                    setSavedNote("Report saved to Test History");
                  } catch (err) {
                    setSavedNote(`Could not save: ${String(err)}`);
                  }
                }}
              >
                Save report
              </button>
            )}
            {running ? (
              <button className="btn" onClick={stop}>
                Stop early
              </button>
            ) : (
              <button className="btn primary" onClick={start} disabled={!device}>
                Start {settings.sampleSeconds}s test
              </button>
            )}
          </div>
        }
      >
        <div className="test-runner">
          <div className="runner-graphic">
            <div className={`runner-ring${running ? " spinning" : ""}`}>
              <div className="runner-inner">{Math.round(progress * 100)}%</div>
            </div>
          </div>
          <div className="runner-body">
            <p className="runner-copy">
              {running
                ? "Keep your hands off the sticks. Sampling the raw analogue values now."
                : result
                  ? "Test complete. Results below compare the resting offset against your thresholds."
                  : "Put the controller down on a flat surface, then start. Driftbusters samples the raw axes and measures how far they wander from centre."}
            </p>
            <div className="runner-stats">
              <Stat label="Samples" value={count || result?.left.samples || 0} sub={`at ~50 Hz`} />
              <Stat label="Elapsed" value={seconds(elapsed)} sub={`of ${settings.sampleSeconds}s`} />
              <Stat label="Noise threshold" value={pct(noise, 1)} sub="sensor noise floor" />
              <Stat label="Drift threshold" value={pct(threshold, 1)} sub="fails above this" />
            </div>
            <div className="progress">
              <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
            </div>
            {savedNote && <p className="note">{savedNote}</p>}
            {result && (
              <div className="verdict-row">
                <Chip tone={toneFor(result.left.verdict)}>Left: {result.left.verdict}</Chip>
                <Chip tone={toneFor(result.right.verdict)}>Right: {result.right.verdict}</Chip>
                {suggestion && <span className="muted small">{suggestion}</span>}
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid-2 drift-grid">
        <StickPanel
          label="Left stick"
          live={liveLeft}
          stats={result?.left ?? null}
          trail={trailL}
          x={axes.lx}
          y={axes.ly}
          deadzone={settings.deadzone / 100}
          threshold={threshold}
        />
        <StickPanel
          label="Right stick"
          live={liveRight}
          stats={result?.right ?? null}
          trail={trailR}
          x={axes.rx}
          y={axes.ry}
          deadzone={settings.deadzone / 100}
          threshold={threshold}
        />
      </div>

      <Card title="Live history" subtitle="Stick position while untouched — flutter is visible here">
        <div className="trace-pair">
          <div>
            <span className="mini-label">Left stick X / Y</span>
            <TraceChart
              series={[
                { values: history.lx, color: "#3BE8B0", width: 1.4 },
                { values: history.ly, color: "#7C5CFF", width: 1.4 },
              ]}
              yMin={-1}
              yMax={1}
              height={130}
            />
          </div>
          <div>
            <span className="mini-label">Right stick X / Y</span>
            <TraceChart
              series={[
                { values: history.rx, color: "#3BE8B0", width: 1.4 },
                { values: history.ry, color: "#7C5CFF", width: 1.4 },
              ]}
              yMin={-1}
              yMax={1}
              height={130}
            />
          </div>
        </div>
      </Card>

      <Card title="Calibration assistance" subtitle="What your stick is actually doing at rest">
        {result ? (
          <div className="calib">
            <div className="calib-block">
              <span className="mini-label">Left rest offset</span>
              <strong>
                {signed(result.left.avgX, 2)}% X, {signed(result.left.avgY, 2)}% Y
              </strong>
              <span className="muted small">
                Magnitude {pct(result.left.magnitude, 2)} · max deviation {pct(result.left.maxDeviation, 2)}
              </span>
            </div>
            <div className="calib-block">
              <span className="mini-label">Right rest offset</span>
              <strong>
                {signed(result.right.avgX, 2)}% X, {signed(result.right.avgY, 2)}% Y
              </strong>
              <span className="muted small">
                Magnitude {pct(result.right.magnitude, 2)} · max deviation {pct(result.right.maxDeviation, 2)}
              </span>
            </div>
            <div className="calib-block">
              <span className="mini-label">Deadzone needed</span>
              <strong>{pct(Math.max(result.left.deadzoneNeeded, result.right.deadzoneNeeded), 2)}</strong>
              <span className="muted small">needed to contain 99% of resting samples</span>
            </div>
            <div className="calib-block">
              <span className="mini-label">Verdict</span>
              <strong>
                {result.left.verdict === "ok" && result.right.verdict === "ok"
                  ? "Within tolerance"
                  : "Outside tolerance — see report"}
              </strong>
              <span className="muted small">
                noise {pct(noise, 1)}, drift {pct(threshold, 1)}
              </span>
            </div>
          </div>
        ) : (
          <p className="muted">
            Run the automated test to see the resting offset, maximum deviation and the deadzone your
            stick would need to stay quiet.
          </p>
        )}
      </Card>
    </div>
  );
}

function StickPanel({
  label,
  live,
  stats,
  trail,
  x,
  y,
  deadzone,
  threshold,
}: {
  label: string;
  live: number;
  stats: DriftStats | null;
  trail: Trail;
  x: number;
  y: number;
  deadzone: number;
  threshold: number;
}) {
  return (
    <Card
      className="stick-card"
      title={label}
      actions={
        stats ? (
          <Chip tone={toneFor(stats.verdict)}>{stats.verdict}</Chip>
        ) : (
          <Chip tone={live > threshold ? "warn" : "ok"}>{pct(live, 1)} live</Chip>
        )
      }
    >
      <div className="stick-card-grid">
        <div className="stick-canvas">
          <StickGraph
            x={x}
            y={y}
            trail={trail}
            deadzone={deadzone}
            maxDeviation={stats?.maxDeviation ?? live}
            label={label}
          />
        </div>
        <div className="stick-stats">
          <Stat label="Current offset" value={pct(live, 2)} sub={`${signed(x, 2)} X · ${signed(y, 2)} Y`} />
          <Stat
            label="Average offset"
            value={stats ? pct(stats.magnitude, 2) : "—"}
            sub={stats ? `${signed(stats.avgX, 2)} X · ${signed(stats.avgY, 2)} Y` : "run the test"}
          />
          <Stat label="Max deviation" value={stats ? pct(stats.maxDeviation, 2) : "—"} sub={`peak X ${stats ? pct(stats.peakX, 1) : "—"}`} />
          <Stat label="Deadzone needed" value={stats ? pct(stats.deadzoneNeeded, 2) : "—"} sub={`${stats?.samples ?? 0} samples`} />
        </div>
      </div>
    </Card>
  );
}
