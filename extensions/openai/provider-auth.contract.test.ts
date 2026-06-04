import { describeOpenAICodexProviderAuthContract } from "merclaw/plugin-sdk/provider-test-contracts";
import { vi } from "vitest";

const loginOpenAICodexOAuthMock = vi.hoisted(() => vi.fn());

vi.mock("./openai-chatgpt-oauth.runtime.js", () => ({
  loginOpenAICodexOAuth: loginOpenAICodexOAuthMock,
}));

describeOpenAICodexProviderAuthContract(() => import("./index.js"), {
  loginOpenAICodexOAuthMock,
});
