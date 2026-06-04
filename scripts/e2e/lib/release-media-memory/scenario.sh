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
export OPENAI_API_KEY="sk-merclaw-release-media-memory"
export MERCLAW_QA_ALLOW_LOCAL_IMAGE_PROVIDER=1

PORT="18789"
MOCK_PORT="44200"
SUCCESS_MARKER="MERCLAW_E2E_OK_MEDIA_MEMORY"
MEMORY_MARKER="release-media-memory-saffron-$(date +%s)"
MOCK_REQUEST_LOG="/tmp/merclaw-release-media-memory-openai.jsonl"
export SUCCESS_MARKER MOCK_REQUEST_LOG

mock_pid=""
gateway_pid=""
cleanup() {
  merclaw_e2e_terminate_gateways "${gateway_pid:-}"
  merclaw_e2e_stop_process "${mock_pid:-}"
}
trap cleanup EXIT

dump_debug_logs() {
  local status="$1"
  echo "release media memory failed with exit code $status" >&2
  merclaw_e2e_dump_logs \
    /tmp/merclaw-release-media-memory-install.log \
    /tmp/merclaw-release-media-memory-onboard.log \
    /tmp/merclaw-release-media-memory-env.log \
    /tmp/merclaw-release-media-memory-config.json \
    /tmp/merclaw-release-media-memory-package-files.log \
    /tmp/merclaw-release-media-memory-plugins.json \
    /tmp/merclaw-release-media-memory-plugins.stderr.log \
    /tmp/merclaw-release-media-memory-openai.log \
    "$MOCK_REQUEST_LOG" \
    /tmp/merclaw-release-media-memory-describe.json \
    /tmp/merclaw-release-media-memory-describe.stderr.log \
    /tmp/merclaw-release-media-memory-generate.json \
    /tmp/merclaw-release-media-memory-generate.stderr.log \
    /tmp/merclaw-release-media-memory-index.log \
    /tmp/merclaw-release-media-memory-search-before.json \
    /tmp/merclaw-release-media-memory-search-before.stderr.log \
    /tmp/merclaw-release-media-memory-search-after.json \
    /tmp/merclaw-release-media-memory-search-after.stderr.log \
    /tmp/merclaw-release-media-memory-gateway-1.log \
    /tmp/merclaw-release-media-memory-gateway-2.log
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

merclaw_e2e_install_package /tmp/merclaw-release-media-memory-install.log
command -v merclaw >/dev/null
package_root="$(merclaw_e2e_package_root)"
entry="$(merclaw_e2e_package_entrypoint "$package_root")"
{
  printf 'merclaw=%s\n' "$(command -v merclaw)"
  printf 'package_root=%s\n' "$package_root"
  printf 'entry=%s\n' "$entry"
  printf 'HOME=%s\n' "$HOME"
  printf 'MERCLAW_HOME=%s\n' "$MERCLAW_HOME"
  printf 'MERCLAW_STATE_DIR=%s\n' "$MERCLAW_STATE_DIR"
  printf 'MERCLAW_CONFIG_PATH=%s\n' "$MERCLAW_CONFIG_PATH"
} >/tmp/merclaw-release-media-memory-env.log
merclaw_e2e_enable_merclaw_cli_timeout
(
  cd "$package_root/dist/extensions/memory-core"
  find . -type f | sed 's#^\./##' | sort
) >/tmp/merclaw-release-media-memory-package-files.log

mock_pid="$(merclaw_e2e_start_mock_openai "$MOCK_PORT" /tmp/merclaw-release-media-memory-openai.log)"
merclaw_e2e_wait_mock_openai "$MOCK_PORT"

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
  --skip-health >/tmp/merclaw-release-media-memory-onboard.log 2>&1
cp "$MERCLAW_CONFIG_PATH" /tmp/merclaw-release-media-memory-config.json
merclaw plugins list --json >/tmp/merclaw-release-media-memory-plugins.json \
  2>/tmp/merclaw-release-media-memory-plugins.stderr.log
node scripts/e2e/lib/release-scenarios/assertions.mjs assert-file-contains /tmp/merclaw-release-media-memory-plugins.json memory-core
node scripts/e2e/lib/release-scenarios/assertions.mjs configure-mock-openai "$MOCK_PORT"

mkdir -p "$MERCLAW_STATE_DIR/workspace/memory" /tmp/merclaw-release-media-memory
printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yf7kAAAAASUVORK5CYII=' | base64 -d > /tmp/merclaw-release-media-memory/input.png

merclaw infer image describe \
  --file /tmp/merclaw-release-media-memory/input.png \
  --model openai/gpt-5.5 \
  --prompt "Describe this image and return marker $SUCCESS_MARKER" \
  --json >/tmp/merclaw-release-media-memory-describe.json 2>/tmp/merclaw-release-media-memory-describe.stderr.log
node scripts/e2e/lib/release-scenarios/assertions.mjs assert-image-describe /tmp/merclaw-release-media-memory-describe.json "$MOCK_REQUEST_LOG"

merclaw infer image generate \
  --model openai/gpt-image-1 \
  --prompt "Generate a tiny test image for $SUCCESS_MARKER" \
  --output /tmp/merclaw-release-media-memory/generated.png \
  --json >/tmp/merclaw-release-media-memory-generate.json 2>/tmp/merclaw-release-media-memory-generate.stderr.log
node scripts/e2e/lib/release-scenarios/assertions.mjs assert-image-generate /tmp/merclaw-release-media-memory-generate.json "$MOCK_REQUEST_LOG"

cat >"$MERCLAW_STATE_DIR/workspace/MEMORY.md" <<EOF
# Long-term memory

- The release media memory marker is $MEMORY_MARKER.
EOF

merclaw memory index --force >/tmp/merclaw-release-media-memory-index.log 2>&1
merclaw memory search "$MEMORY_MARKER" --json >/tmp/merclaw-release-media-memory-search-before.json 2>/tmp/merclaw-release-media-memory-search-before.stderr.log
node scripts/e2e/lib/release-scenarios/assertions.mjs assert-memory-search /tmp/merclaw-release-media-memory-search-before.json "$MEMORY_MARKER"

start_gateway /tmp/merclaw-release-media-memory-gateway-1.log
stop_gateway
start_gateway /tmp/merclaw-release-media-memory-gateway-2.log
merclaw memory search "$MEMORY_MARKER" --json >/tmp/merclaw-release-media-memory-search-after.json 2>/tmp/merclaw-release-media-memory-search-after.stderr.log
node scripts/e2e/lib/release-scenarios/assertions.mjs assert-memory-search /tmp/merclaw-release-media-memory-search-after.json "$MEMORY_MARKER"
stop_gateway

echo "Release media memory scenario passed."
