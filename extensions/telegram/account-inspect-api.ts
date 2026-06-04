import type { MerClawConfig } from "./runtime-api.js";
import { inspectTelegramAccount } from "./src/account-inspect.js";

export function inspectTelegramReadOnlyAccount(cfg: MerClawConfig, accountId?: string | null) {
  return inspectTelegramAccount({ cfg, accountId });
}
