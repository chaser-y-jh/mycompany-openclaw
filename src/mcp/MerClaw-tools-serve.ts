/**
 * Standalone MCP server for selected built-in MerClaw tools.
 *
 * Run via: node --import tsx src/mcp/merclaw-tools-serve.ts
 * Or: bun src/mcp/merclaw-tools-serve.ts
 */
import { pathToFileURL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { AnyAgentTool } from "../agents/tools/common.js";
import { createCronTool } from "../agents/tools/cron-tool.js";
import { formatErrorMessage } from "../infra/errors.js";
import { connectToolsMcpServerToStdio, createToolsMcpServer } from "./tools-stdio-server.js";

export function resolveMerClawToolsForMcp(): AnyAgentTool[] {
  return [createCronTool()];
}

function createMerClawToolsMcpServer(
  params: {
    tools?: AnyAgentTool[];
  } = {},
): Server {
  const tools = params.tools ?? resolveMerClawToolsForMcp();
  return createToolsMcpServer({ name: "merclaw-tools", tools });
}

async function serveMerClawToolsMcp(): Promise<void> {
  const server = createMerClawToolsMcpServer();
  await connectToolsMcpServerToStdio(server);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  serveMerClawToolsMcp().catch((err) => {
    process.stderr.write(`merclaw-tools-serve: ${formatErrorMessage(err)}\n`);
    process.exit(1);
  });
}
