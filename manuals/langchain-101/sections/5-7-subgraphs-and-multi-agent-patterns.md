# Subgraphs and multi-agent patterns

> A subgraph shares the keys of its parent and runs in its own namespace, and its whole output passes through the parent reducers, which can add old entries twice.

You build one graph that checks a draft and add it as a node of a larger graph. The run works, but the log of steps in the parent holds the first entry twice. Nothing in the subgraph wrote it twice. The parent reducer added the whole output of the subgraph to its own list.

When you finish this section, you can add a graph or an agent as a node and read the namespace of its chunks. You can also pause inside it and choose a pattern for several agents.

## A graph as a node

**Subgraph:** a compiled graph used as a node of another graph. When the two state schemas share keys, the subgraph reads and writes the keys of the parent.

The kit inner graph upper-cases a text and asks if the result is fine. The outer graph adds `!`, runs the inner graph, and finishes. Both use the schema `Inner`, whose `steps` key has the reducer `operator.add`:

```listing
title: the inner graph and the outer graph
source: capture/s_graph.py
lang: python
note: The schema and the node functions of the inner graph are cut.
---
    inner = StateGraph(Inner)
    inner.add_node("shout", shout)
    inner.add_node("ask_ok", ask_ok)
    inner.add_edge(START, "shout")
    inner.add_edge("shout", "ask_ok")
    inner_app = inner.compile()

    outer = StateGraph(Inner)
    outer.add_node("prepare", lambda s: {"text": s["text"] + "!", "steps": ["outer.prepare"]})
    outer.add_node("inner", inner_app)
    outer.add_node("finish", lambda s: {"steps": ["outer.finish"]})
    outer.add_edge(START, "prepare")
    outer.add_edge("prepare", "inner")
    outer.add_edge("inner", "finish")
    app = outer.compile(checkpointer=InMemorySaver())
```

The inner graph has no checkpointer of its own. Only the outer graph gets `InMemorySaver`. `get_graph(xray=True)` draws the inner nodes inside a box named `inner`, with ids such as `inner:shout`.

## Namespaces

**Namespace:** the path of a subgraph run inside its parent, such as `inner:<task id>`. Stream chunks, checkpoints, and state carry it.

`stream(..., subgraphs=True)` yields pairs of a namespace and a chunk. The root graph has the empty namespace. The interrupt of `ask_ok` came twice, once from the subgraph and once from the root:

```listing
title: chunks with their namespaces
source: capture/out/36-subgraphs.txt
lang: json
note: The four chunks of the first run, cut to the namespace and the first key.
---
  "namespace": [],
  "chunk": {
    "prepare": {
…
  "namespace": [
    "inner:<uuid-1>"
  ],
  "chunk": {
    "shout": {
…
  "namespace": [
    "inner:<uuid-1>"
  ],
  "chunk": {
    "__interrupt__": [
…
  "namespace": [],
  "chunk": {
    "__interrupt__": [
```

While the run waits, `get_state(config, subgraphs=True)` shows both levels. The parent waits on the node `inner`, and the subgraph waits on `ask_ok`. The state of the task holds the values inside the subgraph. A resume with `"yes"` on the parent thread reached `ask_ok` and finished both graphs.

## The output passes through the parent reducer

This is the final state after the resume:

```listing
title: the final state of the outer graph
source: capture/out/36-subgraphs.txt
lang: json
---
{
  "text": "HELLO!",
  "steps": [
    "outer.prepare",
    "outer.prepare",
    "inner.shout",
    "inner.ask_ok=yes",
    "outer.finish"
  ]
}
```

