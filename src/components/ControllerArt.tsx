import type { Axes, Family } from "../lib/types";
import { faceSymbol, isPlayStation } from "../lib/types";

interface Props {
  family: Family;
  pressed: Record<string, boolean>;
  axes?: Axes;
  onSelect?: (button: string) => void;
  selected?: string | null;
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

/** Cross-shaped D-pad: one solid body, four independently lit arms. */
function Dpad({
  cx,
  cy,
  pressed,
  onSelect,
  selected,
}: {
  cx: number;
  cy: number;
  pressed: Record<string, boolean>;
  onSelect?: (button: string) => void;
  selected?: string | null;
}) {
  const arm = 15;
  const long = 40;
  return (
    <g>
      <path
        d={`M${cx - arm} ${cy - long} h${arm * 2} v${long - arm} h${long - arm} v${arm * 2} h${-(
          long - arm
        )} v${long - arm} h${-arm * 2} v${-(long - arm)} h${-(long - arm)} v${-arm * 2} h${
          long - arm
        } Z`}
        fill="#1b2330"
        stroke="#39465a"
        strokeWidth="1.2"
      />
      <Btn name="dpUp" pressed={pressed} onSelect={onSelect} selected={selected} label="D-pad up">
        <rect className="pad-arm" x={cx - arm} y={cy - long} width={arm * 2} height={long} rx="5" />
      </Btn>
      <Btn name="dpDown" pressed={pressed} onSelect={onSelect} selected={selected} label="D-pad down">
        <rect className="pad-arm" x={cx - arm} y={cy} width={arm * 2} height={long} rx="5" />
      </Btn>
      <Btn name="dpLeft" pressed={pressed} onSelect={onSelect} selected={selected} label="D-pad left">
        <rect className="pad-arm" x={cx - long} y={cy - arm} width={long} height={arm * 2} rx="5" />
      </Btn>
      <Btn name="dpRight" pressed={pressed} onSelect={onSelect} selected={selected} label="D-pad right">
        <rect className="pad-arm" x={cx} y={cy - arm} width={long} height={arm * 2} rx="5" />
      </Btn>
      <circle cx={cx} cy={cy} r="4" fill="rgba(255,255,255,0.06)" />
    </g>
  );
}

/**
 * Controller illustration drawn to the real hardware proportions: wide shell,
 * raised shoulder wings, two grips, and the stick / D-pad / face-button
 * arrangement each console actually uses.
 */
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
      viewBox="0 0 600 400"
      className="controller-art"
      role="img"
      aria-label={label ?? "Controller illustration"}
    >
      <defs>
        <linearGradient id="pad-shell" x1="0.15" y1="0" x2="0.55" y2="1">
          <stop offset="0%" stopColor="#3d495c" />
          <stop offset="40%" stopColor="#29323f" />
          <stop offset="100%" stopColor="#12161d" />
        </linearGradient>
        <linearGradient id="pad-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.38)" />
          <stop offset="40%" stopColor="rgba(255,255,255,0.06)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.5)" />
        </linearGradient>
        <linearGradient id="pad-inset" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b0f15" />
          <stop offset="100%" stopColor="#171e29" />
        </linearGradient>
        <radialGradient id="pad-well" cx="50%" cy="30%" r="72%">
          <stop offset="0%" stopColor="#323d4e" />
          <stop offset="100%" stopColor="#07090d" />
        </radialGradient>
        <radialGradient id="pad-cap" cx="42%" cy="26%" r="78%">
          <stop offset="0%" stopColor="#5a6a84" />
          <stop offset="70%" stopColor="#222a36" />
          <stop offset="100%" stopColor="#141a23" />
        </radialGradient>
        <linearGradient id="trigger-grad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="rgba(59,232,176,0.9)" />
          <stop offset="100%" stopColor="rgba(59,232,176,0.12)" />
        </linearGradient>
        <filter id="pad-shadow" x="-25%" y="-25%" width="150%" height="160%">
          <feDropShadow dx="0" dy="16" stdDeviation="18" floodColor="#000" floodOpacity="0.6" />
        </filter>
      </defs>

      <ellipse cx="300" cy="378" rx="196" ry="14" fill="rgba(0,0,0,0.4)" />

