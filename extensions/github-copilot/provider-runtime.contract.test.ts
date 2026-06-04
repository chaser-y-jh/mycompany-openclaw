import { describeGithubCopilotProviderRuntimeContract } from "merclaw/plugin-sdk/provider-test-contracts";

describeGithubCopilotProviderRuntimeContract(() => import("./index.js"));
