# 生产运行时：队列、事件、Cron

> 生产级 Agent 运行在六种运行时形态上：请求-响应、流式、持久化执行、基于队列的后台、事件驱动和定时调度。先选定形态，再选定框架。无论哪种形态，可观测性都是承重墙。

**Type:** Learn
**Languages:** Python (标准库)
**Prerequisites:** Phase 14 · 13 (LangGraph), Phase 14 · 22 (Voice)
**Time:** ~60 分钟

## 学习目标

- 说出六种生产运行时形态，并将每种形态匹配到相应的框架/产品模式。
- 解释为什么持久化执行(LangGraph)对长周期任务至关重要。
- 描述事件驱动运行时，以及 Claude Managed Agents 何时适用。
- 解释"可观测性是承重墙"这一主张对多步 Agent 的意义。

## 问题所在

生产环境中的 Agent 会以 Jupyter notebook 中无法暴露的方式失败：第 37 步出现网络超时、用户在语音通话中途挂断、cron 任务在机器重启后丢失、后台 worker 内存耗尽。运行时形态决定了哪些失败是可恢复的。

## 概念

### 请求-响应

- 同步 HTTP。用户等待完成。
- 仅适用于短任务(<30 秒)。
- 技术栈：Agno (Python + FastAPI)、Mastra (TypeScript + Express/Hono/Fastify/Koa)。
- 可观测性：标准 HTTP 访问日志 + OTel span。

### 流式

- 使用 SSE 或 WebSocket 进行渐进式输出。
- LiveKit 将其扩展到 WebRTC 以支持语音/视频(第 22 课)。
- 技术栈：任何支持流式的框架 + 处理 SSE/WS 的前端。
- 可观测性：逐 chunk 计时、首 token 延迟、尾延迟。

### 持久化执行

- 每一步之后都检查点化状态；失败时自动恢复。
- AutoGen v0.4 的 actor 模型将故障隔离到单个 agent(第 14 课)。
- LangGraph 的核心差异化特性(第 13 课)。
- 当步骤数未知且恢复成本高时必不可少。

### 基于队列 / 后台

- 任务进入队列，worker 领取，结果通过 webhook 或 pub/sub 返回。
- 对长周期 Agent 至关重要(依据 Anthropic 的 computer use 公告，每个任务有数十到数百步)。
- 技术栈：Celery (Python)、BullMQ (Node)、SQS + Lambda (AWS)、自建方案。
- 可观测性：队列深度、每任务延迟分布、DLQ 大小。

### 事件驱动

- Agent 订阅触发器：新邮件、PR 打开、cron 触发。
- Claude Managed Agents 开箱即用地覆盖了这一场景(第 17 课)。
- CrewAI Flows(第 15 课)用于结构化事件驱动的确定性工作流。
- 可观测性：触发源、事件到启动的延迟、agent 延迟。

### 定时调度

- 周期性运行的 cron 形态 Agent。
- 与持久化执行结合，使失败的夜间运行在下一个周期恢复。
- 技术栈：Kubernetes CronJob + 持久化框架；托管服务(Render cron、Vercel cron)。

### 2026 年部署模式

- **CrewAI Flows** 用于事件驱动的生产环境。
- **Agno** 无状态 FastAPI 用于 Python 微服务。
- **Mastra** 服务器适配器(Express、Hono、Fastify、Koa)用于嵌入式场景。
- **Pipecat Cloud / LiveKit Cloud** 用于托管语音(第 22 课)。
- **Claude Managed Agents** 用于托管的长时异步任务。

### 可观测性是承重墙

如果没有 OpenTelemetry GenAI span(第 23 课)加上 Langfuse/Phoenix/Opik 后端(第 24 课)，你将无法调试在第 40 步失败的多步 Agent。这对生产环境不是可选项。它决定了是"我们快速调试"还是"我们从零重放并增加更多日志"。

### 生产运行时的常见失败点

- **形态选择错误。** 为一个 5 分钟的任务选择请求-响应。用户挂断;worker 堆积；重试不断叠加。
- **没有 DLQ。** 队列 worker 没有死信队列。失败的任务凭空消失。
- **不透明的后台工作。** 后台 agent 运行时没有导出 trace。失败在用户报告之前不可见。
- **跳过持久化状态。** 任何超过 30 秒且无法承受重启的运行都需要持久化执行。

```figure
wb-runtime-shapes
```

## 动手构建

`code/main.py` 是一个基于标准库的多形态演示：

- 请求-响应端点(普通函数)。
- 流式处理器(生成器)。
- 带 DLQ 的基于队列的 worker。
- 事件触发器注册表。
- cron 形态的调度器。

运行它：

```bash
python3 code/main.py
```

输出：五条 trace,展示每种形态在同一任务上的行为。相同的 agent 逻辑，不同的外壳。持久化执行(第六种形态)有意在第 13 课中结合 LangGraph 检查点机制讲解。

## 使用场景

- **请求-响应** 用于聊天式 UX。
- **流式** 用于渐进式响应。
- **持久化** 用于长周期任务。
- **队列** 用于批处理/异步/长时间运行。
- **事件** 用于 agent 响应外部刺激。
- **Cron** 用于日常维护(记忆整合、评估、成本报告)。

## 上线交付

`outputs/skill-runtime-shape.md` 为一个任务选择运行时形态，并配置相应的可观测性要求。

## 练习

1. 将你的第 01 课 ReAct 循环移植到你技术栈中的全部六种形态。哪种形态适合哪种产品界面？
2. 为基于队列的演示添加 DLQ。模拟 10% 的任务失败率；展示 DLQ 大小。
3. 编写一个 cron 触发的评估 agent,每晚针对当天的前 20 条 trace 运行。
4. 实现带背压的流式处理：如果客户端变慢，暂停 agent。这与轮次预算如何交互？
5. 阅读 Claude Managed Agents 文档。何时你会将自托管的长周期 agent 迁移到托管服务？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| 请求-响应 | "同步" | 用户等待；仅限短任务 |
| 流式 | "SSE / WS" | 渐进式输出；更好的 UX;延迟可逐 chunk 观测 |
| 持久化执行 | "从失败处恢复" | 检查点化状态；从最后一步重启 |
| 基于队列 | "后台任务" | 生产者 / worker 池 / DLQ |
| 事件驱动 | "基于触发器" | agent 响应外部事件 |
| DLQ | "死信队列" | 失败任务的存放区 |
| Claude Managed Agents | "托管 harness" | Anthropic 托管的长时异步，带缓存 + 压缩 |

## 延伸阅读

- [LangGraph 概览](https://docs.langchain.com/oss/python/langgraph/overview) — 持久化执行细节
- [Claude Managed Agents 概览](https://platform.claude.com/docs/en/managed-agents/overview) — 托管的长时异步
- [Anthropic,Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) — "每个任务数十到数百步"
- [AutoGen v0.4(Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) — actor 模型故障隔离