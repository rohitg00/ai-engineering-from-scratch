# LangGraph — agent 的状态机

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 手写一个 ReAct 循环就是一个 `while True`。用 LangGraph 写的 ReAct 循环则是一张图：你可以给它打 checkpoint、把它中断、让它分叉、甚至时间旅行。agent 本身没变，变的是它外面那层 harness（运行框架）。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 14 (Model Context Protocol)
**Time:** ~75 minutes

## 问题（Problem）

你上线了一个 function-calling 的 agent。前三轮跑得好好的，第四轮出事了：模型调了一个返回 500 的 tool；用户做到一半改主意了；或者 agent 自己决定不经人工签字就给一个订单退款。那个 `while True:` 循环没有任何 hook——你停不了它、回退不了它，也没法分叉去试「要是模型刚才挑了另一个 tool 会怎样？」。一旦把这种东西推出 demo 范围，agent 就成了一个非黑即白的黑盒：要么它跑通了，要么它没跑通。

下一步其实是显而易见的，只要你看出来。这个 agent 本质上已经是一个状态机——system prompt 加 message 历史加待执行的 tool calls 加下一步要做的事。把这个状态机显式地画出来：node 表示「模型在思考」「一个 tool 在执行」「人工在审批」，edge 表示这些 node 之间的条件跳转。一旦图被显式化，整个 harness 就白送你四样东西：checkpointing（在每一步之间存档）、interrupt（暂停等人工）、streaming（流式吐 token 和中间事件）、以及 time-travel（回滚到之前的状态去试不同分支）。

LangGraph 就是把这套抽象做成库的产物。它不是 LangChain 那种意义上的 agent 框架（「给你一个 AgentExecutor，自己玩去吧」）。它是一个图运行时，带一等公民级的 state、一等公民级的持久化、一等公民级的 interrupt。agent loop 是你画出来的，不是手写出来的。

## 概念（Concept）

![LangGraph StateGraph: nodes, edges, and the checkpointer](../assets/langgraph-stategraph.svg)

一个 `StateGraph` 由三样东西组成。

1. **State（状态）。** 一个有类型的 dict（TypedDict 或 Pydantic 模型），它会沿着图流动。每个 node 都拿到完整 state、并返回一个部分更新；LangGraph 会按字段维度用一个 *reducer* 把更新合并进去——对应该追加的列表用 `operator.add`，默认是覆盖。
2. **Nodes（节点）。** Python 函数，签名是 `state -> partial_state`。每个 node 是一个离散的步骤：「调用模型」「跑 tools」「做总结」。
3. **Edges（边）。** node 之间的跳转。静态边只通向一个地方。条件边接受一个路由函数 `state -> next_node_name`，让图能根据模型输出分叉。

然后你 compile 这张图。compile 会把拓扑绑死、挂上一个 checkpointer（可选，但生产环境必备），返回一个可运行的对象。你用一个初始 state 加一个 `thread_id` 来 invoke 它。每一步执行都会落一个以 `(thread_id, checkpoint_id)` 为 key 的 checkpoint。

### 四大超能力

**Checkpointing（检查点）。** 每次 node 跳转都会把新 state 写进一个存储（测试用 in-memory，生产用 Postgres/Redis/SQLite）。要恢复就用同样的 `thread_id` 再调一次图，它会从暂停的地方接着跑。

**Interrupts（中断）。** 给某个 node 标上 `interrupt_before=["human_review"]`，执行就会在那个 node 跑之前停下来。state 已经持久化了。你的 API 给用户回一句「等待审批」。之后用同一个 `thread_id` 加 `Command(resume=...)` 再发一次请求就能恢复执行。

**Streaming（流式）。** `graph.stream(state, mode="updates")` 在 state 发生变化时实时吐出增量。`mode="messages"` 会在模型 node 内部把 LLM 的 token 流出来。`mode="values"` 吐完整快照。你在 UI 里要展示哪种自己挑。

**Time-travel（时间旅行）。** `graph.get_state_history(thread_id)` 返回完整的 checkpoint 日志。把任意一个之前的 `checkpoint_id` 传给 `graph.invoke`，你就从那个点 fork 出去了。这对调试特别好用（「要是模型刚才挑了 tool B 会怎样？」），也很适合用来重放生产 trace 做回归测试。

### Reducer 才是关键

每个 state 字段都有一个 reducer。大多数默认值就够用了——新值覆盖旧值。但 message 列表得用 `operator.add`，让新消息追加而不是替换。并行的边会通过 reducer 合并各自的更新。如果两个 node 都要更新 `messages`，而你忘了加 `Annotated[list, add_messages]`，第二个会悄悄盖掉第一个，你那一轮丢一半。reducer 是这个库里唯一稍微细的地方；把它搞对，剩下的就能拼起来了。

