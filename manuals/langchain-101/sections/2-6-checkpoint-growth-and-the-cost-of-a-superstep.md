# Checkpoint size, DeltaChannel, and the cost of a superstep

> The framework took under half a percent of a real agent's time, while its checkpoints grew to 10 MB in 100 tool calls, so spend your effort on bytes.

Your agent reads a long document page by page, 100 tool calls on one thread. The messages of the whole conversation are about 110 KB. The SQLite file holds 10.1 MB for that one thread. Nobody wrote 10 MB of anything. The saver wrote the conversation again on every superstep.

When you finish this section, you can predict the size of a thread from its step count and its saver. You can also choose between a plain message channel and `DeltaChannel`, and say what the loop itself costs next to the model.

## Every checkpoint holds the whole list

`SqliteSaver.put` serializes the whole checkpoint, with every channel value, into one row {{code libs/checkpoint-sqlite/langgraph/checkpoint/sqlite/__init__.py:433-449}}. It receives `new_versions`, the list of channels that changed, and does not use it.

`InMemorySaver.put` does use it. It stores one blob per changed channel, keyed by the channel and its version {{code libs/checkpoint/langgraph/checkpoint/memory/__init__.py:455-457}}. That saves the channels that did not change. In an agent, `messages` changes on every superstep, so each new blob is the whole list again.

A thread of n supersteps with one message each stores 1, 2, 3, up to n messages. That sum grows with n squared.

**We measured** one `create_agent` run per saver on the x86 server guest with Qwen3 4B and a context of 16,384 tokens. The tool `read_page` returns a page that names the cursor of the next page, so the model must make one call per turn. Each run made 100 tool round trips, 101 model calls, and 203 supersteps, and ended with `DONE`. The model took almost all of the time in each run. We do not use the times, because each saver ran once on a loaded guest:

```listing
title: checkpoint size over 100 real tool round trips
source: capture/lab/internals/09-growth/trace.txt
lang: text
note: The SqliteSaver and InMemorySaver blocks, cut to the size lines.
---
   checkpoint rows=203 total bytes=10132489; row bytes at #1, #50, #100, #150, #200: [689, 25072, 49512, 74045, 98637]; largest 99390; mean 49914
   writes rows=403 bytes=111623 (messages channel 98824); checkpoints + writes = 10244112 bytes; checkpoints / writes = 90.8
…
   InMemorySaver: 203 checkpoints (118969 bytes without channel values); blobs 606 entries, 10002635 bytes, of which messages 9989570 bytes in 202 versions; messages blob at version #1, #50, #100: [861, 24630, 49074], last 98779; writes 111624 bytes
```

The row grew from 689 bytes to 98,637 bytes. The 203 rows held 10,132,489 bytes, and the `writes` table, which holds each message once, held 111,623. So the checkpoints held 90.8 times the bytes of the writes. The blobs of `InMemorySaver` held 10,002,635 bytes, and the `messages` channel was 9,989,570 of them.

## DeltaChannel stores the writes

