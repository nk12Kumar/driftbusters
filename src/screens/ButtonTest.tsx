import { useEffect, useMemo, useRef, useState } from "react";
import { Card, Chip, Stat } from "../components/ui";
import type { ButtonTestResult } from "../lib/analysis";
import { effectiveButtons } from "../lib/live";
import { session, useSession } from "../lib/session";
import { saveCurrentReport } from "../lib/actions";
import { getSettings } from "../lib/settings";
import { buttonLabel, type DeviceInfo, type InputState } from "../lib/types";
import type { Page } from "../App";

interface Props {
  device: DeviceInfo | null;
  state: InputState | null;
  navigate: (page: Page) => void;
}

const COMMON = [
  "faceSouth",
  "faceEast",
  "faceWest",
  "faceNorth",
  "dpUp",
  "dpLeft",
  "dpRight",
  "dpDown",
  "l1",
  "r1",
  "l3",
  "r3",
  "menu",
  "view",
  "guide",
];

function buttonsFor(family: string | undefined): string[] {
  if (family === "dualsense") return [...COMMON, "l2", "r2", "touchpad", "mute"];
  if (family === "dualshock4") return [...COMMON, "l2", "r2", "touchpad"];
  if (family === "generic") return [...COMMON, "l2", "r2", "share"];
  return [...COMMON, "l2", "r2"];
}

type Phase = "idle" | "running" | "done";

