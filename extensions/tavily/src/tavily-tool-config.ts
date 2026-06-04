import type { MerClawConfig } from "merclaw/plugin-sdk/config-contracts";
import type { MerClawPluginToolContext } from "merclaw/plugin-sdk/plugin-entry";
import type { MerClawPluginApi } from "merclaw/plugin-sdk/plugin-runtime";

export type TavilyToolConfigContext = Pick<
  MerClawPluginToolContext,
  "config" | "runtimeConfig" | "getRuntimeConfig"
>;

export function resolveTavilyToolConfig(
  api: MerClawPluginApi,
  ctx?: TavilyToolConfigContext,
): MerClawConfig {
  return ctx?.getRuntimeConfig?.() ?? ctx?.runtimeConfig ?? ctx?.config ?? api.config;
}
