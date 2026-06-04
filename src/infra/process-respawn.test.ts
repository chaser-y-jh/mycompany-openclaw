import { afterEach, describe, expect, it, vi } from "vitest";
import { captureFullEnv } from "../test-utils/env.js";
import { mockProcessPlatform } from "../test-utils/vitest-spies.js";
import { SUPERVISOR_HINT_ENV_VARS } from "./supervisor-markers.js";

const spawnMock = vi.hoisted(() => vi.fn());
const triggerMerClawRestartMock = vi.hoisted(() => vi.fn());
const isContainerEnvironmentMock = vi.hoisted(() => vi.fn(() => false));

vi.mock("node:child_process", async () => {
  const { mockNodeBuiltinModule } = await import("merclaw/plugin-sdk/test-node-mocks");
  return mockNodeBuiltinModule(
    () => vi.importActual<typeof import("node:child_process")>("node:child_process"),
    {
      spawn: (...args: unknown[]) => spawnMock(...args),
    },
  );
});
vi.mock("./restart.js", () => ({
  triggerMerClawRestart: (...args: unknown[]) => triggerMerClawRestartMock(...args),
}));
vi.mock("./container-environment.js", () => ({
  isContainerEnvironment: () => isContainerEnvironmentMock(),
}));

import {
  respawnGatewayProcessForUpdate,
  restartGatewayProcessWithFreshPid,
} from "./process-respawn.js";

const originalArgv = [...process.argv];
const originalExecArgv = [...process.execArgv];
const envSnapshot = captureFullEnv();

function setPlatform(platform: NodeJS.Platform) {
  mockProcessPlatform(platform);
}

afterEach(() => {
  envSnapshot.restore();
  process.argv = [...originalArgv];
  process.execArgv = [...originalExecArgv];
  spawnMock.mockClear();
  triggerMerClawRestartMock.mockClear();
  isContainerEnvironmentMock.mockReset();
  isContainerEnvironmentMock.mockReturnValue(false);
  vi.restoreAllMocks();
});

function clearSupervisorHints() {
  for (const key of SUPERVISOR_HINT_ENV_VARS) {
    delete process.env[key];
  }
}

function expectLaunchdSupervisedWithoutKickstart(params?: { launchJobLabel?: string }) {
  setPlatform("darwin");
  if (params?.launchJobLabel) {
    process.env.LAUNCH_JOB_LABEL = params.launchJobLabel;
  }
  process.env.MERCLAW_LAUNCHD_LABEL = "ai.merclaw.gateway";
  const result = restartGatewayProcessWithFreshPid();
  expect(result).toEqual({ mode: "supervised" });
  expect(triggerMerClawRestartMock).not.toHaveBeenCalled();
  expect(spawnMock).not.toHaveBeenCalled();
}

