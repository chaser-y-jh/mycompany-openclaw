import type { MerClawConfig } from "merclaw/plugin-sdk/config-contracts";

export function makeQqbotSecretRefConfig(): MerClawConfig {
  return {
    channels: {
      qqbot: {
        appId: "123456",
        clientSecret: {
          source: "env",
          provider: "default",
          id: "QQBOT_CLIENT_SECRET",
        },
      },
    },
  } as MerClawConfig;
}

export function makeQqbotDefaultAccountConfig(): MerClawConfig {
  return {
    channels: {
      qqbot: {
        defaultAccount: "bot2",
        accounts: {
          bot2: { appId: "123456" },
        },
      },
    },
  } as MerClawConfig;
}
