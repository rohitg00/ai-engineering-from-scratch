# Agent 框架取舍 —— LangGraph vs CrewAI vs AutoGen vs Agno（Agent Framework Tradeoffs）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 每个框架卖的都是同一个 demo（一个 research agent 写出一份报告），藏的也是同一个 bug（state schema 跟编排层互相打架）。挑那个抽象贴合你问题形状的框架；其余的都是你要写两遍的胶水代码。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 16 (LangGraph)
**Time:** ~45 minutes

## 问题（The Problem）

你手上有一个任务，单次 LLM 调用搞不定。也许是一条 research 工作流（计划、搜索、总结、引用）；也许是一条 code-review 流水线（解析 diff、批评、打补丁、验证）；也许是一个多轮助手，要订机票、写邮件、提报销。你挑了一个框架。

三天后你发现，框架的抽象在漏水。CrewAI 给你 roles，但当「researcher」需要把一份结构化 plan 交给「writer」的时候它就跟你拧着干。AutoGen 给你 agent 之间的对话，但没有一等公民的 state，你的 checkpoint 是把对话日志 pickle 一下。LangGraph 给你 state graph，却逼你在还没搞清楚 agent 会做什么之前就把每一条转移命名好。Agno 给你一个单 agent 抽象，等你想 fan out 到三个并发 worker 的时候它就开始尖叫。

修方法不是「挑最好的那个框架」，而是把框架的核心抽象跟你问题的形状对上号。这一课就是把这张地图画出来。

## 概念（The Concept）

![Agent 框架矩阵：核心抽象 vs 问题形状](../assets/framework-matrix.svg)

2026 年的版图被四个框架占据。它们的核心抽象并不一样。

| 框架 | 核心抽象 | 最适合 | 最不适合 |
|-----------|------------------|----------|-----------|
| **LangGraph** | `StateGraph` —— 类型化 state、节点、条件边、checkpointer。 | 带有显式 state 和 human-in-the-loop（人工确认）打断的工作流；需要 time-travel 调试的生产级 agent。 | 拓扑未知、靠角色驱动头脑风暴的松散场景。 |
| **CrewAI** | `Crew` —— roles（goal、backstory）、tasks、process（顺序或分层）。 | 短线性 / 分层规划的角色扮演或人格驱动型工作流。 | 任何超出 crew 轮次历史之外的有状态场景；复杂分支。 |
| **AutoGen** | `ConversableAgent` 配对 —— 两个或多个 agent 轮流说话直到满足退出条件。 | 多 agent *对话*（teacher-student、proposer-critic、actor-reviewer），思考从聊天中涌现。 | 已知 DAG（有向无环图）的确定性工作流；任何需要跨重启持久 state 的场景。 |
| **Agno** | `Agent` —— 单个 LLM + 工具 + memory，可组合成 team。 | 快速搭建的单 agent 与轻量 team；多模态强、内置 storage driver。 | 深层、显式分支、带自定义 reducer 的图。 |

### 「抽象」到底指什么

框架的核心抽象，就是你在白板上推销架构时画的那个东西。

- **LangGraph** → 你画一张图。节点是步骤，边是转移，每一处的 state 对象都有类型。心智模型是状态机。
- **CrewAI** → 你画一张组织架构图。每个 role 都有岗位说明，一个 manager 来分派任务。心智模型是一支由专家组成的小团队。
- **AutoGen** → 你画一张 Slack 私聊。两个 agent 互发消息；要主持人就拉第三个进来。心智模型是聊天。
- **Agno** → 你画一个方框，下面挂着工具。并排几个方框就是一个 team。心智模型是「自带电池的 agent」。

### state 这道题

state 是大多数框架选择在生产里翻车的地方。

- **LangGraph.** 类型化 state（`TypedDict` 或 Pydantic 模型）、按字段的 reducer、一等公民的 checkpointer（SQLite/Postgres/Redis）。Resume、interrupt、time-travel 都是免费的。*（参见 Phase 11 · 16。）*
- **CrewAI.** state 在 task 之间通过 `context` 字段以字符串流动，或通过 `output_pydantic` 结构化传递。开箱即用没有按 crew 持久化的存储；要 crew 跨重启幸存就得自己拼。
- **AutoGen.** state 就是聊天历史外加用户自定义的 `context`。对话记录可以持久化；任意工作流 state 不行，除非你自己写适配器。
- **Agno.** 内置 storage driver（SQLite、Postgres、Mongo、Redis、DynamoDB），通过 `storage=` 挂到 `Agent` 上 —— 对话会话和用户 memory 自动持久化。它不是完整的 graph checkpointer，是一个 session store。

