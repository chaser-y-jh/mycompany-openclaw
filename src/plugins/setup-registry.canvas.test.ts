import path from "node:path";
import { describe, expect, test } from "vitest";
import type { MerClawConfig } from "../config/types.merclaw.js";
import { runPluginSetupConfigMigrations } from "./setup-registry.js";

describe("Canvas setup config migration", () => {
  test("rewrites legacy canvasHost into plugin-owned config", () => {
    const result = runPluginSetupConfigMigrations({
      env: {
        ...process.env,
        MERCLAW_BUNDLED_PLUGINS_DIR: path.resolve("extensions"),
      },
      config: {
        canvasHost: {
          enabled: false,
          root: "~/legacy-canvas",
          liveReload: false,
        },
      } as MerClawConfig,
    });

    expect(result.changes).toEqual(["migrated canvasHost to plugins.entries.canvas.config.host"]);
    expect(result.config).toEqual({
      plugins: {
        entries: {
          canvas: {
            config: {
              host: {
                enabled: false,
                root: "~/legacy-canvas",
                liveReload: false,
              },
            },
          },
        },
      },
    });
  });
});
