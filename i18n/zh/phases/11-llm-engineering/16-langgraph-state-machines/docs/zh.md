# 智能体状态机 — 图、节点与检查点

> 手写的 ReAct 循环就是一个 `while True`。同一个循环写成显式图后,你就可以对它进行检查点保存、中断、分支和时间回溯。智能体本身没有变,变的是包裹它的执行框架。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 11 · 09(Function Calling)、Phase 11 · 14(Model Context Protocol)
**Time:** 约 75 分钟

## 问题所在

你上线了一个函数调用智能体。它正常运行了三轮,然后出了问题:模型调用了一个返回 500 的工具,用户在任务中途改变主意,或者智能体在无人审批的情况下决定给订单退款。这个 `while True:` 循环没有任何钩子。你无法暂停它,无法回退它,也无法分支探索"如果模型当时选了另一个工具会怎样"。一旦超出演示范围上线,智能体就变成一个只知成功或失败的黑盒。

看清这一点后,下一步就显而易见了。智能体本来就是一个状态机 — 系统提示词加消息历史加待处理的工具调用加下一个动作。把这个状态机显式化:为"模型思考""工具运行""人类审批"设置节点,为它们之间的条件转换设置边。一旦图是显式的,执行框架就免费获得四样东西:检查点(在步骤之间保存状态)、中断(暂停以等待人类)、流式输出(流式传输 token 和中间事件)以及时间回溯(回退到之前的状态并尝试不同的分支)。

这一抽象的参考实现是 LangGraph。它不是 LangChain 意义上的智能体框架("这是 AgentExecutor,祝你好运")。它是一个图运行时,拥有一等公民的地位状态、持久化和中断。智能体循环是你绘制出来的东西,而不是你手写出来的东西。

## 核心概念

![LangGraph StateGraph: nodes, edges, and the checkpointer](../assets/langgraph-stategraph.svg)

一个 `StateGraph` 包含三样东西。

1. **状态。** 一个在图中流转的类型化字典(TypedDict 或 Pydantic 模型)。每个节点接收完整状态并返回部分更新,LangGraph 使用每个字段的 *reducer* 来合并更新 — 对需要累积的列表使用 `operator.add`,默认行为是覆盖。
2. **节点。** Python 函数 `state -> partial_state`。每个节点是一个离散步骤:"调用模型""运行工具""总结"。
3. **边。** 节点之间的转换。静态边指向一个固定的去向。条件边接受一个路由函数 `state -> next_node_name`,使图能够根据模型输出进行分支。

你编译这个图。编译会绑定拓扑结构,挂载一个 checkpointer(可选,但对生产环境至关重要),并返回一个可运行对象。你用一个初始状态和一个 `thread_id` 来调用它。执行的每一步都会持久化一个以 `(thread_id, checkpoint_id)` 为键的检查点。

### 四大超能力

**检查点。** 每次节点转换都会把新状态写入存储(测试用内存,生产用 Postgres/Redis/SQLite)。通过用相同的 `thread_id` 再次调用图来恢复执行。图会从暂停的地方继续。

**中断。** 用 `interrupt_before=["human_review"]` 标记一个节点,执行会在该节点运行之前停止。状态会被持久化。你的 API 向用户回复"等待审批"。稍后对同一个 `thread_id` 发送带 `Command(resume=...)` 的请求即可恢复执行。

**流式输出。** `graph.stream(state, mode="updates")` 在状态增量发生时产出它们。`mode="messages"` 在模型节点内部流式传输 LLM token。`mode="values"` 产出完整快照。你可以选择在 UI 中展示哪些内容。

**时间回溯。** `graph.get_state_history(thread_id)` 返回完整的检查点日志。把任意先前的 `checkpoint_id` 传给 `graph.invoke`,你就可以从那个点分叉。这对调试("如果模型当时选的是工具 B 呢?")以及重放生产轨迹的回归测试非常有用。

### Reducer 才是关键

每个状态字段都有一个 reducer。大多数默认值就够用 — 新值覆盖旧值。但消息列表需要 `operator.add`,这样新消息才会追加而不是替换。并行边通过 reducer 合并它们的更新。如果两个节点都更新 `messages` 而你忘了加 `Annotated[list, add_messages]`,第二个节点会静默胜出,你会丢失半轮对话。Reducer 是这个库中唯一需要细究的地方;把它弄对了,其余部分都能顺畅组合。

### 四节点的 ReAct 图

