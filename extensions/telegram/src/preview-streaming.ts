import {
  resolveChannelPreviewStreamMode,
  type StreamingMode,
} from "merclaw/plugin-sdk/channel-outbound";

type TelegramPreviewStreamMode = StreamingMode;

export function resolveTelegramPreviewStreamMode(
  params: {
    streamMode?: unknown;
    streaming?: unknown;
  } = {},
): TelegramPreviewStreamMode {
  return resolveChannelPreviewStreamMode(params, "partial");
}
