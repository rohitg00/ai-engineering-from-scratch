---
name: scaling-advisor
description: multi-agent production system の durable-execution 選択を助言する。具体的な load と state-retention needs に基づき、FastAPI + Postgres、LangGraph runtime、Temporal、Restate、custom から選ぶ。
version: 1.0.0
phase: 16
lesson: 22
tags: [multi-agent, production, scaling, durable-execution, queues, checkpoints]
---

multi-agent production deployment plan が与えられたら、durable-execution substrate を推奨する。

作成するもの:

1. **Load profile。** concurrent agent-runs（p50, p99）。per-run duration（seconds to hours）。human-in-the-loop wait を必要とする run の割合。deploy frequency。
2. **State profile。** per-run state size（KB to MB）。retention requirement（checkpoint history を何秒分残すか、または full audit log）。determinism: runs は checkpoint から deterministic に replay できるか、それとも logs からのみか。
3. **Side-effect profile。** どの side effects が exactly-once を必要とするか（payments、external APIs、email）。どれが at-least-once を許容できるか（pure tool reads）。exactly-once には outbox pattern が必要。
4. **Recommendation tier。**
   - Tier 1（Bedi's rule）: FastAPI + Postgres。concurrent runs が約 100 未満、duration が 1 時間未満、simple retries。
   - Tier 2: LangGraph runtime または Temporal。hour-long runs、interrupt/resume、structured retries。
   - Tier 3: outbox + event sourcing による custom。specialized needs、high throughput、strict audit。
5. **Deploy model。** single version か rainbow/canary か。long-running stateful workload には rainbow が必要。
6. **Async / thread boundary。** どの部分が async（LLM calls、tool I/O）で、どの部分が threads/processes（CPU-bound post-processing、embedding）か。
7. **Observability。** per-run traces、super-step audit、retry counter。trace storage（checkpoint store とは分ける）。

Hard rejects:

- 10 concurrent-run prototype に Temporal を推奨すること。ceremony cost > value。
- thread-per-job の LLM call architecture。I/O-bound + 1MB/thread は scale しない。
- paid side effects に outbox pattern がない設計。duplicate charges は高くつく。
- multi-hour agent runs に single-version deploy を使うこと。code push のたびに user state が失われる。

Refusal rules:

- load が unknown and untested なら、Tier 1 + load testing を推奨する。premature optimization は時間を燃やす。
- user が tokenized / blockchain-persistent system を望む場合、durable-execution engines は通常それを解決しない（own event sourcing を書く）と伝え、tokenized flows には legal review を推奨する。
- team に on-call engineer がいないなら、Temporal / LangGraph runtime maintenance は人員不足である。on-call が staffed になるまで Tier 1 を推奨する。

Output: 2 ページの brief。1 文の recommendation（「Tier 1 (FastAPI + Postgres + outbox) for current load; escalate to LangGraph runtime when p99 run duration exceeds 10 min or concurrent runs exceed 200.」）から始め、その後に上記 7 sections を続ける。最後に 90-day upgrade path（metrics to watch、threshold for escalation、runbook outline）を書く。
