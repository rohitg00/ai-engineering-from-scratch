# Agno 与 Mastra：生产级运行时

> Agno（Python）和 Mastra（TypeScript）是 2026 年的生产级运行时组合。Agno 致力于微秒级的 Agent 实例化和无状态 FastAPI 后端。Mastra 则在 Vercel AI SDK 基础上，提供 Agent、工具、工作流、统一模型路由和复合存储能力。

**类型：** 学习
**语言：** Python, TypeScript
**前置知识：** 第14阶段·01（Agent循环），第14阶段·13（LangGraph）
**时间：** 约45分钟

## 学习目标

- 识别 Agno 的性能目标及其适用场景。
- 说出 Mastra 的三种原语——Agent、工具、工作流——以及支持的服务器适配器。
- 解释为什么无状态会话级 FastAPI 后端是推荐的 Agno 生产路径。
- 针对给定的技术栈（Python优先 vs TypeScript优先），选择 Agno 或 Mastra。

## 问题

LangGraph、AutoGen、CrewAI 都是重量级框架。那些只想要"快速、符合自身运行时的 Agent 循环"的团队会转向 Agno（Python）或 Mastra（TypeScript）。两者都用部分框架原语换取了原始速度和更好的技术栈契合度。

## 概念

### Agno

- Python 运行时，前身为 Phi-data。
- "没有图、链或复杂的模式——只有纯 Python。"
- 官方文档中的性能目标：约 2μs 的 Agent 实例化，约 3.75 KiB 内存/Agent，约 23 个模型提供商。
- 生产路径：无状态会话级 FastAPI 后端。每个请求启动一个全新的 Agent；会话状态保存在数据库中。
- 原生多模态（文本、图像、音频、视频、文件）和 Agent RAG。

当每秒有数千个短生命周期的 Agent（聊天汇聚、评估流水线）时，速度目标才真正重要；当一个 Agent 运行 10 分钟时，速度就没那么关键了。

### Mastra

- TypeScript，构建在 Vercel AI SDK 之上。
- 三种原语：**Agent**、**工具**（Zod 类型化）、**工作流**。
- 统一模型路由器 —— 94 个提供商、3300+ 模型（2026年3月数据）。
- 复合存储：内存、工作流、可观测性可分别存储到不同的后端；大规模场景下推荐使用 ClickHouse 进行可观测性。
- Apache 2.0 协议，`ee/` 目录采用源码可用的企业协议。
- 服务器适配器支持 Express、Hono、Fastify、Koa；与 Next.js 和 Astro 提供一流的集成。
- 提供 Mastra Studio（localhost:4111）用于调试。
- 截至 1.0 版本（2026年1月），GitHub 星数 22000+，周 npm 下载量 300000+。

### 定位

两者都不是试图成为 LangGraph。它们在以下方面竞争：

- **语言契合度。** Agno 面向 Python 优先的团队；Mastra 面向 TypeScript 优先的团队。
- **运行时体验。** Agno = 接近零开销；Mastra = 与 Vercel 生态集成。
- **可观测性。** 两者都与 Langfuse/Phoenix/Opik（第24课）集成，但 Mastra Studio 是第一方工具。

### 选择时机

- **Agno**——Python 后端，大量短生命周期 Agent，对性能有强要求，FastAPI 团队。
- **Mastra**——TypeScript 后端，Next.js / Vercel 部署，统一多提供商模型路由，Zod 类型化工具。
- **LangGraph**（第13课）——当持久化状态和显式图推理比原始速度更重要时。
- **OpenAI / Claude Agent SDK**——当你想使用提供商产品化的形态时（第16–17课）。

### 这种模式的误区

- **为性能而性能。** 仅仅因为"2μs"听起来很好就选择 Agno，但实际负载是每个请求一个慢速 Agent 调用——开销并不是瓶颈。
- **生态锁定。** Mastra 的 Vercel 风格集成在 Vercel 上是优势，在其他环境则是劣势。
- **企业协议混淆。** Mastra 的 `ee/` 目录是源码可用的，而非 Apache 2.0。如果你计划复刻，请仔细阅读协议。

## 动手构建

本节课主要是比较性的——单一代码示例无法公允地展现两个框架的特色。请参阅 `code/main.py` 中的对比示例：一个最小化的"运行 Agent、流式输出、持久化会话"流程，分别用 Agno 和 Mastra 各实现一次。

运行方式：

```
python3 code/main.py
```

两种结构不同但功能等价的执行过程。

## 使用场景

- **Agno**——需要速度和 FastAPI 形态的 Python 后端。
- **Mastra**——拥有多提供商和工作流原语的 TypeScript 后端。
- 两者都提供第一方可观测性钩子，都支持与 Langfuse 集成。

## 交付

`outputs/skill-runtime-picker.md` 根据技术栈、延迟预算和运营形态，在 Agno、Mastra、LangGraph 或提供商 SDK 之间进行选择。

## 练习

1. 阅读 Agno 官方文档，将标准库 ReAct 循环（第01课）移植到 Agno。哪些东西消失了？哪些保留了？
2. 阅读 Mastra 官方文档，将同一循环移植到 Mastra。工具类型化（Zod vs 无类型化）发生了什么变化？
3. 基准测试：在你的技术栈上测量 Agent 实例化延迟。Agno 的 2μs 对你的工作负载重要吗？
4. 设计迁移方案：如果你一直在 Python 中使用 CrewAI，迁移到 Agno 会破坏什么？
5. 阅读 Mastra 的 `ee/` 协议条款，哪些限制会影响开源复刻？

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|---------|---------|
| Agno | "快速的 Python Agent" | 无状态会话级 Agent 运行时 |
| Mastra | "Vercel AI SDK 上的 TypeScript Agent" | Agent + 工具 + 工作流 + 模型路由器 |
| 统一模型路由器 | "多提供商访问" | 单个客户端可访问 94 个提供商的 3300+ 模型 |
| 复合存储 | "多后端" | 内存/工作流/可观测性分别存储到不同数据存储 |
| Mastra Studio | "本地调试器" | localhost:4111 的 Agent 内省 UI |
| 源码可用 | "非开源" | 协议允许阅读源码但限制商业使用 |

## 延伸阅读

- [Agno Agent Framework 文档](https://www.agno.com/agent-framework) — 性能目标、FastAPI 集成
- [Mastra 文档](https://mastra.ai/docs) — 原语、服务器适配器、模型路由器
- [LangGraph 概览](https://docs.langchain.com/oss/python/langgraph/overview) — 有状态图的替代方案
- [Comet Opik](https://www.comet.com/site/products/opik/) — Mastra 集成中引用的可观测性对比
