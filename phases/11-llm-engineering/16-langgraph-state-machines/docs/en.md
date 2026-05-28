# LangGraph — Agents のための State Machines

> 手書きの ReAct loop は `while True` です。LangGraph で書いた ReAct loop は、checkpoint でき、interrupt でき、branch でき、time-travel できる graph です。agent 自体は変わっていません。変わったのは、それを包む harness です。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 11 · 09 (Function Calling), Phase 11 · 14 (Model Context Protocol)
**所要時間:** 約75分

## 問題

function-calling agent を ship したとします。3 turns は動きます。その後、何かが壊れます。model が 500 を返す tool を試す、user が task の途中で気を変える、または agent が human sign-off なしに order を refund しようとする。`while True:` loop には hook がありません。pause できず、rewind できず、「もし model が別の tool を選んでいたら」を branch して試すこともできません。demo を超えて ship した瞬間、agent は「動いたか、動かなかったか」しかわからない black box になります。

見方を変えると次の一手は明らかです。agent はすでに state machine です。system prompt、message history、pending tool calls、next action があります。その state machine を明示します。「model が考える」「tool が走る」「human が approve する」という node と、それらをつなぐ conditional transition の edge を作ります。graph が明示されると、harness は4つのものを手に入れます。checkpointing (step 間で state を保存)、interrupts (human のために pause)、streaming (token と intermediate event を stream)、time-travel (過去 state に巻き戻して別 branch を試す) です。

LangGraph はこの abstraction を提供する library です。LangChain 的な意味での agent framework ("AgentExecutor です、あとは頑張って") ではありません。first-class state、first-class persistence、first-class interrupt を持つ graph runtime です。agent loop は手書きするものではなく、draw するものになります。

## 概念

![LangGraph StateGraph: nodes, edges, and the checkpointer](../assets/langgraph-stategraph.svg)

`StateGraph` には3つの要素があります。

1. **State。** graph を流れる typed dict (TypedDict または Pydantic model)。各 node は full state を受け取り、partial update を返します。LangGraph は field ごとの *reducer* で merge します。accumulate したい list には `operator.add`、default は overwrite です。
2. **Nodes。** Python function `state -> partial_state`。それぞれが discrete step です。"call the model"、"run tools"、"summarize" など。
3. **Edges。** node 間の transition。static edge は1箇所へ進みます。conditional edge は router function `state -> next_node_name` を取り、model output に応じて branch します。

graph を compile します。compile は topology を固定し、checkpointer (optional だが production では必須) を attach し、runnable を返します。initial state と `thread_id` で invoke します。execution の各 step は `(thread_id, checkpoint_id)` を key に checkpoint を persist します。

### 4つのsuperpower

**Checkpointing。** node transition ごとに新しい state を store に書き込みます (test では in-memory、prod では Postgres/Redis/SQLite)。同じ `thread_id` で graph を再度 call すると resume します。graph は pause した箇所から再開します。

**Interrupts。** node に `interrupt_before=["human_review"]` を指定すると、その node が run する前に execution が止まります。state は persist されています。API は user に "awaiting approval" と返せます。後の request で同じ `thread_id` に `Command(resume=...)` を渡すと再開します。

**Streaming。** `graph.stream(state, mode="updates")` は発生した state delta を yield します。`mode="messages"` は model node 内の LLM token を stream します。`mode="values"` は full snapshot を yield します。UI に出すものを選べます。

**Time-travel。** `graph.get_state_history(thread_id)` は checkpoint log 全体を返します。過去の `checkpoint_id` を `graph.invoke` に渡すと、その点から fork します。debugging ("model が tool B を選んでいたら?") や production trace replay の regression test に向いています。

### Reducerが要点

すべての state field には reducer があります。多くの default は問題ありません。新しい value が古い value を上書きします。しかし message list には `operator.add` が必要です。新しい message を replace ではなく append するためです。parallel edge は reducer を通して update を merge します。2つの node が両方 `messages` を update し、`Annotated[list, add_messages]` を忘れていると、後勝ちになって半分の turn を失います。reducer は library で唯一 subtle な部分です。ここを正しくすると、残りは composable になります。

