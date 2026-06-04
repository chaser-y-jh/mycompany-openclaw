import { normalizeMerClawProviderIndex } from "./normalize.js";
import { MERCLAW_PROVIDER_INDEX } from "./merclaw-provider-index.js";
import type { MerClawProviderIndex } from "./types.js";

export function loadMerClawProviderIndex(
  source: unknown = MERCLAW_PROVIDER_INDEX,
): MerClawProviderIndex {
  return normalizeMerClawProviderIndex(source) ?? { version: 1, providers: {} };
}
