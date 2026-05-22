# 生产运行时：队列、事件、Cron

> 生产智能体在六种运行时形态上运行：请求-响应、流式传输、持久执行、基于队列的后台、事件驱动和定时调度。在选择框架之前选择形态。可观测性在每种形态中都是承重的。

**类型：** 学习
**语言：** Python（标准库）
**前置条件：** 阶段 14 · 13（LangGraph），阶段 14 · 22（语音）
**时间：** ~60 分钟

## 学习目标

- 命名六种生产运行时形态并将每种匹配到框架/产品模式。
- 解释为什么持久执行（LangGraph）对长周期任务很重要。
- 描述事件驱动运行时以及 Claude Managed Agents 何时适合。
- 解释多步骤智能体的可观测性即承重主张。

## 问题

生产智能体以 Jupyter notebook 不会暴露的方式失败：第 37 步的网络超时、用户在语音通话中途挂断、cron 作业在机器重启时死掉、后台工作器内存不足。运行时形态决定哪些失败是可存活的。

## 概念

### 请求-响应

- 同步 HTTP。用户等待完成。
- 仅对短任务可行（<30秒）。
- 技术栈：Agno（Python + FastAPI）、Mastra（TypeScript + Express/Hono/Fastify/Koa）。
- 可观测性：标准 HTTP 访问日志 + OTel span。

### 流式传输

- 用于渐进式输出的 SSE 或 WebSocket。
- LiveKit 通过 WebRTC 将其扩展到语音/视频（课程 22）。
- 技术栈：任何支持流式传输的框架 + 处理 SSE/WS 的前端。
- 可观测性：每块计时、首 token 延迟、尾部延迟。

### 持久执行

- 每步后状态检查点化；失败时自动恢复。
- AutoGen v0.4 参与者模型将失败隔离到一个智能体（课程 14）。
- LangGraph 的核心差异化因素（课程 13）。
- 当步骤数未知且恢复成本很高时至关重要。

### 基于队列/后台

- 作业进入队列，工作器接管，结果通过 webhook 或 pub/sub 流回。
- 对长周期智能体至关重要（根据 Anthropic 的计算机使用公告，每个任务数十到数百个步骤）。
- 技术栈：Celery（Python）、BullMQ（Node）、SQS + Lambda（AWS）、自定义。
- 可观测性：队列深度、每作业延迟分布、DLQ 大小。

### 事件驱动

- 智能体订阅触发器：新邮件、PR 打开、cron 触发。
- Claude Managed Agents 开箱即用覆盖此点（课程 17）。
- CrewAI Flows（课程 15）构建事件驱动的确定性工作流。
- 可观测性：触发器源、事件到启动延迟、智能体延迟。

### 定时调度

- 定期运行的 Cron 形态智能体。
- 与持久执行结合，以便失败的夜间运行在下次触发时恢复。
- 技术栈：Kubernetes CronJob + 持久框架；托管（Render cron、Vercel cron）。

### 2026 年部署模式

- **CrewAI Flows** 用于事件驱动生产。
- **Agno** 无状态 FastAPI 用于 Python 微服务。
- **Mastra** 服务器适配器（Express、Hono、Fastify、Koa）用于嵌入。
- **Pipecat Cloud / LiveKit Cloud** 用于托管语音（课程 22）。
- **Claude Managed Agents** 用于托管长时间运行异步。

### 可观测性即承重

没有 OpenTelemetry GenAI span（课程 23）加上 Langfuse/Phoenix/Opik 后端（课程 24），您无法调试在第 40 步失败的多步骤智能体。这对生产不是可选的。这是"我们快速调试"和"我们用更多日志从头重放"之间的区别。

### 生产运行时失败的地方

- **错误形态选择。** 为 5 分钟任务选择请求-响应。用户挂断；工作器堆积；重试复合。
- **无 DLQ。** 没有死信的队列工作器。失败的作业消失。
- **不透明后台工作。** 后台智能体运行而无跟踪导出。失败在用户报告之前不可见。
- **跳过持久状态。** 任何 > 30 秒且您无法承受重新启动的运行都需要持久执行。

## 构建

`code/main.py` 是标准库多形态演示：

- 请求-响应端点（普通函数）。
- 流式处理程序（生成器）。
- 带 DLQ 的基于队列的工作器。
- 事件触发器注册表。
- Cron 形态调度器。

运行它：

```bash
python3 code/main.py
```

输出：显示相同任务上每种形态行为的五个跟踪。相同的智能体逻辑，不同的外壳。持久执行（第六种形态）有意在课程 13 中用 LangGraph 检查点覆盖。

## 使用

- **请求-响应** 用于聊天风格 UX。
- **流式传输** 用于渐进式响应。
- **持久** 用于长周期任务。
- **队列** 用于批处理/异步/长时间运行。
- **事件** 用于智能体反应性。
- **Cron** 用于内务（内存整合、评估、成本报告）。

## 交付

`outputs/skill-runtime-shape.md` 为任务选择运行时形态并连接可观测性要求。

## 练习

1. 将您的课程 01 ReAct 循环移植到您技术栈中的所有六种形态。哪种形态适合哪种产品表面？
2. 向基于队列的演示添加 DLQ。模拟 10% 作业失败；显示 DLQ 大小。
3. 编写定时触发的评估智能体，每晚针对当天的 top 20 跟踪运行。
4. 实现带背压的流式传输：如果客户端慢，暂停智能体。这与轮次预算如何交互？
5. 阅读 Claude Managed Agents 文档。何时会将自托管长周期智能体移动到托管？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| 请求-响应 | "同步" | 用户等待；仅短任务 |
| 流式传输 | "SSE / WS" | 渐进式输出；更好的 UX；每块可观测延迟 |
| 持久执行 | "从失败恢复" | 检查点化状态；在最后一步重新启动 |
| 基于队列 | "后台作业" | 生产者/工作器池/DLQ |
| 事件驱动 | "基于触发器" | 智能体对外部事件做出反应 |
| DLQ | "死信队列" | 失败作业的停车场 |
| Claude Managed Agents | "托管 harness" | Anthropic 托管的长时间运行异步，带缓存 + 压缩 |

## 延伸阅读

- [LangGraph 概述](https://docs.langchain.com/oss/python/langgraph/overview) — 持久执行详细信息
- [Claude Managed Agents 概述](https://platform.claude.com/docs/en/managed-agents/overview) — 托管长时间运行异步
- [Anthropic，介绍计算机使用](https://www.anthropic.com/news/3-5-models-and-computer-use) — "每个任务数十到数百个步骤"
- [AutoGen v0.4（Microsoft Research）](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) — 参与者模型故障隔离
