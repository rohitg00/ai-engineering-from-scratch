# 交接与例程 — 无状态编排

> OpenAI 的 Swarm(2024 年 10 月)将多智能体编排提炼为两个原语:**例程**(routine,作为系统提示词的指令 + 工具)和**交接**(handoff,返回另一个 Agent 的工具)。没有状态机,没有分支 DSL —— LLM 通过调用正确的交接工具来完成路由。OpenAI Agents SDK(2025 年 3 月)是其生产级后继者。Swarm 本身仍然是最清晰的概念参考 —— 它的全部源代码只有几百行。这个模式之所以流行,是因为它的 API 表面大致就是“agent = 提示词 + 工具;handoff = 返回 agent 的函数”。局限性:无状态,因此记忆是调用方的问题。

**Type:** Learn + Build
**Languages:** Python(stdlib)
**Prerequisites:** Phase 16 · 04(Primitive Model)
**Time:** 约 60 分钟

## 问题

每个多智能体框架都要求你学习它的 DSL:LangGraph 的节点和边、CrewAI 的 crew 和 task、AutoGen 的 GroupChat 和 manager。这些 DSL 是真正的抽象,但它们让事情显得比实际需要的更重。

Swarm 反其道而行之:直接使用模型已经具备的工具调用能力。交接变成工具调用。编排者就是当前持有对话的那个 agent。状态机隐含在各个 agent 的系统提示词中。

## 概念

### 两个原语

**例程(Routine)。** 一个系统提示词,定义 agent 的角色和可用工具。可以把它理解为范围受限的一组指令:“你是分诊 agent;如果用户询问退款,就交接给退款 agent。”

**交接(Handoff)。** agent 可以调用的一个工具,返回一个新的 Agent 对象。Swarm 运行时检测到 Agent 返回值后,在下一轮切换活跃 agent。

这就是全部的抽象。

```
def transfer_to_refunds():
    return refund_agent  # Swarm sees Agent return → switch active agent

triage_agent = Agent(
    name="triage",
    instructions="Route the user to the right specialist.",
    functions=[transfer_to_refunds, transfer_to_sales, transfer_to_support],
)
```

分诊 agent 的系统提示词使它根据用户消息选择正确的交接。LLM 的工具调用完成路由。

### 为什么它流行

- **API 很小。** 只需要学两个概念。
- **使用模型本来就会做的事。** 工具调用在各家提供商那里已经是生产级能力。
- **没有状态机负担。** 你不需要描述图;agent 的提示词描述它们交接给谁。

### 无状态的取舍

Swarm 明确地在多次运行之间保持无状态。框架在一次运行期间维护消息历史,但不持久化任何东西。记忆、连续性、长时间运行的任务 —— 全都是调用方的问题。

在生产环境中(OpenAI Agents SDK,2025 年 3 月),这是主要改变之一:SDK 增加了内置的会话管理、guardrails 和追踪,同时保留了交接原语。

### 何时适合 Swarm/交接

- **分诊模式。** 前台 agent 将用户路由给专家。
- **基于技能的交接。** “如果任务需要写代码,调用 coder;如果需要调研,调用 researcher。”
- **简短、有边界的对话。** 客户支持、FAQ 转工单、简单工作流。

### 何时 Swarm 会吃力

- **共享记忆的长会话。** 交接会将对话状态重置为新 agent 的提示词加上历史。没有调用方管理的记忆,就无法跨 agent 持久化状态。
- **并行执行。** 交接一次只能进行一个 —— 活跃 agent 会切换。并行需要调用方编排多个 Swarm 运行。
- **审计与回放。** 无状态的运行难以精确回放;LLM 的交接选择不是确定性的。

### OpenAI Agents SDK(2025 年 3 月)

生产级后继者增加了:

- **会话状态。** 跨运行的持久线程。
- **Guardrails。** 输入/输出校验钩子。
- **追踪。** 每次工具调用和交接都会被记录。
- **交接过滤器。** 控制交接时传递哪些上下文。

交接原语得以保留;在其周围增加了生产级的易用性。

