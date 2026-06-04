import {
  applyAgentDefaultModelPrimary,
  type MerClawConfig,
} from "merclaw/plugin-sdk/provider-onboard";

export const OPENCODE_GO_DEFAULT_MODEL_REF = "opencode-go/kimi-k2.6";

export function applyOpencodeGoProviderConfig(cfg: MerClawConfig): MerClawConfig {
  return cfg;
}

export function applyOpencodeGoConfig(cfg: MerClawConfig): MerClawConfig {
  return applyAgentDefaultModelPrimary(
    applyOpencodeGoProviderConfig(cfg),
    OPENCODE_GO_DEFAULT_MODEL_REF,
  );
}
