# 17 · 智能体框架取舍——LangGraph vs CrewAI vs AutoGen vs Agno

> 每个框架都在兜售同一个演示（研究型智能体生成一份报告），又都掩盖着同一个 bug（状态 schema 与编排层相互打架）。挑选那个抽象与你问题形态相匹配的框架；其余的一切都是你要写两遍的胶水代码。

**类型：** 学习
**语言：** Python
**前置：** 阶段 11 · 09（函数调用 / Function Calling），阶段 11 · 16（LangGraph）
**时长：** 约 45 分钟

## 问题所在

你有一个任务，需要不止一次 LLM 调用。也许是一条研究工作流（规划、检索、摘要、引用）。也许是一条代码评审流水线（解析 diff、批评、打补丁、验证）。也许是一个多轮助手，要订机票、写邮件、提报销。于是你挑了一个框架。

三天后，你发现这个框架的抽象会「漏」（leak）。CrewAI 给你角色，但当「研究员」需要把一份结构化计划交给「写手」时，它会跟你对着干。AutoGen 给你智能体之间的对话，却没有一等公民的状态，于是你的检查点（checkpoint）只是一段对话日志的 pickle。LangGraph 给你一张状态图，却逼着你在还不知道智能体会做什么之前就为每一次转移命名。Agno 给你一个单智能体抽象，可当你想把任务扇出（fan out）给三个并发的 worker 时，它会尖叫抗议。

解法不是「挑最好的框架」，而是让框架的核心抽象去匹配你问题的形态。本课就来画出这张地图。

## 核心概念

〔图：智能体框架矩阵——核心抽象对照问题形态〕

四个框架主导了 2026 年的格局。它们的核心抽象各不相同。

| 框架 | 核心抽象 | 最佳契合 | 最差契合 |
|-----------|------------------|----------|-----------|
| **LangGraph** | `StateGraph`——带类型的状态、节点、条件边、检查点器（checkpointer）。 | 具有显式状态、需要人类介入（human-in-the-loop）中断的工作流；需要时间旅行（time-travel）调试的生产级智能体。 | 拓扑未知、松散、由角色驱动的头脑风暴。 |
| **CrewAI** | `Crew`——角色（目标 goal、背景故事 backstory）、任务、流程（顺序式 sequential 或层级式 hierarchical）。 | 角色扮演或人设驱动、计划较短的线性/层级工作流。 | 任何超出 crew 轮次历史之外的有状态需求；复杂分支。 |
| **AutoGen** | `ConversableAgent` 对——两个或更多智能体轮流对话，直到满足退出条件。 | 多智能体*对话*（师生、提议者-批评者、执行者-评审者），其中思考从聊天中涌现。 | 已知 DAG 的确定性工作流；任何需要跨重启持久状态的场景。 |
| **Agno** | `Agent`——单个 LLM + 工具 + 记忆，可组合成团队。 | 快速搭建的单智能体与轻量团队；强多模态与内置存储驱动。 | 带自定义 reducer 的深层、显式分支图。 |

### 「抽象」究竟意味着什么

框架的核心抽象，就是你向人推介架构时画在白板上的那个东西。

- **LangGraph** → 你画一张图。节点是步骤，边是转移，每一处的状态对象都是带类型的。心智模型是状态机。
- **CrewAI** → 你画一张组织架构图。每个角色有一份岗位说明，由一个 manager 来路由任务。心智模型是一支小型专家团队。
- **AutoGen** → 你画一个 Slack 私信窗口。两个智能体互发消息；需要主持人时再加入第三个。心智模型是聊天。
- **Agno** → 你画一个方块，工具挂在它周围。把方块并排放置就组成一支团队。心智模型是「自带电池的智能体」。

### 状态这道题

状态是大多数框架选择在生产中崩盘的地方。

- **LangGraph。** 带类型的状态（`TypedDict` 或 Pydantic 模型）、逐字段 reducer、一等公民的检查点器（SQLite/Postgres/Redis）。恢复、中断、时间旅行都是免费的。*（参见阶段 11 · 16。）*
- **CrewAI。** 状态以字符串形式经由 `context` 字段在任务之间流动，或通过 `output_pydantic` 结构化传递。开箱即用没有逐 crew 的持久存储；若 crew 必须撑过重启，你得自己拼上一套。
- **AutoGen。** 状态就是聊天历史加上任何用户定义的 `context`。对话记录会持久化；任意的工作流状态则不会，除非你自己写适配器。
- **Agno。** 内置存储驱动（SQLite、Postgres、Mongo、Redis、DynamoDB），通过 `storage=` 挂到 `Agent` 上——会话与用户记忆自动持久化。它不是完整的图检查点器，而是一个会话存储。

