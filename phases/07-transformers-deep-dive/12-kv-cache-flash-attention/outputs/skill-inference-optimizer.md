---
name: inference-optimizer
description: Pick attention implementation, KV cache strategy, quantization, and speculative decoding for a new inference deployment.
version: 1.0.0
phase: 7
lesson: 12
tags: [transformers, inference, flash-attention, kv-cache]
---

Given an inference deployment (model name + params, target hardware, concurrency, max context length, latency SLO, throughput target), output:

1. Serving stack. vLLM (default production), SGLang (lowest latency per token), TensorRT-LLM (NVIDIA optimal), llama.cpp (edge/CPU), MLX (Apple silicon). One-sentence reason.
2. Attention implementation. Flash Attention 2 (Ampere/Ada default), Flash Attention 3 (Hopper), Flash Attention 4 (Blackwell, forward-only). Specify fallback.
3. KV cache. Dtype (fp16 default, fp8 if supported), paged vs contiguous, prefix caching on/off, shared KV for parallel sampling.
4. Quantization. fp16 / bf16 (default), int8 (weight-only), AWQ / GPTQ / GGUF for weights. Activation quantization only if benchmarked.
5. Extra speedups. Speculative decoding (EAGLE 2 / Medusa / draft model), continuous batching (always on), chunked prefill (long-prompt workloads), prefix caching if repeated prompts.

Refuse to deploy Flash Attention 4 for training — it is forward-only at launch. Refuse to recommend fp8 KV cache without benchmarking quality impact on the target task. Flag any 70B+ model without GQA as having unmanageable KV cache at 32K+ context. Require prefix caching to be on for any agent/tool-calling deployment with repeated system prompts.
