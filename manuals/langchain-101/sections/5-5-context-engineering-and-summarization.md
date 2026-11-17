# Context engineering and summarization

> A thread grows on every turn, so each model call gets longer and each checkpoint larger, until you trim or summarize the messages and store them as deltas.

Your assistant feels quick in the first hour. After a few dozen turns on one thread, every answer takes longer, the provider bill grows, and the database grows faster than the bill. Nothing failed. The agent sends the whole thread to the model on every call, and the checkpointer saves the whole thread on every step.

When you finish this section, you can choose what the model receives, set a summarization trigger, and predict how a long thread grows.

## What the model receives

**Context engineering:** the choice of what the model receives on each call: which messages, which tools, and which instructions.

**Context window:** the most tokens that a model accepts in one call, input and output together.

[Section 5.2](#s-checkpointers-and-threads) showed that each call gets every message of the thread. The short-term memory page names three ways to keep the list short: trim it, delete messages, and summarize it {{docs oss/python/langchain/short-term-memory}}. Each one must keep the rule of [section 3.4](#s-tools-toolruntime-and-tool-errors): one `ToolMessage` answers each tool call, and no `ToolMessage` stands alone.

## trim_messages

**trim_messages:** a function in `langchain_core.messages` that keeps the first or the last messages of a list up to a token budget. It changes the list that you pass to a model, and it leaves the state as it was.

The kit trims the five messages of [section 3.3](#s-messages-and-content-blocks) to a budget of three. The token counter is `len`, so each message counts as one token:

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
note: The summary is cut after its first section. The ids of the last two messages are cut.
---
  {
    "type": "HumanMessage",
    "content": "Here is a summary of the conversation to date:\n\n## SESSION INTENT  \nCalculate the sum of two numbers provided by the user.…",
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

The agent model then got three messages: the summary, the last answer, and the new question. It called `add` with 1 and 1, and answered `The sum is 2.`.

The summary is a model output, so it can be wrong. The summarizer saw only the five old messages. It wrote that 4 + 5 got no answer, and listed an `add` call for it that never ran. The answer `The sum is 9.` was in the two kept messages, out of its sight. The middleware replaced the messages in the state, so later turns start from the summary.

With no `trigger`, the middleware never summarizes. The built-in middleware page says the same {{docs oss/python/langchain/middleware/built-in}}. In the kit, the model got all seven messages. Set the trigger. The default `keep` is `("messages", 20)`. Part 4 covers `ContextEditingMiddleware`, which clears old tool results in place of a summary.

## A long thread on a real model

**We measured** long threads on the x86 server guest, 32 vCPU and 48 GiB, with `create_agent`, `PostgresSaver` on PostgreSQL 16.15, and default durability. The model was Qwen3 4B on Ollama on CPU, temperature 0, seed 42, with a context of 8192 tokens. The summary model was the same model.

Each variant was one run of 200 turns on one thread. Turns 1 to 5 gave five facts, and the rest cycled through a plain answer, one add call, and two parallel add calls. Every 25 turns, five recall questions about the facts ran on a fork of the thread, so they never entered it. The script gave each variant about 70 minutes.

| Variant | Summaries | Turn p50 without / with a summary call | Largest prompt | Add turns right | Recall of the 5 facts | Thread size |
|---|---|---|---|---|---|---|
| no summarization | 0 | 7.4 s, and 308 to 621 s from turn 88 | 8,191 tokens, the full context | 59 of 59 | 5 of 5 to turn 75, then 0 of 4 after turn 94, and the fifth got HTTP 400 | 20.52 MB at turn 90 |
| `("messages", 60)`, keep 7 | 13 | 5.5 s / 55.2 s | 2,146 tokens | 126 of 130 | 5 of 5 at all 8 probes | 12.42 MB at turn 200 |
| `("tokens", 6000)`, keep 1,500 tokens | 4 | 7.5 s / 108.4 s | 5,985 tokens | 130 of 130 | 5 of 5 to turn 50, 0 of 5 from turn 75 | 38.00 MB at turn 200 |
| `("messages", 20)`, keep 1 | 39 | 5.4 s / 57.3 s | 1,219 tokens | 103 of 130: the sums were right in 129, and the tool was skipped in 26 | 5 of 5 to turn 75, then 4 of 5 without the code word | 6.40 MB at turn 200 |

[Figure](#fig-5-5) shows the median of each block of 25 turns. Without summarization, the median turn grew from 4.7 s in turns 1 to 25 to 11.2 s in turns 51 to 75. At turn 88 the prompt reached the context of 8,192 tokens. From then on, each model call took about 300 s on this CPU, nearly all of it to read the prompt. The turns took 308 to 621 s, and the run stopped at its time limit after turn 94.

Ollama cut the oldest part of the prompt without an error. The answers stayed right. But four recall questions on the last checkpoint all said that the model did not know. The fifth failed with HTTP 400, `request (8192 tokens) exceeds the available context size (8192 tokens)`.

With a trigger, the median turn stayed between 5.4 and 7.5 s. The median turn with a summary call took 55 to 108 s, because the summary is one more model call over the old messages. The summary call alone took 44 to 85 s at the median. LangChain, LangGraph, and Postgres took 18.9 to 24.7 ms of a turn at the median.

A summary can lose facts. The 6,000-token trigger summarized first at turn 65. From turn 75 on, the model knew none of the five facts, in 6 of 6 probes. The 20-message trigger lost the code word from turn 100 on. The 60-message trigger kept all five in all 8 probes. Check what your summary keeps before you trust a trigger.

The tool messages stayed paired in every case. 0 of 1,143 model requests had a `ToolMessage` without its tool call (Qwen3 4B, x86 server guest). Issue #38352 reports such orphans after a summary, and they did not happen in our runs.

```figure
id: fig-5-5
kind: chart
title: turn time over 200 turns on Qwen3 4B, with and without summarization
claim: Without summarization a turn takes 5 to 10 minutes once the context fills at turn 88, and with a trigger block medians stay at 4.4 to 9.2 s.
caption: Each dot is the median turn time of 25 turns in one run, one run per variant. Each open ring is one turn of the run without summarization after its prompt filled the context. The shaded band spans the 10th to the 90th percentile of the same 25 turns. The y axis is on a log scale. From capture/lab/summary/long-threads-x86-real.json.
```

The thread still grew with a summary. Every old checkpoint stays in Postgres, so storage grew in a straight line. With the 60-message trigger, it grew from 5.98 MB at turn 100 to 12.42 MB at turn 200. With the 6,000-token trigger, it grew from 17.58 MB to 38.00 MB. A summary limits what the model gets. It does not limit what the checkpointer keeps.

## Checkpoint growth, and DeltaChannel

A plain message channel saves the whole list in every checkpoint. A thread of n steps then stores about n squared over two messages.

**DeltaChannel:** a channel type in `langgraph.channels.delta` that saves only the new writes of each step, plus a full snapshot. The snapshot comes after `snapshot_frequency` updates to the channel, 100 by default, or after 5,000 steps, whichever is first {{code libs/langgraph/langgraph/channels/delta.py:50-64}}. It is beta at the pin.

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

With `DeltaChannel` and a snapshot every 100 steps, the 5,000-step thread held 81.2 MB. With a snapshot every 1,000, it held 15.7 MB. From 1,000 steps on, the plain thread had the same size on the three savers, within 0.05 percent. [Figure](#fig-5-5b) plots every run.

```figure
id: fig-5-5b
kind: chart
title: storage of one thread by steps, plain and DeltaChannel
claim: A plain message channel stores 7,289 MB after 5,000 steps, and DeltaChannel stores 81 MB with snapshots every 100 steps and 16 MB every 1,000.
caption: Both axes are on a log scale. Each dot is one run on PostgresSaver, three runs at 10 to 1,000 steps and one at 5,000. From capture/lab/summary/checkpoint-cost-x86.json.
```

Write time grew with the plain thread too. The median `put` of the last 10 steps on Postgres went from 2.88 ms at 10 steps to 148.65 ms at 5,000. With either `DeltaChannel` setting it stayed between 1.02 and 1.18 ms.

Reads went the other way. At 1,000 steps on Postgres, `get_state` took 29.28 to 31.8 ms on the plain thread. With `DeltaChannel` it took 43.24 to 65.61 ms, best of three reads in each run. A delta channel rebuilds the list from its writes since the last snapshot. [Section 2.6](#s-checkpoint-growth-and-the-cost-of-a-superstep) found the same direction on a real agent on `SqliteSaver`, at a smaller scale. After 100 round trips, a read took 2.76 ms with `DeltaChannel` against 2.59 ms plain.

The pregel page lists two rules for `DeltaChannel` {{docs oss/python/langgraph/pregel}}. Do not change a persisted channel between delta and plain, because the two encode checkpoints in different ways. Do not move a thread that used `DeltaChannel` back to a LangGraph older than 1.2, because it cannot read the delta format. Issue #7714 measured a token cost of checkpoints, and a maintainer closed it, because checkpoints are not sent to the model {{issue 7714}}. Our numbers agree: the cost of a checkpoint is storage and time, and the cost of the context is tokens.

```takeaways
- Set a trigger on SummarizationMiddleware, because the default never summarizes.
- Trim on whole turns, and check that no ToolMessage starts the list.
- Expect turn time to grow with the thread when nothing limits the context.
- Size the trigger below the context of the model, because a full context is cut silently and then refused.
- Test what a summary keeps with recall questions, because a summary can drop facts.
- Use DeltaChannel for a long message channel, and keep its type for the life of the thread.
- Prune old checkpoints yourself, because a summary does not shrink the checkpointer. With DeltaChannel, keep the snapshot and the writes after it, or save a full snapshot first.
```

Sources: capture/s_start.py, capture/s_middleware.py, capture/out/02-messages.txt, capture/out/10-mw-summarization.txt; capture/lab/summary/long-threads-x86-real.json, capture/lab/summary/checkpoint-cost-x86.json, capture/lab/summary/checkpoint-reads-x86.json, capture/lab/T10-long-threads-x86-real/01-turns-none.jsonl, capture/lab/T10-long-threads-x86-real/01-turns-msgs60_keep7.jsonl, capture/lab/T10-long-threads-x86-real/01-turns-tok6000_keep1500.jsonl, capture/lab/T10-long-threads-x86-real/01-turns-msgs20_keep1.jsonl, capture/lab/T10-long-threads-x86-real/02-none-probe-after-deadline.log, capture/lab/T10-long-threads-x86-real/t10r_long.py, capture/lab/T03-checkpoint-cost-x86/01-steps.jsonl, capture/lab/T03-checkpoint-cost-x86/02-steps-5000.jsonl, capture/lab/T03-checkpoint-cost-x86/t03_ckpt.py; libs/langchain_v1/langchain/agents/middleware/summarization.py and libs/core/langchain_core/messages/utils.py at langchain==1.5.0; libs/langgraph/langgraph/channels/delta.py and libs/langgraph/langgraph/graph/message.py at langgraph 1.2.22; docs.langchain.com at docs commit 04d4d4a (oss/python/langchain/short-term-memory, oss/python/langchain/middleware/built-in, oss/python/langgraph/pregel); GitHub issues langchain-ai/langchain#38352 and langchain-ai/langgraph#7714.
