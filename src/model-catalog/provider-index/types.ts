import type { ModelCatalogProvider } from "@merclaw/model-catalog-core/model-catalog-types";

export type MerClawProviderIndexPluginInstall = {
  clawhubSpec?: string;
  npmSpec?: string;
  defaultChoice?: "clawhub" | "npm";
  minHostVersion?: string;
  expectedIntegrity?: string;
};

export type MerClawProviderIndexPlugin = {
  id: string;
  package?: string;
  source?: string;
  install?: MerClawProviderIndexPluginInstall;
};

export type MerClawProviderIndexProviderAuthChoice = {
  method: string;
  choiceId: string;
  choiceLabel: string;
  choiceHint?: string;
  assistantPriority?: number;
  assistantVisibility?: "visible" | "manual-only";
  groupId?: string;
  groupLabel?: string;
  groupHint?: string;
  optionKey?: string;
  cliFlag?: string;
  cliOption?: string;
  cliDescription?: string;
  onboardingScopes?: readonly ("text-inference" | "image-generation" | "music-generation")[];
};

export type MerClawProviderIndexProvider = {
  id: string;
  name: string;
  plugin: MerClawProviderIndexPlugin;
  docs?: string;
  categories?: readonly string[];
  authChoices?: readonly MerClawProviderIndexProviderAuthChoice[];
  previewCatalog?: ModelCatalogProvider;
};

export type MerClawProviderIndex = {
  version: number;
  providers: Readonly<Record<string, MerClawProviderIndexProvider>>;
};
