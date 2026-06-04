import { importFreshModule } from "merclaw/plugin-sdk/test-fixtures";
import { afterEach, describe, expect, it, vi } from "vitest";

type LoggerModule = typeof import("./logger.js");

const originalGetBuiltinModule = (
  process as NodeJS.Process & { getBuiltinModule?: (id: string) => unknown }
).getBuiltinModule;

async function importBrowserSafeLogger(params?: {
  resolvePreferredMerClawTmpDir?: ReturnType<typeof vi.fn>;
}): Promise<{
  module: LoggerModule;
  resolvePreferredMerClawTmpDir: ReturnType<typeof vi.fn>;
}> {
  const resolvePreferredMerClawTmpDir =
    params?.resolvePreferredMerClawTmpDir ??
    vi.fn(() => {
      throw new Error("resolvePreferredMerClawTmpDir should not run during browser-safe import");
    });

  vi.doMock("../infra/tmp-merclaw-dir.js", async () => {
    const actual = await vi.importActual<typeof import("../infra/tmp-merclaw-dir.js")>(
      "../infra/tmp-merclaw-dir.js",
    );
    return {
      ...actual,
      resolvePreferredMerClawTmpDir,
    };
  });

  Object.defineProperty(process, "getBuiltinModule", {
    configurable: true,
    value: undefined,
  });

  const module = await importFreshModule<LoggerModule>(
    import.meta.url,
    "./logger.js?scope=browser-safe",
  );
  return { module, resolvePreferredMerClawTmpDir };
}

describe("logging/logger browser-safe import", () => {
  afterEach(() => {
    vi.doUnmock("../infra/tmp-merclaw-dir.js");
    Object.defineProperty(process, "getBuiltinModule", {
      configurable: true,
      value: originalGetBuiltinModule,
    });
  });

  it("does not resolve the preferred temp dir at import time when node fs is unavailable", async () => {
    const { module, resolvePreferredMerClawTmpDir } = await importBrowserSafeLogger();

    expect(resolvePreferredMerClawTmpDir).not.toHaveBeenCalled();
    expect(module.DEFAULT_LOG_DIR).toBe("/tmp/merclaw");
    expect(module.DEFAULT_LOG_FILE).toBe("/tmp/merclaw/merclaw.log");
  });

  it("disables file logging when imported in a browser-like environment", async () => {
    const { module, resolvePreferredMerClawTmpDir } = await importBrowserSafeLogger();

    expect(module.getResolvedLoggerSettings()).toStrictEqual({
      level: "silent",
      file: "/tmp/merclaw/merclaw.log",
      maxFileBytes: 100 * 1024 * 1024,
    });
    expect(module.isFileLogLevelEnabled("info")).toBe(false);
    expect(module.getLogger().info("browser-safe")).toBeUndefined();
    expect(resolvePreferredMerClawTmpDir).not.toHaveBeenCalled();
  });
});
