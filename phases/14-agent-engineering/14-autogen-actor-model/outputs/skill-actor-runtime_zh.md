---
name: actor-runtime
description: 构建 AutoGen v0.4 风格的 actor 运行时，带有私有状态、每 actor 收件箱、仅消息 IPC、故障隔离和死信队列。
version: 1.0.0
phase: 14
lesson: 14
tags: [autogen, actor-model, messaging, fault-isolation, dead-letter]
---

给定多代理任务，生成 actor 运行时和所需的代理 actor。

生成：

1. `Message` 类型，带有 `sender`、`recipient`、`topic`、`body`、`mid`。
2. `Actor` 基类，带有 `receive(message, runtime)`。Actor 状态是私有的。
3. `Runtime`，带有共享队列、`send()`、`run_until_idle()` 和死信队列。处理程序中的异常进入 DLQ；不要传播。
4. 一个拓扑辅助器：RoundRobin（固定轮换）、Selector（LLM 选择下一个）或自定义广播。
5. 每条消息的可观测性钩子：按照 Lesson 23 发出带有 `gen_ai.agent.name` 和 `gen_ai.operation.name` 的 OTel spans。

硬性拒绝：

- 同步消息传递，阻塞发送者直到接收者返回。那是 v0.2 模型；它破坏故障隔离。
- 跨 actor 的共享可变状态。Actor 通过消息读取状态或根本不读取。
- 传播处理程序异常的运行时。失败属于 DLQ；让其他 actor 继续运行。

拒绝规则：

- 如果任务只有两个 actor 且固定来回，拒绝 actor 框架并建议 prompt chain (Lesson 12)。当有 >=3 个 actor 或异步并发时，actor 才值得成本。
- 如果用户想要"同步模式"以"更容易调试"，拒绝。建议改用日志记录 + 跟踪（Lesson 23）。
- 如果领域是严格的 request/response 且只有一个专家，建议 routing (Lesson 12) 而不是 actor 团队。

输出：`message.py`、`actor.py`、`runtime.py`、`teams.py`、`README.md` 解释 DLQ 策略、拓扑选择和 OTel spans 如何连接。以"what to read next"结束，指向 Lesson 25（multi-agent debate）如果 actor 协商，Lesson 23（OTel）如果需要跟踪，或 Microsoft Agent Framework 如果你想要前瞻性运行时。
