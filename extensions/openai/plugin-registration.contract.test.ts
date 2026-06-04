import { pluginRegistrationContractCases } from "merclaw/plugin-sdk/plugin-test-contracts";
import { describePluginRegistrationContract } from "merclaw/plugin-sdk/plugin-test-contracts";

describePluginRegistrationContract({
  ...pluginRegistrationContractCases.openai,
  videoGenerationProviderIds: ["openai"],
  requireGenerateImage: true,
  requireGenerateVideo: true,
});
