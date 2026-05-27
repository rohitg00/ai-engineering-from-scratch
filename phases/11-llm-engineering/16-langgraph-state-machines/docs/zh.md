# LangGraph — 智能体的状态机

> 手工编写的 ReAct 循环是一个 `while True`。用 LangGraph 编写的 ReAct 循环是一个你可以检查点（checkpoint）、中断（interrupt）、分支（branch）和时间旅行（time-travel）的图。智能体本身没有改变，改变的是它周围的框架。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 11 · 09（函数调用），阶段 11 · 14（模型上下文协议，Model Context Protocol）
**时间：** 约75分钟

## 问题

你发布了一个支持函数调用的智能体。它正常运行了三轮，然后出问题了：模型尝试调用一个返回 500 的工具，用户中途改变了主意，或者智能体在没有人类批准的情况下决定退款订单。`while True:` 循环没有钩子。你无法暂停它，无法回退它，也无法分支到“如果模型选择了另一个工具会怎样”。一旦你将这个智能体发布到演示之外，它就变成了一个要么成功要么失败的黑箱。

一旦你意识到这一点，下一步就很明显了。智能体本身就是一个状态机——系统提示（system prompt）加上消息历史（message history）加上待处理的工具调用（pending tool calls）再加上下一步动作。将状态机显式化：节点（node）代表“模型思考”、“工具运行”、“人类批准”，边（edge）代表它们之间的条件转换。一旦图变得显式，框架就免费获得了四种能力：检查点（在步骤之间保存状态）、中断（暂停等待人类）、流式传输（流式传输令牌和中间事件）和时间旅行（回退到之前的状态并尝试不同的分支）。

LangGraph 就是实现这种抽象概念的库。它不是一个 LangChain 意义上的智能体框架（比如“这是一个 AgentExecutor，祝你好运”）。它是一个图运行时，具有一等公民的状态、一等公民的持久化和一等公民的中断。智能体循环是你画出来的，而不是手写的。

## 概念

![LangGraph StateGraph：节点、边和检查点](../assets/langgraph-stategraph.svg)

一个 `StateGraph` 包含三个部分。

1. **状态（State）。** 一个类型化字典（TypedDict 或 Pydantic 模型），在图中流动。每个节点接收完整状态，并返回一个部分更新，LangGraph 使用每个字段的*归约器（reducer）*来合并这些更新——对于应该累积的列表使用 `operator.add`，默认情况下则覆盖。
2. **节点（Nodes）。** Python 函数 `state -> partial_state`。每个都是离散步骤：“调用模型”、“运行工具”、“总结”。
3. **边（Edges）。** 节点之间的转换。静态边指向一个地方。条件边接受一个路由器函数 `state -> next_node_name`，这样图就可以根据模型输出进行分支。

你编译这个图。编译会绑定拓扑结构、附加检查点（checkpointer）（可选但生产环境必需），并返回一个可运行对象。你使用初始状态和 `thread_id` 来调用它。执行的每一步都会持久化一个以 `(thread_id, checkpoint_id)` 为键的检查点。

### 四种超级能力

**检查点（Checkpointing）。** 每次节点转换都会将新状态写入存储（测试用内存，生产环境用 Postgres/Redis/SQLite）。通过使用相同的 `thread_id` 再次调用图来恢复执行。图会从暂停的地方继续。

**中断（Interrupts）。** 用 `interrupt_before=["human_review"]` 标记一个节点，执行会在该节点运行之前停止。状态被持久化。你的 API 会向用户响应“等待批准”。稍后使用 `Command(resume=...)` 对同一个 `thread_id` 的请求会恢复执行。

**流式传输（Streaming）。** `graph.stream(state, mode="updates")` 会在状态增量发生时产生它们。`mode="messages"` 会在模型节点内部流式传输 LLM 令牌。`mode="values"` 会产生完整的快照。你可以选择在你的 UI 中显示什么。

**时间旅行（Time-travel）。** `graph.get_state_history(thread_id)` 返回完整的检查点日志。将任何之前的 `checkpoint_id` 传递给 `graph.invoke`，你就会从那个点分叉。非常适合调试（“如果模型选择了工具 B 会怎样？”）以及用于重放生产痕迹的回归测试。

### 归约器是关键

每个状态字段都有一个归约器。大多数默认值就足够了——新值会覆盖旧值。但是消息列表需要 `operator.add`，这样新消息才会追加而不是替换。并行边会通过归约器合并它们的更新。如果两个节点都更新了 `messages`，而你忘记了 `Annotated[list, add_messages]`，那么第二个会静默获胜，你就会丢失一半的轮次。归约器是库中唯一微妙的地方；把它搞对了，剩下的就能组合起来。

