# 13 · LangGraph：有状态图与持久化执行

> LangGraph 是 2026 年底层有状态编排的参考实现。智能体（Agent）就是一台状态机；节点是函数；边是状态转移；状态不可变，并在每一步之后被检查点（checkpoint）化。可从任意失败处精确地恢复执行，从中断的位置继续。

**类型：** 学习 + 构建
**语言：** Python（标准库）
**前置：** 阶段 14 · 01（智能体循环）、阶段 14 · 12（工作流模式）
**时长：** 约 75 分钟

## 学习目标

- 描述 LangGraph 的核心模型：带不可变状态的状态机、函数节点、条件边（conditional edges），以及每步之后的检查点。
- 说出文档强调的四项能力：持久化执行（durable execution）、流式输出（streaming）、人在回路（human-in-the-loop）、完整的记忆（memory）。
- 解释 LangGraph 支持的三种编排拓扑：监督者（supervisor）、点对点（peer-to-peer，即 swarm 蜂群）、层级式（hierarchical，即嵌套子图）。
- 用标准库实现一个状态图，包含不可变状态、条件边，以及一个检查点/恢复（checkpoint/resume）循环。

## 问题所在

智能体与工作流共享同一个问题：当一次 40 步的运行在第 38 步失败时，你希望从第 38 步恢复，而不是从头再来。把状态当作二等公民来对待的设计，会逼着运维人员在一个假设每次都是全新运行的库之外，自己拼凑各种重试逻辑。

LangGraph 的设计回应是：状态是一等的带类型对象，变更是显式的，并且每个节点之后都会持久化检查点。恢复运行只需要调用一次 `load_state(session_id)`。

## 核心概念

### 图

一张图由以下部分定义：

- **状态类型（State type）。** 一个带类型的字典（或 Pydantic 模型），每个节点都会读取并修改它。
- **节点（Nodes）。** 纯函数 `(state) -> state_update`。函数返回后，更新会被合并进状态。
- **边（Edges）。** 节点之间的条件转移或直接转移。
- **入口与出口。** `START` 与 `END` 哨兵节点标记边界。

示例：一个带有 `classify`、`refund`、`bug`、`sales`、`done` 节点的智能体——以图的形式表达一个路由工作流。

### 持久化执行

每个节点返回之后，运行时会序列化状态并写入检查点器（checkpointer，可选 SQLite、Postgres、Redis 或自定义）。当第 N 步失败时，运行时可以执行 `resume(session_id)`，带着精确的状态从第 N+1 步继续。

LangGraph 文档明确点名了这一能力发挥作用的生产用户：Klarna、Uber、J.P. Morgan。其主张的重点不是图的形态本身，而是图的形态加上检查点机制，让故障恢复变得廉价。

### 流式输出

每个节点都可以产出（yield）部分输出。图会向调用方流式发送「每节点增量（per-node-delta）」事件，从而让 UI 随着图的运行而实时更新。

### 人在回路

在节点之间检视并修改状态。实现方式：在某个关键节点之前暂停，把状态呈现给人类，接受其修改，然后恢复运行。由于状态早已被序列化，检查点器让这件事变得很容易。

### 记忆

短期记忆（一次运行之内——存于状态中的对话历史）与长期记忆（跨运行——通过检查点器加上一个独立的长期存储来持久化）。LangGraph 通过工具与外部记忆系统（Mem0、自定义）集成。

### 三种拓扑

1. **监督者（Supervisor）。** 中心路由 LLM 把任务派发给各专精子智能体。`langgraph-supervisor` 中提供了 `create_supervisor()`（不过 2026 年 LangChain 团队建议直接通过工具调用来实现，以获得更强的上下文控制）。
2. **蜂群 / 点对点（Swarm / peer-to-peer）。** 智能体通过共享的工具界面直接相互移交（hand off）。没有中心路由。
3. **层级式（Hierarchical）。** 监督者管理子监督者，以嵌套子图（nested subgraphs）的形式实现。

