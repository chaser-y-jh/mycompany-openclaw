import { describe, expect, it } from "vitest";
import { parseGitUrl } from "./git.js";

describe("parseGitUrl", () => {
  it("parses ordinary hosted git sources", () => {
    expect(parseGitUrl("git:github.com/merclaw/example-plugin")).toMatchObject({
      type: "git",
      host: "github.com",
      path: "merclaw/example-plugin",
      repo: "https://github.com/merclaw/example-plugin",
    });
  });

  it("parses refs from hosted, scp-style, and generic shorthand sources", () => {
    expect(parseGitUrl("git:https://github.com/merclaw/example-plugin.git@v1.2.3")).toMatchObject({
      host: "github.com",
      path: "merclaw/example-plugin",
      repo: "https://github.com/merclaw/example-plugin.git",
      ref: "v1.2.3",
      pinned: true,
    });
    expect(parseGitUrl("git:git@github.com:merclaw/example-plugin.git@feature/foo")).toMatchObject(
      {
        host: "github.com",
        path: "merclaw/example-plugin",
        repo: "git@github.com:merclaw/example-plugin.git",
        ref: "feature/foo",
        pinned: true,
      },
    );
    expect(parseGitUrl("git:example.com/merclaw/example-plugin@main")).toMatchObject({
      host: "example.com",
      path: "merclaw/example-plugin",
      repo: "https://example.com/merclaw/example-plugin",
      ref: "main",
      pinned: true,
    });
  });

  it("rejects repository paths that could escape managed checkout roots", () => {
    expect(parseGitUrl("git:https://example.com/merclaw/../outside")).toBeNull();
    expect(parseGitUrl("git:git@example.com:merclaw/../outside")).toBeNull();
    expect(parseGitUrl("git:example.com/merclaw/./outside")).toBeNull();
  });
});
