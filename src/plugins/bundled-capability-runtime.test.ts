import { describe, expect, it } from "vitest";
import { buildVitestCapabilityShimAliasMap } from "./bundled-capability-runtime.js";

describe("buildVitestCapabilityShimAliasMap", () => {
  it("keeps scoped and unscoped capability shim aliases aligned", () => {
    const aliasMap = buildVitestCapabilityShimAliasMap();

    expect(aliasMap["merclaw/plugin-sdk/config-runtime"]).toBe(
      aliasMap["@merclaw/plugin-sdk/config-runtime"],
    );
    expect(aliasMap["merclaw/plugin-sdk/media-runtime"]).toBe(
      aliasMap["@merclaw/plugin-sdk/media-runtime"],
    );
    expect(aliasMap["merclaw/plugin-sdk/provider-onboard"]).toBe(
      aliasMap["@merclaw/plugin-sdk/provider-onboard"],
    );
    expect(aliasMap["merclaw/plugin-sdk/speech-core"]).toBe(
      aliasMap["@merclaw/plugin-sdk/speech-core"],
    );
  });
});
