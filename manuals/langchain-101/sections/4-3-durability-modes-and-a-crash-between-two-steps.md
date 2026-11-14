# Durability modes, and a crash between two steps

> The durability mode decides when checkpoints reach the saver, and in every mode a crash can run a side effect twice unless the effect checks a durable key.

Your agent charges a card in a tool, and the process dies a moment later. You start it again and resume the thread. Did the card get charged once or twice? The answer depends on where the process died, on the durability mode, and on the saver.

When you finish this section, you can choose a durability mode, predict what a resume runs after a crash, and make a side effect safe.

## Three modes

**Durability mode:** the `durability` argument of `invoke` and `stream`, which decides when the checkpoints of a run are written: `sync`, `async`, or `exit`.

The checkpointers page orders the modes from least to most durable {{docs oss/python/langgraph/checkpointers}}:

| Mode | When checkpoints are written | What a crash loses |
|---|---|---|
| `exit` | only when the run ends, fails, or stops at an interrupt | every step of the run |
| `async` | in the background, while the next step runs | the steps whose writes had not finished |
| `sync` | before the next step starts | at most the step that was running |

The default is `async` in the code {{code libs/langgraph/langgraph/pregel/main.py}}. The checkpointers page does not say which mode is the default, and the Agent Server pages say `async` {{docs langsmith/agent-server}}. This manual records the gap as conflict D119.

The kit runs a graph with two nodes on `InMemorySaver` in each mode, and counts the checkpoints:

```listing
title: checkpoints saved in each mode
source: capture/out/31-durability.txt
lang: text
---
durability=sync: result {'n': 2}, 4 checkpoints, steps [2, 1, 0, -1]

durability=async: result {'n': 2}, 4 checkpoints, steps [2, 1, 0, -1]

durability=exit: result {'n': 2}, 1 checkpoints, steps [2]
```

`exit` saves only the last checkpoint, so a thread run in `exit` mode has no history to go back to.

## sync with no checkpointer

With no checkpointer, every mode warns that it has no effect. `async` and `exit` then run. `sync` raises, in `invoke` and in `stream`:

```listing
title: durability="sync" with no checkpointer
source: capture/out/31-durability.txt
lang: text
---
durability=sync invoke: raised AttributeError: 'SyncPregelLoop' object has no attribute '_put_checkpoint_fut'
  warning: `durability` has no effect when no checkpointer is present.
```

The loop waits on a checkpoint write that it never started {{code libs/langgraph/langgraph/pregel/main.py}}. This is issue #9267, open at the pin, and this manual records it as conflict D6. Pass `durability="sync"` only to a graph with a checkpointer. The old `checkpoint_during` argument still works, and it warns `LangGraphDeprecatedSinceV10`.

## A crash at five points

**Side effect:** a change that a node or tool makes outside the graph state, such as a charge or an email. A checkpoint cannot undo it.

