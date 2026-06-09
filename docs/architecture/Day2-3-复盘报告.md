# MerClaw Day 2-3 复盘报告

> 2026.06.08-09 | 产出：LLM/Agent Layer 设计 + 3 个扩展实现
> 本周目标：LLM/Agent Layer + Embodied Middleware 核心能力设计

---

## 一、完成项总览

| # | 任务 | 类型 | 状态 |
|---|------|------|------|
| 1 | 记忆系统分层架构设计 | 设计 | ✅ |
| 2 | 意图理解管线设计 | 设计 | ✅ |
| 3 | 任务分解器设计 | 设计 | ✅ |
| 4 | WorkingMemory 扩展代码 | 实现 | ✅ |
| 5 | IntentClassifier 扩展代码 | 实现 | ✅ |
| 6 | MemoryRouter 扩展代码 | 实现 | ✅ |
| 7 | docs/architecture/01-llm-agent-layer.md | 文档 | ✅ |
| 8 | 代码 Push GitHub | 交付 | ✅ |

**总代码量：** 设计文档 510 行 + 实现代码 2371 行 = **2881 行**

---

## 二、架构产出

### 2.1 LLM/Agent Layer 数据流

```
User Input
  → IntentClassifier (意图+实体, before_prompt_build hook)
    → TaskDecomposer (复杂任务→子任务DAG, 仅 command 意图)
      → WorkingMemory (存储目标+子任务栈+草稿)
        → MemoryRouter (统一搜索 vector/file/wiki 三路记忆)
          → Context Fusion → Agent LLM
```

### 2.2 三层记忆模型

```
短期记忆 → ContextEngine (已有, 复用)
工作记忆 → WorkingMemory (新建, 今日完成) ← 核心缺失, 已补齐
长期记忆 → LanceDB + MEMORY.md + Wiki (已有, MemoryRouter 统一入口)
```

### 2.3 与现有代码的对接

所有新功能都以 `extensions/` 开发，零 `src/` 核心改动：

| 新模块 | 对接方式 |
|--------|---------|
| WorkingMemory | `registerSessionExtension` + `registerTool` + `before_prompt_build` hook |
| IntentClassifier | `before_prompt_build` hook, 复用 LLM 子系统 |
| MemoryRouter | `registerTool`, 调用现有 memory_recall/memory_search/wiki_search |

---

## 三、关键决策

| # | 决策 | 理由 |
|---|------|------|
| 1 | 意图分类用 LLM Few-Shot 而非规则引擎 | 中文语义复杂，规则维护成本高；F-S prompt ~500 tokens，成本极低 |
| 2 | 单次 LLM 调用同时分类+抽实体 | 减少延迟，避免两次串行调用 |
| 3 | WorkingMemory 用 SQLite 而非纯内存 | 支持会话恢复（Gateway 重启不丢任务状态） |
| 4 | Subtask 用 JSON 列而非独立表 | 子任务量小(<50)，整体读写，无需独立查询 |
| 5 | MemoryRouter 统一入口而非替代旧工具 | 旧工具保留给需要精确控制的场景，Router 做默认入口 |
| 6 | 紧急意图短路（不调 LLM） | 关键词匹配零延迟，安全场景不能等 LLM |

---

## 四、遇到的问题

| # | 问题 | 解决 |
|---|------|------|
| 1 | Day 2 设计文档写完后未 commit | 本次会话发现 `01-llm-agent-layer.md` 是 untracked，已补 commit + push |
| 2 | 项目路径不一致（Desktop vs Edge下载路径） | 确认最终路径为 `D:\Edge下载路径\merclaw-main\merclaw-main` |
| 3 | GitHub push 需确认 | 之前报告 push 可能被墙，本次 push 成功 |

---

## 五、工作量统计

| 日 | 实际耗时 | 产出 |
|----|---------|------|
| 周一（GAP 分析 + 环境） | ~3h | GAP-analysis.md, Day1-复盘报告.md |
| 周二（设计文档） | ~3h | 01-llm-agent-layer.md (510行) |
| 周二（代码实现） | ~4h | 3 个扩展，2371 行 |
| **累计** | **~10h** | **5 文件，2881 行** |

---

## 六、剩余任务（本周）

| 优先级 | 任务 | 原计划日 | 状态 |
|--------|------|---------|------|
| 🔴 高 | 工具路由 + 调度编排设计 | 周四 6/11 | ❌ |
| 🔴 高 | Embodied Middleware 设计（任务编排+安全引擎） | 周三 6/10 | ❌ 后移 |
| 🟡 中 | 架构总文档 + 新版 Roadmap | 周五 6/12 | ❌ |
| 🟢 低 | 工具路由代码实现 | — | 待设计完成后 |

> **说明：** 原计划周三做 Middleware 设计被周二提前结束的代码实现占据。建议周三补上 Middleware 设计 + 工具路由设计，周四写总文档。

---

## 七、下一步建议

1. **周三（明天）：** `02-embodied-middleware.md` — 任务编排引擎 + 安全规则引擎设计
2. **周四：** `03-tool-routing-scheduling.md` — 语义工具路由 + 调度策略设计  
3. **周五：** 总文档 `00-merclaw-os-overview.md` + `ROADMAP-v2.md`

---

> 注：本周全部产出为设计文档 + 扩展代码框架。Sprint 1 正式开发下周开始。
