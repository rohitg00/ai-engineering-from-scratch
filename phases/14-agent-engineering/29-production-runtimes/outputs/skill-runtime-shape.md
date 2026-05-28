---
name: runtime-shape
description: production runtime shape (request-response, streaming, queue, event, cron, durable) を選び、observability を接続する。
version: 1.0.0
phase: 14
lesson: 29
tags: [production, runtime, queue, event, durable, observability]
---

task class (expected duration、step count、trigger type、latency budget) が与えられたら、runtime shape を選ぶ。

判断:

1. < 30s で user が待つ -> **request-response**。
2. Progressive UX または voice -> **streaming**。
3. minutes to hours で user が待たない -> **queue-based**。
4. external events に反応する -> **event-driven**。
5. periodic housekeeping -> **cron**。
6. restart cost が高い上記いずれか -> **durable execution** を追加する。

生成するもの:

1. 自分の stack における shape scaffold。
2. Observability: OTel GenAI spans (Lesson 23)、backend wired (Lesson 24)。
3. queue 向け: DLQ + retry policy + queue depth metric。
4. event 向け: explicit subscriber registry + replay path。
5. cron 向け: overlapping runs を防ぐ lock file または distributed lock。
6. durable 向け: checkpointer backend + resume semantics。

強い却下条件:

- 5 分 task に synchronous HTTP を使うこと。users は切断し、workers は積み上がる。
- DLQ のない queue-based。failed jobs が消える。
- trace export のない background work。users が苦情を言うまで failures が見えない。
- 「durable state なしで retry すればよい」。long horizons は checkpoint しなければならない。

拒否ルール:

- product に SLA + replay requirements があるなら、swarm topology + non-durable runtime を拒否する。
- task が compliance-bound なら、audit trail のない event-driven を拒否する。
- user が cron + no lock を望むなら拒否する。overlapping cron runs は、良くても duplicate work、悪ければ data corruption である。

出力: runtime scaffold + observability hooks + SLA、retry policy、checkpointer choice を含む README。最後に substrate として Lesson 23 (OTel)、Lesson 24 (observability)、または hosted long-running 向け Lesson 17 (Managed Agents) を指す "what to read next" で締める。
