import { resolveDefaultModelForAgent } from "../agents/model-selection.js";
import type { MerClawConfig } from "../config/config.js";

export function resolveCommitmentDefaultModelRef(params: {
  cfg: MerClawConfig;
  agentId?: string;
}): { provider: string; model: string } {
  return resolveDefaultModelForAgent(params);
}
