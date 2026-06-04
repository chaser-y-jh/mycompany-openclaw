import deprecatedPublicPluginSdkSubpaths from "./plugin-sdk-deprecated-public-subpaths.json" with { type: "json" };

const DEPRECATED_PLUGIN_SDK_EXTRA_SPECIFIERS = [
  "merclaw/plugin-sdk",
  "merclaw/plugin-sdk/agent-dir-compat",
  "merclaw/plugin-sdk/test-utils",
];

export function buildDeprecatedPluginSdkModuleSpecifiers(
  deprecatedSubpaths = deprecatedPublicPluginSdkSubpaths,
) {
  return [
    ...new Set([
      ...DEPRECATED_PLUGIN_SDK_EXTRA_SPECIFIERS,
      ...deprecatedSubpaths.map((subpath) => `merclaw/plugin-sdk/${subpath}`),
    ]),
  ].toSorted();
}
