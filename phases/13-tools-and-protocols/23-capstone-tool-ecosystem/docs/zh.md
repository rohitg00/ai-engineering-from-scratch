# 23 · 综合项目——构建完整的工具生态系统

> 第 13 阶段讲解了每一个组成部件。本综合项目把它们接线成一个具备生产形态的系统：一台同时提供工具、资源、提示、任务与 UI 的 MCP 服务器；边缘处的 OAuth 2.1；一个基于角色的访问控制（RBAC）网关；一个多服务器客户端；一次 A2A 子智能体调用；通往采集器（collector）的 OTel 追踪；CI 中的工具投毒（tool-poisoning）检测；以及一套 AGENTS.md 加 SKILL.md 的打包。完成之后，你能为每一个架构决策进行辩护。

**类型：** 构建
**语言：** Python（标准库，端到端生态系统脚手架）
**前置：** 第 13 阶段 · 01 至 21
**时长：** 约 120 分钟

## 学习目标

- 组合一台 MCP 服务器，使其暴露工具、资源、提示，以及一个带 `ui://` 应用的任务。
- 在服务器前方架设一个 OAuth 2.1 网关，强制执行 RBAC 与固定哈希（pinned hashes）。
- 编写一个多服务器客户端，端到端地使用 OTel GenAI 属性进行追踪。
- 将一部分工作负载委派给一个 A2A 子智能体；验证不透明性（opacity）得以保持。
- 用 AGENTS.md 加 SKILL.md 打包整个技术栈，使其他智能体能够驱动它。

## 问题

交付这套「研究并报告」系统：

- 用户提问：「总结 2026 年关于智能体协议、被引用最多的三篇 arXiv 论文。」
- 系统：通过 MCP 搜索 arXiv；通过 A2A 把论文摘要任务委派给一个专门的写作智能体；聚合结果；以一个 MCP Apps 的 `ui://` 资源形式渲染一份交互式报告；把每一步都记录到 OTel。

第 13 阶段的所有原语（primitive）都会登场。这不是玩具——2026 年由 Anthropic（Claude Research 产品）、OpenAI（搭配 Apps SDK 的 GPTs）以及第三方交付的生产级研究助手系统，正是这种形态。

## 概念

### 架构

```
[user] -> [client] -> [gateway (OAuth 2.1 + RBAC)] -> [research MCP server]
                                                      |
                                                      +- MCP tool: arxiv_search (pure)
                                                      +- MCP resource: notes://recent
                                                      +- MCP prompt: /research_topic
                                                      +- MCP task: generate_report (long)
                                                      +- MCP Apps UI: ui://report/current
                                                      +- A2A call: writer-agent (tasks/send)
                                                      |
                                                      +- OTel GenAI spans
```

### 追踪层级

```
agent.invoke_agent
 ├── llm.chat (kick off)
 ├── mcp.call -> tools/call arxiv_search
 ├── mcp.call -> resources/read notes://recent
 ├── mcp.call -> prompts/get research_topic
 ├── a2a.tasks/send -> writer-agent
 │    └── task transitions (opaque internals)
 ├── mcp.call -> tools/call generate_report (task-augmented)
 │    └── tasks/status polling
 │    └── tasks/result (completed, returns ui:// resource)
 └── llm.chat (final synthesis)
```

一个追踪 ID。每个跨度（span）都带有正确的 `gen_ai.*` 属性。

### 安全态势

- 带 PKCE 的 OAuth 2.1，使用资源指示符（resource indicator）将受众（audience）固定到网关。
- 网关持有上游凭据；用户永远看不到它们。
- RBAC：`alice` 拥有 `research:read`、`research:write`，可以调用所有工具。`bob` 拥有 `research:read`，不能调用 `generate_report`。
- 固定的描述清单（pinned description manifest）：丢弃任何工具哈希发生变化的服务器。
- 二选一规则（Rule of Two）审计：没有任何工具同时组合了不受信输入、敏感数据与具有后果的动作。

### 渲染

最终的 `generate_report` 任务返回内容块（content blocks）以及一个 `ui://report/current` 资源。客户端的宿主（host，如 Claude Desktop 等）会在沙箱化的 iframe 中渲染这个交互式仪表盘。仪表盘包含一份排好序的论文列表、引用计数，以及一个按钮——用户点击任意一篇论文时，它会调用 `host.callTool('summarize_paper', {arxiv_id})`。

### 打包

整套东西按如下方式交付：

```
research-system/
  AGENTS.md                     # project conventions
  skills/
    run-research/
      SKILL.md                  # the top-level workflow
  servers/
    research-mcp/               # the MCP server
      pyproject.toml
      src/
  agents/
    writer/                     # the A2A agent
  gateway/
    config.yaml                 # RBAC + pinned manifest
```

