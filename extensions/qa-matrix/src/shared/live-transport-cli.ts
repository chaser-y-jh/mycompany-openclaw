import {
  createLiveTransportQaCliRegistration as createSharedLiveTransportQaCliRegistration,
  type LiveTransportQaCliRegistrationOptions,
} from "merclaw/plugin-sdk/qa-runtime";

export {
  createLazyCliRuntimeLoader,
  type LiveTransportQaCliRegistration,
  type LiveTransportQaCommandOptions,
} from "merclaw/plugin-sdk/qa-runtime";

type MatrixLiveTransportQaCliRegistrationOptions = Omit<
  LiveTransportQaCliRegistrationOptions,
  "defaultProviderMode" | "providerModeHelp"
>;

export function createLiveTransportQaCliRegistration(
  params: MatrixLiveTransportQaCliRegistrationOptions,
) {
  return createSharedLiveTransportQaCliRegistration({
    ...params,
    defaultProviderMode: "live-frontier",
    providerModeHelp:
      "Provider mode: mock-openai or live-frontier (legacy live-openai still works)",
  });
}
