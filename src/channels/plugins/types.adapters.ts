import type { ReplyPayload } from "../../auto-reply/reply-payload.js";
import type { LegacyConfigRule } from "../../config/legacy.shared.js";
import type { AgentBinding } from "../../config/types.agents.js";
import type { MerClawConfig } from "../../config/types.merclaw.js";
import type { GroupToolPolicyConfig } from "../../config/types.tools.js";
import type { ChannelApprovalNativeRuntimeAdapter } from "../../infra/approval-handler-runtime-types.js";
import type { ChannelApprovalKind } from "../../infra/approval-types.js";
import type { ExecApprovalRequest, ExecApprovalResolved } from "../../infra/exec-approvals.js";
import type {
  PluginApprovalRequest,
  PluginApprovalResolved,
} from "../../infra/plugin-approvals.js";
import type { RuntimeEnv } from "../../runtime.js";
import type { ResolverContext, SecretDefaults } from "../../secrets/runtime-shared.js";
import type { SecretTargetRegistryEntry } from "../../secrets/target-registry-types.js";
import type { ChannelApprovalNativeAdapter } from "./approval-native.types.js";
import type { ChannelRuntimeSurface } from "./channel-runtime-surface.types.js";
import type { ConfigWriteTarget } from "./config-writes.js";
export type {
  ChannelOutboundAdapter,
  ChannelOutboundChunkContext,
  ChannelOutboundContext,
  ChannelOutboundFormattedContext,
  ChannelOutboundPayloadContext,
  ChannelOutboundPayloadHint,
  ChannelOutboundTargetRef,
  ChannelDeliveryCapabilities,
} from "./outbound.types.js";
import type {
  ChannelAccountSnapshot,
  ChannelAccountState,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelHeartbeatDeps,
  ChannelLegacyStateMigrationPlan,
  ChannelLogSink,
  ChannelSecurityContext,
  ChannelSecurityDmPolicy,
  ChannelSetupInput,
  ChannelStatusIssue,
} from "./types.core.js";
export type { ChannelPairingAdapter } from "./pairing.types.js";

type ConfiguredBindingRule = AgentBinding;
export type { ChannelApprovalKind } from "../../infra/approval-types.js";

export type ChannelActionAvailabilityState =
  | { kind: "enabled" }
  | { kind: "disabled" }
  | { kind: "unsupported" };

export type ChannelApprovalInitiatingSurfaceState = ChannelActionAvailabilityState;

export type ChannelApprovalForwardTarget = {
  channel: string;
  to: string;
  accountId?: string | null;
  threadId?: string | number | null;
  source?: "session" | "target";
};

export type ChannelCapabilitiesDisplayTone = "default" | "muted" | "success" | "warn" | "error";

export type ChannelCapabilitiesDisplayLine = {
  text: string;
  tone?: ChannelCapabilitiesDisplayTone;
};

export type ChannelCapabilitiesDiagnostics = {
  lines?: ChannelCapabilitiesDisplayLine[];
  details?: Record<string, unknown>;
};

type ChannelAdapterCallback<T extends (...args: never[]) => unknown> = T;

export type ChannelSetupAdapter = {
  resolveAccountId?: (params: {
    cfg: MerClawConfig;
    accountId?: string;
    input?: ChannelSetupInput;
  }) => string;
  resolveBindingAccountId?: (params: {
    cfg: MerClawConfig;
    agentId: string;
    accountId?: string;
  }) => string | undefined;
  applyAccountName?: (params: {
    cfg: MerClawConfig;
    accountId: string;
    name?: string;
  }) => MerClawConfig;
  applyAccountConfig: (params: {
    cfg: MerClawConfig;
    accountId: string;
    input: ChannelSetupInput;
  }) => MerClawConfig;
  afterAccountConfigWritten?: (params: {
    previousCfg: MerClawConfig;
    cfg: MerClawConfig;
    accountId: string;
    input: ChannelSetupInput;
    runtime: RuntimeEnv;
  }) => Promise<void> | void;
  validateInput?: (params: {
    cfg: MerClawConfig;
    accountId: string;
    input: ChannelSetupInput;
  }) => string | null;
  singleAccountKeysToMove?: readonly string[];
  namedAccountPromotionKeys?: readonly string[];
  resolveSingleAccountPromotionTarget?: (params: {
    channel: Record<string, unknown>;
  }) => string | undefined;
};

