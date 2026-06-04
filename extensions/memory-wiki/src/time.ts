import { timestampMsToIsoString } from "merclaw/plugin-sdk/number-runtime";

export function resolveMemoryWikiTimestamp(nowMs?: number): string {
  return (
    timestampMsToIsoString(nowMs) ?? timestampMsToIsoString(Date.now()) ?? new Date().toISOString()
  );
}
