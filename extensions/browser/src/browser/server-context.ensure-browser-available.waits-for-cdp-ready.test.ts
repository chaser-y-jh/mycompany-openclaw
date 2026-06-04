import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import "./server-context.chrome-test-harness.js";
import {
  PROFILE_ATTACH_RETRY_TIMEOUT_MS,
  PROFILE_HTTP_REACHABILITY_TIMEOUT_MS,
} from "./cdp-timeouts.js";
import * as chromeModule from "./chrome.js";
import { BrowserProfileUnavailableError } from "./errors.js";
import { createBrowserRouteContext } from "./server-context.js";
import { makeBrowserServerState, mockLaunchedChrome } from "./server-context.test-harness.js";

function setupEnsureBrowserAvailableHarness() {
  vi.useFakeTimers();

  const launchMerClawChrome = vi.mocked(chromeModule.launchMerClawChrome);
  const stopMerClawChrome = vi.mocked(chromeModule.stopMerClawChrome);
  const isChromeReachable = vi.mocked(chromeModule.isChromeReachable);
  const isChromeCdpReady = vi.mocked(chromeModule.isChromeCdpReady);
  isChromeReachable.mockResolvedValue(false);

  const state = makeBrowserServerState();
  const ctx = createBrowserRouteContext({ getState: () => state });
  const profile = ctx.forProfile("merclaw");

  return { launchMerClawChrome, stopMerClawChrome, isChromeCdpReady, profile, state };
}

function createAttachOnlyLoopbackProfile(cdpUrl: string) {
  const state = makeBrowserServerState({
    profile: {
      name: "manual-cdp",
      cdpUrl,
      cdpHost: "127.0.0.1",
      cdpIsLoopback: true,
      cdpPort: 9222,
      color: "#00AA00",
      driver: "merclaw",
      headless: false,
      attachOnly: true,
    },
    resolvedOverrides: {
      defaultProfile: "manual-cdp",
      ssrfPolicy: {},
    },
  });
  const ctx = createBrowserRouteContext({ getState: () => state });
  return { profile: ctx.forProfile("manual-cdp"), state };
}

