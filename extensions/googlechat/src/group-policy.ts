import { resolveChannelGroupRequireMention } from "merclaw/plugin-sdk/channel-policy";
import type { MerClawConfig } from "merclaw/plugin-sdk/core";

type GoogleChatGroupContext = {
  cfg: MerClawConfig;
  accountId?: string | null;
  groupId?: string | null;
};

export function resolveGoogleChatGroupRequireMention(params: GoogleChatGroupContext): boolean {
  return resolveChannelGroupRequireMention({
    cfg: params.cfg,
    channel: "googlechat",
    groupId: params.groupId,
    accountId: params.accountId,
  });
}
