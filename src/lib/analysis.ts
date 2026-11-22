import type { Axis } from "./analysis-types";

export type { Axis };

export interface Sample {
  t: number;
  x: number;
  y: number;
}

export interface DriftStats {
  samples: number;
  durationMs: number;
  avgX: number;
  avgY: number;
  magnitude: number;
  maxDeviation: number;
  avgDeviation: number;
  deadzoneNeeded: number;
  spreadX: number;
  spreadY: number;
  peakX: number;
  peakY: number;
  verdict: "ok" | "marginal" | "drift";
}

export interface TriggerStats {
  samples: number;
  min: number;
  max: number;
  finalValue: number;
  peakStep: number;
  smoothness: number;
  rangeOk: boolean;
  returnsToZero: boolean;
  stuck: boolean;
}

export interface ButtonTestResult {
  button: string;
  label: string;
  tested: boolean;
  presses: number;
  released: boolean;
  responseMs: number | null;
  duplicates: number;
  status: "pass" | "warn" | "fail" | "untested";
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = clamp01(p) * (sorted.length - 1);
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

/** Drift statistics in percent of full stick travel. */
export function driftStats(samples: Sample[], noise: number, drift: number): DriftStats {
  if (!samples.length) {
    return {
      samples: 0,
      durationMs: 0,
      avgX: 0,
      avgY: 0,
      magnitude: 0,
      maxDeviation: 0,
      avgDeviation: 0,
      deadzoneNeeded: 0,
      spreadX: 0,
      spreadY: 0,
      peakX: 0,
      peakY: 0,
      verdict: "ok",
    };
  }

  const xs = samples.map((s) => s.x * 100);
  const ys = samples.map((s) => s.y * 100);
  const deviations = samples.map((s) => Math.hypot(s.x, s.y) * 100);
  const avgX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;
  const magnitude = Math.hypot(avgX, avgY);
  const maxDeviation = Math.max(...deviations);
  const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length;
  const deadzoneNeeded = percentile(deviations, 0.99);
  const spreadX = Math.max(...xs) - Math.min(...xs);
  const spreadY = Math.max(...ys) - Math.min(...ys);

  let verdict: DriftStats["verdict"] = "ok";
  if (magnitude > drift || maxDeviation > drift * 1.6) verdict = "drift";
  else if (magnitude > noise || maxDeviation > drift) verdict = "marginal";

  return {
    samples: samples.length,
    durationMs: samples[samples.length - 1].t - samples[0].t,
    avgX,
    avgY,
    magnitude,
    maxDeviation,
    avgDeviation,
    deadzoneNeeded,
    spreadX,
    spreadY,
    peakX: Math.max(Math.abs(Math.min(...xs)), Math.max(...xs)),
    peakY: Math.max(Math.abs(Math.min(...ys)), Math.max(...ys)),
    verdict,
  };
}

export function triggerStats(values: number[]): TriggerStats {
  if (!values.length) {
    return {
      samples: 0,
      min: 0,
      max: 0,
      finalValue: 0,
      peakStep: 0,
      smoothness: 0,
      rangeOk: false,
      returnsToZero: false,
      stuck: false,
    };
  }
  let peakStep = 0;
  for (let i = 1; i < values.length; i++) {
    peakStep = Math.max(peakStep, Math.abs(values[i] - values[i - 1]));
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const finalValue = values[values.length - 1];
  const rangeOk = max >= 0.9 && min <= 0.08;
  const returnsToZero = finalValue <= 0.05;
  // A perfectly smooth sweep advances by small, even steps; gaps and spikes reduce the score.
  const smoothness = Math.round(Math.max(0, 100 - peakStep * 220));
  return {
    samples: values.length,
    min,
    max,
    finalValue,
    peakStep,
    smoothness,
    rangeOk,
    returnsToZero,
    stuck: max > 0.2 && min > 0.2,
  };
}

export interface HealthInput {
  drift?: { left: DriftStats; right: DriftStats };
  triggers?: { lt: TriggerStats; rt: TriggerStats };
  buttons?: ButtonTestResult[];
  batteryLevel?: number | null;
}

export interface HealthSummary {
  score: number;
  grade: "Excellent" | "Good" | "Fair" | "Poor";
  issues: string[];
  summary: string;
}

export function health({ drift, triggers, buttons, batteryLevel }: HealthInput): HealthSummary {
  let score = 100;
  const issues: string[] = [];

  if (drift) {
    for (const [side, stats] of [
      ["left", drift.left],
      ["right", drift.right],
    ] as const) {
      if (stats.samples === 0) continue;
      const penalty =
        stats.verdict === "drift"
          ? Math.min(22, 10 + stats.magnitude)
          : stats.verdict === "marginal"
            ? Math.min(10, 4 + stats.magnitude)
            : 0;
      score -= penalty;
      if (stats.verdict !== "ok") {
        issues.push(
          `${side === "left" ? "Left" : "Right"} stick offset ${stats.magnitude.toFixed(1)}% (${stats.verdict})`
        );
      }
    }
  }

  if (triggers) {
    for (const [name, stats] of [
      ["Left trigger", triggers.lt],
      ["Right trigger", triggers.rt],
    ] as const) {
      if (!stats.samples) continue;
      if (stats.stuck) {
        score -= 18;
        issues.push(`${name} looks stuck at ${(stats.min * 100).toFixed(0)}%`);
      } else if (!stats.rangeOk) {
        score -= 8;
        issues.push(
          `${name} range incomplete (${(stats.max * 100).toFixed(0)}% max, ${(stats.min * 100).toFixed(0)}% min)`
        );
      }
      if (!stats.returnsToZero) {
        score -= 6;
        issues.push(`${name} does not return fully to rest`);
      }
      if (stats.smoothness < 55 && stats.samples > 12) {
        score -= 4;
        issues.push(`${name} response is uneven (smoothness ${stats.smoothness}%)`);
      }
    }
  }

  if (buttons && buttons.length) {
    const failed = buttons.filter((b) => b.status === "fail");
    const warned = buttons.filter((b) => b.status === "warn");
    score -= failed.length * 9;
    score -= warned.length * 3;
    failed.forEach((b) => issues.push(`${b.label} did not respond`));
    warned.forEach((b) => issues.push(`${b.label} responded inconsistently`));
  }

  if (batteryLevel !== null && batteryLevel !== undefined && batteryLevel <= 15) {
    issues.push(`Battery low (${batteryLevel}%)`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade =
    score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 55 ? "Fair" : "Poor";
  const summary =
    issues.length === 0
      ? "All tested inputs responded cleanly. No hardware faults were detected in this session."
      : `${issues.length} point${issues.length === 1 ? "" : "s"} of concern found. See the issue list for the affected inputs.`;
  return { score, grade, issues, summary };
}

export function scoreTone(score: number): "ok" | "warn" | "bad" {
  return score >= 85 ? "ok" : score >= 65 ? "warn" : "bad";
}

export interface Range {
  min: number;
  max: number;
  observed: number;
}

export function normalizeAxis(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

/** Stick distance from centre in percent. */
export function magnitude(x: number, y: number): number {
  return Math.hypot(x, y) * 100;
}
