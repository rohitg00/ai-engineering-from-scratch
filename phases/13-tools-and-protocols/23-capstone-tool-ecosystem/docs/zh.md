# 综合实践 —— 构建一个完整的工具生态系统

> 第 13 阶段的每一课都传授了一个独立构件。本综合实践将它们整合成一个生产级系统：一个包含工具 + 资源 + 提示词 + 任务 + UI 的 MCP 服务器、边缘的 OAuth 2.1、RBAC 网关、多服务器客户端、A2A 子代理调用、集成到采集器的 OTel 链路追踪、CI 中的工具投毒检测，以及一份 AGENTS.md + SKILL.md 捆绑包。完成本实践后，你能为每一个架构选择提供有力辩护。

**类型：** 构建
**语言：** Python（标准库，端到端生态系统框架）
**前置条件：** 第 13 阶段 · 01 至 21 课
**时长：** ~120 分钟

## 学习目标

- 组合一个 MCP 服务器，对外暴露工具、资源、提示词以及一个带有 `ui://` 应用的任务。
- 在服务器前端部署一个 OAuth 2.1 网关，执行 RBAC 和固定哈希策略。
- 编写一个多服务器客户端，使用 OTel GenAI 属性进行端到端链路追踪。
- 将部分工作负载委托给 A2A 子代理，验证不透明性是否得到保持。
- 使用 AGENTS.md + SKILL.md 打包整个技术栈，使其他代理能够驱动它。

## 问题描述

交付"搜索并生成报告"系统：

- 用户提问："请总结 2026 年 arXiv 上被引用次数最多的三篇关于代理协议的论文。"
- 系统：通过 MCP 搜索 arXiv；通过 A2A 将论文总结委托给专门的写作代理；汇总结果；以 MCP Apps `ui://` 资源的形式渲染交互式报告；将每一步记录到 OTel。

第 13 阶段的所有原语都会在这里出现。这不是玩具——Anthropic（Claude Research 产品）、OpenAI（GPTs with Apps SDK）以及第三方公司在 2026 年交付的生产级研究助手系统正是这个形态。

## 概念

### 架构

```
[用户] -> [客户端] -> [网关 (OAuth 2.1 + RBAC)] -> [研究 MCP 服务器]
                                                      |
                                                      +- MCP 工具：arxiv_search（纯工具）
                                                      +- MCP 资源：notes://recent
                                                      +- MCP 提示词：/research_topic
                                                      +- MCP 任务：generate_report（长任务）
                                                      +- MCP Apps UI：ui://report/current
                                                      +- A2A 调用：writer-agent（tasks/send）
                                                      |
                                                      +- OTel GenAI 跨度
```

### 追踪层级

```
agent.invoke_agent
 ├── llm.chat（启动）
 ├── mcp.call -> tools/call arxiv_search
 ├── mcp.call -> resources/read notes://recent
 ├── mcp.call -> prompts/get research_topic
 ├── a2a.tasks/send -> writer-agent
 │    └── 任务状态转换（内部不透明）
 ├── mcp.call -> tools/call generate_report（任务增强）
 │    └── tasks/status 轮询
 │    └── tasks/result（已完成，返回 ui:// 资源）
 └── llm.chat（最终合成）
```

同一个追踪 ID。每个跨度都带有正确的 `gen_ai.*` 属性。

### 安全态势

- OAuth 2.1 + PKCE，资源指示器将受众固定到网关。
- 网关持有上游凭据；用户永远看不到它们。
- RBAC：`alice` 拥有 `research:read`、`research:write`，可以调用所有工具。`bob` 拥有 `research:read`，但无法调用 `generate_report`。
- 固定描述清单：丢弃任何工具哈希发生变化的服务器。
- 双人规则审计：没有工具同时组合未经处理的输入、敏感数据和后果性操作。

### 渲染

最终的 `generate_report` 任务返回内容块以及一个 `ui://report/current` 资源。客户端的宿主应用程序（Claude Desktop 等）在沙箱 iframe 中渲染交互式仪表盘。该仪表盘包含排序后的论文列表、引用次数，以及一个按钮，用户点击任意论文时调用 `host.callTool('summarize_paper', {arxiv_id})`。

### 打包

整个系统以以下结构交付：

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
    writer/                     # A2A 代理
  gateway/
    config.yaml                 # RBAC + 固定清单
