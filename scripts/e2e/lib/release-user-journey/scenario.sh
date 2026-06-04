#!/usr/bin/env bash
set -euo pipefail
trap "" PIPE
export TERM=xterm-256color
export NO_COLOR=1

source scripts/lib/merclaw-e2e-instance.sh

merclaw_e2e_eval_test_state_from_b64 "${MERCLAW_TEST_STATE_SCRIPT_B64:?missing MERCLAW_TEST_STATE_SCRIPT_B64}"
merclaw_e2e_install_trash_shim

export NPM_CONFIG_PREFIX="$HOME/.npm-global"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
export npm_config_loglevel=error
export npm_config_fund=false
export npm_config_audit=false
export OPENAI_API_KEY="sk-merclaw-release-user-journey"
export MERCLAW_GATEWAY_TOKEN="release-user-journey-token"
export CLICKCLACK_BOT_TOKEN="clickclack-release-token"

PORT="18789"
MOCK_PORT="44180"
CLICKCLACK_PORT="44181"
SUCCESS_MARKER="MERCLAW_E2E_OK_RELEASE_USER_JOURNEY"
MOCK_REQUEST_LOG="/tmp/merclaw-release-user-journey-openai.jsonl"
CLICKCLACK_STATE="/tmp/merclaw-release-user-journey-clickclack.json"
export SUCCESS_MARKER MOCK_REQUEST_LOG CLICKCLACK_STATE

mock_pid=""
clickclack_pid=""
gateway_pid=""

cleanup() {
  merclaw_e2e_terminate_gateways "${gateway_pid:-}"
  merclaw_e2e_stop_process "${clickclack_pid:-}"
  merclaw_e2e_stop_process "${mock_pid:-}"
}
trap cleanup EXIT

dump_debug_logs() {
  local status="$1"
  echo "release user journey failed with exit code $status" >&2
  merclaw_e2e_dump_logs \
    /tmp/merclaw-release-user-journey-install.log \
    /tmp/merclaw-release-user-journey-onboard.log \
    /tmp/merclaw-release-user-journey-openai.log \
    "$MOCK_REQUEST_LOG" \
    /tmp/merclaw-release-user-journey-agent.log \
    /tmp/merclaw-release-user-journey-plugin-a-install.log \
    /tmp/merclaw-release-user-journey-plugin-a-cli.log \
    /tmp/merclaw-release-user-journey-plugin-a-uninstall.log \
    /tmp/merclaw-release-user-journey-plugin-b-install.log \
    /tmp/merclaw-release-user-journey-plugin-b-cli.log \
    /tmp/merclaw-release-user-journey-clickclack.log \
    /tmp/merclaw-release-user-journey-clickclack-server.log \
    /tmp/merclaw-release-user-journey-clickclack-outbound.json \
    /tmp/merclaw-release-user-journey-clickclack-inbound.json \
    /tmp/merclaw-release-user-journey-gateway-1.log \
    /tmp/merclaw-release-user-journey-gateway-2.log \
    /tmp/merclaw-release-user-journey-status.json \
    /tmp/merclaw-release-user-journey-doctor.log \
    "$CLICKCLACK_STATE"
}
trap 'status=$?; dump_debug_logs "$status"; exit "$status"' ERR

start_gateway() {
  local log_path="$1"
  gateway_pid="$(merclaw_e2e_start_gateway "$entry" "$PORT" "$log_path")"
  merclaw_e2e_wait_gateway_ready "$gateway_pid" "$log_path"
}

stop_gateway() {
  merclaw_e2e_terminate_gateways "${gateway_pid:-}"
  gateway_pid=""
}

