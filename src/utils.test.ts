import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { MAX_TIMER_TIMEOUT_MS } from "./shared/number-coercion.js";
import { withTempDir } from "./test-helpers/temp-dir.js";
import {
  ensureDir,
  resolveConfigDir,
  resolveHomeDir,
  resolveUserPath,
  shortenHomeInString,
  shortenHomePath,
  sleep,
} from "./utils.js";

describe("ensureDir", () => {
  it("creates nested directory", async () => {
    await withTempDir({ prefix: "merclaw-test-" }, async (tmp) => {
      const target = path.join(tmp, "nested", "dir");
      await ensureDir(target);
      expect(fs.existsSync(target)).toBe(true);
    });
  });
});

describe("sleep", () => {
  it("resolves after delay using fake timers", async () => {
    vi.useFakeTimers();
    try {
      const promise = sleep(1000);
      vi.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("clamps oversized sleep delays before scheduling", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    try {
      const promise = sleep(Number.MAX_SAFE_INTEGER);

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), MAX_TIMER_TIMEOUT_MS);

      vi.advanceTimersByTime(MAX_TIMER_TIMEOUT_MS);
      await expect(promise).resolves.toBeUndefined();
    } finally {
      setTimeoutSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});

describe("resolveConfigDir", () => {
  it("prefers ~/.merclaw when legacy dir is missing", async () => {
    await withTempDir({ prefix: "merclaw-config-dir-" }, async (root) => {
      const newDir = path.join(root, ".merclaw");
      await fs.promises.mkdir(newDir, { recursive: true });
      const resolved = resolveConfigDir({} as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(newDir);
    });
  });

  it("expands MERCLAW_STATE_DIR using the provided env", () => {
    const env = {
      HOME: "/tmp/merclaw-home",
      MERCLAW_STATE_DIR: "~/state",
    } as NodeJS.ProcessEnv;

    expect(resolveConfigDir(env)).toBe(path.resolve("/tmp/merclaw-home", "state"));
  });

  it("falls back to the config file directory when only MERCLAW_CONFIG_PATH is set", () => {
    const env = {
      HOME: "/tmp/merclaw-home",
      MERCLAW_CONFIG_PATH: "~/profiles/dev/merclaw.json",
    } as NodeJS.ProcessEnv;

    expect(resolveConfigDir(env)).toBe(path.resolve("/tmp/merclaw-home", "profiles", "dev"));
  });
});

describe("resolveHomeDir", () => {
  it("prefers MERCLAW_HOME over HOME", () => {
    vi.stubEnv("MERCLAW_HOME", "/srv/merclaw-home");
    vi.stubEnv("HOME", "/home/other");
    try {
      expect(resolveHomeDir()).toBe(path.resolve("/srv/merclaw-home"));
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("shortenHomePath", () => {
  it("uses $MERCLAW_HOME prefix when MERCLAW_HOME is set", () => {
    vi.stubEnv("MERCLAW_HOME", "/srv/merclaw-home");
    vi.stubEnv("HOME", "/home/other");
    try {
      expect(shortenHomePath(`${path.resolve("/srv/merclaw-home")}/.merclaw/merclaw.json`)).toBe(
        "$MERCLAW_HOME/.merclaw/merclaw.json",
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("shortenHomeInString", () => {
  it("uses $MERCLAW_HOME replacement when MERCLAW_HOME is set", () => {
    vi.stubEnv("MERCLAW_HOME", "/srv/merclaw-home");
    vi.stubEnv("HOME", "/home/other");
    try {
      expect(
        shortenHomeInString(
          `config: ${path.resolve("/srv/merclaw-home")}/.merclaw/merclaw.json`,
        ),
      ).toBe("config: $MERCLAW_HOME/.merclaw/merclaw.json");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("resolveUserPath", () => {
  it("expands ~ to home dir", () => {
    expect(resolveUserPath("~", {}, () => "/Users/thoffman")).toBe(path.resolve("/Users/thoffman"));
  });

  it("expands ~/ to home dir", () => {
    expect(resolveUserPath("~/merclaw", {}, () => "/Users/thoffman")).toBe(
      path.resolve("/Users/thoffman", "merclaw"),
    );
  });

  it("resolves relative paths", () => {
    expect(resolveUserPath("tmp/dir")).toBe(path.resolve("tmp/dir"));
  });

  it("prefers MERCLAW_HOME for tilde expansion", () => {
    vi.stubEnv("MERCLAW_HOME", "/srv/merclaw-home");
    vi.stubEnv("HOME", "/home/other");
    try {
      expect(resolveUserPath("~/merclaw")).toBe(path.resolve("/srv/merclaw-home", "merclaw"));
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("uses the provided env for tilde expansion", () => {
    const env = {
      HOME: "/tmp/merclaw-home",
      MERCLAW_HOME: "/srv/merclaw-home",
    } as NodeJS.ProcessEnv;

    expect(resolveUserPath("~/merclaw", env)).toBe(path.resolve("/srv/merclaw-home", "merclaw"));
  });

  it("keeps blank paths blank", () => {
    expect(resolveUserPath("")).toBe("");
    expect(resolveUserPath("   ")).toBe("");
  });

  it("returns empty string for undefined/null input", () => {
    expect(resolveUserPath(undefined as unknown as string)).toBe("");
    expect(resolveUserPath(null as unknown as string)).toBe("");
  });
});
