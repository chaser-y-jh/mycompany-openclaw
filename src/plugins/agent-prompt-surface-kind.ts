import type { AgentPromptSurfaceKind } from "./types.js";

export function normalizeAgentPromptSurfaceKind(
  surface: AgentPromptSurfaceKind,
): AgentPromptSurfaceKind {
  return surface === "pi_main" ? "merclaw_main" : surface;
}

export function isMerClawMainPromptSurface(surface: AgentPromptSurfaceKind): boolean {
  return normalizeAgentPromptSurfaceKind(surface) === "merclaw_main";
}