export type ChannelConfigAdapter<ResolvedAccount> = {
  listAccountIds: (cfg: MerClawConfig) => string[];
  resolveAccount: (cfg: MerClawConfig, accountId?: string | null) => ResolvedAccount;
  inspectAccount?: (cfg: MerClawConfig, accountId?: string | null) => unknown;
  defaultAccountId?: (cfg: MerClawConfig) => string;
  setAccountEnabled?: (params: {
    cfg: MerClawConfig;
    accountId: string;
    enabled: boolean;
  }) => MerClawConfig;
  deleteAccount?: (params: { cfg: MerClawConfig; accountId: string }) => MerClawConfig;
  isEnabled?: ChannelAdapterCallback<(account: ResolvedAccount, cfg: MerClawConfig) => boolean>;
  disabledReason?: ChannelAdapterCallback<
    (account: ResolvedAccount, cfg: MerClawConfig) => string
  >;
  isConfigured?: ChannelAdapterCallback<
    (account: ResolvedAccount, cfg: MerClawConfig) => boolean | Promise<boolean>
  >;
  unconfiguredReason?: ChannelAdapterCallback<
    (account: ResolvedAccount, cfg: MerClawConfig) => string
  >;
  describeAccount?: ChannelAdapterCallback<
    (account: ResolvedAccount, cfg: MerClawConfig) => ChannelAccountSnapshot
  >;
  resolveAllowFrom?: (params: {
    cfg: MerClawConfig;
    accountId?: string | null;
  }) => Array<string | number> | undefined;
  formatAllowFrom?: (params: {
    cfg: MerClawConfig;
    accountId?: string | null;
    allowFrom: Array<string | number>;
  }) => string[];
  hasConfiguredState?: (params: { cfg: MerClawConfig; env?: NodeJS.ProcessEnv }) => boolean;
  hasPersistedAuthState?: (params: { cfg: MerClawConfig; env?: NodeJS.ProcessEnv }) => boolean;
  resolveDefaultTo?: (params: {
    cfg: MerClawConfig;
    accountId?: string | null;
  }) => string | undefined;
};

export type ChannelSecretsAdapter = {
  secretTargetRegistryEntries?: readonly SecretTargetRegistryEntry[];
  unsupportedSecretRefSurfacePatterns?: readonly string[];
  collectUnsupportedSecretRefConfigCandidates?: (raw: unknown) => Array<{
    path: string;
    value: unknown;
  }>;
  collectRuntimeConfigAssignments?: (params: {
    config: MerClawConfig;
    defaults: SecretDefaults | undefined;
    context: ResolverContext;
  }) => void;
};

export type ChannelGroupAdapter = {
  resolveRequireMention?: (params: ChannelGroupContext) => boolean | undefined;
  resolveGroupIntroHint?: (params: ChannelGroupContext) => string | undefined;
  resolveToolPolicy?: (params: ChannelGroupContext) => GroupToolPolicyConfig | undefined;
};

