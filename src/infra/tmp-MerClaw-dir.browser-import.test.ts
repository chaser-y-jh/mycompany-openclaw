import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import { build, type Plugin } from "esbuild";
import { describe, expect, it } from "vitest";

describe("tmp-merclaw-dir browser-safe import", () => {
  it("loads when a browser fs shim omits constants", async () => {
    const resultKey = `__merclawTmpDirBrowserImport_${crypto.randomUUID().replaceAll("-", "_")}`;
    const nodeShimPlugin: Plugin = {
      name: "node-browser-shims",
      setup(pluginBuild) {
        pluginBuild.onResolve({ filter: /^node:(fs|os|path)$/ }, (args) => ({
          path: args.path,
          namespace: "node-browser-shim",
        }));
        pluginBuild.onLoad({ filter: /^node:fs$/, namespace: "node-browser-shim" }, () => ({
          contents: "export default { constants: undefined };",
          loader: "js",
        }));
        pluginBuild.onLoad({ filter: /^node:os$/, namespace: "node-browser-shim" }, () => ({
          contents: 'export const tmpdir = () => "/tmp";',
          loader: "js",
        }));
        pluginBuild.onLoad({ filter: /^node:path$/, namespace: "node-browser-shim" }, () => ({
          contents: "export default { join: (...parts) => parts.join('/') };",
          loader: "js",
        }));
      },
    };

    const bundled = await build({
      bundle: true,
      format: "esm",
      platform: "browser",
      plugins: [nodeShimPlugin],
      stdin: {
        contents: `
          import { POSIX_MERCLAW_TMP_DIR, resolvePreferredMerClawTmpDir } from "./src/infra/tmp-merclaw-dir.ts";
          globalThis.${resultKey} = {
            posixTmpDir: POSIX_MERCLAW_TMP_DIR,
            resolverType: typeof resolvePreferredMerClawTmpDir,
          };
        `,
        loader: "ts",
        resolveDir: process.cwd(),
        sourcefile: "tmp-merclaw-dir-browser-entry.ts",
      },
      write: false,
    });

    const bundledSource = bundled.outputFiles[0]?.text;
    expect(bundledSource).toContain(resultKey);

    await import(`data:text/javascript;base64,${Buffer.from(bundledSource).toString("base64")}`);

    try {
      expect((globalThis as Record<string, unknown>)[resultKey]).toEqual({
        posixTmpDir: "/tmp/merclaw",
        resolverType: "function",
      });
    } finally {
      delete (globalThis as Record<string, unknown>)[resultKey];
    }
  });
});