### 分支这道题

任何非平凡的智能体都会分支。由谁来决定分支，很关键。

- **LangGraph**——由你决定，通过条件边。路由是一个带命名分支的 Python 函数。分支在编译后的图里是一等公民；检查点器记录走了哪个分支。
- **CrewAI**——层级模式下由 manager 决定；顺序模式下由你在构建时决定。路由隐含在任务列表里；除了 manager 的提示词之外，没有一等公民的「if」。
- **AutoGen**——由智能体通过聊天决定。分支从「下一个谁说话」中涌现。`GroupChatManager` 挑选下一位发言者；你可以手写一个 `speaker_selection_method`，但默认是 LLM 驱动的。
- **Agno**——由智能体通过「下一步调用哪个工具」来决定。团队有协调者（coordinator）/路由者（router）/协作者（collaborator）模式；超出这些范围的分支由开发者自己负责。

### 可观测性这道题

- **LangGraph**——经由 LangSmith 或任意 OTel 导出器的 OpenTelemetry。每一次节点转移都是一个 trace span；检查点本身就兼作可重放的 trace。LangSmith 是第一方选项；Langfuse/Phoenix 也有适配器。
- **CrewAI**——自 2025 年底起一等公民支持 OpenTelemetry；与 Langfuse、Phoenix、Opik、AgentOps 集成。
- **AutoGen**——经由 `autogen-core` 集成 OpenTelemetry；AgentOps 与 Opik 都有连接器。追踪粒度是逐智能体消息（per-agent-message），而非逐节点。
- **Agno**——内置 `monitoring=True` 标志加上 OpenTelemetry 导出器；与 Langfuse 紧密集成以记录会话 trace。

### 成本与延迟

四个框架都会增加每次调用的开销（框架逻辑、校验、序列化）。开销大致递增的次序：Agno ≈ LangGraph < CrewAI ≈ AutoGen。差异主要取决于框架额外做了多少 LLM 路由。CrewAI 的层级 manager 要花 token 决定下一个谁上；AutoGen 的 `GroupChatManager` 同样如此。LangGraph 只在你写 `llm.invoke` 的地方花 token。Agno 的单智能体路径很轻薄。

当每次运行的成本要紧时，优先选择显式路由（LangGraph 的边、AutoGen 的 `speaker_selection_method`），而非 LLM 选择的路由。

### 互操作性

- **LangGraph** ↔ **LangChain** 的工具、检索器、LLM。一等公民的 MCP 适配器（工具以 MCP server 形式导入）。
- **CrewAI** ↔ 工具继承自 `BaseTool`；LangChain 工具、LlamaIndex 工具、MCP 工具都能适配进来。通过 `allow_delegation=True` 实现 crew 间委派。
- **AutoGen** → `FunctionTool` 包装任意 Python 可调用对象；提供 MCP 适配器。智能体间模式与 AG2 生态紧耦合。
- **Agno** → `@tool` 装饰器或 BaseTool 子类；提供 MCP 适配器；工具可在智能体与团队间共享。

## 技能

> 你能用一句话解释，为什么某个框架适合某个智能体问题。

动手前的清单：

1. **画出形态。** 这是一张图（带类型状态、命名转移）吗？是一场角色扮演（专家之间移交工作）？是一段聊天（智能体对话直到完成）？还是一个带工具的单智能体？
2. **决定谁来分支。** 开发者决定的分支 → LangGraph。manager 智能体决定 → CrewAI 层级式。聊天涌现 → AutoGen。工具调用决定 → Agno。
3. **核对状态预算。** 你需要从检查点恢复吗？时间旅行？运行中途的人类中断？如果需要，LangGraph 是默认选项；Agno 会话覆盖会话范围内的状态。
4. **核对成本预算。** LLM 选择的路由每一轮都额外消耗 token。如果智能体一天运行数千次，优先选择显式路由。
5. **核算框架开销。** 每个框架都是又一项依赖。如果任务只是两次 LLM 调用加一个工具，就写 30 行朴素 Python；没有哪个框架比「不用框架」更省。

在你能画出那张图、那张组织架构图、那段聊天、或那个智能体方块之前，拒绝去抓一个框架。也拒绝挑那个会逼你为真正需要的东西去跟它的状态模型打架的框架。

## 决策矩阵