### 用四个 node 拼出 ReAct 图

一个生产级 ReAct agent 就是四个 node 加两条边：

1. `agent` —— 拿当前 message 历史去调 LLM。返回 assistant message（里面可能带 tool_calls）。
2. `tools` —— 把上一条 assistant message 里的所有 tool_calls 执行一遍，把 tool 结果作为 tool message 追加进去。
3. 一条从 `agent` 出发的条件边：如果上一条 message 有 tool_calls 就跳到 `tools`，否则跳到 `END`。
4. 一条从 `tools` 回到 `agent` 的静态边。

就这些。你拿到了完整的 ReAct loop（Thought → Action → Observation → Thought → …），还附送 checkpoint、interrupt、streaming，大概 40 行代码。

### StateGraph vs Send（fanout）

`Send(node_name, state)` 让一个 node 派发并行的子图。例子：agent 决定一次性查三个 retriever。每个 `Send` 都会启动目标 node 的一次并行执行；它们的输出通过 state reducer 合并起来。LangGraph 就是这样用不靠线程原语的方式表达 orchestrator-workers 模式。

### 子图（Subgraph）

一张已经 compile 的图可以作为另一张图里的 node。外层图看到的就是单个 node；内层图有自己的 state 和自己的 checkpoint。supervisor-worker agent 就是这么搭出来的：supervisor 图把用户意图路由到对应领域的 worker 子图。

## 动手实现（Build It）

### Step 1: state 和 nodes

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

`add_messages` 就是那个让 message 列表追加而不是覆盖的 reducer。忘了它是 LangGraph 最常见的 bug。

### Step 2: 用 thread 跑起来

```python
config = {"configurable": {"thread_id": "user-42"}}
for event in app.stream(
    {"messages": [HumanMessage("find the Anthropic headquarters address")]},
    config,
    stream_mode="updates",
):
    print(event)
```

每条 update 都是一个 dict `{node_name: state_delta}`。你的前端可以把这些流给 UI，让用户看到「agent 在思考……正在调 search_web……拿到结果……正在回答」。

### Step 3: 加一个 human-in-the-loop（人工确认）interrupt

给某个 node 打上标记，让执行在它跑之前停下来。

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

state、checkpoint、thread 在 interrupt 前后都是持久化的。除了执行那一瞬间，没有任何东西只活在内存里。

### Step 4: 用 time-travel 调试

```python
history = list(app.get_state_history(config))
for snapshot in history:
    print(snapshot.values["messages"][-1].content[:80], snapshot.config)

# Fork from a prior checkpoint
target = history[3].config  # three steps back
for event in app.stream(None, target, stream_mode="values"):
    pass  # replay from that point forward
```

把 `None` 作为输入会从给定的 checkpoint 回放；传一个值进去则会先把它作为更新追加到那个 checkpoint 的 state 上、再恢复。这就是你在不重跑整段对话的前提下复现一次出错 agent run 的方式。

### Step 5: 上生产时换掉 checkpointer

```python
from langgraph.checkpoint.postgres import PostgresSaver

with PostgresSaver.from_conn_string("postgresql://...") as checkpointer:
    checkpointer.setup()
    app = graph.compile(checkpointer=checkpointer)
```

SQLite、Redis、Postgres 都有现成实现。`MemorySaver` 是给测试用的。任何需要在重启之间保留状态的场景都得用真正的存储。

## 这项功夫（The Skill）

> 你把 agent 当作图来构建，而不是当作 `while True` 来构建。

在你伸手去抓 LangGraph 之前，先做 60 秒的设计：

1. **把 node 一个个命名出来。** 每一个离散决策或者会产生副作用的动作都是一个 node。「agent 思考」「tool 执行」「reviewer（验证器）审批」「response 流式输出」。如果你列不出来，那这个任务还不是 agent 形状。
2. **声明 state。** 用最精简的 TypedDict，每个列表字段都配一个 reducer。不要把所有东西都塞进 `messages`；把跟任务相关的字段（一个 working `plan`、一个 `budget` 计数器、一个 `retrieved_docs` 列表）提到顶层。
3. **把边画出来。** 默认静态，除非下一步取决于模型输出。每条条件边都要配一个带命名分支的路由函数。
4. **一开始就选好 checkpointer。** 测试用 `MemorySaver`，其他场景用 Postgres/Redis/SQLite。没 checkpointer 不要上线——没有 checkpointer 就没有 resume，没有 interrupt，没有 time-travel。
5. **interrupt 要放在 tool 跑之前，不是之后。** 审批挂在通往会产生副作用的 node 的入边上，这样你能在闯祸前取消；校验挂在模型 node 的出边上，这样你能廉价地拒掉坏的调用。
6. **默认就开 streaming。** UI 用 `mode="updates"`；模型 node 内部要 token 级流式就用 `mode="messages"`；evaluation（评估）期间要看完整快照就用 `mode="values"`。

