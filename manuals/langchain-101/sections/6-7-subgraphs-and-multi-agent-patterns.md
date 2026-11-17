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

[Figure](#fig-6-7b) draws the parent graph both ways, from the Mermaid text of each call.

```figure
id: fig-6-7b
kind: comparison
title: one parent graph, with and without xray
claim: get_graph() shows the subgraph as one node named inner, and get_graph(xray=True) opens it into shout and ask_ok inside a box.
caption: Read each column from the top. The dashed box on the right is the subgraph. The parent edges reach its first node and leave its last node. From capture/out/52-draw-subgraph.txt.
```

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

`outer.prepare` appears twice, and no node wrote it twice. The subgraph started with `steps` set to `["outer.prepare"]` and added its two entries. It returned all three as its output. The parent applied that output as one update, and `operator.add` joined it to the list that already held `outer.prepare`. [Figure](#fig-6-7) follows the list through the run.

```figure
id: fig-6-7
kind: flow
title: the steps list through a subgraph
claim: The subgraph returns the whole steps list it was given, and operator.add in the parent joins it again, so outer.prepare appears twice.
caption: Read from left to right. Each box shows steps after one node, and the dashed frame is the subgraph namespace. The rose entry is the copy that the parent reducer added. From capture/out/36-subgraphs.txt.
```

Any reducer that only appends adds the copy. `add_messages` replaces a message that has the same id, as [section 6.1](#s-stategraph-state-and-reducers) showed, so its copies replace the originals.

Two changes avoid the copy. Call the subgraph inside a node and return only its new entries, or give the subgraph a schema without the shared key. The subgraphs page describes the first as the way for schemas that share no keys {{docs oss/python/langgraph/use-subgraphs}}. The kit does not run either change, or a subgraph with `add_messages`, yet. Captures of them come in the next edition, with the other open items of [section 8.8](#s-limits-at-the-pin-and-what-comes-in-the-next-edition).

## Persistence of a subgraph

`compile` of a subgraph takes `checkpointer=None`, `True`, or `False`. `None`, the default, gives each call of the subgraph its own fresh state, and it uses the checkpointer of the parent for interrupts. `True` keeps the state of the subgraph across calls on the thread, and `False` turns checkpoints off {{docs oss/python/langgraph/use-subgraphs}}. The kit used `None`, and the interrupt inside the subgraph paused and resumed through the parent. The kit does not run `True` or `False` yet. They come in the next edition, with the other open items of [section 8.8](#s-limits-at-the-pin-and-what-comes-in-the-next-edition).

## An agent as a node

A `create_agent` graph is a compiled graph, so it can be a node. The kit adds an agent named `adder` to a graph with `MessagesState`. The stream with `subgraphs=True` showed the three node runs of the agent in its own namespace, then one chunk for `adder` in the root:

```listing
title: an agent in a parent graph
source: capture/out/45-subgraph-agent.txt
lang: json
note: The first and the last of four chunks.
---
{
  "namespace": [
    "adder:<uuid-1>"
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

The approval lab of [section 6.5](#s-human-in-the-loop-batched-and-per-call) also ran a Qwen3 4B agent in per-call mode as a subgraph, 3 runs. Two calls that needed approval were answered one at a time, and each tool ran once.

## Patterns for several agents

The multi-agent page of the docs names five patterns: subagents, `handoffs`, skills, a router, and a custom workflow {{docs oss/python/langchain/multi-agent/index}}. It also says that one agent with the right tools and prompt often does as well as several agents. The subagents page says that the `langgraph-supervisor` package is no longer maintained {{docs oss/python/langchain/multi-agent/subagents}}.

**Subagent:** an agent that another agent calls as a tool. The caller sees only the last message of the subagent.

Deep Agents gives every agent a `task` tool that starts a subagent. In the kit run, the main agent called `task` with a description that it wrote, and the subagent answered in one sentence:

```listing
title: the task call and its answer
source: capture/out/41-deep-agent.txt
lang: json
note: The fourth model call of the main agent and the ToolMessage that answered it.
---
        "name": "task",
        "args": {
          "description": "Verify that 2 + 3 equals 5 by performing a mathematical calculation and confirming the result.",
          "subagent_type": "general-purpose"
        },
        "id": "<uuid-11>",
        "type": "tool_call"
…
    "type": "ToolMessage",
    "content": "2 + 3 equals 5. This is a basic arithmetic fact and can be verified through direct calculation: 2 plus 3 is indeed 5.",
    "name": "task",
```

The model call of the subagent was the fifth of six calls. It got two messages, its own system prompt and the description, and its tools had no `task`. The main agent saw one `ToolMessage` with the answer of the subagent. So a subagent keeps its work out of the context of its caller. Part 7 covers Deep Agents.

## Five patterns on one task suite

**We measured** the five patterns on the 30-task subset of [section 1.2](#s-do-you-need-langchain), with `langchain` 1.5.0 and `deepagents` 0.7.38. Five domain agents split the tools of the suite: `shop`, `orders_db`, `docs`, `files`, and `notes`. The patterns were:

- **single:** one agent with all tools and the five domain guides in its prompt.
- **subagents:** a Deep Agents coordinator that calls each domain agent through `task`.
- **`handoffs`:** the domain agents as graph nodes, with a `transfer_to_<agent>` tool that returns `Command(goto=..., graph=Command.PARENT)`.
- **skills:** one agent with a `load_skill` tool that adds a domain guide to its prompt.
- **router:** a classifier that sends parallel requests to the domain agents, then a synthesizer agent.

Claude Haiku 5.5 ran through the API from the Mac. Qwen3 14B ran on Ollama 0.31.1 on the same Mac, at temperature 0 and seed 42. Each cell is one run for each of 30 tasks.

The Mac was shared. The load average was between 2.7 and 9.1 in the six samples we logged. The Ollama server was busy with other jobs. We stopped a run of gpt-oss 20B before its first task, so it has no row.

| Pattern | Haiku passed | Haiku calls | Haiku prompt tokens | Haiku dollars | 14B passed | 14B calls | 14B prompt tokens |
|---|---|---|---|---|---|---|---|
| single | 30 | 160 | 521,013 | $0.0130 | 22 | 140 | 251,620 |
| subagents | 30 | 271 | 1,247,292 | $0.0380 | 17 | 164 | 425,288 |
| `handoffs` | 30 | 187 | 373,993 | $0.0134 | 19 | 151 | 163,200 |
| skills | 30 | 194 | 314,352 | $0.0129 | 15 | 159 | 151,631 |
| router | 25 | 226 | 317,648 | $0.0237 | 18 | 187 | 105,174 |

On Haiku, four patterns passed 30 of 30, and the router passed 25. The router lost 3 chain tasks and 1 each in sql and retrieval, all with the category `wrong_final_state`. The cost differs more than the score. The subagent pattern used 2.4 times the prompt tokens of the single agent and cost 2.9 times the dollars. The `handoffs` and skills patterns cost the same as the single agent. [Figure](#fig-6-7c) shows one chain task in each pattern.

```figure
id: fig-6-7c
kind: timeline
title: one chain task in each of five patterns on Haiku
claim: On one chain task the five patterns used 5 to 7 model calls, and the subagent pattern ran two agents one after the other.
caption: Each box is one model call, numbered in order, in the lane of the agent that made it. Triangles mark tool calls. From capture/lab/summary/multiagent-mac.json.
```

A task with three user turns shows the cost of a pattern more clearly. On `multi07` every pattern passed. The single agent made 9 model calls and read 30.2k prompt tokens. The subagent pattern made 16 calls and read 72.6k, and the router made 18 calls. [Figure](#fig-6-7d) draws the five runs, with the start of each user turn.

```figure
id: fig-6-7d
kind: timeline
title: a three-turn task in each of five patterns on Haiku
claim: On a three-turn task the single agent made 9 model calls, and the other patterns made 12 to 18.
caption: Each box is one model call, numbered in order, in the lane of the agent that made it. Dashed lines mark the start of a user turn. From capture/lab/summary/multiagent-mac.json.
```

On Qwen3 14B the picture is different. The single agent passed 22 of 30, and no pattern did better. Subagents passed 17 and skills passed 15. Both passed 0 of 6 file tasks and 0 of 6 multiturn tasks. Subagents failed 13 tasks and skills failed 15, most with `wrong_final_state`. The intervals of all five cells overlap, so only those zeros are clear.

Each 14B cell is one run per task on a loaded shared Mac, so a second run can move single tasks.

The 14B wall time per task ran from 91 s to 315 s, and it says more about the load than about the pattern.



```takeaways
- Expect a subgraph with a shared appending key to add its input entries twice.
- Return only new entries from a subgraph when the parent key has an appending reducer.
- Read the namespace of each chunk with stream(subgraphs=True).
- Resume an interrupt inside a subgraph on the thread of the parent.
- Start with one agent, and add a subagent when a task needs its own context.
- Measure the pattern on your model, because subagents and skills passed 0 of 6 multiturn tasks on Qwen3 14B.
```

Sources: capture/s_graph.py, capture/out/36-subgraphs.txt, capture/out/52-draw-subgraph.txt, capture/out/45-subgraph-agent.txt, capture/out/41-deep-agent.txt; capture/lab/summary/approvals-x86.json, capture/lab/summary/multiagent-mac.json, capture/lab/multiagent/runs/patterns-haiku.jsonl, capture/lab/multiagent/runs/patterns-qwen3-14b.jsonl, capture/lab/multiagent/kit/patterns.py, capture/lab/multiagent/logs/uptime.log; libs/langgraph/langgraph/pregel/main.py and libs/langgraph/langgraph/types.py at langgraph 1.2.22; libs/deepagents/deepagents/graph.py at deepagents==0.7.38; docs.langchain.com at docs commit 04d4d4a (oss/python/langgraph/use-subgraphs, oss/python/langchain/multi-agent/index, oss/python/langchain/multi-agent/subagents).
