import { installedPluginRoot } from "merclaw/plugin-sdk/test-fixtures";
import { describe, expect, it } from "vitest";
import {
  buildNpmInstallRecordFields,
  logPinnedNpmSpecMessages,
  mapNpmResolutionMetadata,
  resolvePinnedNpmInstallRecord,
  resolvePinnedNpmInstallRecordForCli,
  resolvePinnedNpmSpec,
} from "./npm-resolution.js";

const CLI_STATE_ROOT = "/tmp/merclaw";
const ALPHA_INSTALL_PATH = installedPluginRoot(CLI_STATE_ROOT, "alpha");

describe("npm-resolution helpers", () => {
  it("keeps the requested selector when pin is disabled", () => {
    const result = resolvePinnedNpmSpec({
      rawSpec: "@merclaw/plugin-alpha@latest",
      pin: false,
      resolvedSpec: "@merclaw/plugin-alpha@1.2.3",
    });
    expect(result).toEqual({
      recordSpec: "@merclaw/plugin-alpha@latest",
    });
  });

  it("keeps original spec when resolution is missing and pin is disabled", () => {
    const result = resolvePinnedNpmSpec({
      rawSpec: "@merclaw/plugin-alpha@latest",
      pin: false,
    });
    expect(result).toEqual({
      recordSpec: "@merclaw/plugin-alpha@latest",
    });
  });

  it("warns when pin is enabled but resolved spec is missing", () => {
    const result = resolvePinnedNpmSpec({
      rawSpec: "@merclaw/plugin-alpha@latest",
      pin: true,
    });
    expect(result).toEqual({
      recordSpec: "@merclaw/plugin-alpha@latest",
      pinWarning: "Could not resolve exact npm version for --pin; storing original npm spec.",
    });
  });

  it("returns pinned spec notice when resolved spec is available", () => {
    const result = resolvePinnedNpmSpec({
      rawSpec: "@merclaw/plugin-alpha@latest",
      pin: true,
      resolvedSpec: "@merclaw/plugin-alpha@1.2.3",
    });
    expect(result).toEqual({
      recordSpec: "@merclaw/plugin-alpha@1.2.3",
      pinNotice: "Pinned npm install record to @merclaw/plugin-alpha@1.2.3.",
    });
  });

  it("maps npm resolution metadata to install fields", () => {
    expect(
      mapNpmResolutionMetadata({
        name: "@merclaw/plugin-alpha",
        version: "1.2.3",
        resolvedSpec: "@merclaw/plugin-alpha@1.2.3",
        integrity: "sha512-abc",
        shasum: "deadbeef",
        resolvedAt: "2026-02-21T00:00:00.000Z",
      }),
    ).toEqual({
      resolvedName: "@merclaw/plugin-alpha",
      resolvedVersion: "1.2.3",
      resolvedSpec: "@merclaw/plugin-alpha@1.2.3",
      integrity: "sha512-abc",
      shasum: "deadbeef",
      resolvedAt: "2026-02-21T00:00:00.000Z",
    });
  });

  it("builds common npm install record fields", () => {
    expect(
      buildNpmInstallRecordFields({
        spec: "@merclaw/plugin-alpha@latest",
        installPath: ALPHA_INSTALL_PATH,
        version: "1.2.3",
        resolution: {
          name: "@merclaw/plugin-alpha",
          version: "1.2.3",
          resolvedSpec: "@merclaw/plugin-alpha@1.2.3",
          integrity: "sha512-abc",
        },
      }),
    ).toEqual({
      source: "npm",
      spec: "@merclaw/plugin-alpha@latest",
      installPath: ALPHA_INSTALL_PATH,
      version: "1.2.3",
      resolvedName: "@merclaw/plugin-alpha",
      resolvedVersion: "1.2.3",
      resolvedSpec: "@merclaw/plugin-alpha@1.2.3",
      integrity: "sha512-abc",
      shasum: undefined,
      resolvedAt: undefined,
    });
  });

  it("logs pin warning/notice messages through provided writers", () => {
    const logs: string[] = [];
    const warns: string[] = [];
    logPinnedNpmSpecMessages(
      {
        pinWarning: "warn-1",
        pinNotice: "notice-1",
      },
      (message) => logs.push(message),
      (message) => warns.push(message),
    );

    expect(logs).toEqual(["notice-1"]);
    expect(warns).toEqual(["warn-1"]);
  });

  it("resolves pinned install record and emits pin notice", () => {
    const logs: string[] = [];
    const warns: string[] = [];
    const record = resolvePinnedNpmInstallRecord({
      rawSpec: "@merclaw/plugin-alpha@latest",
      pin: true,
      installPath: ALPHA_INSTALL_PATH,
      version: "1.2.3",
      resolution: {
        name: "@merclaw/plugin-alpha",
        version: "1.2.3",
        resolvedSpec: "@merclaw/plugin-alpha@1.2.3",
      },
      log: (message) => logs.push(message),
      warn: (message) => warns.push(message),
    });

    expect(record).toEqual({
      source: "npm",
      spec: "@merclaw/plugin-alpha@1.2.3",
      installPath: ALPHA_INSTALL_PATH,
      version: "1.2.3",
      resolvedName: "@merclaw/plugin-alpha",
      resolvedVersion: "1.2.3",
      resolvedSpec: "@merclaw/plugin-alpha@1.2.3",
      integrity: undefined,
      shasum: undefined,
      resolvedAt: undefined,
    });
    expect(logs).toEqual(["Pinned npm install record to @merclaw/plugin-alpha@1.2.3."]);
    expect(warns).toStrictEqual([]);
  });

  it("resolves pinned install record for CLI and formats warning output", () => {
    const logs: string[] = [];
    const record = resolvePinnedNpmInstallRecordForCli(
      "@merclaw/plugin-alpha@latest",
      true,
      ALPHA_INSTALL_PATH,
      "1.2.3",
      undefined,
      (message) => logs.push(message),
      (message) => `[warn] ${message}`,
    );

    expect(record).toEqual({
      source: "npm",
      spec: "@merclaw/plugin-alpha@latest",
      installPath: ALPHA_INSTALL_PATH,
      version: "1.2.3",
      resolvedName: undefined,
      resolvedVersion: undefined,
      resolvedSpec: undefined,
      integrity: undefined,
      shasum: undefined,
      resolvedAt: undefined,
    });
    expect(logs).toEqual([
      "[warn] Could not resolve exact npm version for --pin; storing original npm spec.",
    ]);
  });

  it("keeps install record selector for CLI unless --pin is requested", () => {
    const logs: string[] = [];
    const record = resolvePinnedNpmInstallRecordForCli(
      "@merclaw/plugin-alpha",
      false,
      ALPHA_INSTALL_PATH,
      "1.2.3",
      {
        name: "@merclaw/plugin-alpha",
        version: "1.2.3",
        resolvedSpec: "@merclaw/plugin-alpha@1.2.3",
      },
      (message) => logs.push(message),
      (message) => `[warn] ${message}`,
    );

    expect(record.spec).toBe("@merclaw/plugin-alpha");
    expect(logs).toEqual([]);
  });
});
