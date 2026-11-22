import dualshock4 from "../assets/controllers/dualshock4.webp";
import dualsense from "../assets/controllers/dualsense.webp";
import xbox360 from "../assets/controllers/xbox360.webp";
import xboxone from "../assets/controllers/xboxone.webp";
import xboxseries from "../assets/controllers/xboxseries.webp";
import type { Family } from "./types";

export interface Point {
  x: number;
  y: number;
}

export const PHOTOS: Partial<Record<Family, string>> = {
  dualshock4,
  dualsense,
  xbox360,
  xboxone,
  xboxseries,
};

/**
 * Starting positions for the button hotspots, in fractions of the image.
 * These are only a starting point — the Tester's "Align buttons" tool records
 * the real positions per photo and stores them in settings.
 */
export const DEFAULT_POINTS: Partial<Record<Family, Record<string, Point>>> = {
  xboxone: {
    l2: { x: 0.31, y: 0.07 },
    r2: { x: 0.69, y: 0.07 },
    l1: { x: 0.31, y: 0.2 },
    r1: { x: 0.69, y: 0.2 },
    guide: { x: 0.5, y: 0.33 },
    view: { x: 0.43, y: 0.45 },
    menu: { x: 0.57, y: 0.45 },
    faceNorth: { x: 0.68, y: 0.38 },
    faceEast: { x: 0.75, y: 0.5 },
    faceSouth: { x: 0.68, y: 0.62 },
    faceWest: { x: 0.61, y: 0.5 },
    l3: { x: 0.33, y: 0.62 },
    dpUp: { x: 0.32, y: 0.74 },
    dpDown: { x: 0.32, y: 0.9 },
    dpLeft: { x: 0.25, y: 0.82 },
    dpRight: { x: 0.39, y: 0.82 },
    r3: { x: 0.68, y: 0.78 },
  },
  xbox360: {
    l2: { x: 0.32, y: 0.06 },
    r2: { x: 0.68, y: 0.06 },
    l1: { x: 0.32, y: 0.19 },
    r1: { x: 0.68, y: 0.19 },
    guide: { x: 0.5, y: 0.32 },
    view: { x: 0.43, y: 0.44 },
    menu: { x: 0.57, y: 0.44 },
    faceNorth: { x: 0.67, y: 0.38 },
    faceEast: { x: 0.74, y: 0.5 },
    faceSouth: { x: 0.67, y: 0.62 },
    faceWest: { x: 0.6, y: 0.5 },
    l3: { x: 0.34, y: 0.58 },
    dpUp: { x: 0.34, y: 0.72 },
    dpDown: { x: 0.34, y: 0.88 },
    dpLeft: { x: 0.27, y: 0.8 },
    dpRight: { x: 0.41, y: 0.8 },
    r3: { x: 0.67, y: 0.76 },
  },
  dualshock4: {
    l2: { x: 0.3, y: 0.06 },
    r2: { x: 0.7, y: 0.06 },
    l1: { x: 0.3, y: 0.19 },
    r1: { x: 0.7, y: 0.19 },
    touchpad: { x: 0.5, y: 0.33 },
    guide: { x: 0.5, y: 0.52 },
    view: { x: 0.35, y: 0.46 },
    menu: { x: 0.65, y: 0.46 },
    faceNorth: { x: 0.76, y: 0.36 },
    faceEast: { x: 0.81, y: 0.46 },
    faceSouth: { x: 0.76, y: 0.56 },
    faceWest: { x: 0.71, y: 0.46 },
    l3: { x: 0.27, y: 0.7 },
    dpUp: { x: 0.24, y: 0.35 },
    dpDown: { x: 0.24, y: 0.56 },
    dpLeft: { x: 0.19, y: 0.46 },
    dpRight: { x: 0.3, y: 0.46 },
    r3: { x: 0.73, y: 0.7 },
  },
  dualsense: {
    l2: { x: 0.3, y: 0.06 },
    r2: { x: 0.7, y: 0.06 },
    l1: { x: 0.3, y: 0.19 },
    r1: { x: 0.7, y: 0.19 },
    touchpad: { x: 0.5, y: 0.33 },
    guide: { x: 0.5, y: 0.5 },
    mute: { x: 0.5, y: 0.57 },
    view: { x: 0.35, y: 0.44 },
    menu: { x: 0.65, y: 0.44 },
    faceNorth: { x: 0.76, y: 0.36 },
    faceEast: { x: 0.81, y: 0.46 },
    faceSouth: { x: 0.76, y: 0.56 },
    faceWest: { x: 0.71, y: 0.46 },
    l3: { x: 0.28, y: 0.7 },
    dpUp: { x: 0.24, y: 0.35 },
    dpDown: { x: 0.24, y: 0.56 },
    dpLeft: { x: 0.19, y: 0.46 },
    dpRight: { x: 0.3, y: 0.46 },
    r3: { x: 0.72, y: 0.7 },
  },
};

DEFAULT_POINTS.xboxseries = DEFAULT_POINTS.xboxone;

export const CALIBRATION_ORDER = [
  "faceNorth",
  "faceEast",
  "faceSouth",
  "faceWest",
  "l1",
  "r1",
  "l2",
  "r2",
  "l3",
  "r3",
  "dpUp",
  "dpRight",
  "dpDown",
  "dpLeft",
  "guide",
  "view",
  "menu",
] as const;