**DeltaChannel:** a beta channel type that saves only the writes of each superstep, and a full snapshot after a set number of updates. [Section 5.5](#s-context-engineering-and-summarization) measures it over 5,000 steps.

A `DeltaChannel` checkpoint holds no value between snapshots {{code libs/langgraph/langgraph/channels/delta.py:193-202}}. A snapshot comes every `snapshot_frequency` updates, 100 by default {{code libs/langgraph/langgraph/channels/delta.py:74}}, or after 5,000 supersteps {{code libs/langgraph/langgraph/_internal/_config.py:45-47}}. A read rebuilds the list from the last snapshot and the writes after it {{code libs/langgraph/langgraph/pregel/_checkpoint.py:458-499}}.

`create_agent` keeps `messages` in a `BinaryOperatorAggregate`. Its `state_schema` argument takes a subclass of `AgentState`, and the third run used one that swaps the channel:

```listing
title: create_agent with a DeltaChannel message list
source: capture/lab/internals/09-growth/run.py
lang: python
---
class DState(AgentState):
    messages: Annotated[list, DeltaChannel(_messages_delta_reducer)]
…
    kw = {"state_schema": DState} if label == "sqlite-delta" else {}
```

```listing
title: the same 100 round trips with DeltaChannel
source: capture/lab/internals/09-growth/trace.txt
lang: text
note: The sqlite-delta block, cut to the size and read lines.
---
   checkpoint rows=203 total bytes=286606; row bytes at #1, #50, #100, #150, #200: [470, 747, 49515, 750, 98638]; largest 98638; mean 1412
   writes rows=403 bytes=111777 (messages channel 98978); checkpoints + writes = 398383 bytes; checkpoints / writes = 2.6
   get_state at the end, 30 reads after 3 warmups: median 2.76 ms (p10 2.75, p90 2.8); 202 messages
```

The run did the same work: 100 round trips, 101 model calls, and the same last answer. The thread held 398,383 bytes against 10,244,112, about one twenty-sixth. The rows stayed near 750 bytes, except the two snapshots at rows 100 and 200. We read the thread 30 times at the end of each run, and we do not use those times. [Figure](#fig-2-6) plots every row of both runs.

```figure
id: fig-2-6
kind: chart
title: bytes of each checkpoint row, plain messages against DeltaChannel
claim: Plain rows hold the whole list and grow to 99 KB, and DeltaChannel rows stay near 750 bytes except one snapshot per 100 updates.
caption: Each dot is one row of the checkpoints table of one create_agent run of 100 real tool round trips, in order, 203 rows per run. Teal is the plain channel, indigo is DeltaChannel, and the two rings are its snapshot rows. From capture/lab/internals/09-growth/growth.json.
```

The reducer `_messages_delta_reducer` has a private name, and the channel is beta. Section 5.5 lists the rules for changing the channel of a thread that already exists.

## What one superstep costs

**We measured** the time of each part of a run on the x86 server guest with Qwen3 4B. Each run was one `create_agent` run of 10 tool round trips, 22 supersteps, 30 runs per cell after 2 warmups. The framework time is the wall time minus the time inside the Ollama call and inside the tool function:

| Saver and mode | share of wall |
|---|---|
| none, `async` | 0.144 % |
| `InMemorySaver`, `async` | 0.197 % |
| `InMemorySaver`, `sync` | 0.213 % |
| `InMemorySaver`, `exit` | 0.153 % |
| `SqliteSaver`, `async` | 0.245 % |
| `SqliteSaver`, `sync` | 0.449 % |
| `SqliteSaver`, `exit` | 0.190 % |

The guest was loaded, so read the share and the order of the rows, not the milliseconds.

The model filled more than 99.5 percent of each run. The loop functions themselves, planning, applying, and checkpointing, were a small part of the framework time. [Figure](#fig-2-6b) stacks the parts.

```figure
id: fig-2-6b
kind: chart
title: framework time per superstep, by saver and durability mode
claim: LangGraph and LangChain took 0.14 to 0.45 percent of the wall time, and a sync SqliteSaver cost the most.
caption: Each bar is one saver and mode, in milliseconds per superstep, medians of 30 runs of 22 supersteps. Indigo is the loop functions, and grey is the rest of the framework time: node wrappers and saver waits on the loop. The right column is the share of the wall time. The guest was loaded, so read the share and the order of the bars, not the milliseconds. From capture/lab/internals/08-costs/breakdown.json.
```

So the loop is not where an agent spends its time. The cost that grows is the checkpoint bytes, and on a database with many threads those bytes are storage, I/O, and backup.

## What to do

Estimate the bytes of a thread as the bytes of one message, times supersteps squared, divided by two. That gave 9.98 MB for the run above, against 10.13 MB measured. When that number passes what your database should hold per thread, trim or summarize the messages, as section 5.5 shows. Or pass `create_agent` a `state_schema` with a `DeltaChannel` message list, and accept a beta channel.

Do not tune the loop first. Pick `durability` for correctness, as [section 2.3](#s-the-checkpoint-write-path-and-durability) argues. The most costly setup in our runs, `sync` on SQLite, took 0.449 % of the wall time.

```takeaways
- Expect checkpoint bytes to grow with the square of thread length on SqliteSaver and InMemorySaver.
- Watch the row size of the checkpoints table, and alert on it.
- Pass create_agent a state_schema with a DeltaChannel message list for long threads, or trim them.
- Choose durability for correctness, because the framework was under half a percent of the wall time.
```

Sources: capture/lab/internals/09-growth/trace.txt, capture/lab/internals/09-growth/growth.json, capture/lab/internals/09-growth/run.py, capture/lab/internals/08-costs/trace.txt, capture/lab/internals/08-costs/breakdown.json, capture/lab/internals/08-costs/runs.json, capture/lab/internals/08-costs/run.py, capture/lab/internals/common/real.py, capture/lab/internals/common/pager.py; libs/checkpoint-sqlite/langgraph/checkpoint/sqlite/__init__.py at langgraph-checkpoint-sqlite 3.1.3; libs/checkpoint/langgraph/checkpoint/memory/__init__.py at langgraph-checkpoint 4.3.2; libs/langgraph/langgraph/channels/delta.py, libs/langgraph/langgraph/_internal/_config.py, and libs/langgraph/langgraph/pregel/_checkpoint.py at langgraph 1.2.22; libs/langchain_v1/langchain/agents/factory.py at langchain==1.5.0.
