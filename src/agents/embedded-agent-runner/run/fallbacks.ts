import type { MerClawConfig } from "../../../config/types.merclaw.js";
import { hasConfiguredModelFallbacks } from "../../agent-scope.js";

export function hasEmbeddedRunConfiguredModelFallbacks(params: {
  cfg: MerClawConfig | undefined;
  agentId?: string | null;
  sessionKey?: string | null;
  modelFallbacksOverride?: string[];
}): boolean {
  if (params.modelFallbacksOverride !== undefined) {
    return params.modelFallbacksOverride.length > 0;
  }
  return hasConfiguredModelFallbacks({
    cfg: params.cfg,
    agentId: params.agentId,
    sessionKey: params.sessionKey,
  });
}
