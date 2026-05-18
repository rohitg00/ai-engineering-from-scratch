# 顶点项目 —— 构建完整的工具生态系统

> Phase 13 教授了每个部分。这个顶点项目将它们连接成一个生产形态的系统：一个带有工具 + 资源 + 提示 + 任务 + UI 的 MCP 服务器，边缘 OAuth 2.1，RBAC 网关，多服务器客户端，A2A 子智能体调用，OTel 追踪到收集器，CI 中的工具投毒检测，以及 AGENTS.md + SKILL.md 包。到最后，你可以为每个架构选择辩护。

**类型：** Build
**语言：** Python（stdlib，端到端生态系统框架）
**前置知识：** Phase 13 · 01 至 21
**时间：** ~120 分钟

## 学习目标

- 组合一个暴露工具、资源、提示和带有 `ui://` 应用的任务的 MCP 服务器。
- 在服务器前面放置一个强制执行 RBAC 和固定哈希的 OAuth 2.1 网关。
- 编写一个多服务器客户端，使用 OTel GenAI 属性进行端到端追踪。
- 将部分工作负载委托给 A2A 子智能体；验证不透明性是否保留。
- 用 AGENTS.md + SKILL.md 打包整个技术栈，以便其他智能体可以驱动它。

## 问题所在

交付"研究与报告"系统：

- 用户询问："总结 2026 年关于智能体协议的被引用最多的三篇 arXiv 论文。"
- 系统：通过 MCP 搜索 arXiv；通过 A2A 将论文摘要委托给专门的写作智能体；聚合结果；将交互式报告渲染为 MCP Apps `ui://` 资源；将每一步记录到 OTel。

Phase 13 的所有原语都出现了。这不是玩具 —— 2026 年 Anthropic（Claude Research 产品）、OpenAI（带 Apps SDK 的 GPT）和第三方交付的生产研究助手系统具有这种确切形态。

## 核心概念

### 架构

```
[用户] -> [客户端] -> [网关 (OAuth 2.1 + RBAC)] -> [研究 MCP 服务器]
                                                      |
                                                      +- MCP 工具: arxiv_search (纯)
                                                      +- MCP 资源: notes://recent
                                                      +- MCP 提示: /research_topic
                                                      +- MCP 任务: generate_report (长)
                                                      +- MCP Apps UI: ui://report/current
                                                      +- A2A 调用: writer-agent (tasks/send)
                                                      |
                                                      +- OTel GenAI 跨度
```

### 追踪层次结构

```
agent.invoke_agent
 ├── llm.chat (启动)
 ├── mcp.call -> tools/call arxiv_search
 ├── mcp.call -> resources/read notes://recent
 ├── mcp.call -> prompts/get research_topic
 ├── a2a.tasks/send -> writer-agent
 │    └── 任务转换 (不透明内部)
 ├── mcp.call -> tools/call generate_report (任务增强)
 │    └── tasks/status 轮询
 │    └── tasks/result (已完成，返回 ui:// 资源)
 └── llm.chat (最终综合)
```

一个追踪 ID。每个跨度都有正确的 `gen_ai.*` 属性。

### 安全态势

- OAuth 2.1 + PKCE，资源指示器将受众固定到网关。
- 网关持有上游凭证；用户永远看不到它们。
- RBAC：`alice` 有 `research:read`、`research:write`，可以调用所有工具。`bob` 有 `research:read`，不能调用 `generate_report`。
- 固定描述清单：丢弃任何工具哈希已更改的服务器。
- 双重规则审计：没有工具组合不受信任的输入、敏感数据和后果性操作。

### 渲染

最终的 `generate_report` 任务返回内容块加上 `ui://report/current` 资源。客户端的宿主（Claude Desktop 等）在沙盒 iframe 中渲染交互式仪表板。仪表板包含排序的论文列表、引用计数和一个按钮，用户点击任何论文时调用 `host.callTool('summarize_paper', {arxiv_id})`。

### 打包

整个系统交付为：

```
research-system/
  AGENTS.md                     # 项目约定
  skills/
    run-research/
      SKILL.md                  # 顶级工作流
  servers/
    research-mcp/               # MCP 服务器
      pyproject.toml
      src/
  agents/
    writer/                     # A2A 智能体
  gateway/
    config.yaml                 # RBAC + 固定清单
```

