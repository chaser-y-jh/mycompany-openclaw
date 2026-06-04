import { describe, expect, it } from "vitest";
import {
  ensureMerClawExecMarkerOnProcess,
  markMerClawExecEnv,
  MERCLAW_CLI_ENV_VALUE,
  MERCLAW_CLI_ENV_VAR,
} from "./merclaw-exec-env.js";

describe("markMerClawExecEnv", () => {
  it("returns a cloned env object with the exec marker set", () => {
    const env = { PATH: "/usr/bin", MERCLAW_CLI: "0" };
    const marked = markMerClawExecEnv(env);

    expect(marked).toEqual({
      PATH: "/usr/bin",
      MERCLAW_CLI: MERCLAW_CLI_ENV_VALUE,
    });
    expect(marked).not.toBe(env);
    expect(env.MERCLAW_CLI).toBe("0");
  });
});

describe("ensureMerClawExecMarkerOnProcess", () => {
  it.each([
    {
      name: "mutates and returns the provided process env",
      env: { PATH: "/usr/bin" } as NodeJS.ProcessEnv,
    },
    {
      name: "overwrites an existing marker on the provided process env",
      env: { PATH: "/usr/bin", [MERCLAW_CLI_ENV_VAR]: "0" } as NodeJS.ProcessEnv,
    },
  ])("$name", ({ env }) => {
    expect(ensureMerClawExecMarkerOnProcess(env)).toBe(env);
    expect(env[MERCLAW_CLI_ENV_VAR]).toBe(MERCLAW_CLI_ENV_VALUE);
  });

  it("defaults to mutating process.env when no env object is provided", () => {
    const previous = process.env[MERCLAW_CLI_ENV_VAR];
    delete process.env[MERCLAW_CLI_ENV_VAR];

    try {
      expect(ensureMerClawExecMarkerOnProcess()).toBe(process.env);
      expect(process.env[MERCLAW_CLI_ENV_VAR]).toBe(MERCLAW_CLI_ENV_VALUE);
    } finally {
      if (previous === undefined) {
        delete process.env[MERCLAW_CLI_ENV_VAR];
      } else {
        process.env[MERCLAW_CLI_ENV_VAR] = previous;
      }
    }
  });
});
