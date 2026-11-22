export function pct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function signed(value: number, digits = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function hex(value: number, width = 2): string {
  return value.toString(16).toUpperCase().padStart(width, "0");
}

export function hexDump(bytes: number[]): string {
  return bytes.map((b) => hex(b)).join(" ");
}

export function toneFor(verdict: "ok" | "marginal" | "drift"): "ok" | "warn" | "bad" {
  return verdict === "ok" ? "ok" : verdict === "marginal" ? "warn" : "bad";
}
