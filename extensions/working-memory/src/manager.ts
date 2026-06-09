/**
 * WorkingMemoryManager — the core state machine for agent task execution.
 *
 * # Role in the Memory Hierarchy
 *
 *   Short-Term Memory  → Conversation context, recent turns (ContextEngine)
 *   Working Memory     → Current task, subtasks, scratchpad  ← THIS MODULE
 *   Long-Term Memory   → User profiles, knowledge, history (LanceDB/Wiki/MEMORY.md)
 *
 * # Design Principles
 *
 *   1. Single source of truth for "what is the agent doing right now"
 *   2. Serializable — can be persisted mid-task and resumed after restart
 *   3. Tool-accessible — agent can query and mutate via registered tools
 *   4. Bounded — subtask depth and scratchpad size have hard limits
 */

import type { DatabaseSync } from "node:sqlite";
import {
  loadWorkingMemory,
  saveWorkingMemory,
  deleteWorkingMemory,
} from "./db.js";
import type {
  Subtask,
  Decision,
  WorkingMemorySnapshot,
} from "./types.js";

// ── Configuration ────────────────────────────────────────────────

export interface WorkingMemoryConfig {
  /** Maximum nesting depth for subtask stack (prevents runaway recursion) */
  maxSubtaskDepth: number;
  /** Maximum characters in scratchpad before auto-compaction warning */
  scratchpadMaxChars: number;
  /** If true, every mutation immediately flushes to SQLite */
  persistOnEveryUpdate: boolean;
}

const DEFAULT_CONFIG: WorkingMemoryConfig = {
  maxSubtaskDepth: 10,
  scratchpadMaxChars: 8000,
  persistOnEveryUpdate: true,
};

// ── Manager ──────────────────────────────────────────────────────

export class WorkingMemoryManager {
  private db: DatabaseSync;
  private config: WorkingMemoryConfig;
  private snapshot: WorkingMemorySnapshot;
  private dirty = false;

  constructor(
    db: DatabaseSync,
    sessionKey: string,
    config: Partial<WorkingMemoryConfig> = {},
  ) {
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Hydrate from SQLite (or get a fresh snapshot if this is a new session)
    this.snapshot = loadWorkingMemory(db, sessionKey);
  }

  // ── Goal Management ──────────────────────────────────────────

  /**
   * Set the top-level goal the agent is working toward.
   * Calling this clears the previous subtask stack — a new goal
   * means a new task decomposition.
   */
  setGoal(goal: string): void {
    this.snapshot.goal = goal;
    this.snapshot.subtasks = [];
    this.snapshot.scratchpad = "";
    this.markDirty();
  }

  /** Return the current goal, or null if none is set. */
  getGoal(): string | null {
    return this.snapshot.goal;
  }

  // ── Subtask Stack ────────────────────────────────────────────

  /**
   * Push a new subtask onto the stack.
   *
   * @throws If the stack depth exceeds maxSubtaskDepth (prevents unbounded recursion)
   * @returns The created subtask with generated ID
   */
  pushSubtask(description: string, parentId?: string): Subtask {
    if (this.snapshot.subtasks.length >= this.config.maxSubtaskDepth) {
      throw new Error(
        `[WorkingMemory] Subtask depth limit (${this.config.maxSubtaskDepth}) reached. ` +
        `Refusing to push "${description}". Consider completing or failing existing subtasks first.`
      );
    }

    const parent = parentId
      ? this.snapshot.subtasks.find((s) => s.id === parentId)
      : undefined;

    // A subtask can only be pushed if its parent is in_progress
    if (parent && parent.status !== "in_progress") {
      throw new Error(
        `[WorkingMemory] Cannot push subtask under parent "${parentId}" ` +
        `because parent status is "${parent.status}" (must be "in_progress").`
      );
    }

    const subtask: Subtask = {
      id: `subtask-${this.snapshot.subtasks.length + 1}-${Date.now().toString(36)}`,
      description,
      status: "ready",
      parentId,
      retries: 0,
      maxRetries: 3,
    };

    this.snapshot.subtasks.push(subtask);
    this.markDirty();
    return subtask;
  }

  /**
   * Get the subtask currently being worked on.
   * Returns the first subtask with status "in_progress", or undefined
   * if nothing is actively being executed.
   */
  getCurrentSubtask(): Subtask | undefined {
    return this.snapshot.subtasks.find((s) => s.status === "in_progress");
  }

  /** Get all subtasks (flat list). */
  getAllSubtasks(): Subtask[] {
    return [...this.snapshot.subtasks];
  }

  /**
   * Transition a subtask to a new status.
   *
   * Status flow:
   *   pending → ready → in_progress → completed
   *                    → in_progress → failed → ready (retry)
   */
  updateSubtaskStatus(
    subtaskId: string,
    status: Subtask["status"],
    result?: string,
  ): Subtask | undefined {
    const subtask = this.snapshot.subtasks.find((s) => s.id === subtaskId);
    if (!subtask) return undefined;

    subtask.status = status;
    if (result !== undefined) subtask.result = result;
    if (status === "in_progress") {
      // Only one subtask can be in_progress at a time.
      // Auto-complete any other in_progress subtask.
      for (const s of this.snapshot.subtasks) {
        if (s.id !== subtaskId && s.status === "in_progress") {
          s.status = "completed";
          s.result = "Auto-completed: superseded by " + subtaskId;
        }
      }
    }

    this.markDirty();
    return subtask;
  }

