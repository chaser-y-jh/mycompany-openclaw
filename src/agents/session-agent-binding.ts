import {
  normalizeLowercaseStringOrEmpty,
  normalizeOptionalString,
} from "@merclaw/normalization-core/string-coerce";
import type { MerClawConfig } from "../config/types.merclaw.js";
import {
  parseAgentSessionKey,
  normalizeAgentId,
  normalizeMainKey,
} from "../routing/session-key.js";
import { resolveDefaultAgentId } from "./agent-scope.js";

/**
 * Resolve the trusted active agent bound to a host-owned session reference.
 */
export function resolveBoundAgentIdForSession(params: {
  config?: MerClawConfig;
  sessionKey?: string;
  agentId?: string;
}): string | undefined {
  const explicitAgentId = normalizeOptionalString(params.agentId);
  if (explicitAgentId) {
    return normalizeAgentId(explicitAgentId);
  }

  const normalizedSessionKey = normalizeOptionalString(params.sessionKey);
  if (!normalizedSessionKey) {
    return undefined;
  }

  const parsed = parseAgentSessionKey(normalizedSessionKey);
  if (parsed?.agentId) {
    return normalizeAgentId(parsed.agentId);
  }

  const loweredSessionKey = normalizeLowercaseStringOrEmpty(normalizedSessionKey);
  const mainKey = normalizeMainKey(params.config?.session?.mainKey);
  if (loweredSessionKey === "main" || loweredSessionKey === mainKey) {
    return resolveDefaultAgentId(params.config ?? {});
  }
  return undefined;
}
