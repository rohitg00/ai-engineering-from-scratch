# The checkpoint write path: put, put_writes, and durability

> A crash right after a node returned reran it in 97 of 100 sync and 95 of 100 async trials, so key node side effects on the task namespace.

Three nodes run in parallel. One asks the model a question, one calls a weather tool, and one is still working when the process dies. You run `durability="sync"`, because the docs call it the safe mode. You resume the thread, and the model node runs again. Its answer was back, and its side effect, had it had one, would now happen twice.

When you finish this section, you can say which saver call makes each part of a superstep durable, and what a crash repeats. You can also build an idempotency key from the task namespace.

## Two writes for every superstep

**put_writes:** the saver call that stores the writes of one finished task, as rows of the `writes` table. The rows hang on the checkpoint that the superstep started from.

**put:** the saver call that stores one checkpoint, the state after a superstep, as one row of the `checkpoints` table.

When a task finishes, the loop records its writes in memory and submits `put_writes` to a background executor {{code libs/langgraph/langgraph/pregel/_loop.py:523-551}}. By default nothing waits for that future. The `DeltaChannel` writes are the exception: `_checkpointer_put_after_previous` waits for the pending write futures and for the previous put {{code libs/langgraph/langgraph/pregel/_loop.py:1748-1760}}. After the update phase, `_put_checkpoint` builds the checkpoint and submits `put` {{code libs/langgraph/langgraph/pregel/_loop.py:1275-1420}}. With `durability="sync"`, the loop then waits for that one future before it plans the next superstep {{code libs/langgraph/langgraph/pregel/main.py:3103-3105}}. That is all `sync` waits for.

With `durability="exit"`, `put_writes` is never called during the run, and the intermediate `_put_checkpoint` calls skip the saver {{code libs/langgraph/langgraph/pregel/_loop.py:1325-1351}}. The one checkpoint is saved when the run exits {{code libs/langgraph/langgraph/pregel/_loop.py:1543-1553}}.

## The order of the calls, captured

We recorded every saver call of one `create_agent` run on `SqliteSaver`, with Qwen3 4B on the x86 server guest. The model asked for two tool calls and then answered. This is the `sync` run, from the tools step to the end:

```listing
title: saver calls of the tools step and the last model step, durability sync
source: capture/lab/internals/03-checkpoint/trace.txt
lang: text
---
  [ 21] tick step=2 run=['tools', 'tools']
  [ 22]   task done  tools      -> loop.put_writes ['messages', 'branch:to:model']
  [ 23]   task done  tools      -> loop.put_writes ['messages', 'branch:to:model']
  [ 25]   loop._put_checkpoint source=loop exiting=False
  [ 27]     SAVER.put_writes ckpt=..3a2745cf3dd2 task=9360c94c channels=['messages', 'branch:to:model']
  [ 28]     SAVER.put_writes ckpt=..3a2745cf3dd2 task=b0bb9318 channels=['messages', 'branch:to:model']
  [ 29]     SAVER.put id=..0f5fddfed5a3 parent=..3a2745cf3dd2 step=2 source=loop
  [ 31] tick step=3 run=['model']
  [ 32]   task done  model      -> loop.put_writes ['messages']
  [ 34]   loop._put_checkpoint source=loop exiting=False
  [ 36]     SAVER.put id=..930ea1dbdfc0 parent=..0f5fddfed5a3 step=3 source=loop
  [ 39]     SAVER.put_writes ckpt=..0f5fddfed5a3 task=7f67758b channels=['messages']
```

Read lines 34 to 39. The checkpoint of step 3 was stored at line 36, and the loop moved on. The writes of the model task of that step, `7f67758b`, reached the saver at line 39, after the checkpoint that already holds them. Here the order did no harm, because the checkpoint covers the step. It shows that the loop does not wait for `put_writes`, in `sync` too.