export type ChannelStatusAdapter<ResolvedAccount, Probe = unknown, Audit = unknown> = {
  defaultRuntime?: ChannelAccountSnapshot;
  buildChannelSummary?: ChannelAdapterCallback<
    (params: {
      account: ResolvedAccount;
      cfg: MerClawConfig;
      defaultAccountId: string;
      snapshot: ChannelAccountSnapshot;
    }) => Record<string, unknown> | Promise<Record<string, unknown>>
  >;
  probeAccount?: ChannelAdapterCallback<
    (params: { account: ResolvedAccount; timeoutMs: number; cfg: MerClawConfig }) => Promise<Probe>
  >;
  formatCapabilitiesProbe?: ChannelAdapterCallback<
    (params: { probe: Probe }) => ChannelCapabilitiesDisplayLine[]
  >;
  auditAccount?: ChannelAdapterCallback<
    (params: {
      account: ResolvedAccount;
      timeoutMs: number;
      cfg: MerClawConfig;
      probe?: Probe;
    }) => Promise<Audit>
  >;
  buildCapabilitiesDiagnostics?: ChannelAdapterCallback<
    (params: {
      account: ResolvedAccount;
      timeoutMs: number;
      cfg: MerClawConfig;
      probe?: Probe;
      audit?: Audit;
      target?: string;
    }) => Promise<ChannelCapabilitiesDiagnostics | undefined>
  >;
  buildAccountSnapshot?: ChannelAdapterCallback<
    (params: {
      account: ResolvedAccount;
      cfg: MerClawConfig;
      runtime?: ChannelAccountSnapshot;
      probe?: Probe;
      audit?: Audit;
    }) => ChannelAccountSnapshot | Promise<ChannelAccountSnapshot>
  >;
  logSelfId?: ChannelAdapterCallback<
    (params: {
      account: ResolvedAccount;
      cfg: MerClawConfig;
      runtime: RuntimeEnv;
      includeChannelPrefix?: boolean;
    }) => void
  >;
  resolveAccountState?: ChannelAdapterCallback<
    (params: {
      account: ResolvedAccount;
      cfg: MerClawConfig;
      configured: boolean;
      enabled: boolean;
    }) => ChannelAccountState
  >;
  collectStatusIssues?: (accounts: ChannelAccountSnapshot[]) => ChannelStatusIssue[];
};

export type ChannelGatewayContext<ResolvedAccount = unknown> = {
  cfg: MerClawConfig;
  accountId: string;
  account: ResolvedAccount;
  runtime: RuntimeEnv;
  abortSignal: AbortSignal;
  log?: ChannelLogSink;
  getStatus: () => ChannelAccountSnapshot;
  setStatus: (next: ChannelAccountSnapshot) => void;
  /**
   * Optional channel runtime helpers for external channel plugins.
   *
   * This field provides the canonical channel runtime helpers for channel
   * dispatch, routing, session, reply, and startup context work.
   *
   * ## Available Features
   *
   * - **reply**: AI response dispatching, formatting, and delivery
   * - **routing**: Agent route resolution and matching
   * - **text**: Text chunking, markdown processing, and control command detection
   * - **session**: Session management and metadata tracking
   * - **media**: Remote media fetching and buffer saving
   * - **commands**: Command authorization and control command handling
   * - **groups**: Group policy resolution and mention requirements
   * - **pairing**: Channel pairing and allow-from management
   *
   * ## Use Cases
   *
   * Channel plugins that need:
   * - AI-powered response generation and delivery
   * - Advanced text processing and formatting
   * - Session tracking and management
   * - Agent routing and policy resolution
   *
   * ## Example
   *
   * ```typescript
   * const emailGatewayAdapter: ChannelGatewayAdapter<EmailAccount> = {
   *   startAccount: async (ctx) => {
   *     // Check availability (for backward compatibility)
   *     if (!ctx.channelRuntime) {
   *       ctx.log?.warn?.("channelRuntime not available - skipping AI features");
   *       return;
   *     }
   *
   *     // Use AI dispatch
   *     await ctx.channelRuntime.reply.dispatchReplyWithBufferedBlockDispatcher({
   *       ctx: { ... },
   *       cfg: ctx.cfg,
   *       dispatcherOptions: {
   *         deliver: async (payload) => {
   *           // Send reply via email
   *         },
   *       },
   *     });
   *   },
   * };
   * ```
   *
   * ## Backward Compatibility
   *
   * - This field is **optional** - channels that don't need it can ignore it
   * - Gateway startup passes a full `createPluginRuntime().channel` surface
   *   when a runtime resolver is configured
   * - External plugins should check for undefined before using
   *
   * @since Plugin SDK 2026.2.19
   * @see {@link https://docs.merclaw.ai/plugins/building-plugins | Plugin SDK documentation}
   */
  channelRuntime?: ChannelRuntimeSurface;
};

