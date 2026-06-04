import { resolveIsNixMode } from "./paths.js";

export const NIX_MERCLAW_AGENT_FIRST_URL = "https://github.com/merclaw/nix-merclaw#quick-start";
export const MERCLAW_NIX_OVERVIEW_URL = "https://docs.merclaw.ai/install/nix";

export class NixModeConfigMutationError extends Error {
  readonly code = "MERCLAW_NIX_MODE_CONFIG_IMMUTABLE";

  constructor(params: { configPath?: string } = {}) {
    super(formatNixModeConfigMutationMessage(params));
    this.name = "NixModeConfigMutationError";
  }
}

export function formatNixModeConfigMutationMessage(params: { configPath?: string } = {}): string {
  return [
    "Config is managed by Nix (`MERCLAW_NIX_MODE=1`), so MerClaw treats merclaw.json as immutable.",
    "This usually means nix-merclaw, the first-party Nix distribution, or another Nix-managed package set this mode.",
    ...(params.configPath ? [`Config path: ${params.configPath}`] : []),
    "Do not run setup, onboarding, merclaw update, plugin install/update/uninstall/enable, doctor repair/token-generation, or config set against this file.",
    "Edit the Nix source for this install instead. For nix-merclaw, edit `programs.merclaw.config` or `instances.<name>.config`, then rebuild with Home Manager or NixOS.",
    `Agent-first Nix setup: ${NIX_MERCLAW_AGENT_FIRST_URL}`,
    `MerClaw Nix overview: ${MERCLAW_NIX_OVERVIEW_URL}`,
  ].join("\n");
}

export function assertConfigWriteAllowedInCurrentMode(
  params: {
    configPath?: string;
    env?: NodeJS.ProcessEnv;
  } = {},
): void {
  if (!resolveIsNixMode(params.env)) {
    return;
  }
  throw new NixModeConfigMutationError({ configPath: params.configPath });
}
