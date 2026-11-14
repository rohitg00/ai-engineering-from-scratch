# Context engineering and summarization

> A thread grows on every turn, so each model call gets longer and each checkpoint larger, until you trim or summarize the messages and store them as deltas.

Your assistant feels quick in the first hour. After a few hundred turns on one thread, every answer takes longer, the provider bill grows, and the database grows faster than the bill. Nothing failed. The agent sends the whole thread to the model on every call, and the checkpointer saves the whole thread on every step.

When you finish this section, you can choose what the model receives, set a summarization trigger, and predict how a long thread grows.

## What the model receives

**Context engineering:** the choice of what the model receives on each call: which messages, which tools, and which instructions.

**Context window:** the most tokens that a model accepts in one call, input and output together.

[Section 4.2](#s-checkpointers-and-threads) showed that each call gets every message of the thread. The short-term memory page names three ways to keep the list short: trim it, delete messages, and summarize it {{docs oss/python/langchain/short-term-memory}}. Each one must keep the rule of [section 2.4](#s-tools-toolruntime-and-tool-errors): one `ToolMessage` answers each tool call, and no `ToolMessage` stands alone.

## trim_messages

**trim_messages:** a function in `langchain_core.messages` that keeps the first or the last messages of a list up to a token budget. It changes the list that you pass to a model, and it leaves the state as it was.

The kit trims the five messages of [section 2.3](#s-messages-and-content-blocks) to a budget of three. The token counter is `len`, so each message counts as one token:

```listing
title: trim_messages keeps the last three messages
source: capture/out/02-messages.txt
lang: json
note: The usage numbers are cut.
---
max_tokens=3, token_counter=len:
[
  {
    "type": "SystemMessage",
    "content": "You are terse."
  },
  {
    "type": "ToolMessage",
    "content": "5",
    "name": "add",
    "tool_call_id": "call_1",
    "status": "success"
  },
  {
    "type": "AIMessage",
    "content": "The sum is 5.",
…
]
```

The result keeps the `ToolMessage` of `call_1` and drops the AI message that made the call. Most providers reject such a request. With `start_on="human"`, the trim drops messages until it finds a human message. The last two messages hold none, so only the system message was left. Trim on whole turns, and check the first message after the system message.

## SummarizationMiddleware

**Summary message:** a human message that `SummarizationMiddleware` writes in place of old messages. It starts with `Here is a summary of the conversation to date:` and carries `lc_source` `summarization`.

`SummarizationMiddleware` calls a second model to summarize the old messages when a trigger fires, and keeps the newest ones. The kit sets `trigger=("messages", 6)` and `keep=("messages", 2)`, and sends seven messages:

```listing
title: the state after the summary
source: capture/out/10-mw-summarization.txt
lang: json
note: The ids of the last two messages are cut.
---
  {
    "type": "HumanMessage",
    "content": "Here is a summary of the conversation to date:\n\nThe user asked to add numbers; the tool returned 5 and 9.",
    "id": "<uuid-1>",
    "additional_kwargs": {
      "lc_source": "summarization"
    }
  },
  {
    "type": "AIMessage",
    "content": "The sum is 9.",
…
  {
    "type": "HumanMessage",
    "content": "Now 1 + 1?",
```

The agent model then got three messages: the summary, the last answer, and the new question. The middleware replaced the messages in the state, so later turns start from the summary.

With no `trigger`, the middleware never summarizes. The built-in middleware page says the same {{docs oss/python/langchain/middleware/built-in}}. In the kit, the model got all seven messages. Set the trigger. The default `keep` is `("messages", 20)`. Part 3 covers `ContextEditingMiddleware`, which clears old tool results in place of a summary.

## A thread of 2,000 turns

**We measured** long threads on the x86 server guest, 32 vCPU and 48 GiB, with `create_agent`, `PostgresSaver` on PostgreSQL 16.15, and default durability. The model was a fake with no delay, so each time is the time of LangChain, LangGraph, and Postgres. Each variant was one run of 2,000 turns on one thread, 3,334 model calls. The turns cycled through a plain answer, one tool call, and two parallel tool calls.

| Variant | Summaries | Turn p50, turns 1 to 100 | Turn p50, turns 1,901 to 2,000 | Largest request | Thread at turn 2,000 |
|---|---|---|---|---|---|
| no summarization | 0 | 36.9 ms | 662.9 ms | 7,334 messages | 7,957.86 MB |
| `("messages", 60)`, keep 7 | 140 | 36.2 ms | 36.6 ms | 59 messages | 92.55 MB |
| `("tokens", 6000)`, keep 1,500 tokens | 60 | 63.2 ms | 42.9 ms | 166 messages | 240.98 MB |
| `("messages", 20)`, keep 1 | 399 | 32.1 ms | 32.3 ms | 19 messages | 43.83 MB |

[Figure 4.5](#fig-4-5) shows the median of each block of 100 turns. Without summarization, the turn time grew in a straight line with the thread. The largest request had about 269,000 tokens by the count of the run. With any trigger, the turn time stayed flat. The tool messages stayed paired in every case: 0 of 13,336 model requests had a `ToolMessage` without its tool call. Issue #38352 reports such orphans after a summary, and they did not happen in our runs.

```figure
id: fig-4-5
kind: chart
title: turn time over 2,000 turns, with and without summarization
claim: Without summarization the median turn grows from 37 ms to 663 ms, and with any trigger it stays near 40 ms.
caption: Each dot is the median turn time of 100 turns in one run, one run per variant. The x axis is the turn number. From capture/lab/summary/long-threads-x86.json.
```

The thread still grew with a summary. Every old checkpoint stays in Postgres, so storage grew in a straight line. With the 60-message trigger, it grew from 4.49 MB at turn 100 to 92.55 MB at turn 2,000. A summary limits what the model gets. It does not limit what the checkpointer keeps.

## Checkpoint growth, and DeltaChannel

A plain message channel saves the whole list in every checkpoint. A thread of n steps then stores about n squared over two messages.

**DeltaChannel:** a channel type in `langgraph.channels.delta` that saves only the new writes of each step, plus a full snapshot every `snapshot_frequency` steps. It is beta at the pin.

The lab graph declares its message channel in three ways:

```listing
title: a plain channel and two DeltaChannel settings
source: capture/lab/T03-checkpoint-cost-x86/t03_ckpt.py
lang: python
---
    if mode == "plain":
        ann = add_messages
    elif mode == "delta100":
        ann = DeltaChannel(_messages_delta_reducer, snapshot_frequency=100)
    else:
        ann = DeltaChannel(_messages_delta_reducer, snapshot_frequency=1000)

    class S(TypedDict):
        messages: Annotated[list, ann]
        n: int
```

`_messages_delta_reducer` is the delta form of `add_messages` in `langgraph.graph.message`. Its name starts with `_`, so it is private at the pin.

**We measured** checkpoint cost on the x86 server guest with `durability="sync"`, one 400-character message per step, and one thread per run. We ran 3 runs at 10, 100, and 1,000 steps and 1 run at 5,000, for `InMemorySaver`, `SqliteSaver`, and `PostgresSaver`. On Postgres, a plain thread held 0.05 MB at 10 steps and 3.08 MB at 100. It held 292.58 MB at 1,000 steps and 7,289.37 MB at 5,000.

With `DeltaChannel` and a snapshot every 100 steps, the 5,000-step thread held 81.2 MB. With a snapshot every 1,000, it held 15.7 MB. The plain thread had the same size on the three savers, within 0.1 percent. [Figure 4.5b](#fig-4-5b) plots every run.

```figure
id: fig-4-5b
kind: chart
title: storage of one thread by steps, plain and DeltaChannel
claim: A plain message channel stores 7,289 MB after 5,000 steps, and DeltaChannel stores 81 MB with snapshots every 100 steps and 16 MB every 1,000.
caption: Both axes are on a log scale. Each dot is one run on PostgresSaver, three runs at 10 to 1,000 steps and one at 5,000. From capture/lab/summary/checkpoint-cost-x86.json.
```

Write time grew with the plain thread too. The median `put` of the last 10 steps on Postgres went from 2.88 ms at 10 steps to 148.65 ms at 5,000. With either `DeltaChannel` setting it stayed between 1.02 and 1.18 ms.

Reads went the other way. At 1,000 steps on Postgres, `get_state` took 29.28 to 31.8 ms on the plain thread. With `DeltaChannel` it took 43.24 to 65.61 ms, best of three reads in each run. A delta channel rebuilds the list from its writes since the last snapshot.

The pregel page lists two rules for `DeltaChannel` {{docs oss/python/langgraph/pregel}}. Do not change a persisted channel between delta and plain, because the two encode checkpoints in different ways. Do not move a thread that used `DeltaChannel` back to a LangGraph older than 1.2, because it cannot read the delta format. Issue #7714 measured a token cost of checkpoints, and a maintainer closed it, because checkpoints are not sent to the model {{issue 7714}}. Our numbers agree: the cost of a checkpoint is storage and time, and the cost of the context is tokens.

```takeaways
- Set a trigger on SummarizationMiddleware, because the default never summarizes.
- Trim on whole turns, and check that no ToolMessage starts the list.
- Expect turn time to grow with the thread when nothing limits the context.
- Use DeltaChannel for a long message channel, and keep its type for the life of the thread.
- Delete old checkpoints yourself, because a summary does not shrink the checkpointer.
```

Sources: capture/s_start.py, capture/s_middleware.py, capture/out/02-messages.txt, capture/out/10-mw-summarization.txt; capture/lab/summary/long-threads-x86.json, capture/lab/summary/checkpoint-cost-x86.json, capture/lab/summary/checkpoint-reads-x86.json, capture/lab/T10-long-threads-x86/01-turns-none.jsonl, capture/lab/T10-long-threads-x86/01-turns-msgs60_keep7.jsonl, capture/lab/T10-long-threads-x86/01-turns-tok6000_keep1500.jsonl, capture/lab/T10-long-threads-x86/01-turns-msgs20_keep1.jsonl, capture/lab/T03-checkpoint-cost-x86/01-steps.jsonl, capture/lab/T03-checkpoint-cost-x86/02-steps-5000.jsonl, capture/lab/T03-checkpoint-cost-x86/t03_ckpt.py; libs/langchain_v1/langchain/agents/middleware/summarization.py and libs/core/langchain_core/messages/utils.py at langchain==1.5.0; libs/langgraph/langgraph/channels/delta.py and libs/langgraph/langgraph/graph/message.py at langgraph 1.2.22; docs.langchain.com at docs commit 04d4d4a (oss/python/langchain/short-term-memory, oss/python/langchain/middleware/built-in, oss/python/langgraph/pregel); GitHub issues langchain-ai/langchain#38352 and langchain-ai/langgraph#7714.
