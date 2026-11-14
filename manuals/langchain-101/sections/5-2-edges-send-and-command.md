# Edges, Send, and Command

> A plain edge always runs, a conditional edge picks from the state, `Send` starts one task per item, and `Command` updates and routes in one return.

You have a list of subjects whose length you learn only at run time, and you want one model call for each subject. After them, one node must choose between two endings and record why. You need three kinds of routing in one graph.

When you finish this section, you can connect nodes with plain and conditional edges. You can also start a variable number of tasks with `Send`, and route from a node with `Command`.

## The graph

The kit graph of [section 5.1](#s-stategraph-state-and-reducers) has five nodes. This is the code that connects them:

```listing
title: the nodes and edges of the joke graph
source: capture/s_graph.py
lang: python
---
    graph = StateGraph(Fanout)
    graph.add_node("plan", plan)
    graph.add_node("write_joke", write_joke)
    graph.add_node("pick", pick)
    graph.add_node("publish", publish)
    graph.add_node("retry", retry)
    graph.add_edge(START, "plan")
    graph.add_conditional_edges("plan", fan_out, ["write_joke"])
    graph.add_edge("write_joke", "pick")
    graph.add_edge("publish", END)
    graph.add_edge("retry", END)
    app = graph.compile()
```

`compile` checks the graph and returns the object you run. The graph API page says that you must compile a graph before you invoke or stream it {{docs oss/python/langgraph/graph-api}}. The Mermaid text of the compiled graph shows every edge. A solid arrow `-->` is a plain edge, and a dotted arrow `-.->` is a conditional one:

```listing
title: the edges of the compiled graph
source: capture/out/34-stategraph-reducers-send-command.txt
lang: text
note: The edge lines of the Mermaid text. The node lines and the styles are cut.
---
	__start__ --> plan;
	pick -.-> publish;
	pick -.-> retry;
	plan -.-> write_joke;
	write_joke --> pick;
	publish --> __end__;
	retry --> __end__;
```

No `add_edge` call leaves `pick`, but the graph has two edges out of it. They come from the return type of `pick`, as the next part shows.

[Figure 5.2](#fig-5-2) draws the graph and one run through it.

```figure
id: fig-5-2
kind: flow
title: the joke graph and one run
claim: Send starts three write_joke tasks in one step, and Command from pick updates best and goes to publish, so retry never runs.
caption: Read from __start__ at the left to __end__ at the right. Solid arrows are plain edges, and dashed amber arrows are routes chosen at run time. The grey retry node did not run. From capture/out/34-stategraph-reducers-send-command.txt.
```

## Plain and conditional edges

**Plain edge:** an edge from one node to another that LangGraph follows every time the first node finishes.

**Conditional edge:** an edge with a routing function. After the source node runs, the function reads the state and returns the next node, a list of nodes, or `END`.

The third argument of `add_conditional_edges` lists the nodes that the function can return. LangGraph uses that list to draw the graph. [Section 1.2](#s-one-create-agent-run) showed the conditional edges of an agent: after `model`, the tool calls in the last message choose `tools` or `__end__`.

## Send: one task for each item

**Send:** a value that names a node and the input of one run of it. A routing function that returns a list of them starts one task for each item, in the same step.

`fan_out` is the routing function after `plan`. It reads `subjects` and returns one `Send` for each subject. Each `write_joke` task gets its own small dict as input, and it does not see the full state:

```listing
title: the routing function and the node it starts
source: capture/s_graph.py
lang: python
---
    def fan_out(state):
        return [Send("write_joke", {"subject": s}) for s in state["subjects"]]

    def write_joke(arg):
        return {"jokes": [f"a joke about {arg['subject']}"], "log": [f"write_joke({arg['subject']})"]}
```

The `updates` stream yields one chunk for each task. The three `write_joke` chunks come between the chunk of `plan` and the chunk of `pick`:

```listing
title: the three write_joke chunks
source: capture/out/34-stategraph-reducers-send-command.txt
lang: json
note: Three of the six chunks of the updates stream, cut to the jokes key.
---
  "write_joke": {
    "jokes": [
      "a joke about cats"
    ],
…
  "write_joke": {
    "jokes": [
      "a joke about dogs"
    ],
…
  "write_joke": {
    "jokes": [
      "a joke about owls"
    ],
```

The three tasks write `jokes` in the same step, so the key needs the reducer of section 5.1. The docs page for `Send` and `Command` calls this pattern map-reduce {{docs oss/python/langgraph/graph-api-send-command}}.

Import `Send` from `langgraph.types`. An import from `langgraph.constants` still works at the pin, and it warns that the path is deprecated {{code libs/langgraph/langgraph/constants.py}}. Some LangChain Academy files still use the old path {{academy langchain-academy}}. This manual records the disagreement as conflict D303.

## Command: update and route in one return

**Command:** a value that a node returns to update the state and name the next node in one step. Its fields are `update`, `goto`, `graph`, and `resume`.

`pick` chooses the first joke in sort order. It returns a `Command` that sets `best`, adds a line to `log`, and goes to `publish` or `retry`:

```listing
title: a node that returns a Command
source: capture/s_graph.py
lang: python
---
    def pick(state) -> Command[Literal["publish", "retry"]]:
        best = sorted(state["jokes"])[0]
        target = "publish" if "cats" in best else "retry"
        return Command(update={"best": best, "log": [f"pick -> {target}"]}, goto=target)
```

The `Literal` in the return type names the two possible targets. LangGraph reads it to draw the two dotted edges out of `pick`, and the docs say that the annotation is required for that {{docs oss/python/langgraph/graph-api-send-command}}. The run went to `publish`, and `retry` did not run. The last two chunks of the stream show it:

```listing
title: the last two chunks of the run
source: capture/out/34-stategraph-reducers-send-command.txt
lang: json
---
{
  "pick": {
    "best": "a joke about cats",
    "log": [
      "pick -> publish"
    ]
  }
}

{
  "publish": {
    "log": [
      "publish"
    ]
  }
}
```

Use a conditional edge when the route depends only on the state. Use `Command` when the node that computes the update also knows the route, as `pick` does.

`Command` has two more uses. With `resume`, it is the input that answers an interrupt, and [section 5.4](#s-interrupt-and-resume) shows it. With `graph=Command.PARENT`, a node inside a subgraph routes to a node of the parent graph {{docs oss/python/langgraph/graph-api-send-command}}. The kit does not run `Command.PARENT` yet. A capture of it comes in the next edition, with the other open items of section 7.6.

```takeaways
- List the possible targets of a conditional edge in its third argument.
- Return a list of Send values to run one node once for each item.
- Give every key that parallel tasks write a reducer.
- Annotate a node that returns Command with Command[Literal[...]] for each target.
- Import Send and Command from langgraph.types.
```

Sources: capture/s_graph.py, capture/out/34-stategraph-reducers-send-command.txt; libs/langgraph/langgraph/types.py, libs/langgraph/langgraph/constants.py, and libs/langgraph/langgraph/graph/state.py at langgraph 1.2.22; docs.langchain.com at docs commit 04d4d4a (oss/python/langgraph/graph-api, oss/python/langgraph/graph-api-send-command); LangChain Academy, langchain-academy repository, read 2026-11-14.
