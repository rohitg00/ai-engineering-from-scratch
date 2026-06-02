# 生产环境运行时：队列、事件、定时（Production Runtimes: Queue, Event, Cron）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 生产环境的 agent 跑在六种运行时形态上：请求-响应（request-response）、流式（streaming）、持久化执行（durable execution）、基于队列的后台（queue-based background）、事件驱动（event-driven）、定时触发（scheduled）。先选形态，再选框架。可观测性（observability）在每一种形态里都是承重墙。

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 13 (LangGraph), Phase 14 · 22 (Voice)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 说出六种生产运行时形态，并把每种映射到对应的框架 / 产品模式。
- 解释为什么持久化执行（durable execution，LangGraph）对长链路任务（long-horizon）至关重要。
- 描述事件驱动运行时，以及 Claude Managed Agents 适合什么场景。
- 解释「可观测性是承重墙」这一论断对多步 agent 的意义。

## 问题（The Problem）

生产环境里 agent 的失败方式，是 Jupyter notebook 暴露不出来的：第 37 步网络超时、用户在语音通话中途挂断、cron 任务在机器重启时挂掉、后台 worker 内存耗尽。运行时形态决定了哪些故障是可以幸存下来的。

## 概念（The Concept）

### 请求-响应（Request-response）

- 同步 HTTP。用户一直等到完成。
- 只对短任务（<30 秒）可行。
- 技术栈：Agno（Python + FastAPI）、Mastra（TypeScript + Express/Hono/Fastify/Koa）。
- 可观测性：标准 HTTP 访问日志 + OTel span。

### 流式（Streaming）

- 用 SSE 或 WebSocket 渐进输出。
- LiveKit 把它扩展到 WebRTC，用于语音 / 视频（见第 22 课）。
- 技术栈：任何支持流式的框架 + 一个能处理 SSE/WS 的前端。
- 可观测性：每个 chunk 的耗时、首 token 延迟、尾部延迟（tail latency）。

### 持久化执行（Durable execution）

- 每一步之后都对状态做 checkpoint，失败后自动恢复。
- AutoGen v0.4 的 actor 模型把故障隔离到单个 agent（见第 14 课）。
- LangGraph 的核心差异化能力（见第 13 课）。
- 当步数未知、且重启代价很高时是必备的。

### 基于队列 / 后台（Queue-based / background）

- 任务进入队列，worker 取出处理，结果通过 webhook 或 pub/sub 回流。
- 长链路 agent（每个任务几十到几百步，参见 Anthropic computer use 的发布公告）的必备形态。
- 技术栈：Celery（Python）、BullMQ（Node）、SQS + Lambda（AWS）、自建。
- 可观测性：队列深度（queue depth）、单任务延迟分布、DLQ 大小。

### 事件驱动（Event-driven）

- agent 订阅触发器：新邮件、PR 打开、cron 触发。
- Claude Managed Agents 开箱即用就覆盖这一形态（见第 17 课）。
- CrewAI Flows（见第 15 课）把事件驱动的确定性工作流结构化。
- 可观测性：触发源、事件到启动的延迟、agent 延迟。

### 定时触发（Scheduled）

- cron 形态的 agent，周期性运行。
- 与持久化执行结合，让失败的夜间任务能在下一次 tick 时恢复。
- 技术栈：Kubernetes CronJob + 一个 durable 框架；托管方案（Render cron、Vercel cron）。

### 2026 部署模式（2026 deployment patterns）

- **CrewAI Flows** 用于事件驱动的生产环境。
- **Agno** 无状态 FastAPI，用于 Python 微服务。
- **Mastra** 服务器适配器（Express、Hono、Fastify、Koa）用于嵌入式集成。
- **Pipecat Cloud / LiveKit Cloud** 用于托管语音（见第 22 课）。
- **Claude Managed Agents** 用于托管的长链路异步任务。

### 可观测性是承重墙（Observability is load-bearing）

没有 OpenTelemetry GenAI span（见第 23 课）加上 Langfuse / Phoenix / Opik 这类后端（见第 24 课），你根本无法调试一个在第 40 步挂掉的多步 agent。这在生产环境不是可选项，它是「我们能快速 debug」和「我们加更多日志后从头重放」之间的差别。

### 生产运行时在哪里翻车（Where production runtimes fail）

- **形态选错。** 给 5 分钟任务选了 request-response。用户挂断、worker 堆积、重试雪崩。
- **没有 DLQ。** 队列 worker 没有死信队列（dead-letter）。失败任务直接消失。
- **后台工作不透明。** 后台 agent 跑起来不导出 trace。故障一直看不见，直到用户来报。
- **跳过持久化状态。** 任何超过 30 秒、且承担不起重启代价的任务，都需要 durable execution。

## 动手实现（Build It）

`code/main.py` 是一个仅用标准库的多形态 demo：

- 请求-响应端点（普通函数）。
- 流式 handler（生成器）。
- 带 DLQ 的队列 worker。
- 事件触发器注册表。
- cron 形态的调度器。

运行它：

```bash
python3 code/main.py
```

输出：五条 trace，展示同一任务在每种形态下的行为。同样的 agent 逻辑，不同的外壳。持久化执行（第六种形态）我们故意放到第 13 课讲，配合 LangGraph 的 checkpoint。

## 用起来（Use It）

- **请求-响应（Request-response）** 用于聊天式 UX。
- **流式（Streaming）** 用于渐进响应。
- **持久化（Durable）** 用于长链路任务。
- **队列（Queue）** 用于批处理 / 异步 / 长时间运行。
- **事件（Event）** 用于 agent 的反应式触发。
- **定时（Cron）** 用于杂活（记忆整合、evals、成本报告）。

## 上线部署（Ship It）

`outputs/skill-runtime-shape.md` 为某个任务挑选运行时形态，并把可观测性要求接上。

## 练习（Exercises）

1. 把第 01 课的 ReAct 循环移植到你技术栈下的所有六种形态。哪种形态对应哪种产品界面？
2. 给基于队列的 demo 加一个 DLQ。模拟 10% 任务失败率；把 DLQ 大小暴露出来。
3. 写一个 cron 触发的评估 agent，每天夜里跑一次，对当天 top 20 trace 做评估。
4. 实现带反压（backpressure）的流式：客户端慢了就让 agent 暂停。它和回合预算（turn budget）怎么交互？
5. 读一遍 Claude Managed Agents 的文档。什么时候你会把一个自托管的长链路 agent 迁到托管方案？

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际含义 |
|------|----------------|----------|
| Request-response | 「同步」 | 用户等待；只适合短任务 |
| Streaming | 「SSE / WS」 | 渐进输出；UX 更好；每个 chunk 的延迟可观测 |
| Durable execution | 「从失败处恢复」 | 状态 checkpoint；从最后一步重启 |
| Queue-based | 「后台任务」 | 生产者 / worker 池 / DLQ |
| Event-driven | 「触发器驱动」 | agent 对外部事件做出反应 |
| DLQ | 「死信队列（dead-letter queue）」 | 失败任务的停车场 |
| Claude Managed Agents | 「托管 harness」 | Anthropic 托管的长链路异步执行，带 caching 与 compaction（压缩） |

## 延伸阅读（Further Reading）

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) — 持久化执行细节
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) — 托管的长链路异步
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) — 「每个任务几十到几百步」
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) — actor 模型的故障隔离
