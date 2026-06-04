import { describe, expect, it } from "vitest";
import { resolveMerClawAgentDir } from "./agent-dir-compat.js";

describe("resolveMerClawAgentDir", () => {
  it("keeps the shipped Pi env alias for deprecated plugin SDK callers", () => {
    expect(
      resolveMerClawAgentDir({
        PI_CODING_AGENT_DIR: "/tmp/merclaw-legacy-agent",
      }),
    ).toBe("/tmp/merclaw-legacy-agent");
  });

  it("prefers the MerClaw env override over the deprecated Pi alias", () => {
    expect(
      resolveMerClawAgentDir({
        MERCLAW_AGENT_DIR: "/tmp/merclaw-agent",
        PI_CODING_AGENT_DIR: "/tmp/merclaw-legacy-agent",
      }),
    ).toBe("/tmp/merclaw-agent");
  });
});
