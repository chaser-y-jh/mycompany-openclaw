import { describePluginRegistrationContract } from "merclaw/plugin-sdk/plugin-test-contracts";

describePluginRegistrationContract({
  pluginId: "ollama",
  providerIds: ["ollama", "ollama-cloud"],
  webSearchProviderIds: ["ollama"],
});
