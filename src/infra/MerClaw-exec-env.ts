export const MERCLAW_CLI_ENV_VAR = "MERCLAW_CLI";
export const MERCLAW_CLI_ENV_VALUE = "1";

export function markMerClawExecEnv<T extends Record<string, string | undefined>>(env: T): T {
  return {
    ...env,
    [MERCLAW_CLI_ENV_VAR]: MERCLAW_CLI_ENV_VALUE,
  };
}

export function ensureMerClawExecMarkerOnProcess(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  env[MERCLAW_CLI_ENV_VAR] = MERCLAW_CLI_ENV_VALUE;
  return env;
}
