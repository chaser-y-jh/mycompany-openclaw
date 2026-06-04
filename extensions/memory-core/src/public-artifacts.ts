import {
  listMemoryHostPublicArtifacts,
  type MemoryPluginPublicArtifact,
} from "merclaw/plugin-sdk/memory-host-core";
import type { MerClawConfig } from "../api.js";

export async function listMemoryCorePublicArtifacts(params: {
  cfg: MerClawConfig;
}): Promise<MemoryPluginPublicArtifact[]> {
  return await listMemoryHostPublicArtifacts(params);
}
