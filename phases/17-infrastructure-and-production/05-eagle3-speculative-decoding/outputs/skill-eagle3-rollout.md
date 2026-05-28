---
name: eagle3-rollout
description: production traffic 上で acceptance rate alpha を測定してから出荷する、staged EAGLE-3 speculative-decoding rollout plan を作成する。
version: 1.0.0
phase: 17
lesson: 05
tags: [speculative-decoding, eagle-3, vllm, alpha, production-rollout]
---

target model、hardware (GPU type/count)、traffic description (general chat / code / specialized)、concurrency target、current baseline metrics (TTFT, ITL, throughput) が与えられたら、staged EAGLE-3 rollout plan を作成してください。

生成するもの:

1. Baseline measurement plan。どの benchmark (LLMPerf, GenAI-Perf, production shadow)、どの prompt distribution、どの concurrency point、どの metrics (TTFT mean/P99, ITL mean/P99, throughput, concurrency) を記録するか。
2. Draft-head selection。general chat なら ShareGPT-trained EAGLE-3。specialized traffic (code, medical, legal) なら domain-trained EAGLE-3、または出荷前に training する判断。
3. Config。exact vLLM `speculative_config` fields (method, model, num_speculative_tokens)。v0.18.0 compatibility を note する: draft-model speculation は `--enable-chunked-prefill` と組み合わせられない。V1 の N-gram GPU spec decode が exception。
4. Alpha gate。production concurrency で target alpha >= 0.55。measurement procedure: shadow traffic を 24時間、vLLM `spec_decode_metrics` を log、accepted tokens を requested draft length で割る。任意の 1-hour window で alpha が 0.45 未満なら kill switch。
5. Tail watch。P99 ITL delta (spec on - spec off) を plot。delta が positive なら rejected-draft two-pass pattern が効いています。K を下げるか、その workload では disable してください。
6. Break-even check。reported concurrency で current verify overhead から break-even alpha を計算する。measured alpha が break-even を少なくとも 0.1 上回る場合だけ ship する。

Hard rejects:
- production traffic 上で alpha を測らずに出荷すること。拒否し、24-hour shadow measurement を要求してください。
- measured alpha を naming せずに 2-3x speedup を主張すること。
- latency が constraint ではない offline batch job に speculative decoding を有効化すること。
- vLLM v0.18.0 で draft-model speculation と chunked prefill を組み合わせること。hard incompatibility です。

Refusal rules:
- traffic が primarily very short outputs (mean 50 tokens 未満) の場合は拒否してください。draft overhead が支配するため plain target を出荷します。
- hardware が consumer (RTX 4090 / 5090) で batch size が 8 未満に留まる場合は plain target を推奨してください。verify overhead の batch-amortization にはその hardware では concurrency が足りません。
- measurement loop なしの K auto-tune を求められた場合は拒否してください。K は measured alpha と verify overhead から選びます。measurement を置き換える auto-tune はありません。

Output: 1 page の staged rollout plan。baseline → config → alpha gate → tail watch → break-even confirmation を列挙してください。最後に "what to measure next" paragraph を置き、diagnosis に応じて domain-specific EAGLE-3 training、lower K、plain target への revert のいずれかを naming してください。
