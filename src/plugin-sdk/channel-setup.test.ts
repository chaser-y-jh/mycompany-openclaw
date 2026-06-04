import { runSetupWizardFinalize } from "merclaw/plugin-sdk/plugin-test-runtime";
import { describe, expect, it } from "vitest";
import { createOptionalChannelSetupSurface } from "./channel-setup.js";

describe("createOptionalChannelSetupSurface", () => {
  it("returns a matched adapter and wizard for optional plugins", async () => {
    const setup = createOptionalChannelSetupSurface({
      channel: "example",
      label: "Example",
      npmSpec: "@merclaw/example",
      docsPath: "/channels/example",
    });

    expect(setup.setupAdapter.resolveAccountId?.({ cfg: {} })).toBe("default");
    expect(
      setup.setupAdapter.validateInput?.({
        cfg: {},
        accountId: "default",
        input: {},
      }),
    ).toBe(
      "Example setup requires @merclaw/example to be installed. Docs: https://docs.merclaw.ai/channels/example",
    );
    expect(setup.setupWizard.channel).toBe("example");
    expect(setup.setupWizard.status.unconfiguredHint).toBe(
      "Example setup requires @merclaw/example to be installed. Docs: https://docs.merclaw.ai/channels/example",
    );
    await expect(
      runSetupWizardFinalize({
        finalize: setup.setupWizard.finalize,
        runtime: {
          log: () => {},
          error: () => {},
          exit: async () => {},
        },
      }),
    ).rejects.toThrow("@merclaw/example");
  });
});
