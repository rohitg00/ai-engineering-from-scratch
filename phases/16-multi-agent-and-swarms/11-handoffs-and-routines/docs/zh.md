# 交接与例程 —— 无状态编排（Handoffs and Routines — Stateless Orchestration）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> OpenAI 的 Swarm（2024 年 10 月）把多 agent 编排提炼成两个原语：**routines（例程）**（把指令 + 工具组合成一段 system prompt）和 **handoffs（交接）**（一个返回另一个 Agent 的工具）。没有状态机，没有分支 DSL —— LLM 通过调用正确的 handoff 工具来完成路由。OpenAI Agents SDK（2025 年 3 月）是它的生产级继任者。Swarm 自身仍然是最干净的概念参考 —— 整套源码只有几百行。这个范式之所以传播迅速，是因为 API 表面大致就是「agent = prompt + 工具；handoff = 返回 agent 的函数」。局限：无状态，所以记忆是调用方自己的问题。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## 问题（Problem）

每一个多 agent 框架都想让你学它的 DSL：LangGraph 的 nodes 和 edges、CrewAI 的 crews 和 tasks、AutoGen 的 GroupChat 和 managers。这些 DSL 确实是有用的抽象，但它们让整件事看起来比实际需要的更重。

Swarm 走的是相反方向：直接用模型本来就具备的 tool-calling 能力。Handoff 就是一次 tool call。编排者就是当前持有对话的那个 agent。状态机隐含在各个 agent 的 system prompt 里。

## 概念（Concept）

### 两个原语

**Routine（例程）。** 一段定义 agent 角色和可用工具的 system prompt。可以把它想成一组有边界的指令：「你是一个 triage（分诊）agent；如果用户问退款，就 handoff 给退款 agent。」

**Handoff（交接）。** agent 可以调用的一个工具，它返回一个新的 Agent 对象。Swarm 运行时检测到返回值是 Agent，就在下一轮把活跃 agent 切换过去。

整个抽象就这么多。

```
def transfer_to_refunds():
    return refund_agent  # Swarm sees Agent return → switch active agent

triage_agent = Agent(
    name="triage",
    instructions="Route the user to the right specialist.",
    functions=[transfer_to_refunds, transfer_to_sales, transfer_to_support],
)
```

triage agent 的 system prompt 让它根据用户消息选出正确的 handoff。LLM 的 tool-calling 完成路由。

### 为什么它会病毒式传播

- **API 很小。** 只要学两个概念。
- **直接用模型已经会的东西。** Tool calling 在各家提供商那里已经是生产级能力。
- **没有状态机负担。** 你不用去描述图；agent 的 prompt 就描述了它会 handoff 给谁。

### 无状态这笔交易

Swarm 在多次运行之间是显式无状态的。框架在一次 run 内会保留消息历史，但什么都不会持久化。记忆、连续性、长任务 —— 全是调用方的问题。

到了生产级版本（OpenAI Agents SDK，2025 年 3 月），主要变化之一就是：SDK 加上了内建的 session 管理、guardrails（护栏）和 tracing，但保留了 handoff 原语。

### 什么场景适合 Swarm/handoffs

- **Triage（分诊）模式。** 一线 agent 把用户路由给某个专家 agent。
- **基于技能的 handoff。** 「如果任务需要写代码，叫 coder；如果需要做研究，叫 researcher。」
- **短而有界的对话。** 客服、FAQ 转工单、简单工作流。

### Swarm 吃力的场景

- **需要共享记忆的长会话。** Handoff 会把对话状态重置成新 agent 的 prompt 加历史。除非调用方自己管理记忆，否则跨 agent 没有持久状态。
- **并行执行。** Handoff 是一次一个 —— 活跃 agent 在切换。要并行，就得调用方自己编排多次 Swarm run。
- **审计与回放。** 无状态的 run 很难精确回放；LLM 的 handoff 选择不是确定性的。

### OpenAI Agents SDK（2025 年 3 月）

生产级继任者新增：

- **Session 状态。** 跨 run 持久化的线程。
- **Guardrails（护栏）。** 输入/输出校验钩子。
- **Tracing。** 每一次 tool call 和 handoff 都被记录。
- **Handoff 过滤器。** 控制 handoff 时哪些上下文会被带过去。

handoff 原语保留下来；只是在它周围加了生产环境必须的工程能力。

### Swarm vs GroupChat