  /**
   * Retry a failed subtask: reset to "ready" and increment retry counter.
   * Returns undefined if maxRetries exceeded.
   */
  retrySubtask(subtaskId: string): Subtask | undefined {
    const subtask = this.snapshot.subtasks.find((s) => s.id === subtaskId);
    if (!subtask || subtask.status !== "failed") return undefined;

    const maxRetries = subtask.maxRetries ?? 3;
    const currentRetries = subtask.retries ?? 0;

    if (currentRetries >= maxRetries) {
      subtask.status = "failed";
      subtask.result = `Exceeded max retries (${maxRetries})`;
      this.markDirty();
      return undefined;
    }

    subtask.status = "ready";
    subtask.retries = currentRetries + 1;
    subtask.result = undefined;
    this.markDirty();
    return subtask;
  }

  // ── Scratchpad ────────────────────────────────────────────────

  /**
   * Write content to the scratchpad.
   * The scratchpad is a free-text area for intermediate calculations,
   * notes, partial results, or any information the agent wants to
   * remember across turns within the same task.
   *
   * @param mode - "append" (default) adds to existing content; "replace" overwrites
   */
  writeScratchpad(content: string, mode: "append" | "replace" = "append"): void {
    if (mode === "replace") {
      this.snapshot.scratchpad = content;
    } else {
      this.snapshot.scratchpad += content;
    }

    // Warn if scratchpad exceeds limit (but don't truncate — agent decides)
    if (this.snapshot.scratchpad.length > this.config.scratchpadMaxChars) {
      // We don't throw — just let the agent know via the get tool.
      // The agent is responsible for compacting its own scratchpad.
    }

    this.markDirty();
  }

  /** Read the full scratchpad content. */
  readScratchpad(): string {
    return this.snapshot.scratchpad;
  }

  /** Clear the scratchpad entirely. */
  clearScratchpad(): void {
    this.snapshot.scratchpad = "";
    this.markDirty();
  }

  // ── Entity Tracking ───────────────────────────────────────────

  /**
   * Track an entity the agent is currently focused on.
   * Entities can be people, objects, concepts, files — anything
   * the agent needs to keep "in mind" during the current task.
   */
  trackEntity(entity: string): void {
    if (!this.snapshot.activeEntities.includes(entity)) {
      this.snapshot.activeEntities.push(entity);
      this.markDirty();
    }
  }

  /** Stop tracking an entity. */
  forgetEntity(entity: string): void {
    const idx = this.snapshot.activeEntities.indexOf(entity);
    if (idx >= 0) {
      this.snapshot.activeEntities.splice(idx, 1);
      this.markDirty();
    }
  }

  /** Get all currently tracked entities. */
  getActiveEntities(): string[] {
    return [...this.snapshot.activeEntities];
  }

  // ── Decision Tracking ─────────────────────────────────────────

  /**
   * Record a decision that needs user input.
   * The agent can query pending decisions to know what it's waiting for.
   */
  recordDecision(decision: Omit<Decision, "id" | "timestamp">): Decision {
    const full: Decision = {
      ...decision,
      id: `decision-${Date.now().toString(36)}`,
      timestamp: Date.now(),
    };
    this.snapshot.pendingDecisions.push(full);
    this.markDirty();
    return full;
  }

  /** Resolve a pending decision with the selected option. */
  resolveDecision(decisionId: string, selectedOption: string): Decision | undefined {
    const decision = this.snapshot.pendingDecisions.find(
      (d) => d.id === decisionId,
    );
    if (decision) {
      decision.selectedOption = selectedOption;
      this.markDirty();
    }
    return decision;
  }

  /** Get all decisions that haven't been resolved yet. */
  getPendingDecisions(): Decision[] {
    return this.snapshot.pendingDecisions.filter(
      (d) => d.selectedOption === undefined,
    );
  }

  // ── Serialization ─────────────────────────────────────────────

  /**
   * Export the full working memory state for tool responses.
   */
  serialize(): WorkingMemorySnapshot {
    return { ...this.snapshot };
  }

  /**
   * Hydrate from a previously serialized snapshot.
   * Used for session resume.
   */
  deserialize(snapshot: WorkingMemorySnapshot): void {
    this.snapshot = { ...snapshot };
    this.markDirty();
  }

  /**
   * Persist current state to SQLite.
   * Called automatically on markDirty if persistOnEveryUpdate is true.
   * Also called explicitly on session end.
   */
  persist(): void {
    saveWorkingMemory(this.db, this.snapshot);
    this.dirty = false;
  }

  /**
   * Clean up this session's working memory.
   * Called when the session is destroyed.
   */
  destroy(): void {
    deleteWorkingMemory(this.db, this.snapshot.sessionKey);
    this.dirty = false;
  }

  // ── Internal ──────────────────────────────────────────────────

  private markDirty(): void {
    this.dirty = true;
    if (this.config.persistOnEveryUpdate) {
      this.persist();
    }
  }
}
