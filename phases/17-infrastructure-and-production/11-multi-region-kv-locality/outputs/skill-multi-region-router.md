---
name: multi-region-router
description: KV-cache locality、residency boundaries、DR manifest、四半期ごとの failover drill を含む multi-region LLM routing plan を設計します。
version: 1.0.0
phase: 17
lesson: 11
tags: [multi-region, kv-cache, routing, dr, bedrock-cri, vllm-router, llm-d, gorgo]
---

Scope 内の regions、residency boundaries、expected prefix-cache diversity、TTFT SLA を受け取り、multi-region routing and DR plan を作成します。

作成するもの:

1. Router choice。Cache-aware router（vLLM Router、llm-d router）を選び、KV-event channel を説明する。Prefix-hash algorithm（例: 512-token rolling）と tie-breaker（least queue depth）を明記する。
2. Routing policy。Regional-first か、prefill + RTT を minimize する global（GORGO-style）か。Prompt-length distribution で正当化する。Long prompts（>8K tokens）は cross-region routing の恩恵があり、short prompts はない。
3. Residency partitioning。最適化の前に、legal reasons（GDPR、HIPAA）でどの requests がどの regions に固定されるかを決める。TTFT が改善しても cross-residency routing を禁止する。
4. Commercial CRI layer。Availability layer として Bedrock Cross-Region Inference または GKE Multi-Cluster Gateway を enable するか推奨する。この layer は TTFT optimization ではないと明確に述べる。
5. DR manifest。Three-file minimum（HF repo + engine config + deployment manifest）。Tokenizer、quantization configs、RoPE、chat templates、LoRA adapters が含まれることを確認する。Storage（S3 cross-region replication、multi-region GCS）を明記する。
6. Failover drill。Quarterly cadence。誰が実行し、何を測るか（RTO、RPO、cache warm-up time）。Target は 2024 年の JPMorgan drill に合わせた 30-minute RTO。

Hard rejects:
- Routing optimization で residency を無視すること。拒否する。GDPR violation は TTFT gain より優先。
- Bedrock CRI が cross-region routing を「解決する」と主張すること。拒否する。CRI は availability であり TTFT ではない。
- Weights だけを backup すること。拒否し、32% DR failure statistic を挙げて three-file manifest を要求する。

Refusal rules:
- Scope が 1 region のみなら plan を断る。Single-region は異なる failure modes であり、Phase 17 · 03 が扱う。
- Residency と TTFT SLA が両立しない場合（例: EU residency により 8K prompts の cold prefix を request ごとに EU で prefill し、P99 TTFT < 100 ms を求める）、SLA を約束することを拒否し、product requirement を escalate する。

Output: router、routing policy、residency partitions、CRI layer posture、DR manifest、quarterly drill owner を示す 1-page plan。最後に alert すべき単一 metric、cross-region prefix-cache hit rate が plan-specified threshold を下回ること、で締めます。
