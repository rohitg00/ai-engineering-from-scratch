# Agent 框架权衡 — Graph、Role 与 Actor 编排

> 每个框架都在推销同一个 demo(研究型 Agent 生成报告)，并隐藏着同一个 bug(状态模式与编排层互相冲突)。选择那个其抽象与你的问题形态相匹配的框架；其余一切都是你要写两遍的胶水代码。

**Type:** 学习
**Languages:** Python
**Prerequisites:** Phase 11 · 09(Function Calling)、Phase 11 · 16(LangGraph)
**Time:** 约 45 分钟

## 问题

你有一个需要不止一次 LLM 调用的任务。也许是一个研究工作流(规划、搜索、总结、引用)。也许是一个代码审查流水线(解析 diff、点评、打补丁、验证)。也许是一个多轮助手，能够预订航班、写邮件、提交报销单。你选定了一个框架。

三天后，你发现该框架的抽象出现了泄漏。CrewAI 给你角色，但当“研究员”需要把一份结构化计划交给“写手”时，它与你较劲。AutoGen 给你 Agent 间对话，却没有一等公民的状态管理，于是你的 checkpoint 变成了一份对话日志的 pickle。LangGraph 给你状态图，却迫使你在还不知道 Agent 会做什么之前就为每条转移命名。Agno 给你单 Agent 抽象，当你尝试扇出到三个并发 worker 时它就会崩溃。

解决办法不是“挑选最好的框架”，而是把框架的核心抽象与你的问题形态相匹配。本课将绘制这幅地图。

## 概念

![Agent framework matrix: core abstraction vs problem shape](../assets/framework-matrix.svg)

四个框架主导着 2026 年的格局。它们的核心抽象并不相同。

| 框架 | 核心抽象 | 最适合 | 最不适合 |
|-----------|------------------|----------|-----------|
| **LangGraph** | `StateGraph` — 类型化状态、节点、条件边、checkpointer。 | 具有显式状态和 human-in-the-loop 中断的工作流；需要时间旅行调试的生产级 Agent。 | 拓扑未知的松散、角色驱动的头脑风暴。 |
| **CrewAI** | `Crew` — 角色(goal、backstory)、任务、流程(sequential 或 hierarchical)。 | 带有简短线性/层级计划的角色扮演或 persona 驱动的工作流。 | 任何超出 crew 轮次历史的带状态场景；复杂分支。 |
| **AutoGen** | `ConversableAgent` 对 — 两个或多个 Agent 轮流对话，直至满足退出条件。 | 多 Agent *对话*(师生、提案者-批评者、执行者-审查者)，思考过程从聊天中涌现。 | 具有已知 DAG 的确定性工作流；任何需要跨重启持久状态的情形。 |
| **Agno** | `Agent` — 单个 LLM + 工具 + 记忆，可组合成团队。 | 快速构建的单 Agent 和轻量级团队；强大的多模态能力和内置存储驱动。 | 带有自定义 reducer 的深层显式分支图。 |

### “抽象”究竟意味着什么

框架的核心抽象就是你在推销架构时画在白板上的东西。

- **LangGraph** → 你画一张图。节点是步骤，边是转移，任意时刻的状态对象都是有类型的。心智模型是状态机。
- **CrewAI** → 你画一张组织架构图。每个角色都有职位描述，由管理者分发任务。心智模型是一个小型专家团队。
- **AutoGen** → 你画一条 Slack 私信。两个 Agent 互发消息；需要仲裁者时第三个加入。心智模型是聊天。
- **Agno** → 你画一个带有挂载工具的单个方框。把方框并排放置即构成团队。心智模型是“自带电池的 Agent”。

### 状态问题

状态是大多数框架选择在生产环境中失效的地方。

- **LangGraph。** 类型化状态(`TypedDict` 或 Pydantic 模型)、逐字段 reducer、一等公民 checkpointer(SQLite/Postgres/Redis)。恢复、中断和时间旅行都是免费的。*(参见 Phase 11 · 16。)*
- **CrewAI。** 状态通过 `context` 字段以字符串形式在任务间流动，或通过 `output_pydantic` 进行结构化传递。开箱即用没有持久化的 crew 级存储；如果 crew 必须在重启后存活，你需要自己加装。
- **AutoGen。** 状态就是聊天历史和任何用户定义的 `context`。对话记录会持久化；任意工作流状态则不会，除非你编写适配器。
- **Agno。** 内置存储驱动(SQLite、Postgres、Mongo、Redis、DynamoDB)通过 `storage=` 附加到 `Agent` 上 — 对话会话和用户记忆自动持久化。不是完整的图 checkpointer,而是一个会话存储。

