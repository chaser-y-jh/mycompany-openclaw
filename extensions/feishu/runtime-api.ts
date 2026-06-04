// Private runtime barrel for the bundled Feishu extension.
// Keep this barrel thin and generic-only.

export type {
  AllowlistMatch,
  AnyAgentTool,
  BaseProbeResult,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelMeta,
  ChannelOutboundAdapter,
  ChannelPlugin,
  HistoryEntry,
  MerClawConfig,
  MerClawPluginApi,
  OutboundIdentity,
  PluginRuntime,
  ReplyPayload,
} from "merclaw/plugin-sdk/core";
export type { MerClawConfig as ClawdbotConfig } from "merclaw/plugin-sdk/core";
export type { RuntimeEnv } from "merclaw/plugin-sdk/runtime";
export type { GroupToolPolicyConfig } from "merclaw/plugin-sdk/config-contracts";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createActionGate,
  createDedupeCache,
} from "merclaw/plugin-sdk/core";
export {
  PAIRING_APPROVED_MESSAGE,
  buildProbeChannelStatusSummary,
  createDefaultChannelRuntimeState,
} from "merclaw/plugin-sdk/channel-status";
export { buildAgentMediaPayload } from "merclaw/plugin-sdk/agent-media-payload";
export { createChannelPairingController } from "merclaw/plugin-sdk/channel-pairing";
export { createReplyPrefixContext } from "merclaw/plugin-sdk/channel-outbound";
export {
  evaluateSupplementalContextVisibility,
  filterSupplementalContextItems,
  resolveChannelContextVisibilityMode,
} from "merclaw/plugin-sdk/context-visibility-runtime";
export {
  loadSessionStore,
  resolveSessionStoreEntry,
} from "merclaw/plugin-sdk/session-store-runtime";
export { readJsonFileWithFallback } from "merclaw/plugin-sdk/json-store";
export { normalizeAgentId } from "merclaw/plugin-sdk/routing";
export { chunkTextForOutbound } from "merclaw/plugin-sdk/text-chunking";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  requestBodyErrorToText,
} from "merclaw/plugin-sdk/webhook-ingress";
export { setFeishuRuntime } from "./src/runtime.js";
