import { useEffect, useMemo, useRef, useState } from "react";
import { ControllerArt } from "../components/ControllerArt";
import { artFamily } from "../lib/art";
import { Card, Chip, KeyValue } from "../components/ui";
import { effectiveButtons } from "../lib/live";
import { setRemap, useSettings } from "../lib/settings";
import {
  BUTTONS,
  buttonLabel,
  connectionLabel,
  isPlayStation,
  type DeviceInfo,
  type InputState,
} from "../lib/types";

interface Props {
  device: DeviceInfo | null;
  state: InputState | null;
}

export function Tester({ device, state }: Props) {
  const settings = useSettings();
  const pressed = effectiveButtons(state, device);
  const [selected, setSelected] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<string>("");
  const [held, setHeld] = useState<Record<string, number>>({});
  const [seenRaw, setSeenRaw] = useState<number[]>([]);
  const previous = useRef<Record<string, boolean>>({});
  const pressedAt = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!state) return;
    const prev = previous.current;
    const now = Date.now();
    for (const [name, isDown] of Object.entries(state.buttons)) {
      if (isDown && !prev[name]) {
        pressedAt.current[name] = now;
        setSelected(name);
        setLastEvent(`${buttonLabel(name, device?.family ?? "generic")} pressed`);
        setHeld((h) => ({ ...h, [name]: 0 }));
      }
      if (!isDown && prev[name]) {
        const since = pressedAt.current[name];
        const ms = since ? now - since : 0;
        setLastEvent(`${buttonLabel(name, device?.family ?? "generic")} released after ${ms} ms`);
        setHeld((h) => {
          const next = { ...h };
          delete next[name];
          return next;
        });
      }
    }
    if (state.raw.buttons.length) {
      setSeenRaw((seen) => {
        const merged = new Set(seen);
        state.raw.buttons.forEach((i) => merged.add(i));
        const next = Array.from(merged).sort((a, b) => a - b);
        return next.length === seen.length ? seen : next;
      });
    }
    previous.current = { ...state.buttons };
  }, [state, device?.family]);

  const pressedNames = useMemo(
    () => Object.entries(pressed).filter(([, v]) => v).map(([k]) => k),
    [pressed]
  );

  if (!device) return null;

  const label = (name: string) => buttonLabel(name, device.family);
  const remaps = settings.remaps[device.id] ?? {};
  const showMapping = device.backend === "hid" || device.family === "generic";
  const axes = state?.axes ?? { lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0 };

  return (
    <div className="tester-layout">
      <Card className="stage-card" pad={false}>
        <div className="stage pad-shared">
          <ControllerArt
            family={artFamily(device)}
            pressed={pressed}
            axes={axes}
            onSelect={(name) => setSelected(name)}
            selected={selected}
            label={`${device.name} test illustration`}
          />
        </div>
        <div className="stage-foot">
          <div className="stage-event">
            <span className="mini-label">Last input</span>
            <strong>{lastEvent || "Press any button"}</strong>
          </div>
          <div className="stage-held">
            {pressedNames.length ? (
              pressedNames.map((n) => (
                <span key={n} className="key">
                  {label(n)}
                </span>
              ))
            ) : (
              <span className="muted">Nothing held</span>
            )}
          </div>
        </div>
      </Card>

      <div className="stack">
        <Card title="Selected input" subtitle="Click any part of the pad or press it for real">
          {selected ? (
            <>
              <div className="selected-head">
                <div>
                  <div className="eyebrow">Physical button</div>
                  <h2 className="selected-title">{label(selected)}</h2>
                </div>
                <Chip tone={pressed[selected] ? "ok" : "neutral"}>
                  {pressed[selected] ? "Pressed" : "Released"}
                </Chip>
              </div>
              <KeyValue
                rows={[
                  ["Logical name", selected],
                  ["Current value", pressed[selected] ? "1 (down)" : "0 (up)"],
                  ["Raw indices in report", state?.raw.buttons.length ? state.raw.buttons.join(", ") : "none pressed"],
                  ["Report id", state ? `0x${state.raw.reportId.toString(16).toUpperCase()}` : "—"],
                  ["Packet", state ? String(state.packet) : "—"],
                  [
                    "Held",
                    held[selected] !== undefined
                      ? `${Math.max(0, Date.now() - (pressedAt.current[selected] ?? Date.now()))} ms`
                      : "not held",
                  ],
                ]}
              />
            </>
          ) : (
            <p className="muted">Press a button on the controller, or click one on the illustration.</p>
          )}
        </Card>

        <Card title="Live input monitor" subtitle="Normalised values straight from the device">
          <div className="axes-monitor">
            {(
              [
                ["Left stick X", axes.lx, -1, 1],
                ["Left stick Y", axes.ly, -1, 1],
                ["Right stick X", axes.rx, -1, 1],
                ["Right stick Y", axes.ry, -1, 1],
                ["Left trigger", axes.lt, 0, 1],
                ["Right trigger", axes.rt, 0, 1],
              ] as const
            ).map(([name, value, min, max]) => (
              <BipolarBar key={name} label={name} value={value} min={min} max={max} />
            ))}
          </div>
          <div className="button-wall">
            {BUTTONS.filter((b) => !["paddle"].includes(b)).map((name) => (
              <span key={name} className={`btn-pill${pressed[name] ? " on" : ""}`}>
                {label(name)}
              </span>
            ))}
          </div>
          <p className="footnote">
            {isPlayStation(device.family) ? "PlayStation" : "Xbox"} mapping ·{" "}
            {connectionLabel(device.connection)} · {device.backend === "xinput" ? "XInput" : "HID"}
          </p>
        </Card>

        {showMapping && (
          <Card
            title="Identify & remap"
            subtitle="For pads whose buttons land in the wrong place"
            actions={<Chip tone="info">{Object.keys(remaps).length} mapped</Chip>}
          >
            <p className="card-note">
              Press each button once. The raw index(es) it reports appear below — assign the right
              label and Driftbusters will treat that input as the chosen button everywhere.
            </p>
            <div className="remap-table">
              <div className="remap-head">
                <span>Raw index</span>
                <span>Detected now</span>
                <span>Assign to</span>
              </div>
              {(seenRaw.length ? seenRaw : [0, 1, 2, 3]).map((index) => (
                <div className="remap-row" key={index}>
                  <span className="mono">{index}</span>
                  <span>{state?.raw.buttons.includes(index) ? <Chip tone="ok">pressed</Chip> : <span className="muted">—</span>}</span>
                  <select
                    value={remaps[String(index)] ?? ""}
                    onChange={(e) => setRemap(device.id, index, e.target.value || null)}
                  >
                    <option value="">Not remapped</option>
                    {BUTTONS.map((b) => (
                      <option key={b} value={b}>
                        {b} — {label(b)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {!seenRaw.length && <p className="muted small">No raw indices seen yet — press a button.</p>}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function BipolarBar({
  label,
  value,
  min,
  max,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
}) {
  const span = max - min;
  const percent = Math.max(0, Math.min(100, ((value - min) / span) * 100));
  const zero = ((-min) / span) * 100;
  const left = Math.min(zero, percent);
  const width = Math.abs(percent - zero);
  return (
    <div className="bipolar">
      <div className="bar-head">
        <span>{label}</span>
        <span className="bar-value mono">
          {max === 1 && min === -1 ? `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%` : `${(value * 100).toFixed(0)}%`}
        </span>
      </div>
      <div className="bipolar-track">
        <div className="bipolar-zero" style={{ left: `${zero}%` }} />
        <div className="bipolar-fill" style={{ left: `${left}%`, width: `${width}%` }} />
      </div>
    </div>
  );
}

