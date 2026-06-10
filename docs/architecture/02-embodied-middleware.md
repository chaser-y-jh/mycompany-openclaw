# MerClaw Embodied Middleware 设计

> Day 4 产出 | 2026-06-10
> 范围：任务编排引擎 + 安全规则引擎 + VLAC 闭环接口
> 对接 Vincent 架构图中的 Embodied Middleware：任务规划 / VLAC闭环评估 / 安全校验

---

## 一、设计原则

1. **扩展优先，核心零改动**：全部以 `extensions/` 开发，复用现有 Plugin API
2. **对接上层产出**：TaskDecomposer 输出 → 编排引擎输入；WorkingMemory 是共享状态
3. **渐进式安全**：从现有 RBAC 升级为操作级安全规则，不推翻重做
4. **硬件接口预留**：VLAC 只定义回调接口，不实现硬件逻辑

---

## 二、任务编排引擎 (Task Orchestrator)

### 2.1 定位

```
LLM/Agent Layer                    Embodied Middleware
─────────────────                  ──────────────────
TaskDecomposer                      TaskOrchestrator
  │ 输出: TaskPlan                    │ 输入: TaskPlan
  │ (subtask DAG)                    │ 输出: 执行调度 + 状态机
  │                                  │
  └──────────► WorkingMemory ◄──────────┘
               (共享状态总线)
```

编排引擎不替代 TaskDecomposer。分解器负责"拆成什么"，编排器负责"怎么执行"。两者通过 WorkingMemory 松耦合。

### 2.2 核心架构

```
┌─────────────────────────────────────────────────────┐
│                 TaskOrchestrator                      │
│                                                       │
│  TaskPlan ──► DependencyResolver ──► Schedule ──►     │
│                  │                    │               │
│                  │ 拓扑排序           │ 并行/串行      │
│                  │ 就绪判定           │ 优先级队列     │
│                  │ 循环检测           │ 并发槽位       │
│                  ▼                    ▼               │
│              ┌──────────────────────────────┐        │
│              │      ExecutionEngine         │        │
│              │  • 子任务分派 (→ Agent)       │        │
│              │  • 进度监控 (↔ WorkingMemory) │        │
│              │  • 失败恢复 (retry/fallback)  │        │
│              │  • 结果聚合 (→ 最终输出)       │        │
│              └──────────────────────────────┘        │
│                                                       │
│  状态机:                                              │
│  CREATED → SCHEDULING → RUNNING → COMPLETED          │
│                   ↓           ↓                       │
│                PAUSED      FAILED → RETRYING          │
│                                ↓                      │
│                            ABANDONED                  │
└─────────────────────────────────────────────────────┘
```

### 2.3 数据结构

```typescript
// ── 编排计划（任务编排引擎内部使用，比 TaskPlan 更细粒度）──

interface OrchestrationPlan {
  planId: string;                  // UUID
  taskPlanId: string;              // 关联的 TaskDecomposer 输出的 TaskPlan
  sessionKey: string;
  status: OrchestrationStatus;
  nodes: OrchestrationNode[];      // 编排节点（包装了 subtask）
  schedule: ExecutionSchedule;     // 调度策略
  stats: OrchestrationStats;
  createdAt: number;
  updatedAt: number;
}

type OrchestrationStatus =
  | "created"      // 已创建，等待启动
  | "scheduling"   // 正在计算执行顺序
  | "running"      // 执行中
  | "paused"       // 暂停（等待外部输入/决策）
  | "completed"    // 所有 subtask 完成
  | "failed"       // 有 subtask 最终失败且不可恢复
  | "abandoned";   // 用户取消

interface OrchestrationNode {
  subtaskId: string;               // 对应 Subtask.id
  description: string;
  status: OrchestrationNodeStatus;
  dependencies: string[];          // 依赖的 subtaskId 列表
  dependents: string[];            // 被哪些 subtask 依赖
  assignedTools: string[];
  priority: number;                // 1-10，越高越优先
  maxRetries: number;
  retryCount: number;
  timeoutMs: number;               // 超时时间
  result?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

type OrchestrationNodeStatus =
  | "blocked"       // 依赖未满足
  | "ready"         // 可以执行
  | "running"       // 执行中
  | "completed"     // 成功
  | "failed"        // 失败（可重试）
  | "skipped";      // 因条件分支跳过

interface ExecutionSchedule {
  strategy: "parallel_max" | "sequential" | "dependency_driven";
  maxConcurrency: number;          // 最大并行数
  priorityQueue: boolean;          // 是否启用优先级排序
  timeouts: {
    perSubtask: number;            // 单个子任务超时 (ms)
    total: number;                 // 总超时 (ms)
  };
}

interface OrchestrationStats {
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  runningNodes: number;
  blockedNodes: number;
  percentComplete: number;
  elapsedMs: number;
  estimatedRemainingMs: number;
}
```