### 四个节点的 ReAct 图

一个生产级 ReAct 智能体由四个节点和两条边组成：

1. `agent` — 使用当前消息历史调用 LLM。返回助手消息（可能包含 tool_calls）。
2. `tools` — 执行上一条助手消息中的任何 tool_calls，将工具结果作为工具消息追加。
3. 从 `agent` 出发的条件边，如果最后一条消息有 tool_calls 则路由到 `tools`，否则路由到 `END`。
4. 从 `tools` 回到 `agent` 的静态边。

就是这样。你获得了完整的 ReAct 循环（思考→行动→观察→思考→…），包括检查点、中断和流式传输，大约 40 行代码。

### StateGraph 与 Send（扇出）

`Send(node_name, state)` 允许一个节点分发并行的子图。例如：智能体决定同时查询三个检索器。每个 `Send` 都会生成目标节点的一个并行执行；它们的输出通过状态归约器合并。这就是 LangGraph 无需线程原语表达编排者-工作者（orchestrator-workers）模式的方式。

### 子图

编译后的图可以是另一个图中的一个节点。外部图看到一个单一的节点；内部图有自己的状态和自己的检查点。这就是团队构建监督者-工作者智能体的方式：监督者图将用户意图路由到每个领域的工作者子图。

## 构建它

### 步骤 1：状态和节点

```python
from typing import Annotated, TypedDict
from langchain_core.messages import AnyMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import MemorySaver

class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]

def agent_node(state: State) -> dict:
    response = llm.invoke(state["messages"])
    return {"messages": [response]}

def should_continue(state: State) -> str:
    last = state["messages"][-1]
    return "tools" if getattr(last, "tool_calls", None) else END

tool_node = ToolNode(tools=[search_web, read_file])

graph = StateGraph(State)
graph.add_node("agent", agent_node)
graph.add_node("tools", tool_node)
graph.set_entry_point("agent")
graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
graph.add_edge("tools", "agent")

app = graph.compile(checkpointer=MemorySaver())
```

`add_messages` 是使消息列表累积而不是覆盖的归约器。忘记它是 LangGraph 最常见的错误。

### 步骤 2：使用线程运行

```python
config = {"configurable": {"thread_id": "user-42"}}
for event in app.stream(
    {"messages": [HumanMessage("find the Anthropic headquarters address")]},
    config,
    stream_mode="updates",
):
    print(event)
```

每次更新都是一个字典 `{node_name: state_delta}`。你的前端可以将这些流式传输到 UI，这样用户就能看到“智能体正在思考… 正在调用 search_web… 得到了结果… 正在回答。”

### 步骤 3：添加人机循环中断

标记一个节点，使其在运行前暂停执行。

```python
app = graph.compile(
    checkpointer=MemorySaver(),
    interrupt_before=["tools"],  # 在每次工具调用前暂停
)

state = app.invoke({"messages": [HumanMessage("delete the production database")]}, config)
# state["__interrupt__"] 已被设置。检查提议的工具调用。
# 如果批准：
from langgraph.types import Command
app.invoke(Command(resume=True), config)
# 如果拒绝：写入一条拒绝消息并恢复
app.update_state(config, {"messages": [AIMessage("Blocked by human reviewer.")]})
```

状态、检查点和线程都在中断期间持久化。除执行期间外，没有任何内容保存在内存中。

### 步骤 4：时间旅行用于调试

```python
history = list(app.get_state_history(config))
for snapshot in history:
    print(snapshot.values["messages"][-1].content[:80], snapshot.config)

# 从之前的检查点分叉
target = history[3].config  # 回退三步
for event in app.stream(None, target, stream_mode="values"):
    pass  # 从那一点向前重放
```

传递 `None` 作为输入会从给定的检查点重放；传递一个值会在恢复之前将其作为对该检查点状态的更新附加。这就是你无需重新运行整个对话就能重现有问题的智能体运行的方式。

### 步骤 5：为生产环境切换检查点

```python
from langgraph.checkpoint.postgres import PostgresSaver

with PostgresSaver.from_conn_string("postgresql://...") as checkpointer:
    checkpointer.setup()
    app = graph.compile(checkpointer=checkpointer)
```

提供了 SQLite、Redis 和 Postgres。`MemorySaver` 用于测试。任何需要在重启后持久化的东西都需要一个真正的存储。

## 技能

> 你将智能体构建为图，而不是 `while True` 循环。

在使用 LangGraph 之前，先做一个 60 秒的设计：

