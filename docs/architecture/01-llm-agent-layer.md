# MerClaw LLM/Agent Layer 设计

> Day 2 产出 | 2026-06-09
> 范围：记忆系统分层架构 + 意图理解管线 + 任务分解器
> 对接 Vincent 架构图中的 LLM/Agent Layer：意图理解 / 任务分解 / 记忆 / 工具路由

---

## 一、设计原则

1. **扩展优先，核心零改动**：所有新功能以 `extensions/` 开发，复用现有 Plugin API
2. **对接现有基础设施**：ContextEngine、Hook 管线、Tool 系统全部复用
3. **渐进式**：每一层可独立开发、独立测试、独立部署
4. **纯软件**：不依赖任何硬件/传感器

---

## 二、记忆系统分层架构

### 2.1 三层记忆模型

```
┌──────────────────────────────────────────────────┐
│              短期记忆 (Short-Term)                 │
│  对话上下文窗口、最近 N 轮对话                       │
│  实现：ContextEngine compact + 窗口管理器           │
│  生命周期：单次会话                                 │
├──────────────────────────────────────────────────┤
│              工作记忆 (Working Memory)             │
│  当前任务状态、子任务进度、中间结果、活跃目标          │
│  实现：NEW — 任务状态机 + scratchpad                │
│  生命周期：单次任务链                               │
├──────────────────────────────────────────────────┤
│              长期记忆 (Long-Term)                  │
│  用户画像、知识图谱、历史交互、偏好、知识点掌握度       │
│  实现：LanceDB 向量库 + MEMORY.md + Wiki            │
│  生命周期：永久                                     │
└──────────────────────────────────────────────────┘
```

### 2.2 各层详细设计

#### 2.2.1 短期记忆（复用 ContextEngine + compact）

**现状：** ContextEngine 的 `assemble()` 方法已经管理上下文窗口。`compact()` 方法处理 token 超限时的压缩。

**设计：** 在现有 ContextEngine 上封装一层策略控制。

```
ShortTermMemoryManager
├── windowSize: number (token 上限)
├── compactionThreshold: number (触发压缩的百分比)
├── getContext(sessionKey) → AssembleResult
├── appendMessage(sessionKey, message)
└── summarize(sessionKey) → 压缩后摘要
```

**与现有代码对接：**
- 直接调用 ContextEngine.assemble({ messages, tokenBudget })
- 直接调用 ContextEngine.compact({ sessionKey })
- 不新建 extension，只是对现有接口的封装

**配置项：**
```yaml
memory:
  shortTerm:
    maxTokens: 8000        # 窗口上限
    compactionRatio: 0.75  # 达到 75% 时触发压缩
    retainRecentTurns: 3   # 压缩后保留最近 N 轮
```

#### 2.2.2 工作记忆（新建 `extensions/working-memory/`）

**这是现有系统缺失的关键层。** 工作记忆追踪 Agent 当前正在做什么。

```
WorkingMemory
├── taskId: string
├── currentGoal: string
├── subtaskStack: Subtask[]      # 子任务调用栈
├── scratchpad: string           # 草稿/中间计算结果
├── activeEntities: Set<string>  # 当前关注的实体
├── pendingDecisions: Decision[] # 待确认的决策
└── contextSnapshot: object      # 上次中断时的上下文快照
```

**API 设计：**

```typescript
interface WorkingMemoryManager {
  // 任务状态
  setGoal(goal: string): void;
  pushSubtask(subtask: Subtask): void;
  popSubtask(): Subtask | undefined;
  getCurrentSubtask(): Subtask | undefined;

  // 草稿区
  writeScratchpad(content: string): void;
  readScratchpad(): string;
  clearScratchpad(): void;

  // 实体追踪
  trackEntity(entity: string): void;
  forgetEntity(entity: string): void;
  getActiveEntities(): string[];

  // 决策追迹
  recordDecision(decision: Decision): void;
  getPendingDecisions(): Decision[];

  // 序列化（支持会话恢复）
  serialize(): WorkingMemorySnapshot;
  deserialize(snapshot: WorkingMemorySnapshot): void;
}

interface Subtask {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  parentId?: string;
  result?: string;
}

interface Decision {
  id: string;
  question: string;
  options: string[];
  selectedOption?: string;
  timestamp: number;
}
```

