import { useEffect, useState } from "react";
import { Card, Chip, KeyValue, SectionTitle } from "../components/ui";
import { appInfo } from "../lib/history";
import { getSettings, resetSettings, updateSettings, useSettings } from "../lib/settings";

export function SettingsScreen() {
  const settings = useSettings();
  const [info, setInfo] = useState<Record<string, unknown>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void appInfo().then(setInfo);
  }, []);

  const touch = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };

  const remapCount = Object.values(settings.remaps).reduce(
    (total, device) => total + Object.keys(device).length,
    0
  );

  return (
    <div className="stack">
      <div className="grid-2">
        <Card title="Drift thresholds" subtitle="How Driftbusters separates noise from real drift">
          <label className="slider">
            <div className="slider-head">
              <span>Sensor noise floor</span>
              <strong>{settings.noiseThreshold.toFixed(1)}%</strong>
            </div>
            <input
              type="range"
              min={0.5}
              max={10}
              step={0.5}
              value={settings.noiseThreshold}
              onChange={(e) => {
                updateSettings({ noiseThreshold: Number(e.target.value) });
                touch();
              }}
            />
            <p className="slider-hint">
              Resting jitter below this is treated as normal sensor noise rather than drift.
            </p>
          </label>

          <label className="slider">
            <div className="slider-head">
              <span>Drift threshold</span>
              <strong>{settings.driftThreshold.toFixed(1)}%</strong>
            </div>
            <input
              type="range"
              min={1}
              max={15}
              step={0.5}
              value={settings.driftThreshold}
              onChange={(e) => {
                updateSettings({ driftThreshold: Number(e.target.value) });
                touch();
              }}
            />
            <p className="slider-hint">
              A stick whose average resting offset exceeds this is reported as drifting.
            </p>
          </label>

          <label className="slider">
            <div className="slider-head">
              <span>Reference deadzone</span>
              <strong>{settings.deadzone.toFixed(1)}%</strong>
            </div>
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={settings.deadzone}
              onChange={(e) => {
                updateSettings({ deadzone: Number(e.target.value) });
                touch();
              }}
            />
            <p className="slider-hint">
              Drawn on the drift graphs so you can see how much of the movement a game would ignore.
            </p>
          </label>

          {saved && <Chip tone="ok">Saved</Chip>}
        </Card>

        <Card title="Test behaviour" subtitle="Applies to the next run">
          <label className="slider">
            <div className="slider-head">
              <span>Drift test length</span>
              <strong>{settings.sampleSeconds}s</strong>
            </div>
            <input
              type="range"
              min={5}
              max={30}
              step={1}
              value={settings.sampleSeconds}
              onChange={(e) => updateSettings({ sampleSeconds: Number(e.target.value) })}
            />
          </label>

          <div className="setting-row">
            <div>
              <strong>Motion effects</strong>
              <p>Panel transitions, the controller zoom between screens and press animations.</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={!settings.reduceMotion}
                onChange={(e) => updateSettings({ reduceMotion: !e.target.checked })}
              />
              <span />
            </label>
          </div>

          <div className="setting-row">
            <div>
              <strong>Show raw data by default</strong>
              <p>Open the advanced monitor with the hex report already visible.</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.showRaw}
                onChange={(e) => updateSettings({ showRaw: e.target.checked })}
              />
              <span />
            </label>
          </div>

          <div className="setting-row">
            <div>
              <strong>Controller illustration</strong>
              <p>Auto uses the model Windows reports. Override it if your pad looks different.</p>
            </div>
            <select
              value={settings.artOverride}
              onChange={(e) => updateSettings({ artOverride: e.target.value as typeof settings.artOverride })}
            >
              <option value="auto">Auto (detected)</option>
              <option value="xbox360">Xbox 360</option>
              <option value="xboxone">Xbox One</option>
              <option value="xboxseries">Xbox Series X|S</option>
              <option value="dualshock4">DualShock 4</option>
              <option value="dualsense">DualSense</option>
            </select>
          </div>

          <div className="setting-row">
            <div>
              <strong>Illustration for unknown pads</strong>
              <p>Generic HID controllers use this body shape until remapped.</p>
            </div>
            <select
              value={settings.genericArt}
              onChange={(e) => updateSettings({ genericArt: e.target.value as "playstation" | "xbox" })}
            >
              <option value="xbox">Xbox style</option>
              <option value="playstation">PlayStation style</option>
            </select>
          </div>

          <SectionTitle>Remapping</SectionTitle>
          <div className="setting-row">
            <div>
              <strong>{remapCount} custom mappings</strong>
              <p>Saved per controller so unusual pads keep working after a restart.</p>
            </div>
            <button className="btn ghost small" onClick={() => updateSettings({ remaps: {} })}>
              Clear mappings
            </button>
          </div>
        </Card>
      </div>

      <div className="grid-2">
        <Card title="About" subtitle="Build information">
          <KeyValue
            rows={[
              ["Application", String(info.name ?? "Driftbusters")],
              ["Version", String(info.version ?? "1.0.0")],
              ["Platform", `${String(info.platform ?? "windows")} · ${String(info.arch ?? "x86_64")}`],
              ["Input APIs", Array.isArray(info.inputApis) ? (info.inputApis as string[]).join(", ") : "XInput, Windows HID"],
              ["Report storage", String(info.dataDirectory ?? "%APPDATA%\\com.driftbusters.app")],
              ["Build type", info.portable ? "Portable — data beside the exe" : "Installed for this user"],
              ["Internet required", "No — fully offline"],
            ]}
          />
        </Card>

        <Card title="Reset" subtitle="Return every setting to its default">
          <p className="muted">
            This clears thresholds, test length, display options and all custom button mappings. Saved
            reports are kept.
          </p>
          <button
            className="btn danger"
            onClick={() => {
              resetSettings();
              touch();
            }}
          >
            Reset settings to defaults
          </button>
          <p className="footnote">
            Current thresholds: noise {getSettings().noiseThreshold}% · drift {getSettings().driftThreshold}% ·
            deadzone {getSettings().deadzone}%
          </p>
        </Card>
      </div>

      <Card title="Known limits on Windows" subtitle="Stated plainly so no reading is misread">
        <ul className="plain-list">
          <li>
            <strong>XInput</strong> reports Xbox pads as a fixed structure: 4 axes, 2 triggers, 16 buttons.
            The Guide button is read through the undocumented XInputGetStateEx entry point and may be
            unavailable on old drivers.
          </li>
          <li>
            <strong>HID</strong> gives the exact bytes for PlayStation and generic pads, but Windows does
            not expose Bluetooth vs USB for every device — the connection type falls back to “unknown”
            rather than guessing.
          </li>
          <li>
            <strong>Battery</strong> is only shown when the device actually reports it: DualShock 4,
            DualSense and XInput wireless pads do; wired generic pads usually do not.
          </li>
          <li>
            <strong>Touchpad, motion and adaptive-trigger data</strong> are not read; the report covers
            buttons, sticks and triggers only.
          </li>
        </ul>
      </Card>
    </div>
  );
}
