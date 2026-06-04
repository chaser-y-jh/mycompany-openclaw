#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker-e2e-image.sh"

IMAGE_NAME="$(docker_e2e_resolve_image "merclaw-codex-media-path-e2e" MERCLAW_CODEX_MEDIA_PATH_E2E_IMAGE)"
PORT="${MERCLAW_CODEX_MEDIA_PATH_PORT:-18790}"
TOKEN="codex-media-path-e2e-$$"
CODEX_PLUGIN_SPEC="${MERCLAW_CODEX_MEDIA_PATH_PLUGIN_SPEC:-npm:@merclaw/codex}"

docker_e2e_build_or_reuse "$IMAGE_NAME" codex-media-path "$ROOT_DIR/scripts/e2e/Dockerfile" "$ROOT_DIR"
MERCLAW_TEST_STATE_SCRIPT_B64="$(docker_e2e_test_state_shell_b64 codex-media-path empty)"

echo "Running Codex media-path Docker E2E..."
docker_e2e_run_logged_with_harness codex-media-path \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  -e "MERCLAW_CODEX_MEDIA_PATH_PLUGIN_SPEC=$CODEX_PLUGIN_SPEC" \
  -e "MERCLAW_CODEX_MEDIA_PATH_TIMEOUT_SECONDS=${MERCLAW_CODEX_MEDIA_PATH_TIMEOUT_SECONDS:-180}" \
  -e "MERCLAW_ALLOW_INSECURE_PRIVATE_WS=1" \
  -e "MERCLAW_GATEWAY_TOKEN=$TOKEN" \
  -e "MERCLAW_TEST_STATE_SCRIPT_B64=$MERCLAW_TEST_STATE_SCRIPT_B64" \
  -e "PORT=$PORT" \
  -v "$ROOT_DIR/src:/app/src:ro" \
  -v "$ROOT_DIR/test/helpers:/app/test/helpers:ro" \
  "$IMAGE_NAME" \
  bash scripts/e2e/lib/codex-media-path/scenario.sh
