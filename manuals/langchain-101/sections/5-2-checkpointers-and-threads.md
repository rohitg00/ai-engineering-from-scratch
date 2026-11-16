# Checkpointers and threads: short-term memory

> A checkpointer saves the state of a thread after each step, so the next turn on the same `thread_id` starts from the last checkpoint, also after a restart.

You build a chat on `create_agent`, and the user asks "What did I ask you?". The agent has no idea, because each `invoke` started from an empty state. The model is not the cause. The agent keeps nothing between runs unless something saves the state.

When you finish this section, you can give an agent short-term memory, read a checkpoint, and size a Postgres saver for many threads.

## A thread across two turns

**Checkpointer:** an object that saves the graph state after each step and loads the latest checkpoint when the next run starts. `InMemorySaver`, `SqliteSaver`, and `PostgresSaver` are checkpointers.

**Thread:** the series of checkpoints saved under one `thread_id`. A thread is the conversation, and each `invoke` on it is one turn.

The kit runs two turns on the thread `memory-thread`:

```listing
title: two turns on one thread
source: capture/s_persist.py
lang: python
---
def two_turns(cap, checkpointer, name):
    m = llm(name)
    agent = create_agent(m, tools=[add], checkpointer=checkpointer)
    cfg = thread(name)
    agent.invoke(ask("What is 2 + 3?"), cfg)
    out = agent.invoke(ask("What did I ask you?"), cfg)
```

The second turn passed one new message. The model got the whole first turn before it:

```listing
title: what the model received on turn 2
source: capture/out/28-checkpoint-memory.txt
lang: json
---
what the model received on turn 2:
[
  "human: What is 2 + 3?",
  "ai: calls add",
  "tool: 5",
  "ai: 2 + 3 = 5.",
  "human: What did I ask you?"
]
```

Qwen3 4B answered `You asked what 2 + 3 is, and I calculated that it equals 5.`.

