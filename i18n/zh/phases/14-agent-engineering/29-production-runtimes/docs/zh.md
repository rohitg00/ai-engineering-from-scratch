# 生产运行时间:排列,事件,时间表

> 制作代理运行在六种运行时间形状上:请求响应,流媒体,耐用执行,排队背景,事件驱动和计划. 在选择框架之前选择形状.可观测性在每个形状上承载.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 13 (LangGraph), Phase 14 · 22 (Voice)
**Time:** ~60 minutes

## 学习目标

- 列出六种生产运行时间形状,并将每一种形状与框架/产品模式相匹配.
- 解释为什么长期执行 (长图) 对长期任务很重要.
- 描述活动驱动的运行时间以及Claude Managed Agents适合时.
- 解释多步骤剂的可观测量载荷承载要求.

## 问题

制作代理在Jupyter笔记本书不出现的方式失败:在第37步时,网络时间停止,用户在中音调中挂,机器重启时,cron工作会死亡,背景工作者会失去内存.运行时间的形状决定了哪些故障是可存活的.

## 概念

### 要求-回应

- 用户等待完成.
- 只有短任务 (<30s) 实现.
- 堆:Agnó (Python + FastAPI),Mastra (TypeScript + Express/Hono/Fastify/Koa).
- 观察性:标准HTTP访问日志 + OTel跨度.

### 流媒体

- 通过 SSE 或 WebSocket进行渐进输出.
- 现场开户将此扩展到WebRTC语音/视频 (课2)
- 堆:任何有流媒体支持的框架+处理SSE/WS的前端.
- 观察性:每分钟时间,第一代标的延迟,尾声延迟.

### 持续执行

- 检查站每一步后,自动恢复失败.
- 机器人v0.4演员模型将失败分离为一个代理 (课 14).
- 长度图的核心分辨器 (课13).
- 基本的情况是, 步骤数量不清楚, 恢复成本高.

### 基于队列/背景

- 工作人员接待,结果通过网页或酒吧/潜水艇回流.
- 对于长视线代理 (每项任务的几十到数百步,根据人类计算机使用公告)
- 堆:菜 (Python),BullMQ (节点),SQS + Lambda (AWS),定制.
- 观察性:排队深度,每工作延迟分布,DLQ大小.

### 事件驱动

- 代理人会订阅触发器:新电子邮件,公关开,时间火.
- 克劳德管理代理人 (Claude Managed Agents) 解释了这一点 (课17).
- 工作人员AI流程 (课 15) 构建基于事件的确定性工作流程.
- 观察性:触发源,事件到启动延迟,代理延迟.

### 时间表

- 时间表的代理.
- 结合耐用执行,以使每晚一次失败的运行重启下一次.
- 堆: Kubernetes CronJob + 持久框架; 主机 (Render cron, Vercel cron).

### 2026部署模式

- **CrewAI Flows**对于活动驱动的生产.
- **Agno**无国有的Python微服务FastAPI.
- **Mastra**服务器适配器 (Express,Hono,Fastify,Koa) 用于嵌入.
- **Pipecat Cloud / LiveKit Cloud**对于管理声音 (课2)
- **Claude Managed Agents**对于长期运行的主机异步.

### 可观测性是承载性

没有OpenTelemetry GenAI跨度 (课3) 加上Langfuse/Phoenix/Opik后端 (课24),你不能调试40步失败的多步骤代理.这不是生产的选择性.这是"我们快速调试"和"我们从零开始重复,更多的记录".

### 生产运行时间失败

- **Wrong shape choice.**选取5分钟的任务的请求-响应.用户挂了电话,工人堆积了,重复试验复杂.
- **No DLQ.**没有死字的员工排队,失败的工作消失.
- **Opaque background work.**后台代理运行,没有出口痕迹. 失败是不可见的,直到用户报告它们.
- **Skipping durable state.**任何运行超过30秒,你无法再启动的运行需要持久的执行.

```figure
wb-runtime-shapes
```

## 建立它

`code/main.py`是一个多形体现式的 stdlib:

- 要求响应终端点 (平函数).
- 流动处理器 (发电机).
- 排队员,有DLQ.
- 事件触发程序.
- 时间表表表.

运行它:

```bash
python3 code/main.py
npx tsx code/main.ts
```

输出:五个痕迹显示每个形状的行为在同一任务上.相同的代理逻辑,不同的外层.持续执行 (第六个形状) 是故意在13课中通过LangGraph检查点覆盖的.

## 用它

- **Request-response**对于聊天式的UX.
- **Streaming**对于渐进的反应.
- **Durable**对于长远任务.
- **Queue**对于批量/异步/长期使用.
- **Event**对于代理反应性.
- **Cron**对于家庭管理 (内存整合,评估,成本报告).

## 运送它

`outputs/skill-runtime-shape.md`选择一个任务的运行时间形状,并线索可观测性要求.

## 运动

1. 根据你的学习方法,你需要在一个模型中找到一个模型.
2. 加入一个DLQ到排队的演示. 模拟10%的失败工作;表面DLQ大小.
3. 写一个 cron-触发的评估代理, 每晚都会对照你当天的前20个痕迹.
4. 执行反压的流媒体:如果客户端缓慢,请暂停代理.
5. 你什么时候会把一个自主主持的长视线代理转移到管理?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Request-response | "Synchronous" | User waits; short tasks only |
| Streaming | "SSE / WS" | Progressive output; better UX; latency observable per chunk |
| Durable execution | "Resume from failure" | Checkpointed state; restart at last step |
| Queue-based | "Background jobs" | Producer / worker pool / DLQ |
| Event-driven | "Trigger-based" | Agent reacts to external events |
| DLQ | "Dead-letter queue" | Parking lot for failed jobs |
| Claude Managed Agents | "Hosted harness" | Anthropic-hosted long-running async with caching + compaction |

## 进一步阅读

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)持续执行细节
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)长期的主机异步
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) "每项任务每次的几十到数百步"
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/)演员模型故障隔离
