import { describeGoogleProviderRuntimeContract } from "merclaw/plugin-sdk/provider-test-contracts";

describeGoogleProviderRuntimeContract(() => import("./index.js"));
