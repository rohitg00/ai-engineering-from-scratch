# 面向智能体的 Actor 模型 —— 异步消息与类型化运行时

> 智能体即 actor:异步消息交换、事件驱动的处理器、故障隔离、天然并发。AutoGen v0.4(微软研究院,2025 年 1 月)围绕该模型重新设计了智能体编排;该框架目前处于维护模式,其生产环境继任者为 Microsoft Agent Framework(2025 年 10 月公开预览)。

**Type:** Learn + Build
**Languages:** Python(标准库)
**Prerequisites:** 阶段 14 · 01(Agent Loop)、阶段 14 · 12(Workflow Patterns)
**Time:** 约 75 分钟

## 学习目标

- 描述 actor 模型:智能体作为 actor、消息作为唯一的 IPC、按 actor 隔离故障。
- 说出 AutoGen v0.4 的三层 API —— Core、AgentChat、Extensions —— 及各自的用途。
- 解释为什么将消息投递与处理解耦能带来故障隔离与天然并发。
- 用 Python 标准库实现一个 actor 运行时,并将双智能体代码评审流程移植到其上。

## 问题

大多数智能体框架是同步的:一个智能体生产、一个智能体消费,处于同一个调用栈中。故障会击垮整个栈。并发是事后拼凑的。分布式需要重写。

AutoGen v0.4 的答案是 actor 模型。每个智能体是一个拥有私有收件箱的 actor。消息是唯一的交互方式。运行时将投递与处理解耦。故障只隔离到单个 actor。并发是原生的。分布式只是换一种传输方式。

## 概念

### Actor

一个 actor 拥有:

- 私有状态(外部不可直接访问)。
- 收件箱(消息队列)。
- 处理器:`receive(message) -> effects`,其中可能的副作用包括"回复"、"发送给其他 actor"、"派生新 actor"、"更新状态"、"停止自身"。

两个 actor 不能共享内存。它们只能发送消息。

### 三层 API

AutoGen v0.4 将其接口分为三层:

1. **Core.** 低层 actor 框架。`AgentRuntime`、`Agent`、`Message`、`Topic`。异步消息交换,事件驱动。
2. **AgentChat.** 任务驱动的高层 API(v0.2 中 ConversableAgent 的替代品)。`AssistantAgent`、`UserProxyAgent`、`RoundRobinGroupChat`、`SelectorGroupChat`。
3. **Extensions.** 集成 —— OpenAI、Anthropic、Azure、工具、记忆。

### 为什么解耦重要

在 v0.2 模型中,同步调用 `agent_a.chat(agent_b)` 会阻塞 agent_a 直到 agent_b 返回。在 v0.4 中,`send(agent_b, msg)` 将消息放入 agent_b 的收件箱后立即返回,由运行时稍后投递。这带来三个结果:

- **故障隔离。** Agent B 崩溃不会击垮 Agent A —— 运行时在 B 的处理器中捕获故障并决定如何处理(记录日志、重试、死信)。
- **天然并发。** 多条消息可同时在途;各 actor 并发处理自己的收件箱。
- **分布式就绪。** 无论 actor 在进程内还是在另一台主机上,收件箱 + 传输都是同一抽象。

### 拓扑

- **RoundRobinGroupChat.** 智能体按固定轮换依次发言。
- **SelectorGroupChat.** 由一个 selector 智能体根据对话上下文决定下一个发言者。
- **Magentic-One.** 用于网页浏览、代码执行、文件处理的多智能体参考实现。构建于 AgentChat 之上。

### 可观测性

内置 OpenTelemetry 支持。每条消息发出一个 span;工具调用按 2026 年 OTel GenAI 语义约定(第 23 课)携带 `gen_ai.*` 属性。

### 状态:维护模式

2026 年初:AutoGen v0.7.x 对于研究和原型开发仍然稳定。微软已将活跃开发转向 Microsoft Agent Framework,即其生产环境继任者(2025 年 10 月 1 日公开预览;1.0 GA 目标为 2026 年第一季度末)。AutoGen 的模式可以平滑迁移 —— actor 模型才是持久的理念。

```figure
actor-mailbox
```

## 动手构建

`code/main.py` 实现了一个基于标准库的 actor 运行时:

- `Message` —— 带 `sender`、`recipient`、`topic`、`body` 的类型化载荷。
- `Actor` —— 带有 `receive(message, runtime)` 的抽象类。
- `Runtime` —— 事件循环,带共享队列、投递和故障隔离。
- 双 actor 演示:`ReviewerAgent` 评审代码,`ChecklistAgent` 运行检查清单;两者交换消息直到达成共识。

运行:

```
python3 code/main.py
```

追踪输出展示了消息投递、某个 actor 中的一次模拟故障(未击垮另一个 actor),以及最终对共同结论的收敛。

## 使用它

- **AutoGen v0.4/v0.7**(维护中)—— 研究与原型开发、多智能体模式使用稳定。
- **Microsoft Agent Framework** —— 生产环境继任者(2025 年 10 月公开预览);以焕新的 API 承载同样的 actor 模型理念。
- **LangGraph swarm 拓扑**(第 13 课)—— 通过共享工具交接实现类似模式。
- **自定义 actor 运行时** —— 当你需要特定传输(NATS、RabbitMQ、gRPC)时。

## 上线它

`outputs/skill-actor-runtime.md` 针对给定的多智能体任务,生成一个最小 actor 运行时以及团队模板(RoundRobin 或 Selector)。

## 练习

1. 添加死信队列:当处理器抛出异常时,将失败消息暂存以供人工检查。在你的玩具实现中,DLQ 被触发的频率有多高?
2. 实现 `SelectorGroupChat`:由一个 selector actor 根据对话状态决定谁处理下一条消息。
3. 添加分布式传输:将进程内队列替换为基于 JSON over HTTP 的服务器,使 actor 可以运行在独立进程中。
4. 为每条消息接入一个 OTel span(或一个空操作替身)。按第 23 课的要求发出 `gen_ai.agent.name`、`gen_ai.operation.name`。
5. 阅读 AutoGen v0.4 的架构文章。将你的玩具实现移植到真实的 `autogen_core` API 上。你省略了哪些在生产环境中很重要的部分?

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Actor | "Agent" | 私有状态 + 收件箱 + 处理器;无共享内存 |
| Message | "事件" | 类型化载荷;actor 交互的唯一方式 |
| Inbox | "邮箱" | 每个 actor 的待处理消息队列 |
| Runtime | "智能体宿主" | 路由消息并隔离故障的事件循环 |
| Topic | "频道" | actor 之间命名的发布-订阅路由 |
| Fault isolation | "任其崩溃" | 一个 actor 失败不会击垮其他 actor |
| RoundRobinGroupChat | "固定轮换团队" | 智能体按顺序依次发言 |
| SelectorGroupChat | "上下文路由团队" | 由 selector 决定下一个发言者 |
| Magentic-One | "参考团队" | 处理网页 + 代码 + 文件的多智能体小队 |

## 延伸阅读

- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) —— 重设计文章
- [LangGraph 概览](https://docs.langchain.com/oss/python/langgraph/overview) —— 图结构的替代方案
- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— AutoGen 默认发出的 span