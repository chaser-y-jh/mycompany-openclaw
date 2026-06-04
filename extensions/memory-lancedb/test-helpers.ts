import fs from "node:fs/promises";
import path from "node:path";
import { resolvePreferredMerClawTmpDir } from "merclaw/plugin-sdk/temp-path";
import { afterEach, beforeEach } from "vitest";

export function installTmpDirHarness(params: { prefix: string }) {
  let tmpDir = "";
  let dbPath = "";

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(resolvePreferredMerClawTmpDir(), params.prefix));
    dbPath = path.join(tmpDir, "lancedb");
  });

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  return {
    getTmpDir: () => tmpDir,
    getDbPath: () => dbPath,
  };
}
