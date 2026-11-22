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

interface Palette {
  shellTop: string;
  shellMid: string;
  shellBottom: string;
  plate: string;
  plateStroke: string;
  well: string;
  capTop: string;
  capBottom: string;
  capRim: string;
  pad: string;
  padStroke: string;
  bodyStroke: string;
  gripTexture: number;
}

const PALETTES: Record<string, Palette> = {
  xbox: {
    shellTop: "#39424f",
    shellMid: "#232a34",
    shellBottom: "#0e1218",
    plate: "rgba(255,255,255,0.05)",
    plateStroke: "rgba(255,255,255,0.12)",
    well: "#05070a",
    capTop: "#4b586c",
    capBottom: "#131922",
    capRim: "#6a7a92",
    pad: "#1b222d",
    padStroke: "#3b475a",
    bodyStroke: "rgba(255,255,255,0.16)",
    gripTexture: 0.07,
  },
  ps5: {
    shellTop: "#f2f5f9",
    shellMid: "#dfe5ee",
    shellBottom: "#b9c2cf",
    plate: "rgba(10,14,20,0.92)",
    plateStroke: "rgba(255,255,255,0.22)",
    well: "#0a0e14",
    capTop: "#3c4757",
    capBottom: "#111720",
    capRim: "#5d6b80",
    pad: "#11161f",
    padStroke: "#2c3542",
    bodyStroke: "rgba(0,0,0,0.35)",
    gripTexture: 0.05,
  },
  ps4: {
    shellTop: "#3a4150",
    shellMid: "#222833",
    shellBottom: "#0d1117",
    plate: "rgba(255,255,255,0.045)",
    plateStroke: "rgba(255,255,255,0.1)",
    well: "#05070a",
    capTop: "#485466",
    capBottom: "#121822",
    capRim: "#66748a",
    pad: "#1a212b",
    padStroke: "#374252",
    bodyStroke: "rgba(255,255,255,0.14)",
    gripTexture: 0.06,
  },
};

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

/** Cross D-pad: solid bevel body with four lit arms. */
function Dpad({
  cx,
  cy,
  p,
  pressed,
  onSelect,
  selected,
  disc,
}: {
  cx: number;
  cy: number;
  p: Palette;
  pressed: Record<string, boolean>;
  onSelect?: (button: string) => void;
  selected?: string | null;
  disc?: boolean;
}) {
  const arm = 15;
  const long = 38;
  return (
    <g>
      {disc && <circle cx={cx} cy={cy} r={long + 4} fill="url(#dpadDisc)" stroke="rgba(255,255,255,0.16)" />}
      <path
        d={`M${cx - arm} ${cy - long} h${arm * 2} v${long - arm} h${long - arm} v${arm * 2} h${-(
          long - arm
        )} v${long - arm} h${-arm * 2} v${-(long - arm)} h${-(long - arm)} v${-arm * 2} h${
          long - arm
        } Z`}
        fill={p.pad}
        stroke={p.padStroke}
        strokeWidth="1.2"
      />
      <path
        d={`M${cx - arm} ${cy - long + 2} h${arm * 2} v3 h${-arm * 2} Z`}
        fill="rgba(255,255,255,0.14)"
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
      <circle cx={cx} cy={cy} r="3.5" fill="rgba(0,0,0,0.35)" />
    </g>
  );
}

