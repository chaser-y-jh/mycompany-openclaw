import { MAX_TIMER_TIMEOUT_MS } from "@merclaw/normalization-core/number-coercion";
import { describe, expect, it } from "vitest";
import type { MerClawConfig } from "../../config/config.js";
import { resolveSandboxConfigForAgent } from "./config.js";

describe("sandbox config", () => {
  it("caps browser autostart timeout to a timer-safe delay", () => {
    const cfg: MerClawConfig = {
      agents: {
        defaults: {
          sandbox: {
            browser: {
              autoStartTimeoutMs: Number.MAX_SAFE_INTEGER,
            },
          },
        },
      },
    };

    expect(resolveSandboxConfigForAgent(cfg, "main").browser.autoStartTimeoutMs).toBe(
      MAX_TIMER_TIMEOUT_MS,
    );
  });
});
