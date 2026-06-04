import {
  getRuntimeConfigSnapshot,
  getRuntimeConfigSourceSnapshot,
  selectApplicableRuntimeConfig,
} from "merclaw/plugin-sdk/runtime-config-snapshot";
import type { MerClawConfig } from "./runtime-api.js";

export function selectDiscordRuntimeConfig(inputConfig: MerClawConfig): MerClawConfig {
  return (
    selectApplicableRuntimeConfig({
      inputConfig,
      runtimeConfig: getRuntimeConfigSnapshot(),
      runtimeSourceConfig: getRuntimeConfigSourceSnapshot(),
    }) ?? inputConfig
  );
}