两者都用 LLM 来驱动路由，但区别在 **谁来挑下一个**：

- GroupChat：一个 selector（函数或 LLM）从外部挑出下一个发言者。
- Swarm：当前 agent 通过调用 handoff 工具自己挑选继任者。

Swarm 是「agent 决定下一个是谁」；GroupChat 是「manager 决定下一个是谁」。Swarm 的决策落在活跃 agent 的 tool call 上；GroupChat 的决策落在 `GroupChatManager` 里。

## 动手实现（Build It）

`code/main.py` 从零实现 Swarm：一个 Agent dataclass，一套 handoff 机制（工具返回 Agent），以及一个能检测 agent 切换的 run loop。

演示：一个 triage agent 把用户路由到退款、销售或支持 specialist。每个 specialist 有自己的工具。Run loop 会把每一次 handoff 打印出来。

运行：

```
python3 code/main.py
```

## 用起来（Use It）

`outputs/skill-handoff-designer.md` 针对给定任务设计一套 handoff 拓扑：有哪些 agent，它们能调用哪些 handoff，handoff 时哪些上下文会被带过去。

## 上线部署（Ship It）

Checklist：

- **Handoff 日志。** 每一次 handoff 都写一条 trace 事件：从哪个 agent、到哪个 agent、上下文快照。
- **上下文传递规则。** 决定 handoff 时带什么过去：完整历史（昂贵）、最近 N 条消息，或者一段 summary。
- **Handoff 上的 guardrail（护栏）。** Handoff 给一个具备不同工具权限的 specialist 时必须做认证 —— 否则 prompt injection（注入）能强行触发不该发生的 handoff。
- **环检测。** 两个 agent 来回 handoff 是常见故障模式；用一个简单的 last-K 环检查就能识别。
- **兜底 agent。** 如果 handoff 的目标不存在，回退到一个安全的默认 agent。

## 练习（Exercises）

1. 跑 `code/main.py`，让它 triage 到退款 agent。确认第二轮的活跃 agent 是退款 agent。
2. 加一条环检测规则：如果同样的两个 agent 已经连续 handoff 来回 3 次，强制退出。设计你的兜底方案。
3. 读 OpenAI Agents SDK 关于 handoff filters 的文档。实现一个「handoff 时做 summary」的版本：交出方 agent 在接收方接管之前，把上下文压成一段要点 summary。
4. 把 Swarm 的 handoff 和 GroupChatManager 的 selector 对比一下。哪一种范式让 prompt injection 更糟？为什么？
5. 读 Swarm cookbook（https://developers.openai.com/cookbook/examples/orchestrating_agents）。指出一个 Swarm 做出的明确设计决策，OpenAI Agents SDK 改了它，或者保留了它。

## 关键术语（Key Terms）

| 术语 | 大家平常怎么说 | 实际含义 |
|------|----------------|------------------------|
| Routine | 「agent 的 prompt」 | System prompt + 工具列表。定义角色和可用的 handoff。 |
| Handoff | 「转给另一个 agent」 | 活跃 agent 可以调用的一个工具，它返回一个新的 Agent。运行时切换活跃 agent。 |
| Stateless | 「run 之间没有记忆」 | Swarm 什么都不持久化；记忆是调用方的责任。 |
| Active agent | 「现在谁在说话」 | 当前持有对话的那个 agent。Handoff 会改变它。 |
| Context transfer | 「handoff 时带什么过去」 | 接收方 agent 看到哪些历史的策略：完整、最近 N 条，或者经过 summary。 |
| Handoff loop | 「agent 在乒乓」 | 一种故障模式：两个 agent 不断把对话推回给对方。 |
| OpenAI Agents SDK | 「生产版 Swarm」 | 2025 年 3 月的继任者；在 handoff 原语之上加了 session、guardrails、tracing。 |
| Handoff filter | 「交接时的关卡」 | SDK 特性，可以在 handoff 边界检查并修改上下文。 |

## 延伸阅读（Further Reading）

- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) —— 最权威的范式表述
- [OpenAI Swarm repo](https://github.com/openai/swarm) —— 原始实现，作为概念参考保留
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) —— 带 session 与 tracing 的生产级继任者
- [Anthropic handoff-in-Claude notes](https://docs.anthropic.com/en/docs/claude-code) —— Claude Code subagent 如何通过 `Task` 使用类 handoff 范式
