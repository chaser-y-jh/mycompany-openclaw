run_plugins_clawhub_scenario() {
  if [ "${MERCLAW_PLUGINS_E2E_CLAWHUB:-1}" = "0" ]; then
    echo "Skipping ClawHub plugin install and uninstall (MERCLAW_PLUGINS_E2E_CLAWHUB=0)."
  else
    echo "Testing ClawHub plugin install and uninstall..."
    CLAWHUB_PLUGIN_SPEC="${MERCLAW_PLUGINS_E2E_CLAWHUB_SPEC:-clawhub:@merclaw/kitchen-sink}"
    CLAWHUB_PLUGIN_ID="${MERCLAW_PLUGINS_E2E_CLAWHUB_ID:-merclaw-kitchen-sink-fixture}"
    export CLAWHUB_PLUGIN_SPEC CLAWHUB_PLUGIN_ID

    start_clawhub_fixture_server() {
      local fixture_dir="$1"
      local server_log="$fixture_dir/clawhub-fixture.log"
      local server_port_file="$fixture_dir/clawhub-fixture-port"
      local server_pid_file="$fixture_dir/clawhub-fixture-pid"

      node scripts/e2e/lib/clawhub-fixture-server.cjs plugins "$server_port_file" >"$server_log" 2>&1 &
      local server_pid="$!"
      echo "$server_pid" >"$server_pid_file"

      for _ in $(seq 1 100); do
        if [[ -s "$server_port_file" ]]; then
          export MERCLAW_CLAWHUB_URL="http://127.0.0.1:$(cat "$server_port_file")"
          merclaw_plugins_register_fixture_pid_file "$server_pid_file"
          return 0
        fi
        if ! kill -0 "$server_pid" 2>/dev/null; then
          cat "$server_log"
          return 1
        fi
        sleep 0.1
      done

      cat "$server_log"
      echo "Timed out waiting for ClawHub fixture server." >&2
      return 1
    }

    if [[ "${MERCLAW_PLUGINS_E2E_LIVE_CLAWHUB:-0}" = "1" ]]; then
      export MERCLAW_CLAWHUB_URL="${MERCLAW_CLAWHUB_URL:-${CLAWHUB_URL:-https://clawhub.ai}}"
      export NPM_CONFIG_REGISTRY="${MERCLAW_PLUGINS_E2E_LIVE_NPM_REGISTRY:-https://registry.npmjs.org/}"
    else
      # Keep the release-path smoke hermetic; live ClawHub can rate-limit CI.
      if [[ -n "${MERCLAW_CLAWHUB_URL:-}" || -n "${CLAWHUB_URL:-}" ]]; then
        echo "Ignoring ambient ClawHub URL for fixture-mode plugin E2E; set MERCLAW_PLUGINS_E2E_LIVE_CLAWHUB=1 for live ClawHub."
      fi
      unset MERCLAW_CLAWHUB_URL CLAWHUB_URL
      clawhub_fixture_dir="$(mktemp -d "$MERCLAW_PLUGINS_TMP_DIR/merclaw-clawhub-fixture.XXXXXX")"
      start_clawhub_fixture_server "$clawhub_fixture_dir"
    fi

    node scripts/e2e/lib/plugins/assertions.mjs clawhub-preflight

    run_plugins_merclaw_logged install-clawhub plugins install "$CLAWHUB_PLUGIN_SPEC"
    run_plugins_merclaw_capture "$MERCLAW_PLUGINS_TMP_DIR/plugins-clawhub-installed.json" plugins list --json
    run_plugins_merclaw_capture "$MERCLAW_PLUGINS_TMP_DIR/plugins-clawhub-inspect.json" plugins inspect "$CLAWHUB_PLUGIN_ID" --json

    node scripts/e2e/lib/plugins/assertions.mjs clawhub-installed

    merclaw_e2e_maybe_timeout "$MERCLAW_PLUGINS_CLI_TIMEOUT" node "$MERCLAW_ENTRY" plugins update "$CLAWHUB_PLUGIN_ID" >"$MERCLAW_PLUGINS_TMP_DIR/plugins-clawhub-update.log" 2>&1
    run_plugins_merclaw_capture "$MERCLAW_PLUGINS_TMP_DIR/plugins-clawhub-updated.json" plugins list --json
    run_plugins_merclaw_capture "$MERCLAW_PLUGINS_TMP_DIR/plugins-clawhub-updated-inspect.json" plugins inspect "$CLAWHUB_PLUGIN_ID" --json

    node scripts/e2e/lib/plugins/assertions.mjs clawhub-updated

    run_plugins_merclaw_logged uninstall-clawhub plugins uninstall "$CLAWHUB_PLUGIN_SPEC" --force
    run_plugins_merclaw_capture "$MERCLAW_PLUGINS_TMP_DIR/plugins-clawhub-uninstalled.json" plugins list --json

    node scripts/e2e/lib/plugins/assertions.mjs clawhub-removed
  fi
}
