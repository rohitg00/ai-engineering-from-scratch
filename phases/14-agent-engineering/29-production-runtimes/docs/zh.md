# 生产运行时：队列、事件与定时任务

> 生产级智能体运行在六种运行时形态上：请求-响应、流式、持久化执行、基于队列的后台、事件驱动和定时调度。在选择框架之前，先选对形态。可观测性是每种形态中的承重结构。

**类型：** 学习  
**语言：** Python（标准库）  
**前置知识：** 阶段 14 · 13（LangGraph），阶段 14 · 22（语音）  
**时间：** 约 60 分钟

## 学习目标

- 列举六种生产运行时形态，并将每种形态对应到相应的框架/产品模式。
- 解释为什么持久化执行（LangGraph）对长周期任务至关重要。
- 描述事件驱动运行时以及 Claude Managed Agents 的适用场景。
- 阐述「可观测性即承重结构」这一论断对多步骤智能体的含义。

## 问题

生产级智能体失败的方式是 Jupyter notebook 暴露不出来的：第 37 步网络超时、用户在语音通话中途挂断、定时任务因机器重启而挂掉、后台 worker 内存耗尽。运行时形态决定了哪些故障是可恢复的。

## 概念

### 请求-响应

- 同步 HTTP。用户等待完成。
- 仅适用于短任务（< 30 秒）。
- 技术栈：Agno（Python + FastAPI）、Mastra（TypeScript + Express/Hono/Fastify/Koa）。
- 可观测性：标准 HTTP 访问日志 + OTel 跨度（span）。

### 流式

- SSE 或 WebSocket，用于渐进式输出。
- LiveKit 将其扩展到 WebRTC，用于语音/视频（第 22 课）。
- 技术栈：任何支持流式的框架 + 处理 SSE/WS 的前端。
- 可观测性：每块（chunk）耗时、首 token 延迟、尾延迟。

### 持久化执行

- 每一步之后对状态做检查点（checkpoint）；失败时自动恢复。
- AutoGen v0.4 的 actor 模型将故障隔离在单个智能体内（第 14 课）。
- LangGraph 的核心差异化特性（第 13 课）。
- 当步骤数未知且恢复成本高昂时必不可少。

### 基于队列 / 后台

- 任务进入队列，worker 领取，结果通过 webhook 或 pub/sub 回流。
- 对长周期智能体至关重要（每项任务数十到数百个步骤，参见 Anthropic 的计算机使用公告）。
- 技术栈：Celery（Python）、BullMQ（Node）、SQS + Lambda（AWS）、自定义实现。
- 可观测性：队列深度、每任务延迟分布、死信队列（DLQ）大小。

### 事件驱动

- 智能体订阅触发器：收到新邮件、PR 被打开、定时任务触发。
- Claude Managed Agents 原生支持（第 17 课）。
- CrewAI Flows（第 15 课）用于构建事件驱动的确定性工作流。
- 可观测性：触发器来源、事件到启动的延迟、智能体延迟。

### 定时调度

- 按 Cron 模式定期运行的智能体。
- 与持久化执行结合，使失败的夜间运行能在下一次调度时恢复。
- 技术栈：Kubernetes CronJob + 持久化框架；托管方案（Render cron、Vercel cron）。

### 2026 年部署模式

- **CrewAI Flows**：用于事件驱动的生产环境。
- **Agno**：无状态 FastAPI，用于 Python 微服务。
- **Mastra** 服务器适配器（Express、Hono、Fastify、Koa）：用于嵌入集成。
- **Pipecat Cloud / LiveKit Cloud**：用于托管语音（第 22 课）。
- **Claude Managed Agents**：用于托管的长时间运行异步任务。

### 可观测性是承重结构

没有 OpenTelemetry GenAI 跨度（第 23 课）加上 Langfuse / Phoenix / Opik 后端（第 24 课），你无法调试在第 40 步失败的多步骤智能体。在生产环境中，这不是可选项。它决定了你是「快速调试」还是「从头重放并加更多日志」。

### 生产运行时常见的失败模式

- **选错形态。** 为一个 5 分钟的任务选择请求-响应。用户挂断、worker 堆积、重试叠加。
- **没有 DLQ。** 队列 worker 没有死信处理。失败的任务消失得无影无踪。
- **不透明的后台任务。** 后台智能体运行时没有导出追踪。故障在用户报告之前完全不可见。
- **跳过持久化状态。** 任何运行超过 30 秒且无法承受重启代价的任务，都需要持久化执行。

## 动手构建

`code/main.py` 是一个基于标准库的多形态演示：

- 请求-响应端点（普通函数）。
- 流式处理器（生成器）。
- 基于队列的 worker，带 DLQ。
- 事件触发器注册表。
- Cron 形状的调度器。

运行方式：

```bash
python3 code/main.py
```

输出：五条追踪记录，展示每种形态对同一任务的行为。智能体逻辑相同，外层壳不同。持久化执行（第六种形态）有意放在第 13 课中通过 LangGraph 检查点机制讲解。

## 使用场景

- **请求-响应**：聊天风格的用户体验。
- **流式**：渐进式响应。
- **持久化**：长周期任务。
- **队列**：批处理 / 异步 / 长时间运行。
- **事件**：智能体响应式触发。
- **定时任务**：系统维护（记忆整合、评估、成本报告）。

## 交付产出

`outputs/skill-runtime-shape.md`：为一个任务挑选运行时形态，并配置可观测性需求。

## 练习

1. 将你在第 01 课实现的 ReAct 循环移植到你技术栈中的所有六种形态。哪种形态适合哪种产品场景？
2. 为基于队列的演示添加 DLQ。模拟 10% 的任务失败，展示 DLQ 大小。
3. 编写一个由定时任务触发的评估智能体，每天夜间对你的前 20 条追踪记录进行评测。
4. 实现带背压（backpressure）的流式：如果客户端太慢，暂停智能体。这与轮次预算（turn budget）如何交互？
5. 阅读 Claude Managed Agents 文档。什么时候应该将自托管的长周期智能体迁移到托管方案？

## 关键术语

| 术语 | 通俗说法 | 实际含义 |
|------|----------|----------|
| 请求-响应 | "同步" | 用户等待；仅限短任务 |
| 流式 | "SSE / WS" | 渐进式输出；更好的用户体验；每块延迟可观测 |
| 持久化执行 | "从失败中恢复" | 检查点状态；从最后一步重启 |
| 基于队列 | "后台任务" | 生产者 / worker 池 / DLQ |
| 事件驱动 | "基于触发器" | 智能体响应外部事件 |
| DLQ | "死信队列" | 失败任务的停车场 |
| Claude Managed Agents | "托管 harness" | Anthropic 托管的长时间运行异步任务，带缓存＋压缩 |

## 延伸阅读

- [LangGraph 概述](https://docs.langchain.com/oss/python/langgraph/overview) — 持久化执行详情
- [Claude Managed Agents 概述](https://platform.claude.com/docs/en/managed-agents/overview) — 托管长时间运行异步任务
- [Anthropic：Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) — "每项任务数十到数百个步骤"
- [AutoGen v0.4（微软研究院）](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) — actor 模型故障隔离