1. **命名节点。** 每个离散的决策或副作用动作都是一个节点。“智能体思考”、“工具运行”、“审查者批准”、“响应流式传输”。如果你无法列出它们，说明任务还不是智能体形态。
2. **声明状态。** 最小的 TypedDict，每个列表字段都有一个归约器。不要把所有东西都塞进 `messages`；将任务特定的字段（工作中的 `plan`、`budget` 计数器、`retrieved_docs` 列表）提升到顶层。
3. **绘制边。** 除非下一步取决于模型输出，否则使用静态边。每个条件边都需要一个具有命名分支的路由器函数。
4. **先选好检查点。** 测试用 `MemorySaver`，其他情况用 Postgres/Redis/SQLite。不要没有检查点就发布——没有检查点就意味着没有恢复、没有中断、没有时间旅行。
5. **在工具运行之前（而不是之后）决定中断。** 批准放在进入副作用节点的边上，这样你就可以在造成损害前取消；验证放在离开模型的边上，这样你就可以廉价地拒绝错误的调用。
6. **默认流式传输。** UI 用 `mode="updates"`，模型节点内部令牌级流式传输用 `mode="messages"`，评估期间完整快照用 `mode="values"`。

拒绝发布一个没有检查点的 LangGraph 智能体。拒绝发布一个在副作用*之后*才中断的智能体。拒绝发布一个没有 `add_messages` 作为其归约器的 `messages` 字段。

## 练习

1. **简单。** 使用一个计算器工具和一个网页搜索工具实现上述四节点 ReAct 图。验证对于两轮对话，`list(app.get_state_history(config))` 至少返回四个检查点。
2. **中等。** 添加一个 `planner` 节点，在 `agent` 之前运行，并将一个结构化的 `plan: list[str]` 写入状态。让 `agent` 标记已完成的计划步骤。如果 `plan` 在检查点恢复时丢失（错误的归约器），则测试失败。
3. **困难。** 构建一个监督者图，使用 `Send` 在三个子图（`researcher`、`writer`、`reviewer`）之间路由。每个子图有自己的状态和检查点。在外部图上添加 `interrupt_before=["writer"]`，以便人类可以批准研究报告确认。确认从之前的检查点进行时间旅行只会重新运行分叉的分支。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|------------|----------|
| StateGraph | "LangGraph 图" | 编译前添加节点和边的构建器对象。 |
| Reducer | "字段如何合并" | 当节点返回该字段的更新时应用的函数 `(old, new) -> merged`；默认是覆盖，`add_messages` 追加。 |
| Thread | "对话 ID" | 一个 `thread_id` 字符串，限定一次会话中所有检查点的范围。 |
| Checkpoint | "暂停的状态" | 节点转换后完整图状态的持久化快照，以 `(thread_id, checkpoint_id)` 为键。 |
| Interrupt | "等待人类" | `interrupt_before` / `interrupt_after` 在节点边界停止执行；使用 `Command(resume=...)` 恢复。 |
| Time-travel | "从先前步骤分叉" | `graph.invoke(None, config_with_old_checkpoint_id)` 从该检查点向前重放。 |
| Send | "并行子图分发" | 节点可以返回的构造函数，用于生成 N 个目标节点的并行执行。 |
| Subgraph | "作为节点的编译后图" | 编译后的 StateGraph 用作另一个图的节点；保留自己的状态范围。 |

## 延伸阅读

- [LangGraph 文档](https://langchain-ai.github.io/langgraph/) — StateGraph、归约器、检查点和中断的权威参考。
- [LangGraph 概念：状态、归约器、检查点](https://langchain-ai.github.io/langgraph/concepts/low_level/) — 本课使用的思维模型，直接来自源头。
- [LangGraph 持久化和检查点](https://langchain-ai.github.io/langgraph/concepts/persistence/) — Postgres/SQLite/Redis 存储、检查点命名空间和线程 ID 的详细信息。
- [LangGraph 人机循环](https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/) — `interrupt_before`、`interrupt_after`、`Command(resume=...)` 和编辑状态模式。
- [Yao et al., "ReAct: Synergizing Reasoning and Acting in Language Models" (ICLR 2023)](https://arxiv.org/abs/2210.03629) — 每个 LangGraph 智能体实现的模式；阅读它以了解推理轨迹原理。
- [Anthropic — Building effective agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) — 哪些图形态（链、路由器、编排者-工作者、评估者-优化器）在何时更受欢迎。
- 阶段 11 · 09（函数调用） — 每个 LangGraph 智能体节点重用的工具调用原语。
- 阶段 11 · 14（模型上下文协议） — 通过 MCP 适配器插入到 LangGraph `ToolNode` 的外部工具发现。
- 阶段 11 · 17（智能体框架权衡） — 何时选择 LangGraph 而非 CrewAI、AutoGen 或 Agno。