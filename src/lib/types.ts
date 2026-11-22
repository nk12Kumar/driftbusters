export type Family =
  | "dualshock4"
  | "dualsense"
  | "xbox360"
  | "xboxone"
  | "xboxseries"
  | "generic";

export interface Battery {
  level: number | null;
  charging: boolean | null;
  status: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  family: Family;
  connection: "usb" | "bluetooth" | "wireless" | "unknown";
  vid: number;
  pid: number;
  serial: string | null;
  backend: "xinput" | "hid";
  xinputIndex: number | null;
  path: string | null;
  usagePage: number | null;
  usage: number | null;
  inputReportLength: number | null;
  battery: Battery | null;
  identities: string[];
  hasTouchpad: boolean;
  hasMotion: boolean;
}

export interface Axes {
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  lt: number;
  rt: number;
}

export interface RawState {
  reportId: number;
  report: number[];
  axes: number[];
  buttons: number[];
  power: number | null;
}

export interface InputState {
  id: string;
  timestampMs: number;
  packet: number;
  axes: Axes;
  buttons: Record<string, boolean>;
  raw: RawState;
  batteryLevel: number | null;
  charging: boolean | null;
  powered: boolean | null;
  live: boolean;
}

export interface Snapshot {
  devices: DeviceInfo[];
  states: InputState[];
  timestampMs: number;
  revision: number;
}

export const BUTTONS = [
  "faceSouth",
  "faceEast",
  "faceNorth",
  "faceWest",
  "l1",
  "r1",
  "l2",
  "r2",
  "l3",
  "r3",
  "dpUp",
  "dpDown",
  "dpLeft",
  "dpRight",
  "menu",
  "view",
  "guide",
  "touchpad",
  "mute",
  "share",
  "paddle",
] as const;

export type ButtonName = (typeof BUTTONS)[number];

const PS_LABELS: Record<string, string> = {
  faceSouth: "Cross",
  faceEast: "Circle",
  faceNorth: "Triangle",
  faceWest: "Square",
  l1: "L1",
  r1: "R1",
  l2: "L2",
  r2: "R2",
  l3: "L3 (stick click)",
  r3: "R3 (stick click)",
  dpUp: "D-Pad Up",
  dpDown: "D-Pad Down",
  dpLeft: "D-Pad Left",
  dpRight: "D-Pad Right",
  menu: "Options",
  view: "Create / Share",
  guide: "PS button",
  touchpad: "Touchpad click",
  mute: "Mute",
  share: "Share",
  paddle: "Back paddle",
};

const XBOX_LABELS: Record<string, string> = {
  faceSouth: "A",
  faceEast: "B",
  faceNorth: "Y",
  faceWest: "X",
  l1: "LB",
  r1: "RB",
  l2: "LT",
  r2: "RT",
  l3: "LS (stick click)",
  r3: "RS (stick click)",
  dpUp: "D-Pad Up",
  dpDown: "D-Pad Down",
  dpLeft: "D-Pad Left",
  dpRight: "D-Pad Right",
  menu: "Menu",
  view: "View",
  guide: "Guide / Xbox button",
  touchpad: "Share",
  mute: "Mute",
  share: "Share",
  paddle: "Paddle",
};

export function isPlayStation(family: Family): boolean {
  return family === "dualshock4" || family === "dualsense";
}

export function buttonLabel(name: string, family: Family): string {
  const table = isPlayStation(family) ? PS_LABELS : XBOX_LABELS;
  return table[name] ?? name;
}

export function faceSymbol(name: string, family: Family): string {
  if (isPlayStation(family)) {
    return { faceNorth: "\u25B3", faceEast: "\u25CB", faceSouth: "\u2715", faceWest: "\u25A1" }[
      name
    ] ?? "";
  }
  return { faceNorth: "Y", faceEast: "B", faceSouth: "A", faceWest: "X" }[name] ?? "";
}

export function familyLabel(family: Family): string {
  switch (family) {
    case "dualshock4":
      return "PlayStation 4";
    case "dualsense":
      return "PlayStation 5";
    case "xbox360":
      return "Xbox 360";
    case "xboxone":
      return "Xbox One";
    case "xboxseries":
      return "Xbox Series X|S";
    default:
      return "Generic HID";
  }
}

export function connectionLabel(connection: DeviceInfo["connection"]): string {
  switch (connection) {
    case "usb":
      return "USB";
    case "bluetooth":
      return "Bluetooth";
    case "wireless":
      return "Wireless";
    default:
      return "Connection unknown";
  }
}
