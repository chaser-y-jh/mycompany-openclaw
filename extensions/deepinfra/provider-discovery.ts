import type { ProviderCatalogContext } from "merclaw/plugin-sdk/provider-catalog-shared";
import type { ProviderPlugin } from "merclaw/plugin-sdk/provider-model-shared";
import { buildDeepInfraApiKeyCatalog, buildStaticDeepInfraProvider } from "./provider-catalog.js";

const PROVIDER_ID = "deepinfra";

const deepinfraProviderDiscovery: ProviderPlugin = {
  id: PROVIDER_ID,
  label: "DeepInfra",
  docsPath: "/providers/deepinfra",
  auth: [],
  catalog: {
    order: "simple",
    run: (ctx: ProviderCatalogContext) => buildDeepInfraApiKeyCatalog(ctx),
  },
  staticCatalog: {
    order: "simple",
    run: async () => ({
      provider: buildStaticDeepInfraProvider(),
    }),
  },
};

export default deepinfraProviderDiscovery;
