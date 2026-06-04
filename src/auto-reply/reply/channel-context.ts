import {
  normalizeOptionalLowercaseString,
  normalizeOptionalString,
} from "@merclaw/normalization-core/string-coerce";
import type { MerClawConfig } from "../../config/types.merclaw.js";
import { getActivePluginChannelRegistry } from "../../plugins/runtime.js";

type CommandSurfaceParams = {
  ctx: {
    OriginatingChannel?: string;
    Surface?: string;
    Provider?: string;
    AccountId?: string;
  };
  command: {
    channel?: string;
  };
};

type ChannelAccountParams = {
  cfg: MerClawConfig;
  ctx: {
    OriginatingChannel?: string;
    Surface?: string;
    Provider?: string;
    AccountId?: string;
  };
  command: {
    channel?: string;
  };
};

export function resolveCommandSurfaceChannel(params: CommandSurfaceParams): string {
  const channel =
    params.ctx.OriginatingChannel ??
    params.command.channel ??
    params.ctx.Surface ??
    params.ctx.Provider;
  return normalizeOptionalLowercaseString(channel) ?? "";
}

export function resolveChannelAccountId(params: ChannelAccountParams): string {
  const accountId = normalizeOptionalString(params.ctx.AccountId) ?? "";
  if (accountId) {
    return accountId;
  }
  const channel = resolveCommandSurfaceChannel(params);
  const plugin = getActivePluginChannelRegistry()?.channels.find(
    (entry) => entry.plugin.id === channel,
  )?.plugin;
  const configuredDefault = normalizeOptionalString(plugin?.config.defaultAccountId?.(params.cfg));
  return configuredDefault || "default";
}
