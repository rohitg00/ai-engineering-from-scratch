# Workers, the advisory lock, and the cost of a conversation

> With a real model the ceiling is the model server, so add workers for availability, take the thread lock in Postgres, and price a conversation from measured token counts.

Traffic doubles, and you start a second uvicorn worker. Two requests for the same thread now reach two processes. An in-process lock no longer stops them, and both runs write to one checkpoint chain. The second question is what the extra worker buys you, and what each conversation costs.

When you finish this section, you can run several workers with one Postgres lock per thread. You can find the resource that limits throughput, and estimate the price of 1,000 conversations from token counts that you measured.

## One run per thread, across processes

**Advisory lock:** a Postgres lock on a number that your code chooses, held by a session and released when the session ends. The service hashes the thread id into that number with `hashtextextended`.

```listing
title: the thread lock: a Postgres advisory lock on one dedicated connection
source: capture/lab/prodapp-mac/code/app/locks.py
lang: python
---
KEY = "select {fn}(hashtextextended(%s, 0))"
…
    async def acquire(self, thread_id):
        if thread_id in self.held:
            return False
        self.held.add(thread_id)
        if await self.call("pg_try_advisory_lock", thread_id):
            return True
        self.held.discard(thread_id)
        return False
```

Three choices in that class matter.

- Each worker holds its locks on one connection of its own, outside the pool. With locks on pool connections, 20 runs would hold all 20 connections. Their checkpoint writes would then wait for a 21st connection.
- An advisory lock is reentrant inside one session, so a second request in the same worker would get the lock again. The `held` set refuses it first.
- When a worker dies, Postgres ends its session and frees its locks. No lease or timer is needed.

**We measured** the race test on the Mac in each of the six Qwen runs of the suite, three per model. It starts two uvicorn processes, A and B, on one database. The result was the same in 6 of 6 runs.

- One run to A and one to B on the same thread, at once: one 200, one 409, and one human message.
- Two runs sent to A on the same thread: one 200 and one 409.
- A run sent to B while A held the thread: 409.
- A killed with SIGKILL while it held the thread, then a run sent to B: 200. The lock was free as soon as the process died.

## Where the ceiling is

**We measured** the service under load on the Mac with Qwen3 4B, one run of each cell. Each user had one thread and sent four requests in order. They were an order question, a FAQ question, a refund with the amount and the reason, and the approval. All users started at once. The load generator ran on the same Mac with a read timeout of 120 s, and each worker had a pool of 20 connections. Requests went to the workers in turn.

As a baseline, one user alone ran 5 sessions of 4 requests. A run took a median of 3.0 s, and the user finished 0.269 runs each second. Leaked test servers held 66 Postgres connections during this baseline, so treat it as a rough reference.

| Workers | Users at once | Requests | Client timeouts | 409 on approve | Runs each second | Median s per run | 95th percentile s | Postgres connections, max |
|---|---|---|---|---|---|---|---|---|
| 1 | 10 | 40 | 0 | 2 | 0.259 | 36.0 | 51.1 | 11 |
| 2 | 10 | 40 | 0 | 2 | 0.242 | 38.3 | 48.6 | 15 |
| 4 | 10 | 40 | 0 | 2 | 0.258 | 35.6 | 46.7 | 26 |
| 1 | 50 | 157 | 48 | 2 | 0.208 | 164.7 | 192.5 | 22 |
| 2 | 50 | 163 | 46 | 4 | 0.216 | 152.5 | 188.7 | 35 |
| 4 | 50 | 159 | 49 | 1 | 0.220 | 145.6 | 181.4 | 48 |

