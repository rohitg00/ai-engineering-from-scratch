# LangGraph：有状态图与持久执行

> LangGraph 是 2026 年低级有状态编排的参考。Agent 是一个状态机；节点是函数；边是转换；状态是不可变的，并在每一步之后创建检查点。从任何失败的精确位置恢复。

**类型：** 学习与构建
**语言：** Python（标准库）
**前置要求：** 阶段 14 · 01（Agent 循环）、阶段 14 · 12（工作流模式）
**时长：** 约 75 分钟

## 学习目标

- 描述 LangGraph 的核心模型：带有不可变状态、函数节点、条件边和后步骤检查点的状态机。
- 说出文档强调的四种能力：持久执行、流式传输、人在回路（human-in-the-loop）、全面记忆。
- 解释 LangGraph 支持的三种编排拓扑：超级visor（supervisor）、点对点（swarm）、层次结构（nested subgraphs）。
- 实现带有不可变状态、条件边和检查点/恢复周期的标准库状态图。

## 问题背景

Agent 和工作流共享一个问题：当 40 步运行在第 38 步失败时，你想从第 38 步恢复，而不是重新开始。二级状态模型让操作员围绕假设新运行的库黑客重试。

LangGraph 的设计回答：状态是一等类型化对象，突变是显式的，检查点在每个节点之后持久化。恢复是一个 `load_state(session_id)` 调用。

## 核心概念

### 图

图由以下定义：

- **状态类型。** 每个节点读取和突变的类型化字典（或 Pydantic 模型）。
- **节点（Nodes）。** 纯函数 `(state) -> state_update`。返回后更新合并到状态中。
- **边（Edges）。** 节点之间的条件或直接转换。
- **入口和出口。** `START` 和 `END` 标记边界的哨兵节点。

示例：带有 `classify`、`refund`、`bug`、`sales`、`done` 节点的 Agent——作为图的路由工作流。

### 持久执行

在每个节点返回后，运行时序列化状态并将其写入检查器（SQLite、Postgres、Redis、自定义）。在步骤 N 失败时，运行时可以 `resume(session_id)` 并从步骤 N+1 以精确状态恢复。

LangGraph 文档明确强调这对生产用户很重要：Klarna、Uber、J.P. Morgan。主张的不是图形状；而是图形状加上检查点使恢复便宜。

### 流式传输

每个节点可以产生部分输出。图将每节点增量事件流式传输给调用者，以便 UI 在图运行时更新。

### 人在回路

在节点之间检查和修改状态。实现：在关键节点之前暂停，将状态展示给人类，接受修改，恢复。检查器使这很容易，因为状态已经序列化。

### 记忆

短期（运行内——状态中的对话历史）和长期（跨运行——通过检查器加上单独的长期存储持久化）。LangGraph 通过工具与外部记忆系统（Mem0、自定义）集成。

### 三种拓扑

1. **Supervisor（监督器）。** 中央路由器 LLM 分派给专家子 Agent。`create_supervisor()` 在 `langgraph-supervisor` 中（尽管 LangChain 团队在 2026 年建议直接通过工具调用执行此操作以获得更多上下文控制）。
2. **Swarm / peer-to-peer（群/点对点）。** Agent 通过共享工具表面直接移交。无中央路由器。
3. **Hierarchical（层次结构）。** 管理子监督器的监督器，实现为嵌套子图。

### 这种模式哪里会出错

- **检查点太小。** 仅检查点对话回合使工具状态和记忆写入不可恢复。必须序列化完整状态。
- **非确定性节点。** 恢复假设节点输入产生相同的状态更新。必须捕获随机种子、墙上时钟、外部 API。
- **过度使用条件边。** 每个边都是条件的图是无法推理的状态机。更喜欢带有偶尔分支的线性链。

## 构建它

`code/main.py` 实现一个标准库有状态图：

- `State`——带有 `messages`、`step`、`route`、`output`、`human_approval` 的类型化字典。
- `Node`——接受状态并返回更新字典的可调用对象。
- `StateGraph`——节点 + 边 + 条件边 + 运行 + 恢复。
- `SQLiteCheckpointer`（内存中虚假）——在每个节点之后序列化状态；`load(session_id)` 恢复。
- 一个演示图：classify -> branch(refund / bug / sales) -> human gate -> send。

运行它：

```
python3 code/main.py
```

轨迹显示第一次运行在人工门处失败、持久化，然后恢复产生最终输出。

## 使用它

- **LangGraph**——参考，生产就绪。使用 `create_react_agent`、`create_supervisor` 或构建你自己的图。
- **AutoGen v0.4**（第 14 课）——用于高并发场景的参与者模型替代方案。
- **Claude Agent SDK**（第 17 课）——带有内置会话存储的托管框架。
- **自定义**——当你需要对状态形状或检查器后端进行精确控制时。

## 部署它

`outputs/skill-state-graph.md` 在任何目标运行时生成带有检查点和恢复连接的 LangGraph 形状态图。

## 练习

1. 当分类置信度低于阈值时，添加从 `classify` 到 `end` 的条件边。在人类手动设置 `route` 后恢复运行。
2. 将类 SQLite 虚假检查器换成为真正的 SQLite 检查器。测量每步序列化开销。
3. 实现并行边：两个节点并发运行，通过自定义 reducer 合并。不可变状态在这里买到了什么？
4. 阅读 `langgraph-supervisor` 参考。将玩具移植到 `create_supervisor`。比较轨迹形状。
5. 添加流式传输：每个节点在运行时产生部分状态。在它们到达时打印增量。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| State graph | "作为状态机的 Agent" | 类型化状态 + 节点 + 边 + reducer |
| Checkpointer | "持久化后端" | 在每个节点之后序列化状态；启用恢复 |
| Reducer | "状态合并器" | 将当前状态与节点更新组合的函数 |
| Conditional edge | "分支" | 由状态函数选择的边 |
| Subgraph | "嵌套图" | 在另一个图中用作节点的图 |
| Durable execution | "从失败恢复" | 以精确状态在最后一个成功节点重新启动 |
| Supervisor | "路由器 LLM" | 专家子 Agent 的中央分派器 |
| Swarm | "P2P Agent" | Agent 通过共享工具移交；无中央路由器 |

## 延伸阅读

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)——参考文档
- [langgraph-supervisor reference](https://reference.langchain.com/python/langgraph/supervisor/)——监督器模式 API
- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/)——参与者模型替代方案
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview)——会话存储和子 Agent
