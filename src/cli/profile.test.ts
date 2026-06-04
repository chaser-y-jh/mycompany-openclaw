import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs([
      "node",
      "merclaw",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "merclaw", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("leaves gateway --dev for subcommands after leading root options", () => {
    const res = parseCliProfileArgs([
      "node",
      "merclaw",
      "--no-color",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual([
      "node",
      "merclaw",
      "--no-color",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "merclaw", "--dev", "gateway"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "merclaw", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "merclaw", "--profile", "work", "status"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "merclaw", "status"]);
  });

  it("parses interleaved --profile after the command token", () => {
    const res = parseCliProfileArgs(["node", "merclaw", "status", "--profile", "work", "--deep"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "merclaw", "status", "--deep"]);
  });

  it("preserves Matrix QA --profile for the command parser", () => {
    const res = parseCliProfileArgs([
      "node",
      "merclaw",
      "qa",
      "matrix",
      "--profile",
      "fast",
      "--fail-fast",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual([
      "node",
      "merclaw",
      "qa",
      "matrix",
      "--profile",
      "fast",
      "--fail-fast",
    ]);
  });

  it("preserves Matrix QA --profile after leading root options", () => {
    const res = parseCliProfileArgs([
      "node",
      "merclaw",
      "--no-color",
      "qa",
      "matrix",
      "--profile=fast",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "merclaw", "--no-color", "qa", "matrix", "--profile=fast"]);
  });

  it("still parses root --profile before Matrix QA", () => {
    const res = parseCliProfileArgs([
      "node",
      "merclaw",
      "--profile",
      "work",
      "qa",
      "matrix",
      "--fail-fast",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "merclaw", "qa", "matrix", "--fail-fast"]);
  });

  it("parses interleaved --dev after the command token", () => {
    const res = parseCliProfileArgs(["node", "merclaw", "status", "--dev"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "merclaw", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "merclaw", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it.each([
    ["--dev first", ["node", "merclaw", "--dev", "--profile", "work", "status"]],
    ["--profile first", ["node", "merclaw", "--profile", "work", "--dev", "status"]],
    ["interleaved after command", ["node", "merclaw", "status", "--profile", "work", "--dev"]],
  ])("rejects combining --dev with --profile (%s)", (_name, argv) => {
    const res = parseCliProfileArgs(argv);
    expect(res.ok).toBe(false);
  });
});

describe("applyCliProfileEnv", () => {
  it("fills env defaults for dev profile", () => {
    const env: Record<string, string | undefined> = {};
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    const expectedStateDir = path.join(path.resolve("/home/peter"), ".merclaw-dev");
    expect(env.MERCLAW_PROFILE).toBe("dev");
    expect(env.MERCLAW_STATE_DIR).toBe(expectedStateDir);
    expect(env.MERCLAW_CONFIG_PATH).toBe(path.join(expectedStateDir, "merclaw.json"));
    expect(env.MERCLAW_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      MERCLAW_PROFILE: "prod",
      MERCLAW_STATE_DIR: "/custom",
      MERCLAW_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.MERCLAW_PROFILE).toBe("dev");
    expect(env.MERCLAW_STATE_DIR).toBe("/custom");
    expect(env.MERCLAW_GATEWAY_PORT).toBe("19099");
    expect(env.MERCLAW_CONFIG_PATH).toBe(path.join("/custom", "merclaw.json"));
  });

  it("uses MERCLAW_HOME when deriving profile state dir", () => {
    const env: Record<string, string | undefined> = {
      MERCLAW_HOME: "/srv/merclaw-home",
      HOME: "/home/other",
    };
    applyCliProfileEnv({
      profile: "work",
      env,
      homedir: () => "/home/fallback",
    });

    const resolvedHome = path.resolve("/srv/merclaw-home");
    expect(env.MERCLAW_STATE_DIR).toBe(path.join(resolvedHome, ".merclaw-work"));
    expect(env.MERCLAW_CONFIG_PATH).toBe(
      path.join(resolvedHome, ".merclaw-work", "merclaw.json"),
    );
  });
});

describe("formatCliCommand", () => {
  it.each([
    {
      name: "no profile is set",
      cmd: "merclaw doctor --fix",
      env: {},
      expected: "merclaw doctor --fix",
    },
    {
      name: "profile is default",
      cmd: "merclaw doctor --fix",
      env: { MERCLAW_PROFILE: "default" },
      expected: "merclaw doctor --fix",
    },
    {
      name: "profile is Default (case-insensitive)",
      cmd: "merclaw doctor --fix",
      env: { MERCLAW_PROFILE: "Default" },
      expected: "merclaw doctor --fix",
    },
    {
      name: "profile is invalid",
      cmd: "merclaw doctor --fix",
      env: { MERCLAW_PROFILE: "bad profile" },
      expected: "merclaw doctor --fix",
    },
    {
      name: "--profile is already present",
      cmd: "merclaw --profile work doctor --fix",
      env: { MERCLAW_PROFILE: "work" },
      expected: "merclaw --profile work doctor --fix",
    },
    {
      name: "--dev is already present",
      cmd: "merclaw --dev doctor",
      env: { MERCLAW_PROFILE: "dev" },
      expected: "merclaw --dev doctor",
    },
  ])("returns command unchanged when $name", ({ cmd, env, expected }) => {
    expect(formatCliCommand(cmd, env)).toBe(expected);
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("merclaw doctor --fix", { MERCLAW_PROFILE: "work" })).toBe(
      "merclaw --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(formatCliCommand("merclaw doctor --fix", { MERCLAW_PROFILE: "  jbmerclaw  " })).toBe(
      "merclaw --profile jbmerclaw doctor --fix",
    );
  });

  it("handles command with no args after merclaw", () => {
    expect(formatCliCommand("merclaw", { MERCLAW_PROFILE: "test" })).toBe(
      "merclaw --profile test",
    );
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm merclaw doctor", { MERCLAW_PROFILE: "work" })).toBe(
      "pnpm merclaw --profile work doctor",
    );
  });

  it("inserts --container when a container hint is set", () => {
    expect(
      formatCliCommand("merclaw gateway status --deep", { MERCLAW_CONTAINER_HINT: "demo" }),
    ).toBe("merclaw --container demo gateway status --deep");
  });

  it("ignores unsafe container hints", () => {
    expect(
      formatCliCommand("merclaw gateway status --deep", {
        MERCLAW_CONTAINER_HINT: "demo; rm -rf /",
      }),
    ).toBe("merclaw gateway status --deep");
  });

  it("preserves both --container and --profile hints", () => {
    expect(
      formatCliCommand("merclaw doctor", {
        MERCLAW_CONTAINER_HINT: "demo",
        MERCLAW_PROFILE: "work",
      }),
    ).toBe("merclaw --container demo doctor");
  });

  it("does not prepend --container for update commands", () => {
    expect(formatCliCommand("merclaw update", { MERCLAW_CONTAINER_HINT: "demo" })).toBe(
      "merclaw update",
    );
    expect(
      formatCliCommand("pnpm merclaw update --channel beta", { MERCLAW_CONTAINER_HINT: "demo" }),
    ).toBe("pnpm merclaw update --channel beta");
  });
});
