import { buildManifestModelProviderConfig } from "merclaw/plugin-sdk/provider-catalog-shared";
import type { ModelProviderConfig } from "merclaw/plugin-sdk/provider-model-shared";
import manifest from "./merclaw.plugin.json" with { type: "json" };

export function buildMistralProvider(): ModelProviderConfig {
  return buildManifestModelProviderConfig({
    providerId: "mistral",
    catalog: manifest.modelCatalog.providers.mistral,
  });
}
