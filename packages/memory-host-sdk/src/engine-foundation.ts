// Real workspace contract for memory engine foundation concerns.

export {
  resolveAgentContextLimits,
  resolveAgentDir,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
  resolveSessionAgentId,
} from "./host/merclaw-runtime-agent.js";
export {
  resolveMemorySearchConfig,
  resolveMemorySearchSyncConfig,
  type ResolvedMemorySearchConfig,
  type ResolvedMemorySearchSyncConfig,
} from "./host/merclaw-runtime-agent.js";
export { parseDurationMs } from "./host/merclaw-runtime-config.js";
export { loadConfig } from "./host/merclaw-runtime-config.js";
export { resolveStateDir } from "./host/merclaw-runtime-config.js";
export { resolveSessionTranscriptsDirForAgent } from "./host/merclaw-runtime-config.js";
export {
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
} from "./host/merclaw-runtime-config.js";
export { root } from "./host/merclaw-runtime-io.js";
export { isPathInside } from "./host/fs-utils.js";
export { createSubsystemLogger } from "./host/merclaw-runtime-io.js";
export { detectMime } from "./host/merclaw-runtime-io.js";
export { resolveGlobalSingleton } from "./host/merclaw-runtime-io.js";
export { onSessionTranscriptUpdate } from "./host/merclaw-runtime-session.js";
export { splitShellArgs } from "./host/merclaw-runtime-io.js";
export { runTasksWithConcurrency } from "./host/merclaw-runtime-io.js";
export {
  shortenHomeInString,
  shortenHomePath,
  resolveUserPath,
  truncateUtf16Safe,
} from "./host/merclaw-runtime-io.js";
export type { MerClawConfig } from "./host/merclaw-runtime-config.js";
export type { SessionSendPolicyConfig } from "./host/merclaw-runtime-config.js";
export type { SecretInput } from "./host/merclaw-runtime-config.js";
export type {
  MemoryBackend,
  MemoryCitationsMode,
  MemoryQmdConfig,
  MemoryQmdIndexPath,
  MemoryQmdMcporterConfig,
  MemoryQmdSearchMode,
} from "./host/merclaw-runtime-config.js";
export type { MemorySearchConfig } from "./host/merclaw-runtime-config.js";