```

用户通过 `docker compose up` 部署。Claude Code、Cursor、Codex 和 opencode 的用户可以通过调用 `run-research` 技能来驱动该系统。

### 第 13 阶段各课的贡献

| 课程 | 综合实践使用的内容 |
|------|-------------------|
| 01-05 | 工具接口、提供者可移植性、并行调用、模式、linting |
| 06-10 | MCP 原语、服务器、客户端、传输、资源 + 提示词 |
| 11-14 | 采样、根节点 + 诱导、异步任务、`ui://` 应用 |
| 15-17 | 工具投毒、OAuth 2.1、网关 + 注册中心 |
| 18 | A2A 子代理委托 |
| 19 | OTel GenAI 链路追踪 |
| 20 | LLM 层的路由网关 |
| 21 | SKILL.md + AGENTS.md 打包 |

## 使用它

`code/main.py` 将前面各课的模式拼接成一个可运行的演示。全部使用标准库，全部在进程内，因此你可以端到端阅读。它运行了搜索并生成报告场景的完整流程：与网关握手、模拟的 OAuth 2.1、合并的 tools/list、作为任务的 generate_report、对写作代理的 A2A 调用、返回的 ui:// 资源、发出的 OTel 跨度。

值得关注的点：

- 每一步都使用同一个追踪 ID。
- 网关策略阻止第二个用户进行写操作。
- 任务生命周期从 working 到 completed，同时返回文本和 ui:// 内容。
- A2A 调用的内部状态对编排器不透明。
- AGENTS.md 和 SKILL.md 是其他代理复现该工作流所需的唯一文件。

## 交付它

本课产出 `outputs/skill-ecosystem-blueprint.md`。给定一个产品需求（研究、摘要、自动化），该技能会生成完整的架构：使用哪些 MCP 原语、哪些网关控制、哪些 A2A 调用、哪些遥测、哪些打包方式。

## 练习

1. 运行 `code/main.py`。注意单一的追踪 ID 以及跨度如何嵌套。数一数演示涉及了第 13 阶段的多少个原语。

2. 扩展演示：添加第二个后端 MCP 服务器（例如 `bibliography`），并确认网关将其工具合并到同一个命名空间中。

3. 将模拟的 A2A 写作代理替换为一个在子进程中运行的真实代理。使用第 19 课的框架。

4. 在编排器和 LLM 之间的路由网关中添加一个 PII 脱敏步骤。确认用户查询中的电子邮件地址被清除。

5. 为将要维护该系统的队友编写一份 AGENTS.md。阅读时间不应超过五分钟，并为他们提供在 Cursor 或 Codex 中驱动本综合实践所需的一切。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|---------|
| 综合实践 | "第 13 阶段集成演示" | 使用每种原语的端到端系统 |
| 搜索并生成报告 | "那个场景" | 搜索、总结、渲染模式 |
| 生态系统 | "所有部件在一起" | 服务器 + 客户端 + 网关 + 子代理 + 遥测 + 打包 |
| 追踪层级 | "单一追踪 ID" | 每一步的跨度共享同一个追踪；通过跨度 ID 建立父子关系 |
| 网关颁发的令牌 | "传递式认证" | 客户端只看到网关的令牌；网关持有上游凭据 |
| 合并的命名空间 | "所有工具在一个扁平列表中" | 在网关处进行多服务器合并，冲突时加前缀 |
| 不透明性边界 | "A2A 调用隐藏内部" | 子代理的推理对编排器不可见 |
| 三层栈 | "AGENTS.md + SKILL.md + MCP" | 项目上下文 + 工作流 + 工具 |
| 纵深防御 | "多层安全" | 固定哈希、OAuth、RBAC、双人规则、审计日志 |
| 规范合规矩阵 | "我们交付的符合规范要求的内容" | 将交付物映射到 2025-11-25 要求的检查清单 |

## 延伸阅读

- [MCP —— 规范 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) —— 综合参考
- [MCP 博客 —— 2026 路线图](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) —— 协议的发展方向
- [a2a-protocol.org](https://a2a-protocol.org/latest/) —— A2A v1.0 参考
- [OpenTelemetry —— GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— 规范的链路追踪约定
- [Anthropic —— Claude Agent SDK 概览](https://code.claude.com/docs/en/agent-sdk/overview) —— 生产级代理运行时模式
