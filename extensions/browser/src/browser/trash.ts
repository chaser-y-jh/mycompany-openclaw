import os from "node:os";
import { movePathToTrash as movePathToTrashWithAllowedRoots } from "merclaw/plugin-sdk/browser-config";
import { resolvePreferredMerClawTmpDir } from "merclaw/plugin-sdk/temp-path";

export async function movePathToTrash(targetPath: string): Promise<string> {
  return await movePathToTrashWithAllowedRoots(targetPath, {
    allowedRoots: [os.homedir(), resolvePreferredMerClawTmpDir()],
  });
}
