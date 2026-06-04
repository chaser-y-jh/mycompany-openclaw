const COMMON_LIVE_ENV_NAMES = [
  "MERCLAW_AGENT_RUNTIME",
  "MERCLAW_CONFIG_PATH",
  "MERCLAW_GATEWAY_TOKEN",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "MERCLAW_SKIP_BROWSER_CONTROL_SERVER",
  "MERCLAW_SKIP_CANVAS_HOST",
  "MERCLAW_SKIP_CHANNELS",
  "MERCLAW_SKIP_CRON",
  "MERCLAW_SKIP_GMAIL_WATCHER",
  "MERCLAW_STATE_DIR",
] as const;

export type LiveEnvSnapshot = Record<string, string | undefined>;

export function snapshotLiveEnv(extraNames: readonly string[] = []): LiveEnvSnapshot {
  const snapshot: LiveEnvSnapshot = {};
  for (const name of [...COMMON_LIVE_ENV_NAMES, ...extraNames]) {
    snapshot[name] = process.env[name];
  }
  return snapshot;
}

export function restoreLiveEnv(snapshot: LiveEnvSnapshot): void {
  for (const [name, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}
