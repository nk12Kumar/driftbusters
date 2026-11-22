import { useEffect, useRef, useState } from "react";
import { TraceChart } from "../components/TraceChart";
import { Bar, Card, Chip, KeyValue, Stat } from "../components/ui";
import { triggerStats, type TriggerStats } from "../lib/analysis";
import { live } from "../lib/live";
import { session, useSession } from "../lib/session";
import { saveCurrentReport } from "../lib/actions";
import { pct } from "../lib/format";
import type { DeviceInfo, InputState } from "../lib/types";

interface Props {
  device: DeviceInfo | null;
  state: InputState | null;
}

export function Triggers({ device, state }: Props) {
  const data = useSession();
  const [history, setHistory] = useState({ lt: [] as number[], rt: [] as number[] });
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState<{ lt: TriggerStats; rt: TriggerStats } | null>(
    data.triggers ?? null
  );
  const [savedNote, setSavedNote] = useState("");
  const recorded = useRef<{ lt: number[]; rt: number[] }>({ lt: [], rt: [] });
  const recordingRef = useRef(false);
  const timerRef = useRef(0);
  const deviceRef = useRef<string | null>(device?.id ?? null);
  deviceRef.current = device?.id ?? null;

  useEffect(() => {
    const id = window.setInterval(() => {
      const deviceId = deviceRef.current;
      if (!deviceId) return;
      const snapshot = live.state(deviceId);
      if (!snapshot) return;
      const { lt, rt } = snapshot.axes;
      setHistory((h) => ({
        lt: [...h.lt.slice(-239), lt],
        rt: [...h.rt.slice(-239), rt],
      }));
      if (recordingRef.current) {
        recorded.current.lt.push(lt);
        recorded.current.rt.push(rt);
      }
    }, 40);
    return () => window.clearInterval(id);
  }, []);

  const finish = () => {
    recordingRef.current = false;
    setRecording(false);
    window.clearTimeout(timerRef.current);
    const stats = {
      lt: triggerStats(recorded.current.lt),
      rt: triggerStats(recorded.current.rt),
    };
    setResult(stats);
    session.setTriggers(stats);
  };

  const start = () => {
    recorded.current = { lt: [], rt: [] };
    setResult(null);
    recordingRef.current = true;
    setRecording(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(finish, 15000);
  };

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const axes = state?.axes ?? { lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0 };

  return (
    <div className="stack">
      <Card
        title="Trigger sweep"
        subtitle="Press each trigger slowly from rest to the stop, then let go"
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
            {recording ? (
              <button className="btn" onClick={finish}>
                Finish recording
              </button>
            ) : (
              <button className="btn primary" onClick={start} disabled={!device}>
                Start recording (15s)
              </button>
            )}
          </div>
        }
      >
        {savedNote && <p className="note">{savedNote}</p>}
        <div className="trigger-guide">
          <p>
            A healthy trigger starts near 0%, reaches at least 90%, and springs back to 0%. The
            recording captures the analogue curve of both triggers at once, so you can sweep left,
            then right, inside the window.
          </p>
          <div className="guide-steps">
            <span>1. Press slowly</span>
            <span>2. Hold at the stop</span>
            <span>3. Release fully</span>
          </div>
        </div>
        <div className="grid-2 trigger-grid">
          <TriggerPanel
            label="Left trigger"
            value={axes.lt}
            stats={result?.lt ?? null}
            series={history.lt}
            tone="mint"
          />
          <TriggerPanel
            label="Right trigger"
            value={axes.rt}
            stats={result?.rt ?? null}
            series={history.rt}
            tone="violet"
          />
        </div>
      </Card>

      <div className="grid-2">
        <Card title="Live response" subtitle="Both triggers, last few seconds">
          <TraceChart
            series={[
              { values: history.lt, color: "#3BE8B0", width: 1.6, fill: true },
              { values: history.rt, color: "#7C5CFF", width: 1.6, fill: true },
            ]}
            yMin={0}
            yMax={1}
            height={160}
          />
          <div className="legend">
            <span><i style={{ background: "#3BE8B0" }} /> Left</span>
            <span><i style={{ background: "#7C5CFF" }} /> Right</span>
          </div>
        </Card>

        <Card title="Measurement detail" subtitle="From the last recording">
          {result ? (
            <KeyValue
              rows={[
                ["Left range", `${pct(result.lt.min * 100, 0)} → ${pct(result.lt.max * 100, 0)}`],
                ["Right range", `${pct(result.rt.min * 100, 0)} → ${pct(result.rt.max * 100, 0)}`],
                ["Return to rest", `${result.lt.returnsToZero ? "left yes" : "left no"} · ${result.rt.returnsToZero ? "right yes" : "right no"}`],
                ["Smoothness", `${result.lt.smoothness}% · ${result.rt.smoothness}%`],
                ["Largest step", `${(result.lt.peakStep * 100).toFixed(1)}% · ${(result.rt.peakStep * 100).toFixed(1)}%`],
                ["Stuck detection", result.lt.stuck || result.rt.stuck ? "possible stuck trigger" : "no stuck trigger seen"],
                ["Samples", `${result.lt.samples} / ${result.rt.samples}`],
              ]}
            />
          ) : (
            <p className="muted">Record a sweep to populate the measurement detail.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function TriggerPanel({
  label,
  value,
  stats,
  series,
  tone,
}: {
  label: string;
  value: number;
  stats: TriggerStats | null;
  series: number[];
  tone: "mint" | "violet";
}) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const verdict = stats?.stuck
    ? "Stuck"
    : stats
      ? stats.rangeOk && stats.returnsToZero
        ? "Healthy"
        : "Check range"
      : value > 0.05
        ? "Pressed"
        : "At rest";
  const chipTone = stats?.stuck || (stats && !stats.rangeOk) ? "bad" : stats ? "ok" : "neutral";

  return (
    <div className={`trigger-panel ${tone}`}>
      <div className="trigger-head">
        <span className="mini-label">{label}</span>
        <Chip tone={chipTone}>{verdict}</Chip>
      </div>
      <div className="trigger-gauge">
        <div className="gauge-track">
          <div className="gauge-fill" style={{ height: `${percent}%` }} />
          {stats && (
            <>
              <div className="gauge-marker max" style={{ bottom: `${stats.max * 100}%` }} title="recorded maximum" />
              <div className="gauge-marker min" style={{ bottom: `${stats.min * 100}%` }} title="recorded minimum" />
            </>
          )}
        </div>
        <div className="gauge-value">
          <strong>{percent}%</strong>
          <span className="mono">raw {Math.round(value * 255)} / 255</span>
        </div>
      </div>
      <div className="trigger-stats">
        <Stat label="Recorded min" value={stats ? pct(stats.min * 100, 0) : "—"} />
        <Stat label="Recorded max" value={stats ? pct(stats.max * 100, 0) : "—"} />
        <Stat label="Return" value={stats ? (stats.returnsToZero ? "to zero" : "incomplete") : "—"} />
        <Stat label="Smoothness" value={stats ? `${stats.smoothness}%` : "—"} />
      </div>
      <Bar value={series.length ? series[series.length - 1] : value} label="Last sample" valueLabel={pct((series.at(-1) ?? value) * 100, 0)} />
    </div>
  );
}
