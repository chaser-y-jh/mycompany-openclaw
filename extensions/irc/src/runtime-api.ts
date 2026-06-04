// Private runtime barrel for the bundled IRC extension.
// Keep this barrel thin and generic-only.

export type { BaseProbeResult } from "merclaw/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "merclaw/plugin-sdk/channel-core";
export type { MerClawConfig } from "merclaw/plugin-sdk/config-contracts";
export type { PluginRuntime } from "merclaw/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "merclaw/plugin-sdk/runtime";
export type {
  BlockStreamingCoalesceConfig,
  DmConfig,
  DmPolicy,
  GroupPolicy,
  GroupToolPolicyBySenderConfig,
  GroupToolPolicyConfig,
  MarkdownConfig,
} from "merclaw/plugin-sdk/config-contracts";
export type { OutboundReplyPayload } from "merclaw/plugin-sdk/reply-payload";
export { DEFAULT_ACCOUNT_ID } from "merclaw/plugin-sdk/account-id";
export { buildChannelConfigSchema } from "merclaw/plugin-sdk/channel-config-primitives";
export {
  PAIRING_APPROVED_MESSAGE,
  buildBaseChannelStatusSummary,
} from "merclaw/plugin-sdk/channel-status";
export { createChannelPairingController } from "merclaw/plugin-sdk/channel-pairing";
export { createAccountStatusSink } from "merclaw/plugin-sdk/channel-outbound";
export { resolveControlCommandGate } from "merclaw/plugin-sdk/command-auth-native";
export { createChannelMessageReplyPipeline } from "merclaw/plugin-sdk/channel-outbound";
export { chunkTextForOutbound } from "merclaw/plugin-sdk/text-chunking";
export {
  deliverFormattedTextWithAttachments,
  formatTextWithAttachmentLinks,
  resolveOutboundMediaUrls,
} from "merclaw/plugin-sdk/reply-payload";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "merclaw/plugin-sdk/runtime-group-policy";
export { isDangerousNameMatchingEnabled } from "merclaw/plugin-sdk/dangerous-name-runtime";
export { logInboundDrop } from "merclaw/plugin-sdk/channel-inbound";