用户使用 `docker compose up` 进行部署。Claude Code、Cursor、Codex 与 opencode 的用户可以通过调用 `run-research` 技能（skill）来驱动这套系统。

### 第 13 阶段每一课的贡献

| 课程 | 综合项目用到了什么 |
|--------|------------------------|
| 01-05 | 工具接口、提供商可移植性、并行调用、模式（schemas）、检查（linting） |
| 06-10 | MCP 原语、服务器、客户端、传输层、资源加提示 |
| 11-14 | 采样（sampling）、根（roots）加征询（elicitation）、异步任务、`ui://` 应用 |
| 15-17 | 工具投毒、OAuth 2.1、网关加注册表（registry） |
| 18 | A2A 子智能体委派 |
| 19 | OTel GenAI 追踪 |
| 20 | 面向 LLM 层的路由网关 |
| 21 | SKILL.md 加 AGENTS.md 打包 |

## 动手用

`code/main.py` 把此前各课的模式拼接成一个可运行的演示。全部使用标准库、全部在进程内（in-process），因此你可以从头到尾读完它。它针对「研究并报告」场景运行了完整流程：与网关握手、模拟 OAuth 2.1、合并 tools/list、将 generate_report 作为任务、向 writer 发起 A2A 调用、返回 ui:// 资源、发出 OTel 跨度。

需要重点观察的：

- 一个追踪 ID 贯穿每一跳（hop）。
- 网关策略阻止第二个用户进行写入。
- 任务生命周期从 working 走向 completed，并同时返回文本与 ui:// 内容。
- A2A 调用的内部状态对编排器（orchestrator）是不透明的。
- AGENTS.md 与 SKILL.md 是另一个智能体复现该工作流所需要的全部文件。

## 交付

本课产出 `outputs/skill-ecosystem-blueprint.md`。给定一项产品需求（研究、摘要、自动化），该技能会产出完整架构：用哪些 MCP 原语、哪些网关控制、哪些 A2A 调用、哪些遥测（telemetry）、哪种打包方式。

## 练习

1. 运行 `code/main.py`。留意那个唯一的追踪 ID 以及跨度如何嵌套。数一数这个演示触及了第 13 阶段的多少个原语。

2. 扩展该演示：添加第二台后端 MCP 服务器（例如 `bibliography`），并确认网关会把它的工具合并到同一个命名空间中。

3. 把假的 A2A writer 智能体替换为一个运行在子进程上的真实智能体。使用第 19 课的脚手架。

4. 在编排器与 LLM 之间的路由网关里加入一个 PII 脱敏（redaction）步骤。确认用户查询中的电子邮件被清洗掉。

5. 为将要维护这套系统的同事写一份 AGENTS.md。它应该能在五分钟内读完，并给到对方在 Cursor 或 Codex 中驱动这个综合项目所需的一切。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| 综合项目（Capstone） | 「第 13 阶段集成演示」 | 用到每一个原语的端到端系统 |
| 研究并报告（Research and report） | 「那个场景」 | 搜索、摘要、渲染的模式 |
| 生态系统（Ecosystem） | 「所有部件凑在一起」 | 服务器 + 客户端 + 网关 + 子智能体 + 遥测 + 打包 |
| 追踪层级（Trace hierarchy） | 「单一追踪 ID」 | 每一跳的跨度共享该追踪；通过跨度 ID 形成父子关系 |
| 网关签发的令牌（Gateway-issued token） | 「传递式鉴权」 | 客户端只看到网关的令牌；网关持有上游凭据 |
| 合并命名空间（Merged namespace） | 「所有工具在一个扁平列表里」 | 在网关处进行多服务器合并，冲突时加前缀 |
| 不透明边界（Opacity boundary） | 「A2A 调用隐藏内部细节」 | 子智能体的推理对编排器不可见 |
| 三层栈（Three-layer stack） | 「AGENTS.md + SKILL.md + MCP」 | 项目上下文 + 工作流 + 工具 |
| 纵深防御（Defense-in-depth） | 「多重安全层」 | 固定哈希、OAuth、RBAC、二选一规则、审计日志 |
| 规范合规矩阵（Spec compliance matrix） | 「我们交付的内容里规范所要求的部分」 | 把交付物映射到 2025-11-25 要求的核对清单 |

## 延伸阅读

- [MCP — 规范 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — 合并后的参考文档
- [MCP 博客 — 2026 路线图](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — 协议的走向
- [a2a-protocol.org](https://a2a-protocol.org/latest/) — A2A v1.0 参考
- [OpenTelemetry — GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — 权威的追踪约定
- [Anthropic — Claude Agent SDK 概览](https://code.claude.com/docs/en/agent-sdk/overview) — 生产级智能体运行时模式
