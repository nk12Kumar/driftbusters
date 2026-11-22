import { useEffect, useRef } from "react";

export interface Series {
  values: number[];
  color: string;
  width?: number;
  fill?: boolean;
}

interface Props {
  series: Series[];
  yMin?: number;
  yMax?: number;
  height?: number;
  grid?: number;
  className?: string;
}

/**
 * Lightweight canvas trace. Redrawn on every data change; cheap enough for
 * 30 Hz live data because it only draws polylines.
 */
export function TraceChart({ series, yMin = 0, yMax = 1, height = 120, grid = 4, className }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 600;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= grid; i++) {
      const y = (height / grid) * i;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
      ctx.stroke();
    }
    for (let i = 0; i <= 8; i++) {
      const x = (width / 8) * i;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
      ctx.stroke();
    }

    const span = yMax - yMin || 1;
    const toY = (v: number) => height - ((v - yMin) / span) * height;

    for (const s of series) {
      if (s.values.length < 2) continue;
      const step = width / Math.max(1, s.values.length - 1);
      if (s.fill) {
        ctx.beginPath();
        ctx.moveTo(0, height);
        s.values.forEach((v, i) => ctx.lineTo(i * step, toY(v)));
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fillStyle = `${s.color}22`;
        ctx.fill();
      }
      ctx.beginPath();
      s.values.forEach((v, i) => {
        const x = i * step;
        const y = toY(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width ?? 1.6;
      ctx.lineJoin = "round";
      ctx.stroke();
    }
  }, [series, yMin, yMax, height, grid]);

  return <canvas ref={ref} className={className ?? "trace"} style={{ height }} />;
}