export type ChannelLogoutResult = {
  cleared: boolean;
  loggedOut?: boolean;
  [key: string]: unknown;
};

export type ChannelLoginWithQrStartResult = {
  qrDataUrl?: string;
  message: string;
  connected?: boolean;
};

export type ChannelLoginWithQrWaitResult = {
  connected: boolean;
  message: string;
  qrDataUrl?: string;
};

export type ChannelLogoutContext<ResolvedAccount = unknown> = {
  cfg: MerClawConfig;
  accountId: string;
  account: ResolvedAccount;
  runtime: RuntimeEnv;
  log?: ChannelLogSink;
};

export type ChannelGatewayAdapter<ResolvedAccount = unknown> = {
  startAccount?: (ctx: ChannelGatewayContext<ResolvedAccount>) => Promise<unknown>;
  stopAccount?: (ctx: ChannelGatewayContext<ResolvedAccount>) => Promise<void>;
  /** Keep gateway auth bypass resolution mirrored through a lightweight top-level `gateway-auth-api.ts` artifact. */
  resolveGatewayAuthBypassPaths?: (params: { cfg: MerClawConfig }) => string[];
  loginWithQrStart?: (params: {
    accountId?: string;
    force?: boolean;
    timeoutMs?: number;
    verbose?: boolean;
  }) => Promise<ChannelLoginWithQrStartResult>;
  loginWithQrWait?: (params: {
    accountId?: string;
    timeoutMs?: number;
    currentQrDataUrl?: string;
  }) => Promise<ChannelLoginWithQrWaitResult>;
  logoutAccount?: (ctx: ChannelLogoutContext<ResolvedAccount>) => Promise<ChannelLogoutResult>;
};

export type ChannelAuthAdapter = {
  login?: (params: {
    cfg: MerClawConfig;
    accountId?: string | null;
    runtime: RuntimeEnv;
    verbose?: boolean;
    channelInput?: string | null;
  }) => Promise<void>;
};

export type ChannelHeartbeatAdapter = {
  checkReady?: (params: {
    cfg: MerClawConfig;
    accountId?: string | null;
    deps?: ChannelHeartbeatDeps;
  }) => Promise<{ ok: boolean; reason: string }>;
  sendTyping?: (params: {
    cfg: MerClawConfig;
    to: string;
    accountId?: string | null;
    threadId?: string | number | null;
    deps?: ChannelHeartbeatDeps;
  }) => Promise<void> | void;
  clearTyping?: (params: {
    cfg: MerClawConfig;
    to: string;
    accountId?: string | null;
    threadId?: string | number | null;
    deps?: ChannelHeartbeatDeps;
  }) => Promise<void> | void;
};

type ChannelDirectorySelfParams = {
  cfg: MerClawConfig;
  accountId?: string | null;
  runtime: RuntimeEnv;
};

type ChannelDirectoryListParams = {
  cfg: MerClawConfig;
  accountId?: string | null;
  query?: string | null;
  limit?: number | null;
  runtime: RuntimeEnv;
};

type ChannelDirectoryListGroupMembersParams = {
  cfg: MerClawConfig;
  accountId?: string | null;
  groupId: string;
  limit?: number | null;
  runtime: RuntimeEnv;
};

export type ChannelDirectoryAdapter = {
  self?: (params: ChannelDirectorySelfParams) => Promise<ChannelDirectoryEntry | null>;
  listPeers?: (params: ChannelDirectoryListParams) => Promise<ChannelDirectoryEntry[]>;
  listPeersLive?: (params: ChannelDirectoryListParams) => Promise<ChannelDirectoryEntry[]>;
  listGroups?: (params: ChannelDirectoryListParams) => Promise<ChannelDirectoryEntry[]>;
  listGroupsLive?: (params: ChannelDirectoryListParams) => Promise<ChannelDirectoryEntry[]>;
  listGroupMembers?: (
    params: ChannelDirectoryListGroupMembersParams,
  ) => Promise<ChannelDirectoryEntry[]>;
};

