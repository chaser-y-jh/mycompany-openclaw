import type { ReplyPayload } from "../../auto-reply/reply-payload.js";
import type { MerClawConfig } from "../../config/types.merclaw.js";
import { hasActiveApprovalNativeRouteRuntime } from "../../infra/approval-native-route-coordinator.js";
import { getChannelPlugin, normalizeChannelId } from "./registry.js";

export function shouldSuppressLocalExecApprovalPrompt(params: {
  channel?: string | null;
  cfg: MerClawConfig;
  accountId?: string | null;
  payload: ReplyPayload;
}): boolean {
  const channel = params.channel ? normalizeChannelId(params.channel) : null;
  if (!channel) {
    return false;
  }
  return (
    getChannelPlugin(channel)?.outbound?.shouldSuppressLocalPayloadPrompt?.({
      cfg: params.cfg,
      accountId: params.accountId,
      payload: params.payload,
      hint: {
        kind: "approval-pending",
        approvalKind: "exec",
        nativeRouteActive: hasActiveApprovalNativeRouteRuntime({
          channel,
          accountId: params.accountId,
          approvalKind: "exec",
        }),
      },
    }) ?? false
  );
}