write_journey_plugin() {
  local dir="$1"
  local id="$2"
  local version="$3"
  local method="$4"
  local name="$5"
  local cli_root="$6"
  local cli_output="$7"

  mkdir -p "$dir"
  node - "$dir" "$id" "$version" "$method" "$name" "$cli_root" "$cli_output" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [dir, id, version, method, name, cliRoot, cliOutput] = process.argv.slice(2);
fs.writeFileSync(
  path.join(dir, "package.json"),
  `${JSON.stringify(
    {
      name: `@merclaw/${id}`,
      version,
      merclaw: { extensions: ["./index.js"] },
    },
    null,
    2,
  )}\n`,
);
fs.writeFileSync(
  path.join(dir, "index.js"),
  `module.exports = { id: ${JSON.stringify(id)}, name: ${JSON.stringify(name)}, register(api) { api.registerGatewayMethod(${JSON.stringify(method)}, async () => ({ ok: true })); api.registerCli(({ program }) => { const root = program.command(${JSON.stringify(cliRoot)}).description(${JSON.stringify(`${name} fixture command`)}); root.command("ping").description("Print fixture ping output").action(() => { console.log(${JSON.stringify(cliOutput)}); }); }, { descriptors: [{ name: ${JSON.stringify(cliRoot)}, description: ${JSON.stringify(`${name} fixture command`)}, hasSubcommands: true }] }); }, };\n`,
);
fs.writeFileSync(
  path.join(dir, "merclaw.plugin.json"),
  `${JSON.stringify({ id, configSchema: { type: "object", properties: {} } }, null, 2)}\n`,
);
NODE
}

merclaw_e2e_install_package /tmp/merclaw-release-user-journey-install.log
command -v merclaw >/dev/null
package_root="$(merclaw_e2e_package_root)"
entry="$(merclaw_e2e_package_entrypoint "$package_root")"
merclaw_e2e_enable_merclaw_cli_timeout

mock_pid="$(merclaw_e2e_start_mock_openai "$MOCK_PORT" /tmp/merclaw-release-user-journey-openai.log)"
merclaw_e2e_wait_mock_openai "$MOCK_PORT"

CLICKCLACK_FIXTURE_PORT="$CLICKCLACK_PORT" \
CLICKCLACK_FIXTURE_TOKEN="$CLICKCLACK_BOT_TOKEN" \
CLICKCLACK_FIXTURE_STATE="$CLICKCLACK_STATE" \
  node scripts/e2e/lib/release-user-journey/clickclack-fixture.mjs >/tmp/merclaw-release-user-journey-clickclack-server.log 2>&1 &
clickclack_pid="$!"
for _ in $(seq 1 100); do
  if merclaw_e2e_probe_http_status "http://127.0.0.1:$CLICKCLACK_PORT/health" 200 >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done
merclaw_e2e_probe_http_status "http://127.0.0.1:$CLICKCLACK_PORT/health" 200

echo "Running non-interactive onboarding..."
merclaw onboard \
  --non-interactive \
  --accept-risk \
  --flow quickstart \
  --mode local \
  --auth-choice skip \
  --gateway-port "$PORT" \
  --gateway-bind loopback \
  --skip-daemon \
  --skip-ui \
  --skip-channels \
  --skip-skills \
  --skip-health >/tmp/merclaw-release-user-journey-onboard.log 2>&1
node scripts/e2e/lib/release-user-journey/assertions.mjs assert-onboard "$HOME"
node scripts/e2e/lib/release-user-journey/assertions.mjs configure-mock-model "$MOCK_PORT"

echo "Running package-installed agent turn..."
merclaw agent --local \
  --agent main \
  --session-id release-user-journey-agent \
  --message "Return marker $SUCCESS_MARKER" \
  --thinking off \
  --json >/tmp/merclaw-release-user-journey-agent.log 2>&1
node scripts/e2e/lib/release-user-journey/assertions.mjs assert-agent-turn "$SUCCESS_MARKER" /tmp/merclaw-release-user-journey-agent.log "$MOCK_REQUEST_LOG"

echo "Installing first external plugin..."
plugin_a_dir="$(mktemp -d "/tmp/merclaw-release-journey-plugin-a.XXXXXX")"
plugin_a_install_path_file="/tmp/merclaw-release-user-journey-plugin-a-install-path.txt"
plugin_a_source_path_file="/tmp/merclaw-release-user-journey-plugin-a-source-path.txt"
write_journey_plugin "$plugin_a_dir" journey-plugin-a 0.0.1 journey.a "Journey Plugin A" journey-a "journey-plugin-a:pong"
merclaw plugins install "$plugin_a_dir" >/tmp/merclaw-release-user-journey-plugin-a-install.log 2>&1
node scripts/e2e/lib/release-user-journey/assertions.mjs \
  remember-plugin-install-path \
  journey-plugin-a \
  "$plugin_a_install_path_file" \
  "$plugin_a_source_path_file" \
  "$plugin_a_dir"