[Figure 9.7](#fig-9-7) puts the three measurements side by side.

```figure
id: fig-9-7
kind: chart
title: workers against the model server, Qwen3 4B on the Mac
claim: More uvicorn workers did not raise throughput, because every run waited for the one Ollama server.
caption: The left panel is runs finished each second, by workers. The middle panel is seconds per run, with a dot at the median and a bar to the 95th percentile. The right panel is Ollama alone, with 1 to 8 requests at once. From capture/lab/prodapp-mac/summary/load-mac.json.
```

Throughput did not move. Ten users finished 0.242 to 0.259 runs each second, and fifty users 0.208 to 0.220, with 1, 2, or 4 workers. One user alone finished 0.269. Every extra user only waited longer. A median run took 3.0 s alone, 36 to 38 s with ten users, and 146 to 165 s with fifty.

The wait was in front of the model. In a probe of Ollama alone, eight requests sent at once came back one after another, about one second apart. One request alone produced 45 to 50 output tokens each second. With 4 or 8 requests at once, all of them together produced 17 to 20. Each of those requests reported 0.45 to 1.34 s of `load_duration`, against 0.13 s alone. We did not find the cause of that drop.

Postgres was far from its limit. The busiest cell had 48 connections, with 4 workers, and each run wrote about 20 KB of checkpoint rows.

Fifty users broke the clients first. In each 50-user cell, 46 to 49 of the 50 sessions ended with `ReadTimeout`. The stream sent no byte for 120 s while the run waited for the model.

The runs did not stop with them. In the 1-worker cell the server ended 107 runs as `done`, 29 as `interrupted`, and 19 as `cancelled` at shutdown. The clients saw 102 `done` and 5 `interrupted`. With an SSE comment line every 15 s, the same 1-worker cell lost no session. It had 0 read timeouts in 200 requests, at 0.231 runs each second. [Section 9.1](#s-the-run-endpoint-and-its-stream) has that run and its code.

**Our position:** on one model server, extra uvicorn workers buy you availability and nothing else. Measure the model server alone before you size the service, and add model capacity for throughput. The 409 column is the model again: in each cell 1 to 4 users got no refund proposal, so their approve had nothing to resume.

## The cost of a conversation

A price per conversation needs three numbers: the model calls in a conversation, the input tokens, and the output tokens. Each must come from the provider usage of every call, as [section 9.4](#s-opentelemetry-spans-with-langsmith-off) showed. The spans missed a fifth of the input tokens there.

**We measured** the 20 evals on the Mac, with token counts from a callback on every model call. Claude Haiku 5.5 ran once. The Qwen rows are the first run of each model. The Qwen3 4B row counts only calls inside spans, because its usage log was not on yet. Case 9 calls no model, so each row has 19 conversations.

| Model | Model calls per conversation, median and max | Input tokens, median and mean | Output tokens, median and mean | Model seconds per conversation, median |
|---|---|---|---|---|
| Claude Haiku 5.5 | 2, 14 | 1,989, 4,004 | 214, 394 | 4.01 |
| Qwen3 14B | 2, 12 | 992, 1,799 | 60, 113 | 12.97 |
| Qwen3 4B, spans only | 2, 8 | 1,166, 1,344 | 50, 66 | 1.26 |

The counts differ by tokenizer as well as by behaviour. The first model call of one FAQ question had 912 input tokens on Claude Haiku 5.5. It had 557 on Qwen3 4B and 454 on Qwen3 14B. The two Qwen models share a tokenizer, so the gap between them is their chat templates.

The whole Haiku suite used 64 calls, 76,076 input tokens, and 7,493 output tokens. At the list price that was $0.011353. That is the money that left. The price of 1,000 such conversations follows from the per-conversation counts and the list prices of 2026-11-14, standard tier, no caching.

| Model | $ per MTok, input and output | $ per 1,000 conversations | The costliest conversation |
|---|---|---|---|
| Claude Haiku 5.5 | 0.10, 0.50 | 0.61 | $0.0028 |
| Claude Haiku 4.5 | 1.00, 5.00 | 6.06 | $0.0276 |
| Claude Sonnet 5.5 | 2.00, 10.00 | 12.11 | $0.0552 |
| Claude Sonnet 4.6 | 3.00, 15.00 | 18.17 | $0.0829 |
| Claude Opus 5.5 | 4.00, 20.00 | 24.22 | $0.1105 |

Only the first row is measured. The others put Haiku 5.5 counts at other prices. Another model makes other calls, and the pricing page says that Sonnet 4.6 and earlier use an older tokenizer that gives about 30% fewer tokens. Read those rows as estimates. The mean includes the runaway and the six-turn thread, which are the two costliest conversations. Your traffic sets the mix.

For the local models the price is the machine. Qwen3 14B spent a median of 12.97 s of model time per conversation, and Qwen3 4B 1.26 s. The load test above shows how many of those the Mac serves at once.

```takeaways
- Take the thread lock with pg_try_advisory_lock on one dedicated connection per worker.
- Add workers for availability, and measure the model server before you add more.
- Size the Postgres pool and max_connections for one lock connection plus the pool, per worker.
- Send a heartbeat on the stream, so queued clients do not hit their read timeout.
- Count tokens from the provider usage of every call, including summarizer calls.
- Price conversations from measured counts, and treat a price per run on another tokenizer as an estimate.
```

Sources: capture/lab/prodapp-mac/code/app/locks.py, capture/lab/prodapp-mac/code/app/server.py, capture/lab/prodapp-mac/code/load/loadtest.py, capture/lab/prodapp-mac/code/scripts/ollama_parallel.py, capture/lab/prodapp-mac/code/scripts/cost_real.py, capture/lab/prodapp-mac/code/cost/prices.json, capture/lab/prodapp-mac/code/tests/test_workers.py, capture/lab/prodapp-mac/summary/load-mac.json, capture/lab/prodapp-mac/summary/cost-mac.json, capture/lab/prodapp-mac/summary/evals-mac.json, capture/lab/prodapp-mac/runs/load/load-summary.json, capture/lab/prodapp-mac/runs/load/ollama-parallel.json, capture/lab/prodapp-mac/summary/fix-mac.json, capture/lab/prodapp-mac/runs/fix/load/load-summary.json; the Anthropic pricing page, fetched 2026-11-14.
