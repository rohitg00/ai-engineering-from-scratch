---
name: inference-server
description: EAGLE-3 または P-EAGLE draft、K8s autoscaling、完全な throughput/latency/cost report を備えた speculative-decoding inference server を ship する。
version: 1.0.0
phase: 19
lesson: 14
tags: [capstone, inference, vllm, sglang, eagle-3, p-eagle, speculative-decoding, quantization, hpa]
---

2 つの open target model (Llama 3.3 70B と Qwen3-Coder-30B MoE または GPT-OSS-120B) を対象に、speculative decoding、quantization、Kubernetes autoscaling を備えた production serving stack を ship する。Measured speedup と tail-latency number を公開する。

Build plan:

1. Target model を vLLM 0.7 (または SGLang 0.4) の下で FP8 Marlin quantization 付きで deploy する。
2. Red Hat Speculators から aligned EAGLE-3 draft を load する (または SpecForge で学習する)。
3. Baseline numbers: speculation なしで batch 1/8/32 の tokens/s と p50/p99 latency。
4. EAGLE-3 を有効化し、同じ benchmark を再実行する。Speedup、acceptance rate、p99 tail-latency delta を報告する。
5. P-EAGLE parallel speculation を有効化し、deeper tree が効く/悪化する inflection を報告する。
6. ShareGPT、HumanEval、domain data の distribution 横断で benchmark を実行する。Acceptance-rate drift を公開する。
7. 2 つ目の target model (MoE) で繰り返し、draft acceptance に対する routing-noise sensitivity を特定する。
8. `queue_wait_ms` を追跡する HPA 付きで Kubernetes に deploy する。Load が 3 倍になったときの scale-out を demonstrate する。
9. Matched eval 上で Anthropic Claude Sonnet 4.7 と OpenAI GPT-5.4 に対する $/1M tokens を比較する。

Assessment rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | Measured speedup vs baseline | 両 model で matched quality のまま 2.5x+ throughput |
| 20 | Acceptance rate on realistic traffic | Distribution ごとの acceptance-rate report |
| 20 | P99 tail-latency discipline | Speculation あり/なしの batch 1/8/32 p99 |
| 20 | Ops | K8s deploy、queue-wait HPA、smooth rollout、drain-first upgrade |
| 15 | Write-up and methodology | Metric derivation と matched baseline が明確 |

Hard rejects:

- Tail latency なしで steady-state throughput だけを報告すること。
- Queue-wait ではなく CPU で HPA すること。GPU saturation 下では thrash する。
- Draft-target version alignment を無視すること。Drifted draft は no speculation より高くつく。
- Hosted API の prompt-caching discount を省いた cost comparison。

Refusal rules:

- Rollout drain なしでは serve しない。In-flight request 中の in-place upgrade は失格。
- Distribution をまたいで aggregate した acceptance rate を報告しない。Per-distribution が必須。
- Matched non-speculative number なしで bs=32 における speculative-decoding の勝利を主張しない。

Output: vLLM / SGLang configs、EAGLE-3 draft download script、K8s deployment manifests、queue-wait HPA config、ShareGPT / HumanEval / domain data 用 benchmark harness、$/1M tokens comparison table、speculative decoding が導入した tail-latency regression top 3 と、それぞれを直した mitigation (batch gating、ngram fallback、quantization tweak) を記した write-up を含む repo。
