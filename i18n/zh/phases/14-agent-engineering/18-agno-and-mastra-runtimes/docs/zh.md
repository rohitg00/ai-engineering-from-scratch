# 生产级 Agent 运行时 — 快速实例化与类型化工作流

> 生产级 agent 运行时优化的是原型框架所忽略的东西：实例化成本、类型化的工作流接口，以及可直接上线的后端。2026 年的组合是：Agno(Python)以微秒级 agent 实例化和无状态 FastAPI 后端为目标。Mastra 基于 Vercel AI SDK 底座,提供 agents、tools、workflows、统一的模型路由以及可组合的存储。

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 14 · 01(Agent Loop)、Phase 14 · 13(LangGraph)
**Time:** 约 45 分钟

## 学习目标

- 识别 Agno 的性能目标及其适用场景。
- 说出 Mastra 的三个原语 —— Agents、Tools、Workflows —— 及其支持的服务器适配器。
- 解释为什么无状态的会话作用域 FastAPI 后端是 Agno 推荐的生产路径。
- 针对给定技术栈(Python 优先 vs TypeScript 优先)在 Agno 与 Mastra 之间做出选择。

## 问题所在

LangGraph、AutoGen、CrewAI 都属于重量级框架。想要“只要 agent 循环,够快,跑在我自己的运行时里”的团队会选择 Agno(Python)或 Mastra(TypeScript)。两者都牺牲了一部分框架自带的原语,换取更极致的速度和与周边技术栈更紧密的契合。

## 核心概念

### Agno

- Python 运行时,前身为 Phi-data。
- “没有图、没有链、没有复杂模式 —— 只有纯粹的 Python。”
- 其文档中的性能指标:约 2μs 的 agent 实例化,每个 agent 约 3.75 KiB 内存,支持约 23 个模型提供商。
- 生产路径:无状态的会话作用域 FastAPI 后端。每个请求启动一个全新的 agent;会话状态保存在数据库中。
- 原生多模态(文本、图像、音频、视频、文件)以及 agentic RAG。

当你每秒要运行成千上万个短生命周期 agent(聊天扇入、评估流水线)时,这些速度指标才重要。而当一个 agent 要跑 10 分钟时,它们就没那么重要了。

### Mastra

- TypeScript,构建于 Vercel AI SDK 之上。
- 三个原语:**Agents**、**Tools**(Zod 类型化)、**Workflows**。
- 统一模型路由 —— 覆盖 94 个提供商的 3,300+ 个模型(2026 年 3 月)。
- 可组合存储:memory、workflows、observability 可分别写入不同后端;大规模场景下的 observability 推荐 ClickHouse。
- Apache 2.0 许可,其中 `ee/` 目录采用 source-available 企业许可。
- 提供 Express、Hono、Fastify、Koa 的服务器适配器;对 Next.js 和 Astro 有一流集成。
- 自带 Mastra Studio(localhost:4111)用于调试。
- 1.0 版本(2026 年 1 月)时拥有 22k+ GitHub 星标、每周 300k+ npm 下载量。

### 定位

两者都不想成为 LangGraph。它们的竞争优势在于:

- **语言契合度。** Agno 面向 Python 优先的团队;Mastra 面向 TypeScript 优先的团队。
- **运行时人机工程。** Agno = 近乎零开销;Mastra = 与 Vercel 生态深度集成。
- **可观测性。** 两者都集成了 Langfuse/Phoenix/Opik(第 24 课),但 Mastra Studio 是第一方组件。

### 何时选择哪一个

- **Agno** — Python 后端、大量短生命周期 agent、强性能要求、使用 FastAPI 的团队。
- **Mastra** — TypeScript 后端、Next.js / Vercel 部署、统一的多提供商模型路由、Zod 类型化的工具。
- **LangGraph**(第 13 课)— 当持久化状态和显式的图推理比极致速度更重要时。
- **OpenAI / Claude Agent SDK** — 当你想要提供商已产品化的形态时(第 16–17 课)。

### 这种模式何时会出问题

- **为性能而性能。** 当工作负载是每个请求一次缓慢的 agent 调用时,却因为"2μs"听起来很厉害而选择 Agno。此时开销并不是瓶颈。
- **生态锁定。** Mastra 的 Vercel 风格集成在 Vercel 上是加分项,在其他平台上则是减分项。
- **企业许可混淆。** Mastra 的 `ee/` 目录是 source-available,而非 Apache 2.0。如果你计划 fork,请仔细阅读许可条款。

```figure
wb-runtime-spawn
```

## 动手构建

本课以对比为主 —— 没有哪个单一的代码产物能同时公允地展示两个框架。参见 `code/main.py` 中的并排玩具示例:一个最简的“运行 agent、流式输出、持久化会话”流程,用两种方式实现(一次按 Agno 的方式,一次按 Mastra 的方式)。

运行方式:

```
python3 code/main.py
```

两条结构不同但功能等价的执行轨迹。

## 实践应用

- **Agno** — 需要速度和 FastAPI 形态的 Python 后端。
- **Mastra** — 需要众多提供商和工作流原语的 TypeScript 后端。
- 两者都自带第一方可观测性钩子。两者都集成了 Langfuse。

## 上线部署

`outputs/skill-runtime-picker.md` 依据技术栈、延迟预算和运维形态,在 Agno、Mastra、LangGraph 或某个提供商 SDK 之间做出选择。

## 练习

1. 阅读 Agno 的文档。将标准库 ReAct 循环(第 01 课)移植到 Agno。哪些东西消失了?哪些保留了下来?
2. 阅读 Mastra 的文档。将同一个循环移植到 Mastra。工具类型化方面发生了什么变化(Zod vs 无)?
3. 基准测试:在你的技术栈上测量 agent 实例化延迟。Agno 的 2μs 对你的工作负载有影响吗?
4. 设计一次迁移:如果你一直在 Python 中使用 CrewAI,迁移到 Agno 会破坏什么?
5. 阅读 Mastra 的 `ee/` 许可条款。哪些限制会影响开源 fork?

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|------------------------|------------------------|
| Agno | “快速的 Python agent” | 无状态的会话作用域 agent 运行时 |
| Mastra | “Vercel AI SDK 上的 TypeScript agent” | Agents + Tools + Workflows + Model Router |
| Unified Model Router | “多提供商访问” | 单一客户端访问 94 个提供商的 3,300+ 个模型 |
| Composite storage | “多个后端” | Memory/workflows/observability 分别写入不同的存储 |
| Mastra Studio | “本地调试器” | 用于内省 agent 的 localhost:4111 界面 |
| Source-available | “不是 OSS” | 许可允许阅读源码,但限制商业使用 |

## 延伸阅读

- [Agno Agent Framework 文档](https://www.agno.com/agent-framework) — 性能指标、FastAPI 集成
- [Mastra 文档](https://mastra.ai/docs) — 原语、服务器适配器、Model Router
- [LangGraph 概览](https://docs.langchain.com/oss/python/langgraph/overview) — 有状态图的替代方案
- [Comet Opik](https://www.comet.com/site/products/opik/) — Mastra 集成所引用的可观测性对比