### 2.4 DependencyResolver — 依赖解析

拓扑排序 + 就绪判定。核心算法：

```
1. 输入: SubtaskNode[] + Dependency[]
2. 构建入度表 (每个节点有多少未完成的依赖)
3. 找出所有入度为 0 的节点 → ready 状态
4. 检测 DAG 中的循环依赖 → 拒绝非法计划
5. 每次有节点 completed 时:
   a. 减少所有 dependents 的入度
   b. 入度变为 0 的节点 → blocked → ready
6. 条件分支: 根据前序结果决定后序节点是否 skip
```

```typescript
interface DependencyResolver {
  /** 从 TaskPlan 构建执行 DAG */
  buildDAG(plan: TaskPlan): {
    nodes: Map<string, OrchestrationNode>;
    ready: string[];         // 就绪队列
    hasCycles: boolean;
    cyclePath?: string[];    // 如果存在循环，给出路径
  };

  /** 通知某个节点完成，返回所有新就绪的节点 */
  onNodeCompleted(nodeId: string, result: string): string[];

  /** 通知某个节点失败，返回受影响的节点 */
  onNodeFailed(nodeId: string, error: string): {
    newReady: string[];       // 不依赖此节点的继续
    blocked: string[];        // 依赖此节点的被阻塞
  };

  /** 获取当前所有阻塞节点（调试用） */
  getBlockedNodes(): string[];

  /** 获取进度摘要 */
  getProgress(): {
    total: number;
    done: number;
    blocked: number;
    ready: number;
    running: number;
    failed: number;
  };
}
```

### 2.5 ExecutionEngine — 执行引擎

执行策略：

| 策略 | 适合场景 | 行为 |
|------|---------|------|
| `parallel_max` | 互不依赖的计算密集型子任务 | 最多 N 个并行，完成一个启动下一个 |
| `sequential` | 严格顺序依赖的任务 | 一个一个执行 |
| `dependency_driven` | 混合 DAG（默认） | 基于依赖图，随时取就绪的并行执行 |

**执行循环（核心）：**

```
while (plan.status === "running") {
  ready = getReadyNodes()
  if (ready.length === 0) {
    if (allDone) → COMPLETED
    if (someFailed && noRetry) → FAILED
    wait for running tasks
  }

  slots = maxConcurrency - runningCount
  for (node in ready.slice(0, slots)) {
    dispatch(node)  // 非阻塞，每个 node 是一个 Agent Turn
    node.status = "running"
  }

  await anyTaskCompletion()
  // 更新 WorkingMemory
}
```

**失败恢复策略：**

```
subtask 失败
  │
  ├── retryCount < maxRetries
  │     → 指数退避重试 (1s, 2s, 4s, 8s...)
  │     → WorkingMemory.updateSubtask("retry")
  │
  ├── hasFallback
  │     → 执行备用工具/备用路径
  │     → WorkingMemory.pushSubtask(fallback)
  │
  └── no retry + no fallback
        ├── 此 subtask 依赖链上的所有节点 → blocked
        ├── 不依赖此 subtask 的节点 → 继续执行（partial success）
        └── 是否 failFast → 中止整个 plan
```

### 2.6 与现有代码对接

