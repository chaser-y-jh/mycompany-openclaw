import { describeGithubCopilotProviderAuthContract } from "merclaw/plugin-sdk/provider-test-contracts";

describeGithubCopilotProviderAuthContract(() => import("./index.js"));
