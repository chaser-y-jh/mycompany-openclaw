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
export OPENAI_API_KEY="sk-merclaw-release-upgrade-user-journey"
export CLICKCLACK_BOT_TOKEN="clickclack-release-upgrade-token"

PORT="18789"
MOCK_PORT="44210"
CLICKCLACK_PORT="44211"
SUCCESS_MARKER="MERCLAW_E2E_OK_RELEASE_UPGRADE"
MOCK_REQUEST_LOG="/tmp/merclaw-release-upgrade-user-journey-openai.jsonl"
CLICKCLACK_STATE="/tmp/merclaw-release-upgrade-user-journey-clickclack.json"
BASELINE_SPEC="${MERCLAW_RELEASE_UPGRADE_BASELINE_SPEC:-merclaw@latest}"
export SUCCESS_MARKER MOCK_REQUEST_LOG CLICKCLACK_STATE

candidate_version="$(
  tar -xOf "${MERCLAW_CURRENT_PACKAGE_TGZ:?missing MERCLAW_CURRENT_PACKAGE_TGZ}" package/package.json |
    node -e 'let raw = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (chunk) => { raw += chunk; }); process.stdin.on("end", () => { process.stdout.write(JSON.parse(raw).version); });'
)"

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
  echo "release upgrade user journey failed with exit code $status" >&2
  merclaw_e2e_dump_logs \
    /tmp/merclaw-release-upgrade-baseline-install.log \
    /tmp/merclaw-release-upgrade-candidate-install.log \
    /tmp/merclaw-release-upgrade-onboard.log \
    /tmp/merclaw-release-upgrade-openai.log \
    "$MOCK_REQUEST_LOG" \
    /tmp/merclaw-release-upgrade-plugin-install.log \
    /tmp/merclaw-release-upgrade-plugin-cli-before.log \
    /tmp/merclaw-release-upgrade-plugin-cli-after.log \
    /tmp/merclaw-release-upgrade-agent.log \
    /tmp/merclaw-release-upgrade-status.json \
    /tmp/merclaw-release-upgrade-clickclack-outbound.json \
    /tmp/merclaw-release-upgrade-clickclack-server.log \
    /tmp/merclaw-release-upgrade-gateway.log \
    "$CLICKCLACK_STATE"
}
trap 'status=$?; dump_debug_logs "$status"; exit "$status"' ERR

start_gateway() {
  local log_path="$1"
  gateway_pid="$(merclaw_e2e_start_gateway "$entry" "$PORT" "$log_path")"
  merclaw_e2e_wait_gateway_ready "$gateway_pid" "$log_path"
}

echo "Installing published baseline $BASELINE_SPEC..."
if ! merclaw_e2e_maybe_timeout "${MERCLAW_E2E_NPM_INSTALL_TIMEOUT:-600s}" npm install -g "$BASELINE_SPEC" --no-fund --no-audit >/tmp/merclaw-release-upgrade-baseline-install.log 2>&1; then
  cat /tmp/merclaw-release-upgrade-baseline-install.log >&2 || true
  exit 1
fi
command -v merclaw >/dev/null
baseline_root="$(merclaw_e2e_package_root)"
baseline_entry="$(merclaw_e2e_package_entrypoint "$baseline_root")"
merclaw_e2e_enable_merclaw_cli_timeout

mock_pid="$(merclaw_e2e_start_mock_openai "$MOCK_PORT" /tmp/merclaw-release-upgrade-openai.log)"
merclaw_e2e_wait_mock_openai "$MOCK_PORT"

CLICKCLACK_FIXTURE_PORT="$CLICKCLACK_PORT" \
CLICKCLACK_FIXTURE_TOKEN="$CLICKCLACK_BOT_TOKEN" \
CLICKCLACK_FIXTURE_STATE="$CLICKCLACK_STATE" \
  node scripts/e2e/lib/release-user-journey/clickclack-fixture.mjs >/tmp/merclaw-release-upgrade-clickclack-server.log 2>&1 &
