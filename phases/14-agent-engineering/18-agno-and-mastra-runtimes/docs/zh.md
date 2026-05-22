# Agno 与 Mastra：生产运行时

> Agno（Python）和 Mastra（TypeScript）是 2026 年的生产运行时配对。Agno 瞄准微秒级 Agent 实例化和无状态 FastAPI 后端。Mastra 提供 agents、tools、workflows、统一模型路由和基于 Vercel AI SDK 的复合存储。

**类型：** 学习
**语言：** Python、TypeScript
**前置要求：** 阶段 14 · 01（Agent 循环）、阶段 14 · 13（LangGraph）
**时长：** 约 45 分钟

## 学习目标

- 识别 Agno 的性能目标以及它们何时重要。
- 说出 Mastra 的三个原语——Agents、Tools、Workflows——以及支持的服务器适配器。
- 解释为什么无状态会话范围的 FastAPI 后端是推荐的 Agno 生产路径。
- 为给定的技术栈（Python 优先 vs TypeScript 优先）选择 Agno 或 Mastra。

## 问题背景

LangGraph、AutoGen、CrewAI 都是框架重度的。想要"只要 Agent 循环，快速，在我的运行时中"的团队会求助 Agno（Python）或 Mastra（TypeScript）。两者都牺牲了一些框架拥有的原语，以换取原始速度和与周围技术栈的更紧密契合。

## 核心概念

### Agno

- Python 运行时，前身是 Phi-data。
- "没有图、链或复杂的模式——只有纯 Python。"
- 文档中的性能目标：~2μs Agent 实例化，~3.75 KiB 每 Agent 内存，~23 个模型提供商。
- 生产路径：无状态会话范围的 FastAPI 后端。每个请求启动一个全新的 Agent；会话状态存在于数据库中。
- 原生多模态（文本、图像、音频、视频、文件）和 Agentic RAG。

当你每秒有数千个短生命周期 Agent 时（聊天扇入、评估管道），速度目标很重要。当一个 Agent 运行 10 分钟时，它们不那么重要。

### Mastra

- TypeScript，构建在 Vercel AI SDK 之上。
- 三个原语：**Agents**、**Tools**（Zod 类型化）、**Workflows**。
- 统一模型路由器——跨 94 个提供商的 3,300+ 模型（2026 年 3 月）。
- 复合存储：内存、工作流、可观测性到不同的后端；推荐 ClickHouse 用于大规模可观测性。
- Apache 2.0 带有源代码可用的企业许可证下的 `ee/` 目录。
- Express、Hono、Fastify、Koa 的服务器适配器；一等的 Next.js 和 Astro 集成。
- 提供 Mastra Studio（localhost:4111）用于调试。
- 2026 年 1 月 1.0 版本时有 22k+ GitHub 星标，300k+ 每周 npm 下载量。

### 定位

两者都不试图成为 LangGraph。它们在以下方面竞争：

- **语言适配。** Agno 用于 Python 优先团队；Mastra 用于 TypeScript 优先。
- **运行时工效学。** Agno = 接近零开销；Mastra = 与 Vercel 生态系统集成。
- **可观测性。** 两者都与 Langfuse/Phoenix/Opik（第 24 课）集成，但 Mastra Studio 是第一方的。

### 何时选择每个

- **Agno**——需要速度和 FastAPI 形态的 Python 后端。
- **Mastra**——具有多提供商和工作流原语的 TypeScript 后端。
- **LangGraph**（第 13 课）——当持久状态和显式图推理比原始速度更重要时。
- **OpenAI / Claude Agent SDK**——当你想要提供商的产品化形态时（第 16-17 课）。

### 这种模式哪里会出错

- **为了性能而性能（Perf-for-perf's-sake）。** 当工作负载是每个请求一个慢速 Agent 调用时，选择 Agno 因为"2μs"听起来不错。开销不是瓶颈。
- **生态系统锁定。** Mastra 的 Vercel 风味集成在 Vercel 上是加分项，在其他地方是减分项。
- **企业许可证混淆。** Mastra 的 `ee/` 目录是源代码可用的，不是 Apache 2.0。如果你计划 fork，请阅读许可证。

## 构建它

本课主要是比较性的——单个代码工件无法公正地对待两个框架。参见 `code/main.py` 获取并排玩具：一个最小化的"运行一个 Agent，流式传输输出，持久化会话"流程实现两次（一次 Agno 形态，一次 Mastra 形态）。

运行它：

```
python3 code/main.py
```

两个结构不同但在功能上等效的追踪。

## 使用它

- **Agno**——需要速度和 FastAPI 形态的 Python 后端。
- **Mastra**——具有许多提供商和工作流原语的 TypeScript 后端。
- 两者都提供第一方可观测性钩子。两者都与 Langfuse 集成。

## 部署它

`outputs/skill-runtime-picker.md` 根据技术栈、延迟预算和运行形态选择 Agno、Mastra、LangGraph 或提供商 SDK。

## 练习

1. 阅读 Agno 的文档。将标准库 ReAct 循环（第 01 课）移植到 Agno。什么消失了？什么保留了？
2. 阅读 Mastra 的文档。将同一循环移植到 Mastra。工具类型化发生了什么变化（Zod vs 无）？
3. 基准测试：在你的技术栈上测量 Agent 实例化延迟。Agno 的 2μs 对你的工作负载重要吗？
4. 设计一个迁移：如果你一直在 Python 中运行 CrewAI，如果你迁移到 Agno，什么会出问题？
5. 阅读 Mastra 的 `ee/` 许可证条款。什么限制会影响开源 fork？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| Agno | "快速 Python Agents" | 无状态会话范围的 Agent 运行时 |
| Mastra | "Vercel AI SDK 上的 TypeScript Agents" | Agents + Tools + Workflows + 模型路由器 |
| Unified Model Router | "多提供商访问" | 跨 94 个提供商的 3,300+ 模型的单一客户端 |
| Composite storage | "多后端" | 内存/工作流/可观测性各自到不同的存储 |
| Mastra Studio | "本地调试器" | 用于内省 Agents 的 localhost:4111 UI |
| Source-available | "不是 OSS" | 许可证允许源代码阅读但限制商业使用 |

## 延伸阅读

- [Agno Agent Framework docs](https://www.agno.com/agent-framework)——性能目标、FastAPI 集成
- [Mastra docs](https://mastra.ai/docs)——原语、服务器适配器、模型路由器
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)——有状态图的替代方案
- [Comet Opik](https://www.comet.com/site/products/opik/)——Mastra 集成引用的可观测性比较
