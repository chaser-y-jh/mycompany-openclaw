---
summary: "CLI reference for `merclaw setup` (initialize config plus workspace, optionally run onboarding)"
read_when:
  - You're doing first-run setup without full CLI onboarding
  - You want to set the default workspace path
  - You need every flag and how setup decides between baseline and wizard mode
title: "Setup"
---

# `merclaw setup`

Initialize the baseline config and agent workspace. With any onboarding flag present, also runs the wizard.

<Note>
`merclaw setup` is for mutable config installs. In Nix mode (`MERCLAW_NIX_MODE=1`) MerClaw refuses setup writes because the config file is managed by Nix. Use the first-party [nix-merclaw Quick Start](https://github.com/merclaw/nix-merclaw#quick-start) or the equivalent source config for another Nix package.
</Note>

## Options

| Flag                       | Description                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| `--workspace <dir>`        | Agent workspace directory (default `~/.merclaw/workspace`; stored as `agents.defaults.workspace`). |
| `--wizard`                 | Run interactive onboarding.                                                                         |
| `--non-interactive`        | Run onboarding without prompts.                                                                     |
| `--mode <mode>`            | Onboarding mode: `local` or `remote`.                                                               |
| `--import-from <provider>` | Migration provider to run during onboarding.                                                        |
| `--import-source <path>`   | Source agent home for `--import-from`.                                                              |
| `--import-secrets`         | Import supported secrets during onboarding migration.                                               |
| `--remote-url <url>`       | Remote Gateway WebSocket URL.                                                                       |
| `--remote-token <token>`   | Remote Gateway token (optional).                                                                    |

### Wizard auto-trigger

`merclaw setup` runs the wizard when any of these flags are explicitly present, even without `--wizard`:

`--wizard`, `--non-interactive`, `--mode`, `--import-from`, `--import-source`, `--import-secrets`, `--remote-url`, `--remote-token`.

## Examples

```bash
merclaw setup
merclaw setup --workspace ~/.merclaw/workspace
merclaw setup --wizard
merclaw setup --wizard --import-from hermes --import-source ~/.hermes
merclaw setup --non-interactive --mode remote --remote-url wss://gateway-host:18789 --remote-token <token>
```

## Notes

- Plain `merclaw setup` initializes config and workspace without running the full onboarding flow.
- After plain setup, run `merclaw onboard` for the full guided journey, `merclaw configure` for targeted changes, or `merclaw channels add` to add channel accounts.
- If Hermes state is detected, interactive onboarding can offer migration automatically. Import onboarding requires a fresh setup; use [Migrate](/cli/migrate) for dry-run plans, backups, and overwrite mode outside onboarding.

## Related

- [CLI reference](/cli)
- [Onboarding (CLI)](/start/wizard)
- [Getting started](/start/getting-started)
- [Install overview](/install)
