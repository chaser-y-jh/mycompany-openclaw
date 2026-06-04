import type { MerClawConfig } from "merclaw/plugin-sdk/config-contracts";

export type IMessageAccountConfig = Omit<
  NonNullable<NonNullable<MerClawConfig["channels"]>["imessage"]>,
  "accounts" | "defaultAccount"
>;
