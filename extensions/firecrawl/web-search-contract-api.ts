import type { WebSearchProviderPlugin } from "merclaw/plugin-sdk/provider-web-search-contract";
import { buildFirecrawlWebSearchProviderBase } from "./web-search-shared.js";

export function createFirecrawlWebSearchProvider(): WebSearchProviderPlugin {
  return {
    ...buildFirecrawlWebSearchProviderBase(),
    createTool: () => null,
  };
}