**注册方式：**
```typescript
// extensions/working-memory/index.ts
export default definePluginEntry({
  id: "working-memory",
  name: "Working Memory",
  register(api) {
    // 注册为 session extension，每个会话一个实例
    api.registerSessionExtension({
      namespace: "working-memory",
      description: "Task working memory tracker",
      project: (session) => ({
        manager: new WorkingMemoryManager(session.sessionKey)
      }),
      cleanup: (session) => {
        session.manager.persist();
      }
    });

    // 注册工具供 Agent 使用
    api.registerTool({
      name: "working_memory_get",
      description: "Get current working memory state (goal, subtasks, scratchpad)",
      parameters: { type: "object", properties: {} },
      execute: async (_id, _params, ctx) => {
        const wm = getWorkingMemory(ctx.sessionKey);
        return wm.serialize();
      }
    });

    api.registerTool({
      name: "working_memory_update",
      description: "Update working memory — set goal, push subtask, write scratchpad",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["setGoal", "pushSubtask", "completeSubtask", "writeScratchpad", "recordDecision"] },
          data: { type: "object" }
        }
      },
      execute: async (_id, params, ctx) => {
        // dispatch to appropriate method
      }
    });
  }
});
```

**数据存储：** 使用 SQLite（已有 `extensions/education-auth` 的 db 模式），按 sessionKey 索引。

#### 2.2.3 长期记忆（增强现有，不改架构）

**现有资产充足，不需要大改。** 用配置文件统一调度：

```
LongTermMemory
├── Vector Memory (memory-lancedb)
│   ├── memory_recall — 语义检索
│   ├── memory_store — 自动/手动存储
│   └── memory_forget — GDPR 删除
│
├── File Memory (memory-core)
│   ├── MEMORY.md — 根记忆文件
│   ├── memory/*.md — 分类记忆文件
│   └── memory_search / memory_get
│
├── Knowledge Base (memory-wiki)
│   ├── wiki_search / wiki_get
│   └── wiki_apply — 结构化知识写入
│
└── Active Recall (active-memory)
    └── before_prompt_build → 子 Agent 检索 → 注入上下文
```

**新增能力：MemoryRouter — 统一的记忆查询入口**

```typescript
// 对现有 memory_search/memory_recall/wiki_search 的统一封装
interface MemoryRouter {
  search(params: {
    query: string;
    sources: ("vector" | "file" | "wiki")[];
    maxResults: number;
  }): Promise<UnifiedMemoryHit[]>;
}

interface UnifiedMemoryHit {
  source: "vector" | "file" | "wiki";
  content: string;
  relevance: number;
  metadata: {
    path?: string;
    category?: string;
    timestamp?: number;
  };
}
```

**为什么需要 MemoryRouter：** 现有三个 memory 源各自有各自的搜索工具，Agent 需要知道调用哪个。MemoryRouter 提供一个统一入口，内部做多路召回 + 结果合并。

### 2.3 记忆系统集成架构

```
Agent Prompt Builder
       │
       ├── before_prompt_build hook
       │   ├── 1. WorkingMemory → 注入当前任务状态
       │   ├── 2. active-memory → 注入相关历史记忆
       │   └── 3. ShortTermMemory → 注入最近的对话上下文
       │
       ▼
   最终 Prompt
       │
       ▼
    LLM 推理
       │
       ▼
   after_turn / agent_end hook
       ├── 1. WorkingMemory → 更新子任务状态
       ├── 2. memory-lancedb auto-capture → 重要信息入库
       └── 3. ShortTermMemory → compact（如需要）
```

---

## 三、意图理解管线

### 3.1 整体流程

```
User Input
    │
    ▼
┌─────────────┐
│ 预处理       │  语言检测、输入清洗、敏感内容过滤
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 意图分类     │  问答 / 操作 / 查询 / 创作 / 闲聊 / 紧急
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 实体抽取     │  科目、年级、知识点、对象、人名、时间
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 上下文融合   │  记忆检索 → 用户画像 → 当前会话 → 融合
└──────┬──────┘
       │
       ▼
  Enriched Message → Agent
```

### 3.2 意图分类器设计

#### 方式：LLM Few-Shot Prompt（不需要训练模型）

```
你是意图分类器。给定用户输入，输出 JSON：

意图类型：qa(问答) | command(操作指令) | query(信息查询) | creative(创作) | chat(闲聊) | emergency(紧急)

示例：
"帮我解这道二次函数题" → {"intent": "qa", "subject": "math", "confidence": 0.95}
"打开客厅的灯"        → {"intent": "command", "target": "smart_home", "confidence": 0.90}
"今天有哪些作业"       → {"intent": "query", "subject": "homework", "confidence": 0.92}

现在分类：
"{user_input}"
```

**设计决策：**
- 用 **LLM few-shot** 而非规则引擎 —— 中文语义复杂，规则维护成本高
- 分类 prompt 约 500 tokens，每次调用成本极低
- 意图标签影响后续工具路由决策
- 如果意图是 `emergency`，直接短路到安全处理流程

#### 实现：`extensions/intent-classifier/`

```typescript
interface IntentResult {
  intent: "qa" | "command" | "query" | "creative" | "chat" | "emergency";
  subject?: string;      // 学科/领域
  confidence: number;    // 0-1
  entities: Entity[];
}

interface Entity {
  type: "subject" | "grade" | "knowledge_point" | "object" | "person" | "time" | "location";
  value: string;
  confidence: number;
}
```

