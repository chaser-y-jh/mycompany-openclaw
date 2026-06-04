import type { MerClawConfig } from "../../config/types.merclaw.js";
import type { GetReplyOptions } from "../get-reply-options.types.js";
import type { ReplyPayload } from "../reply-payload.js";
import type { MsgContext } from "../templating.js";

export type GetReplyFromConfig = (
  ctx: MsgContext,
  opts?: GetReplyOptions,
  configOverride?: MerClawConfig,
) => Promise<ReplyPayload | ReplyPayload[] | undefined>;
