# MerClaw 工具路由与调度系统 设计

> Day 4 产出 | 2026-06-10
> 范围：语义工具路由 + 调度策略 + 工具编排
> 对接 Vincent 架构图中 LLM/Agent Layer 的"工具路由" + Embodied Middleware 的"任务规划"

---

## 一、现状分析与设计目标

### 1.1 现有工具系统回顾

当前 `src/tools/planner.ts` 的 `buildToolPlan` 做的事情：

```
ToolDescriptor[] ──► 按名称排序 ──► 可用性评估 ──► 分为 visible / hidden
```

**它做得好的：**
- ✅ 工具描述符标准化
- ✅ 可用性过滤（auth、config、env、plugin 状态）
- ✅ 诊断反馈（为什么某个工具不可用）

**它缺失的：**
- 🔴 没有语义匹配 — 100 个工具，Agent 需要自己选
- 🔴 没有工具排序 — 全部平铺给 LLM，浪费 token
- 🔴 没有上下文裁剪 — 所有工具 description 都发出去
- 🔴 没有调度策略 — 工具执行顺序完全由 Agent LLM 决定

### 1.2 设计目标

在**不修改** `buildToolPlan` 的前提下，在其上层叠加语义路由层：

```
buildToolPlan (不改)         SemanticToolRouter (新建)
───────────────────         ────────────────────────
可用性: 有/无                 相关性: 高/中/低/无
维度: 配置/认证               维度: 语义相似度 + 意图匹配
输出: visible[]              输出: ranked[] + irrelevant[]
```

---

## 二、语义工具路由 (Semantic Tool Router)

### 2.1 路由管线

```
Intent + Entities (来自 IntentClassifier)
       │
       ▼
┌──────────────────────┐
│ 1. Tool Index         │  预计算：工具描述 → embedding
│    向量索引            │  存储在 LanceDB (已有 memory-lancedb)
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 2. Semantic Search    │  query = intent.description + entities
│    语义检索            │  top-K 检索
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 3. Rule-based Boost   │  规则增强：教育场景、安全场景的硬规则
│    规则加权            │  如：math intent → 强制包含 calculator 类工具
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 4. buildToolPlan      │  现有可用性过滤 (不改代码，只传 descriptors)
│    可用性过滤          │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 5. Rank + Truncate    │  按相关性排序 → 截断到 token 预算
│    排序截断            │  输出：给 LLM 的工具列表 (ranked top-N)
└──────────────────────┘
```

### 2.2 数据结构

```typescript
// ── 工具索引条目（用于向量检索）──

interface ToolIndexEntry {
  toolName: string;
  description: string;           // 工具的 description 文本
  embedding?: number[];          // description 的 embedding 向量
  category: ToolCategory;        // 工具分类（预定义）
  keywords: string[];            // 手动标注的关键词（可选）
  intentMapping: {               // 意图→权重映射
    intent: IntentType;
    weight: number;              // 0-1，该意图下此工具的相关性权重
  }[];
  safetyLevel: "safe" | "cautious" | "dangerous";
}

type ToolCategory =
  | "knowledge"       // 知识查询 (search, wiki, memory)
  | "file_system"     // 文件操作 (read, write, delete)
  | "execution"       // 命令执行 (bash, exec)
  | "communication"   // 通讯 (send_message, notify)
  | "education"       // 教育专用 (quiz, homework, grade)
  | "system"          // 系统管理 (config, admin)
  | "creative"        // 创作 (image_gen, translate)
  | "utility";        // 工具 (calculate, timer)

// ── 路由结果 ──

interface RouteResult {
  /** 按相关性降序排列的工具列表 */
  ranked: RoutedTool[];
  /** 不相关但不隐藏的工具（兜底，Agent 仍可调用） */
  fallback: RoutedTool[];
  /** 不可用的工具及原因 */
  unavailable: { toolName: string; reasons: string[] }[];
  /** 路由元数据 */
  meta: {
    query: string;
    intent: IntentType;
    totalTools: number;
    rankedCount: number;
    tokenEstimate: number;       // 工具描述的总 token 估算
    elapsedMs: number;
  };
}

interface RoutedTool {
  toolName: string;
  description: string;
  relevanceScore: number;        // 0-1
  matchReasons: string[];        // 为什么匹配 (e.g. "语义相似", "意图规则", "关键词命中")
  category: ToolCategory;
  safetyLevel: "safe" | "cautious" | "dangerous";
}
```