      {/* Triggers behind the shell */}
      <Btn name="l2" pressed={pressed} onSelect={onSelect} selected={selected} label="Left trigger">
        <path
          d="M150 40h86a13 13 0 0 1 13 13v30a13 13 0 0 1-13 13h-86a13 13 0 0 1-13-13V53a13 13 0 0 1 13-13Z"
          fill="#151b25"
          stroke="#313b4c"
          strokeWidth="1.5"
        />
        <path
          d={`M156 96 h74 v${-34 * lt} a10 10 0 0 0-10-10 h-54 a10 10 0 0 0-10 10 Z`}
          fill="url(#trigger-grad)"
          opacity={lt > 0.02 ? 1 : 0}
        />
        <text x="193" y="70" textAnchor="middle" className="pad-small-label">
          {playstation ? "L2" : "LT"}
        </text>
      </Btn>
      <Btn name="r2" pressed={pressed} onSelect={onSelect} selected={selected} label="Right trigger">
        <path
          d="M364 40h86a13 13 0 0 1 13 13v30a13 13 0 0 1-13 13h-86a13 13 0 0 1-13-13V53a13 13 0 0 1 13-13Z"
          fill="#151b25"
          stroke="#313b4c"
          strokeWidth="1.5"
        />
        <path
          d={`M370 96 h74 v${-34 * rt} a10 10 0 0 0-10-10 h-54 a10 10 0 0 0-10 10 Z`}
          fill="url(#trigger-grad)"
          opacity={rt > 0.02 ? 1 : 0}
        />
        <text x="407" y="70" textAnchor="middle" className="pad-small-label">
          {playstation ? "R2" : "RT"}
        </text>
      </Btn>

      {/* Shoulder buttons */}
      <Btn name="l1" pressed={pressed} onSelect={onSelect} selected={selected} label="Left bumper">
        <path
          d="M126 84h120a15 15 0 0 1 15 15v4a15 15 0 0 1-15 15H126a15 15 0 0 1-15-15v-4a15 15 0 0 1 15-15Z"
          fill="#1f2834"
          stroke="#3d4a5e"
          strokeWidth="1.5"
        />
        <text x="186" y="105" textAnchor="middle" className="pad-small-label">
          {playstation ? "L1" : "LB"}
        </text>
      </Btn>
      <Btn name="r1" pressed={pressed} onSelect={onSelect} selected={selected} label="Right bumper">
        <path
          d="M354 84h120a15 15 0 0 1 15 15v4a15 15 0 0 1-15 15H354a15 15 0 0 1-15-15v-4a15 15 0 0 1 15-15Z"
          fill="#1f2834"
          stroke="#3d4a5e"
          strokeWidth="1.5"
        />
        <text x="414" y="105" textAnchor="middle" className="pad-small-label">
          {playstation ? "R1" : "RB"}
        </text>
      </Btn>

      {/* Shell */}
      <g filter="url(#pad-shadow)">
        <path
          d="M300 104 C356 104 406 110 436 121 C484 137 516 165 530 208 C548 256 556 312 540 346 C524 378 486 385 458 364 C430 343 412 315 394 291 C376 268 344 258 300 258 C256 258 224 268 206 291 C188 315 170 343 142 364 C114 385 76 378 60 346 C44 312 52 256 70 208 C84 165 116 137 164 121 C194 110 244 104 300 104 Z"
          fill="url(#pad-shell)"
          stroke="url(#pad-rim)"
          strokeWidth="2"
        />
        <path
          d="M300 108 C354 108 402 114 430 124 C470 138 500 164 514 200 C488 174 448 156 404 146 C362 136 238 136 196 146 C152 156 112 174 86 200 C100 164 130 138 170 124 C198 114 246 108 300 108 Z"
          fill="rgba(255,255,255,0.06)"
        />
        <path
          d="M96 236 C150 214 210 206 300 206 C390 206 450 214 504 236"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="1"
        />
      </g>