function requireFirstLaunchOptions(launchMerClawChrome: {
  mock: { calls: unknown[][] };
}): unknown {
  const [call] = launchMerClawChrome.mock.calls;
  if (!call) {
    throw new Error("expected Chrome launch call");
  }
  return call[2];
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("browser server-context ensureBrowserAvailable", () => {
  it("waits for CDP readiness after launching to avoid follow-up PortInUseError races (#21149)", async () => {
    const { launchMerClawChrome, stopMerClawChrome, isChromeCdpReady, profile } =
      setupEnsureBrowserAvailableHarness();
    isChromeCdpReady.mockResolvedValueOnce(false).mockResolvedValue(true);
    mockLaunchedChrome(launchMerClawChrome, 123);

    const promise = profile.ensureBrowserAvailable();
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toBeUndefined();

    expect(launchMerClawChrome).toHaveBeenCalledTimes(1);
    expect(isChromeCdpReady).toHaveBeenCalled();
    expect(stopMerClawChrome).not.toHaveBeenCalled();
  });

  it("stops launched chrome when CDP readiness never arrives", async () => {
    const { launchMerClawChrome, stopMerClawChrome, isChromeCdpReady, profile } =
      setupEnsureBrowserAvailableHarness();
    isChromeCdpReady.mockResolvedValue(false);
    mockLaunchedChrome(launchMerClawChrome, 321);

    const promise = profile.ensureBrowserAvailable();
    const rejected = expect(promise).rejects.toThrow("not reachable after start");
    const diagnosticRejected = expect(promise).rejects.toThrow(
      "CDP diagnostic: websocket_health_command_timeout; mock CDP diagnostic.",
    );
    await vi.advanceTimersByTimeAsync(8100);
    await rejected;
    await diagnosticRejected;

    expect(launchMerClawChrome).toHaveBeenCalledTimes(1);
    expect(stopMerClawChrome).toHaveBeenCalledTimes(1);
  });

  it("uses configured local CDP readiness timeout after launching", async () => {
    const { launchMerClawChrome, stopMerClawChrome, isChromeCdpReady, profile, state } =
      setupEnsureBrowserAvailableHarness();
    state.resolved.localCdpReadyTimeoutMs = 250;
    isChromeCdpReady.mockResolvedValue(false);
    mockLaunchedChrome(launchMerClawChrome, 322);

    const promise = profile.ensureBrowserAvailable();
    const rejected = expect(promise).rejects.toThrow("not reachable after start");
    await vi.advanceTimersByTimeAsync(300);
    await rejected;

    expect(launchMerClawChrome).toHaveBeenCalledTimes(1);
    expect(stopMerClawChrome).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent lazy-start calls to prevent PortInUseError", async () => {
    const { launchMerClawChrome, stopMerClawChrome, isChromeCdpReady, profile } =
      setupEnsureBrowserAvailableHarness();
    isChromeCdpReady.mockResolvedValue(true);
    mockLaunchedChrome(launchMerClawChrome, 456);

    const first = profile.ensureBrowserAvailable();
    const second = profile.ensureBrowserAvailable();
    await vi.advanceTimersByTimeAsync(100);
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);

    expect(launchMerClawChrome).toHaveBeenCalledTimes(1);
    expect(stopMerClawChrome).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent lazy-start calls across fresh profile contexts", async () => {
    const { launchMerClawChrome, stopMerClawChrome, isChromeCdpReady, state } =
      setupEnsureBrowserAvailableHarness();
    isChromeCdpReady.mockResolvedValue(true);
    mockLaunchedChrome(launchMerClawChrome, 457);

    const firstCtx = createBrowserRouteContext({ getState: () => state });
    const secondCtx = createBrowserRouteContext({ getState: () => state });
    const first = firstCtx.forProfile("merclaw").ensureBrowserAvailable();
    const second = secondCtx.forProfile("merclaw").ensureBrowserAvailable();
    await vi.advanceTimersByTimeAsync(100);
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);

    expect(launchMerClawChrome).toHaveBeenCalledTimes(1);
    expect(stopMerClawChrome).not.toHaveBeenCalled();
  });

  it("passes request-local headless override to initial launch", async () => {
    const { launchMerClawChrome, stopMerClawChrome, isChromeCdpReady, profile } =
      setupEnsureBrowserAvailableHarness();
    isChromeCdpReady.mockResolvedValue(true);
    mockLaunchedChrome(launchMerClawChrome, 654);

    const promise = profile.ensureBrowserAvailable({ headless: true });
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toBeUndefined();

    expect(launchMerClawChrome).toHaveBeenCalledTimes(1);
    expect(requireFirstLaunchOptions(launchMerClawChrome)).toEqual({ headlessOverride: true });
    expect(stopMerClawChrome).not.toHaveBeenCalled();
  });

  it("passes request-local headless override to the owned restart path", async () => {
    const { launchMerClawChrome, stopMerClawChrome, isChromeCdpReady, profile, state } =
      setupEnsureBrowserAvailableHarness();
    const isChromeReachable = vi.mocked(chromeModule.isChromeReachable);
    const existingProc = new EventEmitter() as unknown as ChildProcessWithoutNullStreams;
    state.profiles.set("merclaw", {
      profile: profile.profile,
      running: {
        pid: 111,
        exe: { kind: "chromium", path: "/usr/bin/chromium" },
        userDataDir: "/tmp/merclaw-test",
        cdpPort: 18800,
        startedAt: Date.now(),
        proc: existingProc,
      },
      lastTargetId: null,
      reconcile: null,
    });
    isChromeReachable.mockResolvedValue(true);
    isChromeCdpReady.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    mockLaunchedChrome(launchMerClawChrome, 987);

    await expect(profile.ensureBrowserAvailable({ headless: true })).resolves.toBeUndefined();

    expect(stopMerClawChrome).toHaveBeenCalledTimes(1);
    expect(launchMerClawChrome).toHaveBeenCalledTimes(1);
    expect(requireFirstLaunchOptions(launchMerClawChrome)).toEqual({ headlessOverride: true });
  });

  it("does not share inflight lazy-start promises across different headless overrides", async () => {
    const { launchMerClawChrome, isChromeCdpReady, profile } =
      setupEnsureBrowserAvailableHarness();
    const isChromeReachable = vi.mocked(chromeModule.isChromeReachable);
    isChromeReachable.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    isChromeCdpReady.mockResolvedValue(true);
    mockLaunchedChrome(launchMerClawChrome, 456);

    const first = profile.ensureBrowserAvailable();
    const second = profile.ensureBrowserAvailable({ headless: true });
    await vi.advanceTimersByTimeAsync(100);
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);

    expect(launchMerClawChrome).toHaveBeenCalledTimes(1);
    expect(isChromeReachable.mock.calls.length).toBeGreaterThan(1);
  });

  it("clears the concurrent lazy-start guard after launch failure", async () => {
    const { launchMerClawChrome, stopMerClawChrome, isChromeCdpReady, profile } =
      setupEnsureBrowserAvailableHarness();
    isChromeCdpReady.mockResolvedValue(true);
    launchMerClawChrome.mockRejectedValueOnce(
      new Error("PortInUseError: listen EADDRINUSE 127.0.0.1:18800"),
    );

    const first = profile.ensureBrowserAvailable();
    const second = profile.ensureBrowserAvailable();
    await expect(Promise.all([first, second])).rejects.toThrow("PortInUseError");

    mockLaunchedChrome(launchMerClawChrome, 789);
    const retry = profile.ensureBrowserAvailable();
    await vi.advanceTimersByTimeAsync(100);
    await expect(retry).resolves.toBeUndefined();

    expect(launchMerClawChrome).toHaveBeenCalledTimes(2);
    expect(stopMerClawChrome).not.toHaveBeenCalled();
  });

  it("cools down repeated managed Chrome launch failures across route contexts", async () => {
    const { launchMerClawChrome, stopMerClawChrome, isChromeCdpReady, state } =
      setupEnsureBrowserAvailableHarness();
    isChromeCdpReady.mockResolvedValue(true);
    launchMerClawChrome.mockRejectedValue(new Error("Failed to start Chrome CDP"));

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const ctx = createBrowserRouteContext({ getState: () => state });
      await expect(ctx.forProfile("merclaw").ensureBrowserAvailable()).rejects.toThrow(
        "Failed to start Chrome CDP",
      );
    }

    const cooledDownCtx = createBrowserRouteContext({ getState: () => state });
    await expect(cooledDownCtx.forProfile("merclaw").ensureBrowserAvailable()).rejects.toThrow(
      'Browser launch for profile "merclaw" is cooling down after 3 consecutive managed Chrome launch failures.',
    );
    await expect(cooledDownCtx.forProfile("merclaw").ensureBrowserAvailable()).rejects.toThrow(
      "set browser.enabled=false if the browser tool is not needed",
    );

    expect(launchMerClawChrome).toHaveBeenCalledTimes(3);
    expect(stopMerClawChrome).not.toHaveBeenCalled();
  });

  it("allows one managed Chrome launch attempt after the cooldown expires", async () => {
    const { launchMerClawChrome, isChromeCdpReady, state } = setupEnsureBrowserAvailableHarness();
    isChromeCdpReady.mockResolvedValue(true);
    launchMerClawChrome.mockRejectedValue(new Error("Failed to start Chrome CDP"));

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const ctx = createBrowserRouteContext({ getState: () => state });
      await expect(ctx.forProfile("merclaw").ensureBrowserAvailable()).rejects.toThrow(
        "Failed to start Chrome CDP",
      );
    }

    await vi.advanceTimersByTimeAsync(30_000);
    const retryCtx = createBrowserRouteContext({ getState: () => state });
    await expect(retryCtx.forProfile("merclaw").ensureBrowserAvailable()).rejects.toThrow(
      "Failed to start Chrome CDP",
    );

    expect(launchMerClawChrome).toHaveBeenCalledTimes(4);
  });

  it("reuses a pre-existing loopback browser after an initial short probe miss", async () => {
    const { launchMerClawChrome, stopMerClawChrome, isChromeCdpReady, profile, state } =
      setupEnsureBrowserAvailableHarness();
    const isChromeReachable = vi.mocked(chromeModule.isChromeReachable);
    state.resolved.ssrfPolicy = {};

    isChromeReachable.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    isChromeCdpReady.mockResolvedValueOnce(true);

    await expect(profile.ensureBrowserAvailable()).resolves.toBeUndefined();

    expect(isChromeReachable).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:18800",
      PROFILE_HTTP_REACHABILITY_TIMEOUT_MS,
      undefined,
    );
    expect(isChromeReachable).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:18800",
      PROFILE_ATTACH_RETRY_TIMEOUT_MS,
      undefined,
    );
    expect(launchMerClawChrome).not.toHaveBeenCalled();
    expect(stopMerClawChrome).not.toHaveBeenCalled();
  });

  it("explains attachOnly for externally managed loopback CDP services", async () => {
    const { launchMerClawChrome, stopMerClawChrome, isChromeCdpReady, profile } =
      setupEnsureBrowserAvailableHarness();
    const isChromeReachable = vi.mocked(chromeModule.isChromeReachable);

    isChromeReachable.mockResolvedValue(true);
    isChromeCdpReady.mockResolvedValue(false);

    const promise = profile.ensureBrowserAvailable();
    await expect(promise).rejects.toThrow(
      'Port 18800 is in use for profile "merclaw" but not by merclaw.',
    );
    await expect(promise).rejects.toThrow(
      "set browser.profiles.merclaw.attachOnly=true so MerClaw attaches without trying to manage the local process",
    );
    await expect(promise).rejects.toThrow(
      "For Browserless Docker, set EXTERNAL to the same WebSocket endpoint MerClaw can reach via browser.profiles.<name>.cdpUrl.",
    );

    expect(launchMerClawChrome).not.toHaveBeenCalled();
    expect(stopMerClawChrome).not.toHaveBeenCalled();
  });

  it("retries remote CDP websocket reachability once before failing", async () => {
    const { launchMerClawChrome, stopMerClawChrome, isChromeCdpReady } =
      setupEnsureBrowserAvailableHarness();
    const isChromeReachable = vi.mocked(chromeModule.isChromeReachable);

    const state = makeBrowserServerState();
    state.resolved.profiles.merclaw = {
      cdpUrl: "ws://browserless:3001",
      color: "#00AA00",
    };
    const ctx = createBrowserRouteContext({ getState: () => state });
    const profile = ctx.forProfile("merclaw");
    const expectedRemoteHttpTimeoutMs = state.resolved.remoteCdpTimeoutMs;
    const expectedRemoteWsTimeoutMs = state.resolved.remoteCdpHandshakeTimeoutMs;

    isChromeReachable.mockResolvedValueOnce(true);
    isChromeCdpReady.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(profile.ensureBrowserAvailable()).resolves.toBeUndefined();

    expect(isChromeReachable).toHaveBeenCalledTimes(1);
    expect(isChromeCdpReady).toHaveBeenCalledTimes(2);
    expect(isChromeCdpReady).toHaveBeenNthCalledWith(
      1,
      "ws://browserless:3001",
      expectedRemoteHttpTimeoutMs,
      expectedRemoteWsTimeoutMs,
      {
        allowPrivateNetwork: true,
      },
    );
    expect(isChromeCdpReady).toHaveBeenNthCalledWith(
      2,
      "ws://browserless:3001",
      expectedRemoteHttpTimeoutMs,
      expectedRemoteWsTimeoutMs,
      {
        allowPrivateNetwork: true,
      },
    );
    expect(launchMerClawChrome).not.toHaveBeenCalled();
    expect(stopMerClawChrome).not.toHaveBeenCalled();
  });

  it("treats attachOnly loopback CDP as local control with remote-class probe timeouts", async () => {
    const { launchMerClawChrome, stopMerClawChrome } = setupEnsureBrowserAvailableHarness();
    const isChromeReachable = vi.mocked(chromeModule.isChromeReachable);
    const isChromeCdpReady = vi.mocked(chromeModule.isChromeCdpReady);

    const { profile, state } = createAttachOnlyLoopbackProfile("http://127.0.0.1:9222");

    isChromeReachable.mockResolvedValueOnce(true);
    isChromeCdpReady.mockResolvedValueOnce(true);

    await expect(profile.ensureBrowserAvailable()).resolves.toBeUndefined();

    expect(isChromeReachable).toHaveBeenCalledWith(
      "http://127.0.0.1:9222",
      state.resolved.remoteCdpTimeoutMs,
      undefined,
    );
    expect(isChromeCdpReady).toHaveBeenCalledWith(
      "http://127.0.0.1:9222",
      state.resolved.remoteCdpTimeoutMs,
      state.resolved.remoteCdpHandshakeTimeoutMs,
      undefined,
    );
    expect(launchMerClawChrome).not.toHaveBeenCalled();
    expect(stopMerClawChrome).not.toHaveBeenCalled();
  });

  it("resolves for attachOnly loopback profile with a bare ws:// cdpUrl when CDP is reachable (#68027)", async () => {
    // Regression for #68027: a bare `ws://host:port` cdpUrl on a loopback
    // attachOnly profile must not surface as
    //   `Browser attachOnly is enabled and profile "<name>" is not running.`
    // when the underlying CDP endpoint is actually healthy. The low-level
    // fix lives in chrome.ts/cdp.ts (see chrome.test.ts #68027 tests); this
    // higher-level test locks the user-facing symptom at
    // ensureBrowserAvailable() so future refactors of the availability flow
    // cannot silently reintroduce the bug by munging/short-circuiting bare
    // ws:// URLs before they reach the helpers.
    const { launchMerClawChrome, stopMerClawChrome } = setupEnsureBrowserAvailableHarness();
    const isChromeReachable = vi.mocked(chromeModule.isChromeReachable);
    const isChromeCdpReady = vi.mocked(chromeModule.isChromeCdpReady);

    const { profile, state } = createAttachOnlyLoopbackProfile("ws://127.0.0.1:9222");

    isChromeReachable.mockResolvedValueOnce(true);
    isChromeCdpReady.mockResolvedValueOnce(true);

    await expect(profile.ensureBrowserAvailable()).resolves.toBeUndefined();

    // The bare ws:// URL must pass through unchanged — the helpers own the
    // discovery-first-then-fallback strategy for bare ws roots.
    expect(isChromeReachable).toHaveBeenCalledWith(
      "ws://127.0.0.1:9222",
      state.resolved.remoteCdpTimeoutMs,
      undefined,
    );
    expect(isChromeCdpReady).toHaveBeenCalledWith(
      "ws://127.0.0.1:9222",
      state.resolved.remoteCdpTimeoutMs,
      state.resolved.remoteCdpHandshakeTimeoutMs,
      undefined,
    );
    expect(launchMerClawChrome).not.toHaveBeenCalled();
    expect(stopMerClawChrome).not.toHaveBeenCalled();
  });

  it("redacts credentials in remote CDP availability errors", async () => {
    const { launchMerClawChrome, stopMerClawChrome } = setupEnsureBrowserAvailableHarness();
    const isChromeReachable = vi.mocked(chromeModule.isChromeReachable);

    const state = makeBrowserServerState({
      profile: {
        name: "remote",
        cdpUrl: "https://user:pass@browserless.example.com?token=supersecret123",
        cdpHost: "browserless.example.com",
        cdpIsLoopback: false,
        cdpPort: 443,
        color: "#00AA00",
        driver: "merclaw",
        headless: false,
        attachOnly: false,
      },
      resolvedOverrides: {
        defaultProfile: "remote",
        ssrfPolicy: {},
      },
    });
    const ctx = createBrowserRouteContext({ getState: () => state });
    const profile = ctx.forProfile("remote");

    isChromeReachable.mockResolvedValue(false);

    const promise = profile.ensureBrowserAvailable();
    await expect(promise).rejects.toThrow(BrowserProfileUnavailableError);
    await expect(promise).rejects.toThrow(
      'Remote CDP for profile "remote" is not reachable at https://browserless.example.com/?token=***.',
    );

    expect(launchMerClawChrome).not.toHaveBeenCalled();
    expect(stopMerClawChrome).not.toHaveBeenCalled();
  });
});
