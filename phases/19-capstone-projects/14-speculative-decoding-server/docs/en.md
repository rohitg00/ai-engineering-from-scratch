# キャップストーン 14 — Speculative-Decoding Inference Server

> vLLM 0.7 の EAGLE-3 は real traffic で 2.5-3x throughput を出す。P-EAGLE (AWS 2026) は parallel speculation をさらに進めた。SGLang の SpecForge は draft head を大規模に学習した。Red Hat の Speculators hub は一般的な open model 向けの aligned draft を公開した。TensorRT-LLM は NVIDIA 上で speculative decoding を first-class にした。2026 年の production serving stack は、EAGLE-family draft を持つ vLLM または SGLang、FP8 または INT4 quantization、queue-wait に基づく HPA である。この capstone では、2 つの open model を baseline throughput の 2.5x+ で serve し、完全な tail-latency report を出す。

**種類:** Capstone
**言語:** Python (serving)、C++ / CUDA (kernel inspection)、YAML (configs)
**前提:** Phase 3 (deep learning)、Phase 7 (transformers)、Phase 10 (LLMs from scratch)、Phase 17 (infrastructure)
**演習対象フェーズ:** P3 · P7 · P10 · P17
**時間:** 30 時間

## 問題

Speculative decoding は 2026 年に commodity になった。EAGLE-3 draft head は target model の hidden state で学習し、N token 先を予測する。Target model はそれを single pass で verify する。Acceptance rate 60-80% は end-to-end throughput 2-3x に変換される。vLLM 0.7 はこれを native に統合している。SGLang + SpecForge は training pipeline を提供する。Red Hat の Speculators は Llama 3.3 70B、Qwen3-Coder-30B MoE、GPT-OSS-120B 向けの aligned draft を公開している。

技術の勘所は model そのものではなく serving operations にある。Acceptance rate は traffic distribution (ShareGPT、code、domain data) によって drift する。Rejection 時の tail latency は speculation なしより悪くなる。したがって steady-state tokens/sec だけではなく、複数の batch size における p99 を報告しなければならない。Anthropic / OpenAI API と比較した $/1M tokens が credibility lever になる。

## コンセプト

Speculative decoding には 2 つの層がある。**Draft** model (EAGLE-3 head、ngram、または小さな target-aligned model) が step ごとに k 個の candidate token を提案する。**Target** model は k 個すべてを 1 pass で verify する。Accepted prefix は greedy path を置き換える。Acceptance rate は draft-target alignment と input distribution に依存する。

EAGLE-3 は多くの traffic で ngram draft より強い。P-EAGLE はより深い draft tree に対して parallel speculation を行う。Trade-off は、verify pass が大きくなるため rejection 時の P99 latency が高くなることだ。この影響を見えるようにするため、serving config は batch-size-bucketed latency を報告しなければならない。

Deployment は Kubernetes で行う。vLLM 0.7 は GPU または tensor-parallel shard ごとに 1 replica で動かす。HPA は CPU ではなく queue-wait で autoscale する。FP8 (Marlin) と INT4 (AWQ) quant は GPU memory を H100 / H200 の envelope 内に収める。End-to-end report は throughput、acceptance rate、batch 1/8/32 の p50/p99、$/1M tokens である。

## アーキテクチャ

```
request ingress
    |
    v
vLLM server (0.7) or SGLang (0.4)
    |
    +-- draft: EAGLE-3 heads | P-EAGLE parallel | ngram fallback
    +-- target: Llama 3.3 70B | Qwen3-Coder-30B | GPT-OSS-120B
    |     quantized FP8-Marlin or INT4-AWQ
    |
    v
verify pass: batch k draft tokens through target
    |
    v (accept prefix; resample for rejected suffix)
    v
token stream back to client
    |
    v
Prometheus metrics: throughput, acceptance rate, queue wait, latency p50/p99
    |
    v
HPA on queue-wait metric
```

## スタック

- Serving: vLLM 0.7 または SGLang 0.4
- Speculative methods: EAGLE-3 draft heads、P-EAGLE parallel speculation、ngram fallback
- Draft training: SpecForge (SGLang) または Red Hat Speculators
- Target models: Llama 3.3 70B、Qwen3-Coder-30B MoE、GPT-OSS-120B
- Quantization: FP8 (Marlin)、INT4 AWQ
- Deployment: Kubernetes + NVIDIA device plugin、queue-wait metric による HPA
- Eval: ShareGPT、MT-Bench-v2、GSM8K、HumanEval による domain-spread acceptance measurement
- Reference: Vendor baseline としての TensorRT-LLM speculative decoding

## 実装

1. **Target model prep.** Llama 3.3 70B を選ぶ。Marlin で FP8 quantize する。vLLM 0.7 の下で 1xH100 (または 2x tensor-parallel) に deploy する。

