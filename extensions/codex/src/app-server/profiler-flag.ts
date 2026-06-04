import type { MerClawConfig } from "merclaw/plugin-sdk/config-contracts";
import { isDiagnosticFlagEnabled } from "merclaw/plugin-sdk/diagnostic-runtime";

const PROFILER_FLAGS = ["profiler", "codex.profiler"] as const;

export function isCodexAppServerProfilerEnabled(
  config?: MerClawConfig,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return PROFILER_FLAGS.some((flag) => isDiagnosticFlagEnabled(flag, config, env));
}
