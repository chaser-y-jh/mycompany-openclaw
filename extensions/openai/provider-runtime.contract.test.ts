import { describeOpenAIProviderRuntimeContract } from "merclaw/plugin-sdk/provider-test-contracts";

describeOpenAIProviderRuntimeContract(() => import("./index.js"));
