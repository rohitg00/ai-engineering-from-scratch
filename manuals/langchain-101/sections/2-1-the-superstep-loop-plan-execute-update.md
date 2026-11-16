# The superstep loop: plan, execute, update

> Treat each superstep as one transaction: parallel writes become visible together, in task-path order, so never let your state depend on which node finished first.

Two parallel nodes each ask a model for an answer and append it to one list. Your log shows `b` returning before `a` in most runs. The state lists `a` first every time. The order you see in the state is a sort order, and the runtime fixes it before the nodes run.

When you finish this section, you can read a superstep trace line by line and predict which node runs next from the channel versions. You can also predict the merge order of parallel writes, and set a recursion limit that counts the right thing.

## Three phases in one loop

**Superstep:** one turn of the LangGraph loop. It plans the tasks that are ready, runs them, and then applies all of their writes at once.

The loop is short. `loop.tick()` plans, `runner.tick()` runs every planned task that has no saved writes yet, and `loop.after_tick()` applies the writes and saves a checkpoint {{code libs/langgraph/langgraph/pregel/main.py:3081-3105}}. A node never sees a write from its own superstep. The values it reads are the values at the end of the superstep before.

**Plan.** `prepare_next_tasks` builds two kinds of task {{code libs/langgraph/langgraph/pregel/_algo.py:392}}. A PULL task is a node whose trigger channel holds a value and has a newer version than the node last saw {{code libs/langgraph/langgraph/pregel/_algo.py:1260-1277}}. A PUSH task is one `Send` waiting in the `__pregel_tasks` channel {{code libs/langgraph/langgraph/pregel/_algo.py:441-466}}.

