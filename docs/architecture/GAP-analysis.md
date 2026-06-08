# MerClaw 具身智能操作系统 — GAP 分析

> Day 1 产出 | 2026-06-08
> 目标：对照 Vincent 架构图，梳理现有代码库存量，找出缺口

---

## 一、目标架构（5 层）

```
┌──────────────────────────────────────────────────────┐
│  LLM/Agent Layer                                     │
│  意图理解 / 任务分解 / 记忆 / 工具路由                  │
├──────────────────────────────────────────────────────┤
│  Embodied Middleware                                 │
│  任务规划 / VLAC闭环评估 / 安全校验                     │
├──────────────────────────────────────────────────────┤
│  Robot Abstraction Layer (HAL)                       │  ← 硬件，实习生不碰
│  统一关节/电机/传感器接口                              │
├──────────────────────────────────────────────────────┤
│  Perception + Actuation                              │  ← 硬件，实习生不碰
│  视觉/SLAM/抓取/底盘控制 / MuJoCo/Isaac Sim           │
├──────────────────────────────────────────────────────┤
│  Physical Robot / Simulation                         │  ← 硬件，实习生不碰
└──────────────────────────────────────────────────────┘
```

**实习生范围：** LLM/Agent Layer + Embodied Middleware（纯软件部分）

---

## 二、现有代码库资产盘点

### 2.1 核心架构（`src/`）

| 模块 | 路径 | 用途 | 目标架构映射 |
|------|------|------|-------------|
| **gateway** | `src/gateway/` | 消息网关，HTTP Server，消息流入管线 | 基础设施 |
| **plugins** | `src/plugins/` | 插件注册表（3200+ 行），统一扩展机制 | 核心框架 |
| **agents** | `src/agents/` | Agent 运行时，tool 执行，compaction，bootstrap | LLM/Agent Layer |
| **memory** | `src/memory/` | ROOT_MEMORY 文件管理 | 记忆系统（文件层） |
| **context-engine** | `src/context-engine/` | ContextEngine 接口（ingest/assemble/compact/maintain...） | 记忆系统（引擎层） |
| **tools** | `src/tools/` | Tool 描述符、可用性评估、计划构建（buildToolPlan） | 工具路由 |
| **tasks** | `src/tasks/` | 任务注册、执行、状态管理、task-flow | 调度系统 |
| **hooks** | `src/hooks/` | 消息拦截管线（before_turn, after_turn 等） | 中间件管线 |
| **routing** | `src/routing/` | 会话路由、账户绑定 | 基础设施 |
| **sessions** | `src/sessions/` | 会话管理 | 基础设施 |
| **skills** | `src/skills/` | Skill 系统 | Agent 能力 |
| **llm** | `src/llm/` | LLM 调用封装 | LLM/Agent Layer |
| **channels** | `src/channels/` | 渠道插件（WhatsApp/Telegram/Discord 等） | 基础设施 |
| **flows** | `src/flows/` | 设置向导、健康检查 | 基础设施 |

### 2.2 记忆系统（Memory Extensions）

| 扩展 | 路径 | 能力 |
|------|------|------|
| **memory-core** | `extensions/memory-core/` | 核心记忆能力（Capability + Prompt Section + Flush Plan） |
| **memory-lancedb** | `extensions/memory-lancedb/` | LanceDB 向量数据库后端 |
| **memory-wiki** | `extensions/memory-wiki/` | Wiki 风格记忆 |
| **active-memory** | `extensions/active-memory/` | 活跃记忆管理 |

记忆系统已有 **插件化架构**，支持：
- `registerMemoryCapability` — 注册记忆能力
- `registerMemoryPromptSection` — 注入记忆提示段
- `registerMemoryPromptSupplement` — 补充提示
- `registerMemoryCorpusSupplement` — 补充语料
- `registerMemoryFlushPlan` — 记忆清理策略
- `registerMemoryRuntime` — 记忆运行时
- `registerMemoryEmbeddingProvider` — 嵌入向量提供者

### 2.3 ContextEngine 接口

```typescript
interface ContextEngine {
  info: { id, name }
  bootstrap(params) → BootstrapResult
  maintain(params) → MaintenanceResult
  ingest(params) → IngestResult
  ingestBatch(params) → IngestBatchResult
  afterTurn(params) → void
  assemble(params) → AssembleResult
  compact(params) → CompactResult
  prepareSubagentSpawn(params) → SubagentSpawnPreparation
  onSubagentEnded(params) → void
}
```

- ✅ 支持插件注册（`registerContextEngine`）
- ✅ 按 slot 选择引擎（`config.plugins.slots.contextEngine`）
- ✅ 故障自动 fallback 到默认引擎（quarantine 机制）

### 2.4 Phase 0 成果（education-auth）

| 文件 | 用途 |
|------|------|
| `edu_schools/edu_users/edu_classes/edu_enrollments` | 数据表 |
| `roles.ts` | student/teacher/parent/admin RBAC 矩阵 |
| `rbac-middleware.ts` | 权限拦截 |
| `tenant-resolver.ts` | 按 school_id 隔离 |
| `user-registry.ts` | 用户 CRUD |
| `api.ts` | `/edu/*` HTTP API |