### 4 nodesのReAct graph

production ReAct agent は4つの node と2つの edge です。

1. `agent` — current message history で LLM を call します。assistant message を返します (tool_calls を含むことがあります)。
2. `tools` — 最後の assistant message にある tool_calls を実行し、tool result を tool message として append します。
3. `agent` からの conditional edge。最後の message に tool_calls があれば `tools` へ、なければ `END` へ route します。
4. `tools` から `agent` への static edge。

これだけです。checkpointing、interrupts、streaming 付きの full ReAct loop (Thought → Action → Observation → Thought → …) が約40行で手に入ります。

### StateGraph vs Send (fanout)

`Send(node_name, state)` を使うと、node から parallel subgraph を dispatch できます。例: agent が3つの retriever を同時に query すると決める。各 `Send` は target node の parallel execution を spawn し、output は state reducer を通して merge されます。LangGraph は threading primitive なしで orchestrator-workers pattern をこのように表現します。

### Subgraphs

compiled graph は別 graph の node になれます。outer graph からは single node に見えますが、inner graph は独自の state と checkpoint を持ちます。supervisor-worker agents を作るとき、supervisor graph が user intent を domain-specific worker subgraph に route する形で使います。

## 実装

### Step 1: stateとnodes

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

`add_messages` は message list を overwrite ではなく accumulate させる reducer です。忘れるのが最もよくある LangGraph bug です。

### Step 2: thread付きで実行

```python
config = {"configurable": {"thread_id": "user-42"}}
for event in app.stream(
    {"messages": [HumanMessage("find the Anthropic headquarters address")]},
    config,
    stream_mode="updates",
):
    print(event)
```

各 update は `{node_name: state_delta}` の dict です。frontend に stream すれば、user は "agent is thinking… calling search_web… got result… answering." という progress を見られます。

### Step 3: human-in-the-loop interruptを追加

node に mark すると、実行前に pause します。

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

state、checkpoint、thread は interrupt をまたいで persist します。execution 中以外、memory にだけ存在するものはありません。

### Step 4: debugging用time-travel

```python
history = list(app.get_state_history(config))
for snapshot in history:
    print(snapshot.values["messages"][-1].content[:80], snapshot.config)

# Fork from a prior checkpoint
target = history[3].config  # three steps back
for event in app.stream(None, target, stream_mode="values"):
    pass  # replay from that point forward
```

input に `None` を渡すと、指定 checkpoint から replay します。value を渡すと、その checkpoint の state に update として append してから resume します。bad agent run を conversation 全体の再実行なしで reproduce する方法です。

### Step 5: production用checkpointerへ差し替え

```python
from langgraph.checkpoint.postgres import PostgresSaver

with PostgresSaver.from_conn_string("postgresql://...") as checkpointer:
    checkpointer.setup()
    app = graph.compile(checkpointer=checkpointer)
```

SQLite、Redis、Postgres が提供されています。`MemorySaver` は test 用です。restart をまたいで persist すべきものには real store が必要です。

## Skill

> agent は `while True` loop ではなく graph として作ります。

LangGraph に手を伸ばす前に、60秒だけ design します。

1. **Name the nodes。** discrete decision や side-effecting action はすべて node です。"Agent thinks"、"tool runs"、"reviewer approves"、"response streams"。list できないなら、task はまだ agent-shaped ではありません。
2. **Declare the state。** list field すべてに reducer を持つ minimal TypedDict。message log には必ず Annotated[list, add_messages] を付けます。task-specific field (working `plan`、`budget` counter、`retrieved_docs` list) は `messages` に詰めず top level に hoist します。
3. **Draw the edges。** next step が deterministic なら static。model output に依存する場合だけ conditional edge。conditional edge には named branch を持つ router function が必要です。
4. **Choose a checkpointer up front。** test では `MemorySaver`、それ以外は Postgres/Redis/SQLite。checkpointer なしで ship してはいけません。resume、interrupt、time-travel ができません。
5. **Decide interrupts before tools run, not after。** approval は side-effecting node へ入る edge に置きます。害が出る前に cancel するためです。validation は model から出る edge に置くと、悪い call を安く reject できます。
6. **Stream by default。** UI には `mode="updates"`、model node 内の token-level streaming には `mode="messages"`、eval 中の full snapshot には `mode="values"`。