生产级 ReAct 智能体是四个节点和两条边:

1. `agent` — 用当前消息历史调用 LLM,返回助手消息(其中可能包含 tool_calls)。
2. `tools` — 执行最后一条助手消息中的所有 tool_calls,并将工具结果作为工具消息追加。
3. 一条从 `agent` 出发的条件边:如果最后一条消息包含 tool_calls,路由到 `tools`,否则路由到 `END`。
4. 一条从 `tools` 返回 `agent` 的静态边。

就是这样。你用大约 40 行代码就得到了完整的 ReAct 循环(Thought → Action → Observation → Thought → …),并带有检查点、中断和流式输出。

### StateGraph 与 Send(fanout)

`Send(node_name, state)` 允许一个节点派发并行子图。例如:智能体决定同时查询三个检索器。每个 `Send` 会生成目标节点的一个并行执行;它们的输出通过状态 reducer 合并。这就是 LangGraph 在不使用线程原语的情况下表达 orchestrator-workers 模式的方式。

### 子图

一个编译后的图可以作为另一个图中的节点。外层图看到的只是一个节点;内层图拥有自己的状态和自己的检查点。团队就是这样构建 supervisor-worker 智能体的:supervisor 图把用户意图路由到每个领域的 worker 子图。

```figure
l5-state-graph-ledger
```

## 动手构建

### 步骤 1:状态和节点

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

`add_messages` 是让消息列表累积而非覆盖的 reducer。忘记它是 LangGraph 最常见的 bug。

### 步骤 2:用线程运行

```python
config = {"configurable": {"thread_id": "user-42"}}
for event in app.stream(
    {"messages": [HumanMessage("find the Anthropic headquarters address")]},
    config,
    stream_mode="updates",
):
    print(event)
```

每次更新都是一个字典 `{node_name: state_delta}`。你的前端可以把这些流式推送到 UI,让用户看到"智能体正在思考… 调用 search_web… 得到结果… 正在回答"。

### 步骤 3:添加人机协同中断

标记一个节点,使执行在它运行之前暂停。

```python
app = graph.compile(
    checkpointer=MemorySaver(),
    interrupt_before=["tools"],  # pause before every tool call
)

state = app.invoke({"messages": [HumanMessage("delete the production database")]}, config)
# state["__interrupt__"] is set. Inspect proposed tool calls.
# If approved:
from langgraph.types import Command
app.invoke(Command(resume=True), config)
# If denied: write a rejection message and resume
app.update_state(config, {"messages": [AIMessage("Blocked by human reviewer.")]})
```

状态、检查点和线程都在中断期间持久保存。除了执行期间,没有任何东西留在内存中。

### 步骤 4:用于调试的时间回溯

```python
history = list(app.get_state_history(config))
for snapshot in history:
    print(snapshot.values["messages"][-1].content[:80], snapshot.config)

# Fork from a prior checkpoint
target = history[3].config  # three steps back
for event in app.stream(None, target, stream_mode="values"):
    pass  # replay from that point forward
```

传入 `None` 作为输入会从给定的检查点重放;传入一个值则会先把它作为更新追加到该检查点的状态,然后再恢复执行。这就是你重现一次失败的智能体运行而无需重跑整个对话的方法。

### 步骤 5:为生产环境更换 checkpointer

```python
from langgraph.checkpoint.postgres import PostgresSaver

with PostgresSaver.from_conn_string("postgresql://...") as checkpointer:
    checkpointer.setup()
    app = graph.compile(checkpointer=checkpointer)
```

SQLite、Redis 和 Postgres 都有官方实现。`MemorySaver` 适用于测试。任何需要跨重启持久化的东西都需要真正的存储。

## 这项技能

> 你要把智能体构建为图,而不是 `while True` 循环。

在使用 LangGraph 之前,先做 60 秒的设计:

