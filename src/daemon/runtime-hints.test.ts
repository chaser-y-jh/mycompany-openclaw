import { describe, expect, it } from "vitest";
import { buildPlatformRuntimeLogHints, buildPlatformServiceStartHints } from "./runtime-hints.js";

describe("buildPlatformRuntimeLogHints", () => {
  it("renders launchd log hints on darwin", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "darwin",
        env: {
          HOME: "/Users/test",
          MERCLAW_STATE_DIR: "/tmp/merclaw-state",
          MERCLAW_LOG_PREFIX: "gateway",
        },
        systemdServiceName: "merclaw-gateway",
        windowsTaskName: "MerClaw Gateway",
      }),
    ).toEqual([
      "Launchd stdout (if installed): /Users/test/Library/Logs/merclaw/gateway.log",
      "Launchd stderr (if installed): suppressed",
      "Restart attempts: /tmp/merclaw-state/logs/gateway-restart.log",
    ]);
  });

  it("renders systemd and windows hints by platform", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "linux",
        env: {
          MERCLAW_STATE_DIR: "/tmp/merclaw-state",
        },
        systemdServiceName: "merclaw-gateway",
        windowsTaskName: "MerClaw Gateway",
      }),
    ).toEqual([
      "Logs: journalctl --user -u merclaw-gateway.service -n 200 --no-pager",
      "Restart attempts: /tmp/merclaw-state/logs/gateway-restart.log",
    ]);
    expect(
      buildPlatformRuntimeLogHints({
        platform: "win32",
        env: {
          MERCLAW_STATE_DIR: "/tmp/merclaw-state",
        },
        systemdServiceName: "merclaw-gateway",
        windowsTaskName: "MerClaw Gateway",
      }),
    ).toEqual([
      'Logs: schtasks /Query /TN "MerClaw Gateway" /V /FO LIST',
      "Restart attempts: /tmp/merclaw-state/logs/gateway-restart.log",
    ]);
  });
});

describe("buildPlatformServiceStartHints", () => {
  it("builds platform-specific service start hints", () => {
    expect(
      buildPlatformServiceStartHints({
        platform: "darwin",
        installCommand: "merclaw gateway install",
        startCommand: "merclaw gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.merclaw.gateway.plist",
        systemdServiceName: "merclaw-gateway",
        windowsTaskName: "MerClaw Gateway",
      }),
    ).toEqual([
      "merclaw gateway install",
      "merclaw gateway",
      "launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.merclaw.gateway.plist",
    ]);
    expect(
      buildPlatformServiceStartHints({
        platform: "linux",
        installCommand: "merclaw gateway install",
        startCommand: "merclaw gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.merclaw.gateway.plist",
        systemdServiceName: "merclaw-gateway",
        windowsTaskName: "MerClaw Gateway",
      }),
    ).toEqual([
      "merclaw gateway install",
      "merclaw gateway",
      "systemctl --user start merclaw-gateway.service",
    ]);
  });
});
