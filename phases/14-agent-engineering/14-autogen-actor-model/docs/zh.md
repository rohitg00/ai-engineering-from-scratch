# 14 · AutoGen v0.4：Actor 模型与智能体框架

> AutoGen v0.4（微软研究院，2025 年 1 月）围绕「Actor 模型（actor model）」重新设计了智能体编排：异步消息交换、事件驱动的智能体、故障隔离、天然的并发能力。如今该框架已进入维护模式，而「微软智能体框架（Microsoft Agent Framework）」（2025 年 10 月公开预览）将成为其继任者。

**类型：** 学习 + 构建
**语言：** Python（标准库）
**前置：** 阶段 14 · 01（智能体循环）、阶段 14 · 12（工作流模式）
**时长：** 约 75 分钟

## 学习目标

- 描述 Actor 模型：智能体即「Actor」、消息是唯一的进程间通信（IPC）方式、每个 Actor 各自实现故障隔离。
- 说出 AutoGen v0.4 的三层 API —— Core、AgentChat、Extensions —— 各自的用途。
- 解释为什么把「消息投递」与「消息处理」解耦，能带来故障隔离与天然并发。
- 用 Python 标准库实现一个 Actor 运行时，并把一个双智能体的代码评审流程移植到其上。

## 问题所在

大多数智能体框架是同步的：一个智能体生产，一个智能体消费，全部发生在同一个调用栈上。一处失败就会让整个调用栈崩溃。并发是硬塞进来的。要做分布式则需要重写。

AutoGen v0.4 给出的答案是：Actor 模型。每个智能体都是一个拥有私有收件箱（inbox）的 Actor。消息是唯一的交互手段。运行时（runtime）把投递与处理解耦。失败被隔离在单个 Actor 内。并发是原生的。分布式只不过是换一种传输方式。

## 核心概念

### Actor

一个 Actor 包含：

- 一份私有状态（外部永远不能直接触碰）。
- 一个收件箱（消息队列）。
- 一个处理函数（handler）：`receive(message) -> effects`，其中 effects 可以是「回复」「发送给其他 Actor」「派生新 Actor」「更新状态」「停止自身」。

两个 Actor 不能共享内存。它们只能互相发送消息。

### AutoGen v0.4 的三层 API

1. **Core。** 底层 Actor 框架。`AgentRuntime`、`Agent`、`Message`、`Topic`。异步消息交换，事件驱动。
2. **AgentChat。** 面向任务的高层 API（取代 v0.2 的 ConversableAgent）。`AssistantAgent`、`UserProxyAgent`、`RoundRobinGroupChat`、`SelectorGroupChat`。
3. **Extensions。** 各类集成 —— OpenAI、Anthropic、Azure、工具、记忆。

### 解耦为何重要

在 v0.2 的模型里，同步调用 `agent_a.chat(agent_b)` 会阻塞 agent_a，直到 agent_b 返回。在 v0.4 里，`send(agent_b, msg)` 把消息放进 agent_b 的收件箱后立即返回，运行时稍后再投递。由此带来三点结果：

- **故障隔离（fault isolation）。** Agent B 崩溃不会导致 Agent A 崩溃 —— 运行时会在 B 的处理函数中捕获这次失败，并决定如何处置（记录日志、重试、转入死信队列）。
- **天然并发。** 同一时刻有大量消息在途；各 Actor 并发处理各自的收件箱。
- **可分布式。** 无论 Actor 是在进程内还是在另一台主机上，「收件箱 + 传输」都是同一套抽象。

### 拓扑结构

- **RoundRobinGroupChat。** 智能体按固定轮转顺序依次发言。
- **SelectorGroupChat。** 由一个选择器（selector）智能体根据会话上下文挑选下一个发言者。
- **Magentic-One。** 用于网页浏览、代码执行、文件处理的参考多智能体团队，构建于 AgentChat 之上。

### 可观测性