### 分支这道题

任何不平凡的 agent 都会分支。谁来决定分支很重要。

- **LangGraph** —— 你来决定，用条件边。路由是一个 Python 函数，命名分支。分支在编译后的图里是一等公民；checkpointer 会记录走了哪条分支。
- **CrewAI** —— 分层模式下 manager 来决定；顺序模式下你在构建期决定。路由隐含在任务列表里；除了 manager 的 prompt 之外没有一等公民级别的「if」。
- **AutoGen** —— agent 在聊天里决定。分支从「下一个谁说话」中涌现。`GroupChatManager` 选下一个发言者；你可以手写 `speaker_selection_method`，但默认是 LLM 驱动的。
- **Agno** —— agent 通过下一步调用哪个工具来决定。Team 提供 coordinator/router/collaborator 三种模式；超出这些的分支就是开发者自己的事。

### 可观测性这道题

- **LangGraph** —— OpenTelemetry，通过 LangSmith 或任何 OTel exporter。每一次节点转移都是一段 trace span；checkpoint 同时充当可重放的 trace。LangSmith 是官方首选；Langfuse / Phoenix 也有适配器。
- **CrewAI** —— 自 2025 年末起 OpenTelemetry 就是一等公民；与 Langfuse、Phoenix、Opik、AgentOps 都有集成。
- **AutoGen** —— 通过 `autogen-core` 集成 OpenTelemetry；AgentOps 与 Opik 有连接器。trace 粒度是按 agent 消息的，不是按节点的。
- **Agno** —— 内置 `monitoring=True` 开关加上 OpenTelemetry exporter；与 Langfuse 在 session trace 上深度集成。

### 成本与延迟

四个框架都会带来每次调用的额外开销（框架逻辑、校验、序列化）。开销从小到大粗排：Agno ≈ LangGraph < CrewAI ≈ AutoGen。差距主要由「框架自己又额外做了多少 LLM 路由」决定。CrewAI 的分层 manager 要花 token 决定下一个由谁来跑；AutoGen 的 `GroupChatManager` 同理。LangGraph 只在你写 `llm.invoke` 的地方花 token。Agno 的单 agent 路径很薄。

当每次运行的成本要紧时，优先用显式路由（LangGraph 边、AutoGen 的 `speaker_selection_method`）而不是 LLM 选择型路由。

### 互操作性

- **LangGraph** ↔ **LangChain** 工具、retriever、LLM。一等公民的 MCP 适配器（工具以 MCP server 形式导入）。
- **CrewAI** ↔ 工具继承自 `BaseTool`；LangChain 工具、LlamaIndex 工具、MCP 工具都能适配进来。crew 之间通过 `allow_delegation=True` 委托。
- **AutoGen** → `FunctionTool` 包裹任意 Python 可调用对象；有 MCP 适配器。在 agent 之间的模式上跟 AG2 生态耦合较紧。
- **Agno** → `@tool` 装饰器或 BaseTool 子类；有 MCP 适配器；工具可以在 agent 与 team 之间共享。

## 技能（The Skill）

> 你能用一句话讲清楚：为什么这个 agent 问题应该用这个框架。

动手前的检查清单：

1. **画出形状。** 这是一张 graph（类型化 state、命名转移）？一场 role play（专家之间交接工作）？一段 chat（agent 们一直聊到结束）？还是一个带工具的单 agent？
2. **决定谁来分支。** 开发者决定分支 → LangGraph。Manager agent 决定 → CrewAI 分层。聊天涌现 → AutoGen。tool call 决定 → Agno。
3. **核 state 预算。** 你需要 resume-from-checkpoint 吗？time-travel？跑到一半被人工打断？如果要，LangGraph 是默认选项；Agno session 覆盖会话级 state。
4. **核成本预算。** LLM 选择型路由每轮都要多花 token。如果 agent 一天跑几千次，优先显式路由。
5. **给框架开销留预算。** 每加一个框架就多一份依赖。如果任务只有两次 LLM 调用加一个工具，就写 30 行普通 Python；没有任何框架比「不用框架」更便宜。

在你能把图、组织架构图、聊天或 agent 方框画出来之前，拒绝伸手去拿框架。在你必须为了真正想要的东西去跟它的 state 模型搏斗时，拒绝选它。

## 决策矩阵（The Decision Matrix）

