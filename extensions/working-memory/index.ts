/**
 * Working Memory Extension — Task state machine for agent execution context.
 *
 * # What This Does
 *
 *   Working Memory fills the gap between Short-Term Memory (conversation context)
 *   and Long-Term Memory (vector/wiki/file storage). It tracks:
 *     - What goal the agent is currently pursuing
 *     - The subtask decomposition tree (DAG flattened to a stack)
 *     - A freetext scratchpad for intermediate work
 *     - Active entities the agent is focused on
 *     - Pending decisions awaiting user input
 *
 * # Integration Points
 *
 *   1. SessionExtension — one WorkingMemoryManager instance per session
 *   2. Tools — `working_memory_get` and `working_memory_update` for agent use
 *   3. Hooks — `before_prompt_build` injects current task state into the prompt
 *   4. Lifecycle — auto-persists on turn end, cleans up on session destroy
 *
 * # Usage Flow
 *
 *   Agent receives complex task
 *     → TaskDecomposer creates subtask DAG
 *       → Subtasks pushed to WorkingMemory
 *         → Before each LLM call, current state injected via hook
 *           → Agent uses working_memory_get to check status
 *             → Agent uses working_memory_update to advance state
 *               → On task complete, WorkingMemory cleared for next task
 */

import { definePluginEntry } from "merclaw/plugin-sdk/plugin-entry";
import type { MerClawPluginApi } from "merclaw/plugin-sdk/plugin-entry";
import { resolvePluginConfigObject } from "merclaw/plugin-sdk/plugin-config-runtime";
import type { MerClawConfig } from "merclaw/plugin-sdk/config-contracts";
import { getWmDb, closeWmDb } from "./src/db.js";
import { WorkingMemoryManager, type WorkingMemoryConfig } from "./src/manager.js";
import type { WorkingMemorySnapshot } from "./src/types.js";

// ── Plugin Config ────────────────────────────────────────────────

interface WorkingMemoryPluginConfig {
  enabled?: boolean;
  maxSubtaskDepth?: number;
  scratchpadMaxChars?: number;
  persistOnEveryUpdate?: boolean;
}

function resolveConfig(config?: MerClawConfig): WorkingMemoryPluginConfig {
  const pluginConfig = resolvePluginConfigObject(
    config,
    "working-memory",
  ) as WorkingMemoryPluginConfig | undefined;
  return pluginConfig ?? {};
}

// ── In-memory manager registry (keyed by sessionKey) ─────────────

/**
 * Why a Map and not the SessionExtension's built-in storage?
 * We need synchronous access to the manager from within tool execute
 * callbacks, and the SessionExtension project() API returns the
 * manager asynchronously. By keeping a sidecar Map we can do O(1)
 * lookups in tool handlers without async overhead.
 */
const managerRegistry = new Map<string, WorkingMemoryManager>();

/** Look up a manager by session key. Returns undefined if not found. */
export function getWorkingMemory(sessionKey: string): WorkingMemoryManager | undefined {
  return managerRegistry.get(sessionKey);
}

/** Compact the scratchpad for a session (used by auto-compaction hook). */
export function compactScratchpad(sessionKey: string): boolean {
  const wm = managerRegistry.get(sessionKey);
  if (!wm) return false;

  const current = wm.readScratchpad();
  if (current.length < 500) return false; // nothing to compact

  // Keep the last 2000 chars (most recent work) + a summary prefix
  const summary =
    `[Compacted — was ${current.length} chars. Recent content preserved below.]\n\n`;
  const tail = current.slice(-2000);
  wm.writeScratchpad(summary + tail, "replace");
  return true;
}

// ── Plugin Entry ─────────────────────────────────────────────────

