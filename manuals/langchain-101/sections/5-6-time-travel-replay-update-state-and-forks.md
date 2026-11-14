# Time travel: replay, update_state, and forks

> A replay from a past checkpoint runs every later node again, and `update_state` adds a new branch next to the old one, so neither reads saved results or erases history.

An agent charged a card, and you want to see what it would have done with a different instruction. You pick an earlier checkpoint from the history and run from it. The card is charged a second time, because a replay does not read the old tool result. It calls the tool again.

When you finish this section, you can list the history of a thread, replay from any checkpoint, and fork it with `update_state`. You can also say which nodes run again.

## The history of a thread

**State history:** the list of checkpoints of one thread, newest first, from `get_state_history(config)`.

The kit agent has one tool, `charge`, which records each amount it charges. One turn with `Charge 10.` saved five checkpoints. Each one names its parent, and the newest has no next node:

```listing
title: the history of one turn
source: capture/out/30-state-history-forks.txt
lang: json
note: Cut to the step, the source, the next nodes, and the ids of the first two checkpoints. The messages are cut.
---
  "step": 3,
  "source": "loop",
  "next": [],
  "checkpoint_id": "<uuid-1>",
  "parent_checkpoint_id": "<uuid-2>",
…
  "step": 2,
  "source": "loop",
  "next": [
    "model"
  ],
  "checkpoint_id": "<uuid-2>",
  "parent_checkpoint_id": "<uuid-3>",
```

The `config` of each entry holds `thread_id`, `checkpoint_ns`, and `checkpoint_id`. That config is the address of the checkpoint for every call below.

## Replay

**Replay:** an `invoke(None, config)` where `config` names a past checkpoint. The run starts from that checkpoint and runs the nodes in its `next` again.

The kit replays from the checkpoint whose `next` is `tools`. The tool ran a second time, and the thread grew from 5 to 8 checkpoints:

```listing
title: a replay from the checkpoint before tools
source: capture/out/30-state-history-forks.txt
lang: text
---
charge calls so far (the tool ran again on replay):
[
  10,
  10
]

checkpoints on the thread now: 8
```

The model answered with the next line of its script, `Charged again after replay.`. A real model would get the same messages as on the first run and could answer in another way. The time travel page says the same: a replay runs the nodes again, with their model calls, API requests, and interrupts {{docs oss/python/langgraph/use-time-travel}}.

## update_state makes a fork

**Fork:** a new checkpoint whose parent is a past checkpoint. Runs from it form a branch beside the old one, and the old checkpoints stay.

`update_state(config, values)` writes `values` into a new checkpoint after the one that `config` names. The update goes through the reducers, as if a node had returned it. The kit adds a human message to the first `model` checkpoint:

```listing
title: a fork with one more human message
source: capture/s_persist.py
lang: python
---
    first_model = next(s for s in reversed(states) if s.next == ("model",))
    forked = agent.update_state(first_model.config, {"messages": [{"role": "user", "content": "Actually, charge 99."}]})
```

The new checkpoint has the source `update` and the step 1, and its parent is the step 0 checkpoint. Its `next` is still `model`. Running from it charged 99, and the charges of the first branch stayed in the list:

```listing
title: the fork and the run from it
source: capture/out/30-state-history-forks.txt
lang: json
note: The fork cut to its step, source, next, and parent, then the charges after the run.
---
  "step": 1,
  "source": "update",
  "next": [
    "model"
  ],
  "checkpoint_id": "<uuid-6>",
  "parent_checkpoint_id": "<uuid-4>",
…
charge calls:
[
  10,
  10,
  99
]
```

The time travel page warns that `update_state` does not roll a thread back {{docs oss/python/langgraph/use-time-travel}}. The thread now has three branches: the first run, the replay, and the fork.

## Write as a node with as_node

`update_state` takes `as_node`, the node that the update counts as. LangGraph then picks the next node as if that node had run. The kit agent stops before `tools` with `interrupt_before=["tools"]`. It writes the tool result by hand as the node `tools`, and the run goes on to `model`:

```listing
title: a tool result written by hand
source: capture/out/30-state-history-forks.txt
lang: json
---
[
  "human: Charge 5.",
  "ai: ",
  "tool: charged 5 by hand",
  "ai: Done, per the manual entry."
]

charge calls (unchanged):
[
  10,
  10,
  99
]
```

The tool did not run. Use this when a person did the work of a tool outside the agent. The `ToolMessage` must carry the `tool_call_id` of the waiting call.

## The address must be complete

`update_state` needs the full address of a checkpoint. The lab called it with a config that held only `thread_id` and `checkpoint_id`, and it raised `KeyError: 'checkpoint_ns'`. Pass the `config` of an entry from `get_state_history`, or add `"checkpoint_ns": ""` for a graph with no subgraph.

## What the lab counted

**We measured** replays and forks on the Mac, one run of each case, with `InMemorySaver`. A graph ran three nodes `a`, `b`, and `c` in a row, and each added one to `x`. The first run saved 5 checkpoints. A replay from the checkpoint before `b` ran `b` once and `c` once, ran `a` zero times, and added 3 checkpoints. One of the three had the source `fork`.

`update_state` on the same checkpoint set `x` to 100. It ran no node, added one checkpoint with the source `update`, and kept every old checkpoint. The run from it ran `b` and `c` once each and ended with `x` at 102. The thread then held 11 checkpoints in three branches. [Figure](#fig-5-6) draws them.

```figure
id: fig-5-6
kind: tree
title: three branches of one thread
claim: A replay and an update_state from the checkpoint before b each start a branch beside the first run, and every old checkpoint stays.
caption: Read from the input checkpoint at the top. Each box is one checkpoint with its step and the value of x. The amber box is the fork of the replay, and the violet box is the update. From capture/lab/summary/replay-fork-mac.json.
```

The same lab ran an agent with one tool. A replay from step 0, whose `next` is `model`, made 2 model calls and 1 tool call. A replay from step 1, whose `next` is `tools`, made 1 model call and 1 tool call. So a replay costs what the original run cost from that point on. Make every node after the checkpoint safe to run twice before you replay.

The docs say that you cannot time travel to a point between the nodes of a default subgraph {{docs oss/python/langgraph/use-time-travel}}. The lab did not run time travel inside a subgraph. It comes in the next edition, with the other open items of [section 7.6](#s-limits-at-the-pin-and-what-comes-in-the-next-edition).

```takeaways
- Read get_state_history newest first, and use the config of an entry as its address.
- Expect a replay to run every later node again, with its model calls and tool calls.
- Use update_state to fork a thread, and expect the old checkpoints to stay.
- Pass as_node="tools" to record a tool result that a person produced.
- Pass the full config from the history to update_state, with checkpoint_ns.
```

Sources: capture/s_persist.py, capture/out/30-state-history-forks.txt; capture/lab/summary/replay-fork-mac.json, capture/lab/T17-claims-mac/02-replay-and-fork.jsonl; libs/langgraph/langgraph/pregel/main.py and libs/checkpoint/langgraph/checkpoint/memory/__init__.py at langgraph 1.2.22; docs.langchain.com at docs commit 04d4d4a (oss/python/langgraph/use-time-travel).