function Stick({
  name,
  cx,
  cy,
  p,
  pressed,
  onSelect,
  selected,
}: {
  name: string;
  cx: number;
  cy: number;
  p: Palette;
  pressed: Record<string, boolean>;
  onSelect?: (button: string) => void;
  selected?: string | null;
}) {
  return (
    <Btn name={name} pressed={pressed} onSelect={onSelect} selected={selected} label={`${name} stick click`}>
      <circle cx={cx} cy={cy} r="40" fill="url(#stickWell)" stroke="rgba(0,0,0,0.5)" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r="40" fill="none" stroke={p.capRim} strokeOpacity="0.35" strokeWidth="1" />
      <circle cx={cx} cy={cy} r="27" fill={p.capBottom} />
      <circle cx={cx} cy={cy} r="26" fill="url(#stickCap)" />
      <circle
        cx={cx}
        cy={cy}
        r="26"
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="2"
        strokeDasharray="1.5 3.2"
        opacity="0.75"
      />
      <circle cx={cx} cy={cy} r="17" fill="url(#stickDish)" />
      <circle cx={cx} cy={cy} r="17" fill="none" stroke="rgba(0,0,0,0.35)" />
      <ellipse cx={cx - 7} cy={cy - 9} rx="9" ry="5" fill="rgba(255,255,255,0.14)" transform={`rotate(-24 ${cx - 7} ${cy - 9})`} />
    </Btn>
  );
}

/** Neutral wireframe for pads whose model Windows does not identify. */
function UnknownArt({ pressed, onSelect, selected, label }: Omit<Props, "family" | "axes">) {
  const shape = (name: string, children: React.ReactNode) => (
    <Btn key={name} name={name} pressed={pressed} onSelect={onSelect} selected={selected} label={name}>
      {children}
    </Btn>
  );
  return (
    <svg viewBox="0 0 600 400" className="controller-art" role="img" aria-label={label ?? "Unidentified controller"}>
      <ellipse cx="300" cy="378" rx="190" ry="12" fill="rgba(0,0,0,0.35)" />
      <path
        d="M300 108 C332 108 360 104 388 98 C420 92 452 92 476 104 C516 124 546 160 554 208 C562 256 560 306 542 340 C528 366 500 372 478 356 C456 340 438 310 422 284 C404 256 372 248 300 248 C228 248 196 256 178 284 C162 310 144 340 122 356 C100 372 72 366 58 340 C40 306 38 256 46 208 C54 160 84 124 124 104 C148 92 180 92 212 98 C240 104 268 108 300 108 Z"
        fill="rgba(255,255,255,0.02)"
        stroke="rgba(198,255,61,0.35)"
        strokeWidth="1.5"
        strokeDasharray="9 7"
      />
      {shape("dpUp", <rect x="185" y="240" width="30" height="26" rx="4" fill="none" stroke="rgba(255,255,255,0.22)" />)}
      {shape("dpDown", <rect x="185" y="288" width="30" height="26" rx="4" fill="none" stroke="rgba(255,255,255,0.22)" />)}
      {shape("dpLeft", <rect x="160" y="264" width="26" height="26" rx="4" fill="none" stroke="rgba(255,255,255,0.22)" />)}
      {shape("dpRight", <rect x="212" y="264" width="26" height="26" rx="4" fill="none" stroke="rgba(255,255,255,0.22)" />)}
      {(
        [
          ["faceNorth", 396, 132],
          ["faceEast", 438, 170],
          ["faceSouth", 396, 208],
          ["faceWest", 354, 170],
        ] as const
      ).map(([name, cx, cy]) => shape(name, <circle cx={cx} cy={cy} r="16" fill="none" stroke="rgba(255,255,255,0.22)" />))}
      {shape("l3", <circle cx={202} cy={190} r="34" fill="none" stroke="rgba(255,255,255,0.22)" strokeDasharray="4 5" />)}
      {shape("r3", <circle cx={392} cy={270} r="34" fill="none" stroke="rgba(255,255,255,0.22)" strokeDasharray="4 5" />)}
      {shape("l1", <rect x="140" y="86" width="100" height="26" rx="12" fill="none" stroke="rgba(255,255,255,0.14)" />)}
      {shape("r1", <rect x="360" y="86" width="100" height="26" rx="12" fill="none" stroke="rgba(255,255,255,0.14)" />)}
      <text x="300" y="150" textAnchor="middle" fill="rgba(198,255,61,0.75)" className="pad-glyph-small">
        UNIDENTIFIED HID PAD
      </text>
    </svg>
  );
}

