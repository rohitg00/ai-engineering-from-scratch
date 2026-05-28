# Production Scaling — Queues, Checkpoints, Durability

> multi-agent systems を thousands of concurrent runs へ scale するには **durable execution** が必要である。LangGraph runtime は `thread_id` で key された checkpoint を各 super-step 後に書き込む（default は Postgres）。worker crash は lease を release し、別 worker が resume する。agents は human input を待って無期限に sleep できる。**MegaAgent**（arXiv:2408.09955）は per-agent producer-consumer queue を 3 states（Idle / Processing / Response）で走らせ、two-layer coordination（intra-group chat + inter-group admin chat）を使った。LLM streaming では fiber/async が thread-per-job に勝つ。threads は tokens を待つ間 99% idle であるため、fibers は I/O で cooperatively yield する。counterpoint として、Ashpreet Bedi の「Scaling Agentic Software」は load が証明されるまで **FastAPI + Postgres + nothing else** を主張する。simple architectures は予想以上に遠くまで行ける。この lesson では durable checkpoint log、state transitions 付き per-agent work queue、async-vs-thread demo を構築し、pragmatic な「start simple」rule を定着させる。

**種別:** 学習 + 構築
**言語:** Python (stdlib, `asyncio`, `sqlite3`)
**前提条件:** Phase 16 · 09 (Parallel Swarm Networks), Phase 16 · 13 (Shared Memory)
**所要時間:** 約75分

## 問題

prototype multi-agent system は 1 台の laptop、3 agents、in-memory event loop で動く。production に移すと:

- Agents は数時間走ることがある（long research、human-in-the-loop waits）。
- Worker processes が crash する。restart すると state が失われる。
- peak load は average の 10x。horizontal scaling が必要。
- users は agent-run ごとに支払う。charging には exactly-once semantics が必要。

in-memory event loop はこれらのどれも満たさない。下層に durable execution layer が必要である。2026 年の canonical options は:

1. checkpoints を持つ workflow engine（Temporal、LangGraph runtime）。
2. state store を持つ message queue（Postgres + SQS/RabbitMQ）。
3. actor-model frameworks（MegaAgent の per-agent producer-consumer）。
4. hand-rolled FastAPI + Postgres（Bedi の argument）。

この lesson はそれぞれの miniature を作る。

## コンセプト

### Durable execution という pattern

durable-execution engine は各「step」（LangGraph の用語では super-step）の後に full program state を persist する。crash 時:

```
worker crashes mid-step
  -> lease timeout
  -> another worker picks up the thread_id
  -> resumes from last checkpoint
  -> no duplicate side effects
```

これが機能するための requirements:

- **Serializable state。** 全 agent state は persistable でなければならない。live database connections を持つ function closures は survive しない。
- **Deterministic resume。** 同じ state と同じ inputs が与えられたら、agent は同じ actions を生む（または LLM calls について external deterministic oracle に defer する）。
- **Idempotent side effects。** external calls（tool calls、payments）は idempotent であるか deduplication key を使う必要がある。

LangGraph は各 super-step 後に checkpoint を書き、Temporal は各 activity 後に書き、Restate は event-sourced journals を使う。3 つとも同じ pattern を実装している。

### LangGraph runtime

各 agent は `thread_id` を持つ。state は typed dict。各 super-step は checkpoints table に row を書く。resume 時、runtime は最初からではなく last checkpoint から replay する。agents は human input を待つために `interrupt()` でき、runtime は persist して worker を release する。input が来たらどの worker でも resume できる。

これは 2026 年 4 月時点の reference production design である。

### MegaAgent の per-agent queue

arXiv:2408.09955 は scale experiment を記述している。1 cluster 内に thousands of concurrent agents。Architecture:

```
agent i:
  state ∈ {Idle, Processing, Response}
  in_queue   <- messages addressed to agent i
  out_queue  -> replies + side effects

coordinators:
  intra-group chat  (agents in the same group)
  inter-group admin chat  (high-level routing)
```

two-layer coordination により、intra-group conversation は dense に、inter-group は sparse に保てる。これは thousands of agents で cost を linear に保つための pattern である。

### Async vs thread-per-job

LLM calls は I/O-bound である。next token を待つ thread は 99% idle である。threads はそれぞれ約 1MB RAM を消費する。10,000 concurrent calls では stack だけで 10GB になる。

Fibers（Python `asyncio`、Go goroutines、Rust `tokio`）は I/O で cooperatively yield する。同じ 10,000 calls が process 内に無理なく収まる。LLM-agent scale では、async は optimization ではなく architecture である。

例外: CPU-bound post-processing（embedding、tokenizer tricks）は still threads or processes を必要とする。I/O layer と CPU layer を分ける。

### Bedi の counterpoint

「Scaling Agentic Software」（Ashpreet Bedi, 2026）は、多くの teams が measured load を得る前に over-engineer していると主張する。pragmatic default:

- FastAPI + Postgres。
- 各 agent run は row。state は optimistic concurrency で in-place update。
- background jobs は `pg_notify` または simple Celery worker。
- retry policy は application code。

~100 concurrent agent-runs 未満で manageable tasks なら、これだけで十分なことが多い。測定して failure が出たときに upgrade する。

rule: simple architectures が解決できない concrete problem に当たったとき、durable-execution frameworks を採用する。premature adoption は payoff のない ceremonies に時間を燃やす。

### Exactly-once semantics

