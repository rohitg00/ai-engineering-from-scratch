# StateGraph, state, and reducers

> A `StateGraph` node returns a partial update, and each state key merges that update with its reducer, or replaces the old value when the key has no reducer.

You write a graph in which three nodes run in the same step, and each one adds a joke to a list. One version of the graph ends with three jokes. Another version raises an error before the step ends. What decides it is the reducer of the key that the nodes write.

When you finish this section, you can declare a state schema and choose a reducer for each key. You can also predict what two writes to one key in one step do.

## The state schema

**State:** the shared data of one graph run, declared as a schema whose keys are the values that nodes read and write.

**Reducer:** a function of the old value and an update that returns the new value of one state key.

`create_agent` built its graph for you in Part 1. A `StateGraph` is the same object, and you build it by hand. The kit declares its state as a `TypedDict`. Two keys carry a reducer in `Annotated`, and three keys have none:

```listing
title: a state schema with two reducers
source: capture/s_graph.py
lang: python
---
class Fanout(TypedDict):
    topic: str
    subjects: list[str]
    jokes: Annotated[list[str], operator.add]
    log: Annotated[list[str], operator.add]
    best: str
```

A key with no reducer keeps the last value written to it. The graph API page states this default too, and it adds that a node returns only the keys it changes {{docs oss/python/langgraph/graph-api}}. LangGraph stores such a key in a `LastValue` channel, and a key with a reducer in a `BinaryOperatorAggregate` channel {{docs oss/python/langgraph/pregel}}. A schema can also be a dataclass or a Pydantic model, but `create_agent` needs a `TypedDict` {{docs oss/python/langgraph/graph-api}}.

## A node returns a partial update

A node is a function of the state. It returns a dict with only the keys it changes. The first node of the kit graph writes two of the five keys:

```listing
title: the plan node
source: capture/s_graph.py
lang: python
---
    def plan(state):
        return {"subjects": ["cats", "dogs", "owls"], "log": ["plan"]}
```

LangGraph applies each key of the update with the reducer of that key. `subjects` has no reducer, so the list replaces the empty list of the input. `log` has `operator.add`, so `["plan"]` joins the end of the old list. Every node after it adds one entry to `log` in the same way.

The run ends with six entries in `log`, one for each node run:

```listing
title: the final state of the run
source: capture/out/34-stategraph-reducers-send-command.txt
lang: json
note: The final state. The topic and subjects keys are cut.
---
  "jokes": [
    "a joke about cats",
    "a joke about dogs",
    "a joke about owls"
  ],
  "log": [
    "plan",
    "write_joke(cats)",
    "write_joke(dogs)",
    "write_joke(owls)",
    "pick -> publish",
    "publish"
  ],
  "best": "a joke about cats"
```

## Two writes to one key in one step

