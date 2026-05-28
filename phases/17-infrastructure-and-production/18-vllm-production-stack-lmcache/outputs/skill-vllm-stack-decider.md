---
name: vllm-stack-decider
description: workload と fleet size から、vLLM deployment layout (production-stack Helm chart, KV offload, router/observability integration) を決める。
version: 1.0.0
phase: 17
lesson: 18
tags: [vllm, production-stack, lmcache, kv-offload, connector-api]
---

workload (prompt shape、concurrency、prefix reuse pattern)、fleet (engines、GPU type)、operational context (Kubernetes-native、multi-tenant、budget) が与えられたら、vLLM stack plan を作成してください。

作成するもの:

1. Stack。vLLM production-stack Helm chart を使う (new deployment では推奨) か、roll your own かを決める。適用する operators/CRDs を示す。
2. KV offload。次から選ぶ:
   - None (short prompts, low concurrency — overhead が benefit を上回る)。
   - Native vLLM CPU offload (single-engine HBM pressure、simple)。
   - LMCache connector (multi-engine prefix reuse、preemption-heavy、multi-tenant shared prompts)。
3. HBM utilization monitoring。headroom つきで `--gpu-memory-utilization` を設定する。pre-preemption signal として sustained 92%+ で alert。
4. Router integration。Cache-aware router (Phase 17 · 11)。KV-event channel が configured であることを確認する。
5. Observability。engine ごとの Prometheus scrape、OTel GenAI attributes (Phase 17 · 13)、production-stack の Grafana dashboard template。
6. Expected impact。current と比べた expected throughput gain を定量化する。16x H100 benchmark shape (KV footprint が HBM を超えると LMCache が効く) を参照する。

強い拒否条件:
- shared prefixes や preemption がない deployment に LMCache を入れること。overhead だけで benefit がないため拒否。
- HBM-pressure monitoring なしで vLLM を運用すること。最初の preemption が 予期せぬ障害になります。
- Helm chart が use case を cover するのに production-stack を hand-roll すること。再発明コストが高いです。

拒否ルール:
- fleet が <2 engines の場合、LMCache を拒否してください。cross-engine reuse が目的なので single-engine は native を使います。
- workload が prompts < 1K tokens かつ < 100 concurrency の場合、どの offload も拒否してください。HBM headroom で十分です。
- team に K8s capability がない場合、production-stack を拒否してください。single-engine vLLM + simple proxy から始めます。

出力: stack、KV offload choice、HBM monitoring、router integration、observability、expected impact を含む1ページ plan。最後に single gate を置く: last 24h の HBM utilization P99。