### 分支问题

每个非平凡的 Agent 都需要分支。由谁决定分支很重要。

- **LangGraph** — 由你决定，通过条件边。路由是一个带命名分支的 Python 函数。分支在编译后的图中是一等公民；checkpointer 会记录走了哪条分支。
- **CrewAI** — hierarchical 模式下由管理者决定；sequential 模式下你在构建时决定。路由隐含在任务列表中；在管理者的 prompt 之外没有一等公民的“if”。
- **AutoGen** — 由 Agent 通过聊天决定。分支从“接下来谁发言”中涌现。`GroupChatManager` 选择下一个发言者；你可以手写一个 `speaker_selection_method`,但默认是 LLM 驱动的。
- **Agno** — 由 Agent 通过决定下一步调用哪个工具来选择。团队有 coordinator/router/collaborator 模式；超出此范围的分支是开发者的责任。

### 可观测性问题

- **LangGraph** — 通过 LangSmith 或任何 OTel 导出器使用 OpenTelemetry。每个节点转移都是一个 trace span;checkpoint 同时可充当可重放的 trace。LangSmith 是第一方选项；Langfuse/Phoenix 也有适配器。
- **CrewAI** — 自 2025 年末起一等公民支持 OpenTelemetry;与 Langfuse、Phoenix、Opik、AgentOps 集成。
- **AutoGen** — 通过 `autogen-core` 集成 OpenTelemetry;AgentOps 和 Opik 提供连接器。追踪粒度是每条 Agent 消息，而非每个节点。
- **Agno** — 内置 `monitoring=True` 开关加上 OpenTelemetry 导出器；与 Langfuse 深度集成以提供会话 trace。

### 成本与延迟

这四个框架都会增加每次调用的开销(框架逻辑、验证、序列化)。开销递增的大致顺序为：Agno ≈ LangGraph < CrewAI ≈ AutoGen。差异主要由框架执行多少额外的 LLM 路由决定。CrewAI 的 hierarchical 管理者要花费 token 决定下一个执行者；AutoGen 的 `GroupChatManager` 同理。LangGraph 只在你编写 `llm.invoke` 的地方花费 token。Agno 的单 Agent 路径很薄。

当每次运行的成本很重要时，优先选择显式路由(LangGraph 边、AutoGen `speaker_selection_method`)而非 LLM 选择的路由。

### 互操作性

- **LangGraph** ↔ **LangChain** 工具、检索器、LLM。一等公民 MCP 适配器(工具作为 MCP server 导入)。
- **CrewAI** ↔ 工具继承自 `BaseTool`;LangChain 工具、LlamaIndex 工具和 MCP 工具都能适配进来。通过 `allow_delegation=True` 实现 crew 到 crew 的委托。
- **AutoGen** → `FunctionTool` 可包装任何 Python 可调用对象；提供 MCP 适配器。与 AG2 生态在 Agent 间模式上紧密耦合。
- **Agno** → `@tool` 装饰器或 BaseTool 子类；提供 MCP 适配器；工具可在多个 Agent 和团队之间共享。

## 技能

> 你能够用一句话解释，为什么某个框架适合某个给定的 Agent 问题。

预构建检查清单：

1. **画出形态。** 这是一张图(类型化状态、命名转移)吗？是一场角色扮演(专家之间交接工作)吗？是一场聊天(Agent 交谈直到完成)吗？还是一个带工具的单 Agent?
2. **决定由谁分支。** 开发者决定分支 → LangGraph。管理者 Agent 决定 → CrewAI hierarchical。聊天涌现 → AutoGen。工具调用决定 → Agno。
3. **检查状态预算。** 你需要从 checkpoint 恢复吗？时间旅行？运行中途人工中断？如果是，LangGraph 是默认选择；Agno 会话覆盖会话范围内的状态。
4. **检查成本预算。** LLM 选择的路由每轮要花费额外 token。如果 Agent 每天运行数千次，优先选择显式路由。
5. **预算框架开销。** 每个框架都是又一个依赖。如果任务只是两次 LLM 调用加一个工具，写 30 行普通 Python 即可；没有任何框架比不用框架更便宜。

在你能够画出那张图、那张组织架构图、那场聊天或那个 Agent 方框之前，拒绝伸手去拿框架。拒绝选择任何迫使你为了真正需要的功能而与其状态模型较劲的框架。

## 决策矩阵

