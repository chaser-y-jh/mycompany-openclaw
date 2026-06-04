import { describePluginRegistrationContract } from "merclaw/plugin-sdk/plugin-test-contracts";

describePluginRegistrationContract({
  pluginId: "pixverse",
  videoGenerationProviderIds: ["pixverse"],
  requireGenerateVideo: true,
});
