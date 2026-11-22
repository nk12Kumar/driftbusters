import { useMemo, useRef } from "react";
import { DEFAULT_POINTS, PHOTOS, type Point } from "../lib/photos";
import { useSettings } from "../lib/settings";
import { buttonLabel, type DeviceInfo, type Family } from "../lib/types";

interface Props {
  family: Family;
  device?: DeviceInfo | null;
  pressed: Record<string, boolean>;
  selected?: string | null;
  onSelect?: (button: string) => void;
  label?: string;
  /** When set, clicks on the image report a normalised point for this control. */
  calibrating?: string | null;
  onCalibratePoint?: (point: Point) => void;
}

/** Real product photo of the controller with interactive hotspots on top. */
export function PhotoPad({
  family,
  device,
  pressed,
  selected,
  onSelect,
  label,
  calibrating,
  onCalibratePoint,
}: Props) {
  const settings = useSettings();
  const src = PHOTOS[family];
  const wrap = useRef<HTMLDivElement | null>(null);

  const points = useMemo(() => {
    const custom = settings.photoCalib?.[family] ?? {};
    return { ...(DEFAULT_POINTS[family] ?? {}), ...custom } as Record<string, Point>;
  }, [family, settings.photoCalib]);

  if (!src) return null;

  const capture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!calibrating || !onCalibratePoint) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onCalibratePoint({
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    });
  };

  const pretty = (name: string) => buttonLabel(name, family);

  return (
    <div className={`photo-pad${calibrating ? " calibrating" : ""}`} ref={wrap}>
      <div className="photo-frame" onClick={capture}>
        <img src={src} alt={label ?? device?.name ?? "Controller"} draggable={false} />
        {Object.entries(points).map(([name, point]) => {
          const down = !!pressed[name];
          const isTarget = calibrating === name;
          return (
            <button
              key={name}
              type="button"
              className={`hotspot${down ? " on" : ""}${selected === name ? " sel" : ""}${isTarget ? " target" : ""}`}
              style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(name);
              }}
              aria-label={pretty(name)}
              title={pretty(name)}
            >
              <span className="hotspot-ring" />
              <span className="hotspot-label">{pretty(name)}</span>
            </button>
          );
        })}
      </div>
      {calibrating && (
        <div className="calibrate-hint">
          Click <strong>{pretty(calibrating)}</strong> on the photo
        </div>
      )}
    </div>
  );
}
