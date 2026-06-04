type McpLoopbackRuntime = {
  port: number;
  ownerToken: string;
  nonOwnerToken: string;
};

let activeRuntime: McpLoopbackRuntime | undefined;

export function getActiveMcpLoopbackRuntime(): McpLoopbackRuntime | undefined {
  return activeRuntime ? { ...activeRuntime } : undefined;
}

export function setActiveMcpLoopbackRuntime(runtime: McpLoopbackRuntime): void {
  activeRuntime = { ...runtime };
}

export function resolveMcpLoopbackBearerToken(
  runtime: McpLoopbackRuntime,
  senderIsOwner: boolean,
): string {
  return senderIsOwner ? runtime.ownerToken : runtime.nonOwnerToken;
}

export function clearActiveMcpLoopbackRuntimeByOwnerToken(ownerToken: string): void {
  if (activeRuntime?.ownerToken === ownerToken) {
    activeRuntime = undefined;
  }
}

export function createMcpLoopbackServerConfig(port: number) {
  return {
    mcpServers: {
      merclaw: {
        type: "http",
        url: `http://127.0.0.1:${port}/mcp`,
        headers: {
          Authorization: "Bearer ${MERCLAW_MCP_TOKEN}",
          "x-session-key": "${MERCLAW_MCP_SESSION_KEY}",
          "x-merclaw-agent-id": "${MERCLAW_MCP_AGENT_ID}",
          "x-merclaw-account-id": "${MERCLAW_MCP_ACCOUNT_ID}",
          "x-merclaw-message-channel": "${MERCLAW_MCP_MESSAGE_CHANNEL}",
          "x-merclaw-current-channel-id": "${MERCLAW_MCP_CURRENT_CHANNEL_ID}",
          "x-merclaw-current-thread-ts": "${MERCLAW_MCP_CURRENT_THREAD_TS}",
          "x-merclaw-current-message-id": "${MERCLAW_MCP_CURRENT_MESSAGE_ID}",
          "x-merclaw-inbound-event-kind": "${MERCLAW_MCP_INBOUND_EVENT_KIND}",
          "x-merclaw-source-reply-delivery-mode": "${MERCLAW_MCP_SOURCE_REPLY_DELIVERY_MODE}",
        },
      },
    },
  };
}
