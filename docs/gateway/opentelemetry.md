---
summary: "Export MerClaw diagnostics to any OpenTelemetry collector via the diagnostics-otel plugin (OTLP/HTTP)"
title: "OpenTelemetry export"
read_when:
  - You want to send MerClaw model usage, message flow, or session metrics to an OpenTelemetry collector
  - You are wiring traces, metrics, or logs into Grafana, Datadog, Honeycomb, New Relic, Tempo, or another OTLP backend
  - You need the exact metric names, span names, or attribute shapes to build dashboards or alerts
---

MerClaw exports diagnostics through the official `diagnostics-otel` plugin
using **OTLP/HTTP (protobuf)**. Any collector or backend that accepts OTLP/HTTP
works without code changes. For local file logs and how to read them, see
[Logging](/logging).

## How it fits together

- **Diagnostics events** are structured, in-process records emitted by the
  Gateway and bundled plugins for model runs, message flow, sessions, queues,
  and exec.
- **`diagnostics-otel` plugin** subscribes to those events and exports them as
  OpenTelemetry **metrics**, **traces**, and **logs** over OTLP/HTTP.
- **Provider calls** receive a W3C `traceparent` header from MerClaw's
  trusted model-call span context when the provider transport accepts custom
  headers. Plugin-emitted trace context is not propagated.
- Exporters only attach when both the diagnostics surface and the plugin are
  enabled, so the in-process cost stays near zero by default.

## Quick start

For packaged installs, install the plugin first:

```bash
merclaw plugins install clawhub:@merclaw/diagnostics-otel
```

```json5
{
  plugins: {
    allow: ["diagnostics-otel"],
    entries: {
      "diagnostics-otel": { enabled: true },
    },
  },
  diagnostics: {
    enabled: true,
    otel: {
      enabled: true,
      endpoint: "http://otel-collector:4318",
      protocol: "http/protobuf",
      serviceName: "merclaw-gateway",
      traces: true,
      metrics: true,
      logs: true,
      sampleRate: 0.2,
      flushIntervalMs: 60000,
    },
  },
}
```

You can also enable the plugin from the CLI:

```bash
merclaw plugins enable diagnostics-otel
```

<Note>
`protocol` currently supports `http/protobuf` only. `grpc` is ignored.
</Note>

## Signals exported

| Signal      | What goes in it                                                                                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Metrics** | Counters and histograms for token usage, cost, run duration, failover, skill usage, message flow, Talk events, queue lanes, session state/recovery, tool execution, oversized payloads, exec, and memory pressure. |
| **Traces**  | Spans for model usage, model calls, harness lifecycle, skill usage, tool execution, exec, webhook/message processing, context assembly, and tool loops.                                                            |
| **Logs**    | Structured `logging.file` records exported over OTLP when `diagnostics.otel.logs` is enabled; log bodies are withheld unless content capture is explicitly enabled.                                                |

Toggle `traces`, `metrics`, and `logs` independently. Traces and metrics
default to on when `diagnostics.otel.enabled` is true. Logs default to off and
are exported only when `diagnostics.otel.logs` is explicitly `true`.

## Configuration reference

```json5
{
  diagnostics: {
    enabled: true,
    otel: {
      enabled: true,
      endpoint: "http://otel-collector:4318",
      tracesEndpoint: "http://otel-collector:4318/v1/traces",
      metricsEndpoint: "http://otel-collector:4318/v1/metrics",
      logsEndpoint: "http://otel-collector:4318/v1/logs",
      protocol: "http/protobuf", // grpc is ignored
      serviceName: "merclaw-gateway",
      headers: { "x-collector-token": "..." },
      traces: true,
      metrics: true,
      logs: true,
      sampleRate: 0.2, // root-span sampler, 0.0..1.0
      flushIntervalMs: 60000, // metric export interval (min 1000ms)
      captureContent: {
        enabled: false,
        inputMessages: false,
        outputMessages: false,
        toolInputs: false,
        toolOutputs: false,
        systemPrompt: false,
        toolDefinitions: false,
      },
    },
  },
}
```

### Environment variables