clickclack_pid="$!"
for _ in $(seq 1 100); do
  if merclaw_e2e_probe_http_status "http://127.0.0.1:$CLICKCLACK_PORT/health" 200 >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done
merclaw_e2e_probe_http_status "http://127.0.0.1:$CLICKCLACK_PORT/health" 200

merclaw_e2e_run_command node "$baseline_entry" onboard \
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
  --skip-health >/tmp/merclaw-release-upgrade-onboard.log 2>&1
node scripts/e2e/lib/release-scenarios/assertions.mjs configure-mock-openai "$MOCK_PORT"

plugin_dir="$(mktemp -d "/tmp/merclaw-release-upgrade-plugin.XXXXXX")"
node scripts/e2e/lib/release-scenarios/write-cli-plugin.mjs \
  "$plugin_dir" \
  release-upgrade-plugin \
  0.0.1 \
  release.upgrade.plugin \
  "Release Upgrade Plugin" \
  release-upgrade \
  "release-upgrade-plugin:pong"
merclaw plugins install "$plugin_dir" >/tmp/merclaw-release-upgrade-plugin-install.log 2>&1
merclaw release-upgrade ping >/tmp/merclaw-release-upgrade-plugin-cli-before.log 2>&1
node scripts/e2e/lib/release-scenarios/assertions.mjs assert-file-contains /tmp/merclaw-release-upgrade-plugin-cli-before.log "release-upgrade-plugin:pong"
node scripts/e2e/lib/release-user-journey/assertions.mjs configure-clickclack "http://127.0.0.1:$CLICKCLACK_PORT"

merclaw_e2e_install_package /tmp/merclaw-release-upgrade-candidate-install.log "candidate MerClaw package"
package_root="$(merclaw_e2e_package_root)"
entry="$(merclaw_e2e_package_entrypoint "$package_root")"
merclaw_e2e_enable_merclaw_cli_timeout
node scripts/e2e/lib/release-scenarios/assertions.mjs assert-package-version "$package_root" "$candidate_version" candidate

merclaw agent --local \
  --agent main \
  --session-id release-upgrade-user-journey-agent \
  --message "Return marker $SUCCESS_MARKER" \
  --thinking off \
  --json >/tmp/merclaw-release-upgrade-agent.log 2>&1
node scripts/e2e/lib/release-scenarios/assertions.mjs assert-agent-turn "$SUCCESS_MARKER" /tmp/merclaw-release-upgrade-agent.log "$MOCK_REQUEST_LOG"

merclaw release-upgrade ping >/tmp/merclaw-release-upgrade-plugin-cli-after.log 2>&1
node scripts/e2e/lib/release-scenarios/assertions.mjs assert-file-contains /tmp/merclaw-release-upgrade-plugin-cli-after.log "release-upgrade-plugin:pong"

merclaw channels status --json >/tmp/merclaw-release-upgrade-status.json 2>/tmp/merclaw-release-upgrade-status.err
node scripts/e2e/lib/release-user-journey/assertions.mjs assert-channel-status clickclack /tmp/merclaw-release-upgrade-status.json
merclaw message send \
  --channel clickclack \
  --target channel:general \
  --message "release upgrade outbound" \
  --json >/tmp/merclaw-release-upgrade-clickclack-outbound.json 2>/tmp/merclaw-release-upgrade-clickclack-outbound.err
node scripts/e2e/lib/release-user-journey/assertions.mjs assert-clickclack-state outbound "$CLICKCLACK_STATE" "release upgrade outbound"

start_gateway /tmp/merclaw-release-upgrade-gateway.log
node scripts/e2e/lib/release-user-journey/assertions.mjs wait-clickclack-socket "http://127.0.0.1:$CLICKCLACK_PORT" 45
node scripts/e2e/lib/release-user-journey/assertions.mjs post-clickclack-inbound "http://127.0.0.1:$CLICKCLACK_PORT" "Return marker $SUCCESS_MARKER"
node scripts/e2e/lib/release-user-journey/assertions.mjs wait-clickclack-reply "$CLICKCLACK_STATE" "$SUCCESS_MARKER" 45

echo "Release upgrade user journey scenario passed."
