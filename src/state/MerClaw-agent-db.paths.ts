import path from "node:path";
import { normalizeAgentId } from "../routing/session-key.js";
import { resolveMerClawStateSqliteDir } from "./merclaw-state-db.paths.js";

export type MerClawAgentSqlitePathOptions = {
  agentId: string;
  env?: NodeJS.ProcessEnv;
  path?: string;
};

export function resolveMerClawAgentSqlitePath(options: MerClawAgentSqlitePathOptions): string {
  const agentId = normalizeAgentId(options.agentId);
  return (
    options.path ??
    path.join(
      path.dirname(resolveMerClawStateSqliteDir(options.env ?? process.env)),
      "agents",
      agentId,
      "agent",
      "merclaw-agent.sqlite",
    )
  );
}

export function resolveMerClawAgentSqliteDir(options: MerClawAgentSqlitePathOptions): string {
  return path.dirname(resolveMerClawAgentSqlitePath(options));
}
