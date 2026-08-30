# 生产运行时：队列、事件、定时任务

> 生产 agent 运行在六种运行时形态上：请求-响应、流式、持久执行、基于队列的后台、事件驱动和定时调度。在选择框架之前先选择形态。可观察性在每个形态上都是承重结构。

**类型：** 学习
**语言：** Python（标准库）
**前置条件：** 第 14 阶段 · 13（LangGraph），第 14 阶段 · 22（语音）
**时间：** ~60 分钟

## 学习目标

- 说出六种生产运行时形态，并将每种匹配到框架/产品模式。
- 解释为什么持久执行（LangGraph）对长程任务很重要。
- 描述事件驱动运行时以及 Claude Managed Agents 何时适用。
- 解释多步 agent 的可观察性作为承重结构的主张。

## 问题

生产 agent 以 Jupyter notebook 不会暴露的方式失败：步骤 37 的网络超时、语音通话中用户挂断、定时任务在机器重启时死亡、后台工作者内存耗尽。运行时形态决定哪些失败是可恢复的。

## 概念

### 请求-响应

- 同步 HTTP。用户等待完成。
- 仅适用于短任务（<30s）。
- 技术栈：Agno（Python + FastAPI）、Mastra（TypeScript + Express/Hono/Fastify/Koa）。
- 可观察性：标准 HTTP 访问日志 + OTel span。

### 流式

- SSE 或 WebSocket 用于渐进输出。
- LiveKit 将其扩展到语音/视频的 WebRTC（第 22 课）。
- 技术栈：任何支持流式的框架 + 处理 SSE/WS 的前端。
- 可观察性：每块时间、首 token 延迟、尾部延迟。

### 持久执行

- 每步后状态检查点；失败时自动恢复。
- AutoGen v0.4 actor 模型将失败隔离到一个 agent（第 14 课）。
- LangGraph 的核心差异化（第 13 课）。
- 当步骤数未知且恢复成本高时必不可少。

### 基于队列 / 后台

- 作业进入队列，工作者拾取，结果通过 webhook 或 pub/sub 返回。
- 对长程 agent 必不可少（每个任务数十到数百步，根据 Anthropic 的 computer use 公告）。
- 技术栈：Celery（Python）、BullMQ（Node）、SQS + Lambda（AWS）、自定义。
- 可观察性：队列深度、每作业延迟分布、DLQ 大小。

### 事件驱动

- Agent 订阅触发器：新邮件、PR 打开、定时触发。
- Claude Managed Agents 开箱即用覆盖此功能（第 17 课）。
- CrewAI Flows（第 15 课）构建事件驱动的确定性工作流。
- 可观察性：触发源、事件到启动延迟、agent 延迟。

### 定时调度

- Cron 形状的 agent 定期运行。
- 与持久执行结合，以便失败的夜间运行在下一次触发时恢复。
- 技术栈：Kubernetes CronJob + 持久框架；托管（Render cron、Vercel cron）。

### 2026 年部署模式

- **CrewAI Flows** 用于事件驱动生产。
- **Agno** 无状态 FastAPI 用于 Python 微服务。
- **Mastra** 服务器适配器（Express、Hono、Fastify、Koa）用于嵌入。
- **Pipecat Cloud / LiveKit Cloud** 用于托管语音（第 22 课）。
- **Claude Managed Agents** 用于托管长程异步。

### 可观察性是承重结构

没有 OpenTelemetry GenAI span（第 23 课）加上 Langfuse/Phoenix/Opik 后端（第 24 课），你无法调试在步骤 40 失败的多步 agent。这对生产不是可选的。这是"我们快速调试"和"我们用更多日志从头重放"之间的区别。

### 生产运行时失败的地方

- **错误的形态选择。** 为 5 分钟任务选择请求-响应。用户挂断；工作者堆积；重试复合。
- **无 DLQ。** 队列工作者无死信。失败的作业消失。
- **不透明的后台工作。** 后台 agent 运行无跟踪导出。失败对用户不可见，直到用户报告。
- **跳过持久状态。** 任何运行 > 30 秒且你无法承受重新启动的都需要持久执行。

## 构建

`code/main.py` 是标准库多形态演示：

- 请求-响应端点（普通函数）。
- 流式处理程序（生成器）。
- 带有 DLQ 的基于队列的工作者。
- 事件触发注册表。
- Cron 形状调度器。

运行：

```bash
python3 code/main.py
```

输出：五种跟踪，显示每种形态在相同任务上的行为。相同的 agent 逻辑，不同的外壳。持久执行（第六种形态）有意在第 13 课 LangGraph 检查点中涵盖。

## 使用

- **请求-响应** 用于聊天式 UX。
- **流式** 用于渐进响应。
- **持久** 用于长程任务。
- **队列** 用于批处理 / 异步 / 长运行。
- **事件** 用于 agent 反应性。
- **定时** 用于家务（记忆整合、评估、成本报告）。

## 交付

`outputs/skill-runtime-shape.md` 为任务选择运行时形态并连接可观察性需求。

## 练习

1. 将你的第 01 课 ReAct 循环移植到你的技术栈中的所有六种形态。哪种形态适合哪种产品界面？
2. 向基于队列的演示添加 DLQ。模拟 10% 作业失败；显示 DLQ 大小。
3. 编写定时触发的评估 agent，每晚针对当天的前 20 个跟踪运行。
4. 实现带背压的流式：如果客户端慢，暂停 agent。这与轮次预算如何交互？
5. 阅读 Claude Managed Agents 文档。何时你会将自托管长程 agent 迁移到托管？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Request-response | "同步" | 用户等待；仅短任务 |
| Streaming | "SSE / WS" | 渐进输出；更好的 UX；每块延迟可观察 |
| Durable execution | "从失败恢复" | 检查点状态；从最后一步重启 |
| Queue-based | "后台作业" | 生产者 / 工作者池 / DLQ |
| Event-driven | "基于触发器" | Agent 对外部事件做出反应 |
| DLQ | "死信队列" | 失败作业的停车场 |
| Claude Managed Agents | "托管工具" | Anthropic 托管的长程异步，带缓存 + 压缩 |

## 延伸阅读

- [LangGraph 概述](https://docs.langchain.com/oss/python/langgraph/overview) —— 持久执行细节
- [Claude Managed Agents 概述](https://platform.claude.com/docs/en/managed-agents/overview) —— 托管长程异步
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) —— "每个任务数十到数百步"
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) —— actor 模型故障隔离