### 这一模式何处会出错

- **检查点粒度太小。** 只对对话轮次做检查点，会导致工具状态和记忆写入无法恢复。必须把完整状态序列化下来。
- **非确定性节点。** 恢复假设相同的节点输入会产生相同的状态更新。随机种子、墙钟时间（wall-clock）、外部 API 都必须被捕获记录。
- **过度使用条件边。** 一张每条边都是条件边的图，就是一台无法被推理的状态机。优先采用线性链条，偶尔分支。

## 动手构建

`code/main.py` 用标准库实现了一个有状态图：

- `State` —— 一个带 `messages`、`step`、`route`、`output`、`human_approval` 字段的带类型字典。
- `Node` —— 可调用对象，接收状态并返回一个更新字典。
- `StateGraph` —— 节点 + 边 + 条件边 + 运行 + 恢复。
- `SQLiteCheckpointer`（内存中的伪实现）—— 每个节点之后序列化状态；`load(session_id)` 负责恢复。
- 一个演示图：classify -> branch(refund / bug / sales) -> human gate -> send。

运行它：

```
python3 code/main.py
```

执行轨迹会展示：第一次运行在人工审批关卡处失败、持久化，然后恢复并产生最终输出。

## 实战运用

- **LangGraph** —— 参考实现，生产可用。使用 `create_react_agent`、`create_supervisor`，或自行构建图。
- **AutoGen v0.4**（第 14 课）—— 面向高并发场景的 actor 模型替代方案。
- **Claude Agent SDK**（第 17 课）—— 带内置会话存储的托管运行框架（harness）。
- **自定义** —— 当你需要对状态形态或检查点器后端有精确控制时。

## 交付产出

`outputs/skill-state-graph.md` 会在任意目标运行时中生成一个 LangGraph 形态的状态图，且已接好检查点与恢复机制。

## 练习

1. 为 `classify` 添加一条条件边：当分类置信度低于某阈值时转向 `end`。在人类手动设置 `route` 之后恢复运行。
2. 把类 SQLite 的伪实现替换为真正的 SQLite 检查点器。测量每步序列化的开销。
3. 实现并行边：两个节点并发运行，通过一个自定义归约器（reducer）合并。在这里，不可变状态带来了什么好处？
4. 阅读 `langgraph-supervisor` 参考文档。把这个玩具示例移植到 `create_supervisor`。对比两者的轨迹形态。
5. 添加流式输出：每个节点在运行过程中产出部分状态。在增量到达时即时打印出来。

## 关键术语

| 术语 | 人们常说 | 实际含义 |
|------|----------------|------------------------|
| 状态图（State graph） | 「智能体即状态机」 | 带类型的状态 + 节点 + 边 + 归约器 |
| 检查点器（Checkpointer） | 「持久化后端」 | 每个节点之后序列化状态；使恢复成为可能 |
| 归约器（Reducer） | 「状态合并器」 | 将当前状态与某节点的更新合并的函数 |
| 条件边（Conditional edge） | 「分支」 | 由状态的函数决定走向的边 |
| 子图（Subgraph） | 「嵌套图」 | 被当作另一张图中一个节点来使用的图 |
| 持久化执行（Durable execution） | 「从失败处恢复」 | 带着精确状态从最后一个成功节点重新开始 |
| 监督者（Supervisor） | 「路由 LLM」 | 面向专精子智能体的中心派发器 |
| 蜂群（Swarm） | 「P2P 智能体」 | 智能体通过共享工具相互移交；没有中心路由 |

## 延伸阅读

- [LangGraph 概览](https://docs.langchain.com/oss/python/langgraph/overview) —— 参考文档
- [langgraph-supervisor 参考](https://reference.langchain.com/python/langgraph/supervisor/) —— 监督者模式 API
- [AutoGen v0.4，微软研究院](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) —— actor 模型替代方案
- [Claude Agent SDK 概览](https://platform.claude.com/docs/en/agent-sdk/overview) —— 会话存储与子智能体
