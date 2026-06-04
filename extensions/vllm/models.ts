import type { MerClawConfig } from "merclaw/plugin-sdk/config-contracts";
import { discoverOpenAICompatibleLocalModels } from "merclaw/plugin-sdk/provider-setup";
import { VLLM_DEFAULT_BASE_URL, VLLM_PROVIDER_LABEL } from "./defaults.js";

type ModelsConfig = NonNullable<MerClawConfig["models"]>;
type ProviderConfig = NonNullable<ModelsConfig["providers"]>[string];

export async function buildVllmProvider(params?: {
  baseUrl?: string;
  apiKey?: string;
}): Promise<ProviderConfig> {
  const baseUrl = (params?.baseUrl?.trim() || VLLM_DEFAULT_BASE_URL).replace(/\/+$/, "");
  const models = await discoverOpenAICompatibleLocalModels({
    baseUrl,
    apiKey: params?.apiKey,
    label: VLLM_PROVIDER_LABEL,
  });
  return {
    baseUrl,
    api: "openai-completions",
    models,
  };
}