2. **Draft source.** Red Hat Speculators から aligned EAGLE-3 draft head を pull する (または SpecForge で学習する)。vLLM の speculative-decoding config に load する。

3. **Baseline numbers.** Speculation 前に、batch 1/8/32 の tokens/s、p50/p99 latency、GPU utilization を測定して公開する。

4. **Enable EAGLE-3.** Config を flip し、同じ benchmark を再実行する。Speedup、acceptance rate、p99 tail-latency delta を報告する。

5. **P-EAGLE.** Parallel speculation を有効にし、deeper draft tree と serial EAGLE-3 を比較する。P-EAGLE が効く点と悪化する点の inflection を報告する。

6. **Domain traffic.** 同じ server に ShareGPT、HumanEval、domain-specific traffic を流す。Distribution ごとに acceptance rate を測る。Draft が drift する条件を特定する。

7. **Second target model.** 同じ pipeline を Qwen3-Coder-30B MoE に対して実行する。MoE routing noise により draft は難しくなる。結果を報告する。

8. **K8s HPA.** `queue_wait_ms` を追跡する HPA 付きで K8s に deploy する。Load が 3 倍になったときの scale-out を実演する。

9. **Cost comparison.** 同じ eval 上で Anthropic Claude Sonnet 4.7 と OpenAI GPT-5.4 に対する $/1M tokens を計算して公開する。

## 使ってみる

```
$ curl https://infer.example.com/v1/chat/completions -d '{"messages":[...]}'
[serve]     vLLM 0.7, Llama 3.3 70B FP8, EAGLE-3 active
[decode]    bs=8, accepted_tokens_per_step=3.2, acceptance_rate=0.76
[latency]   first-token 42ms, full-response 980ms (620 tokens)
[cost]      $0.34 per 1M output tokens at sustained throughput
```

## Ship It

`outputs/skill-inference-server.md` が提出物を説明する。Speculative decoding を備えた measured serving stack、完全な benchmark report、K8s deployment。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Measured speedup vs baseline | 2 つの model で matched quality のまま 2.5x+ throughput |
| 20 | Acceptance rate on realistic traffic | Distribution ごとの acceptance-rate report |
| 20 | P99 tail-latency discipline | Speculation あり/なしの batch 1/8/32 p99 |
| 20 | Ops | K8s deploy、queue-wait HPA、smooth rollout |
| 15 | Write-up and methodology | 何が変わり、なぜ変わったかの明確な説明 |
| **100** | | |

## 演習

1. Draft が target より 1 version 古い場合 (例: Llama 3.3 -> 3.4 drift) に acceptance-rate degradation を測る。Monitoring alert を作る。

2. ngram-fallback を実装する: EAGLE-3 acceptance が threshold を下回ったら ngram draft に切り替える。Reliability improvement を報告する。

3. Controlled MoE experiment を行う: 同じ Qwen3-Coder-30B に routing noise を注入した場合としない場合を比較する。Draft acceptance sensitivity を測る。

4. H200 (141 GB) に拡張する。Model-size-per-replica の headroom がどれだけ増えたか、unquantized Llama 3.3 70B を serve できるかを報告する。

5. 同じ H100 hardware 上で TensorRT-LLM speculative decoding を benchmark する。vLLM に対してどこで勝つかを報告する。

## 重要用語

| Term | よくある言い方 | 実際の意味 |
|------|-----------------|------------|
| Draft model | "Speculator" | Target が verify する N token を提案する小さな model |
| EAGLE-3 | "2026 draft architecture" | Target hidden state で学習した draft head。Acceptance は約 75% |
| P-EAGLE | "Parallel speculation" | 1 target pass で verify される draft branch の tree |
| Acceptance rate | "Hit rate" | Resampling なしで accept された drafted token の割合 |
| Quantization | "FP8 / INT4" | GPU memory により多くの model を収めるための lower-precision weights |
| Queue wait | "HPA metric" | Inference 開始前に request が pending queue で待つ時間 |
| Speculators hub | "Aligned drafts" | 一般的な open model 用 EAGLE draft を集めた Red Hat Neural Magic hub |

## 参考資料

- [vLLM EAGLE and P-EAGLE documentation](https://docs.vllm.ai) — reference serving stack
- [P-EAGLE (AWS 2026)](https://aws.amazon.com/blogs/machine-learning/p-eagle-faster-llm-inference-with-parallel-speculative-decoding-in-vllm/) — parallel speculative decoding paper + integration
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) — draft-head training pipeline
- [Red Hat Speculators](https://github.com/neuralmagic/speculators) — aligned draft hub
- [TensorRT-LLM speculative decoding](https://nvidia.github.io/TensorRT-LLM/) — vendor alternative
- [Fireworks.ai serving architecture](https://fireworks.ai/blog) — commercial reference
- [EAGLE-3 paper (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) — method paper
- [vLLM repository](https://github.com/vllm-project/vllm) — code and benchmarks