| 对接点 | 方式 | 说明 |
|--------|------|------|
| `src/tasks/task-flow-registry.ts` | 复用 TaskFlow 生命周期 | 编排计划用 TaskFlow 的 managed sync 模式 |
| `src/tasks/task-executor.ts` | 复用 `runTaskInFlow` | 每个 subtask 创建为 TaskFlow 的 child task |
| WorkingMemory | 读写 subtaskStack | 编排引擎是 WorkingMemory 的主要消费者 |
| `registerSessionExtension` | 每会话一个 Orchestrator | 同 WorkingMemory 模式 |
| `before_prompt_build` hook | 注入编排状态 | 让 Agent 知道自己在 plan 中的位置 |

### 2.7 配置项

```yaml
orchestrator:
  maxConcurrency: 3           # 最大并行子任务数
  defaultStrategy: "dependency_driven"
  perSubtaskTimeoutMs: 120000 # 单个子任务 2 分钟超时
  totalTimeoutMs: 600000      # 总计划 10 分钟超时
  maxRetries: 3               # 默认重试次数
  failFast: false             # 一个失败是否终止全部
  progressReportInterval: 5   # 每 5 秒汇报进度
```

### 2.8 扩展结构

```
extensions/task-orchestrator/
├── package.json
├── merclaw.plugin.json
├── index.ts                    # 插件入口
├── src/
│   ├── types.ts                # 类型定义
│   ├── dependency-resolver.ts  # DAG 依赖解析器
│   ├── execution-engine.ts     # 执行引擎
│   ├── scheduler.ts            # 调度器（优先级+并发）
│   ├── recovery.ts             # 失败恢复策略
│   └── progress-reporter.ts    # 进度汇报
└── test/
    ├── dependency-resolver.test.ts
    └── execution-engine.test.ts
```

---

## 三、安全规则引擎 (Safety Guard)

### 3.1 从 RBAC 到操作级安全

education-auth 的 RBAC 解决了"谁能做什么角色该做的事"。安全规则引擎解决"当前这个具体操作，在这个上下文下，是否安全"。

```
教育 RBAC (已有)              安全规则引擎 (新建)
─────────────────           ─────────────────────
role → permission            operation → context → decision
静态权限矩阵                  动态规则评估
用户级                        操作级 + 上下文级
粗粒度                        细粒度
```

### 3.2 规则模型

```typescript
// ── 规则定义 ──

interface SafetyRule {
  id: string;
  name: string;                   // 人类可读名称
  description: string;
  priority: number;               // 数字越小越先评估
  category: SafetyCategory;
  /** 评估条件：满足此表达式的操作触发此规则 */
  condition: SafetyCondition;
  /** 动作：满足条件时做什么 */
  action: SafetyAction;
  /** 是否需要审计日志 */
  audit: boolean;
}

type SafetyCategory =
  | "tool_execution"    // 工具执行安全
  | "content_safety"    // 内容安全（输入/输出）
  | "rate_limit"        // 频率限制
  | "data_privacy"      // 数据隐私
  | "authentication";   // 认证安全

// ── 条件表达式（声明式 DSL）──

interface SafetyCondition {
  /**
   * 组合方式。不填 = 所有字段 AND，填 allOf/anyOf = 嵌套组合。
   * 支持任意深度嵌套。
   */
  allOf?: SafetyCondition[];
  anyOf?: SafetyCondition[];

  /** 操作匹配 */
  operation?: {
    toolName?: string;              // 精确匹配工具名
    toolNamePattern?: string;       // 正则匹配工具名 (如 "bash.*", ".*_admin")
    intent?: string;                // 意图匹配
  };

  /** 角色匹配 */
  role?: {
    is?: EduRole;                   // 精确匹配
    in?: EduRole[];                 // 在其中之一
    not?: EduRole;                  // 排除
  };

  /** 上下文匹配 */
  context?: {
    timeWindow?: {                  // 时间窗口
      start?: string;               // HH:mm
      end?: string;                 // HH:mm
    };
    rateWindow?: {                  // 频率窗口
      maxCalls: number;
      windowMs: number;
    };
    dataContains?: string[];        // 数据包含敏感关键词
    schoolId?: string;              // 特定学校
  };

  /** 自定义评估函数名（可选扩展点） */
  customEvaluator?: string;
}

// ── 动作 ──

interface SafetyAction {
  /** 决策类型 */
  decision: "allow" | "deny" | "confirm" | "log_only" | "mask";
  /** deny 时的用户消息（中文） */
  denyMessage?: string;
  /** confirm 时的确认提示 */
  confirmPrompt?: string;
  /** mask 时的遮蔽规则 */
  maskRules?: {
    patterns: string[];    // 要遮蔽的正则
    replacement: string;   // 替换文本
  };
  /** 是否通知管理员 */
  notifyAdmin?: boolean;
  /** 是否强制要求人工审批 */
  requireHumanApproval?: boolean;
}
```

