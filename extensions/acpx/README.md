# @merclaw/acpx

Official ACP runtime backend for MerClaw.

ACPx lets MerClaw run external coding harnesses through the Agent Client Protocol while MerClaw still owns sessions, channels, delivery, permissions, and Gateway state.

## Install

```bash
merclaw plugins install @merclaw/acpx
```

Restart the Gateway after installing or updating the plugin.

## What it provides

- ACP-backed agent runtime sessions.
- Plugin-owned session and transport management.
- MCP bridge helpers for MerClaw tools and plugin tools.
- Static runtime assets used by the ACP process bridge.

## Configure

Use the ACP docs for harness-specific setup, permission modes, and model/runtime selection:

- https://docs.merclaw.ai/tools/acp-agents-setup
- https://docs.merclaw.ai/tools/acp-agents

## Package

- Plugin id: `acpx`
- Package: `@merclaw/acpx`
- Minimum MerClaw host: `2026.4.25`
