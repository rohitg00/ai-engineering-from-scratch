# AutoGen v0.4：参与者模型与 Agent 框架

> AutoGen v0.4（Microsoft Research，2025 年 1 月）围绕参与者（Actor）模型重新设计了 Agent 编排。异步消息交换、事件驱动的 Agent、故障隔离、自然并发。该框架目前处于维护模式，而 Microsoft Agent Framework（2025 年 10 月公开预览）成为继任者。

**类型：** 学习与构建
**语言：** Python（标准库）
**前置要求：** 阶段 14 · 01（Agent 循环）、阶段 14 · 12（工作流模式）
**时长：** 约 75 分钟

## 学习目标

- 描述参与者模型：Agent 作为参与者，消息作为唯一的 IPC，每个参与者的故障隔离。
- 说出 AutoGen v0.4 的三层 API——Core、AgentChat、Extensions——以及各自的作用。
- 解释为什么将消息传递与处理解耦能提供故障隔离和自然并发。
- 在 Python 中实现一个标准库参与者运行时，并将一个双 Agent 代码审查流程移植到其上。

## 问题背景

大多数 Agent 框架是同步的：一个 Agent 产生，一个 Agent 消费，在一个调用栈中。故障会崩溃整个栈。并发是强行加上的。分布式需要重写。

AutoGen v0.4 的回答：参与者模型。每个 Agent 是一个带有私有收件箱的参与者。消息是唯一的交互方式。运行时将传递与处理解耦。故障隔离到一个参与者。并发是原生的。分布式只是不同的传输。

## 核心概念

### 参与者（Actors）

一个参与者拥有：

- 私有状态（永远不能从外部直接触及）。
- 收件箱（消息队列）。
- 处理器：`receive(message) -> effects`，其中 effects 可以是"回复"、"发送给其他参与者"、"生成新参与者"、"更新状态"、"停止自身"。

两个参与者不能共享内存。它们只能发送消息。

### AutoGen v0.4 中的三层 API

1. **Core。** 低级参与者框架。`AgentRuntime`、`Agent`、`Message`、`Topic`。异步消息交换，事件驱动。
2. **AgentChat。** 任务驱动的高级 API（取代 v0.2 的 ConversableAgent）。`AssistantAgent`、`UserProxyAgent`、`RoundRobinGroupChat`、`SelectorGroupChat`。
3. **Extensions。** 集成——OpenAI、Anthropic、Azure、工具、记忆。

### 为什么解耦很重要

在 v0.2 模型中，调用 `agent_a.chat(agent_b)` 会同步阻塞 agent_a，直到 agent_b 返回。在 v0.4 中，`send(agent_b, msg)` 将消息放入 agent_b 的收件箱并返回。运行时稍后传递。三个后果：

- **故障隔离。** Agent B 崩溃不会使 Agent A 崩溃——运行时在 B 的处理器中捕获故障并决定做什么（记录、重试、死信）。
- **自然并发。** 一次有多条消息在传输中；参与者并发处理其收件箱。
- **就绪分布式。** 无论参与者是进程内还是另一台主机上，收件箱 + 传输是相同的抽象。

### 拓扑

- **RoundRobinGroupChat。** Agent 按固定轮换顺序轮流。
- **SelectorGroupChat。** 选择者 Agent 根据对话上下文选择谁下一步。
- **Magentic-One。** 用于网页浏览、代码执行、文件处理的参考多 Agent 团队。构建在 AgentChat 之上。

### 可观测性

内置了 OpenTelemetry 支持。每条消息发出一个 span；工具调用按照 2026 年 OTel GenAI 语义约定（第 23 课）携带 `gen_ai.*` 属性。

### 状态：维护模式

2026 年初：AutoGen v0.7.x 对于研究和原型设计是稳定的。Microsoft 已将活跃开发转移到 Microsoft Agent Framework（2025 年 10 月公开预览；1.0 GA 目标 2026 年第一季度末）。AutoGen 模式干净地向前移植——参与者模型是持久的想法。

## 构建它

`code/main.py` 实现一个标准库参与者运行时：

- `Message`——带有 `sender`、`recipient`、`topic`、`body` 的类型化负载。
- `Actor`——带有 `receive(message, runtime)` 的抽象。
- `Runtime`——带有共享队列、传递、故障隔离的事件循环。
- 一个双参与者演示：`ReviewerAgent` 审查代码，`ChecklistAgent` 运行检查清单；它们交换消息直到达成共识。

运行它：

```
python3 code/main.py
```

轨迹显示消息传递、一个参与者中的模拟故障不会使另一个崩溃，以及就共享裁决收敛。

## 使用它

- **AutoGen v0.4/v0.7**（维护）——对于研究、原型设计、多 Agent 模式是稳定的。
- **Microsoft Agent Framework**（公开预览）——前进路径；刷新 API 中的相同参与者模型想法。
- **LangGraph swarm topology**（第 13 课）——通过共享工具移交的类似模式。
- **自定义参与者运行时**——当你需要特定传输（NATS、RabbitMQ、gRPC）时。

## 部署它

`outputs/skill-actor-runtime.md` 为给定的多 Agent 任务生成最小参与者运行时加上团队模板（RoundRobin 或 Selector）。

## 练习

1. 添加死信队列（dead-letter queue）：当处理器引发时，停放失败的消息供人工检查。在你的玩具中 DLQ 多久被命中一次？
2. 实现 `SelectorGroupChat`：选择者参与者根据对话状态选择谁处理下一条消息。
3. 添加分布式传输：将进程内队列换成为 JSON-over-HTTP 服务器，以便参与者可以在单独的进程中运行。
4. 为每条消息接入 OTel span（或 no-op 占位符）。按照第 23 课发出 `gen_ai.agent.name`、`gen_ai.operation.name`。
5. 阅读 AutoGen v0.4 的架构帖子。将你的玩具移植到真实的 `autogen_core` API。你跳过了什么在生产中很重要？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| Actor | "Agent" | 私有状态 + 收件箱 + 处理器；无共享内存 |
| Message | "事件" | 类型化负载；参与者交互的唯一方式 |
| Inbox | "邮箱" | 每个参与者的待处理消息队列 |
| Runtime | "Agent 主机" | 路由消息并隔离故障的事件循环 |
| Topic | "通道" | 参与者之间的命名发布-订阅路由 |
| Fault isolation | "让它崩溃" | 一个参与者失败不会使其他参与者崩溃 |
| RoundRobinGroupChat | "固定轮换团队" | Agent 按顺序轮流 |
| SelectorGroupChat | "上下文路由团队" | 选择者选择谁下一步 |
| Magentic-One | "参考团队" | 用于网页 + 代码 + 文件的多 Agent 小组 |

## 延伸阅读

- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/)——重新设计帖子
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)——图形状的替代方案
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)——span AutoGen 默认发出
