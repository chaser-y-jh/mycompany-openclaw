import { describe, expect, it } from "vitest";
import {
  collectPluginNpmPublishedRuntimeErrors,
  findPackedPackageReadmePath,
  parseNpmReadmeMetadata,
  readPositiveIntEnv,
  resolveNpmPackFilename,
} from "../../scripts/verify-plugin-npm-published-runtime.mjs";

describe("plugin npm publish verifier retry limits", () => {
  it("rejects loose numeric retry env values instead of parsing prefixes", () => {
    expect(() =>
      readPositiveIntEnv("MERCLAW_PLUGIN_NPM_VERIFY_ATTEMPTS", 90, {
        MERCLAW_PLUGIN_NPM_VERIFY_ATTEMPTS: "2tries",
      }),
    ).toThrow("invalid MERCLAW_PLUGIN_NPM_VERIFY_ATTEMPTS: 2tries");
    expect(() =>
      readPositiveIntEnv("MERCLAW_PLUGIN_NPM_VERIFY_DELAY_MS", 10000, {
        MERCLAW_PLUGIN_NPM_VERIFY_DELAY_MS: "1e3",
      }),
    ).toThrow("invalid MERCLAW_PLUGIN_NPM_VERIFY_DELAY_MS: 1e3");
    expect(() =>
      readPositiveIntEnv("MERCLAW_PLUGIN_NPM_README_VERIFY_ATTEMPTS", 6, {
        MERCLAW_PLUGIN_NPM_README_VERIFY_ATTEMPTS: "0",
      }),
    ).toThrow("invalid MERCLAW_PLUGIN_NPM_README_VERIFY_ATTEMPTS: 0");
  });

  it("accepts strict positive retry env values and defaults", () => {
    expect(readPositiveIntEnv("MERCLAW_PLUGIN_NPM_VERIFY_ATTEMPTS", 90, {})).toBe(90);
    expect(
      readPositiveIntEnv("MERCLAW_PLUGIN_NPM_README_VERIFY_DELAY_MS", 10000, {
        MERCLAW_PLUGIN_NPM_README_VERIFY_DELAY_MS: "2500",
      }),
    ).toBe(2500);
  });
});

