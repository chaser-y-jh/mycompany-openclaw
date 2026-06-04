import type { PluginRuntime } from "merclaw/plugin-sdk/core";
import { createPluginRuntimeStore } from "merclaw/plugin-sdk/runtime-store";

const {
  setRuntime: setSignalRuntime,
  getRuntime: getSignalRuntime,
  tryGetRuntime: getOptionalSignalRuntime,
  clearRuntime: clearSignalRuntime,
} = createPluginRuntimeStore<PluginRuntime>({
  pluginId: "signal",
  errorMessage: "Signal runtime not initialized",
});
export { clearSignalRuntime, getOptionalSignalRuntime, getSignalRuntime, setSignalRuntime };
