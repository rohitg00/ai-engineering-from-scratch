# StateGraph, state, and reducers

> A `StateGraph` node returns a partial update, and each state key merges that update with its reducer, or replaces the old value when the key has no reducer.

You write a graph in which three nodes run in the same step, and each one adds a joke to a list. One version of the graph ends with three jokes. Another version raises an error before the step ends. The two graphs differ in one line of the state schema.

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

The three `write_joke` runs happen in one step, and each returns one joke under `jokes`. The reducer joins the three updates, so the state holds three jokes. [Section 5.2](#s-edges-send-and-command) shows how the graph starts three runs of one node.

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

[Figure](#fig-5-1) sets the two keys side by side.

```figure
id: fig-5-1
kind: comparison
title: two writes to one key in one step
claim: Three writes to a key with operator.add join into one list, and two writes to a key with no reducer raise InvalidUpdateError at the end of the step.
caption: Read each column from the writes at the top to the state at the bottom. The left column is jokes in the joke graph, and the right column is value in the two-node graph. From capture/out/34-stategraph-reducers-send-command.txt.
```

The joined list keeps the order of the three subjects: cats, dogs, owls. The kit check records that order again on every run.

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

A node that returns an empty list for `log` does not clear it, because `operator.add` joins the empty list to the old one. The state page says to wrap the value in `Overwrite` to skip the reducer {{docs oss/python/langgraph/graph-api-state}}. The kit does not run `Overwrite` yet. A capture of it comes in the next edition, with the other open items of [section 7.6](#s-limits-at-the-pin-and-what-comes-in-the-next-edition).

```takeaways
- Return only the keys a node changes, and let each reducer merge them.
- Give a key a reducer when two nodes can write it in one step.
- Read InvalidUpdateError as two writes to a key with no reducer.
- Give each message an id when a later update must replace or remove it.
- Use Overwrite to clear a key that has a merging reducer.
```

Sources: capture/s_graph.py, capture/out/34-stategraph-reducers-send-command.txt; libs/langgraph/langgraph/graph/state.py and libs/langgraph/langgraph/graph/message.py at langgraph 1.2.22; docs.langchain.com at docs commit 04d4d4a (oss/python/langgraph/graph-api, oss/python/langgraph/graph-api-state, oss/python/langgraph/pregel, oss/python/langchain/agents, oss/python/langchain/short-term-memory).
