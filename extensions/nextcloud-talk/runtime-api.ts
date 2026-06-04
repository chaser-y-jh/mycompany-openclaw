// Private runtime barrel for the bundled Nextcloud Talk extension.
// Keep this barrel thin and aligned with the local extension surface.

export type { AllowlistMatch } from "merclaw/plugin-sdk/allow-from";
export type { ChannelGroupContext } from "merclaw/plugin-sdk/channel-contract";
export { logInboundDrop } from "merclaw/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "merclaw/plugin-sdk/channel-pairing";
export type {
  BlockStreamingCoalesceConfig,
  DmConfig,
  DmPolicy,
  GroupPolicy,
  GroupToolPolicyConfig,
  MerClawConfig,
} from "merclaw/plugin-sdk/config-contracts";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "merclaw/plugin-sdk/runtime-group-policy";
export { createChannelMessageReplyPipeline } from "merclaw/plugin-sdk/channel-outbound";
export type { OutboundReplyPayload } from "merclaw/plugin-sdk/reply-payload";
export { deliverFormattedTextWithAttachments } from "merclaw/plugin-sdk/reply-payload";
export type { PluginRuntime } from "merclaw/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "merclaw/plugin-sdk/runtime";
export type { SecretInput } from "merclaw/plugin-sdk/secret-input";
export { fetchWithSsrFGuard } from "merclaw/plugin-sdk/ssrf-runtime";
export { setNextcloudTalkRuntime } from "./src/runtime.js";
