// Private runtime barrel for the bundled Twitch extension.
// Keep this barrel thin and aligned with the local extension surface.

export type {
  ChannelAccountSnapshot,
  ChannelCapabilities,
  ChannelGatewayContext,
  ChannelLogSink,
  ChannelMessageActionAdapter,
  ChannelMessageActionContext,
  ChannelMeta,
  ChannelOutboundAdapter,
  ChannelOutboundContext,
  ChannelResolveKind,
  ChannelResolveResult,
  ChannelStatusAdapter,
} from "merclaw/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "merclaw/plugin-sdk/channel-core";
export type { OutboundDeliveryResult } from "merclaw/plugin-sdk/channel-send-result";
export type { MerClawConfig } from "merclaw/plugin-sdk/config-contracts";
export type { RuntimeEnv } from "merclaw/plugin-sdk/runtime";
export type { WizardPrompter } from "merclaw/plugin-sdk/setup";
