import type { MerClawConfig } from "merclaw/plugin-sdk/config-contracts";

export type WhatsAppAccountConfig = NonNullable<
  NonNullable<NonNullable<MerClawConfig["channels"]>["whatsapp"]>["accounts"]
>[string];
