---
name: disaggregation-decider
description: 指定された workload と cluster について、disaggregated prefill/decode（Dynamo または llm-d）を採用すべきか判断する。prefill:decode ratio、KV transfer cost、expected savings を定量化する。
version: 1.0.0
phase: 17
lesson: 17
tags: [disaggregated-serving, dynamo, llm-d, nixl, kv-transfer, prefill-decode]
---

workload profile（prompt/output length distribution、model、concurrency）、cluster topology（GPUs、fabric、RDMA availability）、current serving cost が与えられたら、disaggregation decision を作成する。

作成するもの:

1. Disaggregate? Yes / No を番号付きの根拠とともに示す。baseline: prompts > 512 AND outputs > 200。fabric: RDMA available なら有利。TCP-only では break-even が長くなる。
2. Stack choice. NVIDIA Dynamo（vLLM/SGLang/TRT-LLM の上にある managed orchestrator）または llm-d（Kubernetes-native Services）。operational context に合わせる。
3. Prefill:decode ratio. Dynamo Planner Profiler の readout を使うか、workload shape（prefill TFLOPS vs decode bytes/sec）から計算する。例: RAG-heavy は 2 prefill : 1 decode、output-heavy は 1:2。
4. KV transfer plan. transport を命名する（NIXL over InfiniBand / RDMA / TCP fallback）。prompt P99 に対する per-request transfer tax を計算する。
5. Router integration. Cache-aware router（Phase 17 · 11）を前段に置く必要がある。prefix matching のない disaggregation は cache win を失う。
6. Expected savings. colocated baseline と比較して計算する。published case（same SLA で30-40%）を引用する。

強い拒否条件:
- short-prompt workloads（<512 tokens）の disaggregation。拒否する。transfer tax が支配的。
- cache-aware router なしの deployment。拒否する。blind routing は KV locality を台無しにする。
- topology（rack packing）を無視する。拒否する。multi-rack hop の KV transfer は同一 rack の RDMA より高くつく。

拒否ルール:
- cluster が < 4 GPUs の場合は拒否する。disaggregation が効くほどの pool diversity がない。
- RDMA/InfiniBand がなく計画もない場合、TCP は break-even を prompts >2K へ押し上げると明記し、再評価する。
- team が role ごとの scaling を持つ2つの GPU pool を運用できない場合、llm-d は拒否し、managed alternative として Dynamo を必須にする。

出力: disaggregate Y/N、stack choice、ratio、transport、router、expected savings を含む1ページ decision。最後に検証用の単一 metric を置く: KV transfer P99 latency。計画で指定した threshold 超過を gate にする。