### 2.3 路由策略

#### 策略 1: 语义向量检索（默认，无 LLM 额外调用）

```
Tool descriptions (预 indexed)
       +
Intent description (query = intent + entities joined)

→ cosine similarity → top-K
→ 延迟: < 5ms (纯向量计算，无 LLM 调用)
→ 成本: 0
→ 适用: 所有场景的默认路由
```

**索引构建**（on startup）：

```typescript
interface ToolIndexBuilder {
  /**
   * 在插件加载阶段构建工具索引。
   * 对所有 registered tools 的 description 做 embedding。
   */
  buildIndex(tools: ToolDescriptor[]): Promise<ToolIndexEntry[]>;

  /**
   * 增量更新：新增工具时只索引新工具。
   */
  indexTool(tool: ToolDescriptor): Promise<ToolIndexEntry>;

  /**
   * 搜索：给定 query 文本，返回 top-K 匹配。
   */
  search(query: string, topK: number): Promise<{
    toolName: string;
    score: number;
  }[]>;
}
```

**embedding 提供者：** 复用现有的 `registerEmbeddingProvider`（`extensions/memory-lancedb` 已经有 embedding pipeline）。

#### 策略 2: LLM 动态路由（可选，高精度场景）

```
Tools schema + Intent → LLM few-shot → 推荐工具列表
→ 延迟: ~500ms (一次 LLM 调用)
→ 成本: ~500 input tokens
→ 适用: 工具数量多 (>50) 或意图模糊时
```

```typescript
const LLM_ROUTER_PROMPT = `你是一个工具路由器。给定用户意图和可用工具列表，返回最适合的工具名（最多 5 个）。

意图: {intent}
实体: {entities}
可用工具: {tool_names}

只返回 JSON: { "recommended": ["tool_a", "tool_b"], "reasoning": "..." }`;
```

**两种策略的选择逻辑：**

```typescript
function selectStrategy(params: {
  toolCount: number;
  intentConfidence: number;
  config: ToolRouterConfig;
}): "vector" | "llm" {
  if (params.toolCount <= 10) return "vector";          // 工具少，直接向量
  if (params.intentConfidence < 0.7) return "llm";      // 意图不清晰，用 LLM
  if (params.config.preferLLM) return "llm";
  return "vector";                                       // 默认向量
}
```

#### 策略 3: 规则增强

硬规则不受向量/LLM 结果影响，直接插入/排除：

```typescript
interface RouteRule {
  /** 触发条件 */
  when: {
    intent?: IntentType;
    role?: EduRole;
    entities?: { type: string; valuePattern: string }[];
  };
  /** 强制包含的工具 (name 或 pattern) */
  forceInclude: string[];
  /** 强制排除的工具 */
  forceExclude: string[];
  /** 提升权重的工具 (倍率) */
  boost: { toolName: string; multiplier: number }[];
}

const DEFAULT_ROUTE_RULES: RouteRule[] = [
  {
    // 数学问题强制包含 calculator 和 wolfram alpha
    when: { intent: "qa", entities: [{ type: "subject", valuePattern: "数学|math" }] },
    forceInclude: ["calculator", "wolfram_alpha"],
    forceExclude: [],
    boost: [{ toolName: "math_solver", multiplier: 2.0 }],
  },
  {
    // 学生身份强制排除系统命令
    when: { role: "student" },
    forceInclude: [],
    forceExclude: ["bash", "exec", "file_write", "file_delete", "system_config"],
    boost: [],
  },
  {
    // 紧急意图 → 短路到安全工具
    when: { intent: "emergency" },
    forceInclude: ["emergency_handler"],
    forceExclude: [],
    boost: [],
  },
];
```

