# 29 · 生产环境运行时：队列、事件、定时任务

> 生产级智能体运行在六种运行时形态上：请求-响应（request-response）、流式（streaming）、持久化执行（durable execution）、基于队列的后台处理（queue-based background）、事件驱动（event-driven）和定时调度（scheduled）。先选形态，再选框架。在每一种形态下，可观测性（observability）都是承重结构。

**类型：** 学习
**语言：** Python（标准库）
**前置：** Phase 14 · 13（LangGraph）、Phase 14 · 22（语音）
**时长：** 约 60 分钟

## 学习目标

- 说出六种生产运行时形态，并将每一种匹配到对应的框架 / 产品模式。
- 解释为什么持久化执行（LangGraph）对长周期任务至关重要。
- 描述事件驱动运行时，以及 Claude Managed Agents 适用的场景。
- 解释「可观测性是多步智能体的承重结构」这一论断。

## 问题所在

生产级智能体的失败方式，是 Jupyter notebook 暴露不出来的：第 37 步遇到网络超时、用户在语音通话中途挂断、定时任务在机器重启时崩溃、后台 worker 内存耗尽。运行时形态决定了哪些失败是可以幸存（survivable）的。

## 核心概念

### 请求-响应（Request-response）

- 同步 HTTP。用户等待执行完成。
- 仅适用于短任务（<30s）。
- 技术栈：Agno（Python + FastAPI）、Mastra（TypeScript + Express/Hono/Fastify/Koa）。
- 可观测性：标准 HTTP 访问日志 + OTel span。

### 流式（Streaming）

- 用 SSE 或 WebSocket 实现渐进式输出。
- LiveKit 将其扩展到 WebRTC，用于语音/视频（第 22 课）。
- 技术栈：任何支持流式的框架 + 能处理 SSE/WS 的前端。
- 可观测性：逐块（per-chunk）耗时、首 token 延迟、尾部延迟（tail latency）。

### 持久化执行（Durable execution）

- 每一步之后都对状态做检查点（checkpoint）；失败时自动恢复。
- AutoGen v0.4 的 actor 模型将故障隔离到单个智能体（第 14 课）。
- 这是 LangGraph 的核心差异化能力（第 13 课）。
- 当步数未知、且恢复成本很高时不可或缺。

### 基于队列 / 后台（Queue-based / background）

- 任务进入队列，worker 取出执行，结果通过 webhook 或发布-订阅（pub/sub）回传。
- 对长周期智能体不可或缺（每个任务数十到数百步，参见 Anthropic 的 computer use 发布公告）。
- 技术栈：Celery（Python）、BullMQ（Node）、SQS + Lambda（AWS）、自建方案。
- 可观测性：队列深度（queue depth）、单任务延迟分布、死信队列（DLQ）大小。

### 事件驱动（Event-driven）

- 智能体订阅触发器：新邮件、PR 被打开、定时任务触发。
- Claude Managed Agents 开箱即用地覆盖这一形态（第 17 课）。
- CrewAI Flows（第 15 课）用于构建事件驱动的确定性工作流。
- 可观测性：触发源、事件到启动的延迟、智能体延迟。

### 定时调度（Scheduled）

- 类 cron 形态的智能体，周期性运行。
- 与持久化执行结合，让失败的夜间任务能在下一个周期（tick）恢复。
- 技术栈：Kubernetes CronJob + 一个持久化框架；托管方案（Render cron、Vercel cron）。

### 2026 年的部署模式

- **CrewAI Flows** 用于事件驱动的生产环境。
- **Agno** 无状态 FastAPI，用于 Python 微服务。
- **Mastra** 服务端适配器（Express、Hono、Fastify、Koa），用于嵌入式集成。
- **Pipecat Cloud / LiveKit Cloud** 用于托管语音（第 22 课）。
- **Claude Managed Agents** 用于托管的长时间运行异步任务。

### 可观测性是承重结构

如果没有 OpenTelemetry GenAI span（第 23 课）外加 Langfuse/Phoenix/Opik 后端（第 24 课），你就无法调试一个在第 40 步失败的多步智能体。这在生产环境中不是可选项。它决定了你是「快速调试」还是「加更多日志后从头重放」。

### 生产运行时在哪里翻车

- **选错形态。** 给一个耗时 5 分钟的任务选了请求-响应。用户挂断；worker 堆积；重试相互叠加。
- **没有 DLQ。** 队列 worker 没有死信机制。失败的任务凭空消失。
- **后台工作不透明。** 后台智能体运行时没有导出 trace。在用户上报之前，失败都是不可见的。
- **跳过持久化状态。** 任何运行超过 30 秒、且承担不起重启代价的任务，都需要持久化执行。

## 动手实现

`code/main.py` 是一个标准库实现的多形态演示：

- 请求-响应端点（普通函数）。
- 流式处理器（生成器）。
- 带 DLQ 的基于队列的 worker。
- 事件触发器注册表。
- 类 cron 形态的调度器。

运行它：

```bash
python3 code/main.py
```

输出：五条 trace，展示每种形态在同一任务上的行为。相同的智能体逻辑，不同的外层外壳。持久化执行（第六种形态）刻意放在第 13 课中，结合 LangGraph 的检查点机制来讲解。

## 如何使用

- **请求-响应** 用于聊天式交互体验。
- **流式** 用于渐进式响应。
- **持久化** 用于长周期任务。
- **队列** 用于批处理 / 异步 / 长时间运行。
- **事件** 用于智能体的反应式行为。
- **Cron** 用于日常维护（内存整理、评测、成本报告）。

## 交付落地

`outputs/skill-runtime-shape.md` 为一个任务选定运行时形态，并接好可观测性需求。

## 练习

1. 把你第 01 课的 ReAct 循环移植到你技术栈中的全部六种形态。哪种形态适合哪种产品界面？
2. 给基于队列的演示加上 DLQ。模拟 10% 的任务失败率；暴露出 DLQ 大小。
3. 写一个定时触发的评测智能体，每晚针对当天前 20 条 trace 运行。
4. 实现带背压（backpressure）的流式：如果客户端很慢，就暂停智能体。这与轮次预算（turn budget）如何交互？
5. 阅读 Claude Managed Agents 文档。在什么情况下你会把自托管的长周期智能体迁移到托管方案？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| 请求-响应（Request-response） | 「同步」 | 用户等待；仅限短任务 |
| 流式（Streaming） | 「SSE / WS」 | 渐进式输出；更好的体验；延迟可按块观测 |
| 持久化执行（Durable execution） | 「从失败处恢复」 | 状态有检查点；从最后一步重启 |
| 基于队列（Queue-based） | 「后台任务」 | 生产者 / worker 池 / DLQ |
| 事件驱动（Event-driven） | 「基于触发器」 | 智能体对外部事件做出反应 |
| DLQ | 「死信队列」 | 失败任务的停车场 |
| Claude Managed Agents | 「托管 harness」 | Anthropic 托管的长时间运行异步任务，带缓存（caching）+ 压缩（compaction） |

## 延伸阅读

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) — 持久化执行细节
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) — 托管的长时间运行异步任务
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) — 「每个任务数十到数百步」
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) — actor 模型的故障隔离
