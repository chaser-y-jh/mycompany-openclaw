import { describe, expect, it } from "vitest";
import { MerClawSchema } from "./zod-schema.js";

describe("MerClawSchema talk validation", () => {
  it("accepts a positive integer talk.silenceTimeoutMs", () => {
    const result = MerClawSchema.safeParse({
      talk: {
        consultThinkingLevel: "low",
        consultFastMode: true,
        silenceTimeoutMs: 1500,
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid talk.consultThinkingLevel", () => {
    expect(() =>
      MerClawSchema.parse({
        talk: {
          consultThinkingLevel: "turbo",
        },
      }),
    ).toThrow(/consultThinkingLevel/i);
  });

  it("accepts additional realtime Talk instructions", () => {
    expect(() =>
      MerClawSchema.parse({
        talk: {
          realtime: {
            provider: "openai",
            providers: {
              openai: {
                model: "gpt-realtime",
                speakerVoice: "alloy",
                speakerVoiceId: "voice-123",
              },
            },
            instructions: "Speak with crisp diction.",
            consultRouting: "force-agent-consult",
          },
        },
      }),
    ).not.toThrow();
  });

  it("rejects invalid realtime Talk consult routing", () => {
    expect(() =>
      MerClawSchema.parse({
        talk: {
          realtime: {
            consultRouting: "always",
          },
        },
      }),
    ).toThrow(/consultRouting/i);
  });

  it.each([
    ["boolean", true],
    ["string", "1500"],
    ["float", 1500.5],
  ])("rejects %s talk.silenceTimeoutMs", (_label, value) => {
    expect(() =>
      MerClawSchema.parse({
        talk: {
          silenceTimeoutMs: value,
        },
      }),
    ).toThrow(/silenceTimeoutMs|number|integer/i);
  });

  it("rejects talk.provider when it does not match talk.providers", () => {
    expect(() =>
      MerClawSchema.parse({
        talk: {
          provider: "acme",
          providers: {
            elevenlabs: {
              voiceId: "voice-123",
            },
          },
        },
      }),
    ).toThrow(/talk\.provider|talk\.providers|missing "acme"/i);
  });

  it("rejects multi-provider talk config without talk.provider", () => {
    expect(() =>
      MerClawSchema.parse({
        talk: {
          providers: {
            acme: {
              voiceId: "voice-acme",
            },
            elevenlabs: {
              voiceId: "voice-eleven",
            },
          },
        },
      }),
    ).toThrow(/talk\.provider|required/i);
  });
});
