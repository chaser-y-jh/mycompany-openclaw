export type MatrixManagedDeviceInfo = {
  deviceId: string;
  displayName: string | null;
  current: boolean;
};

export type MatrixDeviceHealthSummary = {
  currentDeviceId: string | null;
  staleMerClawDevices: MatrixManagedDeviceInfo[];
  currentMerClawDevices: MatrixManagedDeviceInfo[];
};

const MERCLAW_DEVICE_NAME_PREFIX = "MerClaw ";

export function isMerClawManagedMatrixDevice(displayName: string | null | undefined): boolean {
  return displayName?.startsWith(MERCLAW_DEVICE_NAME_PREFIX) === true;
}

export function summarizeMatrixDeviceHealth(
  devices: MatrixManagedDeviceInfo[],
): MatrixDeviceHealthSummary {
  const currentDeviceId = devices.find((device) => device.current)?.deviceId ?? null;
  const merClawDevices = devices.filter((device) =>
    isMerClawManagedMatrixDevice(device.displayName),
  );
  return {
    currentDeviceId,
    staleMerClawDevices: merClawDevices.filter((device) => !device.current),
    currentMerClawDevices: merClawDevices.filter((device) => device.current),
  };
}