### 3.3 内置规则示例

```typescript
// 规则优先级体系:
//   0-9:   紧急规则（阻止系统级危险操作）
//   10-49: 高优先级（认证、隐私）
//   50-99: 中优先级（内容安全、频率限制）
//   100+:  低优先级（日志记录、监控）

const BUILTIN_RULES: SafetyRule[] = [
  // ── P0: 系统安全 ──
  {
    id: "block-system-commands-for-students",
    name: "禁止学生执行系统命令",
    description: "学生角色不能调用 bash/exec/file 类工具",
    priority: 0,
    category: "tool_execution",
    condition: {
      role: { is: "student" },
      operation: { toolNamePattern: "^(bash|exec|shell|file_write|file_delete|system)" },
    },
    action: {
      decision: "deny",
      denyMessage: "安全限制：学生账号不能执行系统级操作。如有需要请联系老师。",
      notifyAdmin: true,
    },
    audit: true,
  },

  // ── P1: 认证 + 隐私 ──
  {
    id: "require-auth-for-personal-data",
    name: "访问个人信息需认证",
    description: "未认证用户不能访问任何带 PII 的数据",
    priority: 10,
    category: "authentication",
    condition: {
      allOf: [
        { role: { not: "admin" } },
        { operation: { toolNamePattern: ".*(user|profile|account|password).*" } },
      ],
    },
    action: {
      decision: "deny",
      denyMessage: "需要登录认证后才能访问用户信息。",
    },
    audit: true,
  },

  // ── P2: 内容安全 ──
  {
    id: "filter-k12-inappropriate-content",
    name: "K12 不当内容过滤",
    description: "双向过滤：学生输入 + 模型输出中的不当内容",
    priority: 50,
    category: "content_safety",
    condition: {
      context: {
        dataContains: [
          // 关键词列表在配置中可扩展
          "__K12_BLOCKLIST__",  // 配置占位符
        ],
      },
    },
    action: {
      decision: "mask",
      denyMessage: "内容已根据安全策略处理。",
    },
    audit: true,
  },

  // ── P3: 频率限制 ──
  {
    id: "rate-limit-student-requests",
    name: "学生请求频率限制",
    description: "防止单个学生短时间内大量请求",
    priority: 80,
    category: "rate_limit",
    condition: {
      role: { is: "student" },
      context: {
        rateWindow: { maxCalls: 30, windowMs: 60_000 }, // 每分钟 30 次
      },
    },
    action: {
      decision: "deny",
      denyMessage: "请求过快，请稍后再试。学习需要时间消化哦~",
    },
    audit: false,  // 高频事件不记录，减少日志
  },

  // ── P4: 监控日志 ──
  {
    id: "audit-admin-actions",
    name: "管理员操作审计",
    description: "记录所有管理员操作用于审计",
    priority: 100,
    category: "data_privacy",
    condition: {
      role: { is: "admin" },
    },
    action: {
      decision: "log_only",  // 不拦截，只记录
    },
    audit: true,
  },
];
```

### 3.4 规则引擎架构

```
Tool Call Request
       │
       ▼
┌──────────────────┐
│ RuleEvaluator     │
│                   │
│ 1. 加载规则       │  ← 内置规则 + 用户自定义规则
│ 2. 按 priority   │
│    排序           │
│ 3. 逐条评估       │  ← 短路: 第一个 deny 就返回
│ 4. 聚合动作       │  ← 同条件多条规则,选最严的
│                   │
│ 输出: Decision    │
└──────┬───────────┘
       │
   ┌───┴───────────────────────┐
   ▼         ▼         ▼       ▼
 allow     deny    confirm    mask
   │         │         │       │
   │         ▼         ▼       ▼
   │    返回错误   弹出确认  遮蔽后放行
   │
   ▼
 执行 Tool
```