export type ChannelResolveKind = "user" | "group";

export type ChannelResolveResult = {
  input: string;
  resolved: boolean;
  id?: string;
  name?: string;
  note?: string;
};

export type ChannelResolverAdapter = {
  resolveTargets: (params: {
    cfg: MerClawConfig;
    accountId?: string | null;
    inputs: string[];
    kind: ChannelResolveKind;
    runtime: RuntimeEnv;
  }) => Promise<ChannelResolveResult[]>;
};

export type ChannelElevatedAdapter = {
  allowFromFallback?: (params: {
    cfg: MerClawConfig;
    accountId?: string | null;
  }) => Array<string | number> | undefined;
};

export type ChannelCommandAdapter = {
  enforceOwnerForCommands?: boolean;
  skipWhenConfigEmpty?: boolean;
  nativeCommandsAutoEnabled?: boolean;
  nativeSkillsAutoEnabled?: boolean;
  preferSenderE164ForCommands?: boolean;
  resolveNativeCommandName?: (params: {
    commandKey: string;
    defaultName: string;
  }) => string | undefined;
  buildCommandsListChannelData?: (params: {
    currentPage: number;
    totalPages: number;
    agentId?: string;
  }) => ReplyPayload["channelData"] | null;
  buildModelsMenuChannelData?: (params: {
    providers: Array<{ id: string; count: number }>;
  }) => ReplyPayload["channelData"] | null;
  buildModelsProviderChannelData?: (params: {
    providers: Array<{ id: string; count: number }>;
  }) => ReplyPayload["channelData"] | null;
  buildModelsAddProviderChannelData?: (params: {
    providers: Array<{ id: string }>;
  }) => ReplyPayload["channelData"] | null;
  buildModelsListChannelData?: (params: {
    provider: string;
    models: readonly string[];
    currentModel?: string;
    currentPage: number;
    totalPages: number;
    pageSize?: number;
    modelNames?: ReadonlyMap<string, string>;
  }) => ReplyPayload["channelData"] | null;
  buildModelBrowseChannelData?: () => ReplyPayload["channelData"] | null;
};

export type ChannelDoctorConfigMutation = {
  config: MerClawConfig;
  changes: string[];
  warnings?: string[];
};

export type ChannelDoctorLegacyConfigRule = LegacyConfigRule;

export type ChannelDoctorSequenceResult = {
  changeNotes: string[];
  warningNotes: string[];
};

export type ChannelDoctorEmptyAllowlistAccountContext = {
  account: Record<string, unknown>;
  channelName: string;
  dmPolicy?: string;
  effectiveAllowFrom?: Array<string | number>;
  parent?: Record<string, unknown>;
  prefix: string;
};

export type ChannelDoctorAdapter = {
  dmAllowFromMode?: "topOnly" | "topOrNested" | "nestedOnly";
  groupModel?: "sender" | "route" | "hybrid";
  groupAllowFromFallbackToAllowFrom?: boolean;
  warnOnEmptyGroupSenderAllowlist?: boolean;
  legacyConfigRules?: LegacyConfigRule[];
  normalizeCompatibilityConfig?: (params: { cfg: MerClawConfig }) => ChannelDoctorConfigMutation;
  collectPreviewWarnings?: (params: {
    cfg: MerClawConfig;
    doctorFixCommand: string;
    env?: NodeJS.ProcessEnv;
  }) => string[] | Promise<string[]>;
  collectMutableAllowlistWarnings?: (params: {
    cfg: MerClawConfig;
  }) => string[] | Promise<string[]>;
  repairConfig?: (params: {
    cfg: MerClawConfig;
    doctorFixCommand: string;
  }) => ChannelDoctorConfigMutation | Promise<ChannelDoctorConfigMutation>;
  runConfigSequence?: (params: {
    cfg: MerClawConfig;
    env: NodeJS.ProcessEnv;
    shouldRepair: boolean;
  }) => ChannelDoctorSequenceResult | Promise<ChannelDoctorSequenceResult>;
  cleanStaleConfig?: (params: {
    cfg: MerClawConfig;
  }) => ChannelDoctorConfigMutation | Promise<ChannelDoctorConfigMutation>;
  collectEmptyAllowlistExtraWarnings?: (
    params: ChannelDoctorEmptyAllowlistAccountContext,
  ) => string[];
  shouldSkipDefaultEmptyGroupAllowlistWarning?: (
    params: ChannelDoctorEmptyAllowlistAccountContext,
  ) => boolean;
};