**Execute.** The runner starts the tasks in parallel. As each task finishes, the loop records its writes and passes them to the checkpointer in the background. [Section 2.3](#s-the-checkpoint-write-path-and-durability) follows that write.

**Update.** After the last task, `apply_writes` sorts the tasks, groups their writes by channel, and calls each channel once with the whole group {{code libs/langgraph/langgraph/pregel/_loop.py:732-738}}. Then `_put_checkpoint` saves the result {{code libs/langgraph/langgraph/pregel/_loop.py:774}}.

## One agent run, captured

We patched the loop functions of `langgraph` 1.2.22 to record each call. Then we ran `create_agent` with Qwen3 4B on Ollama, on the x86 server guest, at temperature 0. The prompt was `Weather in Paris and Oslo?`. The model asked for two `get_weather` calls in its first reply, which took 3.64 s, and answered in its second, which took 1.59 s. These times come from one run on a loaded guest, so read the order and the counts and not the seconds. This is step 1 and step 2 of the trace:

```listing
title: plan, execute, and update for the model step and the tools step
source: capture/lab/internals/01-superstep/trace.txt
lang: text
note: Steps 1 and 2 of the run. The writes of the model and the saver lines between the phases are cut.
---
[ 12] PLAN step=1 stop=9999 updated_channels=['branch:to:model', 'messages']
        task __pregel_pull model  id=c716c241 path=('__pregel_pull', 'model') triggers=['branch:to:model']
        versions_seen(before)={'__input__': {}, '__start__': {'__start__': 1}}
[ 13] TICK step=1 returns=True status=pending run=['model']
        channel_versions={'__start__': 2, 'branch:to:model': 2, 'messages': 2}
…
[ 15] UPDATE order=["model@('__pregel_pull', 'model')"]
…
        versions_changed={'__pregel_tasks': [None, 3], 'branch:to:model': [2, 3], 'messages': [2, 3]}
        versions_seen_updated={'model': {'branch:to:model': 2}}
        updated_channels=['__pregel_tasks', 'messages']
…
[ 18] PLAN step=2 stop=9999 updated_channels=['__pregel_tasks', 'messages']
        task __pregel_push tools  id=7bd87c87 path=('__pregel_push', 0, False) triggers=['__pregel_push']
        task __pregel_push tools  id=81e79e5c path=('__pregel_push', 1, False) triggers=['__pregel_push']
…
[ 25] UPDATE order=["tools@('__pregel_push', 0, False)", "tools@('__pregel_push', 1, False)"]
```

`create_agent` turns each tool call into its own `Send`, so two tool calls become two PUSH tasks of the `tools` node {{code libs/langchain_v1/langchain/agents/factory.py:2031-2032}}. Each one gets its own task id and its own index in the path. [Figure](#fig-2-1) draws all six supersteps of the run with the version of each channel.

```figure
id: fig-2-1
kind: timeline
title: six supersteps of one create_agent run, with channel versions
claim: Every write in a superstep gets the same new version, and a node runs only when its trigger channel is newer than the version it last saw.
caption: Columns are supersteps, from the input step to the step that finds no task. Amber tags are the tasks planned. In the channel rows, a filled cell is a write with its new version, and a dashed cell was read and cleared. Amber arrows run from a version to the task it triggers. From capture/lab/internals/01-superstep/trace.jsonl.
```

## Versions decide what runs next

**Channel version:** a number that the loop stores for each channel in the checkpoint. A channel that changes in a superstep gets a new version.

The rule is simple, and it is global. `apply_writes` takes the highest version of any channel and adds one {{code libs/langgraph/langgraph/pregel/_algo.py:271-282}}. Every channel that changes in that superstep gets that same number. In step 1 above, `messages`, `__pregel_tasks`, and `branch:to:model` all moved to version 3.

**versions_seen:** a map in the checkpoint, from each node to the version of each trigger channel when that node last ran.

`apply_writes` updates `versions_seen` only for the channels that triggered the task {{code libs/langgraph/langgraph/pregel/_algo.py:262-269}}. After step 1, `model` has seen `branch:to:model` at version 2. In step 3 that channel is at 4, so `model` runs again. A PUSH task has the trigger `__pregel_push`, which is no channel, so `versions_seen` for `tools` stays `{}` in the trace.

One detail explains why the run ends. `branch:to:model` is an `EphemeralValue`. When `model` reads it, the loop clears it and still gives it a new version {{code libs/langgraph/langgraph/pregel/_algo.py:284-292}}. In step 4 its version is 5 and `model` saw 4, but the channel is empty. The plan asks for both a newer version and a value, so no task runs and the loop stops.

## Writes merge in task-path order

`apply_writes` sorts the tasks by their path before it applies anything {{code libs/langgraph/langgraph/pregel/_algo.py:256}}. A reducer then gets the writes in that order, whatever order the tasks finished in.

**We measured** this on the x86 server guest with Qwen3 4B, 3 runs per case. Two parallel nodes, `a` and `b`, each ask the model for an answer and append to one list with `operator.add`. One node asks for 60 words and the other for one word:

```listing
title: six runs, two finish orders, one merge order
source: capture/lab/internals/02-channels/trace.txt
lang: text
note: Each pair is the node and the seconds of its model call, in the order the nodes returned.
---
slow node=a: finish order (node, model seconds)=[('a', 5.58), ('b', 5.75)]  merged list=['a', 'b']
slow node=a: finish order (node, model seconds)=[('b', 0.6), ('a', 5.93)]  merged list=['a', 'b']
slow node=a: finish order (node, model seconds)=[('b', 0.6), ('a', 5.85)]  merged list=['a', 'b']
slow node=b: finish order (node, model seconds)=[('b', 5.48), ('a', 5.62)]  merged list=['a', 'b']
slow node=b: finish order (node, model seconds)=[('b', 5.7), ('a', 5.83)]  merged list=['a', 'b']
slow node=b: finish order (node, model seconds)=[('b', 5.67), ('a', 5.8)]  merged list=['a', 'b']
```

The model calls did not take the time we asked for. One CPU Ollama server answered both nodes, so a short answer could wait behind a long one. `b` returned first in 5 of 6 runs, and the list was `['a', 'b']` in 6 of 6.

PULL paths sort before PUSH paths. The writes of a node that `Command(goto=...)` started by name apply before the writes of the `Send` tasks in the same superstep. In the capture, node `a` asked the model for a city and sent `c` to look up its weather. The planner listed `c` first, and the update applied `b` first:

```listing
title: a PULL task and a PUSH task in one superstep
source: capture/lab/internals/06-send-command/trace.txt
lang: text
---
  PLAN step=2: push c path=('__pregel_push', 0, False) triggers=['__pregel_push'] id=5f91e09b; pull b path=('__pregel_pull', 'b') triggers=['branch:to:b'] id=5bbd9a1a
  UPDATE order=["b@('__pregel_pull', 'b')", "c@('__pregel_push', 0, False)"] -> updated=['results'] versions={'__pregel_tasks': [3, 4], 'branch:to:b': [3, 4], 'results': [3, 4]}
```

[Figure](#fig-2-1b) sets the two orders side by side. So the order of a merged list is stable across runs, and you can test it. It also means a reducer that keeps the last value keeps the value of the task whose path sorts last. The slowest task has no say.

```figure
id: fig-2-1b
kind: comparison
title: the order tasks finish against the order their writes apply
claim: The nodes returned in two different orders over six runs, and their writes applied as a, then b, in all six, because apply_writes sorts by path.
caption: Each row is one run. Left, the nodes in the order they returned, with the seconds of their model call. Right, the order apply_writes used. The last row is one superstep with a PULL task and a PUSH task, and a dashed box is the PUSH task. From capture/lab/internals/02-channels/trace.txt and capture/lab/internals/06-send-command/trace.txt.
```

## What the recursion limit counts

The loop sets `stop` to the current step plus the limit plus one, and fails when the step passes `stop` {{code libs/langgraph/langgraph/pregel/_loop.py:1923}} {{code libs/langgraph/langgraph/pregel/_loop.py:666}}. So the limit counts supersteps, and the hidden `__start__` step is one of them.

**We measured** the count on the x86 server guest with Qwen3 4B, one run per limit. The prompt tells the model to call a tool on every turn:

| `recursion_limit` | supersteps run | model calls before the error |
|---|---|---|
| 1 | 2 | 1 |
| 4 | 5 | 2 |
| 5 | 6 | 3 |
| 10 | 11 | 5 |
| 25 | 26 | 13 |

A limit of k runs k plus one supersteps on new input, and the model runs about k divided by two times. A resume of an interrupted thread with a limit of 4 ran 6 supersteps, steps 2 to 7. `create_agent` sets the limit to 9,999 on its graph {{code libs/langchain_v1/langchain/agents/factory.py:1902}}. A plain `StateGraph` gets 10,007 {{code libs/langgraph/langgraph/_internal/_config.py:42-44}}.

## What to do with this

Write reducers whose result does not depend on order, such as a sum or a set, when the order means nothing. When it means something, depend on the path order and test it, because it is stable. Never use a log of finish times as the order of the state.

Give a key that two parallel nodes write a reducer, even when you expect one writer. [Section 2.2](#s-channels-and-colliding-writes) shows what one missing reducer does to a thread.

Count model calls, not steps, when you set a limit for an agent. For a budget of n model calls, set `recursion_limit` to two times n. Each `before_model` or `after_model` hook node adds one superstep per model call, so add those too.

```takeaways
- Read a trace with versions: a node runs when its trigger is newer than its versions_seen entry.
- Expect parallel writes to merge in task-path order, PULL before PUSH, whatever the finish order.
- Give every key that parallel nodes write a reducer.
- Set recursion_limit to two times the model calls you allow, plus one superstep per hook node per call.
```

Sources: capture/lab/internals/01-superstep/trace.txt, capture/lab/internals/01-superstep/trace.jsonl, capture/lab/internals/01-superstep/run.py, capture/lab/internals/02-channels/trace.txt, capture/lab/internals/06-send-command/trace.txt, capture/lab/internals/07-create-agent/trace.txt, capture/lab/internals/common/instrument.py, capture/lab/internals/common/real.py; libs/langgraph/langgraph/pregel/main.py, libs/langgraph/langgraph/pregel/_loop.py, libs/langgraph/langgraph/pregel/_algo.py, and libs/langgraph/langgraph/_internal/_config.py at langgraph 1.2.22; libs/langchain_v1/langchain/agents/factory.py at langchain==1.5.0.