export default definePluginEntry({
  id: "working-memory",
  name: "Working Memory",
  description:
    "Task working memory tracker — maintains current goal, subtask stack, scratchpad, active entities, and pending decisions for agent execution context.",

  register(api: MerClawPluginApi) {
    const cfg = resolveConfig(api.config);
    if (cfg.enabled === false) {
      api.logger.info?.("[working-memory] Disabled by config, skipping init");
      return;
    }

    // Resolve state directory for SQLite storage
    const stateDir =
      api.runtime?.stateDir ??
      process.env.MERCLAW_STATE_DIR ??
      (process.env.HOME ?? process.env.USERPROFILE ?? ".") + "/.merclaw";

    const db = getWmDb(stateDir);

    // ── Session Extension ──────────────────────────────────────

    /**
     * SessionExtension: one WorkingMemoryManager per session.
     * The manager is created on first access and destroyed when the session ends.
     */
    api.registerSessionExtension({
      namespace: "working-memory",
      description: "Task working memory tracker for agent execution context",

      project: (session) => {
        const manager = new WorkingMemoryManager(db, session.sessionKey, {
          maxSubtaskDepth: cfg.maxSubtaskDepth ?? 10,
          scratchpadMaxChars: cfg.scratchpadMaxChars ?? 8000,
          persistOnEveryUpdate: cfg.persistOnEveryUpdate ?? true,
        });

        // Register in the sidecar Map for sync access from tool handlers
        managerRegistry.set(session.sessionKey, manager);

        return { manager };
      },

      cleanup: (session) => {
        const manager = managerRegistry.get(session.sessionKey);
        if (manager) {
          manager.persist();
          managerRegistry.delete(session.sessionKey);
        }
      },
    });

    // ── Tool: working_memory_get ───────────────────────────────

    /**
     * Agent-callable tool to read the current working memory state.
     * Returns the full snapshot: goal, subtasks, scratchpad, entities, decisions.
     * The agent uses this before making decisions about next steps.
     */
    api.registerTool({
      name: "working_memory_get",
      description:
        "Get the current working memory state. Returns: goal, subtask stack " +
        "(with status and dependencies), scratchpad content, active entities, " +
        "and pending decisions. Use this to check 'where am I in this task?' " +
        "before deciding the next step.",
      parameters: {
        type: "object",
        properties: {
          include_scratchpad: {
            type: "boolean",
            description: "Whether to include the full scratchpad content (default: true)",
          },
        },
      },
      async execute(_toolCallId, params: unknown, ctx?: { sessionKey?: string }) {
        const p = params as { include_scratchpad?: boolean } | undefined;
        const sessionKey = ctx?.sessionKey;
        if (!sessionKey) {
          return { error: "No active session — working memory requires a session context." };
        }

        const wm = managerRegistry.get(sessionKey);
        if (!wm) {
          return { error: "Working memory not initialized for this session." };
        }

        const snapshot = wm.serialize();

        // Count subtasks by status for a quick summary
        const statusCounts: Record<string, number> = {};
        for (const s of snapshot.subtasks) {
          statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;
        }

        const scratchpadSize = snapshot.scratchpad.length;
        const maxSize = cfg.scratchpadMaxChars ?? 8000;

        return {
          goal: snapshot.goal,
          subtask_summary: {
            total: snapshot.subtasks.length,
            by_status: statusCounts,
            current: snapshot.subtasks.find((s) => s.status === "in_progress") ?? null,
          },
          subtasks: snapshot.subtasks,
          active_entities: snapshot.activeEntities,
          pending_decisions: snapshot.pendingDecisions.filter(
            (d) => d.selectedOption === undefined,
          ),
          scratchpad: (p?.include_scratchpad !== false)
            ? snapshot.scratchpad
            : `[${scratchpadSize} chars — omitted. Set include_scratchpad:true to read.]`,
          scratchpad_warning:
            scratchpadSize > maxSize
              ? `Scratchpad is ${scratchpadSize} chars (limit: ${maxSize}). Consider compacting.`
              : undefined,
        };
      },
    });

    // ── Tool: working_memory_update ────────────────────────────

    /**
     * Agent-callable tool to mutate working memory state.
     * Supports multiple actions: setGoal, pushSubtask, updateSubtask,
     * retrySubtask, writeScratchpad, clearScratchpad, trackEntity,
     * forgetEntity, recordDecision, resolveDecision.
     */
    api.registerTool({
      name: "working_memory_update",
      description:
        "Update the working memory state. Supported actions:\n" +
        "- setGoal: Set the top-level task goal (clears previous subtasks)\n" +
        "- pushSubtask: Add a new subtask to the stack\n" +
        "- updateSubtask: Change a subtask's status (e.g. mark complete)\n" +
        "- retrySubtask: Retry a failed subtask (increments retry counter)\n" +
        "- writeScratchpad: Append or replace scratchpad content\n" +
        "- clearScratchpad: Clear the scratchpad\n" +
        "- trackEntity / forgetEntity: Manage active entity list\n" +
        "- recordDecision / resolveDecision: Track pending decisions\n" +
        "Use this after each step to keep the working memory up to date.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [
              "setGoal",
              "pushSubtask",
              "updateSubtask",
              "retrySubtask",
              "writeScratchpad",
              "clearScratchpad",
              "trackEntity",
              "forgetEntity",
              "recordDecision",
              "resolveDecision",
            ],
            description: "Which working memory operation to perform.",
          },
          data: {
            type: "object",
            description:
              "Action-specific payload. See each action's required fields below.",
          },
        },
        required: ["action"],
      },
      async execute(_toolCallId, params: unknown, ctx?: { sessionKey?: string }) {
        const p = params as { action: string; data?: Record<string, unknown> };
        const sessionKey = ctx?.sessionKey;
        if (!sessionKey) {
          return { error: "No active session." };
        }

        const wm = managerRegistry.get(sessionKey);
        if (!wm) {
          return { error: "Working memory not initialized for this session." };
        }

        try {
          switch (p.action) {
            // ── Goal ──────────────────────────────────────────
            case "setGoal": {
              const goal = (p.data as { goal?: string })?.goal;
              if (!goal) return { error: "setGoal requires data.goal (string)" };
              wm.setGoal(goal);
              return {
                success: true,
                action: "setGoal",
                goal,
                message: "Goal set. Previous subtasks cleared.",
              };
            }

            // ── Subtask ───────────────────────────────────────
            case "pushSubtask": {
              const desc = (p.data as { description?: string })?.description;
              const parentId = (p.data as { parent_id?: string })?.parent_id;
              if (!desc) return { error: "pushSubtask requires data.description (string)" };
              const subtask = wm.pushSubtask(desc, parentId);
              return {
                success: true,
                action: "pushSubtask",
                subtask,
                stack_depth: wm.getAllSubtasks().length,
              };
            }

            case "updateSubtask": {
              const id = (p.data as { subtask_id?: string })?.subtask_id;
              const status = (p.data as { status?: string })?.status;
              const result = (p.data as { result?: string })?.result;
              if (!id || !status) {
                return { error: "updateSubtask requires data.subtask_id and data.status" };
              }
              const validStatuses = ["pending", "ready", "in_progress", "completed", "failed"];
              if (!validStatuses.includes(status)) {
                return { error: `Invalid status "${status}". Must be one of: ${validStatuses.join(", ")}` };
              }
              const updated = wm.updateSubtaskStatus(
                id,
                status as "pending" | "ready" | "in_progress" | "completed" | "failed",
                result,
              );
              if (!updated) return { error: `Subtask "${id}" not found.` };
              return { success: true, action: "updateSubtask", subtask: updated };
            }

            case "retrySubtask": {
              const id = (p.data as { subtask_id?: string })?.subtask_id;
              if (!id) return { error: "retrySubtask requires data.subtask_id" };
              const retried = wm.retrySubtask(id);
              if (!retried) {
                return {
                  success: false,
                  error: `Subtask "${id}" not found, is not failed, or exceeded max retries.`,
                };
              }
              return { success: true, action: "retrySubtask", subtask: retried };
            }

            // ── Scratchpad ────────────────────────────────────
            case "writeScratchpad": {
              const content = (p.data as { content?: string })?.content;
              const mode = ((p.data as { mode?: string })?.mode ?? "append") as "append" | "replace";
              if (content === undefined) {
                return { error: "writeScratchpad requires data.content (string)" };
              }
              wm.writeScratchpad(content, mode);
              const size = wm.readScratchpad().length;
              const maxSize = cfg.scratchpadMaxChars ?? 8000;
              return {
                success: true,
                action: "writeScratchpad",
                scratchpad_size: size,
                warning: size > maxSize
                  ? `Scratchpad is large (${size} chars). Consider clearing or compacting.`
                  : undefined,
              };
            }

            case "clearScratchpad": {
              const wasSize = wm.readScratchpad().length;
              wm.clearScratchpad();
              return {
                success: true,
                action: "clearScratchpad",
                cleared_chars: wasSize,
              };
            }

            // ── Entities ──────────────────────────────────────
            case "trackEntity": {
              const entity = (p.data as { entity?: string })?.entity;
              if (!entity) return { error: "trackEntity requires data.entity (string)" };
              wm.trackEntity(entity);
              return {
                success: true,
                action: "trackEntity",
                entities: wm.getActiveEntities(),
              };
            }

            case "forgetEntity": {
              const entity = (p.data as { entity?: string })?.entity;
              if (!entity) return { error: "forgetEntity requires data.entity (string)" };
              wm.forgetEntity(entity);
              return {
                success: true,
                action: "forgetEntity",
                entities: wm.getActiveEntities(),
              };
            }

            // ── Decisions ─────────────────────────────────────
            case "recordDecision": {
              const question = (p.data as { question?: string })?.question;
              const options = (p.data as { options?: string[] })?.options;
              if (!question || !options?.length) {
                return { error: "recordDecision requires data.question (string) and data.options (string[])" };
              }
              const decision = wm.recordDecision({ question, options });
              return { success: true, action: "recordDecision", decision };
            }

            case "resolveDecision": {
              const decisionId = (p.data as { decision_id?: string })?.decision_id;
              const selectedOption = (p.data as { selected_option?: string })?.selected_option;
              if (!decisionId || !selectedOption) {
                return { error: "resolveDecision requires data.decision_id and data.selected_option" };
              }
              const resolved = wm.resolveDecision(decisionId, selectedOption);
              if (!resolved) return { error: `Decision "${decisionId}" not found.` };
              return { success: true, action: "resolveDecision", decision: resolved };
            }

            default:
              return { error: `Unknown action: "${p.action}"` };
          }
        } catch (err) {
          return {
            error: `Working memory operation failed: ${(err as Error).message}`,
          };
        }
      },
    });

    // ── Hook: Inject working memory into agent prompt ──────────

    /**
     * Before each LLM inference, inject a concise working memory
     * summary into the system context. This lets the agent know
     * "where it is" in the current task without needing to call
     * working_memory_get explicitly on every turn.
     *
     * The injected block is kept small (~200-500 tokens) to avoid
     * consuming the context window.
     */
    api.registerHook("before_prompt_build", async (event: unknown) => {
      const ev = event as {
        sessionKey?: string;
        prependSystemContext?: string;
      };

      const sessionKey = ev.sessionKey;
      if (!sessionKey) return;

      const wm = managerRegistry.get(sessionKey);
      if (!wm) return;

      const snapshot = wm.serialize();

      // Don't inject if there's no active task
      if (!snapshot.goal && snapshot.subtasks.length === 0) return;

      // Build a compact injection block
      const lines: string[] = [];
      lines.push("<working_memory>");

      if (snapshot.goal) {
        lines.push(`  Goal: ${snapshot.goal}`);
      }

      if (snapshot.subtasks.length > 0) {
        const current = snapshot.subtasks.find((s) => s.status === "in_progress");
        const ready = snapshot.subtasks.filter((s) => s.status === "ready");
        const completed = snapshot.subtasks.filter((s) => s.status === "completed");
        const failed = snapshot.subtasks.filter((s) => s.status === "failed");

        lines.push(`  Subtasks: ${completed.length} done, ${ready.length} ready, ${failed.length} failed, ${snapshot.subtasks.length} total`);
        if (current) {
          lines.push(`  Currently doing: ${current.description}`);
        }
        if (ready.length > 0) {
          lines.push(`  Next up: ${ready.slice(0, 3).map((s) => s.description).join(" | ")}`);
        }
      }

      if (snapshot.activeEntities.length > 0) {
        lines.push(`  Active entities: ${snapshot.activeEntities.join(", ")}`);
      }

      if (snapshot.pendingDecisions.length > 0) {
        const pending = snapshot.pendingDecisions.filter(
          (d) => d.selectedOption === undefined,
        );
        if (pending.length > 0) {
          lines.push(`  Pending decisions: ${pending.map((d) => d.question).join("; ")}`);
        }
      }

      lines.push("</working_memory>");

      // Prepend to system context
      const block = lines.join("\n");
      if (ev.prependSystemContext) {
        ev.prependSystemContext = block + "\n" + ev.prependSystemContext;
      } else {
        ev.prependSystemContext = block;
      }
    });

    // ── Service Lifecycle ──────────────────────────────────────

    api.registerService({
      id: "working-memory-service",
      start: async () => {
        api.logger.info?.(
          `[working-memory] Started — db: ${stateDir}/working-memory, maxSubtasks: ${cfg.maxSubtaskDepth ?? 10}`,
        );
      },
      stop: async () => {
        // Persist all active managers before shutdown
        for (const [key, manager] of managerRegistry) {
          try {
            manager.persist();
          } catch (err) {
            api.logger.warn?.(
              `[working-memory] Failed to persist session ${key}: ${(err as Error).message}`,
            );
          }
        }
        managerRegistry.clear();
        closeWmDb();
        api.logger.info?.("[working-memory] Stopped");
      },
    });

    api.logger.info?.("[working-memory] Working Memory plugin registered successfully");
  },
});
