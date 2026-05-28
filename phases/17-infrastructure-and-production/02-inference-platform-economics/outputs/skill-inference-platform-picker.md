---
name: inference-platform-picker
description: workload、SLA、budget、operational constraints に基づき、inference platform（Fireworks、Together、Baseten、Modal、Replicate、Anyscale、または custom silicon）を選ぶ。per-token、per-minute、per-prediction pricing を正規化する。
version: 1.0.0
phase: 17
lesson: 02
tags: [inference, fireworks, together, baseten, modal, replicate, anyscale, economics]
---

workload profile（model、tokens/day、sustained utilization、TTFT SLA、burst factor、compliance、Python vs mixed stack）を受け取り、platform recommendation を作成する。

作成するもの:

1. Primary platform。platform と specific pricing tier（serverless vs dedicated vs batch）を示す。workload characteristics との一致で正当化する。例: "Fireworks serverless because TTFT < 500 ms is the SLA and the traffic is bursty."
2. Effective cost。選んだ pricing model を $/M output tokens に正規化する。少なくとも2つの alternative と比較する。per-minute が per-token に勝つ場合（sustained utilization 約30%超）またはその逆を明示する。
3. Cold-start plan。serverless picks（Fireworks、Modal、Replicate）では expected cold-start latency と mitigation（pre-warming、min_workers=1、live-migration）を示す。dedicated picks（Baseten、Anyscale）ではこの section を省き、trade-off を記す。
4. Runner-up。2番手の platform と、switch する explicit condition を示す（例: "move to Baseten if we close an enterprise deal requiring HIPAA + dedicated GPUs"）。
5. Gateway layer。provider churn から product を隔離するために AI gateway（LiteLLM、Portkey、Kong AI Gateway）を前段に置くべきか推奨する。default: scale が 500 RPS 未満でない限り yes。

Hard rejects:
- 正規化せずに per-token と per-minute を比較すること。拒否し、effective $/M tokens を要求する。
- published benchmarks に対して TTFT SLA を検証せず、"fastest" という理由で Fireworks を選ぶこと。
- latency-bound でない workload に custom silicon（Groq、Cerebras、SambaNova）を推奨すること。premium price であり、interactive SLA でしか正当化できない。

Refusal rules:
- workload が regulated framework（SOC 2 Type II、HIPAA）を必要とし、customer が Modal または Replicate を選んだ場合は拒否する。Baseten や Anyscale と同じ enterprise footprint はない。Baseten を提案する。
- expected traffic が 100k tokens/day 未満なら、per-minute（Baseten、Modal、Anyscale）を推奨しない。economics が成立しないため、marketplace（OpenRouter、DeepInfra）または managed hyperscaler を default にする。
- customer が「cheapest」を望む場合は拒否する。multi-dimensional cost function（token rate + cold start + attribution + gateway + DX）を名前で挙げる。

Output: primary platform、effective cost、cold-start plan、runner-up、gateway posture を含む1ページの recommendation。最後に、mis-pick を明らかにする単一 metric（cold-start P99、per-token rate、utilization drift）で締める。