```typescript
interface RuleEvaluator {
  /**
   * 评估一个操作是否安全。
   * 返回最严格的匹配决策。
   */
  evaluate(params: {
    operation: {
      toolName: string;
      toolParams: Record<string, unknown>;
    };
    context: {
      eduContext: EduContext | null;
      sessionKey: string;
      intent?: string;
      inputContent?: string;
    };
    rateState: RateLimitState;  // 当前频率状态
  }): SafetyDecision;
}

interface SafetyDecision {
  /** 最终决策 */
  verdict: "allow" | "deny" | "confirm";
  /** 触发的规则列表 */
  triggeredRules: { ruleId: string; action: SafetyAction }[];
  /** 如果 deny/confirm，给用户的消息 */
  userMessage?: string;
  /** 如果需要遮蔽，被遮蔽后的内容 */
  maskedContent?: string;
  /** 审计日志条目（如果规则要求记录） */
  auditEntries: AuditLogEntry[];
}

interface RateLimitState {
  /** 按 sessionKey 的调用计数 */
  sessionCalls: Map<string, { count: number; windowStart: number }>;
  /** 检查并递增 */
  checkAndIncrement(sessionKey: string, windowMs: number, maxCalls: number): {
    allowed: boolean;
    current: number;
    resetInMs: number;
  };
}
```

### 3.5 Hook 注入点

```
Tool Call 流程:
                                  安全规则引擎
                                  ═══════════
Agent 决定调用 Tool X
    │
    ▼
before_tool_call hook ───────► evaluate(op: X, ctx)
    │                                │
    ├── verdict=allow ────► 执行     │
    ├── verdict=deny  ────► 返回错误  │
    ├── verdict=confirm ─► 暂停等待确认│
    └── verdict=mask   ──► 遮蔽参数后执行
                                  │
after_tool_call hook ───────► evaluate_output(content)
    │                                │
    ├── verdict=allow ────► 返回原始输出
    ├── verdict=mask   ──► 遮蔽敏感内容
    └── verdict=deny  ────► 替换为安全回应
```

**与 education-auth 对接：**
- security-guard 的 `evaluate()` 内部先调 `checkPermission()` 做粗粒度 RBAC
- 再跑安全规则引擎做细粒度动态评估
- 两层校验叠加，不替代

### 3.6 规则配置（merclaw.json）

```json5
{
  plugins: {
    entries: {
      "safety-guard": {
        enabled: true,
        rules: {
          // 可在此覆盖/扩展内置规则
          contentFilter: {
            enabled: true,
            blocklist: [],          // 自定义屏蔽词
            modelOutputFilter: true // 是否过滤 LLM 输出
          },
          rateLimit: {
            enabled: true,
            studentPerMinute: 30,
            teacherPerMinute: 60,
            burstAllowance: 3
          },
          toolRestrictions: {
            enabled: true,
            // 自定义工具限制映射
            roleToolBlacklist: {
              student: ["bash", "exec", "file_write"],
              parent: ["bash", "exec"]
            }
          }
        }
      }
    }
  }
}
```

### 3.7 扩展结构

```
extensions/safety-guard/
├── package.json
├── merclaw.plugin.json
├── index.ts                    # 插件入口, 注册 before_tool_call / after_tool_call hooks
├── src/
│   ├── types.ts                # 类型定义
│   ├── rules-registry.ts       # 规则注册表
│   ├── rule-evaluator.ts       # 规则评估引擎
│   ├── builtin-rules.ts        # 内置规则集
│   ├── content-filter.ts       # 内容安全过滤
│   ├── rate-limiter.ts         # 频率限制器
│   └── audit-logger.ts         # 审计日志
└── test/
    ├── rule-evaluator.test.ts
    └── content-filter.test.ts
```

---

## 四、VLAC 闭环接口 (Perception→Evaluation→Correction)