describe("restartGatewayProcessWithFreshPid", () => {
  it("returns disabled when MERCLAW_NO_RESPAWN is set", () => {
    process.env.MERCLAW_NO_RESPAWN = "1";
    const result = restartGatewayProcessWithFreshPid();
    expect(result.mode).toBe("disabled");
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("keeps MERCLAW_NO_RESPAWN ahead of inherited supervisor hints", () => {
    clearSupervisorHints();
    setPlatform("darwin");
    process.env.MERCLAW_NO_RESPAWN = "1";
    process.env.LAUNCH_JOB_LABEL = "ai.merclaw.gateway";

    const result = restartGatewayProcessWithFreshPid();

    expect(result).toEqual({ mode: "disabled" });
    expect(triggerMerClawRestartMock).not.toHaveBeenCalled();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("returns supervised when MerClaw launchd markers are present on macOS (no kickstart)", () => {
    clearSupervisorHints();
    expectLaunchdSupervisedWithoutKickstart({ launchJobLabel: "ai.merclaw.gateway" });
  });

  it("returns supervised for a real gateway launchd job without the injected marker", () => {
    clearSupervisorHints();
    setPlatform("darwin");
    process.env.LAUNCH_JOB_LABEL = "ai.merclaw.gateway";

    const result = restartGatewayProcessWithFreshPid();

    expect(result.mode).toBe("supervised");
    expect(triggerMerClawRestartMock).not.toHaveBeenCalled();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("returns supervised for a real gateway XPC launchd job without the injected marker", () => {
    clearSupervisorHints();
    setPlatform("darwin");
    process.env.XPC_SERVICE_NAME = "ai.merclaw.gateway";

    const result = restartGatewayProcessWithFreshPid();

    expect(result.mode).toBe("supervised");
    expect(triggerMerClawRestartMock).not.toHaveBeenCalled();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("returns supervised on macOS when launchd label is set (no kickstart)", () => {
    expectLaunchdSupervisedWithoutKickstart({ launchJobLabel: "ai.merclaw.gateway" });
  });

  it("launchd supervisor never returns failed regardless of triggerMerClawRestart outcome", () => {
    clearSupervisorHints();
    setPlatform("darwin");
    process.env.MERCLAW_LAUNCHD_LABEL = "ai.merclaw.gateway";
    // Even if triggerMerClawRestart *would* fail, launchd path must not call it.
    triggerMerClawRestartMock.mockReturnValue({
      ok: false,
      method: "launchctl",
      detail: "Bootstrap failed: 5: Input/output error",
    });
    const result = restartGatewayProcessWithFreshPid();
    expect(result.mode).toBe("supervised");
    expect(result.mode).not.toBe("failed");
    expect(triggerMerClawRestartMock).not.toHaveBeenCalled();
  });

  it("does not schedule kickstart on non-darwin platforms", () => {
    setPlatform("linux");
    process.env.INVOCATION_ID = "abc123";
    process.env.MERCLAW_LAUNCHD_LABEL = "ai.merclaw.gateway";

    const result = restartGatewayProcessWithFreshPid();

    expect(result.mode).toBe("supervised");
    expect(triggerMerClawRestartMock).not.toHaveBeenCalled();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("does not treat inherited XPC_SERVICE_NAME as launchd supervision", () => {
    clearSupervisorHints();
    setPlatform("darwin");
    process.env.XPC_SERVICE_NAME = "ai.merclaw.mac";
    process.env.MERCLAW_PROFILE = "mac";

    const result = restartGatewayProcessWithFreshPid();

    expect(result).toEqual({
      mode: "disabled",
      detail: "unmanaged: use in-process restart to keep custom supervisor PID tracking stable",
    });
    expect(triggerMerClawRestartMock).not.toHaveBeenCalled();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("uses in-process restart on unmanaged Unix so custom supervisors keep the tracked PID", () => {
    delete process.env.MERCLAW_NO_RESPAWN;
    clearSupervisorHints();
    setPlatform("linux");
    process.execArgv = ["--import", "tsx"];
    process.argv = ["/usr/local/bin/node", "/repo/dist/index.js", "gateway", "run"];
    spawnMock.mockReturnValue({ pid: 4242, unref: vi.fn() });

    const result = restartGatewayProcessWithFreshPid();

    expect(result).toEqual({
      mode: "disabled",
      detail: "unmanaged: use in-process restart to keep custom supervisor PID tracking stable",
    });
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("returns supervised when MERCLAW_LAUNCHD_LABEL is set (stock launchd plist)", () => {
    clearSupervisorHints();
    expectLaunchdSupervisedWithoutKickstart();
  });

  it("returns supervised when MERCLAW_SYSTEMD_UNIT is set", () => {
    clearSupervisorHints();
    setPlatform("linux");
    process.env.MERCLAW_SYSTEMD_UNIT = "merclaw-gateway.service";
    const result = restartGatewayProcessWithFreshPid();
    expect(result.mode).toBe("supervised");
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("returns supervised when MerClaw gateway task markers are set on Windows", () => {
    clearSupervisorHints();
    setPlatform("win32");
    process.env.MERCLAW_SERVICE_MARKER = "merclaw";
    process.env.MERCLAW_SERVICE_KIND = "gateway";
    triggerMerClawRestartMock.mockReturnValue({ ok: true, method: "schtasks" });
    const result = restartGatewayProcessWithFreshPid();
    expect(result.mode).toBe("supervised");
    expect(triggerMerClawRestartMock).toHaveBeenCalledOnce();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("keeps generic service markers out of non-Windows supervisor detection", () => {
    clearSupervisorHints();
    setPlatform("linux");
    process.env.MERCLAW_SERVICE_MARKER = "merclaw";
    process.env.MERCLAW_SERVICE_KIND = "gateway";

    const result = restartGatewayProcessWithFreshPid();

    expect(result).toEqual({
      mode: "disabled",
      detail: "unmanaged: use in-process restart to keep custom supervisor PID tracking stable",
    });
    expect(triggerMerClawRestartMock).not.toHaveBeenCalled();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("returns disabled on Windows without Scheduled Task markers", () => {
    clearSupervisorHints();
    setPlatform("win32");

    const result = restartGatewayProcessWithFreshPid();

    expect(result.mode).toBe("disabled");
    expect(result.detail).toContain("Scheduled Task");
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("returns disabled in containers so PID 1 stays alive for in-process restart", () => {
    delete process.env.MERCLAW_NO_RESPAWN;
    clearSupervisorHints();
    setPlatform("linux");
    isContainerEnvironmentMock.mockReturnValue(true);

    const result = restartGatewayProcessWithFreshPid();

    expect(result).toEqual({
      mode: "disabled",
      detail: "container: use in-process restart to keep PID 1 alive",
    });
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("ignores node task script hints for gateway restart detection on Windows", () => {
    clearSupervisorHints();
    setPlatform("win32");
    process.env.MERCLAW_TASK_SCRIPT = "C:\\merclaw\\node.cmd";
    process.env.MERCLAW_TASK_SCRIPT_NAME = "node.cmd";
    process.env.MERCLAW_SERVICE_MARKER = "merclaw";
    process.env.MERCLAW_SERVICE_KIND = "node";

    const result = restartGatewayProcessWithFreshPid();

    expect(result.mode).toBe("disabled");
    expect(triggerMerClawRestartMock).not.toHaveBeenCalled();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("does not attempt detached spawn on unmanaged Unix even if spawn would throw", () => {
    delete process.env.MERCLAW_NO_RESPAWN;
    clearSupervisorHints();
    setPlatform("linux");

    spawnMock.mockImplementation(() => {
      throw new Error("spawn failed");
    });
    const result = restartGatewayProcessWithFreshPid();
    expect(result).toEqual({
      mode: "disabled",
      detail: "unmanaged: use in-process restart to keep custom supervisor PID tracking stable",
    });
    expect(spawnMock).not.toHaveBeenCalled();
  });
});

describe("respawnGatewayProcessForUpdate", () => {
  it("keeps MERCLAW_NO_RESPAWN semantics for update restarts", () => {
    clearSupervisorHints();
    process.env.MERCLAW_NO_RESPAWN = "1";

    const result = respawnGatewayProcessForUpdate();

    expect(result).toEqual({ mode: "disabled", detail: "MERCLAW_NO_RESPAWN" });
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("allows detached respawn on unmanaged Windows during updates", () => {
    clearSupervisorHints();
    setPlatform("win32");
    process.execArgv = [];
    process.argv = [
      "C:\\Program Files\\node.exe",
      "C:\\merclaw\\dist\\index.js",
      "gateway",
      "run",
    ];
    spawnMock.mockReturnValue({ pid: 5151, unref: vi.fn(), kill: vi.fn() });

    const result = respawnGatewayProcessForUpdate();

    expect(result.mode).toBe("spawned");
    expect(result.pid).toBe(5151);
    expect(spawnMock).toHaveBeenCalledWith(
      process.execPath,
      ["C:\\merclaw\\dist\\index.js", "gateway", "run"],
      {
        detached: true,
        env: process.env,
        stdio: "inherit",
      },
    );
  });

  it("spawns a detached update process when macOS only has inherited XPC state", () => {
    clearSupervisorHints();
    setPlatform("darwin");
    process.env.XPC_SERVICE_NAME = "ai.merclaw.mac";
    process.execArgv = [];
    process.argv = ["/usr/local/bin/node", "/repo/dist/index.js", "gateway", "run"];
    spawnMock.mockReturnValue({ pid: 6161, unref: vi.fn(), kill: vi.fn() });

    const result = respawnGatewayProcessForUpdate();

    expect(result.mode).toBe("spawned");
    expect(result.pid).toBe(6161);
    expect(spawnMock).toHaveBeenCalledWith(
      process.execPath,
      ["/repo/dist/index.js", "gateway", "run"],
      {
        detached: true,
        env: process.env,
        stdio: "inherit",
      },
    );
  });

  it("returns failed when update detached respawn throws", () => {
    delete process.env.MERCLAW_NO_RESPAWN;
    clearSupervisorHints();
    setPlatform("linux");

    spawnMock.mockImplementation(() => {
      throw new Error("spawn failed");
    });

    const result = respawnGatewayProcessForUpdate();

    expect(result.mode).toBe("failed");
    expect(result.detail).toContain("spawn failed");
  });
});
