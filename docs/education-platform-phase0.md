# K12 AI 教育机器人 — Phase 0 阶段性报告

> **项目**：基于 MerClaw 改造的 K12 全功能 AI 教育平台  
> **阶段**：Phase 0 — 用户系统、角色权限、多租户隔离  
> **日期**：2026-06-02  
> **状态**：✅ 完成

---

## 一、项目概述

将 MerClaw（开源个人 AI 助手）改造为面向 K12 中小学的 AI 教育机器人，支持单校/小机构本地部署。

**目标用户**：学生、教师、家长、管理员  
**核心原则**：插件化改造，尽可能不动 MerClaw 核心代码

---

## 二、Phase 0 交付内容

### 新建扩展：`extensions/education-auth/`

```
extensions/education-auth/
├── package.json              # 包定义
├── merclaw.plugin.json      # 插件清单 + 配置 schema
├── index.ts                  # 主入口（注册 tool/hook/route/service）
├── src/
│   ├── roles.ts              # 角色定义 + 权限矩阵
│   ├── schema.ts             # SQLite 建表语句
│   ├── db.ts                 # 数据库访问层
│   ├── rbac-middleware.ts    # 权限检查与访问控制
│   ├── tenant-resolver.ts    # 多租户（学校级）数据隔离
│   ├── user-registry.ts      # 用户/班级 CRUD
│   └── api.ts                # REST API 端点
└── skills/
    └── manage-users/SKILL.md  # 用户管理 AI 技能
```

### 2.1 角色与权限（`roles.ts`）

| 角色 | 权限数 | 典型权限 |
|------|--------|----------|
| **学生** (student) | 5 | AI 答疑、提交作业、查看成绩、参加测验 |
| **教师** (teacher) | 7 | 批改作业、创建作业、查看班级成绩、备课、出题 |
| **家长** (parent) | 2 | 查看子女学情、查看作业情况 |
| **管理员** (admin) | 18 | 全部权限 + 用户管理 + 班级管理 + 系统配置 |

### 2.2 数据库（`schema.ts` — SQLite）

5 张核心表，存储在 `<stateDir>/education/education.sqlite`：

| 表名 | 用途 |
|------|------|
| `edu_schools` | 学校基本信息 |
| `edu_users` | 用户（角色、年级、班级、渠道标识） |
| `edu_classes` | 班级（名称、年级、班主任） |
| `edu_enrollments` | 学生 ↔ 班级 多对多关系 |
| `edu_schema_meta` | 版本管理 |

### 2.3 访问控制（`rbac-middleware.ts`）

- **身份解析**：从聊天渠道发送者 ID 或认证令牌自动识别用户身份
- **权限校验**：`checkPermission(ctx, "homework:grade")` → allowed/denied
- **跨用户数据保护**：学生只能看自己的数据，家长只看关联子女，教师只看自己班级

### 2.4 REST API（`api.ts` — `/edu/*` 端点）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/edu/me` | 登录用户 | 获取当前用户身份 |
| GET | `/edu/users` | admin | 用户列表（可按角色/班级筛选） |
| GET | `/edu/users/:id` | admin | 用户详情 |
| POST | `/edu/users` | admin | 创建用户 |
| POST | `/edu/users/register` | 配置项 | 自助注册（可关闭） |
| DELETE | `/edu/users/:id` | admin | 软删除用户 |
| GET | `/edu/classes` | teacher/admin | 班级列表（含学生人数） |
| POST | `/edu/classes` | admin | 创建班级 |
| POST | `/edu/enrollments` | admin/teacher | 学生分班 |

### 2.5 AI 工具

| 工具 | 用途 |
|------|------|
| `lookup_edu_user` | 根据渠道 ID 查找教育用户身份 |
| `check_edu_permission` | 校验用户是否拥有某项权限 |

### 2.6 配置（`merclaw.json`）

```json5
{
  plugins: {
    entries: {
      "education-auth": {
        enabled: true,
        schoolId: "school-001",
        schoolName: "阳光小学",
        authMode: "phone",          // "phone" | "username" | "sso"
        allowSelfRegistration: false,
        defaultRole: "student"
      }
    }
  }
}
```

---

## 三、技术特点

| 特性 | 实现方式 |
|------|----------|
| **零核心侵入** | 全部通过 `registerHook` / `registerHttpRoute` / `registerTool` / `registerService` 实现，未修改 `src/` 任何代码 |
| **多租户隔离** | `TenantScope` 封装所有查询，自动添加 `WHERE school_id = ?` |
| **本地优先** | SQLite 数据库，无需外部依赖 |
| **软删除** | 用户停用标记，数据可恢复 |
| **可配置性** | 通过 `merclaw.plugin.json` 的 configSchema 暴露所有关键选项 |

---

## 四、后续规划

| 阶段 | 内容 | 预估工作量 |
|------|------|------------|
| **Phase 1** | 知识点图谱 + 贝叶斯知识追踪 | 核心模型 |
| **Phase 2** | 学生端：拍照答疑、分步讲解、自适应辅导 | 交互引擎 |
| **Phase 3** | 教师端：备课、出题、批改、学情报告 | 工具集 |
| **Phase 4** | 界面：学生聊天 / 教师工作台 / 家长门户 | 前端 UI |
| **Phase 5** | 部署：Docker 一键部署 + 内容安全 + 本地化 | 生产就绪 |

---

## 五、如何启用

1. 在 `merclaw.json` 中添加 education-auth 插件配置
2. 通过 API 创建学校和管理员：
```bash
curl -X POST http://localhost:18789/edu/users \
  -H "Content-Type: application/json" \
  -d '{"role":"admin","display_name":"管理员张老师","channel_id":"whatsapp:+8613800138000"}'
```
3. 管理员可通过 API 或 `manage-users` 技能批量导入师生
4. 学生在支持的聊天渠道（微信/QQ/WhatsApp）发送消息时自动识别身份
