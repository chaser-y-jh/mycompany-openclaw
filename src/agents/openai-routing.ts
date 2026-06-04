import { normalizeProviderId } from "@merclaw/model-catalog-core/provider-id";
import type { MerClawConfig } from "../config/types.merclaw.js";

export const OPENAI_PROVIDER_ID = "openai";
export const OPENAI_CODEX_PROVIDER_ID = OPENAI_PROVIDER_ID;

function isOfficialOpenAIBaseUrl(baseUrl: unknown): boolean {
  if (typeof baseUrl !== "string" || !baseUrl.trim()) {
    return true;
  }
  try {
    const url = new URL(baseUrl.trim());
    return (
      url.protocol === "https:" &&
      url.hostname.toLowerCase() === "api.openai.com" &&
      (url.pathname === "" ||
        url.pathname === "/" ||
        url.pathname === "/v1" ||
        url.pathname === "/v1/")
    );
  } catch {
    return false;
  }
}

function openAIProviderUsesCustomBaseUrl(config: MerClawConfig | undefined): boolean {
  return !isOfficialOpenAIBaseUrl(config?.models?.providers?.openai?.baseUrl);
}

export function isOpenAIProvider(provider: string | undefined): boolean {
  const normalized = normalizeProviderId(provider ?? "");
  return normalized === OPENAI_PROVIDER_ID;
}

export function openAIProviderUsesCodexRuntimeByDefault(params: {
  provider?: string;
  config?: MerClawConfig;
}): boolean {
  return isOpenAIProvider(params.provider) && !openAIProviderUsesCustomBaseUrl(params.config);
}

export function parseModelRefProvider(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const slashIndex = value.trim().indexOf("/");
  if (slashIndex <= 0) {
    return undefined;
  }
  return normalizeProviderId(value.trim().slice(0, slashIndex));
}

export function modelRefUsesOpenAIProvider(value: unknown): boolean {
  return parseModelRefProvider(value) === OPENAI_PROVIDER_ID;
}

export function modelSelectionShouldEnsureCodexPlugin(params: {
  model?: string;
  config?: MerClawConfig;
}): boolean {
  const provider = parseModelRefProvider(params.model);
  return provider === OPENAI_PROVIDER_ID && !openAIProviderUsesCustomBaseUrl(params.config);
}

export function listOpenAIAuthProfileProvidersForAgentRuntime(params: {
  provider: string;
  harnessRuntime?: string;
  agentHarnessId?: string;
  config?: MerClawConfig;
}): string[] {
  if (!isOpenAIProvider(params.provider)) {
    return [params.provider];
  }
  return [OPENAI_PROVIDER_ID];
}

export function resolveOpenAIRuntimeProvider(params: {
  provider: string;
  harnessRuntime?: string;
  agentHarnessId?: string;
  authProfileProvider?: string;
  authProfileId?: string;
  config?: MerClawConfig;
  workspaceDir?: string;
}): string {
  return isOpenAIProvider(params.provider) ? OPENAI_PROVIDER_ID : params.provider;
}

export function resolveSelectedOpenAIRuntimeProvider(params: {
  provider: string;
  harnessRuntime?: string;
  agentHarnessId?: string;
  authProfileProvider?: string;
  authProfileId?: string;
  config?: MerClawConfig;
  workspaceDir?: string;
}): string {
  return isOpenAIProvider(params.provider) ? OPENAI_PROVIDER_ID : params.provider;
}

export function resolveContextConfigProviderForRuntime(params: {
  provider: string;
  runtimeId?: string;
  config?: MerClawConfig;
}): string {
  return isOpenAIProvider(params.provider) ? OPENAI_PROVIDER_ID : params.provider;
}
