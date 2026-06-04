import { normalizeOptionalString } from "@merclaw/normalization-core/string-coerce";
import { normalizeStringEntries } from "@merclaw/normalization-core/string-normalization";
import { note } from "../../packages/terminal-core/src/note.js";
import { formatCliCommand } from "../cli/command-format.js";
import type { MerClawConfig } from "../config/types.merclaw.js";
import type { PairingChannel } from "../pairing/pairing-store.types.js";

function resolveConfiguredCommandOwners(cfg: MerClawConfig): string[] {
  const owners = cfg.commands?.ownerAllowFrom;
  if (!Array.isArray(owners)) {
    return [];
  }
  return normalizeStringEntries(owners.map((entry) => String(entry ?? "")));
}

export function hasConfiguredCommandOwners(cfg: MerClawConfig): boolean {
  return resolveConfiguredCommandOwners(cfg).length > 0;
}

export function formatCommandOwnerFromChannelSender(params: {
  channel: PairingChannel;
  id: string;
}): string | null {
  const id = normalizeOptionalString(params.id);
  if (!id) {
    return null;
  }
  const separatorIndex = id.indexOf(":");
  if (separatorIndex > 0) {
    const prefix = id.slice(0, separatorIndex);
    if (prefix.toLowerCase() === String(params.channel).toLowerCase()) {
      return id;
    }
  }
  return `${params.channel}:${id}`;
}

export function noteCommandOwnerHealth(cfg: MerClawConfig): void {
  if (hasConfiguredCommandOwners(cfg)) {
    return;
  }
  note(
    [
      "No command owner is configured.",
      "A command owner is the human operator account allowed to run owner-only commands and approve dangerous actions, including /diagnostics, /export-trajectory, /config, and exec approvals.",
      "DM pairing only lets someone talk to the bot; it does not make that sender the owner for privileged commands.",
      `Fix: set commands.ownerAllowFrom to your channel user id, for example ${formatCliCommand("merclaw config set commands.ownerAllowFrom '[\"telegram:123456789\"]'")}`,
      "Restart the gateway after changing this if it is already running.",
    ].join("\n"),
    "Command owner",
  );
}
