import type { Axes, Family } from "../lib/types";
import { faceSymbol, isPlayStation } from "../lib/types";

interface Props {
  family: Family;
  pressed: Record<string, boolean>;
  axes?: Axes;
  onSelect?: (button: string) => void;
  selected?: string | null;
  compact?: boolean;
  label?: string;
}

interface BtnProps {
  name: string;
  pressed: Record<string, boolean>;
  onSelect?: (button: string) => void;
  selected?: string | null;
  label: string;
  children: React.ReactNode;
}

function Btn({ name, pressed, onSelect, selected, label, children }: BtnProps) {
  const down = !!pressed[name];
  return (
    <g
      className={`pad-btn${down ? " is-down" : ""}${selected === name ? " is-selected" : ""}`}
      onClick={() => onSelect?.(name)}
      role={onSelect ? "button" : undefined}
      aria-label={label}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={(e) => {
        if (onSelect && (e.key === "Enter" || e.key === " ")) onSelect(name);
      }}
    >
      {children}
    </g>
  );
}

/** Custom SVG controller illustrations with individually addressable buttons. */
export function ControllerArt({ family, pressed, axes, onSelect, selected, label }: Props) {
  const playstation = isPlayStation(family);
  const glyph = (name: string) => faceSymbol(name, family);
  const glyphColor: Record<string, string> = playstation
    ? { faceNorth: "#5ef0c4", faceEast: "#ff6b81", faceSouth: "#7aa8ff", faceWest: "#ff9ad5" }
    : { faceNorth: "#ffc857", faceEast: "#ff5a6e", faceSouth: "#4ade80", faceWest: "#5b9dff" };

  const lt = Math.max(0, Math.min(1, axes?.lt ?? 0));
  const rt = Math.max(0, Math.min(1, axes?.rt ?? 0));

  return (
    <svg
      viewBox="0 0 600 380"
      className="controller-art"
      role="img"
      aria-label={label ?? "Controller illustration"}
    >
      <defs>
        <linearGradient id="pad-body" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#28303f" />
          <stop offset="55%" stopColor="#171d27" />
          <stop offset="100%" stopColor="#0e131b" />
        </linearGradient>
        <linearGradient id="pad-highlight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.16)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.02)" />
        </linearGradient>
        <radialGradient id="stick-well" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#2a3342" />
          <stop offset="100%" stopColor="#0a0e14" />
        </radialGradient>
        <linearGradient id="stick-cap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#39445a" />
          <stop offset="100%" stopColor="#151a23" />
        </linearGradient>
        <filter id="pad-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse cx="300" cy="330" rx="230" ry="26" fill="rgba(0,0,0,0.45)" />

      {/* Triggers sit behind the shell */}
      <Btn name="l2" pressed={pressed} onSelect={onSelect} selected={selected} label="Left trigger">
        <rect x="168" y="24" width="88" height="52" rx="18" fill="#141a23" stroke="#2b3342" strokeWidth="1.5" />
        <rect x="174" y={70 - 36 * lt} width="76" height={36 * lt + 2} rx="10" fill="rgba(59,232,176,0.55)" />
        <text x="212" y="46" textAnchor="middle" className="pad-small-label">
          {playstation ? "L2" : "LT"}
        </text>
      </Btn>
      <Btn name="r2" pressed={pressed} onSelect={onSelect} selected={selected} label="Right trigger">
        <rect x="344" y="24" width="88" height="52" rx="18" fill="#141a23" stroke="#2b3342" strokeWidth="1.5" />
        <rect x="350" y={70 - 36 * rt} width="76" height={36 * rt + 2} rx="10" fill="rgba(59,232,176,0.55)" />
        <text x="388" y="46" textAnchor="middle" className="pad-small-label">
          {playstation ? "R2" : "RT"}
        </text>
      </Btn>

      {/* Shoulder buttons */}
      <Btn name="l1" pressed={pressed} onSelect={onSelect} selected={selected} label="Left bumper">
        <rect x="158" y="58" width="112" height="34" rx="14" fill="#1b222d" stroke="#333d4d" strokeWidth="1.5" />
        <text x="214" y="80" textAnchor="middle" className="pad-small-label">
          {playstation ? "L1" : "LB"}
        </text>
      </Btn>
      <Btn name="r1" pressed={pressed} onSelect={onSelect} selected={selected} label="Right bumper">
        <rect x="330" y="58" width="112" height="34" rx="14" fill="#1b222d" stroke="#333d4d" strokeWidth="1.5" />
        <text x="386" y="80" textAnchor="middle" className="pad-small-label">
          {playstation ? "R1" : "RB"}
        </text>
      </Btn>

      {/* Shell */}
      <path
        d="M170 104 C216 80 384 80 430 104 C492 134 546 264 512 306 C487 336 440 306 402 254 C380 225 350 213 300 213 C250 213 220 225 198 254 C160 306 113 336 88 306 C54 264 108 134 170 104 Z"
        fill="url(#pad-body)"
        stroke="#39445a"
        strokeWidth="2"
      />
      <path
        d="M170 104 C216 80 384 80 430 104 C466 122 506 200 512 246 C470 210 420 178 380 168 C340 158 260 158 220 168 C180 178 130 210 88 246 C94 200 134 122 170 104 Z"
        fill="url(#pad-highlight)"
        opacity="0.55"
      />

      {playstation ? (
        <>
          {/* Touchpad */}
          <Btn name="touchpad" pressed={pressed} onSelect={onSelect} selected={selected} label="Touchpad">
            <rect x="243" y="96" width="114" height="54" rx="12" fill="#11161e" stroke="#333d4d" strokeWidth="1.5" />
            <rect x="248" y="101" width="104" height="44" rx="9" fill="rgba(255,255,255,0.03)" />
          </Btn>

          {/* Create / Options */}
          <Btn name="view" pressed={pressed} onSelect={onSelect} selected={selected} label="Create / Share">
            <rect x="206" y="108" width="13" height="26" rx="6" fill="#232b38" stroke="#3a4657" />
          </Btn>
          <Btn name="menu" pressed={pressed} onSelect={onSelect} selected={selected} label="Options">
            <rect x="381" y="108" width="13" height="26" rx="6" fill="#232b38" stroke="#3a4657" />
          </Btn>

          {/* PS button */}
          <Btn name="guide" pressed={pressed} onSelect={onSelect} selected={selected} label="PS button">
            <circle cx="300" cy="178" r="14" fill="#1a212c" stroke="#3a4657" />
            <text x="300" y="183" textAnchor="middle" className="pad-glyph-small">
              PS
            </text>
          </Btn>

          {/* D-pad */}
          <Btn name="dpUp" pressed={pressed} onSelect={onSelect} selected={selected} label="D-pad up">
            <rect x="168" y="130" width="30" height="26" rx="5" fill="#1b222d" stroke="#333d4d" />
          </Btn>
          <Btn name="dpLeft" pressed={pressed} onSelect={onSelect} selected={selected} label="D-pad left">
            <rect x="142" y="156" width="26" height="30" rx="5" fill="#1b222d" stroke="#333d4d" />
          </Btn>
          <Btn name="dpRight" pressed={pressed} onSelect={onSelect} selected={selected} label="D-pad right">
            <rect x="198" y="156" width="26" height="30" rx="5" fill="#1b222d" stroke="#333d4d" />
          </Btn>
          <Btn name="dpDown" pressed={pressed} onSelect={onSelect} selected={selected} label="D-pad down">
            <rect x="168" y="186" width="30" height="26" rx="5" fill="#1b222d" stroke="#333d4d" />
          </Btn>
          <rect x="168" y="156" width="30" height="30" fill="#1b222d" stroke="#333d4d" strokeWidth="0.6" opacity="0.7" />

          {/* Face buttons */}
          {(
            [
              ["faceNorth", 415, 128],
              ["faceEast", 443, 156],
              ["faceSouth", 415, 184],
              ["faceWest", 387, 156],
            ] as const
          ).map(([name, cx, cy]) => (
            <Btn key={name} name={name} pressed={pressed} onSelect={onSelect} selected={selected} label={name}>
              <circle cx={cx} cy={cy} r="15" fill="#161c26" stroke={glyphColor[name]} strokeWidth="1.6" />
              <text x={cx} y={cy + 5} textAnchor="middle" className="pad-glyph" fill={glyphColor[name]}>
                {glyph(name)}
              </text>
            </Btn>
          ))}

          {/* Sticks */}
          <Btn name="l3" pressed={pressed} onSelect={onSelect} selected={selected} label="Left stick click">
            <circle cx="212" cy="252" r="33" fill="url(#stick-well)" stroke="#333d4d" />
            <circle cx="212" cy="252" r="22" fill="url(#stick-cap)" stroke="#4a566b" />
            <circle cx="212" cy="252" r="13" fill="rgba(255,255,255,0.04)" />
          </Btn>
          <Btn name="r3" pressed={pressed} onSelect={onSelect} selected={selected} label="Right stick click">
            <circle cx="388" cy="252" r="33" fill="url(#stick-well)" stroke="#333d4d" />
            <circle cx="388" cy="252" r="22" fill="url(#stick-cap)" stroke="#4a566b" />
            <circle cx="388" cy="252" r="13" fill="rgba(255,255,255,0.04)" />
          </Btn>

          <Btn name="mute" pressed={pressed} onSelect={onSelect} selected={selected} label="Mute">
            <rect x="292" y="196" width="16" height="9" rx="4" fill="#232b38" stroke="#3a4657" />
          </Btn>
        </>
      ) : (
        <>
          {/* Guide */}
          <Btn name="guide" pressed={pressed} onSelect={onSelect} selected={selected} label="Guide button">
            <circle cx="300" cy="122" r="16" fill="#161c26" stroke="#3a4657" strokeWidth="1.5" />
            <circle cx="300" cy="122" r="7" fill="none" stroke="#7a8798" strokeWidth="2" />
          </Btn>

          {/* View / Menu / Share */}
          <Btn name="view" pressed={pressed} onSelect={onSelect} selected={selected} label="View">
            <circle cx="252" cy="146" r="9" fill="#1b222d" stroke="#3a4657" />
          </Btn>
          <Btn name="menu" pressed={pressed} onSelect={onSelect} selected={selected} label="Menu">
            <circle cx="348" cy="146" r="9" fill="#1b222d" stroke="#3a4657" />
          </Btn>
          <Btn name="share" pressed={pressed} onSelect={onSelect} selected={selected} label="Share">
            <rect x="290" y="152" width="20" height="14" rx="4" fill="#1b222d" stroke="#3a4657" />
          </Btn>

          {/* Left stick */}
          <Btn name="l3" pressed={pressed} onSelect={onSelect} selected={selected} label="Left stick click">
            <circle cx="205" cy="178" r="35" fill="url(#stick-well)" stroke="#333d4d" />
            <circle cx="205" cy="178" r="23" fill="url(#stick-cap)" stroke="#4a566b" />
            <circle cx="205" cy="178" r="13" fill="rgba(255,255,255,0.04)" />
          </Btn>

          {/* D-pad */}
          <Btn name="dpUp" pressed={pressed} onSelect={onSelect} selected={selected} label="D-pad up">
            <rect x="190" y="228" width="30" height="26" rx="5" fill="#1b222d" stroke="#333d4d" />
          </Btn>
          <Btn name="dpLeft" pressed={pressed} onSelect={onSelect} selected={selected} label="D-pad left">
            <rect x="164" y="254" width="26" height="30" rx="5" fill="#1b222d" stroke="#333d4d" />
          </Btn>
          <Btn name="dpRight" pressed={pressed} onSelect={onSelect} selected={selected} label="D-pad right">
            <rect x="220" y="254" width="26" height="30" rx="5" fill="#1b222d" stroke="#333d4d" />
          </Btn>
          <Btn name="dpDown" pressed={pressed} onSelect={onSelect} selected={selected} label="D-pad down">
            <rect x="190" y="284" width="30" height="26" rx="5" fill="#1b222d" stroke="#333d4d" />
          </Btn>
          <rect x="190" y="254" width="30" height="30" fill="#1b222d" stroke="#333d4d" strokeWidth="0.6" opacity="0.7" />

          {/* Face buttons */}
          {(
            [
              ["faceNorth", 395, 140],
              ["faceEast", 423, 168],
              ["faceSouth", 395, 196],
              ["faceWest", 367, 168],
            ] as const
          ).map(([name, cx, cy]) => (
            <Btn key={name} name={name} pressed={pressed} onSelect={onSelect} selected={selected} label={name}>
              <circle cx={cx} cy={cy} r="15" fill="#161c26" stroke={glyphColor[name]} strokeWidth="1.6" />
              <text x={cx} y={cy + 5} textAnchor="middle" className="pad-glyph" fill={glyphColor[name]}>
                {glyph(name)}
              </text>
            </Btn>
          ))}

          {/* Right stick */}
          <Btn name="r3" pressed={pressed} onSelect={onSelect} selected={selected} label="Right stick click">
            <circle cx="395" cy="254" r="35" fill="url(#stick-well)" stroke="#333d4d" />
            <circle cx="395" cy="254" r="23" fill="url(#stick-cap)" stroke="#4a566b" />
            <circle cx="395" cy="254" r="13" fill="rgba(255,255,255,0.04)" />
          </Btn>
        </>
      )}
    </svg>
  );
}
