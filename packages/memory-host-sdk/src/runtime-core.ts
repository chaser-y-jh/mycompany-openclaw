// Focused runtime contract for memory plugin config/state/helpers.

export type { AnyAgentTool } from "./host/merclaw-runtime-agent.js";
export { resolveCronStyleNow } from "./host/merclaw-runtime-agent.js";
export { DEFAULT_AGENT_COMPACTION_RESERVE_TOKENS_FLOOR } from "./host/merclaw-runtime-agent.js";
export { resolveDefaultAgentId, resolveSessionAgentId } from "./host/merclaw-runtime-agent.js";
export { resolveMemorySearchConfig } from "./host/merclaw-runtime-agent.js";
export {
  asToolParamsRecord,
  jsonResult,
  readNumberParam,
  readStringParam,
} from "./host/merclaw-runtime-agent.js";
export { SILENT_REPLY_TOKEN } from "./host/merclaw-runtime-session.js";
export { parseNonNegativeByteSize } from "./host/merclaw-runtime-config.js";
export {
  getRuntimeConfig,
  /** @deprecated Use getRuntimeConfig(), or pass the already loaded config through the call path. */
  loadConfig,
} from "./host/merclaw-runtime-config.js";
export { resolveStateDir } from "./host/merclaw-runtime-config.js";
export { resolveSessionTranscriptsDirForAgent } from "./host/merclaw-runtime-config.js";
export { emptyPluginConfigSchema } from "./host/merclaw-runtime-memory.js";
export {
  buildActiveMemoryPromptSection,
  getMemoryCapabilityRegistration,
  listActiveMemoryPublicArtifacts,
} from "./host/merclaw-runtime-memory.js";
export { parseAgentSessionKey } from "./host/merclaw-runtime-agent.js";
export type { MerClawConfig } from "./host/merclaw-runtime-config.js";
export type { MemoryCitationsMode } from "./host/merclaw-runtime-config.js";
export type {
  MemoryFlushPlan,
  MemoryFlushPlanResolver,
  MemoryPluginCapability,
  MemoryPluginPublicArtifact,
  MemoryPluginPublicArtifactsProvider,
  MemoryPluginRuntime,
  MemoryPromptSectionBuilder,
} from "./host/merclaw-runtime-memory.js";
export type { MerClawPluginApi } from "./host/merclaw-runtime-memory.js";
