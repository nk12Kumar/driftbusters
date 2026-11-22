interface Props {
  x: number;
  y: number;
  trail: { x: number; y: number }[];
  deadzone: number;
  maxDeviation: number;
  label: string;
  sublabel?: string;
  size?: number;
}

/** Large XY plot for one analogue stick, with trail, deadzone ring and peak ring. */
export function StickGraph({
  x,
  y,
  trail,
  deadzone,
  maxDeviation,
  label,
  sublabel,
  size = 300,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const scale = (size / 2 - 26) / 1;
  const px = (v: number) => cx + v * scale;
  const py = (v: number) => cy - v * scale;
  const dist = Math.hypot(x, y);
  const peak = Math.min(1.2, maxDeviation / 100);

  return (
    <div className="stick-graph">
      <div className="stick-graph-head">
        <span className="stick-graph-label">{label}</span>
        {sublabel && <span className="stick-graph-sub">{sublabel}</span>}
      </div>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" role="img" aria-label={`${label} position`}>
        <defs>
          <radialGradient id={`glow-${label}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width={size} height={size} rx="18" fill="rgba(255,255,255,0.02)" />
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <circle
            key={r}
            cx={cx}
            cy={cy}
            r={scale * r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray={r === 1 ? "0" : "3 5"}
          />
        ))}
        <line x1={cx} y1={14} x2={cx} y2={size - 14} stroke="rgba(255,255,255,0.10)" />
        <line x1={14} y1={cy} x2={size - 14} y2={cy} stroke="rgba(255,255,255,0.10)" />

        {deadzone > 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={scale * Math.min(0.4, deadzone)}
            fill="rgba(124,92,255,0.10)"
            stroke="rgba(124,92,255,0.55)"
            strokeDasharray="4 4"
          />
        )}
        {peak > 0.001 && (
          <circle cx={cx} cy={cy} r={scale * peak} fill="none" stroke="rgba(255,179,71,0.55)" strokeDasharray="2 4" />
        )}

        {trail.slice(-160).map((p, i) => {
          const age = (i + 1) / Math.min(160, trail.length);
          return (
            <circle
              key={i}
              cx={px(p.x)}
              cy={py(p.y)}
              r={1.6 + age * 1.2}
              fill={`rgba(59,232,176,${0.06 + age * 0.5})`}
            />
          );
        })}

        <circle cx={px(x)} cy={py(y)} r="16" fill={`url(#glow-${label})`} />
        <circle cx={px(x)} cy={py(y)} r="6" fill="var(--accent)" stroke="#04120c" strokeWidth="1.5" />
        <line x1={cx} y1={cy} x2={px(x)} y2={py(y)} stroke="rgba(59,232,176,0.35)" strokeWidth="1" />

        <text x={12} y={size - 10} className="axis-caption">
          {`X ${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%   Y ${y >= 0 ? "+" : ""}${(y * 100).toFixed(1)}%`}
        </text>
        <text x={size - 12} y={size - 10} textAnchor="end" className="axis-caption">
          {`${(dist * 100).toFixed(1)}% from centre`}
        </text>
      </svg>
    </div>
  );
}
