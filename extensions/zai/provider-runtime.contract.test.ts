import { describeZAIProviderRuntimeContract } from "merclaw/plugin-sdk/provider-test-contracts";

describeZAIProviderRuntimeContract(() => import("./index.js"));