| Variable                                                                                                          | Purpose                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT`                                                                                     | Override `diagnostics.otel.endpoint`. If the value already contains `/v1/traces`, `/v1/metrics`, or `/v1/logs`, it is used as-is.                                                                                                                                                                                                              |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` / `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` / `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` | Signal-specific endpoint overrides used when the matching `diagnostics.otel.*Endpoint` config key is unset. Signal-specific config wins over signal-specific env, which wins over the shared endpoint.                                                                                                                                         |
| `OTEL_SERVICE_NAME`                                                                                               | Override `diagnostics.otel.serviceName`.                                                                                                                                                                                                                                                                                                       |
| `OTEL_EXPORTER_OTLP_PROTOCOL`                                                                                     | Override the wire protocol (only `http/protobuf` is honored today).                                                                                                                                                                                                                                                                            |
| `OTEL_SEMCONV_STABILITY_OPT_IN`                                                                                   | Set to `gen_ai_latest_experimental` to emit the latest experimental GenAI inference span shape, including `{gen_ai.operation.name} {gen_ai.request.model}` span names, `CLIENT` span kind, and `gen_ai.provider.name` instead of the legacy `gen_ai.system`. GenAI metrics always use bounded, low-cardinality semantic attributes regardless. |
| `MERCLAW_OTEL_PRELOADED`                                                                                         | Set to `1` when another preload or host process already registered the global OpenTelemetry SDK. The plugin then skips its own NodeSDK lifecycle but still wires diagnostic listeners and honors `traces`/`metrics`/`logs`.                                                                                                                    |

## Privacy and content capture

Raw model/tool content is **not** exported by default. Spans carry bounded
identifiers (channel, provider, model, error category, hash-only request ids,
tool source, tool owner, and skill name/source) and never include prompt text,
response text, tool inputs, tool outputs, skill file paths, or session keys.
OTLP log records keep severity, logger, code location, trusted trace context,
and sanitized attributes by default, but the raw log message body is exported
only when `diagnostics.otel.captureContent` is set to boolean `true`. Granular
`captureContent.*` subkeys do not enable log bodies. Labels that look like
scoped agent session keys are replaced with `unknown`.
Talk metrics export only bounded event metadata such as mode, transport,
provider, and event type. They do not include transcripts, audio payloads,
session ids, turn ids, call ids, room ids, or handoff tokens.

Outbound model requests may include a W3C `traceparent` header. That header is
generated only from MerClaw-owned diagnostic trace context for the active model
call. Existing caller-supplied `traceparent` headers are replaced, so plugins or
custom provider options cannot spoof cross-service trace ancestry.

Set `diagnostics.otel.captureContent.*` to `true` only when your collector and
retention policy are approved for prompt, response, tool, or system-prompt
text. Each subkey is opt-in independently:

- `inputMessages` - user prompt content.
- `outputMessages` - model response content.
- `toolInputs` - tool argument payloads.
- `toolOutputs` - tool result payloads.
- `systemPrompt` - assembled system/developer prompt.
- `toolDefinitions` - model tool names, descriptions, and schemas.

When any subkey is enabled, model and tool spans get bounded, redacted
`merclaw.content.*` attributes for that class only. Use boolean
`captureContent: true` only for broad diagnostics captures where OTLP log
message bodies are also approved for export.

## Sampling and flushing

- **Traces:** `diagnostics.otel.sampleRate` (root-span only, `0.0` drops all,
  `1.0` keeps all).
- **Metrics:** `diagnostics.otel.flushIntervalMs` (minimum `1000`).
- **Logs:** OTLP logs respect `logging.level` (file log level). They use the
  diagnostic log-record redaction path, not console formatting. High-volume
  installs should prefer OTLP collector sampling/filtering over local sampling.
- **File-log correlation:** JSONL file logs include top-level `traceId`,
  `spanId`, `parentSpanId`, and `traceFlags` when the log call carries a valid
  diagnostic trace context, which lets log processors join local log lines with
  exported spans.
- **Request correlation:** Gateway HTTP requests and WebSocket frames create an
  internal request trace scope. Logs and diagnostic events inside that scope
  inherit the request trace by default, while agent run and model-call spans are
  created as children so provider `traceparent` headers stay on the same trace.

