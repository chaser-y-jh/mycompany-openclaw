---
summary: "Uninstall MerClaw completely (CLI, service, state, workspace)"
read_when:
  - You want to remove MerClaw from a machine
  - The gateway service is still running after uninstall
title: "Uninstall"
---

Two paths:

- **Easy path** if `merclaw` is still installed.
- **Manual service removal** if the CLI is gone but the service is still running.

## Easy path (CLI still installed)

Recommended: use the built-in uninstaller:

```bash
merclaw uninstall
```

Non-interactive (automation / npx):

```bash
merclaw uninstall --all --yes --non-interactive
npx -y merclaw uninstall --all --yes --non-interactive
```

Manual steps (same result):

1. Stop the gateway service:

```bash
merclaw gateway stop
```

2. Uninstall the gateway service (launchd/systemd/schtasks):

```bash
merclaw gateway uninstall
```

3. Delete state + config:

```bash
rm -rf "${MERCLAW_STATE_DIR:-$HOME/.merclaw}"
```

If you set `MERCLAW_CONFIG_PATH` to a custom location outside the state dir, delete that file too.

4. Delete your workspace (optional, removes agent files):

```bash
rm -rf ~/.merclaw/workspace
```

5. Remove the CLI install (pick the one you used):

```bash
npm rm -g merclaw
pnpm remove -g merclaw
bun remove -g merclaw
```

6. If you installed the macOS app:

```bash
rm -rf /Applications/MerClaw.app
```

Notes:

- If you used profiles (`--profile` / `MERCLAW_PROFILE`), repeat step 3 for each state dir (defaults are `~/.merclaw-<profile>`).
- In remote mode, the state dir lives on the **gateway host**, so run steps 1-4 there too.

## Manual service removal (CLI not installed)

Use this if the gateway service keeps running but `merclaw` is missing.

### macOS (launchd)

Default label is `ai.merclaw.gateway` (or `ai.merclaw.<profile>`; legacy `com.merclaw.*` may still exist):

```bash
launchctl bootout gui/$UID/ai.merclaw.gateway
rm -f ~/Library/LaunchAgents/ai.merclaw.gateway.plist
```

If you used a profile, replace the label and plist name with `ai.merclaw.<profile>`. Remove any legacy `com.merclaw.*` plists if present.

### Linux (systemd user unit)

Default unit name is `merclaw-gateway.service` (or `merclaw-gateway-<profile>.service`):

```bash
systemctl --user disable --now merclaw-gateway.service
rm -f ~/.config/systemd/user/merclaw-gateway.service
systemctl --user daemon-reload
```

### Windows (Scheduled Task)

Default task name is `MerClaw Gateway` (or `MerClaw Gateway (<profile>)`).
The task script lives under your state dir.

```powershell
schtasks /Delete /F /TN "MerClaw Gateway"
Remove-Item -Force "$env:USERPROFILE\.merclaw\gateway.cmd"
```

If you used a profile, delete the matching task name and `~\.merclaw-<profile>\gateway.cmd`.

## Normal install vs source checkout

### Normal install (install.sh / npm / pnpm / bun)

If you used `https://merclaw.ai/install.sh` or `install.ps1`, the CLI was installed with `npm install -g merclaw@latest`.
Remove it with `npm rm -g merclaw` (or `pnpm remove -g` / `bun remove -g` if you installed that way).

### Source checkout (git clone)

If you run from a repo checkout (`git clone` + `merclaw ...` / `bun run merclaw ...`):

1. Uninstall the gateway service **before** deleting the repo (use the easy path above or manual service removal).
2. Delete the repo directory.
3. Remove state + workspace as shown above.

## Related

- [Install overview](/install)
- [Migration guide](/install/migrating)
