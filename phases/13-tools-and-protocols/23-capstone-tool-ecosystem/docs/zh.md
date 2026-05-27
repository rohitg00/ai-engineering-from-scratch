# 顶点项目 — 构建完整的工具生态系统

> 阶段 13 教授了每个部分。这个顶点项目将它们连接成一个生产形态的系统：一个带有工具 + 资源 + 提示词 + 任务和 `ui://` 应用的 MCP 服务器，边缘的 OAuth 2.1，一个 RBAC 网关，一个多服务器客户端，一个 A2A 子智能体调用，OTel 追踪到收集器，CI 中的工具中毒检测，以及 AGENTS.md + SKILL.md 包。最后你可以为每种架构选择进行辩护。

**类型：** 构建
**语言：** Python (stdlib, 端到端生态系统工具)
**前置条件：** 阶段 13 · 01 到 21
**时间：** ~120 分钟

## 学习目标

- 组合一个暴露工具、资源、提示词和带有 `ui://` 应用的任务的 MCP 服务器。
- 使用强制 RBAC 和固定哈希的 OAuth 2.1 网关前置服务器。
- 编写一个用 OTel GenAI 属性端到端追踪的多服务器客户端。
- 将部分工作负载委托给 A2A 子智能体；验证不透明性得到保持。
- 用 AGENTS.md + SKILL.md 打包整个技术栈，以便其他智能体可以驱动它。

## 问题背景

发布"研究和报告"系统：

- 用户询问："总结关于智能体协议的 2026 年引用最多的三篇 arXiv 论文。"
- 系统：通过 MCP 搜索 arXiv；通过 A2A 将论文摘要委托给专门的撰写者智能体；聚合结果；将交互式报告渲染为 MCP Apps `ui://` 资源；将每个步骤记录到 OTel。

阶段 13 中的所有原语都出现了。这不是玩具 — 2026 年由 Anthropic（Claude Research 产品）、OpenAI（带 Apps SDK 的 GPT）和第三方发布的生产研究助手系统都具有完全相同的形态。

## 概念详解

### 架构

```
[用户] -> [客户端] -> [网关 (OAuth 2.1 + RBAC)] -> [研究 MCP 服务器]
                                                      |
                                                      +- MCP 工具：arxiv_search（纯）
                                                      +- MCP 资源：notes://recent
                                                      +- MCP 提示词：/research_topic
                                                      +- MCP 任务：generate_report（长时间）
                                                      +- MCP 应用 UI：ui://report/current
                                                      +- A2A 调用：writer-agent（tasks/send）
                                                      |
                                                      +- OTel GenAI span
```

### 追踪层次结构

```
agent.invoke_agent
 ├── llm.chat（kick off）
 ├── mcp.call -> tools/call arxiv_search
 ├── mcp.call -> resources/read notes://recent
 ├── mcp.call -> prompts/get research_topic
 ├── a2a.tasks/send -> writer-agent
 │    └── 任务转换（不透明内部）
 ├── mcp.call -> tools/call generate_report（任务增强）
 │    └── tasks/status 轮询
 │        └── tasks/result（完成，返回 ui:// 资源）
 └── llm.chat（最终综合）
```

一个追踪 ID。每个 span 都有正确的 `gen_ai.*` 属性。

### 安全态势

- OAuth 2.1 + PKCE，资源指示器将受众固定到网关。
- 网关持有上游凭据；用户永远不会看到它们。
- RBAC：`alice` 有 `research:read`、`research:write`，可以调用所有工具。`bob` 有 `research:read`，不能调用 `generate_report`。
- 固定描述清单：丢弃工具哈希已变更的任何服务器。
- 二则规则审计：没有工具组合不受信任的输入、敏感数据和后果性操作。

### 渲染

最终的 `generate_report` 任务返回内容块加上 `ui://report/current` 资源。客户端的宿主（Claude Desktop 等）在沙盒 iframe 中渲染交互式仪表板。仪表板包含排序的论文列表、引用计数和一个按钮，用于为用户点击的任何论文调用 `host.callTool('summarize_paper', {arxiv_id})`。

### 打包

整个事情作为以下发布：

