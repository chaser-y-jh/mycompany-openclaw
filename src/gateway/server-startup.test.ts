import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { MerClawConfig } from "../config/config.js";

const ensureMerClawModelsJsonMock = vi.fn<
  (
    config: unknown,
    agentDir: unknown,
    options?: unknown,
  ) => Promise<{ agentDir: string; wrote: boolean }>
>(async () => ({ agentDir: "/tmp/agent", wrote: false }));
const agentModelModuleLoadedMock = vi.fn();

vi.mock("../agents/agent-scope.js", () => ({
  resolveDefaultAgentDir: () => "/tmp/agent",
  resolveAgentWorkspaceDir: () => "/tmp/workspace",
  resolveDefaultAgentId: () => "default",
}));

vi.mock("../agents/models-config.js", () => ({
  ensureMerClawModelsJson: (config: unknown, agentDir: unknown, options?: unknown) =>
    ensureMerClawModelsJsonMock(config, agentDir, options),
}));

vi.mock("../agents/embedded-agent-runner/model.js", () => {
  agentModelModuleLoadedMock();
  return {
    resolveModel: () => ({}),
  };
});

let prewarmConfiguredPrimaryModel: typeof import("./server-startup-post-attach.js").testing.prewarmConfiguredPrimaryModel;
let shouldSkipStartupModelPrewarm: typeof import("./server-startup-post-attach.js").testing.shouldSkipStartupModelPrewarm;

function expectModelsJsonPrewarmCall(cfg: MerClawConfig) {
  expect(ensureMerClawModelsJsonMock).toHaveBeenCalledTimes(1);
  const [calledConfig, agentDir, options] = ensureMerClawModelsJsonMock.mock.calls.at(0) ?? [];
  expect(calledConfig).toBe(cfg);
  expect(agentDir).toBe("/tmp/agent");
  expect(options).toEqual({
    workspaceDir: "/tmp/workspace",
    providerDiscoveryProviderIds: ["openai"],
    providerDiscoveryTimeoutMs: 5000,
    providerDiscoveryEntriesOnly: true,
  });
}

describe("gateway startup primary model warmup", () => {
  beforeAll(async () => {
    ({
      testing: { prewarmConfiguredPrimaryModel, shouldSkipStartupModelPrewarm },
    } = await import("./server-startup-post-attach.js"));
  });

  beforeEach(() => {
    ensureMerClawModelsJsonMock.mockClear();
    agentModelModuleLoadedMock.mockClear();
  });

  it("prewarms an explicit configured primary model", async () => {
    const cfg = {
      agents: {
        defaults: {
          model: {
            primary: "openai/gpt-5.4",
          },
        },
      },
    } as MerClawConfig;

    await prewarmConfiguredPrimaryModel({
      cfg,
      log: { warn: vi.fn() },
    });

    expectModelsJsonPrewarmCall(cfg);
    expect(agentModelModuleLoadedMock).not.toHaveBeenCalled();
  });

  it("skips warmup when no explicit primary model is configured", async () => {
    await prewarmConfiguredPrimaryModel({
      cfg: {} as MerClawConfig,
      log: { warn: vi.fn() },
    });

    expect(ensureMerClawModelsJsonMock).not.toHaveBeenCalled();
    expect(agentModelModuleLoadedMock).not.toHaveBeenCalled();
  });

  it("honors the startup model prewarm skip env", () => {
    expect(shouldSkipStartupModelPrewarm({})).toBe(false);
    expect(
      shouldSkipStartupModelPrewarm({
        MERCLAW_SKIP_STARTUP_MODEL_PREWARM: "1",
      }),
    ).toBe(true);
    expect(
      shouldSkipStartupModelPrewarm({
        MERCLAW_SKIP_STARTUP_MODEL_PREWARM: "true",
      }),
    ).toBe(true);
  });

  it("skips static warmup for configured CLI backends", async () => {
    await prewarmConfiguredPrimaryModel({
      cfg: {
        agents: {
          defaults: {
            model: {
              primary: "codex-cli/gpt-5.5",
            },
            cliBackends: {
              "codex-cli": {
                command: "codex",
                args: ["exec"],
              },
            },
          },
        },
      } as MerClawConfig,
      log: { warn: vi.fn() },
    });

    expect(ensureMerClawModelsJsonMock).not.toHaveBeenCalled();
    expect(agentModelModuleLoadedMock).not.toHaveBeenCalled();
  });

  it("warns when scoped models.json preparation fails", async () => {
    ensureMerClawModelsJsonMock.mockRejectedValueOnce(new Error("models write failed"));
    const warn = vi.fn();

    await prewarmConfiguredPrimaryModel({
      cfg: {
        agents: {
          defaults: {
            model: {
              primary: "codex/gpt-5.4",
            },
          },
        },
      } as MerClawConfig,
      log: { warn },
    });

    expect(warn).toHaveBeenCalledWith(
      "startup model warmup failed for codex/gpt-5.4: Error: models write failed",
    );
  });
});
