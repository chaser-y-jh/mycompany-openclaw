import type { MerClawConfig } from "merclaw/plugin-sdk/config-contracts";
import { inspectDiscordAccount } from "./src/account-inspect.js";

export function inspectDiscordReadOnlyAccount(cfg: MerClawConfig, accountId?: string | null) {
  return inspectDiscordAccount({ cfg, accountId });
}