merclaw journey-a ping >/tmp/merclaw-release-user-journey-plugin-a-cli.log 2>&1
node scripts/e2e/lib/release-user-journey/assertions.mjs assert-file-contains /tmp/merclaw-release-user-journey-plugin-a-cli.log "journey-plugin-a:pong"

echo "Uninstalling first external plugin..."
merclaw plugins uninstall journey-plugin-a --force >/tmp/merclaw-release-user-journey-plugin-a-uninstall.log 2>&1
node scripts/e2e/lib/release-user-journey/assertions.mjs \
  assert-plugin-uninstalled \
  journey-plugin-a \
  "$plugin_a_install_path_file" \
  "$plugin_a_source_path_file"

echo "Installing replacement external plugin..."
plugin_b_dir="$(mktemp -d "/tmp/merclaw-release-journey-plugin-b.XXXXXX")"
write_journey_plugin "$plugin_b_dir" journey-plugin-b 0.0.1 journey.b "Journey Plugin B" journey-b "journey-plugin-b:pong"
merclaw plugins install "$plugin_b_dir" >/tmp/merclaw-release-user-journey-plugin-b-install.log 2>&1
merclaw journey-b ping >/tmp/merclaw-release-user-journey-plugin-b-cli.log 2>&1
node scripts/e2e/lib/release-user-journey/assertions.mjs assert-file-contains /tmp/merclaw-release-user-journey-plugin-b-cli.log "journey-plugin-b:pong"

echo "Configuring ClickClack..."
node scripts/e2e/lib/release-user-journey/assertions.mjs configure-clickclack "http://127.0.0.1:$CLICKCLACK_PORT"
merclaw channels status --json >/tmp/merclaw-release-user-journey-status.json 2>/tmp/merclaw-release-user-journey-status.err
node scripts/e2e/lib/release-user-journey/assertions.mjs assert-channel-status clickclack /tmp/merclaw-release-user-journey-status.json

echo "Sending ClickClack outbound message..."
merclaw message send \
  --channel clickclack \
  --target channel:general \
  --message "release journey outbound" \
  --json >/tmp/merclaw-release-user-journey-clickclack-outbound.json 2>/tmp/merclaw-release-user-journey-clickclack-outbound.err
node scripts/e2e/lib/release-user-journey/assertions.mjs assert-clickclack-state outbound "$CLICKCLACK_STATE" "release journey outbound"

echo "Starting Gateway for ClickClack inbound..."
start_gateway /tmp/merclaw-release-user-journey-gateway-1.log
node scripts/e2e/lib/release-user-journey/assertions.mjs wait-clickclack-socket "http://127.0.0.1:$CLICKCLACK_PORT" 45
node scripts/e2e/lib/release-user-journey/assertions.mjs post-clickclack-inbound "http://127.0.0.1:$CLICKCLACK_PORT" "Return marker $SUCCESS_MARKER"
node scripts/e2e/lib/release-user-journey/assertions.mjs wait-clickclack-reply "$CLICKCLACK_STATE" "$SUCCESS_MARKER" 45

echo "Restarting Gateway and checking state survival..."
stop_gateway
start_gateway /tmp/merclaw-release-user-journey-gateway-2.log
merclaw plugins inspect journey-plugin-b --runtime --json >/tmp/merclaw-release-user-journey-plugin-b-after-restart.json 2>&1
merclaw channels status --json >/tmp/merclaw-release-user-journey-status-after-restart.json 2>/tmp/merclaw-release-user-journey-status-after-restart.err
node scripts/e2e/lib/release-user-journey/assertions.mjs assert-channel-status clickclack /tmp/merclaw-release-user-journey-status-after-restart.json
node scripts/e2e/lib/release-user-journey/assertions.mjs assert-file-contains /tmp/merclaw-release-user-journey-plugin-b-after-restart.json "journey-plugin-b"
stop_gateway

echo "Running doctor at end of release journey..."
merclaw doctor --repair --non-interactive >/tmp/merclaw-release-user-journey-doctor.log 2>&1

echo "Release user journey scenario passed."
