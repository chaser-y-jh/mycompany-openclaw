import type { MarkdownTableMode } from "./types.base.js";
import type { MerClawConfig } from "./types.merclaw.js";

export type ResolveMarkdownTableModeParams = {
  cfg?: Partial<MerClawConfig>;
  channel?: string | null;
  accountId?: string | null;
};

export type ResolveMarkdownTableMode = (
  params: ResolveMarkdownTableModeParams,
) => MarkdownTableMode;