| 问题形态 | 首选框架 | 原因 |
|---------------|---------------------|-----|
| 带类型化状态、人工审批、长时间运行的工作流 DAG | LangGraph | 一等公民的状态、checkpointer、中断、时间旅行。 |
| 具有明确分工角色的研究/写作流水线 | CrewAI(sequential)或 LangGraph 子图 | 在 CrewAI 中“一角色一任务”的表达成本很低；分支变复杂时用 LangGraph 扩展。 |
| 提案者-批评者或师生对话 | AutoGen | 双 Agent 聊天是它的原生形态。 |
| 带工具、会话、记忆的单 Agent | Agno | 设置最薄，内置存储和记忆。 |
| 带 reducer 的数千个并行扇出 | LangGraph + `Send` | 唯一拥有第一方并行分发 API 的框架。 |
| 快速原型，不承诺框架 | 普通 Python + 提供商 SDK | 不用框架就是最快的框架。 |

```figure
l5-framework-fit
```

## 练习

1. **简单。** 取同一个任务 — “研究 Anthropic 总部，写一份 200 字简报，引用来源” — 分别在 LangGraph(四个节点：plan、search、write、cite)和 CrewAI(三个角色：researcher、writer、editor)中实现。报告每次运行的 token 成本和代码行数。
2. **中等。** 在 AutoGen(researcher ↔ writer 聊天，editor 通过 `GroupChat` 加入)和 Agno(一个带 `search_tools` 和 `write_tools` 的单 Agent,加上一个会话存储)中构建同一任务。从以下三方面对四个实现进行排名:(a)每次运行的成本，(b)崩溃后恢复的能力，(c)在 write 步骤前注入人工审批的能力。
3. **困难。** 构建一个决策树脚本 `pick_framework.py`,它接受一段简短的问题描述(JSON:`{has_typed_state, has_roles, has_dialogue, has_parallel_fanout, needs_resume}`)并返回带一句话理由的推荐。在你自行设计的六个案例上验证它。

## 关键术语

| 术语 | 人们怎么说 | 它实际意味着 |
|------|-----------------|-----------------------|
| 编排 | “Agent 如何协调” | 决定下一个运行哪个节点/角色/Agent 的那一层。 |
| 持久状态 | “重启后恢复” | 在进程死亡后仍能存活的状态，附加在 checkpoint 或会话存储上。 |
| LLM 选择的路由 | “让模型决定” | 一个规划器 LLM 每轮挑选下一步；灵活但每次决策都要花费 token。 |
| 显式路由 | “开发者决定” | 一个 Python 函数或静态边挑选下一步；便宜且可审计。 |
| Crew | “一个 CrewAI 团队” | 角色 + 任务 + 流程(sequential 或 hierarchical)绑定成一个可运行单元。 |
| GroupChat | “AutoGen 的多 Agent 聊天” | N 个 Agent 之间由发言者选择器管理的对话。 |
| Team(Agno) | “多 Agent 的 Agno” | 在一组 Agent 上运行的 route / coordinate / collaborate 模式。 |
| StateGraph | “LangGraph 的图” | 类型化状态、节点、条件边、checkpointer 的抽象。 |

## 延伸阅读

- [LangGraph 文档](https://langchain-ai.github.io/langgraph/) — StateGraph、checkpointer、中断、时间旅行。
- [CrewAI 文档](https://docs.crewai.com/) — Crews、Flows、Agents、Tasks、Processes。
- [AutoGen 文档](https://microsoft.github.io/autogen/) — ConversableAgent、GroupChat、teams、tools。
- [Agno 文档](https://docs.agno.com/) — Agent、Team、Workflow、存储、记忆。
- [Anthropic — Building effective agents(2024 年 12 月)](https://www.anthropic.com/research/building-effective-agents) — 与框架无关的模式库(prompt chaining、routing、parallelization、orchestrator-workers、evaluator-optimizer)。
- [Yao 等人，"ReAct: Synergizing Reasoning and Acting"(ICLR 2023)](https://arxiv.org/abs/2210.03629) — 所有框架都在包装的那个循环。
- [Wu 等人，"AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation"(2023)](https://arxiv.org/abs/2308.08155) — AutoGen 的设计论文。
- [Park 等人，"Generative Agents: Interactive Simulacra of Human Behavior"(UIST 2023)](https://arxiv.org/abs/2304.03442) — CrewAI 式 persona 技术栈所依赖的角色扮演基础。
- Phase 11 · 16(LangGraph)— 本课用来作基准对比的框架。
- Phase 11 · 19(Reflexion)— 一个能干净映射到 LangGraph、却难以映射到 CrewAI 的模式。
- Phase 11 · 22(生产可观测性)— 如何为任何你选择的框架植入监控。