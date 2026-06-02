# LangGraph：有状态图与持久化执行

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> LangGraph 是 2026 年底层有状态编排的参考实现。agent 是一台状态机；节点是函数；边是状态转移；状态不可变，且每一步之后都会做 checkpoint。任何失败都能从断点处精确恢复。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 描述 LangGraph 的核心模型：以不可变状态、函数式节点、条件边、节点后 checkpoint 构成的状态机。
- 说出文档强调的四大能力：durable execution（持久化执行）、streaming（流式）、human-in-the-loop（人工确认）、comprehensive memory（完整的记忆体系）。
- 解释 LangGraph 支持的三种编排拓扑（topology）：supervisor（主管）、peer-to-peer（点对点 / swarm 蜂群）、hierarchical（层级嵌套子图）。
- 用 stdlib 实现一个状态图（state graph）：包含不可变状态、条件边，以及一次完整的 checkpoint / 恢复循环。

## 问题（Problem）

agent 和工作流共享同一个痛点：一次跑 40 步的运行在第 38 步挂了，你想从第 38 步续跑，而不是从头来过。把状态当作二等公民的模型，会逼着运维在一个假设「永远是新一次运行」的库外面手写各种重试 hack。

LangGraph 的设计回答是：状态是一等的、强类型对象，变更必须显式声明，每个节点结束后都持久化 checkpoint。恢复就是一行 `load_state(session_id)`。

## 概念（Concept）

### 图（The graph）

一张图由这些组成：

- **状态类型（State type）。** 一个 typed dict（或 Pydantic 模型），所有节点都读取并修改它。
- **节点（Nodes）。** 纯函数 `(state) -> state_update`。返回值会被 merge 进状态。
- **边（Edges）。** 节点之间的条件转移或直连转移。
- **入口与出口。** `START` 和 `END` 哨兵节点标记边界。

例：一个 agent 包含 `classify`、`refund`、`bug`、`sales`、`done` 节点——一条路由式工作流就是一张图。

### Durable execution（持久化执行）

每个节点返回后，运行时会把状态序列化并写入 checkpointer（SQLite、Postgres、Redis、或自定义）。第 N 步失败时，运行时可以 `resume(session_id)`，以完全相同的状态从第 N+1 步继续。

LangGraph 文档明确点名了这一能力对哪些生产用户至关重要：Klarna、Uber、J.P. Morgan。卖点不是图本身的形状，而是「图的形状 + checkpointing」让恢复变得很便宜。

### Streaming（流式）

每个节点都可以 yield 部分输出。图会把每个节点的增量事件流式推给调用方，让 UI 在图运行时实时更新。

### Human-in-the-loop（人工确认）

可以在节点之间检查并修改状态。常见做法：在关键节点前暂停，把状态展示给人看，接受人的修改，再继续。因为状态本来就已经序列化，checkpointer 让这件事变得很简单。

### Memory（记忆）

短期记忆（一次运行内的对话历史，存在 state 里）和长期记忆（跨运行的持久化，靠 checkpointer 加上独立的长期存储）。LangGraph 通过工具与外部记忆系统（Mem0、自定义系统）打通。

### 三种拓扑（Three topologies）

1. **Supervisor（主管）。** 中央路由 LLM 把任务分发给若干专精 subagent。`langgraph-supervisor` 包提供了 `create_supervisor()`（不过 2026 年 LangChain 团队更推荐直接通过 tool call 实现，以便对上下文做更精细的控制）。
2. **Swarm / peer-to-peer（蜂群 / 点对点）。** agent 之间通过共享的工具面直接 handoff（交接）。没有中央路由器。
3. **Hierarchical（层级）。** supervisor 管理 sub-supervisor，用嵌套子图（subgraph）来实现。

### 这个模式容易翻车的地方

- **Checkpoint 太小。** 只 checkpoint 对话轮次，工具状态和 memory 写入就不可恢复。状态必须完整序列化。
- **节点不确定。** 恢复的前提是同样的输入产生同样的状态更新。随机种子、wall-clock 时间、外部 API 都要被捕获记录。
- **滥用条件边。** 每条边都条件化的图，是一台没法推理的状态机。优先用线性链，偶尔分叉。

## 动手实现（Build It）

`code/main.py` 用 stdlib 实现了一张有状态图：

- `State` — 一个 typed dict，包含 `messages`、`step`、`route`、`output`、`human_approval`。
- `Node` — 接收状态、返回更新 dict 的可调用对象。
- `StateGraph` — 节点 + 边 + 条件边 + run + resume。
- `SQLiteCheckpointer`（内存假实现）— 每个节点之后序列化状态；`load(session_id)` 恢复。
- 一张示例图：classify -> branch(refund / bug / sales) -> human gate -> send。

跑一下：

```
python3 code/main.py
```

trace 会展示：第一次运行在 human gate 处挂掉、状态被持久化、然后恢复并产出最终输出。

## 用起来（Use It）

- **LangGraph** — 参考实现，生产可用。可以用 `create_react_agent`、`create_supervisor`，或者自己搭图。
- **AutoGen v0.4**（Lesson 14）— actor 模型替代方案，适合高并发场景。
- **Claude Agent SDK**（Lesson 17）— 托管式 harness，内置 session store。
- **Custom** — 当你需要对状态形状或 checkpointer 后端做精确控制时。

## 上线部署（Ship It）

`outputs/skill-state-graph.md` 会在任何目标运行时里生成一张 LangGraph 形态的状态图，并接好 checkpointing 和恢复。

## 练习（Exercises）

1. 给 `classify` 加一条到 `end` 的条件边：当分类置信度低于阈值时走这条。然后由人手动设置 `route`，再恢复运行。
2. 把那个伪 SQLite 换成真正的 SQLite checkpointer。测量每一步的序列化开销。
3. 实现并行边：两个节点并发运行，用一个自定义 reducer 合并。不可变状态在这里有什么好处？
4. 阅读 `langgraph-supervisor` 参考文档。把这个玩具实现迁移到 `create_supervisor`，对比 trace 形态。
5. 加上 streaming：每个节点运行过程中 yield 部分状态。把到达的增量打印出来。

## 关键术语（Key Terms）

| 术语 | 一般人怎么说 | 实际含义 |
|------|----------------|------------------------|
| State graph（状态图） | 「agent 即状态机」 | 强类型 state + 节点 + 边 + reducer |
| Checkpointer | 「持久化后端」 | 每个节点后序列化状态；让恢复成为可能 |
| Reducer | 「state 合并器」 | 把当前 state 和某节点的更新合并的函数 |
| Conditional edge（条件边） | 「分支」 | 由 state 上的某个函数决定走哪条的边 |
| Subgraph（子图） | 「嵌套图」 | 被另一张图当作节点使用的图 |
| Durable execution | 「失败可恢复」 | 以完全相同的 state 从最后一个成功的节点重启 |
| Supervisor | 「路由 LLM」 | 给专精 subagent 派活的中央分发器 |
| Swarm | 「P2P agent」 | agent 之间通过共享 tool 互相 handoff；没有中央路由 |

## 延伸阅读（Further Reading）

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) — 参考文档
- [langgraph-supervisor reference](https://reference.langchain.com/python/langgraph/supervisor/) — supervisor 模式 API
- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) — actor 模型替代方案
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) — session store 与 subagent
