# 有状态图编排 — 持久化执行与检查点

> Agent 是一个状态机；节点是函数；边是状态转移；状态在每个节点执行后进行检查点保存。发生任何故障时，可从最近一次成功的检查点恢复。LangGraph 是 2026 年这一低层级有状态编排模型的参考实现。

**Type:** Learn + Build
**Languages:** Python（标准库）
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**Time:** 约 75 分钟

## 学习目标

- 描述 LangGraph 的核心模型：带类型化状态的状态机、函数节点、条件边，以及节点后检查点。
- 说出文档强调的四项能力：持久化执行、流式输出、人在回路、全面的记忆管理。
- 解释 LangGraph 支持的三种编排拓扑：supervisor、对等、层级（嵌套子图）。
- 使用标准库实现一个状态图，包含类型化状态、条件边以及检查点/恢复循环。

## 问题所在

Agent 和工作流共享一个难题：当一次 40 步的运行在第 38 步失败时，你希望从第 38 步恢复，而不是从头再来。二等公民式的状态模型会让运维人员在假设每次都是全新运行的库之上，艰难地修补重试逻辑。

LangGraph 的设计答案是：状态是一等公民的类型化对象，变更是显式的，检查点在每个节点之后持久化。恢复只需一次 `load_state(session_id)` 调用。

## 核心概念

### 图

图由以下部分定义：

- **状态类型。** 一个类型化的 dict（或 Pydantic 模型），每个节点都读取并修改它。
- **节点。** 纯函数 `(state) -> state_update`。返回后，更新会被合并进状态。
- **边。** 节点之间的条件转移或直接转移。
- **入口和出口。** `START` 和 `END` 哨兵节点标记边界。

示例：一个包含 `classify`、`refund`、`bug`、`sales`、`done` 节点的 agent —— 一个以图形式呈现的路由工作流。

### 持久化执行

每个节点返回后，运行时会序列化状态并写入 checkpointer（SQLite、Postgres、Redis、自定义）。在第 N 步失败时，运行时可以 `resume(session_id)`，并以完全一致的状态从第 N+1 步继续。

LangGraph 文档明确列举了这在生产环境中很重要的用户：Klarna、Uber、J.P. Morgan。核心卖点不是图的结构，而是图结构加检查点让恢复变得廉价。

### 流式输出

每个节点都可以产出部分输出。图以节点为粒度将增量事件流式推送给调用方，因此 UI 可以随图的运行实时更新。

### 人在回路

在节点之间检查并修改状态。实现方式：在关键节点前暂停，将状态呈现给人类，接受修改后恢复。checkpointer 使这变得简单，因为状态已经被序列化。

### 记忆

短期记忆（单次运行内 —— 状态中的对话历史）和长期记忆（跨运行 —— 通过 checkpointer 持久化，外加独立的长期存储）。LangGraph 通过工具与外部记忆系统集成（Mem0、自定义）。

### 三种拓扑

1. **Supervisor。** 中央路由 LLM 将任务分派给专家子 agent。`create_supervisor()` 位于 `langgraph-supervisor` 中（不过 LangChain 团队在 2026 年建议为了更好的上下文控制，直接通过 tool calls 来实现）。
2. **Swarm / 对等。** agent 通过共享的工具接口直接交接。没有中央路由。
3. **层级。** supervisor 管理子 supervisor，以嵌套子图实现。

### 该模式的常见问题

- **检查点过小。** 只对对话轮次做检查点，会导致工具状态和记忆写入无法恢复。完整状态必须被序列化。
- **非确定性节点。** 恢复假设节点的输入会产生相同的状态更新。随机种子、墙上时钟、外部 API 必须被捕获。
- **滥用条件边。** 每条边都是条件边的图就是一个无法推理的状态机。应优先使用带少量分支的线性链。

```figure
langgraph-state
```

## 动手构建

`code/main.py` 实现了一个基于标准库的有状态图：

- `State` — 一个类型化 dict，包含 `messages`、`step`、`route`、`output`、`human_approval`。
- `Node` — 接收状态并返回更新 dict 的可调用对象。
- `StateGraph` — 节点 + 边 + 条件边 + 运行 + 恢复。
- `SQLiteCheckpointer`（内存中的模拟实现）— 在每个节点后序列化状态；`load(session_id)` 用于恢复。
- 一个演示图：classify -> branch(refund / bug / sales) -> human gate -> send。

运行：

```
python3 code/main.py
```

执行轨迹显示第一次运行在 human gate 失败、状态被持久化，随后恢复并产生最终输出。

## 直接使用

- **LangGraph** — 参考实现，可用于生产。使用 `create_react_agent`、`create_supervisor`，或自己构建图。
- **AutoGen v0.4**（第 14 课）— 面向高并发场景的 actor 模型替代方案。
- **Claude Agent SDK**（第 17 课）— 内置会话存储的托管框架。
- **Custom** — 当你需要对状态结构或 checkpointer 后端进行精确控制时。

## 上线部署

`outputs/skill-state-graph.md` 可在任意目标运行时中生成 LangGraph 风格的状态图，并内置检查点与恢复机制。

## 练习

1. 当分类置信度低于阈值时，从 `classify` 向 `end` 添加一条条件边。在人工手动设置 `route` 后恢复运行。
2. 将类 SQLite 的模拟实现替换为真实的 SQLite checkpointer。测量每步的序列化开销。
3. 实现并行边：两个节点并发运行，通过自定义 reducer 合并。不可变状态在这里带来了什么好处？
4. 阅读 `langgraph-supervisor` 参考文档。将示例移植到 `create_supervisor`。对比两者的执行轨迹形态。
5. 添加流式输出：每个节点在运行时产出部分状态。在增量到达时打印它们。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| State graph | "作为状态机的 agent" | 类型化状态 + 节点 + 边 + reducer |
| Checkpointer | "持久化后端" | 在每个节点后序列化状态；支持恢复 |
| Reducer | "状态合并器" | 将当前状态与节点更新合并的函数 |
| Conditional edge | "分支" | 由状态的函数决定的边 |
| Subgraph | "嵌套图" | 作为另一个图中的节点使用的图 |
| Durable execution | "从故障中恢复" | 以完全一致的状态从最近成功的节点重启 |
| Supervisor | "路由 LLM" | 专家子 agent 的中央调度器 |
| Swarm | "P2P agent" | agent 通过共享工具交接；没有中央路由 |

## 延伸阅读

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) — 参考文档
- [langgraph-supervisor reference](https://reference.langchain.com/python/langgraph/supervisor/) — supervisor 模式 API
- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) — actor 模型替代方案
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) — 会话存储与子 agent