```
research-system/
  AGENTS.md                     # 项目约定
  skills/
    run-research/
      SKILL.md                  # 顶层工作流
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

### 阶段 13 每课的贡献

| 课程 | 顶点项目使用什么 |
|--------|------------------------|
| 01-05 | 工具接口、提供商可移植性、并行调用、模式、linting |
| 06-10 | MCP 原语、服务器、客户端、传输层、资源 + 提示词 |
| 11-14 | 采样、roots + 询问、异步任务、`ui://` 应用 |
| 15-17 | 工具中毒、OAuth 2.1、网关 + 注册表 |
| 18 | A2A 子智能体委托 |
| 19 | OTel GenAI 追踪 |
| 20 | LLM 层的路由网关 |
| 21 | SKILL.md + AGENTS.md 打包 |

## 使用示例

`code/main.py` 将之前课程的模式缝合到一个可运行的演示中。全部 stdlib，全部进程内，以便你可以端到端读取它。它运行研究和报告场景的完整流程：与网关握手、OAuth 2.1 模拟、工具/列表合并、generate_report 作为任务、A2A 调用到撰写者、ui:// 资源返回、OTel span 发出。

需要关注的点：

- 所有跳转共享一个追踪 ID。
- 父子链接通过 `parentSpanId` 编码。
- 必需的 `gen_ai.*` 属性被填充。
- 内容捕获默认关闭；一个场景通过环境变量打开它。
- A2A 调用的内部状态对编排器是不透明的。

## 实战输出

本课生成 `outputs/skill-ecosystem-blueprint.md`。给定一个产品需求（研究、摘要、自动化），该技能生成完整架构：哪些 MCP 原语、哪些网关控制、哪些 A2A 调用、哪些遥测、哪些打包。

## 练习

1. 运行 `code/main.py`。计算 span 并识别哪些是 CLIENT vs INTERNAL。

2. 打开内容捕获（环境变量）并确认 `gen_ai.content.prompt` 和 `gen_ai.content.completion` 事件出现。注意对 PII 的影响。

3. 添加工具执行指标 `gen_ai.tool.execution.duration` 并将其作为每次调用的直方图样本发出。

4. 将 traceparent 从父智能体 span 传播到 MCP 请求的 `_meta.traceparent` 字段。验证 MCP 服务器将看到相同的追踪 ID。

5. 为将维护此系统的队友编写 AGENTS.md。读取和给他们在使用 Cursor 或 Codex 中驱动顶点项目所需的一切应该在五分钟内完成。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| 顶点项目 | "阶段 13 集成演示" | 使用每个原语的端到端系统 |
| 研究和报告 | "场景" | 搜索、摘要、渲染模式 |
| 生态系统 | "所有部分在一起" | 服务器 + 客户端 + 网关 + 子智能体 + 遥测 + 包 |
| 追踪层次结构 | "单追踪 ID" | 共享追踪 ID 的 span 树；通过 span ID 的父子关系 |
| 网关颁发令牌 | "传递身份验证" | 客户端只看到网关的令牌；网关持有上游凭据 |
| 合并命名空间 | "一个平面列表中的所有工具" | 网关处的多服务器合并，冲突时前缀 |
| 不透明性边界 | "A2A 调用隐藏内部" | 子智能体的推理对编排器不可见 |
| 三层技术栈 | "AGENTS.md + SKILL.md + MCP" | 项目上下文 + 工作流 + 工具 |
| 深度防御 | "多层安全" | 固定哈希、OAuth、RBAC、二则规则、审计日志 |
| 规范合规性矩阵 | "我们发布的规范要求的" | 将可交付成果映射到 2025-11-25 要求的检查清单 |

## 延伸阅读

- [MCP — 规范 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — 合并参考
- [MCP 博客 — 2026 路线图](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — 协议的发展方向
- [a2a-protocol.org](https://a2a-protocol.org/latest/) — A2A v1.0 参考
- [OpenTelemetry — GenAI semconv](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — GenAI span、指标和事件的权威约定
- [Anthropic — Claude Agent SDK 概览](https://code.claude.com/docs/en/agent-sdk/overview) — 生产智能体运行时模式
