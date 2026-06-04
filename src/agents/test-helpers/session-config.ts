import type { MerClawConfig } from "../../config/types.merclaw.js";

export function createPerSenderSessionConfig(
  overrides: Partial<NonNullable<MerClawConfig["session"]>> = {},
): NonNullable<MerClawConfig["session"]> {
  return {
    mainKey: "main",
    scope: "per-sender",
    ...overrides,
  };
}
