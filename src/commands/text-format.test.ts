import { describe, expect, it } from "vitest";
import { shortenText } from "./text-format.js";

describe("shortenText", () => {
  it("returns original text when it fits", () => {
    expect(shortenText("merclaw", 16)).toBe("merclaw");
  });

  it("truncates and appends ellipsis when over limit", () => {
    expect(shortenText("merclaw-status-output", 10)).toBe("merclaw-…");
  });

  it("counts multi-byte characters correctly", () => {
    expect(shortenText("hello🙂world", 7)).toBe("hello🙂…");
  });
});