The lab graph has three nodes, `prepare`, `effect`, and `finish`. The `effect` node appends one line to a file and calls `fsync`, so the line is on disk before the node returns. A test driver started the graph in a new process and killed it with SIGKILL at one of five points. It then resumed the thread in another new process with `invoke(None, config)`. [Figure](#fig-4-3b) shows the five points in one step.

```figure
id: fig-4-3b
kind: sequence
title: the five kill points in the step of the effect node
claim: The side effect is on disk from the second kill point on, and the step is durable only after put returns.
caption: Read the rows from top to bottom. Each rose line is one kill point of the test, at the place in the step where the process died. From capture/lab/T02-crash-resume-mac/t02_child.py.
```

1. `before_tool`: the node started, and the effect has not run.
2. `inside_tool`: the effect is on disk, and the node has not returned.
3. `before_put_writes`: the node returned, and its writes are not saved.
4. `before_put`: the writes are saved, and the checkpoint of the step is not.
5. `after_tool`: the next node, `finish`, is running.

An agent version used `create_agent` with a scripted fake model and one tool that appends the line. The kill points are the same, with the tool in place of the node.

**We measured** this on the Mac, Apple M1 Max with 10 cores and 64 GiB. We ran three modes, two savers, and five kill points, five trials in each cell, with `SqliteSaver` and `PostgresSaver` on PostgreSQL 14. The line was written twice in 80 of 150 graph trials and in 82 of 150 agent trials. The final state was correct in all 300. [Figure](#fig-4-3) shows every trial.

```figure
id: fig-4-3
kind: chart
title: crash trials that ran the side effect twice
claim: A kill inside the effect repeated it in every mode, and only sync with a kill after the step was safe on both savers.
caption: Each dot is one trial, five in each cell. Rose dots ran the side effect twice, teal dots once, and hollow dots were never killed. The left panel is the graph, the right panel is the agent. From capture/lab/summary/crash-resume-mac.json.
```

Read the figure by kill point:

- `inside_tool` repeated the effect in all 60 trials. The node had no saved result, so the resume ran it again. No durability mode changes this.
- `after_tool` under `sync` repeated it in 0 of 20 trials. Under `async` and `exit` it repeated it in most trials, because the step of the effect was not saved yet.
- `before_put` under `sync` depended on the saver: 0 of 5 graph trials on SQLite, 4 of 5 on Postgres. The pending writes were saved, and the resume still ran the node again on Postgres.
- `before_put_writes` under `sync` repeated it in 1 of 5 graph trials on SQLite and 5 of 5 on Postgres.
- In `exit` mode the run never wrote pending writes during the run, so the kill at `before_put_writes` never came. Those 20 trials ran once.

Issue #8039 reports that `sync` does not fix the order of `put_writes` and `put`, so recovery differs between hosts {{issue 8039}}. It is open at the pin, and our `before_put` cells show it on two savers on one machine. The docs promise of `sync`, that each checkpoint is written before the next step, holds at the step boundary. It says nothing about a crash inside a step.

The agent repeated model calls too. A trial needs two model calls, and the agent made up to four after a resume. Each repeated model call costs tokens.

## next is empty, and the run is not done

After a crash, you read the thread and decide if it needs a resume. A natural check is `get_state(config).next`: an empty tuple means the run ended. At the pin, that check is wrong after a crash.

**We measured** this on the same matrix on the Mac. After the crash, `next` was `()` in 31 of 140 killed graph trials and 32 of 140 killed agent trials. None of those runs had finished. In each of them, `invoke(None, config)` ran the rest of the run and gave the correct final state. Most of these trials were in `async` mode. The rest were under `sync` at `before_put`, on both savers.

Do not decide on `next` alone. Record in your own store that a run started and that it finished, and resume every thread that started and did not finish.

The history after a kill at `before_tool` also differs by mode. Under `sync` it held 3 checkpoints, steps `-1`, `0`, and `1`. Under `async` it held 0 to 3. Under `exit` it held none, so the driver had to start the run again from the input. The checkpointers page warns that a thread with no durable checkpoint looks like a thread that was never run {{docs oss/python/langgraph/checkpointers}}.

## The fix: an idempotency key

**Idempotency key:** a value that names one side effect, so that the effect can check if it already happened and skip itself.

The fault tolerance page says that the key must be durable before the effect runs {{docs oss/python/langgraph/fault-tolerance}}. In the lab graph, the key is the thread id and the node name. The node writes the key on the same line as the effect:

```listing
title: the effect node with an idempotency key
source: capture/lab/T02-crash-resume-mac/t02_child.py
lang: python
---
    def effect(s):
        signal("before_tool")
        key = f"{A.thread}:effect"
        if A.idem and sink_has(key):
            pass
        else:
            append_sink(f"{key}\t{A.phase}\t{time.time_ns()}")
        signal("inside_tool")
        return {"log": ["effect"]}
```

**We measured** the same 150 graph trials on the Mac with the key on. The line was written twice in 0 of 150 trials, and the final state was correct in all of them. The check and the write are one line in one file here, so the key and the effect become durable together. With an outside service, send the key with the request, and let the service refuse a second request with the same key.

In a tool, the `tool_call_id` from `ToolRuntime` works as a key once the AI message that holds it is in a durable checkpoint. A maintainer suggests this key on issue #9185 {{issue 9185}}. When the crash comes before that checkpoint, the model runs again, and a real model returns a new id.

Our agent matrix ran without a key. [Section 8.3](#s-an-assistant-with-memory-and-approvals-that-survives-a-restart) records one trial of an agent with this key in each of two durability modes, so n is 1 for each. The key kept the outbox at one email after a crash. The full crash matrix with a key comes in the next edition, as [section 7.6](#s-limits-at-the-pin-and-what-comes-in-the-next-edition) says. `AsyncSqliteSaver`, `AsyncPostgresSaver` under a crash, and Agent Server under a crash come in the next edition too.

```takeaways
- Use durability="sync" when a crash must lose at most the running step, and only with a checkpointer.
- Expect a node or tool that was running at a crash to run again on the resume.
- Give every side effect an idempotency key that is durable before the effect runs.
- Use the tool_call_id as the key of a tool, with sync, so its AI message is saved first.
- Do not read an empty next as a finished run after a crash.
- Record run start and end in your own store, and resume every run without an end.
```

Sources: capture/s_persist.py, capture/out/31-durability.txt; capture/lab/summary/crash-resume-mac.json, capture/lab/summary/crash-next-mac.json, capture/lab/T02-crash-resume-mac/01-graph-matrix.jsonl, capture/lab/T02-crash-resume-mac/02-agent-matrix.jsonl, capture/lab/T02-crash-resume-mac/03-graph-idempotent.jsonl, capture/lab/T02-crash-resume-mac/t02_child.py; libs/langgraph/langgraph/pregel/main.py, libs/langgraph/langgraph/pregel/_loop.py, and libs/langgraph/langgraph/types.py at langgraph 1.2.22; docs.langchain.com at docs commit 04d4d4a (oss/python/langgraph/checkpointers, oss/python/langgraph/fault-tolerance, langsmith/agent-server); GitHub issues langchain-ai/langgraph#9267, #8039, #9185, #9240.
