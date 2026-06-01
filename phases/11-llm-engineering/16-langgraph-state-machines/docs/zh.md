# 16 · LangGraph——面向智能体的状态机

> 手写的 ReAct 循环就是一个 `while True`。用 LangGraph 写出来的 ReAct 循环则是一张图——你可以对它做检查点、可以中断、可以分支、还可以做时间旅行。智能体本身没有变，变的是包裹它的运行框架（harness）。

**类型：** 实践（Build）
**语言：** Python
**前置：** 阶段 11 · 09（函数调用）、阶段 11 · 14（模型上下文协议）
**时长：** 约 75 分钟

## 问题所在

你上线了一个函数调用智能体。它运行了三轮都好好的，然后出问题了：模型调用了一个返回 500 的工具，或者用户在任务中途改了主意，又或者智能体在没有人类签字确认的情况下擅自给一笔订单退了款。`while True:` 循环没有任何钩子（hook）。你没法暂停它，没法回退它，也没法分叉去探索「如果模型当时选了另一个工具会怎样」。一旦你把它从演示阶段推向生产，智能体就变成了一个黑盒——要么成功，要么失败，没有别的。

一旦你看清这一点，下一步就显而易见了。智能体本身已经是一个状态机了——系统提示词，加上消息历史，加上待执行的工具调用，加上下一个动作。我们要做的，就是把这个状态机显式地画出来：用「节点（node）」表示「模型在思考」「某个工具在运行」「人类在审批」，用「边（edge）」表示它们之间的条件转移。一旦这张图显式化了，运行框架就能免费获得四样东西：检查点（checkpointing，在每一步之间保存状态）、中断（interrupt，为人类介入而暂停）、流式输出（streaming，流式传输 token 与中间事件），以及时间旅行（time-travel，回退到此前的某个状态并尝试不同的分支）。

LangGraph 就是提供这套抽象的库。它不是 LangChain 意义上的那种智能体框架（「这是一个 AgentExecutor，祝你好运」）。它是一个图运行时（graph runtime），具备一等公民级别的状态、一等公民级别的持久化、以及一等公民级别的中断。智能体循环是你画出来的，而不是你手写出来的。

## 核心概念

〔图：LangGraph StateGraph——节点、边与检查点存储器〕

一个 `StateGraph` 由三样东西构成。

1. **状态（State）。** 一个带类型的字典（TypedDict 或 Pydantic 模型），它在整张图中流动。每个节点都会收到完整的状态，并返回一份「部分更新（partial update）」，LangGraph 会按字段使用一个*归约器（reducer）*来合并这份更新——对应该累加的列表用 `operator.add`，默认则是覆盖。
2. **节点（Nodes）。** 形如 `state -> partial_state` 的 Python 函数。每个节点都是一个离散步骤：「调用模型」「运行工具」「做摘要」。
3. **边（Edges）。** 节点之间的转移。静态边只通向一个地方。条件边（conditional edge）则接收一个路由函数 `state -> next_node_name`，于是图就能根据模型输出进行分支。

你要「编译（compile）」这张图。编译会绑定拓扑结构、挂上一个检查点存储器（checkpointer，可选，但在生产中不可或缺），并返回一个可运行对象（runnable）。你用一个初始状态和一个 `thread_id` 来调用它。执行的每一步都会持久化一个以 `(thread_id, checkpoint_id)` 为键的检查点。

### 四大超能力

**检查点。** 每一次节点转移都会把新状态写入一个存储（测试时用内存，生产时用 Postgres/Redis/SQLite）。要恢复执行，只需用相同的 `thread_id` 再次调用这张图。图会从它暂停的地方接着往下跑。

**中断。** 用 `interrupt_before=["human_review"]` 标记一个节点，执行就会在该节点运行之前停下来。状态被持久化下来。你的 API 向用户回复「等待审批中」。之后针对同一个 `thread_id`、携带 `Command(resume=...)` 的请求会恢复执行。

**流式输出。** `graph.stream(state, mode="updates")` 会在状态变化发生时逐个产出状态增量（delta）。`mode="messages"` 会流式输出模型节点内部产生的 LLM token。`mode="values"` 则产出完整的状态快照。你来决定在自己的 UI 里呈现哪一种。

**时间旅行。** `graph.get_state_history(thread_id)` 返回完整的检查点日志。把任意一个此前的 `checkpoint_id` 传给 `graph.invoke`，你就从那个点分叉出去。这对调试（「如果模型当时选的是工具 B 会怎样？」）以及回放生产轨迹的回归测试都极为有用。

### 归约器才是关键

每一个状态字段都有一个归约器。大多数默认行为都够用了——新值覆盖旧值。但消息列表需要用 `operator.add`，这样新消息才会追加（append）而不是替换。并行的边通过归约器来合并各自的更新。如果有两个节点都更新 `messages`，而你忘了写 `Annotated[list, add_messages]`，那么第二个节点的更新会悄无声息地胜出，你就丢掉了这一轮里一半的内容。归约器是这个库里唯一微妙的地方；把它弄对，其余部分自然能组合起来。