| 问题形态 | 首选框架 | 原因 |
|---------------|---------------------|-----|
| 带类型状态、人类审批、长时运行的工作流 DAG | LangGraph | 一等公民的状态、检查点器、中断、时间旅行。 |
| 带明确角色的研究/写作流水线 | CrewAI（顺序式）或 LangGraph 子图 | CrewAI 里「一角色一任务」表达起来很便宜；分支变复杂时用 LangGraph 扩展。 |
| 提议者-批评者或师生对话 | AutoGen | 双智能体聊天是它的原生形态。 |
| 带工具、会话、记忆的单智能体 | Agno | 搭建最薄，内置存储与记忆。 |
| 数千路带 reducer 的并行扇出 | LangGraph + `Send` | 唯一拥有一等公民并行分发 API 的框架。 |
| 快速原型，不绑定框架 | 朴素 Python + 厂商 SDK | 没有框架就是最快的框架。 |

## 练习

1. **简单。** 拿同一个任务——「研究 Anthropic 的总部，写一份 200 词简报，附上引用来源」——分别用 LangGraph（四个节点：plan、search、write、cite）和 CrewAI（三个角色：researcher、writer、editor）实现。报告每次运行的 token 成本与代码行数。
2. **中等。** 用 AutoGen（researcher ↔ writer 聊天，editor 经由 `GroupChat` 加入）和 Agno（一个带 `search_tools` 与 `write_tools` 的单智能体，外加一个会话存储）实现同一个任务。在以下三方面给四种实现排名：(a) 每次运行成本，(b) 崩溃后恢复的能力，(c) 在 write 步骤前注入人类审批的能力。
3. **困难。** 编写一个决策树脚本 `pick_framework.py`，输入一段简短的问题描述（JSON：`{has_typed_state, has_roles, has_dialogue, has_parallel_fanout, needs_resume}`），返回一条带一句话理由的推荐。在你自己设计的六个用例上验证它。

## 关键术语

| 术语 | 人们口中的说法 | 实际含义 |
|------|-----------------|-----------------------|
| 编排（Orchestration） | 「智能体如何协调」 | 决定下一个运行哪个节点/角色/智能体的那一层。 |
| 持久状态（Durable state） | 「重启后恢复」 | 在进程死亡后仍存活的状态，挂在某个检查点或会话存储上。 |
| LLM 选择的路由（LLM-selected routing） | 「让模型决定」 | 由一个规划 LLM 每轮挑选下一步；灵活，但每次决策都付 token。 |
| 显式路由（Explicit routing） | 「开发者决定」 | 由一个 Python 函数或静态边挑选下一步；便宜且可审计。 |
| Crew | 「CrewAI 的团队」 | 角色 + 任务 + 流程（顺序式或层级式）绑成一个可运行体。 |
| GroupChat | 「AutoGen 的多智能体聊天」 | N 个智能体之间一场带发言者选择器的受管对话。 |
| Team（Agno） | 「Agno 的多智能体」 | 在一组智能体之上的路由/协调/协作模式。 |
| StateGraph | 「LangGraph 的图」 | 带类型状态、节点、条件边、检查点器的抽象。 |

## 延伸阅读

- [LangGraph 文档](https://langchain-ai.github.io/langgraph/)——StateGraph、检查点器、中断、时间旅行。
- [CrewAI 文档](https://docs.crewai.com/)——Crews、Flows、Agents、Tasks、Processes。
- [AutoGen 文档](https://microsoft.github.io/autogen/)——ConversableAgent、GroupChat、teams、tools。
- [Agno 文档](https://docs.agno.com/)——Agent、Team、Workflow、storage、memory。
- [Anthropic——构建高效智能体（2024 年 12 月）](https://www.anthropic.com/research/building-effective-agents)——与框架无关的模式库（提示链、路由、并行化、编排者-worker、评估者-优化者）。
- [Yao 等，《ReAct: Synergizing Reasoning and Acting》（ICLR 2023）](https://arxiv.org/abs/2210.03629)——每个框架都在包装的那个循环。
- [Wu 等，《AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation》（2023）](https://arxiv.org/abs/2308.08155)——AutoGen 的设计论文。
- [Park 等，《Generative Agents: Interactive Simulacra of Human Behavior》（UIST 2023）](https://arxiv.org/abs/2304.03442)——CrewAI 式人设栈所依托的角色扮演基础。
- 阶段 11 · 16（LangGraph）——本课对标的框架。
- 阶段 11 · 19（Reflexion）——一个能干净映射到 LangGraph、却别扭地映射到 CrewAI 的模式。
- 阶段 11 · 22（生产可观测性）——如何为你所选的框架埋点。