已注册工具：
- `lookup_edu_user` — 身份查询
- `check_edu_permission` — 权限核验

Hook：
- `agent:before_turn` — 消息流入时注入 edu 身份上下文

### 2.5 Plugin 系统的注册能力

Plugin API 已支持的注册项（与目标架构相关）：

| 注册方法 | 用途 |
|---------|------|
| `registerTool` | 注册 Agent 工具 |
| `registerHook` | 注册消息管线 Hook |
| `registerHttpRoute` | 注册 HTTP 路由 |
| `registerChannel` | 注册消息渠道 |
| `registerProvider` | 注册 LLM 提供商 |
| `registerAgentHarness` | 注册 Agent 运行器 |
| `registerContextEngine` | 注册上下文引擎 |
| `registerMemoryCapability` | 注册记忆能力 |
| `registerMemoryRuntime` | 注册记忆运行时 |
| `registerCommand` | 注册 CLI 命令 |
| `registerSessionExtension` | 注册会话扩展 |
| `registerCompactionProvider` | 注册记忆压缩器 |
| `registerEmbeddingProvider` | 注册嵌入提供者 |
| `on` (typed hooks) | 注册类型化 Hook |

---

## 三、GAP 分析矩阵

### 3.1 LLM/Agent Layer

| 子模块 | 现有资产 | 完成度 | 缺口 |
|--------|---------|--------|------|
| **意图理解** | — | 0% | 🔴 完全缺失。需要设计意图分类器（prompt 工程 or 模型微调） |
| **任务分解** | `src/tasks/` 有 task-flow、task-executor | 20% | 🟡 task 系统侧重后台任务管理，缺少 LLM 驱动的复杂任务分解（subtask DAG） |
| **记忆系统** | memory-core/lancedb/wiki + ContextEngine | 60% | 🟡 记忆检索、记忆排序、记忆淘汰策略需加强；短期/长期/工作记忆的分层架构需设计 |
| **工具路由** | `src/tools/planner.ts`, plugin tool 注册 | 50% | 🟡 现有 tool planner 只做可用性过滤，缺少语义匹配路由（"意图→工具"的智能映射） |

### 3.2 Embodied Middleware

| 子模块 | 现有资产 | 完成度 | 缺口 |
|--------|---------|--------|------|
| **任务规划** | `buildToolPlan` 简单过滤 | 10% | 🔴 需要多步骤任务编排引擎（依赖排序、并行/串行、条件分支） |
| **VLAC 闭环** | — | 0% | 🟡 硬件相关，实习生只做接口设计。预留感知→评估→修正的回调接口 |
| **安全校验** | education-auth RBAC | 25% | 🟡 有用户级权限，缺少操作级安全规则（如：学生不能执行系统命令，危险操作需确认）。已有 `registerTrustedToolPolicy` 可扩展 |

### 3.3 Robot Abstraction Layer / Perception / Actuation

| 状态 | 说明 |
|------|------|
| 🔵 跳过 | 实习生不碰，正职做 |

---

## 四、核心差距总结

```
高优先级（LLM/Agent Layer，本周设计）：

  🔴 意图理解器        → 零基础，全新设计
  🔴 任务分解器        → 零基础，全新设计
  🟡 记忆系统增强      → 有基础(60%)，需分层设计
  🟡 语义工具路由      → 有基础(50%)，需智能匹配

中优先级（Embodied Middleware，本周设计）：

  🔴 任务编排引擎      → 零基础，全新设计
  🟡 安全规则引擎      → 有 RBAC 基础(25%)，需扩展

低优先级（硬件层）：

  🔵 HAL / Perception   → 不碰
```

---

## 五、复用评估

### 可以直接复用的

| 资产 | 理由 |
|------|------|
| Plugin 注册框架 | 所有新功能都用 `api.registerXxx()` 扩展，不改核心 |
| ContextEngine 接口 | 记忆系统可以直接对接，已支持 slot 选择和 quarantine |
| Hook 管线 | 意图理解、安全检查都可以用 hook 插入消息流 |
| Tool 系统 | 工具路由的底层机制（注册/发现/执行）已成熟 |
| education-auth RBAC | 安全校验层的角色权限基础 |

### 需要扩展的

| 资产 | 怎么改 |
|------|--------|
| `src/tools/planner.ts` | `buildToolPlan` 只做可用性过滤 → 加语义匹配路由 |
| ContextEngine | assemble 方法返回结构 => 增加记忆检索/排序 |
| Task 系统 | 现有 task-flow 是后台任务 → 加 LLM 驱动的 subtask 分解 |

### 需要新建的

| 模块 | 形式 |
|------|------|
| 意图理解 | `extensions/intent-classifier/` |
| 任务分解 | 扩展现有 `src/tasks/` 或新建 `extensions/task-decomposer/` |
| 任务编排 | `extensions/task-orchestrator/` |
| 安全规则引擎 | 扩展 `extensions/education-auth/` 或新建 `extensions/safety-guard/` |

---

## 六、下一步

- **周二**：设计 LLM/Agent Layer（记忆系统 + 意图理解 + 任务分解）
- **周三**：设计 Embodied Middleware（任务编排 + 安全校验）
- **周四**：设计工具路由 + 调度系统
- **周五**：汇总总架构文档 + 新版 Roadmap