### 四个节点构成的 ReAct 图

一个生产级的 ReAct 智能体就是四个节点加两条边：

1. `agent`——用当前的消息历史去调用 LLM。返回助手消息（其中可能包含 tool_calls）。
2. `tools`——执行最后一条助手消息里的所有 tool_calls，并把工具结果作为工具消息追加进去。
3. 一条从 `agent` 出发的条件边：如果最后一条消息含有 tool_calls 就路由到 `tools`，否则路由到 `END`。
4. 一条从 `tools` 回到 `agent` 的静态边。

就这些。你就得到了完整的 ReAct 循环（Thought → Action → Observation → Thought → ……），并且自带检查点、中断和流式输出，全部只需大约 40 行代码。

### StateGraph 对比 Send（扇出）

`Send(node_name, state)` 让一个节点可以分派出并行的子图。举例：智能体决定一次性查询三个检索器。每个 `Send` 都会派生出目标节点的一次并行执行；它们的输出通过状态归约器合并。这就是 LangGraph 在不动用线程原语的情况下表达「编排者-工作者（orchestrator-workers）」模式的方式。

### 子图

一张已编译的图可以作为另一张图里的一个节点。外层图只看到一个单独的节点；内层图则拥有自己的状态和自己的检查点。团队就是这样构建「监督者-工作者（supervisor-worker）」智能体的：监督者图把用户意图路由到按领域划分的工作者子图。

## 动手实现

### 第 1 步：状态与节点

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

`add_messages` 就是那个让消息列表累加而非覆盖的归约器。忘了它，是最常见的 LangGraph bug。

### 第 2 步：带线程运行

```python
config = {"configurable": {"thread_id": "user-42"}}
for event in app.stream(
    {"messages": [HumanMessage("find the Anthropic headquarters address")]},
    config,
    stream_mode="updates",
):
    print(event)
```

每一次更新都是一个形如 `{node_name: state_delta}` 的字典。你的前端可以把这些增量流式推送到 UI，让用户看到「智能体正在思考……正在调用 search_web……拿到结果……正在作答。」

### 第 3 步：加入「人在回路（human-in-the-loop）」中断

标记一个节点，让执行在它运行之前暂停。

```python
app = graph.compile(
    checkpointer=MemorySaver(),
    interrupt_before=["tools"],  # 在每次工具调用之前暂停
)

state = app.invoke({"messages": [HumanMessage("delete the production database")]}, config)
# state["__interrupt__"] 已被设置。检视拟执行的工具调用。
# 如果批准：
from langgraph.types import Command
app.invoke(Command(resume=True), config)
# 如果拒绝：写入一条拒绝消息并恢复执行
app.update_state(config, {"messages": [AIMessage("Blocked by human reviewer.")]})
```

状态、检查点和线程在整个中断期间都会持久化。除了执行过程中，没有任何东西只存在于内存里。

### 第 4 步：用时间旅行做调试

```python
history = list(app.get_state_history(config))
for snapshot in history:
    print(snapshot.values["messages"][-1].content[:80], snapshot.config)

# 从此前的某个检查点分叉
target = history[3].config  # 回退三步
for event in app.stream(None, target, stream_mode="values"):
    pass  # 从那个点开始向前回放
```

把 `None` 作为输入会从给定的检查点开始回放；传入一个值则会在恢复执行之前，把它作为一份更新追加到该检查点的状态上。这就是你在不重跑整段对话的情况下，复现一次糟糕智能体运行的方法。

### 第 5 步：为生产环境替换检查点存储器

```python
from langgraph.checkpoint.postgres import PostgresSaver

with PostgresSaver.from_conn_string("postgresql://...") as checkpointer:
    checkpointer.setup()
    app = graph.compile(checkpointer=checkpointer)
```

SQLite、Redis 和 Postgres 都是开箱即用的。`MemorySaver` 只用于测试。任何需要跨重启持久化的场景，都需要一个真正的存储。

## 这项技能

> 你把智能体当作图来构建，而不是当作 `while True` 循环来构建。

在你伸手去用 LangGraph 之前，先做一个 60 秒的设计：

