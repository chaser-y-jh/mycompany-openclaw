#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker-e2e-image.sh"
IMAGE_NAME="$(docker_e2e_resolve_image "merclaw-bundled-plugin-install-uninstall-e2e" MERCLAW_BUNDLED_PLUGIN_INSTALL_UNINSTALL_E2E_IMAGE)"

docker_e2e_build_or_reuse "$IMAGE_NAME" bundled-plugin-install-uninstall
MERCLAW_TEST_STATE_SCRIPT_B64="$(docker_e2e_test_state_shell_b64 bundled-plugin-install-uninstall empty)"

DOCKER_ENV_ARGS=(
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  -e "MERCLAW_TEST_STATE_SCRIPT_B64=$MERCLAW_TEST_STATE_SCRIPT_B64"
)
for env_name in \
  MERCLAW_BUNDLED_PLUGIN_SWEEP_TOTAL \
  MERCLAW_BUNDLED_PLUGIN_SWEEP_INDEX \
  MERCLAW_BUNDLED_PLUGIN_SWEEP_IDS \
  MERCLAW_BUNDLED_PLUGIN_RUNTIME_SMOKE \
  MERCLAW_BUNDLED_PLUGIN_RUNTIME_PORT_BASE \
  MERCLAW_BUNDLED_PLUGIN_RUNTIME_OUTPUT_CHARS \
  MERCLAW_BUNDLED_PLUGIN_RUNTIME_READY_MS \
  MERCLAW_BUNDLED_PLUGIN_RUNTIME_RPC_MS \
  MERCLAW_BUNDLED_PLUGIN_RUNTIME_WATCHDOG_MS \
  MERCLAW_BUNDLED_PLUGIN_TTS_LIVE_PROVIDER \
  MERCLAW_PLUGIN_LIFECYCLE_TRACE \
  OPENAI_API_KEY; do
  env_value="${!env_name:-}"
  if [[ -n "$env_value" && "$env_value" != "undefined" && "$env_value" != "null" ]]; then
    DOCKER_ENV_ARGS+=(-e "$env_name")
  fi
done

echo "Running bundled plugin install/uninstall Docker E2E..."
RUN_LOG="$(mktemp "${TMPDIR:-/tmp}/merclaw-bundled-plugin-install-uninstall.XXXXXX")"
cleanup() {
  rm -f "$RUN_LOG"
}
trap cleanup EXIT

if ! docker_e2e_run_with_harness \
  "${DOCKER_ENV_ARGS[@]}" \
  "$IMAGE_NAME" \
  bash scripts/e2e/lib/bundled-plugin-install-uninstall/sweep.sh 2>&1 |
  tee "$RUN_LOG"
then
  exit 1
fi

echo "OK"