The three `write_joke` runs happen in one step, and each returns one joke under `jokes`. The reducer joins the three updates, so the state holds three jokes. [Section 6.2](#s-edges-send-and-command) shows how the graph starts three runs of one node.

A key with no reducer accepts one write in each step. The kit builds a graph whose two nodes both start after `__start__`, and both write `value`:

```listing
title: two nodes write one key with no reducer
source: capture/s_graph.py
lang: python
---
    class Plain(TypedDict):
        value: str

    g = StateGraph(Plain)
    g.add_node("a", lambda s: {"value": "a"})
    g.add_node("b", lambda s: {"value": "b"})
    g.add_edge(START, "a")
    g.add_edge(START, "b")
```

The run raises at the end of the step, and the error names the key:

```listing
title: the error for two writes to one key
source: capture/out/34-stategraph-reducers-send-command.txt
lang: text
---
raised langgraph.errors.InvalidUpdateError: At key 'value': Can receive only one value per step. Use an Annotated key to handle multiple values.
For troubleshooting, visit: https://docs.langchain.com/oss/python/langgraph/errors/INVALID_CONCURRENT_GRAPH_UPDATE
```

[Figure](#fig-6-1) sets the two keys side by side.

```figure
id: fig-6-1
kind: comparison
title: two writes to one key in one step
claim: Three writes to a key with operator.add join into one list, and two writes to a key with no reducer raise InvalidUpdateError at the end of the step.
caption: Read each column from the writes at the top to the state at the bottom. The left column is jokes in the joke graph, and the right column is value in the two-node graph. From capture/out/34-stategraph-reducers-send-command.txt.
```

The joined list keeps the order of the three subjects: cats, dogs, owls. The kit check records that order again on every run.

## What the error leaves in a saved thread

On a graph with a checkpointer, the error does more than fail one run. Both node bodies ran before the update raised, and both writes were saved as pending writes. Every later read of the thread applies those writes again, and raises again.

The runtime part ran the two-node graph with a checkpointer, `InMemorySaver`. Each node asked Qwen3 4B for a digit and returned it as `x`, on the x86 server guest:

```listing
title: the thread after the conflict
source: capture/lab/internals/02-channels/trace.txt
lang: text
note: The frame list and the per-checkpoint dump are cut.
---
raised InvalidUpdateError: At key 'x': Can receive only one value per step. Use an Annotated key to handle multiple values.
…
node bodies that ran before the raise: ['a', 'b']
…
get_state after the raise ALSO raises InvalidUpdateError via ['main.py:1496', 'main.py:1331', '_algo.py:319', 'last_value.py:64']
…
raw saver.get_tuple works: checkpoint step=0 pending_writes=[('26351ed0', 'x', 1), ('8f6a50fe', 'x', 2)]
…
invoke(None) resume raises again: InvalidUpdateError; node bodies re-run on resume: [] (empty means the saved writes were reapplied, not re-executed)
```

So `get_state` raises, and an admin page that reads the thread fails too. `invoke(None)` raises without running a node. A new turn on the same thread raises as well. Only `get_state_history` and the raw saver still read the thread. We reported this as langgraph issue #9712 {{issue langgraph#9712}}. [Section 2.2](#s-channels-and-colliding-writes) follows the raise through the update phase.

## Recovering the thread

**We measured** four ways out on the x86 server guest with Qwen3 4B, one run each, on the same graph:

```listing
title: the first two of four ways out of a LastValue conflict
source: capture/lab/internals/02-channels/repair.txt
lang: text
note: The checkpoint id in the update_state result is cut, and so are parts 3 and 4.
---
## 1. same graph, after the raise
get_state: raises InvalidUpdateError: At key 'x': Can receive only one value per step. Use an Annotated key to handle multiple v
update_state(cfg, {'x': 9}): ok -> {'configurable': {'thread_id': 't1', 'checkpoint_ns': '', …
invoke(None): raises InvalidUpdateError: At key 'x': Can receive only one value per step. Use an Annotated key to handle multiple v
node bodies run by invoke(None): ['a', 'b']; model calls so far 4
invoke({'x': 5}) as a new turn: raises InvalidUpdateError: At key 'x': Can receive only one value per step. Use an Annotated key to handle multiple v

## 2. same saver, graph recompiled with x: Annotated[int, operator.add]
get_state: ok -> {'x': 3}
invoke(None): ok -> {'x': 3}
node bodies run by invoke(None): []; model calls so far 8
```

- A reducer repairs the thread from its saved writes. The same saver, under a graph with `x: Annotated[int, operator.add]`, read the thread at once and finished the run. No node ran again, so no model call was paid twice. The value was 3, the input 0 plus 1 plus 2.
- `update_state` recovers the thread too. It writes a new checkpoint with the value you pass, and the repro of issue #9712 reads the thread again after it. The graph is still wrong, though. The next `invoke(None)` ran both nodes and both model calls again, and raised again.
- A fork from the input checkpoint, under the same graph, ran both nodes and raised.
- `delete_thread` clears the thread, and you lose its history.

So deploy the reducer first. Every broken thread then finishes from its saved writes. Use `update_state` when you must set the value by hand, and only on a graph that has the reducer. Choose the reducer for what the key means, because it decides the value of the repaired thread.

## add_messages and MessagesState

**add_messages:** the reducer for a list of messages. It appends a message with a new id, replaces a message with the same id, and deletes the message that a `RemoveMessage` names.

The kit calls `add_messages` on two messages `m1` and `m2`. An update with a new text for `m2` and a new message `m3` replaced one and appended the other. An update with `RemoveMessage(id="m1")` left only `m2`:

```listing
title: add_messages replaces by id and removes
source: capture/out/34-stategraph-reducers-send-command.txt
lang: json
note: The first result is cut to its three ids and texts.
---
replace m2, append m3:
…
    "content": "first",
    "id": "m1"
…
    "content": "second, edited",
    "id": "m2"
…
    "content": "third",
    "id": "m3"
…
remove m1:
[
  {
    "type": "HumanMessage",
    "content": "second",
    "id": "m2"
  }
]
```

So the `messages` key of an agent can change in place. The agents page calls it append only {{docs oss/python/langchain/agents}}, and the short-term memory page removes messages with `RemoveMessage` {{docs oss/python/langchain/short-term-memory}}. The code of `add_messages` decides, and this manual records the disagreement as conflict D104.

`MessagesState` is a schema with one `messages` key and the `add_messages` reducer. A node can return a dict such as `{"role": "assistant", "content": "..."}`, and the reducer turns it into an `AIMessage` with a new UUID. Every message in the state then has an id, so a later update can replace or remove it.

## Clearing a key that has a reducer

A node that returns an empty list for `log` does not clear it, because `operator.add` joins the empty list to the old one. The state page says to wrap the value in `Overwrite` to skip the reducer {{docs oss/python/langgraph/graph-api-state}}. The kit does not run `Overwrite` yet. A capture of it comes in the next edition, with the other open items of [section 8.8](#s-limits-at-the-pin-and-what-comes-in-the-next-edition).

```takeaways
- Return only the keys a node changes, and let each reducer merge them.
- Give a key a reducer when two nodes can write it in one step.
- Read InvalidUpdateError as two writes to a key with no reducer.
- After InvalidUpdateError on a saved thread, deploy the reducer, then resume with invoke(None).
- Give each message an id when a later update must replace or remove it.
- Use Overwrite to clear a key that has a merging reducer.
```

Sources: capture/s_graph.py, capture/out/34-stategraph-reducers-send-command.txt; capture/lab/internals/02-channels/trace.txt, capture/lab/internals/02-channels/run.py, capture/lab/internals/02-channels/repair.txt, capture/lab/internals/02-channels/repair.py; libs/langgraph/langgraph/graph/state.py, libs/langgraph/langgraph/graph/message.py, libs/langgraph/langgraph/channels/last_value.py, libs/langgraph/langgraph/pregel/_algo.py, and libs/langgraph/langgraph/pregel/main.py at langgraph 1.2.22; GitHub issue langchain-ai/langgraph#9712; docs.langchain.com at docs commit 04d4d4a (oss/python/langgraph/graph-api, oss/python/langgraph/graph-api-state, oss/python/langgraph/pregel, oss/python/langchain/agents, oss/python/langchain/short-term-memory).