### 4.1 定位

VLAC（Visual-Language-Action Closed-Loop）是具身智能的核心概念：机器人感知环境 → LLM 评估 → 修正行动 → 再感知。实习生只做**纯软件接口设计**，不实现硬件部分。

### 4.2 闭环模型

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ 感知      │ ──► │ 评估      │ ──► │ 决策      │ ──► │ 执行      │
│ (摄像头)  │     │ (LLM)     │     │ (Planner) │     │ (机器人)  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
      ▲                                                    │
      └──────────────── 反馈 ─────────────────────────────┘

实习生范围:
  ┌─────────────────────────────────────────────┐
  │ 评估 ←→ 决策 ← 接口定义                      │
  │                                             │
  │ • PerceptionResult    (感知结果 — 输入接口)   │
  │ • EvaluationContext   (评估上下文 — 处理)     │
  │ • CorrectionPlan      (修正计划 — 输出接口)   │
  │                                             │
  └─────────────────────────────────────────────┘
```

### 4.3 接口定义

```typescript
// ── 感知层输入（由硬件团队提供，这里是接口规格）──

/**
 * 机器人感知系统的一次观测快照。
 * 由感知层（摄像头/LiDAR/传感器）产生，通过回调传入 Middleware。
 */
interface PerceptionSnapshot {
  /** 感知时间戳 */
  timestamp: number;

  /** 视觉感知（可选，如果机器人有摄像头） */
  visual?: {
    /** 当前帧的 base64 或 URL */
    imageData: string;
    /** 检测到的物体列表 */
    detectedObjects: DetectedObject[];
    /** 场景文字描述（可来自 VLM） */
    sceneDescription?: string;
  };

  /** 机器人状态 */
  robotState: {
    /** 关节角度 (joint_name → radians) */
    jointAngles: Record<string, number>;
    /** 末端执行器位姿 (x, y, z, roll, pitch, yaw) */
    endEffectorPose: Pose6D;
    /** 是否正在移动 */
    isMoving: boolean;
    /** 当前电量/温度等 */
    status: Record<string, number>;
  };

  /** 触觉/力反馈（可选） */
  tactile?: {
    contactPoints: ContactPoint[];
    gripperForce: number;  // N
  };

  /** 执行状态：正在执行的动作及其进度 */
  currentAction?: {
    actionId: string;
    name: string;
    progress: number;  // 0-1
    estimatedRemainingMs: number;
  };
}

interface DetectedObject {
  label: string;
  confidence: number;
  bbox?: { x: number; y: number; w: number; h: number };
  pose3D?: Pose6D;
}

interface Pose6D {
  x: number; y: number; z: number;
  roll: number; pitch: number; yaw: number;
}

interface ContactPoint {
  jointName: string;
  force: number;  // N
  torque: number;  // Nm
}

// ── 评估上下文（Middleware 内部构建）──

/**
 * 将感知快照 + 任务上下文打包，送给 LLM 评估。
 * 这是纯软件层可以完整实现的。
 */
interface EvaluationContext {
  /** 当前感知 */
  perception: PerceptionSnapshot;

  /** 当前执行的任务（来自 WorkingMemory） */
  activeTask: {
    goal: string;
    currentSubtask: Subtask | null;
    expectedOutcome: string;  // "期望发生什么"
  };

  /** 历史对比：上一帧 vs 当前帧 */
  delta?: {
    objectChanges: string[];  // ["杯子移动了 3cm", "门已打开"]
    stateChanges: string[];   // ["机械臂角度偏离预期 2°"]
    anomalyFlags: string[];   // ["检测到碰撞", "温度异常"]
  };

  /** 安全约束 */
  safetyConstraints: {
    maxJointVelocity: number;
    forbiddenZones: { x: number; y: number; z: number; radius: number }[];
    mustAvoid: string[];  // 必须避开的物体标签
  };
}

// ── 评估结果（LLM 输出）──

interface EvaluationResult {
  /** 任务是否按预期进行 */
  status: "on_track" | "minor_deviation" | "major_deviation" | "completed" | "stuck";