### 2.4 扩展结构

```
extensions/tool-router/
├── package.json
├── merclaw.plugin.json
├── index.ts                    # 插件入口, 注册 before_prompt_build hook
├── src/
│   ├── types.ts                # RouteResult, RoutedTool 等
│   ├── tool-index.ts           # 工具 embedding 索引
│   ├── semantic-router.ts      # 语义路由核心
│   ├── route-rules.ts          # 规则引擎
│   ├── llm-router.ts           # LLM 动态路由
│   └── token-budget.ts         # Token 预算管理
└── test/
    ├── semantic-router.test.ts
    └── route-rules.test.ts
```

### 2.5 与现有代码对接

| 对接点 | 方式 |
|--------|------|
| `buildToolPlan` | 不修改。Router 先做语义排序，再调用 `buildToolPlan` 做可用性过滤 |
| `registerTool` | Hook `tool:registered` 事件 → 新工具注册时增量索引 |
| `before_prompt_build` | Router 在此 hook 运行 → 动态裁剪工具列表 → 注入 prompt |
| `memory-lancedb` | 复用 vector store 存储 tool embeddings |
| `registerEmbeddingProvider` | 复用已有 embedding pipeline |

### 2.6 工具描述 Token 预算管理

核心价值：Agent prompt 中的工具描述占据大量 token。Router 通过截断减少浪费。

```typescript
interface TokenBudget {
  /** 工具描述的总 token 预算 */
  maxToolTokens: number;       // 默认 2000 tokens
  /** 当前实际使用 */
  usedTokens: number;
  /** 截断策略 */
  truncation: "top_k" | "threshold" | "adaptive";

  /**
   * 给定 ranked tools，在预算内尽可能多地放入。
   * 返回截断后的工具列表 + 被裁剪的工具名列表。
   */
  fitToBudget(ranked: RoutedTool[]): {
    included: RoutedTool[];
    excluded: string[];
    budgetUsed: number;
    budgetTotal: number;
  };
}
```

**配置：**

```yaml
toolRouter:
  strategy: "vector"           # "vector" | "llm" | "hybrid"
  topK: 15                     # 语义检索返回 top-K 个
  maxToolTokens: 2000          # 注入 prompt 的工具描述最大 token 数
  minInclude: 5                # 始终包含至少 N 个工具（安全网）
  reindexOnStartup: true       # 启动时重建索引
  rules: []                    # 用户自定义路由规则
```

---

## 三、调度系统 (Task Scheduler)

### 3.1 定位

调度系统位于 Tool Router 和 TaskOrchestrator 之间：

```
SemanticToolRouter → 推荐工具列表
       │
       ▼
TaskScheduler       → 决定：哪个先执行？并行几个？资源够吗？
       │
       ▼
TaskOrchestrator    → 执行调度决策
```

### 3.2 调度策略

```typescript
interface SchedulingPolicy {
  /** 优先级排序 */
  priority: {
    /** 基础优先级来源 */
    source: "intent_urgency" | "dependency_depth" | "tool_cost" | "user_defined";
    /** user_defined 时的自定义映射 */
    customPriorities?: Record<string, number>;
  };

  /** 并发控制 */
  concurrency: {
    maxParallel: number;           // 全局最大并行数
    maxPerCategory: Record<ToolCategory, number>;  // 每类工具的最大并行数
    maxPerSession: number;         // 每会话最大并行数
  };

  /** 资源限制 */
  resources: {
    maxTokensPerMinute: number;    // Token 消耗速率限制
    maxLLMCallsPerMinute: number;  // LLM 调用频率限制
    maxFileOperations: number;     // 文件操作并发限制
  };

  /** 依赖感知 */
  dependencyAware: boolean;        // 是否等依赖完成（默认 true）
  allowOptimistic: boolean;        // 是否允许乐观执行（依赖未完全确认时）

  /** 抢占 */
  preemption: {
    enabled: boolean;
    /** 哪些优先级可以抢占正在执行的低优先级任务 */
    preemptThreshold: number;      // priority > threshold 的任务可以抢占
  };
}
```