checkpointer のない LangGraph agent は ship しない。side effect の後に interrupt する agent も ship しない。`add_messages` reducer のない `messages` field も ship しない。

## 演習

1. **Easy。** calculator tool と web-search tool を持つ4-node ReAct graph を実装します。2-turn conversation で `list(app.get_state_history(config))` が少なくとも4つの checkpoint を返すことを確認します。
2. **Medium。** `agent` の前に走る `planner` node を追加し、structured `plan: list[str]` を state に書きます。`agent` は plan step を done にします。checkpoint resume 後に `plan` が失われたら test を fail させます (wrong reducer)。
3. **Hard。** `Send` を使って3つの subgraph (`researcher`, `writer`, `reviewer`) に route する supervisor graph を作ります。各 subgraph は独自 state と checkpointer を持ちます。outer graph に `interrupt_before=["writer"]` を追加し、human が research brief を approve できるようにします。過去 checkpoint から time-travel すると forked branch だけが再実行されることを確認します。

## Key Terms

| Term | 俗に言うこと | 実際の意味 |
|------|---------------|------------|
| StateGraph | "LangGraph の graph" | compile 前に nodes と edges を追加する builder object。 |
| Reducer | "field の merge 方法" | node がその field の update を返したときに適用される `(old, new) -> merged` function。default は overwrite、`add_messages` は append。 |
| Thread | "conversation ID" | 1 session のすべての checkpoint を scope する `thread_id` string。 |
| Checkpoint | "paused state" | node transition 後の full graph state の persisted snapshot。`(thread_id, checkpoint_id)` で key される。 |
| Interrupt | "human のために pause" | `interrupt_before` / `interrupt_after` が node boundary で execution を止める。`Command(resume=...)` で resume する。 |
| Time-travel | "過去 step から fork" | `graph.invoke(None, config_with_old_checkpoint_id)` がその checkpoint から先を replay する。 |
| Send | "parallel subgraph dispatch" | node が返せる constructor。target node の N parallel executions を spawn する。 |
| Subgraph | "node としての compiled graph" | 別 graph の node として使う compiled StateGraph。独自の state scope を保持する。 |

## 参考文献

- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) — StateGraph、reducers、checkpointers、interrupts の canonical reference。
- [LangGraph concepts: state, reducers, checkpointers](https://langchain-ai.github.io/langgraph/concepts/low_level/) — この lesson が使う mental model の source。
- [LangGraph Persistence and Checkpoints](https://langchain-ai.github.io/langgraph/concepts/persistence/) — Postgres/SQLite/Redis store、checkpoint namespace、thread ID の詳細。
- [LangGraph Human-in-the-loop](https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/) — `interrupt_before`、`interrupt_after`、`Command(resume=...)`、edit-state pattern。
- [Yao et al., "ReAct: Synergizing Reasoning and Acting in Language Models" (ICLR 2023)](https://arxiv.org/abs/2210.03629) — LangGraph agent が実装する pattern。reasoning trace の rationale を理解するために読む。
- [Anthropic — Building effective agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) — chain、router、orchestrator-workers、evaluator-optimizer など、どの graph shape をいつ選ぶべきか。
- Phase 11 · 09 (Function Calling) — LangGraph agent node が再利用する tool-call primitive。
- Phase 11 · 14 (Model Context Protocol) — MCP adapter 経由で LangGraph `ToolNode` に plug できる external tool discovery。
- Phase 11 · 17 (Agent framework tradeoffs) — LangGraph を CrewAI、AutoGen、Agno より選ぶべき場面。