So short-term memory is the message list in the checkpoint. The `add_messages` reducer appends the new human message to it, and every model call gets all of it. The cost of a long thread is in [section 5.5](#s-context-engineering-and-summarization).

A run on a checkpointer needs a `thread_id`. Without one, the agent raises before it runs:

```listing
title: a checkpointer with no thread_id
source: capture/out/28-checkpoint-memory.txt
lang: text
---
raised builtins.ValueError: Checkpointer requires one or more of the following 'configurable' keys: thread_id, checkpoint_ns, checkpoint_id
```

A new `thread_id` starts empty. In the kit, a second agent on the same saver with the thread `other-thread` saw only its own question. Asked `What did I ask you?`, the model said that this was their first exchange. `delete_thread("memory-thread")` removed all 8 checkpoints of the first thread.

You do not create a thread first. The first checkpoint creates it. The checkpointers page says that a thread must be created before a run, and that rule belongs to the Agent Server API {{docs oss/python/langgraph/checkpointers}}. This manual records it as conflict D118.

## What a checkpoint holds

**Checkpoint tuple:** what a checkpointer returns for one checkpoint: its `config`, its `metadata`, the `checkpoint` itself, the config of its parent, and its pending writes.

```listing
title: the latest checkpoint of the thread
source: capture/out/28-checkpoint-memory.txt
lang: json
note: The channel versions are cut.
---
{
  "config": {
    "configurable": {
      "thread_id": "memory-thread",
      "checkpoint_ns": "",
      "checkpoint_id": "<uuid-1>"
    }
  },
  "metadata": {
    "source": "loop",
    "step": 6,
    "parents": {},
    "ls_integration": "langchain_create_agent"
  },
  "checkpoint keys": [
    "channel_values",
    "channel_versions",
    "id",
    "ts",
    "updated_channels",
    "v",
    "versions_seen"
  ],
  "channel_values keys": [
    "__pregel_tasks",
    "messages"
  ],
…
  "v": 4
}
```

`channel_values` holds the state: here the `messages` list. `channel_versions` and `versions_seen` tell the loop which nodes have new input, so a resume runs the right node next. `checkpoint_ns` is empty for the top graph and names the parent node inside a subgraph.

## SqliteSaver across a restart

`InMemorySaver` keeps its checkpoints in the process. The persistence page says that they are gone when the process restarts {{docs oss/python/langgraph/persistence}}. Use it for tests. A file or a database keeps a thread across a restart. The kit runs two turns on `SqliteSaver`, closes the connection, then opens the file again with a new agent:

```listing
title: open the file again and continue the thread
source: capture/s_persist.py
lang: python
---
    with SqliteSaver.from_conn_string(path) as saver:
        agent = create_agent(llm("after-restart"), tools=[add], checkpointer=saver)
        out = agent.invoke(ask("Remind me what my first question was."), thread("sqlite-thread"))
```

The third turn got all six earlier messages, and the model answered `Your first question was, "What is 2 + 3?"`. The file has two tables, `checkpoints` and `writes`:

```listing
title: the two tables after three turns
source: capture/out/29-checkpoint-sqlite.txt
lang: text
---
checkpoints: 11 rows, columns ['thread_id', 'checkpoint_ns', 'checkpoint_id', 'parent_checkpoint_id', 'type', 'checkpoint', 'metadata']

writes: 13 rows, columns ['thread_id', 'checkpoint_ns', 'checkpoint_id', 'task_id', 'task_path', 'idx', 'channel', 'type', 'value']
```

**Pending write:** a value that a task wrote during a step, saved in the `writes` table under the checkpoint that the step started from. On a resume, LangGraph applies the pending writes of the last checkpoint and does not run those tasks again.

The loop saves each pending write in the background, as the task finishes, and it does not wait for that call {{code libs/langgraph/langgraph/pregel/_loop.py:523-551}}. So a pending write can reach the saver after the checkpoint of its own step. A trace in [section 2.3](#s-the-checkpoint-write-path-and-durability) shows a model write saved after that checkpoint, on `SqliteSaver` with `durability="sync"`. That order is harmless, because the checkpoint already holds the value. The window that matters comes earlier in a step, and [section 5.3](#s-durability-modes-and-a-crash-between-two-steps) measures it.

Each turn starts with a checkpoint whose `source` is `input`, and the step count goes on across turns. [Figure](#fig-5-2) draws the 11 rows.

```figure
id: fig-5-2
kind: timeline
title: three turns of one thread in the SQLite file
claim: Each turn adds an input checkpoint and then one loop checkpoint per step, and the step numbers keep counting across the turns and the restart.
caption: Read left to right along the step axis. Each mark is one row of the checkpoints table. Amber marks are input checkpoints, teal marks are loop checkpoints. From capture/out/29-checkpoint-sqlite.txt.
```

Every row has the `type` `msgpack`. That is the serializer of the checkpoint, and [section 5.6](#s-serialization-of-state-and-what-does-not-round-trip) shows what it keeps.

## Many threads on one Postgres saver

A server runs many threads at once on one checkpointer. The question is how many connections it needs.

**We measured** this on the x86 server guest, 32 vCPU and 48 GiB, with `AsyncPostgresSaver` on PostgreSQL 16.15 and Qwen3 4B on Ollama on CPU. One asyncio process ran 1, 4, 16, and 64 threads at once, two runs per cell, with one connection and with a pool of 20. Each thread ran two agent runs of two model calls and one tool call. All 680 runs answered right, with 0 errors. The model set the pace, at 0.42 to 0.44 model calls per second in every cell from 4 threads up. So 64 threads of two runs took 587 to 589 s, with one connection and with the pool.

The saver stayed fast at the median. `aput` took 2.8 to 4.5 ms and `aput_writes` 3.7 to 5.8 ms in every cell. At 64 threads, the p99 of `aput` was 318 and 450 ms with one connection, and 254 and 273 ms with the pool. The client measured these times, so they include the wait of the event loop. Keep them as client p99 values, and do not read the gap between the two setups as an effect of the pool. The pool opened up to 21 connections and had at most 3 active at a sample.

```figure
id: fig-5-2b
kind: chart
title: runs per second and checkpoint write p99 on one AsyncPostgresSaver, by threads
claim: One connection and a pool of 20 both give 0.22 runs per second at 64 threads with Qwen3 4B, and the aput p99 does not separate them.
caption: Each dot is one run, two runs per point. Each line joins the means of one connection setup. The left chart gives runs per second, and the right chart gives the p99 of aput in ms on a log scale. The x axis is the number of threads at once, on a log scale. From capture/lab/summary/concurrency-x86-real.json.
```

With a model on CPU, the model limits throughput long before the saver does. Size the pool to the threads that run at once. Our p99 values do not show that the pool lowers the tail of checkpoint writes. A second run on a thread that is still running is a different problem, double texting, and [section 8.1](#s-agent-server-langgraph-dev-up-and-deploy) covers it on Agent Server.

```takeaways
- Pass a checkpointer and the same thread_id on every turn of a conversation.
- Use InMemorySaver in tests only, because a restart loses its threads.
- Start a new thread with a new thread_id, and remove one with delete_thread.
- Read channel_values for the state and metadata step and source for the position in the thread.
- Use a connection pool for AsyncPostgresSaver, and expect the model, not the saver, to limit throughput.
```

Sources: capture/s_persist.py, capture/common.py, capture/out/28-checkpoint-memory.txt, capture/out/29-checkpoint-sqlite.txt; capture/lab/summary/concurrency-x86-real.json, capture/lab/T16-concurrency-x86-real/01-levels.jsonl, capture/lab/T16-concurrency-x86-real/t16r_conc.py, capture/lab/internals/03-checkpoint/trace.txt; libs/langgraph/langgraph/pregel/_loop.py at langgraph 1.2.22; libs/checkpoint/langgraph/checkpoint/base/__init__.py, libs/checkpoint/langgraph/checkpoint/memory/__init__.py, and libs/checkpoint-sqlite/langgraph/checkpoint/sqlite/__init__.py at langgraph 1.2.22; docs.langchain.com at docs commit 04d4d4a (oss/python/langgraph/persistence, oss/python/langgraph/checkpointers, oss/python/langchain/short-term-memory).
