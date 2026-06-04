# @merclaw/diagnostics-prometheus

Official Prometheus diagnostics exporter for MerClaw.

This plugin exposes MerClaw Gateway runtime metrics in Prometheus text format for Prometheus, Grafana, VictoriaMetrics, and compatible scrapers.

## Install

```bash
merclaw plugins install @merclaw/diagnostics-prometheus
```

Restart the Gateway after installing or updating the plugin.

## Configure

Enable the plugin and set the scrape endpoint options in `plugins.entries.diagnostics-prometheus.config`.

The full config surface, metric names, and scrape examples live in the docs:

- https://docs.merclaw.ai/gateway/prometheus

## Package

- Plugin id: `diagnostics-prometheus`
- Package: `@merclaw/diagnostics-prometheus`
- Minimum MerClaw host: `2026.4.25`
