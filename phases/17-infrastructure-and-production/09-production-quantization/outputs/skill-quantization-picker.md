---
name: quantization-picker
description: Hardware、engine、workload、quality tolerance に基づいて 2026 年の quantization format を選び、calibration + validation plan を作成します。
version: 1.0.0
phase: 17
lesson: 09
tags: [quantization, awq, gptq, gguf, fp8, nvfp4, calibration]
---

Hardware（CPU / H100 / H200 / B200 / GB200 と台数）、engine（llama.cpp / vLLM / TRT-LLM / SGLang）、model（size + task type — routine chat / reasoning / code / multi-LoRA）、quality tolerance（HumanEval / MATH / MMLU で N-point drop を許容できるか）を受け取り、quantization format を選び validation plan を作成します。

作成するもの:

1. Format recommendation。次のいずれか: GGUF Q4_K_M、GGUF Q5_K_M、GPTQ-Int4 + Marlin、AWQ-Int4 + Marlin、FP8、NVFP4 + FP8 KV、または stacked combo。Decision tree で正当化する: CPU → GGUF、reasoning → FP8、vLLM の multi-LoRA → GPTQ、routine GPU chat → AWQ、validated Blackwell → NVFP4。
2. Memory budget。Weights + KV cache（報告された concurrency × context）+ activations を報告する。Target GPU に収まるかを確認し、必要なら multi-GPU requirement を明記する。
3. Calibration plan。Dataset source（AWQ/GPTQ では domain-matched、最後の手段として generic C4/WikiText）。Sample count（domain では 500-2000）。Validation set（calibration pool から 10% held out）。
4. Validation plan。Task に合う eval set: code なら HumanEval、reasoning なら MATH/MMLU、chat なら MT-Bench。Baseline BF16 vs quantized。Drop が quality tolerance 以下なら ship。
5. KV cache decision。Weight quantization とは別。Reasoning には FP8 KV を推奨。Attention accuracy が marginal なら BF16 KV。INT8 KV は validation 後のみ。
6. Rollback path。BF16/FP8 weights を disk に保持し、production quality が劣化したら戻す flag を用意する。

Hard rejects:
- Eval-set validation なしで reasoning-heavy workloads に NVFP4 weights を推奨すること。
- Domain models を generic web data で calibrate すること。必ず in-domain を使う。
- HBM budget で KV cache を忘れること。必ず itemize する。
- Kernels を明記せずに throughput numbers を主張すること（Marlin-AWQ と plain AWQ では 10x 違う）。

Refusal rules:
- Workload が本質的に quality-marginal（open-ended creative generation、edge-case reasoning）の場合、aggressive INT4 は拒否する。FP8 または BF16 に留める。
- Engine が llama.cpp の場合、GGUF 以外の format は拒否する。Format と engine の一致は最低条件。
- User が 1,000-sample eval を実行できない場合は拒否する。Production で blind quantization は不可。

Output: chosen format、HBM budget、calibration plan、validation plan、KV cache decision、rollback path を列挙した 1-page quantization pick。最後に key risk に応じて eval-set delta、peak concurrency 下の KV cache pressure、real batch size での throughput のいずれかを挙げる "what to measure next" paragraph で締めます。
