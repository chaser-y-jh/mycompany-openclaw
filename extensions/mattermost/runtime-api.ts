// Private runtime barrel for the bundled Mattermost extension.
// Keep this barrel thin and generic-only.

export type {
  BaseProbeResult,
  ChannelAccountSnapshot,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelPlugin,
  ChatType,
  HistoryEntry,
  MerClawConfig,
  MerClawPluginApi,
  PluginRuntime,
} from "merclaw/plugin-sdk/core";
export type { RuntimeEnv } from "merclaw/plugin-sdk/runtime";
export type { ReplyPayload } from "merclaw/plugin-sdk/reply-runtime";
export type { ModelsProviderData } from "merclaw/plugin-sdk/models-provider-runtime";
export type {
  BlockStreamingCoalesceConfig,
  DmPolicy,
  GroupPolicy,
} from "merclaw/plugin-sdk/config-contracts";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createDedupeCache,
  parseStrictPositiveInteger,
  resolveClientIp,
  isTrustedProxyAddress,
} from "merclaw/plugin-sdk/core";
export { buildComputedAccountStatusSnapshot } from "merclaw/plugin-sdk/channel-status";
export { createAccountStatusSink } from "merclaw/plugin-sdk/channel-outbound";
export { buildAgentMediaPayload } from "merclaw/plugin-sdk/agent-media-payload";
export {
  listSkillCommandsForAgents,
  resolveControlCommandGate,
  resolveStoredModelOverride,
} from "merclaw/plugin-sdk/command-auth-native";
export { buildModelsProviderData } from "merclaw/plugin-sdk/models-provider-runtime";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "merclaw/plugin-sdk/runtime-group-policy";
export { isDangerousNameMatchingEnabled } from "merclaw/plugin-sdk/dangerous-name-runtime";
export { loadSessionStore, resolveStorePath } from "merclaw/plugin-sdk/session-store-runtime";
export { formatInboundFromLabel } from "merclaw/plugin-sdk/channel-inbound";
export { logInboundDrop } from "merclaw/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "merclaw/plugin-sdk/channel-pairing";
export { createChannelMessageReplyPipeline } from "merclaw/plugin-sdk/channel-outbound";
export { logTypingFailure } from "merclaw/plugin-sdk/channel-feedback";
export { loadOutboundMediaFromUrl } from "merclaw/plugin-sdk/outbound-media";
export { rawDataToString } from "merclaw/plugin-sdk/webhook-ingress";
export { chunkTextForOutbound } from "merclaw/plugin-sdk/text-chunking";
// Legacy map-helper exports stay for older plugin consumers. New message-turn
// code should use createChannelHistoryWindow.
export {
  DEFAULT_GROUP_HISTORY_LIMIT,
  createChannelHistoryWindow,
  buildPendingHistoryContextFromMap,
  clearHistoryEntriesIfEnabled,
  recordPendingHistoryEntryIfEnabled,
} from "merclaw/plugin-sdk/reply-history";
export { normalizeAccountId, resolveThreadSessionKeys } from "merclaw/plugin-sdk/routing";
export { resolveAllowlistMatchSimple } from "merclaw/plugin-sdk/allow-from";
export { registerPluginHttpRoute } from "merclaw/plugin-sdk/webhook-targets";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
} from "merclaw/plugin-sdk/webhook-ingress";
export {
  applyAccountNameToChannelSection,
  applySetupAccountConfigPatch,
  migrateBaseNameToDefaultAccount,
} from "merclaw/plugin-sdk/setup";
export {
  getAgentScopedMediaLocalRoots,
  resolveChannelMediaMaxBytes,
} from "merclaw/plugin-sdk/media-runtime";
export { normalizeProviderId } from "merclaw/plugin-sdk/provider-model-shared";
export { setMattermostRuntime } from "./src/runtime.js";