内置 OpenTelemetry 支持。每条消息都会发出一个 span；工具调用会按照 2026 年 OTel GenAI 语义约定（第 23 课）携带 `gen_ai.*` 属性。

### 状态：维护模式

2026 年初：AutoGen v0.7.x 已稳定，适合研究与原型开发。微软已将活跃开发转向「微软智能体框架（Microsoft Agent Framework）」（2025 年 10 月 1 日公开预览；1.0 正式版（GA）目标定在 2026 年第一季度末）。AutoGen 的模式可以平滑前向移植 —— Actor 模型才是那个经得起时间考验的核心思想。

## 动手构建

`code/main.py` 实现了一个基于标准库的 Actor 运行时：

- `Message` —— 带有 `sender`、`recipient`、`topic`、`body` 的类型化载荷。
- `Actor` —— 抽象类，包含 `receive(message, runtime)`。
- `Runtime` —— 带共享队列的事件循环，负责投递与故障隔离。
- 一个双 Actor 演示：`ReviewerAgent` 评审代码，`ChecklistAgent` 跑一遍检查清单；两者交换消息直至达成共识。

运行它：

```
python3 code/main.py
```

这段追踪记录展示了消息投递过程、其中一个 Actor 的模拟失败（并未拖垮另一个），以及最终收敛到一个共同结论。

## 实战应用

- **AutoGen v0.4/v0.7**（维护中）—— 稳定，适合研究、原型开发、多智能体模式。
- **微软智能体框架（Microsoft Agent Framework）**（公开预览）—— 前进方向；同样的 Actor 模型思想，焕新后的 API。
- **LangGraph 的 swarm 拓扑**（第 13 课）—— 通过共享工具的交接（handoff）实现的类似模式。
- **自定义 Actor 运行时** —— 当你需要特定传输方式（NATS、RabbitMQ、gRPC）时。

## 交付物

`outputs/skill-actor-runtime.md` 会为给定的多智能体任务生成一个极简的 Actor 运行时，外加一个团队模板（RoundRobin 或 Selector）。

## 练习

1. 添加一个死信队列（dead-letter queue）：当处理函数抛出异常时，把这条失败的消息暂存下来供人工检查。在你的玩具示例里 DLQ 被命中的频率有多高？
2. 实现 `SelectorGroupChat`：由一个选择器 Actor 根据会话状态挑选下一条消息由谁处理。
3. 加入分布式传输：把进程内队列替换为一个 JSON-over-HTTP 服务器，让各 Actor 能在独立的进程中运行。
4. 为每条消息接入一个 OTel span（或一个空操作的替身）。按第 23 课发出 `gen_ai.agent.name`、`gen_ai.operation.name`。
5. 阅读 AutoGen v0.4 的架构文章。把你的玩具示例移植到真正的 `autogen_core` API 上。你省略掉了哪些在生产环境中其实很重要的东西？

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| Actor | 「智能体」 | 私有状态 + 收件箱 + 处理函数；无共享内存 |
| Message | 「事件」 | 类型化载荷；Actor 之间交互的唯一方式 |
| Inbox | 「邮箱」 | 每个 Actor 各自的待处理消息队列 |
| Runtime | 「智能体宿主」 | 负责路由消息并隔离故障的事件循环 |
| Topic | 「频道」 | Actor 之间具名的发布-订阅路由 |
| Fault isolation | 「任其崩溃（let it crash）」 | 一个 Actor 失败不会拖垮其他 Actor |
| RoundRobinGroupChat | 「固定轮转团队」 | 智能体按顺序轮流发言 |
| SelectorGroupChat | 「上下文路由团队」 | 由选择器挑选下一个发言者 |
| Magentic-One | 「参考团队」 | 面向网页 + 代码 + 文件的多智能体小队 |

## 延伸阅读

- [AutoGen v0.4，微软研究院](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) —— 那篇重新设计的文章
- [LangGraph 概览](https://docs.langchain.com/oss/python/langgraph/overview) —— 图状结构的替代方案
- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— AutoGen 默认发出的 span
