import { describe, expect, it } from "vitest";
import { buildDeprecatedPluginSdkModuleSpecifiers } from "../../scripts/lib/deprecated-plugin-sdk-usage.mjs";
import deprecatedPublicPluginSdkSubpaths from "../../scripts/lib/plugin-sdk-deprecated-public-subpaths.json" with { type: "json" };

describe("scripts/check-deprecated-api-usage", () => {
  it("bans every curated deprecated public plugin SDK subpath", () => {
    const specifiers = new Set(buildDeprecatedPluginSdkModuleSpecifiers());

    for (const subpath of deprecatedPublicPluginSdkSubpaths) {
      expect(specifiers.has(`merclaw/plugin-sdk/${subpath}`), subpath).toBe(true);
    }
  });

  it("keeps root and private compatibility aliases explicit", () => {
    expect(buildDeprecatedPluginSdkModuleSpecifiers()).toEqual(
      expect.arrayContaining([
        "merclaw/plugin-sdk",
        "merclaw/plugin-sdk/agent-dir-compat",
        "merclaw/plugin-sdk/test-utils",
      ]),
    );
  });
});
