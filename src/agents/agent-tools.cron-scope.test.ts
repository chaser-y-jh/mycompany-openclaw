import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnyAgentTool } from "./tools/common.js";

const mocks = vi.hoisted(() => {
  const stubTool = (name: string) =>
    ({
      name,
      label: name,
      displaySummary: name,
      description: name,
      parameters: { type: "object", properties: {} },
      execute: vi.fn(),
    }) satisfies AnyAgentTool;

  return {
    createMerClawToolsOptions: vi.fn(),
    stubTool,
  };
});

vi.mock("./merclaw-tools.js", () => ({
  createMerClawTools: (options: unknown) => {
    mocks.createMerClawToolsOptions(options);
    return [mocks.stubTool("cron")];
  },
}));

import "./test-helpers/fast-bash-tools.js";
import "./test-helpers/fast-coding-tools.js";
import { createMerClawCodingTools } from "./agent-tools.js";

function firstMerClawToolsOptions(): { cronSelfRemoveOnlyJobId?: string } | undefined {
  return mocks.createMerClawToolsOptions.mock.calls[0]?.[0] as
    | { cronSelfRemoveOnlyJobId?: string }
    | undefined;
}

describe("createMerClawCodingTools cron scope", () => {
  beforeEach(() => {
    mocks.createMerClawToolsOptions.mockClear();
  });

  it("scopes cron-triggered jobs to self-removal", () => {
    const tools = createMerClawCodingTools({
      trigger: "cron",
      jobId: "job-current",
    });

    expect(tools.map((tool) => tool.name)).toContain("cron");
    expect(firstMerClawToolsOptions()?.cronSelfRemoveOnlyJobId).toBe("job-current");
  });

  it("does not scope non-cron sessions", () => {
    createMerClawCodingTools({
      trigger: "user",
      jobId: "job-current",
    });

    expect(firstMerClawToolsOptions()?.cronSelfRemoveOnlyJobId).toBeUndefined();
  });
});