## Exported metrics

### Model usage

- `merclaw.tokens` (counter, attrs: `merclaw.token`, `merclaw.channel`, `merclaw.provider`, `merclaw.model`, `merclaw.agent`)
- `merclaw.cost.usd` (counter, attrs: `merclaw.channel`, `merclaw.provider`, `merclaw.model`)
- `merclaw.run.duration_ms` (histogram, attrs: `merclaw.channel`, `merclaw.provider`, `merclaw.model`)
- `merclaw.context.tokens` (histogram, attrs: `merclaw.context`, `merclaw.channel`, `merclaw.provider`, `merclaw.model`)
- `gen_ai.client.token.usage` (histogram, GenAI semantic-conventions metric, attrs: `gen_ai.token.type` = `input`/`output`, `gen_ai.provider.name`, `gen_ai.operation.name`, `gen_ai.request.model`)
- `gen_ai.client.operation.duration` (histogram, seconds, GenAI semantic-conventions metric, attrs: `gen_ai.provider.name`, `gen_ai.operation.name`, `gen_ai.request.model`, optional `error.type`)
- `merclaw.model_call.duration_ms` (histogram, attrs: `merclaw.provider`, `merclaw.model`, `merclaw.api`, `merclaw.transport`, plus `merclaw.errorCategory` and `merclaw.failureKind` on classified errors)
- `merclaw.model_call.request_bytes` (histogram, UTF-8 byte size of the final model request payload; no raw payload content)
- `merclaw.model_call.response_bytes` (histogram, UTF-8 byte size of streamed model response events; no raw response content)
- `merclaw.model_call.time_to_first_byte_ms` (histogram, elapsed time before the first streamed response event)
- `merclaw.model.failover` (counter, attrs: `merclaw.provider`, `merclaw.model`, `merclaw.failover.to_provider`, `merclaw.failover.to_model`, `merclaw.failover.reason`, `merclaw.failover.suspended`, `merclaw.lane`)
- `merclaw.skill.used` (counter, attrs: `merclaw.skill.name`, `merclaw.skill.source`, `merclaw.skill.activation`, optional `merclaw.agent`, optional `merclaw.toolName`)

### Message flow

- `merclaw.webhook.received` (counter, attrs: `merclaw.channel`, `merclaw.webhook`)
- `merclaw.webhook.error` (counter, attrs: `merclaw.channel`, `merclaw.webhook`)
- `merclaw.webhook.duration_ms` (histogram, attrs: `merclaw.channel`, `merclaw.webhook`)
- `merclaw.message.queued` (counter, attrs: `merclaw.channel`, `merclaw.source`)
- `merclaw.message.received` (counter, attrs: `merclaw.channel`, `merclaw.source`)
- `merclaw.message.dispatch.started` (counter, attrs: `merclaw.channel`, `merclaw.source`)
- `merclaw.message.dispatch.completed` (counter, attrs: `merclaw.channel`, `merclaw.outcome`, `merclaw.reason`, `merclaw.source`)
- `merclaw.message.dispatch.duration_ms` (histogram, attrs: `merclaw.channel`, `merclaw.outcome`, `merclaw.reason`, `merclaw.source`)
- `merclaw.message.processed` (counter, attrs: `merclaw.channel`, `merclaw.outcome`)
- `merclaw.message.duration_ms` (histogram, attrs: `merclaw.channel`, `merclaw.outcome`)
- `merclaw.message.delivery.started` (counter, attrs: `merclaw.channel`, `merclaw.delivery.kind`)
- `merclaw.message.delivery.duration_ms` (histogram, attrs: `merclaw.channel`, `merclaw.delivery.kind`, `merclaw.outcome`, `merclaw.errorCategory`)

### Talk

- `merclaw.talk.event` (counter, attrs: `merclaw.talk.event_type`, `merclaw.talk.mode`, `merclaw.talk.transport`, `merclaw.talk.brain`, `merclaw.talk.provider`)
- `merclaw.talk.event.duration_ms` (histogram, attrs: same as `merclaw.talk.event`; emitted when a Talk event reports duration)
- `merclaw.talk.audio.bytes` (histogram, attrs: same as `merclaw.talk.event`; emitted for Talk audio frame events that report byte length)

