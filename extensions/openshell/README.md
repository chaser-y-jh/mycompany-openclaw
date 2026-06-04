# @merclaw/openshell-sandbox

Official NVIDIA OpenShell sandbox backend for MerClaw.

This plugin lets MerClaw use OpenShell-managed sandboxes with mirrored local workspaces and SSH command execution.

## Install

```bash
merclaw plugins install @merclaw/openshell-sandbox
```

Restart the Gateway after installing or updating the plugin.

## Configure

Use the OpenShell docs for credentials, workspace mirroring, runtime selection, and troubleshooting:

- https://docs.merclaw.ai/gateway/openshell

## Package

- Plugin id: `openshell`
- Package: `@merclaw/openshell-sandbox`
- Minimum MerClaw host: `2026.5.12-beta.1`