      {playstation ? (
        <>
          <Btn name="touchpad" pressed={pressed} onSelect={onSelect} selected={selected} label="Touchpad">
            <rect x="236" y="114" width="128" height="62" rx="12" fill="url(#pad-inset)" stroke="#3f4c5f" strokeWidth="1.5" />
            <rect x="242" y="120" width="116" height="50" rx="8" fill="rgba(255,255,255,0.025)" />
          </Btn>

          <Btn name="view" pressed={pressed} onSelect={onSelect} selected={selected} label="Create / Share">
            <rect x="204" y="126" width="12" height="24" rx="6" fill="#222b38" stroke="#3d4a5d" />
          </Btn>
          <Btn name="menu" pressed={pressed} onSelect={onSelect} selected={selected} label="Options">
            <rect x="384" y="126" width="12" height="24" rx="6" fill="#222b38" stroke="#3d4a5d" />
          </Btn>

          <Btn name="guide" pressed={pressed} onSelect={onSelect} selected={selected} label="PS button">
            <circle cx="300" cy="200" r="14" fill="#1b222d" stroke="#3d4a5d" />
            <text x="300" y="204" textAnchor="middle" className="pad-glyph-small">
              PS
            </text>
          </Btn>

          <Btn name="mute" pressed={pressed} onSelect={onSelect} selected={selected} label="Mute">
            <rect x="292" y="220" width="16" height="9" rx="4" fill="#222b38" stroke="#3d4a5d" />
          </Btn>

          <Dpad cx={184} cy={198} pressed={pressed} onSelect={onSelect} selected={selected} />

          {(
            [
              ["faceNorth", 424, 162],
              ["faceEast", 456, 194],
              ["faceSouth", 424, 226],
              ["faceWest", 392, 194],
            ] as const
          ).map(([name, cx, cy]) => (
            <Btn key={name} name={name} pressed={pressed} onSelect={onSelect} selected={selected} label={name}>
              <circle cx={cx} cy={cy} r="17" fill="#151b24" stroke={glyphColor[name]} strokeWidth="1.7" />
              <text x={cx} y={cy + 5} textAnchor="middle" className="pad-glyph" fill={glyphColor[name]} style={{ filter: "drop-shadow(0 0 6px rgba(0,0,0,0.6))" }}>
                {glyph(name)}
              </text>
            </Btn>
          ))}

          <Stick name="l3" cx={212} cy={282} pressed={pressed} onSelect={onSelect} selected={selected} />
          <Stick name="r3" cx={388} cy={282} pressed={pressed} onSelect={onSelect} selected={selected} />
        </>
      ) : (
        <>
          <Btn name="guide" pressed={pressed} onSelect={onSelect} selected={selected} label="Guide button">
            <circle cx="300" cy="140" r="17" fill="#171e28" stroke="#3d4a5d" strokeWidth="1.5" />
            <circle cx="300" cy="140" r="8" fill="none" stroke="#93a1b6" strokeWidth="2" />
          </Btn>
          <Btn name="view" pressed={pressed} onSelect={onSelect} selected={selected} label="View">
            <circle cx="264" cy="166" r="8" fill="#1c2431" stroke="#3d4a5d" />
          </Btn>
          <Btn name="menu" pressed={pressed} onSelect={onSelect} selected={selected} label="Menu">
            <circle cx="336" cy="166" r="8" fill="#1c2431" stroke="#3d4a5d" />
          </Btn>
          <Btn name="share" pressed={pressed} onSelect={onSelect} selected={selected} label="Share">
            <rect x="290" y="172" width="20" height="13" rx="4" fill="#1c2431" stroke="#3d4a5d" />
          </Btn>

          <Stick name="l3" cx={202} cy={190} pressed={pressed} onSelect={onSelect} selected={selected} />

          <Dpad cx={200} cy={272} pressed={pressed} onSelect={onSelect} selected={selected} />

          {(
            [
              ["faceNorth", 398, 128],
              ["faceEast", 440, 166],
              ["faceSouth", 398, 204],
              ["faceWest", 356, 166],
            ] as const
          ).map(([name, cx, cy]) => (
            <Btn key={name} name={name} pressed={pressed} onSelect={onSelect} selected={selected} label={name}>
              <circle cx={cx} cy={cy} r="17" fill="#151b24" stroke={glyphColor[name]} strokeWidth="1.7" />
              <text x={cx} y={cy + 5.5} textAnchor="middle" className="pad-glyph" fill={glyphColor[name]} style={{ filter: "drop-shadow(0 0 6px rgba(0,0,0,0.6))" }}>
                {glyph(name)}
              </text>
            </Btn>
          ))}

          <Stick name="r3" cx={392} cy={266} pressed={pressed} onSelect={onSelect} selected={selected} />
        </>
      )}
    </svg>
  );
}

function Stick({
  name,
  cx,
  cy,
  pressed,
  onSelect,
  selected,
}: {
  name: string;
  cx: number;
  cy: number;
  pressed: Record<string, boolean>;
  onSelect?: (button: string) => void;
  selected?: string | null;
}) {
  return (
    <Btn name={name} pressed={pressed} onSelect={onSelect} selected={selected} label={`${name} stick click`}>
      <circle cx={cx} cy={cy} r="37" fill="url(#pad-well)" stroke="#2f3a4b" />
      <circle cx={cx} cy={cy} r="24" fill="url(#pad-cap)" stroke="#526075" strokeWidth="1.2" />
      <circle cx={cx} cy={cy} r="16" fill="none" stroke="rgba(255,255,255,0.07)" />
      <circle cx={cx} cy={cy} r="8" fill="rgba(255,255,255,0.05)" />
    </Btn>
  );
}
