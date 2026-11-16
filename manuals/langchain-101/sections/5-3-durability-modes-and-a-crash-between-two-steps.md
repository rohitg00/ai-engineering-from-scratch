# Durability modes, and a crash between two steps

> No durability mode protects a task that just returned, and a model can ask for one charge twice, so key each side effect and check your records first.

Your agent charges a card in a tool, and the process dies a moment later. You start it again and resume the thread. You ran `durability="sync"`, because the docs list it as the most durable mode. The ledger still holds two charges for the order.

When you finish this section, you can say what each durability mode saves and what it waits for. You can predict what a resume runs after a crash, and make a side effect run once.

## Three modes

**Durability mode:** the `durability` argument of `invoke` and `stream`, which decides when the checkpoints of a run are written: `sync`, `async`, or `exit`.

The checkpointers page orders the modes from least to most durable {{docs oss/python/langgraph/checkpointers}}. The code gives `sync` one extra wait, and only one. [Section 2.3](#s-the-checkpoint-write-path-and-durability) traces every saver call of a run. The loop saves the output of each finished task with `put_writes` in the background, in every mode. `sync` then waits for the checkpoint `put` at the end of each step, before it plans the next step.

| Mode | What the loop saves during a run | What it waits for | What a crash repeated in our runs |
|---|---|---|---|
| `exit` | nothing until the run ends, fails, or stops at an interrupt | nothing | the whole run, from the input |
| `async` | each checkpoint and the writes of each task, in the background | nothing | a task that had just returned, and a step after the last saved checkpoint |
| `sync` | the same as `async` | the `put` of each checkpoint, before the next step | a task that had just returned |

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

## A task that just returned

**Side effect:** a change that a node or tool makes outside the graph state, such as a charge or an email. A checkpoint cannot undo it.

The runtime part ran the case that `sync` is meant to cover. Three nodes run in parallel on `SqliteSaver`. `a` asks Qwen3 4B to name a fruit, and `b` calls a weather tool. `c` waits until both have returned, then waits a set time and exits the process. A new process resumes the thread with `invoke(None)`.

**We measured** this on the x86 server guest, 50 trials in each cell, in two runs. The intervals are Wilson 95 percent intervals:

| Mode | Wait before the crash | `a` ran again, run 1 and run 2 | Pooled |
|---|---|---|---|
| `sync` | 0 s | 49 of 50, 48 of 50 | 97 of 100, 0.915 to 0.990 |
| `async` | 0 s | 45 of 50, 50 of 50 | 95 of 100, 0.888 to 0.978 |
| `sync` and `async` | 0.2 s | 0 of 50 in each run | 0 of 200 |
| `exit` | 0 s and 0.2 s | no checkpoint, 100 of 100 | |

The intervals overlap, so `sync` gave no protection over `async` here. `a` returned a few milliseconds before the crash, and its `put_writes` call had not finished. Both modes wait only at the end of the step, and the crash came first. After a wait of 0.2 s, the writes were saved in every trial. Every `exit` trial left no checkpoint, and `invoke(None)` raised `EmptyInputError`.

## A crash at five points in an agent

The lab agent is `create_agent` with Qwen3 4B on Ollama and one tool, `charge(order_id, amount_usd)`. The tool inserts one row into a PostgreSQL ledger table, with autocommit. A driver started the agent in a new process and killed it with SIGKILL at one of five points. Another new process then resumed the thread with `invoke(None)`, or ran the input again when there was no checkpoint. [Figure](#fig-5-3b) shows the five points in one step.

```figure
id: fig-5-3b
kind: sequence
title: the five kill points in the step of the tool
claim: The charge is in the ledger from the second kill point on, and the step is durable only after put returns.
caption: Read the rows from top to bottom. Each rose line is one kill point of the test, at the place in the step where the process died. From capture/lab/T02-crash-resume-x86/t02r_child.py.
```

1. `before_tool`: the tool started, and the charge has not run.
2. `inside_tool`: the charge is committed, and the tool has not returned.
3. `before_put_writes`: the tool returned, and its writes are not saved.
4. `before_put`: the writes were given to the saver, and the checkpoint of the step is not saved.
5. `after_tool`: the next model call is about to start.

**We measured** this on the x86 server guest, with `SqliteSaver` and with `PostgresSaver` on PostgreSQL 16.15. Each cell of mode, saver, and kill point had 20 trials with no key. Of 560 killed trials, 331 charged the order twice. The final state was correct in all of them. Counts per mode, both savers together:

| Kill point | `sync` | `async` | `exit` |
|---|---|---|---|
| `before_tool` | 0 of 40 | 0 of 40 | 0 of 40 |
| `inside_tool` | 40 of 40 | 40 of 40 | 40 of 40 |
| `before_put_writes` | 24 of 40 | 38 of 40 | never reached, 10 trials |
| `before_put` | 20 of 40 | 11 of 40 | 40 of 40 |
| `after_tool` | 0 of 40 | 38 of 40 | 40 of 40 |

```figure
id: fig-5-3
kind: chart
title: crash trials that charged the order twice
claim: Without a key, a kill inside the tool repeated the charge in every mode, and after the tool returned only sync at the next step was safe.
caption: The left panel is the graph on the Mac, with no model, and each dot is one trial. Rose dots wrote twice, teal dots once, and hollow dots were never killed. The right panel is the Qwen3 4B agent on the x86 server guest, with no key. Each bar is 20 trials in the same colours, and the number counts the trials that charged twice. From capture/lab/summary/crash-resume-mac.json and capture/lab/summary/crash-resume-x86.json.
```

Read the table by kill point:

- `inside_tool` repeated the charge in all 120 trials. The tool had no saved result, so the resume ran it again. No durability mode changes this.
- `before_put_writes` is the task that just returned. `sync` repeated it in 24 of 40 trials, on SQLite 8 of 20 and on Postgres 16 of 20. `async` repeated it in 38 of 40.
- `before_put` under `sync` repeated it on both savers, SQLite 12 of 20 and Postgres 8 of 20. The `put_writes` of the tool runs in the background, and it can still be running when `put` starts ([section 2.3](#s-the-checkpoint-write-path-and-durability)).
- `after_tool` is where `sync` helps: 0 of 40 against 38 of 40 under `async`. The checkpoint of the tool step was saved before the next step began.
- `exit` writes no pending writes during the run, so the kill at `before_put_writes` never came. Every other kill after the charge left no checkpoint, and the rerun charged again.

Issue #8039 reports that `sync` does not fix the order of `put_writes` and `put`, so recovery differs between hosts {{issue 8039}}. It is open at the pin. The docs promise of `sync` holds at the step boundary, and our `after_tool` cells confirm it. It says nothing about a crash inside a step.

The Mac ran the same five points on a graph whose node appends one line to a file, with no model. The line was written twice in 80 of 150 trials, with the same shape by kill point. Those rows stay valid. The agent rows of that matrix used a scripted model, and the x86 rows above replace them.

A resume also repeats model calls. A run needs two. Under `sync`, every trial made 2 model calls in all. Under `async`, 77 of 450 trials made 3, because the first model call ran again after a kill at `before_tool`. Under `exit`, 270 of 390 trials made 3 and 90 made 4.

## next is empty, and the run is not done

After a crash, you read the thread and decide if it needs a resume. A natural check is `get_state(config).next`: an empty tuple means the run ended. At the pin, that check is wrong after a crash.

**We measured** this on the same agent matrix on the x86 server guest. After the kill, `next` was `()` in 217 of 1,260 killed trials, and none of those runs had finished. In each of them, `invoke(None, config)` ran the rest of the run and gave the correct final state. 177 of them were under `async`. The other 40 were under `sync` at `before_put`. The Mac graph matrix, with no model, showed it in 31 of 140 killed trials.

Do not decide on `next` alone. Record in your own store that a run started and that it finished, and resume every thread that started and did not finish. A thread with no checkpoint has nothing to resume, so keep the original input in that store and start the run again.

The history after a kill at `before_tool` also differs by mode. Under `sync` it held 3 checkpoints in 90 of 90 trials, and under `async` 2 in 90 of 90. Under `exit` it held none, so the driver had to start the run again from the input. The checkpointers page warns that a thread with no durable checkpoint looks like a thread that was never run {{docs oss/python/langgraph/checkpointers}}.

## The fix: a key on the effect, and a check of your records

**Idempotency key:** a value that names one side effect, so that the effect can check if it already happened and skip itself.

The fault tolerance page says that the key must be durable before the effect runs {{docs oss/python/langgraph/fault-tolerance}}. The lab tool builds one of two keys and writes it in the same statement as the charge. A unique column on the key refuses a second row:

```listing
title: the charge tool with an idempotency key
source: capture/lab/T02-crash-resume-x86/t02r_child.py
lang: python
note: The insert into the attempts table and the branch with no key are cut.
---
    @tool
    def charge(order_id: str, amount_usd: int, runtime: ToolRuntime) -> str:
        """Charge an order. Returns a receipt."""
        signal("before_tool")
        call_id = runtime.tool_call_id
        if A.key == "call_id":
            key = f"{A.thread}:{call_id}"
        elif A.key == "order":
            key = f"{A.thread}:{order_id}"
        else:
            key = None
…
            conn.execute("insert into t02r_ledger(trial, phase, call_id, order_id, amount, t, idem_key) values (%s,%s,%s,%s,%s,%s,%s) on conflict (idem_key) do nothing",
                         (A.trial, A.phase, call_id, str(order_id), amount_usd, time.time(), key))
```

**We measured** both keys on the same matrix on the x86 server guest:

| Key | Killed trials that charged twice | Where |
|---|---|---|
| none | 331 of 560 | every mode, see the table above |
| thread and `tool_call_id` | 120 of 560 | all 120 in `exit`, 0 of 400 in `sync` and `async` |
| thread and order id | 0 of 140 | none, 5 trials per cell |

The `tool_call_id` key failed only in `exit`. There was no checkpoint, so the rerun called the model again, and `ChatOllama` gave the new call a new id. A maintainer suggests the `tool_call_id` key on issue #9185 {{issue 9185}}. It works once the AI message that holds the id is in a checkpoint, which `sync` and `async` gave in every trial here. On the Mac graph with no model, a key on the thread and the node name gave 0 repeats in 150 trials.

For a node in a graph, the task namespace plays the same part. A node reads it as `checkpoint_ns`, in the form `<node>:<task id>`:

```listing
title: reading the task namespace in a node
source: capture/lab/internals/03-checkpoint/crash.py
lang: python
---
        rec["ns"] = get_config()["configurable"]["checkpoint_ns"]
```

In the crash runs of the runtime part, every node that ran again had the namespace of its first run, in `sync` and in `async`. A key built on it would have skipped all 98 repeats of `a`. Under `exit`, a crash leaves nothing to resume, so the ids are new there too.

## A model that asks twice

A key on the call stops the rerun of a call that the checkpoint saved. It cannot stop a second call that the model asked for. The failure drill of [section 8.7](#s-a-failure-drill) asks Qwen3 4B to charge a card once, on `SqliteSaver` with `durability="sync"`, and kills the process inside the tool:

```listing
title: the crash case of the failure drill, first of three runs
source: capture/lab/failure-drill-x86/drill-run1.log
lang: text
---
  symptom   the first process exited with -9 inside charge_card, the resume ran charge_card again: 4 charges
  state     after the resume: next [], 5 messages, charges ['start', 'start', 'resume', 'resume'], last 'Charged'
  fix       check runtime.tool_call_id against the charges before the charge, with durability sync
  after     exit -9, then the resume: 2 charge, next [], last 'Charged'
```

**We measured** it three times on the x86 server guest. The model sent two `charge_card` calls for the one charge in its first reply, in 3 of 3 runs. With no key, the runs charged 4, 4, and 3 times. With the `tool_call_id` key, they charged 2, 2, and 2 times. The key stopped every rerun of a saved call, and it let the second call through.

In the agent matrix, the system prompt said to call the tool once. There the model asked for exactly one call in 1,290 of 1,290 trials. A prompt lowers the rate, and the effect still needs a check.

So key the effect on what it means. Use the order id, or the id of the business record that the effect changes, and leave the thread id out of the key. The same order in a second thread must give the same key. Check your records for that key before the effect, and return the saved result when it is there. With an outside service, send the key with the request, and let the service refuse a second request with the same key.

`AsyncSqliteSaver`, `AsyncPostgresSaver` under a crash, and Agent Server under a crash come in the next edition, as [section 8.8](#s-limits-at-the-pin-and-what-comes-in-the-next-edition) says.

```takeaways
- Expect a node or tool that returned just before a crash to run again, in sync and in async.
- Expect sync to protect the step boundary only, and pass it only with a checkpointer.
- Key each side effect on the business record, such as the order id, and leave the thread id out.
- Use checkpoint_ns or tool_call_id only to spot a replayed call, never to stop a repeated request.
- Check your records before the effect, because a model can ask for one charge twice.
- Do not read an empty next as a finished run after a crash.
- Record run start and end in your own store, and resume every run without an end.
```

Sources: capture/s_persist.py, capture/out/31-durability.txt; capture/lab/internals/03-checkpoint/crash.py, capture/lab/internals/03-checkpoint/crash.txt, capture/lab/internals/03-checkpoint/crash.json, capture/lab/internals/03-checkpoint/taskns.txt, capture/lab/internals/03-checkpoint/taskns.json; capture/lab/summary/crash-resume-x86.json, capture/lab/T02-crash-resume-x86/01-agent-matrix.jsonl, capture/lab/T02-crash-resume-x86/02-agent-matrix-rep5-19.jsonl, capture/lab/T02-crash-resume-x86/09-summary-table.txt, capture/lab/T02-crash-resume-x86/10-summary.txt, capture/lab/T02-crash-resume-x86/t02r_child.py, capture/lab/T02-crash-resume-x86/t02r_drive.py; capture/lab/summary/failure-drill-x86.json, capture/lab/failure-drill-x86/drill-run1.log, capture/lab/failure-drill-x86/drill-run2.log, capture/lab/failure-drill-x86/drill-run3.log, capture/lab/failure-drill-x86/drill_real.py; capture/lab/summary/crash-resume-mac.json, capture/lab/summary/crash-next-mac.json, capture/lab/T02-crash-resume-mac/01-graph-matrix.jsonl, capture/lab/T02-crash-resume-mac/03-graph-idempotent.jsonl, capture/lab/T02-crash-resume-mac/t02_child.py; libs/langgraph/langgraph/pregel/main.py, libs/langgraph/langgraph/pregel/_loop.py, and libs/langgraph/langgraph/types.py at langgraph 1.2.22; docs.langchain.com at docs commit 04d4d4a (oss/python/langgraph/checkpointers, oss/python/langgraph/fault-tolerance, langsmith/agent-server); GitHub issues langchain-ai/langgraph#9267, #8039, #9185.
