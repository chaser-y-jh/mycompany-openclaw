#!/usr/bin/env bash
set -euo pipefail

cd /repo

export MERCLAW_STATE_DIR="/tmp/merclaw-test"
export MERCLAW_CONFIG_PATH="${MERCLAW_STATE_DIR}/merclaw.json"

echo "==> Build"
if ! pnpm build >/tmp/merclaw-cleanup-build.log 2>&1; then
  cat /tmp/merclaw-cleanup-build.log
  exit 1
fi

echo "==> Seed state"
mkdir -p "${MERCLAW_STATE_DIR}/credentials"
mkdir -p "${MERCLAW_STATE_DIR}/agents/main/sessions"
echo '{}' >"${MERCLAW_CONFIG_PATH}"
echo 'creds' >"${MERCLAW_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${MERCLAW_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
if ! pnpm merclaw reset --scope config+creds+sessions --yes --non-interactive >/tmp/merclaw-cleanup-reset.log 2>&1; then
  cat /tmp/merclaw-cleanup-reset.log
  exit 1
fi

test ! -f "${MERCLAW_CONFIG_PATH}"
test ! -d "${MERCLAW_STATE_DIR}/credentials"
test ! -d "${MERCLAW_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${MERCLAW_STATE_DIR}/credentials"
echo '{}' >"${MERCLAW_CONFIG_PATH}"

echo "==> Uninstall (state only)"
if ! pnpm merclaw uninstall --state --yes --non-interactive >/tmp/merclaw-cleanup-uninstall.log 2>&1; then
  cat /tmp/merclaw-cleanup-uninstall.log
  exit 1
fi

test ! -d "${MERCLAW_STATE_DIR}"

echo "OK"
