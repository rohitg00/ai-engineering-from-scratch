# Production Quantization — AWQ, GPTQ, GGUF K-quants, FP8, MXFP4/NVFP4

> Quantization format is not a universal choice — it is a function of hardware, serving engine, and workload. GGUF Q4_K_M or Q5_K_M owns CPU and edge, delivered through llama.cpp and Ollama. GPTQ wins inside vLLM when you need multi-LoRA on the same base. AWQ with Marlin-AWQ kernels delivers ~741 tok/s on a 7B class model with the best Pass@1 at INT4 — the 2026 default for datacenter production. FP8 stays the middle ground on Hopper, Ada, and Blackwell — near-lossless and widely supported. NVFP4 and MXFP4 (Blackwell microscaling) are aggressive and require per-block validation. Two traps bite teams: calibration dataset must match deployment domain, and KV cache is separate from weight quantization — the AWQ lesson "my model is 4 GB now" forgets the 10-30 GB KV cache at production batch sizes.

**Type:** Learn
**Languages:** Python (stdlib, toy memory and throughput comparison across formats)
**Prerequisites:** Phase 10 · 13 (Quantization foundations), Phase 17 · 04 (vLLM Serving Internals)
**Time:** ~75 minutes

## Learning Objectives

- Name the six production quantization formats and their sweet spots in 2026.
- Pick a format given hardware (CPU vs GPU, Hopper vs Blackwell), engine (vLLM, TRT-LLM, llama.cpp), and workload (routine chat, reasoning, multi-LoRA).
- Compute the weight memory saved and the KV cache left untouched for a chosen format.
- Name the calibration-dataset pitfall that degrades quantized models on domain traffic.

## The Problem

Quantization reduces memory and HBM bandwidth, which is exactly what decode needs. An FP16 70B model is 140 GB of weights. Quantize weights to INT4 (AWQ or GPTQ) and the model is 35 GB — fits in one H100 with room for KV cache, which matters because at 128 concurrent sequences with 2k context, KV cache alone is 20-30 GB.

But quantization is not free. Aggressive quantization degrades quality, especially on reasoning-heavy tasks. Different formats work with different engines. Different hardware supports different precisions natively. The 2026 format zoo is real and you cannot copy someone else's choice — you have to pick based on your stack.

## The Concept

### The six formats

| Format | Bits | Sweet spot | Engines |
|--------|------|-----------|---------|
| GGUF Q4_K_M / Q5_K_M | 4-5 | CPU, edge, laptops | llama.cpp, Ollama |
| GPTQ | 4-8 | Multi-LoRA on vLLM | vLLM, TGI |
| AWQ | 4 | Datacenter GPU production | vLLM (Marlin-AWQ), TGI |
| FP8 | 8 | Hopper/Ada/Blackwell datacenter | vLLM, TRT-LLM, SGLang |
| MXFP4 | 4 | Blackwell multi-user | TRT-LLM |
| NVFP4 | 4 | Blackwell multi-user | TRT-LLM |

### GGUF — the CPU/edge default

GGUF is a file format, not a quantization scheme per se — it bundles K-quant variants (Q2_K, Q3_K_M, Q4_K_M, Q5_K_M, Q6_K, Q8_0) in one container. Q4_K_M and Q5_K_M are the production defaults — near-BF16 quality at 4-5 bits. Best choice for CPU or edge serving because llama.cpp is by far the fastest CPU inference engine.

Throughput penalty in vLLM: ~93 tok/s on 7B — the format is not optimized for GPU kernels. Use GGUF when the deployment target is CPU/edge. Not otherwise.

### GPTQ — multi-LoRA in vLLM

GPTQ is a post-training quantization algorithm with a calibration pass. Marlin kernels make it fast on GPU (2.6x speedup vs non-Marlin GPTQ). ~712 tok/s on 7B.

The unique win: GPTQ-Int4 supports LoRA adapters in vLLM. If you are serving a base model plus 10-50 fine-tuned variants (each as a LoRA), GPTQ is your path. NVFP4 does not support LoRA yet as of early 2026.

### AWQ — the datacenter GPU default

Activation-aware Weight Quantization. Protects the ~1% most-salient weights during quantization. Marlin-AWQ kernels: 10.9x speedup vs naive. ~741 tok/s on 7B, best Pass@1 among INT4 formats.

Pick AWQ for new GPU serving unless you need multi-LoRA (GPTQ) or aggressive Blackwell FP4 (NVFP4).

### FP8 — the reliable middle

8-bit floating point. Near-lossless. Widely supported. Hopper Tensor Cores accelerate FP8 natively. Blackwell inherits. FP8 is the safe 2026 default when quality is non-negotiable (reasoning, medical, code-gen). Memory savings are half of INT4 but quality risk is far lower.

### MXFP4 / NVFP4 — Blackwell aggressive

