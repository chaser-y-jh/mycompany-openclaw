# @merclaw/tokenjuice

Official Tokenjuice output compaction plugin for MerClaw.

Tokenjuice compacts noisy `exec` and `bash` tool results after commands run, before the result is fed back into the active agent session. It does not rewrite commands, rerun commands, or change exit codes.

## Install

```bash
merclaw plugins install @merclaw/tokenjuice
```

Restart the Gateway after installing or updating the plugin.

## Enable

```bash
merclaw config set plugins.entries.tokenjuice.enabled true
```

Equivalent:

```bash
merclaw plugins enable tokenjuice
```

## Docs

- https://docs.merclaw.ai/tools/tokenjuice

## Package

- Plugin id: `tokenjuice`
- Package: `@merclaw/tokenjuice`
- Minimum MerClaw host: `2026.5.28`