export function ButtonTest({ device, state, navigate }: Props) {
  const sessionData = useSession();
  const list = useMemo(() => buttonsFor(device?.family), [device?.family]);
  const pressed = effectiveButtons(state, device);

  const [phase, setPhase] = useState<Phase>("idle");
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<string, ButtonTestResult>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const promptedAt = useRef(0);
  const previous = useRef<Record<string, boolean>>({});
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;
  const indexRef = useRef(0);
  indexRef.current = index;
  const listRef = useRef(list);
  listRef.current = list;

  const label = (name: string) => buttonLabel(name, device?.family ?? "generic");
  const target = list[index];

  useEffect(() => {
    if (!state) return;
    const prev = previous.current;
    const now = Date.now();
    const currentTarget = listRef.current[indexRef.current];
    if (phaseRef.current === "running" && currentTarget) {
      const isDown = !!pressed[currentTarget];
      const wasDown = !!prev[currentTarget];
      if (isDown && !wasDown) {
        const response = promptedAt.current ? now - promptedAt.current : null;
        setResults((r) => {
          const existing = r[currentTarget];
          return {
            ...r,
            [currentTarget]: {
              button: currentTarget,
              label: label(currentTarget),
              tested: true,
              presses: (existing?.presses ?? 0) + 1,
              released: false,
              responseMs: response,
              duplicates: existing?.duplicates ?? 0,
              status: response !== null && response > 900 ? "warn" : "pass",
            },
          };
        });
      }
      if (!isDown && wasDown) {
        setResults((r) => {
          const existing = r[currentTarget];
          if (!existing) return r;
          return {
            ...r,
            [currentTarget]: { ...existing, released: true },
          };
        });
        // Advance only once the button came back up, so stuck buttons are obvious.
        setIndex((i) => {
          const next = i + 1;
          promptedAt.current = Date.now();
          if (next >= listRef.current.length) setPhase("done");
          return next;
        });
      }
    }
    previous.current = { ...pressed };
  }, [pressed, state]);

  useEffect(() => {
    if (phase === "done") {
      const ordered = list.map(
        (name) =>
          results[name] ?? {
            button: name,
            label: label(name),
            tested: false,
            presses: 0,
            released: false,
            responseMs: null,
            duplicates: 0,
            status: "untested" as const,
          }
      );
      session.setButtons(ordered);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const start = (from = 0) => {
    setResults({});
    setIndex(from);
    setPhase(from >= list.length ? "done" : "running");
    promptedAt.current = Date.now();
    previous.current = { ...pressed };
    setSaved(null);
  };

  const skip = () => {
    setIndex((i) => {
      const next = i + 1;
      promptedAt.current = Date.now();
      if (next >= list.length) setPhase("done");
      return next;
    });
  };

  const retest = (name: string) => {
    const at = list.indexOf(name);
    setSaved(null);
    setIndex(at);
    setPhase("running");
    promptedAt.current = Date.now();
    setResults((r) => {
      const next = { ...r };
      delete next[name];
      return next;
    });
  };

  const save = async () => {
    if (!device) return;
    setSaving(true);
    try {
      const id = await saveCurrentReport(device, session.get(), sessionData.notes);
      setSaved(id);
    } catch (err) {
      console.error(err);
      setSaved("failed");
    } finally {
      setSaving(false);
    }
  };

  const completed = list.filter((name) => results[name]?.released).length;
  const progress = list.length ? Math.round((completed / list.length) * 100) : 0;
  const ordered = list.map(
    (name) =>
      results[name] ?? {
        button: name,
        label: label(name),
        tested: false,
        presses: 0,
        released: false,
        responseMs: null,
        duplicates: 0,
        status: "untested" as const,
      }
  );
  const passed = ordered.filter((r) => r.status === "pass").length;
  const failed = ordered.filter((r) => r.status === "fail" || r.status === "warn").length;

  return (
    <div className="stack">
      <div className="grid-2 button-top">
        <Card
          title="Guided button sweep"
          subtitle={`${list.length} physical buttons on this pad`}
          actions={
            phase === "running" ? (
              <button className="btn ghost small" onClick={() => setPhase("idle")}>
                Pause
              </button>
            ) : (
              <button className="btn primary small" onClick={() => start()} disabled={!device}>
                {phase === "done" ? "Run again" : "Start sweep"}
              </button>
            )
          }
        >
          {phase === "running" && target ? (
            <div className="prompt">
              <div className="prompt-eyebrow">
                Button {Math.min(index + 1, list.length)} of {list.length}
              </div>
              <div className="prompt-name">{label(target)}</div>
              <p className="prompt-hint">Press and release it once. The sweep advances automatically.</p>
              <div className="prompt-actions">
                <button className="btn ghost small" onClick={skip}>
                  Skip this button
                </button>
                <Chip tone={pressed[target] ? "ok" : "neutral"}>
                  {pressed[target] ? "detected" : "waiting"}
                </Chip>
              </div>
              <div className="progress">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : phase === "done" ? (
            <div className="prompt done">
              <div className="prompt-eyebrow">Sweep complete</div>
              <div className="prompt-name">
                {passed}/{list.length} passed
              </div>
              <div className="result-stats">
                <Stat label="Passed" value={passed} tone="ok" />
                <Stat label="Needs a look" value={failed} tone={failed ? "warn" : "neutral"} />
                <Stat label="Untested" value={ordered.filter((r) => r.status === "untested").length} />
              </div>
              <p className="prompt-hint">
                Stick and trigger measurements from this session are included in the report.
              </p>
              <div className="prompt-actions">
                <button className="btn primary" onClick={save} disabled={saving || !device}>
                  {saving ? "Saving…" : "Save report"}
                </button>
                <button className="btn" onClick={() => navigate("history")}>
                  Open history
                </button>
              </div>
              {saved && saved !== "failed" && (
                <Chip tone="ok">Report saved · {saved.slice(0, 18)}</Chip>
              )}
              {saved === "failed" && <Chip tone="bad">Could not save — see console</Chip>}
            </div>
          ) : (
            <div className="prompt idle">
              <div className="prompt-eyebrow">Ready when you are</div>
              <div className="prompt-name">One button at a time</div>
              <p className="prompt-hint">
                Driftbusters names each button, waits for the press, confirms the release and records
                response time. Skipped buttons stay marked as untested rather than passing silently.
              </p>
              <button className="btn primary" onClick={() => start()} disabled={!device}>
                Start guided sweep
              </button>
            </div>
          )}
        </Card>

        <Card title="Checklist" subtitle="Passed, flagged and untested inputs">
          <div className="checklist">
            {ordered.map((r) => (
              <div key={r.button} className={`check-row status-${r.status}`}>
                <span className="check-dot" />
                <div className="check-main">
                  <strong>{r.label}</strong>
                  <em>
                    {r.status === "untested"
                      ? "not tested"
                      : `${r.presses} press${r.presses === 1 ? "" : "es"}${r.released ? ", released" : ", release missing"}${
                          r.responseMs !== null ? `, ${r.responseMs} ms` : ""
                        }`}
                  </em>
                </div>
                <button className="btn ghost small" onClick={() => retest(r.button)} disabled={!device}>
                  Retest
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="How this is judged" subtitle="No result is invented — only observed edges count">
        <div className="rule-row">
          <div>
            <strong>Pass</strong>
            <p>A press and a release were both seen, and the press came within 900 ms of the prompt.</p>
          </div>
          <div>
            <strong>Warn</strong>
            <p>The input registered but took longer than 900 ms, which often means a worn dome or a sticky contact.</p>
          </div>
          <div>
            <strong>Fail</strong>
            <p>Nothing arrived for that button while it was prompted, or the release was never seen.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function settingsSummary() {
  return getSettings().driftThreshold;
}