export function ControllerArt({ family, pressed, axes, onSelect, selected, label }: Props) {
  if (family === "generic") {
    return <UnknownArt pressed={pressed} onSelect={onSelect} selected={selected} label={label} />;
  }

  const playstation = isPlayStation(family);
  const dualshock4 = family === "dualshock4";
  const xbox360 = family === "xbox360";
  const xboxSeries = family === "xboxseries";
  const p = playstation ? (dualshock4 ? PALETTES.ps4 : PALETTES.ps5) : PALETTES.xbox;
  const lightShell = family === "dualsense";

  const glyph = (name: string) => faceSymbol(name, family);
  const glyphColor: Record<string, string> = playstation
    ? { faceNorth: "#5ef0c4", faceEast: "#ff6b81", faceSouth: "#7aa8ff", faceWest: "#ff9ad5" }
    : { faceNorth: "#ffc857", faceEast: "#ff5a6e", faceSouth: "#4ade80", faceWest: "#5b9dff" };

  const lt = Math.max(0, Math.min(1, axes?.lt ?? 0));
  const rt = Math.max(0, Math.min(1, axes?.rt ?? 0));
  const labelInk = lightShell ? "#1b2430" : "#9aa8bc";

  return (
    <svg viewBox="0 0 600 400" className="controller-art" role="img" aria-label={label ?? "Controller illustration"}>
      <defs>
        <linearGradient id="shellGrad" x1="0.2" y1="0" x2="0.55" y2="1">
          <stop offset="0%" stopColor={p.shellTop} />
          <stop offset="45%" stopColor={p.shellMid} />
          <stop offset="100%" stopColor={p.shellBottom} />
        </linearGradient>
        <linearGradient id="plateGrad" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
          <stop offset="55%" stopColor="rgba(255,255,255,0.02)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.22)" />
        </linearGradient>
        <linearGradient id="rimGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="35%" stopColor="rgba(255,255,255,0.08)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
        </linearGradient>
        <radialGradient id="stickWell" cx="50%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#2a3340" />
          <stop offset="55%" stopColor="#0b0f15" />
          <stop offset="100%" stopColor="#05070a" />
        </radialGradient>
        <radialGradient id="stickCap" cx="40%" cy="24%" r="80%">
          <stop offset="0%" stopColor={p.capTop} />
          <stop offset="62%" stopColor={p.capBottom} />
          <stop offset="100%" stopColor="#0b1016" />
        </radialGradient>
        <radialGradient id="stickDish" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="rgba(0,0,0,0.55)" />
          <stop offset="70%" stopColor="rgba(0,0,0,0.25)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
        </radialGradient>
        <linearGradient id="triggerGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="rgba(198,255,61,0.85)" />
          <stop offset="100%" stopColor="rgba(198,255,61,0.1)" />
        </linearGradient>
        <radialGradient id="dpadDisc" cx="45%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#5a6779" />
          <stop offset="100%" stopColor="#1a212b" />
        </radialGradient>
        <pattern id="gripDots" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1.4" cy="1.4" r="1.05" fill="rgba(0,0,0,0.55)" />
          <circle cx="4.4" cy="4.4" r="1.05" fill="rgba(0,0,0,0.4)" />
        </pattern>
        <filter id="shellShadow" x="-25%" y="-25%" width="150%" height="160%">
          <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#000" floodOpacity="0.6" />
        </filter>
        <filter id="innerShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feOffset dx="0" dy="2" />
          <feGaussianBlur stdDeviation="2.2" result="off" />
          <feComposite in="SourceGraphic" in2="off" operator="out" result="cut" />
          <feColorMatrix in="cut" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0" result="shade" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="shade" />
          </feMerge>
        </filter>
        <clipPath id="gripClip">
          <path d="M300 108 C332 108 360 104 388 98 C420 92 452 92 476 104 C516 124 546 160 554 208 C562 256 560 306 542 340 C528 366 500 372 478 356 C456 340 438 310 422 284 C404 256 372 248 300 248 C228 248 196 256 178 284 C162 310 144 340 122 356 C100 372 72 366 58 340 C40 306 38 256 46 208 C54 160 84 124 124 104 C148 92 180 92 212 98 C240 104 268 108 300 108 Z" />
        </clipPath>
      </defs>

      <ellipse cx="300" cy="374" rx="188" ry="13" fill="rgba(0,0,0,0.45)" />

      {/* Triggers behind the shell */}
      <Btn name="l2" pressed={pressed} onSelect={onSelect} selected={selected} label="Left trigger">
        <path
          d="M146 40 C146 34 151 30 158 30 H232 C240 30 246 35 246 43 L244 88 C244 95 238 99 231 99 H156 C149 99 143 94 143 87 Z"
          fill={lightShell ? "#cfd6e0" : "#151b25"}
          stroke={p.bodyStroke}
          strokeWidth="1.5"
        />
        <path
          d={`M150 92 C150 92 152 ${92 - 40 * lt} 156 ${64 - 26 * lt} H226 C230 60 232 ${92 - 40 * lt} 232 92 Z`}
          fill="url(#triggerGrad)"
          opacity={lt > 0.02 ? 0.95 : 0}
        />
        <text x="194" y="70" textAnchor="middle" className="pad-small-label" fill={labelInk}>
          {playstation ? "L2" : "LT"}
        </text>
      </Btn>
      <Btn name="r2" pressed={pressed} onSelect={onSelect} selected={selected} label="Right trigger">
        <path
          d="M354 43 C354 35 360 30 368 30 H442 C449 30 454 34 454 40 L457 87 C457 94 451 99 444 99 H369 C362 99 356 95 356 88 Z"
          fill={lightShell ? "#cfd6e0" : "#151b25"}
          stroke={p.bodyStroke}
          strokeWidth="1.5"
        />
        <path
          d={`M368 92 C368 92 370 ${92 - 40 * rt} 374 ${64 - 26 * rt} H444 C448 60 450 ${92 - 40 * rt} 450 92 Z`}
          fill="url(#triggerGrad)"
          opacity={rt > 0.02 ? 0.95 : 0}
        />
        <text x="406" y="70" textAnchor="middle" className="pad-small-label" fill={labelInk}>
          {playstation ? "R2" : "RT"}
        </text>
      </Btn>

      {/* Shoulder buttons */}
      <Btn name="l1" pressed={pressed} onSelect={onSelect} selected={selected} label="Left bumper">
        <path
          d="M126 84 H246 C255 84 262 91 262 100 V104 C262 113 255 120 246 120 H126 C117 120 110 113 110 104 V100 C110 91 117 84 126 84 Z"
          fill={lightShell ? "#e6ebf2" : "#212936"}
          stroke={p.bodyStroke}
          strokeWidth="1.4"
        />
        <path d="M124 88 H246 C252 88 257 92 258 98 H112 C113 92 118 88 124 88 Z" fill="rgba(255,255,255,0.22)" />
        <text x="186" y="109" textAnchor="middle" className="pad-small-label" fill={labelInk}>
          {playstation ? "L1" : "LB"}
        </text>
      </Btn>
      <Btn name="r1" pressed={pressed} onSelect={onSelect} selected={selected} label="Right bumper">
        <path
          d="M354 84 H474 C483 84 490 91 490 100 V104 C490 113 483 120 474 120 H354 C345 120 338 113 338 104 V100 C338 91 345 84 354 84 Z"
          fill={lightShell ? "#e6ebf2" : "#212936"}
          stroke={p.bodyStroke}
          strokeWidth="1.4"
        />
        <path d="M354 88 H476 C482 88 487 92 488 98 H342 C343 92 348 88 354 88 Z" fill="rgba(255,255,255,0.22)" />
        <text x="414" y="109" textAnchor="middle" className="pad-small-label" fill={labelInk}>
          {playstation ? "R1" : "RB"}
        </text>
      </Btn>

      {/* Shell */}
      <g filter="url(#shellShadow)">
        <path
          d="M300 108 C332 108 360 104 388 98 C420 92 452 92 476 104 C516 124 546 160 554 208 C562 256 560 306 542 340 C528 366 500 372 478 356 C456 340 438 310 422 284 C404 256 372 248 300 248 C228 248 196 256 178 284 C162 310 144 340 122 356 C100 372 72 366 58 340 C40 306 38 256 46 208 C54 160 84 124 124 104 C148 92 180 92 212 98 C240 104 268 108 300 108 Z"
          fill="url(#shellGrad)"
          stroke="url(#rimGrad)"
          strokeWidth="2"
        />
        {/* grip stippling */}
        <path
          d="M300 108 C332 108 360 104 388 98 C420 92 452 92 476 104 C516 124 546 160 554 208 C562 256 560 306 542 340 C528 366 500 372 478 356 C456 340 438 310 422 284 C404 256 372 248 300 248 C228 248 196 256 178 284 C162 310 144 340 122 356 C100 372 72 366 58 340 C40 306 38 256 46 208 C54 160 84 124 124 104 C148 92 180 92 212 98 C240 104 268 108 300 108 Z"
          fill="url(#gripDots)"
          opacity={p.gripTexture}
          clipPath="url(#gripClip)"
        />
        {/* face plate */}
        <path
          d="M300 116 C352 116 398 112 424 104 C462 118 492 146 508 190 C518 232 518 276 506 304 C494 330 470 336 452 322 C434 308 418 282 404 260 C388 236 360 228 300 228 C240 228 212 236 196 260 C182 282 166 308 148 322 C130 336 106 330 94 304 C82 276 82 232 92 190 C108 146 138 118 176 104 C202 112 248 116 300 116 Z"
          fill="url(#plateGrad)"
          stroke={p.plateStroke}
          strokeWidth="1"
        />
        {/* top seam */}
        <path d="M112 140 C160 120 230 112 300 112 C370 112 440 120 488 140" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      </g>

      {/* USB-C port + status LED */}
      <rect x="286" y="104" width="28" height="8" rx="4" fill="#05070a" stroke="rgba(255,255,255,0.18)" />
      <rect x="292" y="106.5" width="16" height="3" rx="1.5" fill="#39424f" />

      {playstation ? (
        <>
          {dualshock4 && <rect x="240" y="107" width="120" height="5" rx="2.5" fill="#34e7ff" opacity="0.85" />}
          <Btn name="touchpad" pressed={pressed} onSelect={onSelect} selected={selected} label="Touchpad">
            <rect x="236" y="114" width="128" height="62" rx="10" fill="#0c1119" stroke="rgba(255,255,255,0.16)" strokeWidth="1.4" />
            <rect x="242" y="120" width="116" height="50" rx="7" fill="rgba(255,255,255,0.035)" />
            <rect x="242" y="120" width="116" height="50" rx="7" fill="none" stroke="rgba(255,255,255,0.06)" />
          </Btn>

          <Btn name="view" pressed={pressed} onSelect={onSelect} selected={selected} label="Create / Share">
            <rect x="204" y="124" width="12" height="24" rx="6" fill={p.pad} stroke={p.padStroke} />
          </Btn>
          <Btn name="menu" pressed={pressed} onSelect={onSelect} selected={selected} label="Options">
            <rect x="384" y="124" width="12" height="24" rx="6" fill={p.pad} stroke={p.padStroke} />
          </Btn>

          <Btn name="guide" pressed={pressed} onSelect={onSelect} selected={selected} label="PS button">
            <circle cx="300" cy="200" r="14" fill="#11161f" stroke={dualshock4 ? "#7aa8ff" : "rgba(255,255,255,0.2)"} />
            <text x="300" y="204" textAnchor="middle" className="pad-glyph-small" fill={dualshock4 ? "#7aa8ff" : "#b9c6d6"}>
              PS
            </text>
          </Btn>

          {!dualshock4 && (
            <Btn name="mute" pressed={pressed} onSelect={onSelect} selected={selected} label="Mute">
              <rect x="292" y="220" width="16" height="9" rx="4" fill={p.pad} stroke={p.padStroke} />
            </Btn>
          )}

          <Dpad cx={184} cy={198} p={p} pressed={pressed} onSelect={onSelect} selected={selected} />

          {(
            [
              ["faceNorth", 424, 162],
              ["faceEast", 456, 194],
              ["faceSouth", 424, 226],
              ["faceWest", 392, 194],
            ] as const
          ).map(([name, cx, cy]) => (
            <Btn key={name} name={name} pressed={pressed} onSelect={onSelect} selected={selected} label={name}>
              <circle cx={cx} cy={cy} r="18" fill="#0d1219" stroke="rgba(0,0,0,0.4)" />
              <circle cx={cx} cy={cy} r="16" fill="#151b24" stroke={glyphColor[name]} strokeWidth="1.6" />
              <text x={cx} y={cy + 5} textAnchor="middle" className="pad-glyph" fill={glyphColor[name]}>
                {glyph(name)}
              </text>
            </Btn>
          ))}

          <Stick name="l3" cx={212} cy={282} p={p} pressed={pressed} onSelect={onSelect} selected={selected} />
          <Stick name="r3" cx={388} cy={282} p={p} pressed={pressed} onSelect={onSelect} selected={selected} />
        </>
      ) : (
        <>
          <Btn name="guide" pressed={pressed} onSelect={onSelect} selected={selected} label="Guide button">
            {xbox360 ? (
              <>
                <circle cx="300" cy="140" r="17" fill="#2b3542" stroke="#c3cedd" strokeWidth="2" />
                <circle cx="300" cy="140" r="8" fill="#8bdc5a" opacity="0.9" />
              </>
            ) : (
              <>
                <circle cx="300" cy="140" r="17" fill="#0f151d" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                <circle cx="300" cy="140" r="8" fill="none" stroke="#e9f4ea" strokeWidth="2" opacity="0.85" />
              </>
            )}
          </Btn>
          <Btn name="view" pressed={pressed} onSelect={onSelect} selected={selected} label="View">
            <circle cx="264" cy="162" r="8" fill={p.pad} stroke={p.padStroke} />
          </Btn>
          <Btn name="menu" pressed={pressed} onSelect={onSelect} selected={selected} label="Menu">
            <circle cx="336" cy="162" r="8" fill={p.pad} stroke={p.padStroke} />
          </Btn>
          {xboxSeries && (
            <Btn name="share" pressed={pressed} onSelect={onSelect} selected={selected} label="Share">
              <rect x="290" y="172" width="20" height="13" rx="4" fill={p.pad} stroke={p.padStroke} />
            </Btn>
          )}

          <Stick name="l3" cx={202} cy={190} p={p} pressed={pressed} onSelect={onSelect} selected={selected} />

          <Dpad
            cx={200}
            cy={272}
            p={p}
            pressed={pressed}
            onSelect={onSelect}
            selected={selected}
            disc={xbox360 || xboxSeries}
          />

          {(
            [
              ["faceNorth", 396, 134],
              ["faceEast", 438, 172],
              ["faceSouth", 396, 210],
              ["faceWest", 354, 172],
            ] as const
          ).map(([name, cx, cy]) => (
            <Btn key={name} name={name} pressed={pressed} onSelect={onSelect} selected={selected} label={name}>
              <circle cx={cx} cy={cy} r="18" fill="#0d1219" stroke="rgba(0,0,0,0.45)" />
              <circle cx={cx} cy={cy} r="16" fill="#141a23" stroke={glyphColor[name]} strokeWidth="1.6" />
              <text x={cx} y={cy + 5.5} textAnchor="middle" className="pad-glyph" fill={glyphColor[name]}>
                {glyph(name)}
              </text>
            </Btn>
          ))}

          <Stick name="r3" cx={392} cy={270} p={p} pressed={pressed} onSelect={onSelect} selected={selected} />
        </>
      )}

      {/* screw dots */}
      {[
        [130, 150],
        [470, 150],
        [148, 316],
        [452, 316],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.4" fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.12)" />
      ))}
    </svg>
  );
}