The harm comes earlier in a superstep. A task that returned while its siblings still run has only its `put_writes` to keep its output. In one run on a loaded guest, each of the five tasks waited 3.0 to 4.4 ms for that call to finish. [Figure](#fig-2-3) zooms into the end of each superstep.

```figure
id: fig-2-3
kind: timeline
title: how long each finished task waits for its put_writes, in one sync run
claim: In one loaded run, a finished task was not durable for 3.0 to 4.4 ms, and sync waited only for the checkpoint put.
caption: Each panel is the end of one superstep, zoomed to milliseconds after its last task returned. The upper lane is the loop, the lower lane is the background saver. Filled teal blocks are puts, outlined blocks are put_writes calls, and rose bands are the spans before a task is durable. The labels between panels name the next task and how long it took. From capture/lab/internals/03-checkpoint/a_sync.trace.jsonl.
```

The same trace shows a gap at the start. The input checkpoint, step -1, reached the saver at line 9, after the `__start__` task had returned at line 5. So `sync` does not wait for the input checkpoint before the first task. It waits before the first node of your graph.

## A crash between finished tasks and the checkpoint

The test graph runs `a`, `b`, and `c` in parallel, then `d`, on `SqliteSaver`. `a` asks Qwen3 4B to name a fruit, and `b` calls the `get_weather` tool. `c` waits until both have returned, waits a set time, and calls `os._exit(17)`. A new process then resumes the thread with `invoke(None)` and logs each node that runs.

**We measured** this on the x86 server guest, 50 trials in each cell, in two runs. Run 1 is the crash matrix. Run 2 repeats the zero and 0.2 s cells and logs the task namespaces too. The intervals are Wilson 95 percent intervals:

| Mode | Wait before the crash | Run 1: reran `a` | Run 2: reran `a` | Pooled, Wilson 95 percent |
|---|---|---|---|---|
| `sync` | 0 s | 49 of 50 | 48 of 50 | 97 of 100, 0.915 to 0.990 |
| `async` | 0 s | 45 of 50 | 50 of 50 | 95 of 100, 0.888 to 0.978 |
| `sync` | 0.2 s | 0 of 50 | 0 of 50 | 0 of 100 |
| `async` | 0.2 s | 0 of 50 | 0 of 50 | 0 of 100 |
| `exit` | 0 s and 0.2 s | no checkpoint, 100 of 100 | not run | |

`b` never ran again in any trial. The tool returned in milliseconds, so its `put_writes` finished long before the crash. `a` returned last, a few milliseconds before `c` exited, so its writes were still on their way. Every `exit` trial left no checkpoint, and the resume raised `EmptyInputError: Received no input for __start__`. [Figure](#fig-2-3b) plots every trial.

```figure
id: fig-2-3b
kind: chart
title: what the resume ran after a crash in the middle of a superstep
claim: With no wait, the model node that returned last reran in 97 of 100 sync and 95 of 100 async trials, and with 0.2 s in none.
caption: Each dot is one trial, 50 per cell, two runs. Rose dots reran the model node a and the crashed node c, teal dots reran only c, and grey dots had nothing to resume. From capture/lab/internals/03-checkpoint/crash.json and capture/lab/internals/03-checkpoint/taskns.json.
```

The durability mode made no difference at zero wait. The intervals overlap, and run 2 even had more repeats under `async`. Both modes wait at the end of the step, and the crash came before the end. The risk is the window of one `put_writes` call after each task. On `SqliteSaver`, that call took a mean of 4.6 ms under `sync` and 4.2 ms under `async`, on a loaded guest ([section 2.6](#s-checkpoint-growth-and-the-cost-of-a-superstep)). In an agent, a model node often returns while a slower sibling still runs, and that is the window.

## Why a resume finds the right tasks

**Task id:** the id of one task in one superstep. The loop computes it as an `xxh3` hash {{code libs/langgraph/langgraph/pregel/_algo.py:616-623}} {{code libs/langgraph/langgraph/pregel/_algo.py:990-997}}. A PUSH task hashes six values, and a PULL task hashes five fixed values plus its triggers. The values are the checkpoint id, the namespace, the step, the node name, PULL or PUSH, and the triggers or the `Send` index.

The writes of a task are saved under the checkpoint that its superstep started from, with the task id {{code libs/langgraph/langgraph/pregel/_loop.py:523-531}}. A resume loads that checkpoint, plans the same tasks, and gets the same ids. Each task with saved writes gets them back {{code libs/langgraph/langgraph/pregel/_loop.py:841-854}}, and the runner runs only the tasks with no writes {{code libs/langgraph/langgraph/pregel/main.py:3085}}. A task that failed or stopped at an interrupt has no saved output, so it runs again {{code libs/langgraph/langgraph/pregel/_task_status.py:99-129}}.

The checkpoint id itself is a new `uuid6` each time {{code libs/langgraph/langgraph/pregel/_checkpoint.py:334}}. So the task ids repeat only when the start checkpoint was saved. When it is lost, the resume starts from an older checkpoint and makes new ids. That did not happen in any of the 200 trials of run 2. In those trials, the model call in `a` took longer than the `put` of the checkpoint before it.

## The task namespace as an idempotency key

A node can read its task namespace, `<node>:<task id>`, from its config. Run 2 of the crash matrix logged it on the first line of every node:

```listing
title: reading the task namespace in a node
source: capture/lab/internals/03-checkpoint/crash.py
lang: python
---
        rec["ns"] = get_config()["configurable"]["checkpoint_ns"]
```

```listing
title: the namespace in the crashed run against the resume
source: capture/lab/internals/03-checkpoint/taskns.txt
lang: text
note: Cut to the namespace counts of each cell.
---
  durability=sync  wait=0.0s: {"n": 50, "categories": {"a and c": 48, "only c": 2}, … "ns": {"c ns same": 50, "a ns same when a rerun": 48, "a rerun": 48, "b ns same when b rerun": 0, "b rerun": 0}}
  durability=async wait=0.0s: {"n": 50, "categories": {"a and c": 50}, … "ns": {"c ns same": 50, "a ns same when a rerun": 50, "a rerun": 50, "b ns same when b rerun": 0, "b rerun": 0}}
```

Every node that ran again had the namespace of its first run: `c` in 200 of 200 trials, and `a` in 98 of 98 repeats. A side effect keyed on the namespace would have skipped all 98 repeats of `a`. That held in `sync` and in `async`.

So key the side effects of a node on its namespace. Store the key with the effect, as [section 5.3](#s-durability-modes-and-a-crash-between-two-steps) shows, and skip the effect when the key is there. A new turn plans new tasks with new ids, so the same request in a new turn is a new effect. Under `exit`, a crash leaves nothing to resume, so build the key from your own data there.

The namespace holds only while the start checkpoint is saved. When that checkpoint is lost, the replay gets new task ids. Then only a business key that you store, such as an order id, stops a repeated effect.

```takeaways
- Expect a node that returned just before a crash to run again, in sync and in async.
- Key each side effect of a node on checkpoint_ns from get_config, and store the key with the effect.
- Choose sync or async for other reasons, because neither protects a task that returned in the last milliseconds.
- Start a crashed exit-mode thread again from its input, because invoke(None) raises EmptyInputError.
```

Sources: capture/lab/internals/03-checkpoint/trace.txt, capture/lab/internals/03-checkpoint/run.py, capture/lab/internals/03-checkpoint/a_sync.trace.jsonl, capture/lab/internals/03-checkpoint/a_async.trace.jsonl, capture/lab/internals/03-checkpoint/a_exit.trace.jsonl, capture/lab/internals/03-checkpoint/crash.py, capture/lab/internals/03-checkpoint/crash.txt, capture/lab/internals/03-checkpoint/crash.json, capture/lab/internals/03-checkpoint/taskns.txt, capture/lab/internals/03-checkpoint/taskns.json, capture/lab/internals/08-costs/trace.txt; libs/langgraph/langgraph/pregel/_loop.py, libs/langgraph/langgraph/pregel/main.py, libs/langgraph/langgraph/pregel/_algo.py, libs/langgraph/langgraph/pregel/_task_status.py, and libs/langgraph/langgraph/pregel/_checkpoint.py at langgraph 1.2.22.
