import type { MerClawConfig } from "merclaw/plugin-sdk/config-contracts";
import { inspectSlackAccount } from "./src/account-inspect.js";

export function inspectSlackReadOnlyAccount(cfg: MerClawConfig, accountId?: string | null) {
  return inspectSlackAccount({ cfg, accountId });
}
