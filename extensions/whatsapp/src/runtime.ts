import type { PluginRuntime } from "merclaw/plugin-sdk/core";
import { createPluginRuntimeStore } from "merclaw/plugin-sdk/runtime-store";

const {
  setRuntime: setWhatsAppRuntime,
  getRuntime: getWhatsAppRuntime,
  tryGetRuntime: getOptionalWhatsAppRuntime,
} = createPluginRuntimeStore<PluginRuntime>({
  pluginId: "whatsapp",
  errorMessage: "WhatsApp runtime not initialized",
});
export { getOptionalWhatsAppRuntime, getWhatsAppRuntime, setWhatsAppRuntime };
