import type { MerClawConfig } from "merclaw/plugin-sdk/config-contracts";

export type SignalAccountConfig = Omit<
  Exclude<NonNullable<MerClawConfig["channels"]>["signal"], undefined>,
  "accounts"
>;
