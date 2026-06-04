import { describe, expect, it } from "vitest";
import { formatCliFailureLines } from "./failure-output.js";

describe("formatCliFailureLines", () => {
  it("shows a concise reason and recovery commands by default", () => {
    const lines = formatCliFailureLines({
      title: "Could not start the CLI.",
      error: new Error("config file is invalid"),
      argv: ["node", "merclaw", "status"],
      env: {},
    });

    expect(lines).toEqual([
      "[merclaw] Could not start the CLI.",
      "[merclaw] Reason: config file is invalid",
      "[merclaw] Debug: set MERCLAW_DEBUG=1 to include the stack trace.",
      "[merclaw] Try: merclaw doctor",
      "[merclaw] Help: merclaw --help",
    ]);
  });

  it("prints stack details when debug output is requested", () => {
    const lines = formatCliFailureLines({
      title: "The CLI command failed.",
      error: new Error("boom"),
      env: { MERCLAW_DEBUG: "1" },
    });

    expect(lines.slice(0, 4)).toEqual([
      "[merclaw] The CLI command failed.",
      "[merclaw] Reason: boom",
      "[merclaw] Stack:",
      "[merclaw] Error: boom",
    ]);
    expect(lines.join("\n")).toContain("Error: boom");
  });
});