| 问题形状 | 首选框架 | 原因 |
|---------------|---------------------|-----|
| 带类型化 state、人工审批、长周期的工作流 DAG | LangGraph | state、checkpointer、interrupt、time-travel 都是一等公民。 |
| 角色清晰的 research / writing 流水线 | CrewAI（顺序）或 LangGraph 子图 | 「一 task 一 role」在 CrewAI 里写起来便宜；当分支变复杂时升级到 LangGraph。 |
| Proposer-critic 或 teacher-student 对话 | AutoGen | 两个 agent 聊天是它的母语形态。 |
| 带工具、session、memory 的单 agent | Agno | 搭起来最薄，存储与 memory 内置。 |
| 上千路并行 fanout，带 reducer | LangGraph + `Send` | 唯一一个有一等公民并行派发 API 的。 |
| 快速原型，不想绑死框架 | 普通 Python + 供应商 SDK | 没有框架就是最快的框架。 |

## 练习（Exercises）

1. **简单。** 拿同一个任务 —— 「research Anthropic 总部，写一篇 200 字简报，附引用」 —— 在 LangGraph 里实现（四个节点：plan、search、write、cite），同时在 CrewAI 里实现（三个角色：researcher、writer、editor）。报告每次运行的 token 成本和代码行数。
2. **中等。** 把同一个任务在 AutoGen 里实现（researcher ↔ writer 聊天，editor 通过 `GroupChat` 加入），再在 Agno 里实现（一个 agent 加 `search_tools` 与 `write_tools`，再加一个 session store）。把这四个实现按 (a) 每次运行成本、(b) 崩溃后能否 resume、(c) 写之前能否注入一次人工审批 排个名。
3. **困难。** 写一个决策树脚本 `pick_framework.py`，输入一段简短问题描述（JSON：`{has_typed_state, has_roles, has_dialogue, has_parallel_fanout, needs_resume}`），输出一个推荐和一句话理由。在你自己设计的六个用例上验证它。

## 关键术语（Key Terms）

| 术语 | 大家嘴上说的 | 实际意思 |
|------|-----------------|-----------------------|
| Orchestration（编排） | 「agent 怎么协作」 | 决定下一个跑哪个节点 / 角色 / agent 的那一层。 |
| Durable state（持久 state） | 「重启后能 resume」 | 进程死了还能活下来的 state，挂在一个 checkpoint 或 session store 上。 |
| LLM-selected routing（LLM 选择型路由） | 「让模型自己决定」 | 一个 planner LLM 每轮挑下一步；灵活但每次决策都要花 token。 |
| Explicit routing（显式路由） | 「开发者来决定」 | 一个 Python 函数或一条静态边来挑下一步；便宜且可审计。 |
| Crew | 「CrewAI 团队」 | role + task + process（顺序或分层）绑成一个可运行体。 |
| GroupChat | 「AutoGen 的多 agent 聊天」 | 一段被托管的、N 个 agent 之间的对话，配一个发言者选择器。 |
| Team（Agno） | 「多 agent 的 Agno」 | 在一组 agent 之上的 route / coordinate / collaborate 模式。 |
| StateGraph | 「LangGraph 的图」 | 类型化 state、节点、条件边、checkpointer 这套抽象。 |

## 延伸阅读（Further Reading）

- [LangGraph 文档](https://langchain-ai.github.io/langgraph/) —— StateGraph、checkpointer、interrupt、time-travel。
- [CrewAI 文档](https://docs.crewai.com/) —— Crews、Flows、Agents、Tasks、Processes。
- [AutoGen 文档](https://microsoft.github.io/autogen/) —— ConversableAgent、GroupChat、team、工具。
- [Agno 文档](https://docs.agno.com/) —— Agent、Team、Workflow、storage、memory。
- [Anthropic —— Building effective agents（2024 年 12 月）](https://www.anthropic.com/research/building-effective-agents) —— 框架无关的模式库（prompt chaining、routing、parallelization、orchestrator-workers、evaluator-optimizer）。
- [Yao et al., "ReAct: Synergizing Reasoning and Acting"（ICLR 2023）](https://arxiv.org/abs/2210.03629) —— 每个框架包装的那个循环。
- [Wu et al., "AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation"（2023）](https://arxiv.org/abs/2308.08155) —— AutoGen 的设计论文。
- [Park et al., "Generative Agents: Interactive Simulacra of Human Behavior"（UIST 2023）](https://arxiv.org/abs/2304.03442) —— CrewAI 式人格栈所建立的角色扮演基础。
- Phase 11 · 16（LangGraph）—— 本课对标的那个框架。
- Phase 11 · 19（Reflexion）—— 一个能干净映射到 LangGraph、却尴尬映射到 CrewAI 的模式。
- Phase 11 · 22（生产级可观测性）—— 不管你选哪个框架，怎么给它装上仪表。
