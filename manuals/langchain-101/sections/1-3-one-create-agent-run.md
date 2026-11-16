# One create_agent run, from invoke to the last checkpoint

> One `invoke` of a `create_agent` agent runs four graph steps, makes two model calls and one tool call, and with a checkpointer saves five checkpoints.

You call `agent.invoke` with one question and get four messages back. The reply looks like one exchange with a model. Behind it, a graph ran four steps, the model ran twice, and a tool ran once. When a run fails later, the error names one of those steps, so you need to know their order.

When you finish this section, you can name each step of one agent run and the state after it. You can also say what a checkpointer saves at each step, and what a trace records.

## The run

The agent from the [first run](#s-front) has one tool, `add`, and the system prompt `You add numbers.`. Its model is Qwen3 4B on Ollama. It called `add` with 2 and 3, and then answered. This is the state at the end of the run:

```listing
title: the final state of one run
source: capture/out/06-agent-run.txt
lang: json
note: The key list and the metadata of each reply are cut. All four messages are shown.
---
  {
    "type": "HumanMessage",
    "content": "What is 2 + 3?",
    "id": "<uuid-1>"
  },
  {
    "type": "AIMessage",
    "content": "",
    "id": "lc_run--<uuid-2>-0",
    "tool_calls": [
      {
        "name": "add",
        "args": {
          "a": 2,
          "b": 3
        },
        "id": "<uuid-3>",
        "type": "tool_call"
      }
    ],
…
  {
    "type": "ToolMessage",
    "content": "5",
    "name": "add",
    "id": "<uuid-4>",
    "tool_call_id": "<uuid-3>",
    "status": "success"
  },
  {
    "type": "AIMessage",
    "content": "2 + 3 = 5.",
    "id": "lc_run--<uuid-5>-0",
```

The state holds one key, `messages`. The system prompt is not in it. The two model replies have ids that start with `lc_run--`, because LangChain gives each model output the id of its run. The human and tool messages get a plain UUID when the graph adds them. The tool call id is a UUID too, because `ChatOllama` makes one for each call. Each reply also carries `response_metadata` and `usage_metadata` from Ollama, with the token counts of the call.

## What the model received

The kit records each call with a callback handler. The model ran twice, and both calls got the system prompt first and the same bound tool:

```listing
title: the two model calls
source: capture/out/06-agent-run.txt
lang: json
note: Cut to the messages and the bound tools. The model label is cut.
---
    "call": 1,
    "messages": [
      "system: You add numbers.",
      "human: What is 2 + 3?"
    ],
    "tools": [
      "add"
    ]
…
    "call": 2,
    "messages": [
      "system: You add numbers.",
      "human: What is 2 + 3?",
      "ai: calls add",
      "tool: 5"
    ],
```

So the agent sends the whole conversation on every call, and it adds the system prompt to the front of each request. [Section 3.5](#s-the-system-prompt) explains why the prompt stays out of the state.

## Step by step

[Figure](#fig-1-3) draws the run. The numbers in this list match the rows of the figure.

```figure
id: fig-1-3
kind: sequence
title: one create_agent run, step by step
claim: The model node runs twice and the tools node once, and the checkpointer saves the state after the input and after each of the four steps.
caption: Read the rows from top to bottom. Each teal arrow is one checkpoint, with its step number. The amber note under each checkpoint is the node that runs next. The chips on the right are the messages in each checkpoint, and a bold chip is new in that step. From capture/out/06-agent-run.txt, capture/out/05-agent-graph.txt, and capture/out/30-state-history-forks.txt.
```

1. `invoke` puts the input on the graph. With a checkpointer, LangGraph saves the input checkpoint, step `-1`.
2. The `__start__` node writes the human message into `messages`. Checkpoint step `0` says the next node is `model`.
3. The `model` node adds the system prompt, binds the tools, and calls the model. The model answers with one tool call. Checkpoint step `1` says the next node is `tools`.
4. The `tools` node runs `add(a=2, b=3)` and appends a `ToolMessage` whose `tool_call_id` is the id of the call. Checkpoint step `2` says the next node is `model`.
5. The `model` node calls the model again with all three messages. The model answers with text and no tool call.
6. The edge after `model` sees no tool call and goes to `__end__`. Checkpoint step `3` has no next node, and `invoke` returns the state.

The edges in the compiled graph say the same. Two edges out of `model` are conditional, and the tool calls choose between them:

```listing
title: the edges of the agent graph
source: capture/out/05-agent-graph.txt
lang: json
---
[
  "__start__ -> model",
  "model -> __end__ (conditional)",
  "model -> tools (conditional)",
  "tools -> model (conditional)"
]
```

A graph with no tools has no `tools` node. It is `__start__`, `model`, and `__end__`, and it runs one model call.

[Figure](#fig-1-3c) draws the graph of this agent from the Mermaid text that the compiled graph returns. [Section 4.1](#s-create-agent-and-the-graph-it-builds) shows how to draw your own.

```figure
id: fig-1-3c
kind: structure
title: the graph of the agent in this run
claim: One plain edge leads into model, and three conditional edges leave model and tools, so the run picks its path at run time.
caption: Read from __start__ at the top. Solid arrows are plain edges, and dashed amber arrows are conditional edges. The tools node lists its one tool. From capture/out/48-draw-agent.txt.
```

## The checkpoints

**Checkpoint:** the saved state of one thread after one step, with the step number, the next nodes, and the id of the checkpoint before it.

The run above had no checkpointer. The kit runs the same shape of agent with `InMemorySaver` in two other scenarios. One asks `What is 2 + 3?` and then a second question on the same thread. After both turns the thread had 8 checkpoints, and the last was step 6:

```listing
title: the thread after two turns
source: capture/out/28-checkpoint-memory.txt
lang: text
note: Cut to the step of the last checkpoint and the count.
---
  "step": 6,
  "source": "loop",
…
8 checkpoints
```

The first turn saved steps `-1` to `3`, which is five checkpoints. The second turn saved steps `4` to `6`. It made one model call, because the model answered without a tool.

The other scenario asks a `charge` tool to charge 10 and reads the history back, newest first. Its steps match the list above, one for one:

```listing
title: the history of one turn, newest first
source: capture/out/30-state-history-forks.txt
lang: json
note: Cut to the step, the source, and the next nodes of each checkpoint. The ids and the messages are cut.
---
  "step": 3,
  "source": "loop",
  "next": [],
…
  "step": 2,
  "source": "loop",
  "next": [
    "model"
  ],
…
  "step": 1,
  "source": "loop",
  "next": [
    "tools"
  ],
…
  "step": 0,
  "source": "loop",
  "next": [
    "model"
  ],
…
  "step": -1,
  "source": "input",
  "next": [
    "__start__"
  ],
```

A checkpoint whose `next` names a node is a place where the run can stop and resume. Part 5 says when each checkpoint is written, and what a crash between two of them repeats.

## The stream of the same run

Every compiled `StateGraph` has the default stream mode `updates`, and an agent is one {{code libs/langgraph/langgraph/graph/state.py}}. So `agent.stream(input)` with no mode yields one chunk for each step, keyed by the node that ran:

```listing
title: the chunks of a stream with no mode
source: capture/out/21-stream-updates-values.txt
lang: json
note: The last section of the file. Each chunk is cut to its keys.
---
chunk 0 keys:
[
  "model"
]

chunk 1 keys:
[
  "tools"
]

chunk 2 keys:
[
  "model"
]
```

Three chunks for three node runs. The `__start__` step yields no chunk. Part 5 shows the other stream modes.

## The trace

With tracing on, LangChain sends one run to LangSmith for each piece of work. The kit wraps the same agent in a local trace and records what the client would send:

```listing
title: the runs of one traced agent turn
source: capture/out/42-langsmith.txt
lang: text
note: Cut to the request counts and the tree of runs, which sit at lines 82 to 99 of the file.
---
  "PATCH /runs/<run-id>": 7,
  "POST /runs": 7
}

chain agent_turn
  chain LangGraph
    chain model
      llm ChatOllama
    chain tools
      tool add
    chain model
      llm ChatOllama
```

The tree has eight runs. The outer `agent_turn` is the `traceable` function of the kit, and it stayed in memory. The seven LangChain runs below it each got one `POST` when it started and one `PATCH` when it ended. [Figure](#fig-1-3b) draws the tree. Each node of the graph is a `chain` run, and the model calls and the tool call are leaves.

```figure
id: fig-1-3b
kind: tree
title: the runs of one traced agent turn
claim: A traced turn is a tree of runs, with one chain run for each graph node and one leaf for each model call and tool call.
caption: Read from the root at the top. Each box is one run, with its name above its run type. The violet root stayed in memory, and the client got the seven runs below it. The plum leaves are model calls and the green leaf is the tool call. From capture/out/42-langsmith.txt.
```

## The recursion limit

Each step counts against the recursion limit of the run. `create_agent` sets that limit to 9999 on the compiled graph, just under the LangGraph default of 10007 for other graphs:

```listing
title: the config on the compiled agent
source: capture/out/05-agent-graph.txt
lang: json
note: The config of the compiled graph, from the same file.
---
{
  "recursion_limit": 9999,
  "metadata": {
    "ls_integration": "langchain_create_agent"
  },
  "configurable": {}
}
```

A model that never stops asking for a tool runs until the limit. The kit told Qwen3 4B to count upward with `add` and never stop. With `recursion_limit=6` in the config, the run stopped after three model calls and two tool calls, with `GraphRecursionError: Recursion limit of 6 reached without hitting a stop condition.`

**We measured** a looping agent on the x86 server guest. With Qwen3 4B, it made 121 model calls before the script stopped it at 1200 s, and it showed no sign of stopping. `recursion_limit=25` stopped it after 13 model calls, in 3 of 3 runs. Set a limit that fits your task, because a loop costs every model call it makes.

```takeaways
- Expect the model to receive the system prompt and the whole conversation on every call.
- Read next on a checkpoint to know which node runs on a resume.
- Pass a checkpointer and a thread_id when you need the steps saved.
- Stream with no mode to get one chunk for each node run.
- Set recursion_limit for each run, because the default of 9999 steps allows about 5000 model calls. This is arithmetic, not a run.
```

Sources: capture/out/06-agent-run.txt, capture/out/05-agent-graph.txt, capture/out/48-draw-agent.txt, capture/out/28-checkpoint-memory.txt, capture/out/30-state-history-forks.txt, capture/out/21-stream-updates-values.txt, capture/out/46-recursion-agent.txt, capture/out/42-langsmith.txt; capture/lab/summary/recursion-x86.json, capture/lab/T17-claims-x86/01-claims.jsonl, capture/lab/T17-claims-x86/02-nolimit.jsonl, capture/lab/summary/recursion-mac.json, capture/lab/T17-claims-mac/01-recursion-limit.jsonl; libs/langchain_v1/langchain/agents/factory.py at langchain==1.5.0, libs/langgraph/langgraph/graph/state.py and libs/langgraph/langgraph/_internal/_config.py at langgraph 1.2.22.
