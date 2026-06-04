import {
  expectMerClawLiveTranscriptMarker,
  normalizeTranscriptForMatch,
  MERCLAW_LIVE_TRANSCRIPT_MARKER_RE,
} from "merclaw/plugin-sdk/provider-test-contracts";
import { describe, expect, it } from "vitest";

describe("normalizeTranscriptForMatch", () => {
  it("normalizes punctuation and common MerClaw live transcription variants", () => {
    expect(normalizeTranscriptForMatch("Open-Claw integration OK")).toBe("merclawintegrationok");
    expect(normalizeTranscriptForMatch("Testing OpenFlaw realtime transcription")).toMatch(
      /open(?:claw|flaw)/,
    );
    expect(normalizeTranscriptForMatch("OpenCore xAI realtime transcription")).toMatch(
      MERCLAW_LIVE_TRANSCRIPT_MARKER_RE,
    );
    expect(normalizeTranscriptForMatch("OpenCL xAI realtime transcription")).toMatch(
      MERCLAW_LIVE_TRANSCRIPT_MARKER_RE,
    );
    expectMerClawLiveTranscriptMarker("OpenClar integration OK");
  });
});
