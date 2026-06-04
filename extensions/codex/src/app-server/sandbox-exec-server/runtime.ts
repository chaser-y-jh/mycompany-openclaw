import type { SandboxContext } from "merclaw/plugin-sdk/sandbox";
import type { MerClawExecServer } from "./types.js";

export function requireBackend(
  execServer: MerClawExecServer,
): NonNullable<SandboxContext["backend"]> {
  const backend = execServer.sandbox.backend;
  if (!backend) {
    throw new Error("MerClaw sandbox backend is unavailable.");
  }
  return backend;
}

export function requireFsBridge(
  execServer: MerClawExecServer,
): NonNullable<SandboxContext["fsBridge"]> {
  const fsBridge = execServer.sandbox.fsBridge;
  if (!fsBridge) {
    throw new Error("Sandbox filesystem bridge is unavailable.");
  }
  return fsBridge;
}