  /** 如果是 deviation，描述偏差 */
  deviation?: {
    description: string;
    severity: "low" | "medium" | "high";
    rootCause?: string;
  };

  /** 是否需要修正 */
  needsCorrection: boolean;

  /** 建议的修正动作 */
  suggestedCorrection?: CorrectionAction;

  /** 置信度 */
  confidence: number;

  /** 直接继续？ */
  canProceed: boolean;
}

// ── 修正动作（Middleware 输出，传给执行层）──

interface CorrectionAction {
  type: "adjust_trajectory" | "retry" | "replan" | "stop" | "resume" | "recalibrate";
  description: string;

  /** adjust_trajectory: 目标调整 */
  targetAdjustment?: {
    jointDeltas?: Record<string, number>;  // 关节修正量
    poseDelta?: Partial<Pose6D>;           // 末端位姿修正
  };

  /** retry: 重试参数 */
  retryStrategy?: {
    maxRetries: number;
    backoffMs: number;
    preRetryAction?: string;  // 重试前要做什么（如：回机械臂到安全位置）
  };

  /** replan: 重新规划 */
  newPlan?: {
    goal: string;
    steps: string[];
    reason: string;
  };

  /** 是否紧急（需要立即停止当前动作） */
  emergency: boolean;
}
```

### 4.4 VLAC 回调接口

```typescript
/**
 * VLAC 闭环回调接口。
 *
 * 这是 Middleware 暴露给硬件层的回调注册点。
 * 硬件层在以下时机调用这些回调：
 *   1. 每帧感知完成后 → onPerceptionUpdate
 *   2. 动作执行完成后   → onActionComplete
 *   3. 异常检测到后     → onAnomalyDetected
 *
 * Middleware 收到回调后：
 *   1. 构建 EvaluationContext（融合 WorkingMemory + 感知）
 *   2. 调用 LLM 评估
 *   3. 返回 EvaluationResult（含 CorrectionAction）
 *   4. 更新 WorkingMemory
 */
interface VLACCallbackInterface {
  /**
   * 感知更新回调。
   * 硬件层每采集一帧就调用一次。
   * Middleware 评估当前状态 vs 预期，返回是否需要修正。
   */
  onPerceptionUpdate(snapshot: PerceptionSnapshot): Promise<EvaluationResult>;

  /**
   * 动作完成回调。
   * 一个动作执行完毕（成功或失败）后调用。
   */
  onActionComplete(params: {
    actionId: string;
    success: boolean;
    error?: string;
    finalState: PerceptionSnapshot;
  }): Promise<EvaluationResult>;

  /**
   * 异常检测回调。
   * 硬件层检测到碰撞、超温、超力等异常时调用。
   */
  onAnomalyDetected(params: {
    anomalyType: string;
    severity: "warning" | "critical";
    description: string;
    snapshot: PerceptionSnapshot;
  }): Promise<{
    emergencyStop: boolean;
    reason: string;
    recoverySteps: string[];
  }>;
}

/**
 * VLAC 服务注册。
 * 如果机器人硬件层可用，注册此服务后 Middleware 开始监听。
 * 如果不注册，VLAC 模块静默跳过（纯软件模式）。
 */
interface VLACServiceRegistration {
  /** 注册感知回调处理器 */
  registerPerceptionHandler(handler: VLACCallbackInterface): void;

  /** 设置评估模式 */
  setEvaluationMode(mode: "realtime" | "batch" | "manual"): void;

  /** 获取最近一次评估结果 */
  getLastEvaluation(): EvaluationResult | null;

