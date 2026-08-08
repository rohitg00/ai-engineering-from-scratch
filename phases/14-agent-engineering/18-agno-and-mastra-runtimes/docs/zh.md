# 18 · Agno 与 Mastra：生产级运行时

> Agno（Python）与 Mastra（TypeScript）是 2026 年生产级运行时的黄金搭档。Agno 主打微秒级的智能体（agent）实例化与无状态的 FastAPI 后端。Mastra 则在 Vercel AI SDK 底座之上提供智能体、工具（tool）、工作流（workflow）、统一模型路由（unified model routing）与组合式存储（composite storage）。

**类型：** 学习
**语言：** Python、TypeScript
**前置：** 阶段 14 · 01（智能体循环）、阶段 14 · 13（LangGraph）
**时长：** 约 45 分钟

## 学习目标

- 识别 Agno 的性能目标，以及它们在何时才真正重要。
- 说出 Mastra 的三大原语（primitive）——智能体（Agents）、工具（Tools）、工作流（Workflows）——以及它所支持的服务器适配器（server adapter）。
- 解释为什么「无状态、会话作用域（session-scoped）的 FastAPI 后端」是推荐的 Agno 生产部署路径。
- 针对给定技术栈在 Agno 与 Mastra 之间做出取舍（Python 优先 vs TypeScript 优先）。

## 问题所在

LangGraph、AutoGen、CrewAI 都属于「重框架」。那些只想要「在我的运行时里跑一个快速的智能体循环」的团队，会转向 Agno（Python）或 Mastra（TypeScript）。二者都以让渡部分由框架掌管的原语为代价，换取原始速度以及与周边技术栈更紧密的契合。

## 核心概念

### Agno

- Python 运行时，前身为 Phi-data。
- 「没有图（graph）、链（chain）或复杂模式——纯粹的 python。」
- 其官方文档给出的性能目标：约 2μs 的智能体实例化、每个智能体约 3.75 KiB 内存、约 23 家模型提供商。
- 生产路径：无状态、会话作用域的 FastAPI 后端。每个请求都会启动一个全新的智能体；会话状态则存放在数据库中。
- 原生多模态（文本、图像、音频、视频、文件）与智能体式 RAG（agentic RAG）。

当你每秒需要成千上万个短生命周期智能体时（聊天扇入、评测流水线），这些速度目标才有意义。而当单个智能体要运行 10 分钟时，它们就没那么重要了。

### Mastra

- TypeScript，构建于 Vercel AI SDK 之上。
- 三大原语：**智能体（Agents）**、**工具（Tools）**（基于 Zod 类型化）、**工作流（Workflows）**。
- 统一模型路由（Unified Model Router）——覆盖 94 家提供商的 3,300+ 模型（2026 年 3 月）。
- 组合式存储（composite storage）：记忆、工作流、可观测性可分别写入不同后端；大规模可观测性场景推荐使用 ClickHouse。
- Apache 2.0 许可证，但源码中的 `ee/` 目录采用「源码可见（source-available）」的企业版许可证。
- 提供面向 Express、Hono、Fastify、Koa 的服务器适配器；对 Next.js 与 Astro 有一流的集成支持。
- 自带 Mastra Studio（localhost:4111）用于调试。
- 在 1.0 版本（2026 年 1 月）已有 22k+ GitHub stars、每周 300k+ npm 下载量。

### 定位

二者都没打算成为 LangGraph。它们竞争的维度在于：

- **语言契合度。** Agno 面向 Python 优先的团队；Mastra 面向 TypeScript 优先的团队。
- **运行时人体工学（runtime ergonomics）。** Agno = 近乎零开销；Mastra = 与 Vercel 生态深度集成。
- **可观测性（observability）。** 二者都能集成 Langfuse/Phoenix/Opik（第 24 课），但 Mastra Studio 是其第一方（first-party）产品。

### 何时选用哪一个

- **Agno** —— Python 后端、大量短生命周期智能体、强性能要求、FastAPI 团队。
- **Mastra** —— TypeScript 后端、Next.js / Vercel 部署、统一的多提供商模型路由、Zod 类型化工具。
- **LangGraph**（第 13 课）—— 当持久化状态与显式的图式推理比原始速度更重要时。
- **OpenAI / Claude Agent SDK** —— 当你想要提供商已产品化的形态时（第 16–17 课）。

### 这一模式何处会出错

- **为性能而性能。** 仅仅因为「2μs」听起来很棒就选 Agno，而实际工作负载是每个请求只有一次缓慢的智能体调用。此时开销根本不是瓶颈。
- **生态锁定（ecosystem lock-in）。** Mastra 的 Vercel 风味集成在 Vercel 上是加分项，在别处则是减分项。
- **企业版许可证混淆。** Mastra 的 `ee/` 目录是源码可见的，并非 Apache 2.0。如果你打算 fork，请先读清许可证。

## 动手构建

本课主要是对比性的——没有哪个单一的代码产物能同时把两个框架都讲透。请参见 `code/main.py` 中的并排玩具示例：一个最小化的「运行智能体、流式输出、持久化会话」流程被实现了两次（一次按 Agno 的形态，一次按 Mastra 的形态）。

运行它：

```
python3 code/main.py
```

两条结构上截然不同、但功能上等价的执行轨迹（trace）。

## 实际运用

- **Agno** —— 需要速度与 FastAPI 形态的 Python 后端。
- **Mastra** —— 拥有众多提供商与工作流原语的 TypeScript 后端。
- 二者都提供第一方可观测性钩子（hook）。二者都能集成 Langfuse。

## 交付成果

`outputs/skill-runtime-picker.md` 会根据技术栈、延迟预算与运维形态，在 Agno、Mastra、LangGraph 或某个提供商 SDK 之间做出选择。

## 练习

1. 阅读 Agno 文档。把标准库版本的 ReAct 循环（第 01 课）移植到 Agno。哪些东西消失了？哪些保留了下来？
2. 阅读 Mastra 文档。把同一个循环移植到 Mastra。工具的类型化方式发生了什么变化（Zod vs 无）？
3. 基准测试：在你自己的技术栈上测量智能体实例化的延迟。Agno 的 2μs 对你的工作负载真的重要吗？
4. 设计一次迁移：如果你一直在用 Python 跑 CrewAI，迁到 Agno 时会有哪些东西失效？
5. 阅读 Mastra 的 `ee/` 许可证条款。哪些限制会影响一个开源 fork？

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| Agno | 「快速的 Python 智能体」 | 无状态、会话作用域的智能体运行时 |
| Mastra | 「构建于 Vercel AI SDK 上的 TypeScript 智能体」 | 智能体 + 工具 + 工作流 + 模型路由 |
| 统一模型路由（Unified Model Router） | 「多提供商访问」 | 一个客户端访问覆盖 94 家提供商的 3,300+ 模型 |
| 组合式存储（Composite storage） | 「多后端」 | 记忆/工作流/可观测性各自写入不同的存储 |
| Mastra Studio | 「本地调试器」 | 用于内省智能体的 localhost:4111 UI |
| 源码可见（Source-available） | 「不是 OSS」 | 许可证允许阅读源码，但限制商业使用 |

## 延伸阅读

- [Agno 智能体框架文档](https://www.agno.com/agent-framework) —— 性能目标、FastAPI 集成
- [Mastra 文档](https://mastra.ai/docs) —— 原语、服务器适配器、模型路由
- [LangGraph 概览](https://docs.langchain.com/oss/python/langgraph/overview) —— 有状态图（stateful-graph）的替代方案
- [Comet Opik](https://www.comet.com/site/products/opik/) —— Mastra 集成所引用的可观测性对比
