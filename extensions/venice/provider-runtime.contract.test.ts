import { describeVeniceProviderRuntimeContract } from "merclaw/plugin-sdk/provider-test-contracts";

describeVeniceProviderRuntimeContract(() => import("./index.js"));
