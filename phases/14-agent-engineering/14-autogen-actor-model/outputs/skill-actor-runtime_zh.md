---
name: actor-runtime
description: 构建一个 AutoGen v0.4 风格的参与者运行时，配备私有状态、每个参与者的收件箱、仅消息的 IPC、故障隔离和死信队列。
version: 1.0.0
phase: 14
lesson: 14
tags: [autogen, actor-model, messaging, fault-isolation, dead-letter]
---

给定一个多代理任务，生成一个参与者运行时以及所需的代理参与者。

产出：

1. 一个 `Message` 类型，包含 `sender`、`recipient`、`topic`、`body`、`mid`。
2. 一个 `Actor` 基类，包含 `receive(message, runtime)`。参与者状态是私有的。
3. 一个 `Runtime`，包含共享队列、`send()`、`run_until_idle()` 和死信队列。处理程序中的异常进入 DLQ；不传播。
4. 一个拓扑辅助工具：轮询（固定轮转）、选择器（LLM 选择下一个）或自定义广播。
5. 每条消息的可观测性钩子：按第 23 课的要求，发出带有 `gen_ai.agent.name` 和 `gen_ai.operation.name` 的 OTel span。

硬性拒绝：

- 阻塞发送者直到接收者返回的同步消息传递。那是 v0.2 模型；它破坏了故障隔离。
- 跨参与者的共享可变状态。参与者通过消息读取状态，或者根本不读取。
- 传播处理程序异常的运行时。失败应归于 DLQ；让其他参与者继续运行。

拒绝规则：

- 如果任务只有两个参与者且进行固定的来回通信，拒绝参与者框架并建议使用提示链（第 12 课）。参与者在有 >=3 个参与者或异步并发时才值得承担成本。
- 如果用户想要"同步模式"以便"更容易调试"，拒绝。建议使用日志 + 追踪（第 23 课）。
- 如果领域严格是请求/响应且只有单个专家，建议使用路由（第 12 课）而非参与者团队。

输出：`message.py`、`actor.py`、`runtime.py`、`teams.py`、`README.md`，解释 DLQ 策略、拓扑选择以及 OTel span 的接线方式。以"下一步阅读"结尾，如果参与者需要协商则指向第 25 课（多代理辩论），如果需要追踪则指向第 23 课（OTel），或者如果需要前瞻性运行时则指向 Microsoft Agent Framework。
