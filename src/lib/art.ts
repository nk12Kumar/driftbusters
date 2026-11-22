import type { DeviceInfo, Family } from "./types";
import { getSettings } from "./settings";

/** Illustration family: the user's manual choice wins, otherwise the detected model. */
export function artFamily(device: DeviceInfo | null | undefined): Family {
  if (!device) return "generic";
  const override = getSettings().artOverride;
  return override === "auto" ? device.family : (override as Family);
}