export type ChannelLifecycleAdapter = {
  onAccountConfigChanged?: (params: {
    prevCfg: MerClawConfig;
    nextCfg: MerClawConfig;
    accountId: string;
    runtime: RuntimeEnv;
  }) => Promise<void> | void;
  onAccountRemoved?: (params: {
    prevCfg: MerClawConfig;
    accountId: string;
    runtime: RuntimeEnv;
  }) => Promise<void> | void;
  runStartupMaintenance?: (params: {
    cfg: MerClawConfig;
    env?: NodeJS.ProcessEnv;
    log: {
      info?: (message: string) => void;
      warn?: (message: string) => void;
    };
    trigger?: string;
    logPrefix?: string;
  }) => Promise<void> | void;
  detectLegacyStateMigrations?: (params: {
    cfg: MerClawConfig;
    env: NodeJS.ProcessEnv;
    stateDir: string;
    oauthDir: string;
  }) => ChannelLegacyStateMigrationPlan[] | Promise<ChannelLegacyStateMigrationPlan[]>;
};

export type ChannelApprovalDeliveryAdapter = {
  hasConfiguredDmRoute?: (params: { cfg: MerClawConfig }) => boolean;
  shouldSuppressForwardingFallback?: (params: {
    cfg: MerClawConfig;
    approvalKind: ChannelApprovalKind;
    target: ChannelApprovalForwardTarget;
    request: ExecApprovalRequest | PluginApprovalRequest;
  }) => boolean;
};
export type ChannelApproveCommandBehavior =
  | { kind: "allow" }
  | { kind: "ignore" }
  | { kind: "reply"; text: string };

export type {
  ChannelApprovalNativeAdapter,
  ChannelApprovalNativeDeliveryCapabilities,
  ChannelApprovalNativeDeliveryPreference,
  ChannelApprovalNativeRequest,
  ChannelApprovalNativeSurface,
  ChannelApprovalNativeTarget,
} from "./approval-native.types.js";

export type ChannelApprovalRenderAdapter = {
  exec?: {
    buildPendingPayload?: (params: {
      cfg: MerClawConfig;
      request: ExecApprovalRequest;
      target: ChannelApprovalForwardTarget;
      nowMs: number;
    }) => ReplyPayload | null;
    buildResolvedPayload?: (params: {
      cfg: MerClawConfig;
      resolved: ExecApprovalResolved;
      target: ChannelApprovalForwardTarget;
    }) => ReplyPayload | null;
  };
  plugin?: {
    buildPendingPayload?: (params: {
      cfg: MerClawConfig;
      request: PluginApprovalRequest;
      target: ChannelApprovalForwardTarget;
      nowMs: number;
    }) => ReplyPayload | null;
    buildResolvedPayload?: (params: {
      cfg: MerClawConfig;
      resolved: PluginApprovalResolved;
      target: ChannelApprovalForwardTarget;
    }) => ReplyPayload | null;
  };
};

