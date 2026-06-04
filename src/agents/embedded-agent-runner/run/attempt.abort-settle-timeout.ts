import { parseStrictPositiveInteger } from "../../../infra/parse-finite-number.js";

type AbortSettleTimeoutEnv = Partial<
  Pick<NodeJS.ProcessEnv, "MERCLAW_EMBEDDED_ABORT_SETTLE_TIMEOUT_MS" | "MERCLAW_TEST_FAST">
>;

export function resolveEmbeddedAbortSettleTimeoutMs(
  env: AbortSettleTimeoutEnv = process.env,
): number {
  const override = parseStrictPositiveInteger(env.MERCLAW_EMBEDDED_ABORT_SETTLE_TIMEOUT_MS);
  if (override !== undefined) {
    return override;
  }
  return env.MERCLAW_TEST_FAST === "1" ? 250 : 2_000;
}
