# @merclaw/memory-lancedb

Official LanceDB-backed long-term memory plugin for MerClaw.

This plugin adds persistent memory tools backed by LanceDB, vector search, auto-recall, and auto-capture.

## Install

```bash
merclaw plugins install @merclaw/memory-lancedb
```

Restart the Gateway after installing or updating the plugin.

## What it provides

- `memory_store`
- `memory_recall`
- `memory_forget`
- LanceDB vector storage and hybrid memory retrieval.

## Configure

Use the memory plugin docs for embedding provider setup, storage paths, indexing, and recall behavior:

- https://docs.merclaw.ai/plugins/memory-lancedb

## Package

- Plugin id: `memory-lancedb`
- Package: `@merclaw/memory-lancedb`
- Minimum MerClaw host: `2026.4.10`
