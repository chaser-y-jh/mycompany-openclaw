import type { WebSearchProviderPlugin } from "merclaw/plugin-sdk/provider-web-search-contract";
import { buildTavilyWebSearchProviderBase } from "./web-search-shared.js";

export function createTavilyWebSearchProvider(): WebSearchProviderPlugin {
  return {
    ...buildTavilyWebSearchProviderBase(),
    createTool: () => null,
  };
}
