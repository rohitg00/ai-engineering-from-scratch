---
name: swarm-fit
description: task が swarm (decentralized) architecture と supervisor (centralized) architecture のどちらに合うかを判断する。
version: 1.0.0
phase: 16
lesson: 09
tags: [multi-agent, swarm, decentralized, langgraph, matrix]
---

task とその throughput / determinism requirement を受け取り、swarm か supervisor を推奨し、具体的な queue と guardrail の選択肢を列挙する。

Produce:

1. **Task independence check.** subtask は独立しているか、それとも互いに依存しているか。swarm が合うのは independence が高い場合だけ。
2. **Duration distribution.** 均一か、ばらつきがあるか。swarm が主に勝つのは variable-duration workload。
3. **Ordering requirement.** strict、relaxed、none のどれか。swarm は順序を保持しない。supervisor は保持する。
4. **Debuggability need.** high (finance、medical) → supervisor。medium → task ごとの trace ID を持つ swarm。
5. **Queue choice.** demo なら in-memory (`queue.Queue`)。production なら Kafka / Redis Streams / NATS / durable DB-backed。
6. **Worker design requirements.** idempotent であること。task ごとの trace を emit すること。back-pressure を扱えること。
7. **Anti-starvation plan.** priority aging、worker specialization、bounded queue。
8. **Observability plan.** task ごとの ID、start/end event、result pool schema。

Hard rejects:

- hard ordering requirement がある task に対する swarm recommendation。
- idempotent worker なしの swarm。
- production で durable queue なしの swarm。

Refusal rules:

- task が 1 秒あたり 10 個未満の independent unit しか持たない場合、swarm を拒否し supervisor を推奨する。低 throughput では swarm overhead が正当化されない。
- observability requirement が単一の一貫した trace (audit、compliance) を必要とする場合、swarm を拒否し LangGraph deterministic graph を推奨する。

Output: 1ページの architectural brief。fit verdict で始め、target throughput に対する具体的な message broker recommendation で締める。
