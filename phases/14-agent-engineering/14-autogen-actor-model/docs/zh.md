# AutoGen v0.4：Actor 模型与 agent 框架

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> AutoGen v0.4（Microsoft Research，2025 年 1 月）围绕 actor 模型重做了 agent 编排：异步消息交换、事件驱动的 agent、按 actor 隔离的故障域、天生的并发能力。该框架目前进入维护模式，由 Microsoft Agent Framework（2025 年 10 月公开预览）接棒。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 描述 actor 模型：agent 即 actor，消息是唯一的 IPC，故障按 actor 隔离。
- 说出 AutoGen v0.4 的三层 API —— Core、AgentChat、Extensions —— 各自的用途。
- 解释为什么把消息投递与处理解耦，能带来故障隔离和天然并发。
- 用 Python 标准库实现一个 actor runtime，并把一个双 agent 的代码评审流程移植上去。

## 问题（The Problem）

大多数 agent 框架是同步的：一个 agent 生产，一个 agent 消费，全在同一个调用栈里。一处出错整个栈崩。并发是后期硬塞进去的。要做分布式还得重写。

AutoGen v0.4 的回答：actor 模型。每个 agent 是一个 actor，拥有私有的收件箱（inbox）。消息是唯一的交互方式。runtime 把投递和处理解耦。故障被隔离在单个 actor 内。并发是原生的。分布式不过是换个 transport。

## 概念（The Concept）

### Actors

一个 actor 包含：

- 私有 state（外部永远不能直接动）。
- 一个 inbox（消息队列）。
- 一个 handler：`receive(message) -> effects`，effects 可以是「回复」「向其他 actor 发消息」「派生新 actor」「更新 state」「停止自己」。

两个 actor 不共享内存。它们只能互发消息。

### AutoGen v0.4 的三层 API（Three API layers in AutoGen v0.4）

1. **Core.** 底层 actor 框架。`AgentRuntime`、`Agent`、`Message`、`Topic`。异步消息交换，事件驱动。
2. **AgentChat.** 任务驱动的高层 API（替代 v0.2 的 ConversableAgent）。`AssistantAgent`、`UserProxyAgent`、`RoundRobinGroupChat`、`SelectorGroupChat`。
3. **Extensions.** 集成层 —— OpenAI、Anthropic、Azure、工具、memory。

### 为什么解耦很重要（Why decoupling matters）

在 v0.2 的模型里，调用 `agent_a.chat(agent_b)` 会同步阻塞 agent_a，直到 agent_b 返回。在 v0.4 里，`send(agent_b, msg)` 把消息塞进 agent_b 的 inbox 然后立即返回，runtime 稍后投递。由此带来三个结果：

- **故障隔离（Fault isolation）。** Agent B 崩了不会拖垮 Agent A —— runtime 在 B 的 handler 里捕获异常，自己决定怎么处理（记日志、重试、扔到死信队列）。
- **天然并发（Natural concurrency）。** 同一时刻可以有大量消息在飞，actor 们并发地消费各自的 inbox。
- **天生适合分布式（Distribution-ready）。** 不论 actor 在本进程还是在另一台机器上，「inbox + transport」都是同一套抽象。

### 拓扑（Topologies）

- **RoundRobinGroupChat.** Agent 按固定轮次依次发言。
- **SelectorGroupChat.** 一个 selector agent 根据对话上下文选下一个发言者。
- **Magentic-One.** 参考实现的多 agent 团队，覆盖网页浏览、代码执行、文件处理，构建在 AgentChat 之上。

### 可观测性（Observability）

内置 OpenTelemetry 支持。每条消息都会 emit 一个 span；tool 调用会按 2026 年 OTel GenAI 语义约定（参见第 23 课）携带 `gen_ai.*` 属性。

### 状态：维护模式（Status: maintenance mode）

2026 年初：AutoGen v0.7.x 适合研究和原型，状态稳定。Microsoft 已经把主要研发力量切到 Microsoft Agent Framework（2025 年 10 月公开预览，1.0 GA 目标是 2026 年 Q1 末）。AutoGen 的模式可以平滑前向移植 —— actor 模型才是那个能长期沉淀的核心想法。

## 动手实现（Build It）

`code/main.py` 用 Python 标准库实现了一个 actor runtime：

- `Message` —— 带类型的 payload，包含 `sender`、`recipient`、`topic`、`body`。
- `Actor` —— 抽象基类，定义 `receive(message, runtime)`。
- `Runtime` —— 共享队列 + 投递 + 故障隔离的事件循环。
- 一个双 actor demo：`ReviewerAgent` 评审代码，`ChecklistAgent` 跑一份检查清单；两者来回发消息直到达成共识。

运行：

```
python3 code/main.py
```

trace 会展示消息投递、一个 actor 里被模拟出来的故障没有把另一个搞挂，以及最终在共同的 verdict（裁决）上收敛。

## 用起来（Use It）

- **AutoGen v0.4/v0.7**（维护中）—— 研究、原型、多 agent 模式都还稳定可用。
- **Microsoft Agent Framework**（公开预览）—— 前向路径；同一套 actor 模型思想，换了一套更新的 API。
- **LangGraph swarm topology**（第 13 课）—— 通过共享工具的 handoff（交接）实现类似模式。
- **自研 actor runtime** —— 当你需要特定 transport（NATS、RabbitMQ、gRPC）时。

## 上线部署（Ship It）

`outputs/skill-actor-runtime.md` 会为指定的多 agent 任务生成一个最小的 actor runtime，外加一个团队模板（RoundRobin 或 Selector）。

## 练习（Exercises）

1. 加一个死信队列：当 handler 抛异常时，把这条失败消息停到一边给人审。在你的玩具里 DLQ 多久会被命中一次？
2. 实现 `SelectorGroupChat`：让一个 selector actor 根据对话状态来挑下一条消息由谁处理。
3. 加上分布式 transport：把进程内队列换成 JSON-over-HTTP 服务，让 actor 跑在不同进程里。
4. 给每条消息接一个 OTel span（或者一个 no-op 占位符）。按第 23 课 emit `gen_ai.agent.name`、`gen_ai.operation.name`。
5. 读一遍 AutoGen v0.4 的架构博客，把你的玩具移植到真正的 `autogen_core` API 上。你跳过的哪些东西在生产里其实很重要？

## 关键术语（Key Terms）

| 术语 | 大家嘴上怎么说 | 真正的含义 |
|------|----------------|------------------------|
| Actor | 「Agent」 | 私有 state + inbox + handler；不共享内存 |
| Message | 「Event」 | 带类型的 payload；actor 之间唯一的交互方式 |
| Inbox | 「Mailbox」 | 每个 actor 自己的待处理消息队列 |
| Runtime | 「Agent host」 | 路由消息并隔离故障的事件循环 |
| Topic | 「Channel」 | actor 之间命名的发布-订阅通道 |
| Fault isolation | 「Let it crash」 | 一个 actor 崩了不会带崩别人 |
| RoundRobinGroupChat | 「固定轮次团队」 | Agent 按顺序轮流发言 |
| SelectorGroupChat | 「上下文路由团队」 | 由 selector 来挑下一个发言者 |
| Magentic-One | 「参考团队」 | 覆盖网页 + 代码 + 文件的多 agent 班子 |

## 延伸阅读（Further Reading）

- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) —— 重设计博客
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) —— 图结构的另一种选择
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— AutoGen 默认 emit 的 span
