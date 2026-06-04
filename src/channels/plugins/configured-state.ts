import type { MerClawConfig } from "../../config/types.merclaw.js";
import type { PluginDiscoveryResult } from "../../plugins/discovery.js";
import {
  hasBundledChannelPackageState,
  listBundledChannelIdsForPackageState,
} from "./package-state-probes.js";

export function listBundledChannelIdsWithConfiguredState(
  discovery?: PluginDiscoveryResult,
): string[] {
  return listBundledChannelIdsForPackageState("configuredState", discovery);
}

export function hasBundledChannelConfiguredState(params: {
  channelId: string;
  cfg: MerClawConfig;
  env?: NodeJS.ProcessEnv;
  discovery?: PluginDiscoveryResult;
}): boolean {
  return hasBundledChannelPackageState({
    metadataKey: "configuredState",
    channelId: params.channelId,
    cfg: params.cfg,
    env: params.env,
    discovery: params.discovery,
  });
}
