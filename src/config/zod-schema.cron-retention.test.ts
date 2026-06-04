import { describe, expect, it } from "vitest";
import { MerClawSchema } from "./zod-schema.js";

describe("MerClawSchema cron retention and run-log validation", () => {
  it("accepts valid cron.sessionRetention and runLog values", () => {
    const result = MerClawSchema.safeParse({
      cron: {
        sessionRetention: "1h30m",
        runLog: {
          maxBytes: "5mb",
          keepLines: 2500,
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid cron.sessionRetention", () => {
    expect(() =>
      MerClawSchema.parse({
        cron: {
          sessionRetention: "abc",
        },
      }),
    ).toThrow(/sessionRetention|duration/i);
  });

  it("rejects invalid cron.runLog.maxBytes", () => {
    expect(() =>
      MerClawSchema.parse({
        cron: {
          runLog: {
            maxBytes: "wat",
          },
        },
      }),
    ).toThrow(/runLog|maxBytes|size/i);
  });
});