用户使用 `docker compose up` 部署。Claude Code、Cursor、Codex 和 opencode 用户可以通过调用 `run-research` 技能来驱动系统。

### 每个 Phase 13 课程的贡献

| 课程 | 顶点项目使用的内容 |
|--------|------------------------|
| 01-05 | 工具接口、提供商可移植性、并行调用、模式、检查 |
| 06-10 | MCP 原语、服务器、客户端、传输、资源 + 提示 |
| 11-14 | 采样、根 + 引出、异步任务、`ui://` 应用 |
| 15-17 | 工具投毒、OAuth 2.1、网关 + 注册表 |
| 18 | A2A 子智能体委托 |
| 19 | OTel GenAI 追踪 |
| 20 | LLM 层的路由网关 |
| 21 | SKILL.md + AGENTS.md 打包 |

## 使用它

`code/main.py` 将之前课程的模式连接成一个可运行的演示。全部使用 stdlib，全部在进程内，以便你可以从头到尾阅读它。它运行研究-报告场景的完整流程：与网关握手、模拟 OAuth 2.1、合并 tools/list、将 generate_report 作为任务、对 writer 的 A2A 调用、返回 ui:// 资源、发出 OTel 跨度。

需要查看的内容：

- 每个跃点共享一个追踪 ID。
- 网关策略阻止第二个用户写入。
- 任务生命周期从 工作中 到 已完成，并返回文本和 ui:// 内容。
- A2A 调用的内部状态对编排器不透明。
- AGENTS.md 和 SKILL.md 是另一个智能体重现工作流所需的唯一文件。

## 交付它

本课产出 `outputs/skill-ecosystem-blueprint.md`。给定产品需求（研究、摘要、自动化），该技能产出完整架构：哪些 MCP 原语、哪些网关控制、哪些 A2A 调用、哪些遥测、哪些打包。

## 练习

1. 运行 `code/main.py`。注意单个追踪 ID 和跨度的嵌套方式。计算演示触及的 Phase 13 原语数量。

2. 扩展示示：添加第二个后端 MCP 服务器（例如 `bibliography`）并确认网关将其工具合并到同一命名空间。

3. 用子进程上运行的真实智能体替换假 A2A 写作智能体。使用第 19 课的框架。

4. 在编排器和 LLM 之间的路由网关中添加 PII 脱敏步骤。确认用户查询中的电子邮件被清理。

5. 为将维护此系统的队友编写 AGENTS.md。阅读时间应少于五分钟，并为他们提供在 Cursor 或 Codex 中驱动顶点项目所需的一切。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| 顶点项目 | "Phase-13 集成演示" | 使用每个原语的端到端系统 |
| 研究与报告 | "场景" | 搜索、摘要、渲染模式 |
| 生态系统 | "所有部分在一起" | 服务器 + 客户端 + 网关 + 子智能体 + 遥测 + 包 |
| 追踪层次结构 | "单个追踪 ID" | 每个跃点的跨度共享追踪；通过跨度 ID 实现父子关系 |
| 网关颁发令牌 | "传递认证" | 客户端只看到网关的令牌；网关持有上游凭证 |
| 合并命名空间 | "一个平面列表中的所有工具" | 网关处的多服务器合并，冲突时添加前缀 |
| 不透明边界 | "A2A 调用隐藏内部" | 子智能体的推理对编排器不可见 |
| 三层技术栈 | "AGENTS.md + SKILL.md + MCP" | 项目上下文 + 工作流 + 工具 |
| 纵深防御 | "多层安全" | 固定哈希、OAuth、RBAC、双重规则、审计日志 |
| 规范合规矩阵 | "我们交付的规范要求内容" | 将交付物映射到 2025-11-25 要求的检查清单 |

## 延伸阅读

- [MCP — 规范 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — 合并参考
- [MCP 博客 — 2026 年路线图](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — 协议的发展方向
- [a2a-protocol.org](https://a2a-protocol.org/latest/) — A2A v1.0 参考
- [OpenTelemetry — GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — 规范追踪约定
- [Anthropic — Claude Agent SDK 概述](https://code.claude.com/docs/en/agent-sdk/overview) — 生产智能体运行时模式