### Queues and sessions

- `merclaw.queue.lane.enqueue` (counter, attrs: `merclaw.lane`)
- `merclaw.queue.lane.dequeue` (counter, attrs: `merclaw.lane`)
- `merclaw.queue.depth` (histogram, attrs: `merclaw.lane` or `merclaw.channel=heartbeat`)
- `merclaw.queue.wait_ms` (histogram, attrs: `merclaw.lane`)
- `merclaw.session.state` (counter, attrs: `merclaw.state`, `merclaw.reason`)
- `merclaw.session.stuck` (counter, attrs: `merclaw.state`; emitted for recoverable stale session bookkeeping)
- `merclaw.session.stuck_age_ms` (histogram, attrs: `merclaw.state`; emitted for recoverable stale session bookkeeping)
- `merclaw.session.turn.created` (counter, attrs: `merclaw.agent`, `merclaw.channel`, `merclaw.trigger`)
- `merclaw.session.recovery.requested` (counter, attrs: `merclaw.state`, `merclaw.action`, `merclaw.active_work_kind`, `merclaw.reason`)
- `merclaw.session.recovery.completed` (counter, attrs: `merclaw.state`, `merclaw.action`, `merclaw.status`, `merclaw.active_work_kind`, `merclaw.reason`)
- `merclaw.session.recovery.age_ms` (histogram, attrs: same as the matching recovery counter)
- `merclaw.run.attempt` (counter, attrs: `merclaw.attempt`)

### Session liveness telemetry

`diagnostics.stuckSessionWarnMs` is the no-progress age threshold for session
liveness diagnostics. A `processing` session does not age toward this threshold
while MerClaw observes reply, tool, status, block, or ACP runtime progress.
Typing keepalives are not counted as progress, so a silent model or harness can
still be detected.

MerClaw classifies sessions by the work it can still observe:

- `session.long_running`: active embedded work, model calls, or tool calls are
  still making progress.
- `session.stalled`: active work exists, but the active run has not reported
  recent progress. Stalled embedded runs stay observe-only at first, then
  abort-drain after `diagnostics.stuckSessionAbortMs` with no progress so queued
  turns behind the lane can resume. When unset, the abort threshold defaults to
  the safer extended window of at least 5 minutes and 3x
  `diagnostics.stuckSessionWarnMs`.
- `session.stuck`: stale session bookkeeping with no active work, or an idle
  queued session with stale ownerless model/tool activity. This releases the
  affected session lane immediately after recovery gates pass.

Recovery emits structured `session.recovery.requested` and
`session.recovery.completed` events. Diagnostic session state is marked idle
only after a mutating recovery outcome (`aborted` or `released`) and only if the
same processing generation is still current.

