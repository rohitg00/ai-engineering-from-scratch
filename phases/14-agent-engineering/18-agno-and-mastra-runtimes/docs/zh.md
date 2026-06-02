# Agno 与 Mastra：生产级 runtime

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Agno（Python）与 Mastra（TypeScript）是 2026 年的生产级 runtime 双雄。Agno 主打微秒级 agent 实例化和无状态 FastAPI 后端。Mastra 在 Vercel AI SDK 的底座上提供 agents、tools、workflows、统一模型路由和组合式存储。

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 13 (LangGraph)
**Time:** ~45 minutes

## 学习目标（Learning Objectives）

- 识别 Agno 的性能指标，以及它们在何时真正重要。
- 说出 Mastra 的三个 primitive —— Agents、Tools、Workflows，以及它支持的 server adapter。
- 解释为什么无状态、按 session 作用域的 FastAPI 后端是 Agno 推荐的生产路径。
- 针对给定技术栈（Python 优先 vs TypeScript 优先）选择 Agno 还是 Mastra。

## 问题（Problem）

LangGraph、AutoGen、CrewAI 都属于「框架重」的方案。如果团队只想要「就一个 agent loop，要快，跑在我现有的 runtime 里」，他们会选 Agno（Python）或 Mastra（TypeScript）。两者都用一部分框架自带的 primitive 换来了原始速度，以及和周边技术栈更紧密的贴合。

## 概念（Concept）

### Agno

- Python runtime，前身是 Phi-data。
- 「没有图、没有链、没有花里胡哨的模式 —— 就是纯 Python。」
- 官方文档给出的性能指标：约 2μs 的 agent 实例化、每个 agent 约 3.75 KiB 内存、约 23 个模型 provider。
- 生产路径：无状态、按 session 作用域的 FastAPI 后端。每个请求都启动一个全新的 agent；session 状态存在数据库里。
- 原生多模态（文本、图像、音频、视频、文件）以及 agentic RAG。

当你每秒要跑成千上万个短命 agent（聊天扇入、评估流水线）时，速度指标才有意义。如果一个 agent 一跑就是 10 分钟，这些指标就不太重要了。

### Mastra

- TypeScript，构建在 Vercel AI SDK 之上。
- 三个 primitive：**Agents**、**Tools**（Zod 类型化）、**Workflows**。
- 统一模型路由（Unified Model Router）—— 覆盖 94 家 provider 的 3,300+ 模型（截至 2026 年 3 月）。
- 组合式存储：memory、workflows、可观测性可以分别落到不同后端；大规模可观测性场景推荐 ClickHouse。
- Apache 2.0 协议；源码中的 `ee/` 目录采用 source-available（源码可见但有商用限制）的企业版许可证。
- 提供针对 Express、Hono、Fastify、Koa 的 server adapter；对 Next.js 和 Astro 是一等公民集成。
- 自带 Mastra Studio（localhost:4111）用于调试。
- 1.0 版本（2026 年 1 月）时已有 22k+ GitHub star、30 万+ 周下载量。

### 定位

它俩都不想成为 LangGraph。它们的竞争点在：

- **语言贴合度。** Agno 服务 Python 优先的团队；Mastra 服务 TypeScript 优先的团队。
- **runtime 工效（ergonomics）。** Agno = 接近零开销；Mastra = 与 Vercel 生态融合。
- **可观测性。** 两者都能集成 Langfuse / Phoenix / Opik（见第 24 课），但 Mastra Studio 是 Mastra 自家的一等公民。

### 何时选谁

- **Agno** —— Python 后端、大量短命 agent、对性能要求强、FastAPI 技术栈。
- **Mastra** —— TypeScript 后端、Next.js / Vercel 部署、需要统一多 provider 的模型路由、Zod 类型化的 tool。
- **LangGraph**（第 13 课）—— 当持久化状态和显式图推理比纯速度更重要。
- **OpenAI / Claude Agent SDK** —— 当你想要厂商提供的产品化形态（第 16–17 课）。

### 这套模式在哪些地方会翻车

- **为性能而性能。** 工作负载是「每个请求来一次慢 agent 调用」时还选 Agno，因为「2μs」听起来好。开销根本不是瓶颈。
- **生态绑定。** Mastra 的 Vercel 风味集成在 Vercel 上是加分，在别处就是减分。
- **企业许可证混淆。** Mastra 的 `ee/` 目录是 source-available，不是 Apache 2.0。打算 fork 之前先把许可证读清楚。

## 动手实现（Build It）

本课主要是对比性质 —— 单一代码 artifact 没法同时把两个框架讲透。请看 `code/main.py`，一个并排的玩具示例：把「跑一个 agent、流式输出、持久化 session」的最小流程实现两遍（一遍 Agno 风格，一遍 Mastra 风格）。

运行：

```
python3 code/main.py
```

会得到两条结构不同但功能等价的 trace。

## 用起来（Use It）

- **Agno** —— 既要速度又要 FastAPI 形态的 Python 后端。
- **Mastra** —— 多 provider、需要 workflow primitive 的 TypeScript 后端。
- 两者都自带一等公民的可观测性钩子。两者都能集成 Langfuse。

## 上线部署（Ship It）

`outputs/skill-runtime-picker.md` 会基于技术栈、延迟预算和运维形态，在 Agno、Mastra、LangGraph 或某个厂商 SDK 之间帮你做选择。

## 练习（Exercises）

1. 读 Agno 文档。把第 01 课用标准库写的 ReAct loop 移植到 Agno。哪些代码消失了？哪些还在？
2. 读 Mastra 文档。把同一个 loop 移植到 Mastra。tool 的类型化部分发生了什么变化（Zod vs 啥都没有）？
3. 跑个 benchmark：在你自己的技术栈上测 agent 实例化延迟。Agno 的 2μs 对你的负载真的重要吗？
4. 设计一次迁移：如果你在 Python 里跑的是 CrewAI，搬到 Agno 会断掉哪些东西？
5. 读 Mastra `ee/` 的许可证条款。哪些限制会影响一个开源 fork？

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际是什么 |
|------|----------------|------------------------|
| Agno | 「快速的 Python agent」 | 无状态、按 session 作用域的 agent runtime |
| Mastra | 「跑在 Vercel AI SDK 上的 TypeScript agent」 | Agents + Tools + Workflows + 模型路由 |
| Unified Model Router | 「多 provider 接入」 | 一个客户端打通 94 家 provider 的 3,300+ 模型 |
| Composite storage | 「多后端」 | memory / workflows / 可观测性各落各的 store |
| Mastra Studio | 「本地调试器」 | 用于内省 agent 的 localhost:4111 UI |
| Source-available | 「不是开源」 | 许可证允许读源码但限制商用 |

## 延伸阅读（Further Reading）

- [Agno Agent Framework docs](https://www.agno.com/agent-framework) —— 性能指标、FastAPI 集成
- [Mastra docs](https://mastra.ai/docs) —— primitive、server adapter、模型路由
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) —— 有状态图的另一种选择
- [Comet Opik](https://www.comet.com/site/products/opik/) —— Mastra 集成中引用的可观测性对比
