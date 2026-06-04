import type { MerClawConfig } from "merclaw/plugin-sdk/config-contracts";
import type { CommandArgValues } from "merclaw/plugin-sdk/native-command-registry";

export type DiscordConfig = NonNullable<MerClawConfig["channels"]>["discord"];

export type DiscordCommandArgs = {
  raw?: string;
  values?: CommandArgValues;
};
