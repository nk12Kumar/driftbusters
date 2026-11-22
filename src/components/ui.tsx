import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = "",
  pad = true,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <p className="card-sub">{subtitle}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      <div className={pad ? "card-body" : ""}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  return (
    <div className={`stat tone-${tone}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

export function Chip({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "ok" | "warn" | "bad" | "info";
  children: ReactNode;
}) {
  return <span className={`chip ${tone}`}>{children}</span>;
}

export function Bar({
  value,
  max = 1,
  tone = "ok",
  label,
  valueLabel,
}: {
  value: number;
  max?: number;
  tone?: "ok" | "warn" | "bad" | "info";
  label?: string;
  valueLabel?: string;
}) {
  const percent = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className="bar">
      {(label || valueLabel) && (
        <div className="bar-head">
          <span>{label}</span>
          <span className="bar-value">{valueLabel}</span>
        </div>
      )}
      <div className="bar-track">
        <div className={`bar-fill ${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="section-title">{children}</h3>;
}

export function KeyValue({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div key={k} className="kv-row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