### Swarm vs GroupChat

两者都使用 LLM 驱动的路由,但区别在于**谁决定下一个**:

- GroupChat:一个选择器(函数或 LLM)从外部挑选下一个发言者。
- Swarm:当前 agent 通过调用交接工具选择自己的继任者。

Swarm 是“agent 决定接下来做什么”;GroupChat 是“manager 决定接下来做什么”。Swarm 的决策存在于活跃 agent 的工具调用中;GroupChat 的决策存在于 `GroupChatManager` 中。

```figure
sw-handoff-routing
```

## 动手实现

`code/main.py` 从零实现 Swarm:一个 Agent dataclass、一个交接机制(工具返回 Agent),以及一个检测 agent 切换的运行循环。

演示:一个分诊 agent 将请求路由给退款、销售或支持专家。每个专家有自己的工具。运行循环会打印每次交接。

运行:

```
python3 code/main.py
```

## 使用它

`outputs/skill-handoff-designer.md` 为给定任务设计交接拓扑:存在哪些 agent、它们可以调用哪些交接、传递什么上下文。

## 上线它

检查清单:

- **交接日志。** 每次交接都写入一条追踪事件,包含来源 agent、目标 agent、上下文快照。
- **上下文传递规则。** 决定交接时传递什么:完整历史(昂贵)、最近 N 条消息,或一个摘要。
- **交接时的 guardrail。** 交接给具有不同工具权限的专家时必须经过身份验证 —— 否则提示注入可以强制触发不想要的交接。
- **循环检测。** 两个 agent 互相来回交接是常见故障;用一个简单的最近 K 次环形检查来检测。
- **兜底 agent。** 如果交接目标不存在,回退到一个安全的默认项。

## 练习

1. 运行 `code/main.py`,将请求分诊到退款 agent。确认第二轮的活跃 agent 是 refund。
2. 添加一条循环检测规则:如果同样两个 agent 连续交接了 3 次,强制退出。设计相应的兜底方案。
3. 阅读 OpenAI Agents SDK 关于交接过滤器的文档。实现一个“交接时总结”的版本:离开的 agent 在接手的 agent 接管之前,把上下文压缩成要点摘要。
4. 将 Swarm 的交接与 GroupChatManager 选择器进行比较。哪种模式让提示注入更严重,为什么?
5. 阅读 Swarm cookbook(https://developers.openai.com/cookbook/examples/orchestrating_agents)。找出 Swarm 做出的、OpenAI Agents SDK 改变或保留的一个明确设计决策。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|------------------------|------------------------|
| Routine | “agent 的提示词” | 系统提示词 + 工具列表。定义角色和可用的交接。 |
| Handoff | “转交给另一个 agent” | 活跃 agent 可以调用的工具,返回一个新的 Agent。运行时据此切换活跃 agent。 |
| Stateless | “运行之间没有记忆” | Swarm 不持久化任何东西;记忆是调用方的责任。 |
| Active agent | “现在是谁在说话” | 当前持有对话的 agent。交接会改变这一点。 |
| Context transfer | “交接时传递什么” | 接手的 agent 能看到什么历史的策略:完整、最近 N 条,或摘要。 |
| Handoff loop | “agent 之间乒乓” | 两个 agent 不断互相交接的故障模式。 |
| OpenAI Agents SDK | “生产级 Swarm” | 2025 年 3 月的后继者;在交接原语之上增加了会话、guardrails 和追踪。 |
| Handoff filter | “交接时的门控” | SDK 的功能,用于在交接边界检查和修改上下文。 |

## 延伸阅读

- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) — 权威的表述
- [OpenAI Swarm 仓库](https://github.com/openai/swarm) — 原始实现,保留作为概念参考
- [OpenAI Agents SDK 文档](https://openai.github.io/openai-agents-python/) — 带有会话和追踪的生产级后继者
- [Anthropic 关于 Claude 中交接的说明](https://docs.anthropic.com/en/docs/claude-code) — Claude Code 的 subagent 如何通过 `Task` 使用类似交接的模式