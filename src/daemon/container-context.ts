import { normalizeOptionalString } from "@merclaw/normalization-core/string-coerce";

export function resolveDaemonContainerContext(
  env: Record<string, string | undefined> = process.env,
): string | null {
  return (
    normalizeOptionalString(env.MERCLAW_CONTAINER_HINT) ||
    normalizeOptionalString(env.MERCLAW_CONTAINER) ||
    null
  );
}
