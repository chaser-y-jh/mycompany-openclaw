// Narrow Matrix monitor helper seam.
// Keep monitor internals off the broad package runtime-api barrel so monitor
// tests and shared workers do not pull unrelated Matrix helper surfaces.

export type { NormalizedLocation } from "merclaw/plugin-sdk/channel-inbound";
export type { PluginRuntime, RuntimeLogger } from "merclaw/plugin-sdk/plugin-runtime";
export type { BlockReplyContext, ReplyPayload } from "merclaw/plugin-sdk/reply-runtime";
export type { MarkdownTableMode, MerClawConfig } from "merclaw/plugin-sdk/config-contracts";
export type { RuntimeEnv } from "merclaw/plugin-sdk/runtime";
export {
  addAllowlistUserEntriesFromConfigEntry,
  buildAllowlistResolutionSummary,
  canonicalizeAllowlistWithResolvedIds,
  formatAllowlistMatchMeta,
  patchAllowlistUsersInConfigEntries,
  summarizeMapping,
} from "merclaw/plugin-sdk/allow-from";
export {
  createReplyPrefixOptions,
  createTypingCallbacks,
} from "merclaw/plugin-sdk/channel-outbound";
export { formatLocationText, toLocationContext } from "merclaw/plugin-sdk/channel-inbound";
export { getAgentScopedMediaLocalRoots } from "merclaw/plugin-sdk/agent-media-payload";
export { logInboundDrop } from "merclaw/plugin-sdk/channel-inbound";
export { logTypingFailure } from "merclaw/plugin-sdk/channel-outbound";
export {
  buildChannelKeyCandidates,
  resolveChannelEntryMatch,
} from "merclaw/plugin-sdk/channel-targets";