Microscaling FP4. Each block of weights has its own scale factor. Aggressive but hardware-accelerated on Blackwell Tensor Cores. Halve the bytes per token versus FP8 — the economic win in Phase 17 · 07.

Caveats:
- No LoRA support yet (early 2026).
- Quality drop visible on reasoning-heavy workloads.
- Validate on your eval set per model.

### The calibration trap

AWQ and GPTQ require a calibration dataset — typically C4 or WikiText. For domain models (code, medical, legal), calibrating on generic web text lets the algorithm make wrong decisions about which weights to protect. Pass@1 on HumanEval can drop several points.

The fix: calibrate on in-domain data. Hundreds of domain samples is usually enough. Test on the eval set before shipping.

### The KV cache trap

AWQ shrinks weights to 4 bits. KV cache is separate and stays at FP16/FP8. For a 70B model with AWQ:

- Weights: ~35 GB (INT4 from 140 GB).
- KV cache at 128 concurrent × 2k context: ~20 GB.
- Activations: ~5 GB.
- Total: ~60 GB — fits on H100 80GB.

Naively "I quantized my model to 4 GB" forgets the other 30-50 GB. Budget HBM holistically.

Separately, KV cache quantization (FP8 KV or INT8 KV) is a different choice with its own tradeoffs — it affects attention accuracy directly and is not a free win.

### AWQ INT4 is hazardous for reasoning

Chain-of-thought, math, code-gen with long context — these suffer visibly from aggressive quantization. AWQ INT4 loses ~3-5 points on MATH. For reasoning-heavy workloads, ship FP8 or BF16; accept the memory cost.

### 2026 picking guide

- CPU/edge serve: GGUF Q4_K_M. Done.
- GPU serve, routine chat, no LoRA: AWQ.
- GPU serve, multi-LoRA: GPTQ with Marlin.
- Reasoning workload: FP8.
- Blackwell datacenter, validated quality: NVFP4 + FP8 KV.
- Ambiguous: run a 1,000-sample eval on each candidate format.

## Use It

`code/main.py` computes memory footprint (weights + KV + activations) and relative throughput across the six formats for a range of model sizes. Shows where KV cache dominates, where weight compression pays, and where FP8 is the safe pick.

## Ship It

This lesson produces `outputs/skill-quantization-picker.md`. Given hardware, model size, workload type, and quality tolerance, picks a format and produces a calibration/validation plan.

## Exercises

1. Run `code/main.py`. For a 70B model at 128 concurrent with 2k context, compute the total HBM for each format. Which format lets you fit on one H100 80GB?
2. You have a 7B coding model. Pick a format and justify. If you were wrong about quality tolerance, what is the recovery path?
3. Compute the calibration-dataset size needed to calibrate AWQ for a medical domain model. Why is more data not always better?
4. Read the Marlin-AWQ kernel paper or release notes. Explain in three sentences why AWQ hits 741 tok/s on 7B while raw GPTQ hits ~712.
5. When does it make sense to combine AWQ weights with FP8 KV cache vs keeping KV at BF16?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GGUF | "llama.cpp format" | File format bundling K-quant variants; CPU/edge default |
| Q4_K_M | "Q4 K M" | 4-bit K-quant medium; the production GGUF default |
| GPTQ | "gee pee tee q" | Post-train INT4 with calibration; supports LoRA in vLLM |
| AWQ | "a w q" | Activation-aware INT4; Marlin kernels; best Pass@1 at INT4 |
| Marlin kernels | "fast INT4 kernels" | Custom CUDA kernels for INT4 on Hopper; 10x speedup |
| FP8 | "eight-bit float" | Safe precision default on Hopper/Ada/Blackwell |
| MXFP4 / NVFP4 | "microscaling four" | Blackwell 4-bit FP with per-block scale factors |
| Calibration dataset | "cal data" | Input text used to pick quantization parameters; must match domain |
| KV cache quantization | "KV INT8" | Separate choice from weights; affects attention accuracy |

## Further Reading

- [VRLA Tech — LLM Quantization 2026](https://vrlatech.com/llm-quantization-explained-int4-int8-fp8-awq-and-gptq-in-2026/) — comparative benchmarks.
- [Jarvis Labs — vLLM Quantization Complete Guide](https://jarvislabs.ai/blog/vllm-quantization-complete-guide-benchmarks) — throughput numbers by format.
- [PremAI — GGUF vs AWQ vs GPTQ vs bitsandbytes 2026](https://blog.premai.io/llm-quantization-guide-gguf-vs-awq-vs-gptq-vs-bitsandbytes-compared-2026/) — format-by-format picking.
- [vLLM docs — Quantization](https://docs.vllm.ai/en/latest/features/quantization/index.html) — supported formats and flags.
- [AWQ paper (arXiv:2306.00978)](https://arxiv.org/abs/2306.00978) — original AWQ formulation.
- [GPTQ paper (arXiv:2210.17323)](https://arxiv.org/abs/2210.17323) — original GPTQ formulation.