paid agent runs では「exactly-once effective」（at-least-once delivery + idempotent consumer）が必要である。engineering moves:

- **Dedup key per run。** すべての side-effect call に含める。
- **Outbox pattern。** side effects をまず table に書き、別 process が実行する。両 steps は idempotent。
- **Compensating transactions。** side effect が成功したが tracking write が失敗した場合、compensate を schedule する。

これらは database-engineering patterns であり、LLM-specific ではない。LLM tax は LLM calls が遅いことだけで、他は standard distributed systems である。

### Rainbow deployment

Anthropic の multi-agent research system は「rainbow deployments」を使う。agent runtime の複数 versions を同時に走らせ、long-running agents を code deploy のたびに kill しなくてよいようにする。new versions は traffic の一部で canary し、old versions は agents が終わったら retire する。

これは long-running stateful systems では standard である。2026 年の adaptation は、agents が何時間も生きる可能性があるため、deployment cycles がそれに対応しなければならないという点である。

### canonical production checklist

- Durable state（checkpoints、snapshots、または outbox + replayable log）。
- Idempotent side effects。
- LLM calls 向け async I/O layer。
- dedup 付き at-least-once delivery。
- stateful workloads 向け rainbow/canary deployment。
- Observability: per-agent traces、super-step audit、retry counter。

## 実装

`code/main.py` は次を実装する:

- `CheckpointStore` — SQLite-backed checkpoint log。thread-id keys を持つ。各 super-step が row を append する。
- `run_with_checkpoint(agent, thread_id)` — mid-run crash を simulate し、second worker が last checkpoint から resume する。
- `AgentQueue` — per-agent Idle / Processing / Response state machine と小さな work queue。
- `demo_async_vs_threads()` — 500 concurrent simulated「LLM calls」を asyncio と threads で走らせ、wall-clock と peak memory（近似）を報告する。

Run:

```
python3 code/main.py
```

期待される出力: simulated crash 後に checkpoint resume が成功する。async version は 500 concurrent calls を < 1s で扱う。thread version は数秒かかり、concurrent unit あたり桁違いに多い memory を使う。

## Use It

`outputs/skill-scaling-advisor.md` は durable-execution choice について助言する。FastAPI + Postgres、LangGraph runtime、Temporal、custom のどれを、load、state-retention needs、deploy frequency に応じて選ぶかを calibrate する。

## Ship It

canonical production hardening:

- **Start simple（Bedi's rule）。** FastAPI + Postgres で始め、測定して failure が出るまで維持する。
- **最適化の前にすべて instrument する。** per-run latency histogram、per-step time、retry count、failure categorization。
- **side effects には outbox pattern。** 特に payments と external API calls。
- **Rainbow deploys。** deploy 中に in-flight agent runs を kill しない。
- **durable-execution engines（Temporal / LangGraph / Restate）は、specific problems に当たったとき採用する:** hour-long human-in-the-loop waits、cross-region coordination、complex retry/compensation policies。
- **I/O layer は async。** threads は CPU-bound post-processing だけ。

## Exercises

1. `code/main.py` を実行する。checkpoint resume が動くことを確認し、async vs thread concurrency difference を測る。
2. **outbox** table を実装する。すべての tool call はまず outbox に書き、その後 separate goroutine/task が実行する。tool call を 2 回走らせて idempotency を verify する。
3. **rainbow deploy** を simulate する。2 つの concurrent runtime versions。new thread_ids の半分をそれぞれに route し、old version 上の in-flight threads が interrupt されないことを確認する。
4. 下記の LangGraph runtime doc を読む。hand-rolled FastAPI + Postgres version で再現するのに最も時間がかかる runtime features はどれか。採用理由になるか、それとも defer できるか。
5. MegaAgent（arXiv:2408.09955）Section 3 を読む。two-layer coordination（intra-group + inter-group admin chat）は explicit である。これを 2 つの queue families を持つ message queue にどう map するか sketch する。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Durable execution | 「program state を persist する」 | engine が各 super-step 後に state を書く。crash recovery は deterministic。 |
| Super-step | 「transactional boundary」 | checkpoints 間の work unit。LangGraph term。 |
| thread_id | 「agent run identifier」 | checkpoints と resume logic を bind する key。 |
| Idempotency | 「retry しても安全」 | side effect を繰り返しても 1 回の試行と同じ result になる。 |
| Outbox pattern | 「side effects を decouple する」 | intent を table に書き、separate executor が実行して done にする。 |
| At-least-once delivery | 「duplicates があり得る」 | message queue semantics。dedup key により consumer は effective-once になる。 |
| Rainbow deploy | 「overlapping versions」 | long-running workloads 中に複数 runtime versions が concurrent。 |
| Async fiber | 「cooperative yielding」 | user-mode concurrency。I/O-bound loads では threads より安い。 |
| Checkpoint | 「state snapshot」 | super-step boundary での serialized state。resume の key。 |

## 参考文献

- [LangChain — The runtime behind production deep agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) — LangGraph runtime design
- [MegaAgent](https://arxiv.org/abs/2408.09955) — per-agent producer-consumer queue。thousands of concurrent agents での two-layer coordination
- [Matrix](https://arxiv.org/abs/2511.21686) — coordination substrate として message queues を使う decentralized framework
- [Temporal docs](https://docs.temporal.io/) — durable execution の reference workflow engine
- [Anthropic — Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — rainbow deployment を含む production lessons
