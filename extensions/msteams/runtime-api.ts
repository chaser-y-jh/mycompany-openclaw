// Private runtime barrel for the bundled Microsoft Teams extension.
// Keep this barrel thin and aligned with the local extension surface.

export { DEFAULT_ACCOUNT_ID } from "merclaw/plugin-sdk/account-id";
export type { AllowlistMatch } from "merclaw/plugin-sdk/allow-from";
export {
  mergeAllowlist,
  resolveAllowlistMatchSimple,
  summarizeMapping,
} from "merclaw/plugin-sdk/allow-from";
export type {
  BaseProbeResult,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelOutboundAdapter,
} from "merclaw/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "merclaw/plugin-sdk/channel-core";
export { logTypingFailure } from "merclaw/plugin-sdk/channel-outbound";
export { createChannelPairingController } from "merclaw/plugin-sdk/channel-pairing";
export { resolveToolsBySender } from "merclaw/plugin-sdk/channel-policy";
export { createChannelMessageReplyPipeline } from "merclaw/plugin-sdk/channel-outbound";
export {
  PAIRING_APPROVED_MESSAGE,
  buildProbeChannelStatusSummary,
  createDefaultChannelRuntimeState,
} from "merclaw/plugin-sdk/channel-status";
export {
  buildChannelKeyCandidates,
  normalizeChannelSlug,
  resolveChannelEntryMatchWithFallback,
  resolveNestedAllowlistDecision,
} from "merclaw/plugin-sdk/channel-targets";
export type {
  GroupPolicy,
  GroupToolPolicyConfig,
  MSTeamsChannelConfig,
  MSTeamsCloudName,
  MSTeamsConfig,
  MSTeamsReplyStyle,
  MSTeamsTeamConfig,
  MarkdownTableMode,
  MerClawConfig,
} from "merclaw/plugin-sdk/config-contracts";
export { isDangerousNameMatchingEnabled } from "merclaw/plugin-sdk/dangerous-name-runtime";
export { resolveDefaultGroupPolicy } from "merclaw/plugin-sdk/runtime-group-policy";
export { withFileLock } from "merclaw/plugin-sdk/file-lock";
export { keepHttpServerTaskAlive } from "merclaw/plugin-sdk/channel-outbound";
export {
  detectMime,
  extensionForMime,
  extractOriginalFilename,
  getFileExtension,
  resolveChannelMediaMaxBytes,
} from "merclaw/plugin-sdk/media-runtime";
export { dispatchReplyFromConfigWithSettledDispatcher } from "merclaw/plugin-sdk/channel-inbound";
export { loadOutboundMediaFromUrl } from "merclaw/plugin-sdk/outbound-media";
export { buildMediaPayload } from "merclaw/plugin-sdk/reply-payload";
export type { ReplyPayload } from "merclaw/plugin-sdk/reply-payload";
export type { PluginRuntime } from "merclaw/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "merclaw/plugin-sdk/runtime";
export type { SsrFPolicy } from "merclaw/plugin-sdk/ssrf-runtime";
export { fetchWithSsrFGuard } from "merclaw/plugin-sdk/ssrf-runtime";
export { normalizeStringEntries } from "merclaw/plugin-sdk/string-normalization-runtime";
export { chunkTextForOutbound } from "merclaw/plugin-sdk/text-chunking";
export { DEFAULT_WEBHOOK_MAX_BODY_BYTES } from "merclaw/plugin-sdk/webhook-ingress";
export { setMSTeamsRuntime } from "./src/runtime.js";
