import { asOptionalObjectRecord as readRecord } from "@merclaw/normalization-core/record-coerce";
import type { MerClawConfig } from "../config/types.merclaw.js";
import { normalizePluginsConfig } from "../plugins/config-state.js";
import { passesManifestOwnerBasePolicy } from "../plugins/manifest-owner-policy.js";
import { loadBundledPluginPublicArtifactModuleSync } from "../plugins/public-surface-loader.js";
import { registerHealthCheck } from "./health-check-registry.js";

type BundledHealthApi = {
  registerPolicyDoctorChecks?: (host: { registerHealthCheck: typeof registerHealthCheck }) => void;
};

export function registerBundledHealthChecks(params: { cfg: MerClawConfig; cwd?: string }): void {
  if (!shouldRegisterPolicyHealth(params)) {
    return;
  }
  loadBundledPluginPublicArtifactModuleSync<BundledHealthApi>({
    dirName: "policy",
    artifactBasename: "api.js",
  }).registerPolicyDoctorChecks?.({ registerHealthCheck });
}

function shouldRegisterPolicyHealth(params: { cfg: MerClawConfig; cwd?: string }): boolean {
  const entry = params.cfg.plugins?.entries?.policy;
  const config = readRecord(entry?.config) ?? {};
  if (entry === undefined || entry.enabled === false || config.enabled === false) {
    return false;
  }
  if (
    !passesManifestOwnerBasePolicy({
      plugin: { id: "policy" },
      normalizedConfig: normalizePluginsConfig(params.cfg.plugins),
    })
  ) {
    return false;
  }
  return entry.enabled === true || config.enabled === true;
}
