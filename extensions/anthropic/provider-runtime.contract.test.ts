import { describeAnthropicProviderRuntimeContract } from "merclaw/plugin-sdk/provider-test-contracts";

describeAnthropicProviderRuntimeContract(() => import("./index.js"));
