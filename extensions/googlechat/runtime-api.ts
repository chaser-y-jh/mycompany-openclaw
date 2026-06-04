// Private runtime barrel for the bundled Google Chat extension.
// Keep this barrel thin and avoid broad plugin-sdk surfaces during bootstrap.

export { DEFAULT_ACCOUNT_ID } from "merclaw/plugin-sdk/account-id";
export {
  createActionGate,
  jsonResult,
  readNumberParam,
  readReactionParams,
  readStringParam,
} from "merclaw/plugin-sdk/channel-actions";
export { buildChannelConfigSchema } from "merclaw/plugin-sdk/channel-config-primitives";
export type {
  ChannelMessageActionAdapter,
  ChannelMessageActionName,
  ChannelStatusIssue,
} from "merclaw/plugin-sdk/channel-contract";
export { missingTargetError } from "merclaw/plugin-sdk/channel-feedback";
export {
  createAccountStatusSink,
  runPassiveAccountLifecycle,
} from "merclaw/plugin-sdk/channel-outbound";
export { createChannelPairingController } from "merclaw/plugin-sdk/channel-pairing";
export { createChannelMessageReplyPipeline } from "merclaw/plugin-sdk/channel-outbound";
export { PAIRING_APPROVED_MESSAGE } from "merclaw/plugin-sdk/channel-status";
export { chunkTextForOutbound } from "merclaw/plugin-sdk/text-chunking";
export type { MerClawConfig } from "merclaw/plugin-sdk/config-contracts";
export { GoogleChatConfigSchema } from "merclaw/plugin-sdk/bundled-channel-config-schema";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "merclaw/plugin-sdk/runtime-group-policy";
export { isDangerousNameMatchingEnabled } from "merclaw/plugin-sdk/dangerous-name-runtime";
export {
  readRemoteMediaBuffer,
  resolveChannelMediaMaxBytes,
} from "merclaw/plugin-sdk/media-runtime";
export { loadOutboundMediaFromUrl } from "merclaw/plugin-sdk/outbound-media";
export type { PluginRuntime } from "merclaw/plugin-sdk/runtime-store";
export { fetchWithSsrFGuard } from "merclaw/plugin-sdk/ssrf-runtime";
export type {
  GoogleChatAccountConfig,
  GoogleChatConfig,
} from "merclaw/plugin-sdk/config-contracts";
export { extractToolSend } from "merclaw/plugin-sdk/tool-send";
export { resolveInboundMentionDecision } from "merclaw/plugin-sdk/channel-inbound";
export { resolveInboundRouteEnvelopeBuilderWithRuntime } from "merclaw/plugin-sdk/inbound-envelope";
export { resolveWebhookPath } from "merclaw/plugin-sdk/webhook-ingress";
export {
  registerWebhookTargetWithPluginRoute,
  resolveWebhookTargetWithAuthOrReject,
  withResolvedWebhookRequestPipeline,
} from "merclaw/plugin-sdk/webhook-targets";
export {
  createWebhookInFlightLimiter,
  readJsonWebhookBodyOrReject,
  type WebhookInFlightLimiter,
} from "merclaw/plugin-sdk/webhook-request-guards";
export { setGoogleChatRuntime } from "./src/runtime.js";
