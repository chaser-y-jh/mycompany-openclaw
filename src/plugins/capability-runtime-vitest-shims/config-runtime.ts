import { resolveActiveTalkProviderConfig } from "../../config/talk.js";
import type { MerClawConfig } from "../../config/types.js";

export { resolveActiveTalkProviderConfig };

export function getRuntimeConfigSnapshot(): MerClawConfig | null {
  return null;
}