  /** 获取评估历史 */
  getEvaluationHistory(limit: number): EvaluationResult[];
}
```

### 4.5 纯软件模式下 VLAC 怎么用

在机器人硬件未就绪时，VLAC 接口仍然有用：

1. **人工输入模拟感知**：通过 Agent 对话窗口描述当前状态（"机械臂在 X=10, Y=5，杯子在 X=12, Y=5"），LLM 评估后给出修正建议
2. **日志回放模式**：加载历史感知日志，评估当时的决策是否正确
3. **数字孪生对接**：MuJoCo/Isaac Sim 的仿真数据通过同一回调接口传入

---

## 五、Embodied Middleware 数据流全景

```
                          User / Channel
                               │
                    ┌──────────▼──────────┐
                    │  IntentClassifier    │  ← LLM/Agent Layer
                    │  → intent + entities │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  TaskDecomposer      │  ← LLM/Agent Layer
                    │  → TaskPlan (DAG)    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  SafetyGuard.eval() │  ← Security check #1
                    │  "这个任务允许吗?"    │      (任务级)
                    └──────────┬──────────┘
                               │ 允许
                    ┌──────────▼──────────┐
                    │  TaskOrchestrator   │
                    │  → OrchestrationPlan │
                    │  → 调度 + 执行        │
                    │  → WorkingMemory     │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ For each subtask:    │
                    │  ┌────────────────┐  │
                    │  │ SafetyGuard    │  │ ← Security check #2
                    │  │ .evaluate()    │  │      (操作级)
                    │  │ "这个工具能用吗?"│  │
                    │  └───────┬────────┘  │
                    │          │ 允许       │
                    │  ┌───────▼────────┐  │
                    │  │ Agent LLM      │  │
                    │  │ (with WM ctx)  │  │
                    │  └───────┬────────┘  │
                    │          │           │
                    │  ┌───────▼────────┐  │
                    │  │ SafetyGuard    │  │ ← Security check #3
                    │  │ .evaluate_output│ │      (输出级)
                    │  └───────┬────────┘  │
                    └──────────┼───────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Result Aggregator   │
                    │  → 聚合所有 subtask   │
                    │  → 生成最终响应       │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  VLAC callback       │  ← 如果有硬件
                    │  .onActionComplete() │     反馈结果
                    └──────────┬──────────┘
                               │
                             User
```

---

## 六、与现有代码对接总结

```
新模块                  形态              对接点
────────────────────────────────────────────────────────
TaskOrchestrator        extension/new     SessionExtension slot
                                          + TaskFlow.managed sync
                                          + WorkingMemory (consumer)
                                          + before_prompt_build hook

SafetyGuard             extension/new     before_tool_call hook
  (安全规则引擎)                           after_tool_call hook
                                          + education-auth.checkPermission()
                                          + registerTrustedToolPolicy

VLACInterface           extension/new     回调接口定义（纯 TypeScript）
  (闭环评估接口)                           + WorkingMemory (state source)
                                          + registerService (生命周期)
```

**无需修改的核心代码：**
- ✅ `src/gateway/` — hook 管线已有 before_tool_call / after_tool_call
- ✅ `src/tasks/` — TaskFlow 的 managed sync 模式完全满足需求
- ✅ `src/tools/` — planner 和 availability 系统保持不变
- ✅ `extensions/education-auth/` — RBAC 不修改，只在上层叠加

---

## 七、待定设计决策

| # | 决策 | 选项 | 推荐 |
|---|------|------|------|
| 1 | 安全规则 DSL 用声明式 JSON 还是 TypeScript 函数？ | A) JSON + 自定义 evaluator / B) 纯 TS 函数 | **A)** — JSON 可配置、可热更新、非开发人员可维护 |
| 2 | 编排引擎是同步轮询还是事件驱动？ | A) 轮询 (setInterval) / B) EventEmitter | **B)** — 事件驱动延迟更低，已有 Hook 管线的事件模式 |
| 3 | VLAC 的 LLM 评估用哪个模型？ | A) 复用 Agent LLM / B) 专用轻量模型 | **B)** — VLAC 评估不需要强推理，轻量模型降低延迟 |
| 4 | SafetyGuard 是独立扩展还是扩展 education-auth？ | A) 独立扩展 / B) 扩展 education-auth | **A)** — 安全引擎适用面更广（不限于教育场景），独立更好 |

---

## 八、下一步

周四设计的 **03-tool-routing-scheduling.md** 将对接：
- 语义工具路由 → 基于 IntentClassifier 的输出做 tool→intent 智能匹配
- 调度策略 → 与 TaskOrchestrator 的 ExecutionSchedule 互补
- 工具可用性增强 → 在现有 `tool/planner.ts` 的 availability 基础上加语义层
