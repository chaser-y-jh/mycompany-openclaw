import type { MerClawConfig } from "../../config/types.js";

export type DirectoryConfigParams = {
  cfg: MerClawConfig;
  accountId?: string | null;
  query?: string | null;
  limit?: number | null;
};