1. **给节点命名。** 每个离散的决策或有副作用的动作都是一个节点。"智能体思考""工具运行""审核者批准""响应流式输出"。如果你列不出来,说明这个任务还不具备智能体形态。
2. **声明状态。** 用最小的 TypedDict,并为每个列表字段配一个 reducer。不要把所有东西都塞进 `messages`;把任务特定的字段(一个工作用的 `plan`、一个 `budget` 计数器、一个 `retrieved_docs` 列表)提升到顶层。
3. **画出边。** 默认用静态边,除非下一步取决于模型输出。每条条件边都需要一个具有命名分支的路由函数。
4. **一开始就选好 checkpointer。** 测试用 `MemorySaver`,其他情况用 Postgres/Redis/SQLite。没有它就不要上线 — 没有 checkpointer 就无法恢复、无法中断、无法时间回溯。
5. **在工具运行之前而不是之后设置中断。** 审批放在进入有副作用节点的边上,这样你可以在造成危害前取消;校验放在模型输出的边上,这样你可以低成本地拒绝错误的调用。
6. **默认开启流式输出。** UI 用 `mode="updates"`,模型节点内的 token 级流式传输用 `mode="messages"`,评估期间的完整快照用 `mode="values"`。

拒绝上线没有 checkpointer 的 LangGraph 智能体。拒绝上线在副作用*之后*才中断的智能体。拒绝上线没有用 `add_messages` 作为 reducer 的 `messages` 字段。

## 练习

1. **简单。** 用一个计算器工具和一个网页搜索工具实现上面的四节点 ReAct 图。验证 `list(app.get_state_history(config))` 在两轮对话中至少返回四个检查点。
2. **中等。** 添加一个 `planner` 节点,它在 `agent` 之前运行,并把一个结构化的 `plan: list[str]` 写入状态。让 `agent` 把计划步骤标记为完成。如果 `plan` 在检查点恢复后丢失(reducer 用错了),则测试失败。
3. **困难。** 构建一个 supervisor 图,使用 `Send` 在三个子图(`researcher`、`writer`、`reviewer`)之间路由。每个子图有自己的状态和 checkpointer。在外层图上添加一个 `interrupt_before=["writer"]`,让人可以审批研究简报。确认从先前检查点进行时间回溯时只重跑分叉的分支。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| StateGraph | "LangGraph 的图" | 你在 compile 之前向其中添加节点和边的构建器对象。 |
| Reducer | "字段如何合并" | 当节点为该字段返回更新时应用的函数 `(old, new) -> merged`;默认是覆盖,`add_messages` 是追加。 |
| Thread | "一个会话 ID" | 一个 `thread_id` 字符串,为一个会话的所有检查点划定作用域。 |
| Checkpoint | "一个暂停的状态" | 节点转换后完整图状态的持久化快照,以 `(thread_id, checkpoint_id)` 为键。 |
| Interrupt | "暂停等待人类" | `interrupt_before` / `interrupt_after` 在节点边界停止执行;用 `Command(resume=...)` 恢复。 |
| Time-travel | "从先前步骤分叉" | `graph.invoke(None, config_with_old_checkpoint_id)` 从该检查点向前重放。 |
| Send | "并行子图派发" | 节点可以返回的一个构造器,用于生成目标节点的 N 个并行执行。 |
| Subgraph | "作为节点的编译图" | 用作另一个图中节点的编译后的 StateGraph;保留自己的状态作用域。 |

## 延伸阅读

- [LangGraph 文档](https://langchain-ai.github.io/langgraph/) — StateGraph、reducer、checkpointer 和中断的权威参考。
- [LangGraph 概念:状态、reducer、checkpointer](https://langchain-ai.github.io/langgraph/concepts/low_level/) — 本课所用的心智模型,直接来自官方来源。
- [LangGraph 持久化与检查点](https://langchain-ai.github.io/langgraph/concepts/persistence/) — 关于 Postgres/SQLite/Redis 存储、检查点命名空间和 thread ID 的细节。
- [LangGraph 人机协同](https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/) — `interrupt_before`、`interrupt_after`、`Command(resume=...)` 以及编辑状态的模式。
- [Yao 等,"ReAct: Synergizing Reasoning and Acting in Language Models"(ICLR 2023)](https://arxiv.org/abs/2210.03629) — 每个 LangGraph 智能体都在实现的模式;阅读它以理解推理轨迹的设计依据。
- [Anthropic — Building effective agents(2024 年 12 月)](https://www.anthropic.com/research/building-effective-agents) — 应该在何时偏好哪种图形态(chain、router、orchestrator-workers、evaluator-optimizer)。
- Phase 11 · 09(Function Calling)— 每个 LangGraph 智能体节点都复用的工具调用原语。
- Phase 11 · 14(Model Context Protocol)— 通过 MCP 适配器接入 LangGraph `ToolNode` 的外部工具发现机制。
- Phase 11 · 17(Agent framework tradeoffs)— 何时在 LangGraph 与 CrewAI、AutoGen 或 Agno 之间做出选择。