export type ChannelApprovalAdapter = {
  delivery?: ChannelApprovalDeliveryAdapter;
  nativeRuntime?: ChannelApprovalNativeRuntimeAdapter;
  render?: ChannelApprovalRenderAdapter;
  native?: ChannelApprovalNativeAdapter;
  describeExecApprovalSetup?: (params: {
    channel: string;
    channelLabel: string;
    accountId?: string;
  }) => string | null | undefined;
};

export type ChannelApprovalCapability = ChannelApprovalAdapter & {
  authorizeActorAction?: (params: {
    cfg: MerClawConfig;
    accountId?: string | null;
    senderId?: string | null;
    action: "approve";
    approvalKind: "exec" | "plugin";
  }) => {
    authorized: boolean;
    reason?: string;
  };
  getActionAvailabilityState?: (params: {
    cfg: MerClawConfig;
    accountId?: string | null;
    action: "approve";
    approvalKind?: ChannelApprovalKind;
  }) => ChannelActionAvailabilityState;
  /** Exec-native client availability for the initiating surface; distinct from same-chat auth. */
  getExecInitiatingSurfaceState?: (params: {
    cfg: MerClawConfig;
    accountId?: string | null;
    action: "approve";
  }) => ChannelActionAvailabilityState;
  resolveApproveCommandBehavior?: (params: {
    cfg: MerClawConfig;
    accountId?: string | null;
    senderId?: string | null;
    approvalKind: ChannelApprovalKind;
  }) => ChannelApproveCommandBehavior | undefined;
};

export type ChannelAllowlistAdapter = {
  applyConfigEdit?: (params: {
    cfg: MerClawConfig;
    parsedConfig: Record<string, unknown>;
    accountId?: string | null;
    scope: "dm" | "group";
    action: "add" | "remove";
    entry: string;
  }) =>
    | {
        kind: "ok";
        changed: boolean;
        pathLabel: string;
        writeTarget: ConfigWriteTarget;
      }
    | {
        kind: "invalid-entry";
      }
    | Promise<
        | {
            kind: "ok";
            changed: boolean;
            pathLabel: string;
            writeTarget: ConfigWriteTarget;
          }
        | {
            kind: "invalid-entry";
          }
      >
    | null;
  readConfig?: (params: { cfg: MerClawConfig; accountId?: string | null }) =>
    | {
        dmAllowFrom?: Array<string | number>;
        groupAllowFrom?: Array<string | number>;
        dmPolicy?: string;
        groupPolicy?: string;
        groupOverrides?: Array<{ label: string; entries: Array<string | number> }>;
      }
    | Promise<{
        dmAllowFrom?: Array<string | number>;
        groupAllowFrom?: Array<string | number>;
        dmPolicy?: string;
        groupPolicy?: string;
        groupOverrides?: Array<{ label: string; entries: Array<string | number> }>;
      }>;
  resolveNames?: (params: {
    cfg: MerClawConfig;
    accountId?: string | null;
    scope: "dm" | "group";
    entries: string[];
  }) =>
    | Array<{ input: string; resolved: boolean; name?: string | null }>
    | Promise<Array<{ input: string; resolved: boolean; name?: string | null }>>;
  supportsScope?: (params: { scope: "dm" | "group" | "all" }) => boolean;
};

export type ChannelConfiguredBindingConversationRef = {
  conversationId: string;
  parentConversationId?: string;
};

export type ChannelConfiguredBindingMatch = ChannelConfiguredBindingConversationRef & {
  matchPriority?: number;
};

export type ChannelCommandConversationContext = {
  accountId: string;
  threadId?: string;
  threadParentId?: string;
  senderId?: string;
  sessionKey?: string;
  parentSessionKey?: string;
  from?: string;
  chatType?: string;
  originatingTo?: string;
  commandTo?: string;
  fallbackTo?: string;
};

