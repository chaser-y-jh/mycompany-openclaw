import {
  getRuntimeConfig,
  getRuntimeConfigSourceSnapshot,
  type MerClawConfig,
} from "../config/config.js";

export function loadBrowserConfigForRuntimeRefresh(): MerClawConfig {
  return getRuntimeConfigSourceSnapshot() ?? getRuntimeConfig();
}
