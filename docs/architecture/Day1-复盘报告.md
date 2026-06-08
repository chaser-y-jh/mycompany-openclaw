# MerClaw Day 1 复盘报告

> 2026.06.08（周一）| 产出：架构 GAP 分析
> 本周目标：LLM/Agent Layer + Embodied Middleware 核心能力设计

---

## 一、今日完成项

| # | 任务 | 结果 |
|---|------|------|
| 1 | 项目环境恢复 | ✅ 本地副本就绪，无需 re-clone |
| 2 | 核心源码走读 | ✅ gateway → plugin → hook → tool/context-engine 链路清晰 |
| 3 | GAP 分析文档 | ✅ `docs/architecture/GAP-analysis.md` 218 行 |
| 4 | 代码提交 | ✅ 本地 commit，⚠️ push 待翻墙 |

---

## 二、核心发现

### 2.1 MerClaw 现有资产盘点

| 模块 | 位置 | 当前用途 | 与新架构关系 |
|------|------|---------|-------------|
| Plugin 注册框架 | `src/plugins/` (3200+ 行) | 统一扩展机制 | ✅ 核心基础设施，所有新功能用 extension 开发 |
| ContextEngine | `src/context-engine/` | 上下文记忆引擎 | ✅ 记忆系统的好基座 |
| 记忆扩展集群 | memory-core/lancedb/wiki/active-memory | 向量记忆、Wiki 记忆 | ✅ 记忆系统有 60% 基础 |
| Tool 系统 | `src/tools/planner.ts` | 工具注册/发现/可用性过滤 | 🟡 缺语义路由 |
| Task 系统 | `src/tasks/` | 后台任务管理 | 🟡 缺 LLM 驱动的子任务分解 |
| education-auth | `extensions/education-auth/` | RBAC 权限 + 多租户 | 🟡 有角色权限，缺操作级安全 |

### 2.2 能力缺口一图看清

```
意图理解 ─── 🔴 0%  从零设计
任务分解 ─── 🔴 10% 从零设计（task 系统太底层）
工具路由 ─── 🟡 50% 有工具注册，缺语义智能匹配
记忆系统 ─── 🟡 60% 有引擎+向量库，缺分层架构
安全校验 ─── 🟡 25% 有 RBAC，缺操作级规则
任务编排 ─── 🔴 10% 从零设计
```

---

## 三、架构理解

### 3.1 MerClaw 的消息→执行全链路

```
Channel(WhatsApp/Telegram)
  → Gateway (消息流入)
    → Hook 管线 (before_turn → edu_auth 注入身份 → ...)
      → Agent 处理
        → LLM 推理
        → Tool 调用 (tool planner → 可用性过滤 → 执行)
        → ContextEngine (ingest/assemble 记忆)
      → Hook 管线 (after_turn → 记录 → ...)
  → Channel (回复用户)
```

### 3.2 新架构的切入位置

基于最小改动原则，新能力应该这样插入：

```
┌─ LLM/Agent Layer ───────────────────────┐
│                                          │
│  [意图理解] → [任务分解] → [记忆检索]      │
│      ↓             ↓            ↓        │
│  Hook: before_turn   Agent: subtask    ContextEngine.assemble
│                                          │
├─ Embodied Middleware ────────────────────┤
│                                          │
│  [任务编排] → [安全校验] → [闭环评估接口]   │
│      ↓            ↓            ↓         │
│  Task executor  Hook: before_tool  VLAC callback(interface only)
│                                          │
└──────────────────────────────────────────┘
```

---

## 四、阻塞项 / 待确认

| # | 问题 | 影响 | 状态 |
|---|------|------|------|
| 1 | GitHub push 不通（墙） | 无法同步到远程仓库 | ⚠️ 需翻墙 |
| 2 | 机器人平台未定 | 不影响本周（只做纯软件） | 🟢 不阻塞 |
| 3 | Phase 0 旧计划 vs 新架构的关系 | Vincent 还没正式确认停止旧 Phase 1-5 | ⚠️ 待确认 |

---

## 五、明日计划（周二）

| # | 任务 | 产出 |
|---|------|------|
| 1 | **记忆系统分层设计** — 短期/长期/工作记忆三层架构 + API 设计 | `01-memory-system.md` |
| 2 | **意图理解管线设计** — 输入→意图分类→实体抽取→上下文融合 | `02-intent-task-decomposition.md`（前半） |
| 3 | **接口对齐** — 记忆系统如何对接 ContextEngine，意图如何对接 Hook | 设计文档内交叉引用 |

---

## 六、工作量评估（本周）

| 日 | 主题 | 难度 | 预计耗时 |
|----|------|------|---------|
| 周一 ✅ | GAP 分析 | ⭐⭐ | 3h |
| 周二 | 记忆系统 + 意图理解 | ⭐⭐⭐ | 4h |
| 周三 | 任务分解 + 编排 + 安全 | ⭐⭐⭐⭐ | 5h |
| 周四 | 工具路由 + 调度 | ⭐⭐⭐ | 4h |
| 周五 | 汇总总文档 + Roadmap | ⭐⭐ | 3h |

---

> 注：本周全部产出是 **设计文档**，不写代码。设计做完后下周进入 Sprint 1 开发。