**Hook 注入点：** `before_prompt_build`

```typescript
api.on("before_prompt_build", async (event) => {
  const intent = await classifyIntent(event.prompt);
  return {
    prependSystemContext: `<intent>
  type: ${intent.intent}
  subject: ${intent.subject || "unknown"}
  confidence: ${intent.confidence}
</intent>`
  };
});
```

### 3.3 实体抽取

**与意图分类共用同一个 LLM 调用，减少延迟。** 在分类 prompt 中同时要求返回实体列表。

对于教育场景，实体类型：
| 类型 | 示例 |
|------|------|
| subject | 数学、英语、物理 |
| grade | 三年级、初二、高一 |
| knowledge_point | 二次函数、牛顿定律 |
| object | 第5题、作业、试卷 |
| person | 李老师、小明 |
| time | 下周、明天下午 |

**对接 education-auth：** 实体中的 `person` 可以查已有用户系统进行身份确认。

### 3.4 上下文融合

意图和实体拿到后，调用记忆系统补充上下文：

```
Intent + Entities
    │
    ├── LongTermMemory.search(query=entities)  → 相关知识/历史
    ├── WorkingMemory.get()                     → 当前任务状态
    └── education-auth.lookup(user)             → 用户身份+角色
    │
    ▼
Enriched Context → 注入 Agent Prompt
```

---

## 四、任务分解器

### 4.1 触发条件

仅当意图分类结果满足以下条件之一时触发：
1. `intent = "command"` 且涉及多步骤（如"帮我备课第二章"）
2. 用户输入超过 200 字（可能是复杂任务）
3. Agent 自主决定需要分解（通过工具调用）

### 4.2 分解策略

```
Complex Task
    │
    ▼
┌──────────────┐
│ LLM Decompose │  "把这个任务拆成3-7个子步骤"
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Dependency    │  分析子任务依赖关系 → DAG
│ Graph Builder │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Working       │  推入 WorkingMemory.subtaskStack
│ Memory Push   │
└──────────────┘
```

### 4.3 数据结构

```typescript
interface TaskPlan {
  id: string;
  goal: string;                    // 原始任务描述
  subtasks: SubtaskNode[];
  dependencies: Dependency[];      // 子任务间的依赖边
  estimatedComplexity: number;     // 1-10
}

interface SubtaskNode {
  id: string;
  description: string;
  status: "pending" | "ready" | "in_progress" | "completed" | "blocked";
  assignedTools: string[];         // 推荐的工具
  expectedOutput: string;          // 预期产出描述
  maxRetries: number;
}

interface Dependency {
  from: string;  // subtask id
  to: string;    // subtask id
  type: "requires_result" | "requires_approval" | "preferred_order";
}
```

**关键设计：** 任务分解器的输出不进 Agent prompt，而是进 WorkingMemory。这样 Agent 不会在每轮对话看到整个 Plan，只在需要时通过 `working_memory_get` 工具查询。

---

## 五、与现有代码对接总结

```
新模块                  形态              对接点
─────────────────────────────────────────────────────
WorkingMemory           extension/new     SessionExtension slot
IntentClassifier        extension/new     before_prompt_build hook
EntityExtractor         extension/new     复用 IntentClassifier LLM 调用
MemoryRouter            extension/new     memory_search + memory_recall 统一包装
TaskDecomposer          extension/new     WorkingMemory 的消费者
ShortTermMemoryManager  src/ 封装          ContextEngine.assemble/compact

无需修改：
✅ src/gateway/          — hook 管线已有 before_prompt_build
✅ src/context-engine/   — 接口不变
✅ src/plugins/          — Plugin API 不变
✅ extensions/memory-*   — 不修改现有扩展
```

---

## 六、数据流全景

```
                     ┌─────────────┐
                     │  User Input  │
                     └──────┬──────┘
                            │
                     ┌──────▼──────┐
                     │ Intent      │
                     │ Classifier  │  → intent + entities
                     └──────┬──────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        Intent !=      Intent =      Intent =
        command       command        emergency
              │             │             │
              ▼             ▼             ▼
        直接回复      TaskDecomposer   安全短路
              │             │
              │      ┌──────▼──────┐
              │      │ Subtask DAG │ → WorkingMemory
              │      └──────┬──────┘
              │             │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │ MemoryRouter │ → 多路记忆检索
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │ Context      │ → 融合后注入 prompt
              │ Fusion       │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │ Agent LLM    │
              │ (含丰富上下文) │
              └──────────────┘
```

---

## 七、下一步

周三设计的 **Embodied Middleware** 将对接：
- TaskDecomposer 的输出 → 任务编排引擎的输入
- 安全校验规则 → 嵌入到 TaskDecomposer 的 DAG 节点中
- VLAC 闭环接口设计 → 为任务执行结果提供评估回调