`outer.prepare` appears twice, and no node wrote it twice. The subgraph started with `steps` set to `["outer.prepare"]` and added its two entries. It returned all three as its output. The parent applied that output as one update, and `operator.add` joined it to the list that already held `outer.prepare`. [Figure](#fig-5-7) follows the list through the run.

```figure
id: fig-5-7
kind: flow
title: the steps list through a subgraph
claim: The subgraph returns the whole steps list it was given, and operator.add in the parent joins it again, so outer.prepare appears twice.
caption: Read from left to right. Each box shows steps after one node, and the dashed frame is the subgraph namespace. The rose entry is the copy that the parent reducer added. From capture/out/36-subgraphs.txt.
```

Any reducer that only appends adds the copy. `add_messages` replaces a message that has the same id, as [section 5.1](#s-stategraph-state-and-reducers) showed, so its copies replace the originals.

Two changes avoid the copy. Call the subgraph inside a node and return only its new entries, or give the subgraph a schema without the shared key. The subgraphs page describes the first as the way for schemas that share no keys {{docs oss/python/langgraph/use-subgraphs}}. The kit does not run either change, or a subgraph with `add_messages`, yet. Captures of them come in the next edition, with the other open items of [section 7.6](#s-limits-at-the-pin-and-what-comes-in-the-next-edition).

## Persistence of a subgraph

`compile` of a subgraph takes `checkpointer=None`, `True`, or `False`. `None`, the default, gives each call of the subgraph its own fresh state, and it uses the checkpointer of the parent for interrupts. `True` keeps the state of the subgraph across calls on the thread, and `False` turns checkpoints off {{docs oss/python/langgraph/use-subgraphs}}. The kit used `None`, and the interrupt inside the subgraph paused and resumed through the parent. The kit does not run `True` or `False` yet. They come in the next edition, with the other open items of [section 7.6](#s-limits-at-the-pin-and-what-comes-in-the-next-edition).

## An agent as a node

A `create_agent` graph is a compiled graph, so it can be a node. The kit adds an agent named `adder` to a graph with `MessagesState`. The stream with `subgraphs=True` showed the three node runs of the agent in its own namespace, then one chunk for `adder` in the root:

```listing
title: an agent in a parent graph
source: capture/out/36-subgraphs.txt
lang: json
note: The first and the last of four chunks.
---
{
  "namespace": [
    "adder:<uuid-2>"
  ],
  "nodes": [
    "model"
  ]
}
…
{
  "namespace": [],
  "nodes": [
    "adder"
  ]
}
```

The approval lab of [section 5.5](#s-human-in-the-loop-batched-and-per-call) also ran an agent in per-call mode as a subgraph. Two calls that needed approval were answered one at a time, and each tool ran once.

## Patterns for several agents

The multi-agent page of the docs names five patterns: subagents, `handoffs`, skills, a router, and a custom workflow {{docs oss/python/langchain/multi-agent/index}}. It also says that one agent with the right tools and prompt often does as well as several agents. The subagents page says that the `langgraph-supervisor` package is no longer maintained {{docs oss/python/langchain/multi-agent/subagents}}.

**Subagent:** an agent that another agent calls as a tool. The caller sees only the last message of the subagent.

Deep Agents gives every agent a `task` tool that starts a subagent. In the kit run, the main agent called `task` with a description, and the subagent answered `yes`:

```listing
title: the task call and its answer
source: capture/out/41-deep-agent.txt
lang: json
note: The third model call of the main agent and the ToolMessage that answered it.
---
        "name": "task",
        "args": {
          "description": "Check that 2 + 3 is 5 and reply yes or no.",
          "subagent_type": "general-purpose"
        },
        "id": "call_t",
        "type": "tool_call"
…
    "type": "ToolMessage",
    "content": "yes",
    "name": "task",
```

The model call of the subagent was the fourth call of the fake. It got two messages, its own system prompt and one other message, and its tools had no `task`. The main agent saw one `ToolMessage` with the text `yes`. So a subagent keeps its work out of the context of its caller. Part 6 covers Deep Agents.

The kit runs only the subagent pattern. Captures of the other four patterns come in the next edition, with the other open items of [section 7.6](#s-limits-at-the-pin-and-what-comes-in-the-next-edition).

```takeaways
- Expect a subgraph with a shared appending key to add its input entries twice.
- Return only new entries from a subgraph when the parent key has an appending reducer.
- Read the namespace of each chunk with stream(subgraphs=True).
- Resume an interrupt inside a subgraph on the thread of the parent.
- Start with one agent, and add a subagent when a task needs its own context.
```

Sources: capture/s_graph.py, capture/out/36-subgraphs.txt, capture/out/41-deep-agent.txt; capture/lab/summary/approvals-mac.json; libs/langgraph/langgraph/pregel/main.py and libs/langgraph/langgraph/types.py at langgraph 1.2.22; libs/deepagents/deepagents/graph.py at deepagents==0.7.38; docs.langchain.com at docs commit 04d4d4a (oss/python/langgraph/use-subgraphs, oss/python/langchain/multi-agent/index, oss/python/langchain/multi-agent/subagents).
