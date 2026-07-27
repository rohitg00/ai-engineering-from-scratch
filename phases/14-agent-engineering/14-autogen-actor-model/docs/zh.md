# AutoGen v0.4：Actor 模型与智能体框架

> AutoGen v0.4（微软研究院，2025 年 1 月）围绕 actor 模型重新设计了智能体编排。异步消息交换、事件驱动智能体、故障隔离、天然并发。该框架现已进入维护模式，而微软智能体框架（2025 年 10 月公开预览）将成为继任者。

**类型：** 学习 + 构建
**语言：** Python（标准库）
**前置要求：** 阶段 14 · 01（智能体循环），阶段 14 · 12（工作流模式）
**预计时间：** ~75 分钟

## 学习目标

- 描述 actor 模型：智能体作为 actor，消息作为唯一的 IPC，每个 actor 的故障隔离。
- 说出 AutoGen v0.4 的三个 API 层——Core、AgentChat、Extensions——以及各自的用途。
- 解释为何将消息投递与处理解耦能实现故障隔离和天然并发。
- 在 Python 中使用标准库实现一个 actor 运行时，并将一个双智能体代码审查流程迁移到该运行时上。

## 问题所在

大多数智能体框架是同步的：一个智能体生产，一个智能体消费，形成调用栈。故障会使整个栈崩溃。并发是事后附加的。分布式需要重写。

AutoGen v0.4 的答案：actor 模型。每个智能体都是一个带有私有信箱的 actor。消息是唯一的交互方式。运行时将投递与处理解耦。故障隔离在单个 actor 内。并发是原生的。分布式只是不同的传输方式。

## 概念

### Actor

Actor 包含：

- 私有状态（外部永远不能直接访问）。
- 一个信箱（消息队列）。
- 一个处理器：`receive(message) -> effects`，其中的 effects 可以是"回复"、"发送给其他 actor"、"生成新 actor"、"更新状态"、"停止自身"。

两个 actor 不能共享内存。它们只能发送消息。

### AutoGen v0.4 的三个 API 层

1. **Core**——底层 actor 框架。`AgentRuntime`、`Agent`、`Message`、`Topic`。异步消息交换，事件驱动。
2. **AgentChat**——任务驱动的高层 API（替代 v0.2 的 ConversableAgent）。`AssistantAgent`、`UserProxyAgent`、`RoundRobinGroupChat`、`SelectorGroupChat`。
3. **Extensions**——集成层。OpenAI、Anthropic、Azure、工具、记忆。

### 为什么解耦很重要

在 v0.2 模型中，调用 `agent_a.chat(agent_b)` 会同步阻塞 agent_a，直到 agent_b 返回。在 v0.4 中，`send(agent_b, msg)` 将消息放入 agent_b 的信箱后立即返回。运行时稍后投递。三个结果：

- **故障隔离**——Agent B 崩溃不会导致 Agent A 崩溃——运行时在 B 的处理器中捕获故障并决定如何处理（记录日志、重试、死信）。
- **天然并发**——多条消息同时传输；actor 并发处理自己的信箱。
- **可分布式**——无论 actor 在进程内还是另一台主机上，信箱 + 传输都是相同的抽象。

### 拓扑结构

- **RoundRobinGroupChat**——智能体按固定顺序轮流发言。
- **SelectorGroupChat**——一个选择器智能体根据对话上下文决定下一个发言者。
- **Magentic-One**——用于网页浏览、代码执行、文件处理的参考多智能体团队。基于 AgentChat 构建。

### 可观测性

内置 OpenTelemetry 支持。每条消息发出一个 span；工具调用携带 `gen_ai.*` 属性，遵循 2026 年 OTel GenAI 语义约定（第 23 课）。

### 状态：维护模式

2026 年初：AutoGen v0.7.x 对研究和原型开发是稳定的。微软已将活跃开发转移至微软智能体框架（2025 年 10 月 1 日公开预览；1.0 GA 目标为 2026 年第一季度末）。AutoGen 的模式可以干净地迁移——actor 模型才是持久的思想。

## 构建

`code/main.py` 实现了一个标准库 actor 运行时：

- `Message`——带有 `sender`、`recipient`、`topic`、`body` 的类型化载荷。
- `Actor`——带有 `receive(message, runtime)` 的抽象类。
- `Runtime`——带有共享队列、投递机制、故障隔离的事件循环。
- 一个双 actor 演示：`ReviewerAgent` 审查代码，`ChecklistAgent` 运行检查清单；它们交换消息直至达成共识。

运行：

```
python3 code/main.py
```

追踪输出显示消息投递、一个 actor 中模拟的故障不会导致另一个崩溃，以及最终收敛于一个共同的裁决。

## 使用

- **AutoGen v0.4/v0.7**（维护模式）——对研究、原型开发和多智能体模式稳定。
- **微软智能体框架**（公开预览）——前进的方向；在焕然一新的 API 中采用相同的 actor 模型思想。
- **LangGraph swarm 拓扑**（第 13 课）——通过共享工具切换实现的类似模式。
- **自定义 actor 运行时**——当你需要特定的传输方式（NATS、RabbitMQ、gRPC）时。

## 产出

`outputs/skill-actor-runtime.md` 生成一个最小 actor 运行时，以及针对给定多智能体任务的团队模板（RoundRobin 或 Selector）。

## 练习

1. 添加死信队列：当处理器抛出异常时，将失败的消息暂存以供人工检查。在你的玩具中，死信队列被命中的频率有多高？
2. 实现 `SelectorGroupChat`：一个选择器 actor 根据对话状态选择谁来处理下一条消息。
3. 添加分布式传输：将进程内队列替换为基于 JSON-over-HTTP 的服务器，以便 actor 可以在独立进程中运行。
4. 为每条消息接入一个 OTel span（或一个无操作替代品）。按照第 23 课的要求，发出 `gen_ai.agent.name`、`gen_ai.operation.name`。
5. 阅读 AutoGen v0.4 的架构博文。将你的玩具移植到真实的 `autogen_core` API。你跳过了哪些在生产环境中很重要的东西？

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|------------|----------|
| Actor | "智能体" | 私有状态 + 信箱 + 处理器；无共享内存 |
| Message | "事件" | 类型化载荷；actor 之间交互的唯一方式 |
| Inbox | "信箱" | 每个 actor 的待处理消息队列 |
| Runtime | "智能体主机" | 路由消息并隔离故障的事件循环 |
| Topic | "频道" | actor 之间的命名发布-订阅路由 |
| Fault isolation | "让它崩溃" | 一个 actor 失败不会导致其他 actor 崩溃 |
| RoundRobinGroupChat | "固定轮转团队" | 智能体按顺序轮流发言 |
| SelectorGroupChat | "上下文路由团队" | 选择器决定谁下一个发言 |
| Magentic-One | "参考团队" | 用于网页 + 代码 + 文件的多智能体编组 |

## 延伸阅读

- [AutoGen v0.4，微软研究院](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/)——重新设计博文
- [LangGraph 概述](https://docs.langchain.com/oss/python/langgraph/overview)——图形状的替代方案
- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/)——AutoGen 默认发出的 span