### 3.3 优先级计算

```
FinalPriority = BasePriority × UrgencyMultiplier × CostMultiplier

BasePriority:
  intent = "emergency"  → 10
  intent = "command"    → 6
  intent = "qa"         → 5
  intent = "query"      → 4
  intent = "creative"   → 3
  intent = "chat"       → 2

UrgencyMultiplier:
  用户说了"快/马上/立刻" → 1.5
  默认                  → 1.0
  用户说了"等会儿/不急"  → 0.5

CostMultiplier:
  低成本工具 (内存操作)   → 1.2  (先跑快的)
  中成本工具 (搜索/LLM)   → 1.0
  高成本工具 (长时间计算) → 0.8  (后跑慢的)
```

### 3.4 调度器实现

```typescript
interface TaskScheduler {
  /**
   * 提交一批工具调用计划。
   * 返回执行顺序（可能被重排）。
   */
  schedule(params: {
    tools: { toolName: string; params: Record<string, unknown>; estimatedCost: number }[];
    policy: SchedulingPolicy;
    sessionKey: string;
    orchestrationPlanId?: string;
  }): ScheduledExecution;

  /**
   * 抢占式插入：高优先级任务可以插队
   */
  preempt(params: {
    toolName: string;
    params: Record<string, unknown>;
    priority: number;
  }): { accepted: boolean; position: number; reason?: string };

  /**
   * 获取当前队列状态
   */
  getQueueStatus(sessionKey: string): QueueStatus;
}

interface ScheduledExecution {
  /** 执行批次（每批可并行） */
  batches: ToolExecutionBatch[];
  /** 总预估耗时 */
  estimatedTotalMs: number;
  /** 排队的任务（等待资源释放） */
  queued: string[];
}

interface ToolExecutionBatch {
  /** 本批次可并行执行的工具 */
  tools: string[];                          // tool names
  /** 批次优先级 */
  priority: number;
  /** 预估耗时 (取本批次最长的) */
  estimatedMs: number;
  /** 依赖的前序批次 */
  dependsOnBatch: number[];                 // batch indices
}

interface QueueStatus {
  active: { toolName: string; runningForMs: number }[];
  queued: { toolName: string; position: number; priority: number }[];
  completed: { toolName: string; result: string; tookMs: number }[];
  resources: {
    tokensUsedThisMinute: number;
    llmCallsUsedThisMinute: number;
    fileOpsActive: number;
  };
}
```

### 3.5 与 TaskOrchestrator 的分工

| 职责 | TaskScheduler | TaskOrchestrator |
|------|:---:|:---:|
| 输入 | 路由后的工具列表 | TaskPlan (subtask DAG) |
| 调度粒度 | 单个 tool call | 单个 subtask (可能多个 tool call) |
| 依赖处理 | tool 间的简单依赖 | subtask 间的复杂 DAG 依赖 |
| 优先级 | 每 tool 动态计算 | 每 subtask 继承 plan 优先级 |
| 资源控制 | Token/LLM 调用/文件并发 | 并发 subtask 数量 |
| 输出 | ScheduledExecution (batches) | 执行 → WorkingMemory 更新 |

**分层关系：**
```
TaskOrchestrator ("这个 subtask 可以跑了")
    │
    ▼
TaskScheduler ("先调 search_knowledge_points, 等结果回来再调 math_solver")
    │
    ▼
Agent LLM (实际调用 tool)
```

---

## 四、端到端工具调用流

