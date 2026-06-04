import { describe, expect, it } from "vitest";
import { isMerClawManagedMatrixDevice, summarizeMatrixDeviceHealth } from "./device-health.js";

describe("matrix device health", () => {
  it("detects MerClaw-managed device names", () => {
    expect(isMerClawManagedMatrixDevice("MerClaw Gateway")).toBe(true);
    expect(isMerClawManagedMatrixDevice("MerClaw Debug")).toBe(true);
    expect(isMerClawManagedMatrixDevice("Element iPhone")).toBe(false);
    expect(isMerClawManagedMatrixDevice(null)).toBe(false);
  });

  it("summarizes stale MerClaw-managed devices separately from the current device", () => {
    const summary = summarizeMatrixDeviceHealth([
      {
        deviceId: "du314Zpw3A",
        displayName: "MerClaw Gateway",
        current: true,
      },
      {
        deviceId: "BritdXC6iL",
        displayName: "MerClaw Gateway",
        current: false,
      },
      {
        deviceId: "G6NJU9cTgs",
        displayName: "MerClaw Debug",
        current: false,
      },
      {
        deviceId: "phone123",
        displayName: "Element iPhone",
        current: false,
      },
    ]);

    expect(summary).toEqual({
      currentDeviceId: "du314Zpw3A",
      currentMerClawDevices: [
        {
          deviceId: "du314Zpw3A",
          displayName: "MerClaw Gateway",
          current: true,
        },
      ],
      staleMerClawDevices: [
        {
          deviceId: "BritdXC6iL",
          displayName: "MerClaw Gateway",
          current: false,
        },
        {
          deviceId: "G6NJU9cTgs",
          displayName: "MerClaw Debug",
          current: false,
        },
      ],
    });
  });
});
