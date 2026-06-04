import { describeOpenRouterProviderRuntimeContract } from "merclaw/plugin-sdk/provider-test-contracts";

describeOpenRouterProviderRuntimeContract(() => import("./index.js"));