拒绝上线一个没有 checkpointer 的 LangGraph agent。拒绝上线一个在副作用 *之后* 才 interrupt 的 agent。拒绝上线一个 `messages` 字段没挂 `add_messages` reducer 的 agent。

## 练习（Exercises）

1. **Easy。** 用一个 calculator tool 加一个 web-search tool 实现上面那个四 node 的 ReAct 图。验证 `list(app.get_state_history(config))` 在两轮对话之后至少返回四个 checkpoint。
2. **Medium。** 在 `agent` 之前加一个 `planner` node，往 state 里写一个结构化的 `plan: list[str]`。让 `agent` 把已完成的 plan 步骤标记为 done。如果 `plan` 在 checkpoint 恢复时丢了（reducer 配错），让测试失败。
3. **Hard。** 用 `Send` 搭一个 supervisor 图，在三个子图（`researcher`、`writer`、`reviewer`）之间路由。每个子图都有自己的 state 和 checkpointer。给外层图加 `interrupt_before=["writer"]`，让人工可以审批研究简报。确认从某个之前的 checkpoint 做 time-travel 时，只重新跑 fork 出去的那条分支。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| StateGraph | 「LangGraph 的图」 | 你在 compile 之前往里加 node 和 edge 的那个 builder 对象。 |
| Reducer | 「字段怎么合并」 | 一个 `(old, new) -> merged` 的函数，在某个 node 返回该字段的更新时生效；默认是覆盖，`add_messages` 是追加。 |
| Thread | 「一个对话 ID」 | 一个 `thread_id` 字符串，把一个 session 的所有 checkpoint 圈在一起。 |
| Checkpoint | 「一份暂停的 state」 | 一次 node 跳转之后整张图 state 的持久化快照，key 是 `(thread_id, checkpoint_id)`。 |
| Interrupt | 「为人工暂停一下」 | `interrupt_before` / `interrupt_after` 在 node 边界停下执行；用 `Command(resume=...)` 恢复。 |
| Time-travel | 「从之前某一步分叉」 | `graph.invoke(None, config_with_old_checkpoint_id)` 从那个 checkpoint 往前回放。 |
| Send | 「并行子图派发」 | 一个构造器，node 可以返回它来启动目标 node 的 N 次并行执行。 |
| Subgraph | 「把 compile 好的图当 node」 | 一张已 compile 的 StateGraph 被当作另一张图里的 node 用；保留自己的 state 作用域。 |

## 延伸阅读（Further Reading）

- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) —— StateGraph、reducer、checkpointer、interrupt 的权威参考。
- [LangGraph concepts: state, reducers, checkpointers](https://langchain-ai.github.io/langgraph/concepts/low_level/) —— 本课用的心智模型，直接来自源头。
- [LangGraph Persistence and Checkpoints](https://langchain-ai.github.io/langgraph/concepts/persistence/) —— Postgres/SQLite/Redis 存储、checkpoint namespace、thread ID 的细节。
- [LangGraph Human-in-the-loop](https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/) —— `interrupt_before`、`interrupt_after`、`Command(resume=...)` 以及编辑 state 的模式。
- [Yao et al., "ReAct: Synergizing Reasoning and Acting in Language Models" (ICLR 2023)](https://arxiv.org/abs/2210.03629) —— 每个 LangGraph agent 实现的那个 pattern；想搞清楚 reasoning trace 的动机就读它。
- [Anthropic — Building effective agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) —— 哪种图形（chain、router、orchestrator-workers、evaluator-optimizer）该优先选、什么时候选。
- Phase 11 · 09 (Function Calling) —— 每个 LangGraph agent node 都在复用的 tool-call 原语。
- Phase 11 · 14 (Model Context Protocol) —— 通过 MCP adapter 接入 LangGraph `ToolNode` 的外部 tool 发现机制。
- Phase 11 · 17 (Agent framework tradeoffs) —— 什么时候选 LangGraph 而不是 CrewAI、AutoGen 或 Agno。