describe("collectPluginNpmPublishedRuntimeErrors", () => {
  it("flags published plugin packages with TypeScript entries and no compiled runtime output", () => {
    expect(
      collectPluginNpmPublishedRuntimeErrors({
        spec: "@merclaw/discord@2026.5.2",
        packageJson: {
          name: "@merclaw/discord",
          version: "2026.5.2",
          merclaw: {
            extensions: ["./index.ts"],
          },
        },
        files: ["package.json", "index.ts"],
      }),
    ).toEqual([
      "@merclaw/discord@2026.5.2 requires compiled runtime output for TypeScript entry ./index.ts: expected ./dist/index.js, ./dist/index.mjs, ./dist/index.cjs, ./index.js, ./index.mjs, ./index.cjs",
    ]);
  });

  it("accepts published plugin packages with explicit runtimeExtensions", () => {
    expect(
      collectPluginNpmPublishedRuntimeErrors({
        packageJson: {
          name: "@merclaw/zalo",
          version: "2026.5.3",
          merclaw: {
            extensions: ["./index.ts"],
            runtimeExtensions: ["./dist/index.js"],
          },
        },
        files: ["package.json", "index.ts", "dist/index.js"],
      }),
    ).toStrictEqual([]);
  });

  it("flags missing explicit runtimeExtensions outputs", () => {
    expect(
      collectPluginNpmPublishedRuntimeErrors({
        packageJson: {
          name: "@merclaw/line",
          version: "2026.5.3",
          merclaw: {
            extensions: ["./src/index.ts"],
            runtimeExtensions: ["./dist/index.js"],
          },
        },
        files: ["package.json", "src/index.ts"],
      }),
    ).toEqual(["@merclaw/line@2026.5.3 runtime extension entry not found: ./dist/index.js"]);
  });

  it("flags runtimeExtensions length mismatches", () => {
    expect(
      collectPluginNpmPublishedRuntimeErrors({
        packageJson: {
          name: "@merclaw/acpx",
          version: "2026.5.3",
          merclaw: {
            extensions: ["./index.ts", "./tools.ts"],
            runtimeExtensions: ["./dist/index.js"],
          },
        },
        files: ["package.json", "dist/index.js"],
      }),
    ).toEqual([
      "@merclaw/acpx@2026.5.3 package.json merclaw.runtimeExtensions length (1) must match merclaw.extensions length (2)",
    ]);
  });

  it("flags blank runtimeExtensions entries instead of falling back to inferred outputs", () => {
    expect(
      collectPluginNpmPublishedRuntimeErrors({
        packageJson: {
          name: "@merclaw/whatsapp",
          version: "2026.5.3",
          merclaw: {
            extensions: ["./src/index.ts"],
            runtimeExtensions: [" "],
          },
        },
        files: ["package.json", "src/index.ts", "dist/index.js"],
      }),
    ).toEqual([
      "@merclaw/whatsapp@2026.5.3 package.json merclaw.runtimeExtensions[0] must be a non-empty string",
    ]);
  });

  it("flags published plugin packages with TypeScript setup entries and no compiled setup runtime", () => {
    expect(
      collectPluginNpmPublishedRuntimeErrors({
        packageJson: {
          name: "@merclaw/line",
          version: "2026.5.3",
          merclaw: {
            extensions: ["./index.ts"],
            runtimeExtensions: ["./dist/index.js"],
            setupEntry: "./setup-entry.ts",
          },
        },
        files: ["package.json", "index.ts", "dist/index.js", "setup-entry.ts"],
      }),
    ).toEqual([
      "@merclaw/line@2026.5.3 requires compiled runtime output for TypeScript entry ./setup-entry.ts: expected ./dist/setup-entry.js, ./dist/setup-entry.mjs, ./dist/setup-entry.cjs, ./setup-entry.js, ./setup-entry.mjs, ./setup-entry.cjs",
    ]);
  });

  it("accepts published plugin packages with explicit runtimeSetupEntry", () => {
    expect(
      collectPluginNpmPublishedRuntimeErrors({
        packageJson: {
          name: "@merclaw/qqbot",
          version: "2026.5.3",
          merclaw: {
            extensions: ["./index.ts"],
            runtimeExtensions: ["./dist/index.js"],
            setupEntry: "./setup-entry.ts",
            runtimeSetupEntry: "./dist/setup-entry.js",
          },
        },
        files: ["package.json", "dist/index.js", "dist/setup-entry.js"],
      }),
    ).toStrictEqual([]);
  });

  it("flags missing explicit runtimeSetupEntry outputs", () => {
    expect(
      collectPluginNpmPublishedRuntimeErrors({
        packageJson: {
          name: "@merclaw/matrix",
          version: "2026.5.3",
          merclaw: {
            extensions: ["./index.ts"],
            runtimeExtensions: ["./dist/index.js"],
            setupEntry: "./setup-entry.ts",
            runtimeSetupEntry: "./dist/setup-entry.js",
          },
        },
        files: ["package.json", "dist/index.js"],
      }),
    ).toEqual(["@merclaw/matrix@2026.5.3 runtime setup entry not found: ./dist/setup-entry.js"]);
  });

  it("flags runtimeSetupEntry without setupEntry", () => {
    expect(
      collectPluginNpmPublishedRuntimeErrors({
        packageJson: {
          name: "@merclaw/twitch",
          version: "2026.5.3",
          merclaw: {
            extensions: ["./index.ts"],
            runtimeExtensions: ["./dist/index.js"],
            runtimeSetupEntry: "./dist/setup-entry.js",
          },
        },
        files: ["package.json", "dist/index.js", "dist/setup-entry.js"],
      }),
    ).toEqual([
      "@merclaw/twitch@2026.5.3 package.json merclaw.runtimeSetupEntry requires merclaw.setupEntry",
    ]);
  });
});

describe("resolveNpmPackFilename", () => {
  it("uses the final tarball filename from plain npm pack output", () => {
    const noisyOutput = [
      "npm notice",
      "npm notice package: @merclaw/msteams@2026.5.24-beta.1",
      "merclaw-msteams-2026.5.24-beta.1.tgz",
      "",
    ].join("\n");

    expect(resolveNpmPackFilename(noisyOutput)).toBe("merclaw-msteams-2026.5.24-beta.1.tgz");
  });
});

describe("findPackedPackageReadmePath", () => {
  it("finds a root package README without accepting nested documentation files", () => {
    expect(
      findPackedPackageReadmePath(["package.json", "docs/README.md", "README.md", "dist/index.js"]),
    ).toBe("README.md");
    expect(findPackedPackageReadmePath(["package.json", "docs/README.md"])).toBe("");
  });
});

describe("parseNpmReadmeMetadata", () => {
  it("accepts non-empty npm readme metadata", () => {
    expect(parseNpmReadmeMetadata(JSON.stringify("# Plugin\n\nInstall it."))).toBe(
      "# Plugin\n\nInstall it.",
    );
  });

  it("rejects empty or unsupported npm readme metadata", () => {
    expect(parseNpmReadmeMetadata(JSON.stringify(""))).toBe("");
    expect(parseNpmReadmeMetadata(JSON.stringify(null))).toBe("");
    expect(parseNpmReadmeMetadata("{")).toBe("");
  });
});