Only `session.stuck` emits the `merclaw.session.stuck` counter, the
`merclaw.session.stuck_age_ms` histogram, and the `merclaw.session.stuck`
span. Repeated `session.stuck` diagnostics back off while the session remains
unchanged, so dashboards should alert on sustained increases rather than every
heartbeat tick. For the config knob and defaults, see
[Configuration reference](/gateway/configuration-reference#diagnostics).

Liveness warnings also emit:

- `merclaw.liveness.warning` (counter, attrs: `merclaw.liveness.reason`)
- `merclaw.liveness.event_loop_delay_p99_ms` (histogram, attrs: `merclaw.liveness.reason`)
- `merclaw.liveness.event_loop_delay_max_ms` (histogram, attrs: `merclaw.liveness.reason`)
- `merclaw.liveness.event_loop_utilization` (histogram, attrs: `merclaw.liveness.reason`)
- `merclaw.liveness.cpu_core_ratio` (histogram, attrs: `merclaw.liveness.reason`)

### Harness lifecycle

- `merclaw.harness.duration_ms` (histogram, attrs: `merclaw.harness.id`, `merclaw.harness.plugin`, `merclaw.outcome`, `merclaw.harness.phase` on errors)

### Tool execution

- `merclaw.tool.execution.duration_ms` (histogram, attrs: `gen_ai.tool.name`, `merclaw.toolName`, `merclaw.tool.source`, `merclaw.tool.owner`, `merclaw.tool.params.kind`, plus `merclaw.errorCategory` on errors)
- `merclaw.tool.execution.blocked` (counter, attrs: `gen_ai.tool.name`, `merclaw.toolName`, `merclaw.tool.source`, `merclaw.tool.owner`, `merclaw.tool.params.kind`, `merclaw.deniedReason`)

### Exec

- `merclaw.exec.duration_ms` (histogram, attrs: `merclaw.exec.target`, `merclaw.exec.mode`, `merclaw.outcome`, `merclaw.failureKind`)

### Diagnostics internals (memory and tool loop)

- `merclaw.payload.large` (counter, attrs: `merclaw.payload.surface`, `merclaw.payload.action`, `merclaw.channel`, `merclaw.plugin`, `merclaw.reason`)
- `merclaw.payload.large_bytes` (histogram, attrs: same as `merclaw.payload.large`)
- `merclaw.memory.heap_used_bytes` (histogram, attrs: `merclaw.memory.kind`)
- `merclaw.memory.rss_bytes` (histogram)
- `merclaw.memory.pressure` (counter, attrs: `merclaw.memory.level`)
- `merclaw.tool.loop.iterations` (counter, attrs: `merclaw.toolName`, `merclaw.outcome`)
- `merclaw.tool.loop.duration_ms` (histogram, attrs: `merclaw.toolName`, `merclaw.outcome`)

## Exported spans

- `merclaw.model.usage`
  - `merclaw.channel`, `merclaw.provider`, `merclaw.model`
  - `merclaw.tokens.*` (input/output/cache_read/cache_write/total)
  - `gen_ai.system` by default, or `gen_ai.provider.name` when the latest GenAI semantic conventions are opted in
  - `gen_ai.request.model`, `gen_ai.operation.name`, `gen_ai.usage.*`
- `merclaw.run`
  - `merclaw.outcome`, `merclaw.channel`, `merclaw.provider`, `merclaw.model`, `merclaw.errorCategory`
- `merclaw.model.call`
  - `gen_ai.system` by default, or `gen_ai.provider.name` when the latest GenAI semantic conventions are opted in
  - `gen_ai.request.model`, `gen_ai.operation.name`, `merclaw.provider`, `merclaw.model`, `merclaw.api`, `merclaw.transport`
  - `merclaw.errorCategory` and optional `merclaw.failureKind` on errors
  - `merclaw.model_call.request_bytes`, `merclaw.model_call.response_bytes`, `merclaw.model_call.time_to_first_byte_ms`
  - `merclaw.provider.request_id_hash` (bounded SHA-based hash of the upstream provider request id; raw ids are not exported)
  - With `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`, model-call spans use the latest GenAI inference span name `{gen_ai.operation.name} {gen_ai.request.model}` and `CLIENT` span kind instead of `merclaw.model.call`.
- `merclaw.harness.run`
  - `merclaw.harness.id`, `merclaw.harness.plugin`, `merclaw.outcome`, `merclaw.provider`, `merclaw.model`, `merclaw.channel`
  - On completion: `merclaw.harness.result_classification`, `merclaw.harness.yield_detected`, `merclaw.harness.items.started`, `merclaw.harness.items.completed`, `merclaw.harness.items.active`
  - On error: `merclaw.harness.phase`, `merclaw.errorCategory`, optional `merclaw.harness.cleanup_failed`
- `merclaw.tool.execution`
  - `gen_ai.tool.name`, `merclaw.toolName`, `merclaw.errorCategory`, `merclaw.tool.params.*`
- `merclaw.exec`
  - `merclaw.exec.target`, `merclaw.exec.mode`, `merclaw.outcome`, `merclaw.failureKind`, `merclaw.exec.command_length`, `merclaw.exec.exit_code`, `merclaw.exec.timed_out`
- `merclaw.webhook.processed`
  - `merclaw.channel`, `merclaw.webhook`
- `merclaw.webhook.error`
  - `merclaw.channel`, `merclaw.webhook`, `merclaw.error`
- `merclaw.message.processed`
  - `merclaw.channel`, `merclaw.outcome`, `merclaw.reason`
- `merclaw.message.delivery`
  - `merclaw.channel`, `merclaw.delivery.kind`, `merclaw.outcome`, `merclaw.errorCategory`, `merclaw.delivery.result_count`
- `merclaw.session.stuck`
  - `merclaw.state`, `merclaw.ageMs`, `merclaw.queueDepth`
- `merclaw.context.assembled`
  - `merclaw.prompt.size`, `merclaw.history.size`, `merclaw.context.tokens`, `merclaw.errorCategory` (no prompt, history, response, or session-key content)
- `merclaw.tool.loop`
  - `merclaw.toolName`, `merclaw.outcome`, `merclaw.iterations`, `merclaw.errorCategory` (no loop messages, params, or tool output)
- `merclaw.memory.pressure`
  - `merclaw.memory.level`, `merclaw.memory.heap_used_bytes`, `merclaw.memory.rss_bytes`

When content capture is explicitly enabled, model and tool spans can also
include bounded, redacted `merclaw.content.*` attributes for the specific
content classes you opted into.

## Diagnostic event catalog

The events below back the metrics and spans above. Plugins can also subscribe
to them directly without OTLP export.

**Model usage**

- `model.usage` - tokens, cost, duration, context, provider/model/channel,
  session ids. `usage` is provider/turn accounting for cost and telemetry;
  `context.used` is the current prompt/context snapshot and can be lower than
  provider `usage.total` when cached input or tool-loop calls are involved.

**Message flow**

- `webhook.received` / `webhook.processed` / `webhook.error`
- `message.queued` / `message.processed`
- `message.delivery.started` / `message.delivery.completed` / `message.delivery.error`

**Queue and session**

- `queue.lane.enqueue` / `queue.lane.dequeue`
- `session.state` / `session.long_running` / `session.stalled` / `session.stuck`
- `run.attempt` / `run.progress`
- `diagnostic.heartbeat` (aggregate counters: webhooks/queue/session)

**Harness lifecycle**

- `harness.run.started` / `harness.run.completed` / `harness.run.error` -
  per-run lifecycle for the agent harness. Includes `harnessId`, optional
  `pluginId`, provider/model/channel, and run id. Completion adds
  `durationMs`, `outcome`, optional `resultClassification`, `yieldDetected`,
  and `itemLifecycle` counts. Errors add `phase`
  (`prepare`/`start`/`send`/`resolve`/`cleanup`), `errorCategory`, and
  optional `cleanupFailed`.

**Exec**

- `exec.process.completed` - terminal outcome, duration, target, mode, exit
  code, and failure kind. Command text and working directories are not
  included.

## Without an exporter

You can keep diagnostics events available to plugins or custom sinks without
running `diagnostics-otel`:

```json5
{
  diagnostics: { enabled: true },
}
```

For targeted debug output without raising `logging.level`, use diagnostics
flags. Flags are case-insensitive and support wildcards (e.g. `telegram.*` or
`*`):

```json5
{
  diagnostics: { flags: ["telegram.http"] },
}
```

Or as a one-off env override:

```bash
MERCLAW_DIAGNOSTICS=telegram.http,telegram.payload merclaw gateway
```

Flag output goes to the standard log file (`logging.file`) and is still
redacted by `logging.redactSensitive`. Full guide:
[Diagnostics flags](/diagnostics/flags).

## Disable

```json5
{
  diagnostics: { otel: { enabled: false } },
}
```

You can also leave `diagnostics-otel` out of `plugins.allow`, or run
`merclaw plugins disable diagnostics-otel`.

## Related

- [Logging](/logging) - file logs, console output, CLI tailing, and the Control UI Logs tab
- [Gateway logging internals](/gateway/logging) - WS log styles, subsystem prefixes, and console capture
- [Diagnostics flags](/diagnostics/flags) - targeted debug-log flags
- [Diagnostics export](/gateway/diagnostics) - operator support-bundle tool (separate from OTEL export)
- [Configuration reference](/gateway/configuration-reference#diagnostics) - full `diagnostics.*` field reference