export type ChannelConfiguredBindingProvider = {
  selfParentConversationByDefault?: boolean;
  compileConfiguredBinding: (params: {
    binding: ConfiguredBindingRule;
    conversationId: string;
  }) => ChannelConfiguredBindingConversationRef | null;
  matchInboundConversation: (params: {
    binding: ConfiguredBindingRule;
    compiledBinding: ChannelConfiguredBindingConversationRef;
    conversationId: string;
    parentConversationId?: string;
  }) => ChannelConfiguredBindingMatch | null;
  resolveCommandConversation?: (
    params: ChannelCommandConversationContext,
  ) => ChannelConfiguredBindingConversationRef | null;
};

export type ChannelConversationBindingSupport = {
  supportsCurrentConversationBinding?: boolean;
  /**
   * Preferred placement when a command is started from a top-level conversation
   * without an existing native thread id.
   *
   * - `current`: bind/spawn in the current conversation
   * - `child`: create a child thread/conversation first
   */
  defaultTopLevelPlacement?: "current" | "child";
  resolveConversationRef?: (params: {
    accountId?: string | null;
    conversationId: string;
    parentConversationId?: string;
    threadId?: string | number | null;
  }) => {
    conversationId: string;
    parentConversationId?: string;
  } | null;
  buildBoundReplyPayload?: (params: {
    operation: "acp-spawn";
    placement: "current" | "child";
    conversation: {
      channel: string;
      accountId?: string | null;
      conversationId: string;
      parentConversationId?: string;
    };
  }) =>
    | Pick<ReplyPayload, "channelData" | "delivery" | "presentation">
    | null
    | Promise<Pick<ReplyPayload, "channelData" | "delivery" | "presentation"> | null>;
  buildModelOverrideParentCandidates?: (params: {
    parentConversationId?: string | null;
  }) => string[] | null | undefined;
  shouldStripThreadFromAnnounceOrigin?: (params: {
    requester: {
      channel?: string;
      to?: string;
      threadId?: string | number;
    };
    entry: {
      channel?: string;
      to?: string;
      threadId?: string | number;
    };
  }) => boolean;
  setIdleTimeoutBySessionKey?: (params: {
    targetSessionKey: string;
    accountId?: string | null;
    idleTimeoutMs: number;
  }) => Array<{
    boundAt: number;
    lastActivityAt: number;
    idleTimeoutMs?: number;
    maxAgeMs?: number;
  }>;
  setMaxAgeBySessionKey?: (params: {
    targetSessionKey: string;
    accountId?: string | null;
    maxAgeMs: number;
  }) => Array<{
    boundAt: number;
    lastActivityAt: number;
    idleTimeoutMs?: number;
    maxAgeMs?: number;
  }>;
  createManager?: (params: { cfg: MerClawConfig; accountId?: string | null }) =>
    | {
        stop: () => void | Promise<void>;
      }
    | Promise<{
        stop: () => void | Promise<void>;
      }>;
};

export type ChannelSecurityAdapter<ResolvedAccount = unknown> = {
  applyConfigFixes?: (params: {
    cfg: MerClawConfig;
    env: NodeJS.ProcessEnv;
  }) => ChannelDoctorConfigMutation | Promise<ChannelDoctorConfigMutation>;
  resolveDmPolicy?: ChannelAdapterCallback<
    (ctx: ChannelSecurityContext<ResolvedAccount>) => ChannelSecurityDmPolicy | null
  >;
  collectWarnings?: ChannelAdapterCallback<
    (ctx: ChannelSecurityContext<ResolvedAccount>) => Promise<string[]> | string[]
  >;
  collectAuditFindings?: ChannelAdapterCallback<
    (
      ctx: ChannelSecurityContext<ResolvedAccount> & {
        sourceConfig: MerClawConfig;
        orderedAccountIds: string[];
        hasExplicitAccountPath: boolean;
      },
    ) =>
      | Promise<
          Array<{
            checkId: string;
            severity: "info" | "warn" | "critical";
            title: string;
            detail: string;
            remediation?: string;
          }>
        >
      | Array<{
          checkId: string;
          severity: "info" | "warn" | "critical";
          title: string;
          detail: string;
          remediation?: string;
        }>
  >;
};
