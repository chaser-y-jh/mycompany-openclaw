import type { AuthProfileStore, OAuthCredential } from "../agents/auth-profiles/types.js";
import type { ModelProviderAuthMode, ModelProviderConfig } from "../config/types.js";
import type { MerClawConfig } from "../config/types.merclaw.js";

export type ProviderResolveSyntheticAuthContext = {
  config?: MerClawConfig;
  provider: string;
  providerConfig?: ModelProviderConfig;
};

export type ProviderSyntheticAuthResult = {
  apiKey: string;
  source: string;
  mode: Exclude<ModelProviderAuthMode, "aws-sdk">;
  expiresAt?: number;
};

export type ProviderResolveExternalAuthProfilesContext = {
  config?: MerClawConfig;
  agentDir?: string;
  workspaceDir?: string;
  env: NodeJS.ProcessEnv;
  store: AuthProfileStore;
};

export type ProviderResolveExternalOAuthProfilesContext =
  ProviderResolveExternalAuthProfilesContext;

export type ProviderExternalAuthProfile = {
  profileId: string;
  credential: OAuthCredential;
  persistence?: "runtime-only" | "persisted";
};

export type ProviderExternalOAuthProfile = ProviderExternalAuthProfile;
