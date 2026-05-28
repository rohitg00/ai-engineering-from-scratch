---
name: spec-decode-picker
description: 新しい LLM inference workload 向けに speculative decoding strategy (vanilla / Medusa / EAGLE / lookahead) と tuning parameters を選ぶ。
version: 1.0.0
phase: 7
lesson: 16
tags: [inference, decoding, latency, speculative, optimization]
---

# Speculative Decoding Picker

engineer が vanilla speculative、Medusa、EAGLE、lookahead decoding のどれを使うかを選び、specific workload 向けに `N` (draft length) を調整できるよう支援します。

## 収集する入力

1. **Verifier model** — final output を生成する LLM。size が重要です (speedup には draft cost が verifier cost より小さい必要があります)。
2. **Workload type** — code、chat、structured output、summarization。acceptance rate を決めます。
3. **Sampling strategy** — greedy、low-T、high-T、beam。High-T sampling は acceptance を悪化させます。
4. **Hardware target** — memory budget により separate draft model を載せられるかが決まります。
5. **Engineering budget** — Medusa と EAGLE は fine-tuning が必要です。vanilla と lookahead は不要です。
6. **Latency target** — interactive chat (<500ms TTFT, <50ms per token) か batch (throughput-first) か。

## 判断ルール

- **Quick start, no training**: same-family 1B–3B model による vanilla draft。typical に 2×。
- **You can fine-tune**: verifier の hidden states を使う EAGLE-2 または EAGLE-3。typical に 3–4×。
- **You can fine-tune but can't run two models**: Medusa (verifier 上の extra heads)。2–3×。
- **No training budget, no draft model available**: lookahead decoding。1.3–1.6×。
- **Batch-heavy serving**: continuous batching の方が重要です。batch がすでに saturated していると speculative gains は小さくなります。
- **High temperature or stochastic sampling**: acceptance が急落します。より低い N (2–3) または disabling を検討します。
- **Structured output (JSON, code)**: acceptance が高いです。max speedup のため N を 7+ に押し上げます。

## Tuning

- **N (draft length)**: 5 から始めます。acceptance を測定します。α > 0.9 なら 7 に上げます。α < 0.6 なら 3 に下げます。
- **Draft temperature**: verifier の temperature に合わせます。draft sampling がずれると α を失います。
- **Tree depth (EAGLE-2 / Medusa)**: 3–5 branches。wider trees は α > 0.8 のときだけ効きます。
- **Draft model size**: α > 0.7 に達する最小のもの。70B verifier には 1B draft が typical です。verifier の tokenizer / embedding compatibility を下回るものにはしないでください。

## 必ず flag すること

- draft と verifier が tokenizer を共有していることを確認します。異なる BPE splits は speculative guarantees を壊します。
- spec decoding は vLLM の continuous batching と相互作用します。batch がすでに saturated していると、request ごとの speedup は下がります。
- EAGLE の hidden-state input には verifier internals が必要です。HF APIs 経由では常に exposed されるわけではありません。vLLM または SGLang runtimes を優先します。
- Medusa heads には verifier 自身の outputs に対する supervised fine-tune が必要です。data-gathering step が dominant cost になることがよくあります。

## 出力形式

次を返します。

1. **Recommendation** — strategy name と tuning parameters (例: "EAGLE-2, N=5, tree_depth=4")。
2. **Expected speedup** — 明示的な α assumption 付き。
3. **Compatibility checks** — tokenizer match、runtime support、KV cache rollback support。
4. **Fallback plan** — primary strategy が期待未満だった場合、次に何を試すか。
5. **Measurement plan** — representative sample 上で acceptance rate と speedup を検証する方法。