1. **给节点命名。** 每一个离散的决策或带副作用的动作都是一个节点。「智能体思考」「工具运行」「审核者批准」「响应流式输出」。如果你连它们都列不出来，那这个任务还没有成形为「智能体形态」。
2. **声明状态。** 用一个最小的 TypedDict，并为每个列表字段配上归约器。不要把所有东西都塞进 `messages`；把任务特定的字段（一个工作中的 `plan`、一个 `budget` 计数器、一个 `retrieved_docs` 列表）提升到顶层。
3. **画出边。** 默认用静态边，除非下一步取决于模型输出。每条条件边都需要一个带命名分支的路由函数。
4. **一开始就选好检查点存储器。** 测试用 `MemorySaver`，其余一切用 Postgres/Redis/SQLite。不要在没有检查点存储器的情况下上线——没有检查点存储器就意味着没有恢复、没有中断、没有时间旅行。
5. **在工具运行之前、而非之后决定是否中断。** 审批要放在通向带副作用节点的那条边上，这样你才能在造成伤害之前取消；校验要放在从模型出来的那条边上，这样你才能廉价地拒绝掉糟糕的调用。
6. **默认开启流式输出。** UI 用 `mode="updates"`，模型节点内部的 token 级流式用 `mode="messages"`，评测时的完整快照用 `mode="values"`。

拒绝上线没有检查点存储器的 LangGraph 智能体。拒绝上线那种在副作用*之后*才中断的智能体。拒绝上线一个没有把 `add_messages` 作为归约器的 `messages` 字段。

## 练习

1. **简单。** 实现上面那个四节点的 ReAct 图，配一个计算器工具和一个网络搜索工具。验证对于一段两轮的对话，`list(app.get_state_history(config))` 至少返回四个检查点。
2. **中等。** 加一个在 `agent` 之前运行的 `planner` 节点，让它把一个结构化的 `plan: list[str]` 写入状态。让 `agent` 把计划步骤标记为已完成。如果 `plan` 在一次检查点恢复中丢失（归约器用错了），就让测试失败。
3. **困难。** 构建一个监督者图，用 `Send` 在三个子图（`researcher`、`writer`、`reviewer`）之间路由。每个子图都有自己的状态和检查点存储器。在外层图上加一个 `interrupt_before=["writer"]`，好让人类能够批准研究简报。确认从此前某个检查点做时间旅行时，只会重跑被分叉出来的那条分支。

## 关键术语

| 术语 | 人们怎么说 | 它实际的含义 |
|------|-----------------|-----------------------|
| StateGraph | 「那张 LangGraph 图」 | 在编译之前，你往里添加节点和边的那个构建器对象。 |
| Reducer（归约器） | 「字段是怎么合并的」 | 当某个节点为某字段返回更新时所应用的函数 `(old, new) -> merged`；默认是覆盖，`add_messages` 则是追加。 |
| Thread（线程） | 「一个会话 ID」 | 一个 `thread_id` 字符串，它把一次会话的所有检查点圈定在一起。 |
| Checkpoint（检查点） | 「一个暂停的状态」 | 节点转移之后对完整图状态的一份持久化快照，以 `(thread_id, checkpoint_id)` 为键。 |
| Interrupt（中断） | 「为人类暂停」 | `interrupt_before` / `interrupt_after` 在节点边界处停止执行；用 `Command(resume=...)` 恢复。 |
| Time-travel（时间旅行） | 「从此前的某一步分叉」 | `graph.invoke(None, config_with_old_checkpoint_id)` 从那个检查点开始向前回放。 |
| Send | 「并行子图分派」 | 一个构造器，节点可以返回它来派生出目标节点的 N 次并行执行。 |
| Subgraph（子图） | 「把一张已编译的图当作节点」 | 一张被用作另一张图中节点的已编译 StateGraph；它保留自己独立的状态作用域。 |

## 延伸阅读

- [LangGraph 文档](https://langchain-ai.github.io/langgraph/) —— StateGraph、归约器、检查点存储器与中断的权威参考。
- [LangGraph 概念：状态、归约器、检查点存储器](https://langchain-ai.github.io/langgraph/concepts/low_level/) —— 本课所用的心智模型，直接来自官方源头。
- [LangGraph 持久化与检查点](https://langchain-ai.github.io/langgraph/concepts/persistence/) —— 关于 Postgres/SQLite/Redis 存储、检查点命名空间与线程 ID 的细节。
- [LangGraph 人在回路](https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/) —— `interrupt_before`、`interrupt_after`、`Command(resume=...)` 以及编辑状态的模式。
- [Yao 等人，《ReAct: Synergizing Reasoning and Acting in Language Models》（ICLR 2023）](https://arxiv.org/abs/2210.03629) —— 每个 LangGraph 智能体都在实现的模式；读它来理解推理轨迹背后的原理。
- [Anthropic —— 构建高效的智能体（2024 年 12 月）](https://www.anthropic.com/research/building-effective-agents) —— 该优先选用哪种图形态（链、路由器、编排者-工作者、评估者-优化者）以及何时选用。
- 阶段 11 · 09（函数调用） —— 每个 LangGraph 智能体节点都会复用的工具调用原语。
- 阶段 11 · 14（模型上下文协议） —— 外部工具发现机制，可通过 MCP 适配器接入 LangGraph 的 `ToolNode`。
- 阶段 11 · 17（智能体框架取舍） —— 何时该选 LangGraph 而非 CrewAI、AutoGen 或 Agno。
