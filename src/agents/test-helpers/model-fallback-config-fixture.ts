import type { MerClawConfig } from "../../config/types.merclaw.js";

export function makeModelFallbackCfg(overrides: Partial<MerClawConfig> = {}): MerClawConfig {
  return {
    agents: {
      defaults: {
        model: {
          primary: "openai/gpt-4.1-mini",
          fallbacks: ["anthropic/claude-haiku-3-5"],
        },
      },
    },
    ...overrides,
  } as MerClawConfig;
}