```
User: "帮我解这道二次函数题: y = x² + 2x + 1，求顶点坐标"
       │
       ▼
IntentClassifier → { intent: "qa", subject: "math", entities: ["二次函数", "顶点坐标"] }
       │
       ▼
SemanticToolRouter
  ├── 向量检索: query="二次函数 顶点坐标 求解"
  │     → math_solver (0.92), knowledge_math (0.85), calculator (0.72)
  ├── 规则增强: subject=math → boost math_solver ×2.0
  ├── 可用性: buildToolPlan → 全部可用
  └── 截断: top-5 → [math_solver, knowledge_math, calculator, wolfram_alpha, step_by_step]
       │
       ▼
SafetyGuard.before_tool
  ├── 角色: student
  ├── math_solver: safe ✅
  ├── knowledge_math: safe ✅
  └── calculator: safe ✅
       │
       ▼
Agent LLM (带工具列表 + working_memory + 用户问题)
  推理: "用 math_solver 计算顶点坐标"
  调用: math_solver({expression: "y = x² + 2x + 1", find: "vertex"})
       │
       ▼
SafetyGuard.after_tool
  └── 输出检查: 数学结果，安全 ✅
       │
       ▼
Agent: "二次函数 y = x² + 2x + 1 的顶点坐标是 **(-1, 0)**。
       推导过程：配方 y = (x+1)²，所以顶点在 x=-1, y=0 处。"
```

---

## 五、配置汇总

```yaml
# merclaw.json 中的相关配置块
plugins:
  entries:
    tool-router:
      enabled: true
      strategy: "vector"
      topK: 15
      maxToolTokens: 2000
      minInclude: 5
      reindexOnStartup: true
      rules: []

  task-scheduler:
      enabled: true
      concurrency:
        maxParallel: 3
        maxPerSession: 2
      resources:
        maxTokensPerMinute: 100000
        maxLLMCallsPerMinute: 20
      preemption:
        enabled: true
        preemptThreshold: 8
```

---

## 六、扩展结构总览

```
extensions/
├── tool-router/               ← 本周设计：语义工具路由
│   ├── index.ts
│   └── src/
│       ├── semantic-router.ts
│       ├── tool-index.ts
│       ├── route-rules.ts
│       ├── llm-router.ts
│       └── token-budget.ts
│
├── task-scheduler/            ← 本周设计：调度系统
│   ├── index.ts
│   └── src/
│       ├── scheduler.ts
│       ├── priority.ts
│       ├── concurrency.ts
│       └── resource-limiter.ts
│
├── task-orchestrator/         ← 本周设计：任务编排引擎
│   ├── index.ts
│   └── src/
│       ├── dependency-resolver.ts
│       ├── execution-engine.ts
│       ├── scheduler.ts
│       ├── recovery.ts
│       └── progress-reporter.ts
│
├── safety-guard/              ← 本周设计：安全规则引擎
│   ├── index.ts
│   └── src/
│       ├── rule-evaluator.ts
│       ├── builtin-rules.ts
│       ├── content-filter.ts
│       ├── rate-limiter.ts
│       └── audit-logger.ts
│
├── working-memory/            ✅ Day 2-3 已实现
├── intent-classifier/         ✅ Day 2-3 已实现
├── memory-router/             ✅ Day 2-3 已实现
└── education-auth/            ✅ Phase 0 已完成
```

---

## 七、待定设计决策

| # | 决策 | 选项 | 推荐 |
|---|------|------|------|
| 1 | Tool embedding 用哪个模型？ | A) 复用 memory-lancedb 的 embedding / B) 专用轻量模型 | **A)** — 工具描述短 (<200 chars)，不需要专用模型 |
| 2 | Tool Router 是 before_prompt_build 同步执行还是异步预热？ | A) 同步 / B) 异步(上次结果缓存) | **A)** — 同步简单，延迟 < 10ms |
| 3 | TaskScheduler 是否需要持久化队列？ | A) 内存队列 / B) SQLite 持久化 | **B)** — 与 WorkingMemory 一致，支持重启恢复 |
| 4 | 调度策略是否暴露为工具（Agent 可调）？ | A) 是 / B) 否，自动决策 | **A)** — 高级用户/管理员可能需要手动调度 |
