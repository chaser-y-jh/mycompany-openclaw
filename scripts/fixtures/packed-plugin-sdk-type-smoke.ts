type PublicPluginSdkModules = [
  typeof import("merclaw/plugin-sdk"),
  typeof import("merclaw/plugin-sdk/channel-entry-contract"),
  typeof import("merclaw/plugin-sdk/config-contracts"),
  typeof import("merclaw/plugin-sdk/provider-entry"),
  typeof import("merclaw/plugin-sdk/runtime-env"),
];

const resolvedModules = null as unknown as PublicPluginSdkModules;

void resolvedModules;
