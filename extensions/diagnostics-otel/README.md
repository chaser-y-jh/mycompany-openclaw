# @merclaw/diagnostics-otel

Official OpenTelemetry diagnostics exporter for MerClaw.

This plugin exports MerClaw Gateway traces, metrics, and logs to an OTLP collector for observability stacks such as Grafana, Datadog, Honeycomb, New Relic, Tempo, and compatible collectors.

## Install

```bash
merclaw plugins install @merclaw/diagnostics-otel
```

Restart the Gateway after installing or updating the plugin.

## Configure

Enable the plugin and set the OTLP endpoint in `plugins.entries.diagnostics-otel.config`.

The full config surface, metric names, span names, and collector examples live in the docs:

- https://docs.merclaw.ai/gateway/opentelemetry

## Package

- Plugin id: `diagnostics-otel`
- Package: `@merclaw/diagnostics-otel`
- Minimum MerClaw host: `2026.4.25`
