import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveDefaultAgentWorkspaceDir } from "./workspace.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("DEFAULT_AGENT_WORKSPACE_DIR", () => {
  it("uses MERCLAW_HOME when resolving the default workspace dir", () => {
    const home = path.join(path.sep, "srv", "merclaw-home");
    vi.stubEnv("MERCLAW_HOME", home);
    vi.stubEnv("HOME", path.join(path.sep, "home", "other"));

    expect(resolveDefaultAgentWorkspaceDir()).toBe(
      path.join(path.resolve(home), ".merclaw", "workspace"),
    );
  });

  it("uses MERCLAW_WORKSPACE_DIR before MERCLAW_HOME", () => {
    const workspaceDir = path.join(path.sep, "srv", "merclaw-workspace");
    vi.stubEnv("MERCLAW_WORKSPACE_DIR", workspaceDir);
    vi.stubEnv("MERCLAW_HOME", path.join(path.sep, "srv", "merclaw-home"));

    expect(resolveDefaultAgentWorkspaceDir()).toBe(path.resolve(workspaceDir));
  });
});
