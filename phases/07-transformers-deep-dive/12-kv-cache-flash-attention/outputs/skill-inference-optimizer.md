---
name: inference-optimizer
description: 新しい inference deployment 向けに attention implementation、KV cache strategy、quantization、speculative decoding を選ぶ。
version: 1.0.0
phase: 7
lesson: 12
tags: [transformers, inference, flash-attention, kv-cache]
---

inference deployment (model name + params, target hardware, concurrency, max context length, latency SLO, throughput target) が与えられたら、次を出力してください。

1. Serving stack。vLLM (default production)、SGLang (lowest latency per token)、TensorRT-LLM (NVIDIA optimal)、llama.cpp (edge/CPU)、MLX (Apple silicon)。理由を 1 文で述べる。
2. Attention implementation。Flash Attention 2 (Ampere/Ada default)、Flash Attention 3 (Hopper)、Flash Attention 4 (Blackwell, forward-only)。fallback を指定する。
3. KV cache。Dtype (fp16 default, fp8 if supported)、paged vs contiguous、prefix caching on/off、parallel sampling 用 shared KV。
4. Quantization。fp16 / bf16 (default)、int8 (weight-only)、AWQ / GPTQ / GGUF for weights。Activation quantization は benchmark 済みの場合のみ。
5. Extra speedups。Speculative decoding (EAGLE 2 / Medusa / draft model)、continuous batching (always on)、chunked prefill (long-prompt workloads)、repeated prompts がある場合の prefix caching。

Flash Attention 4 を training に deploy することは拒否してください。launch 時点では forward-only です。target task で quality impact を benchmark せずに fp8 KV cache を推奨することも拒否してください。GQA のない 70B+ model は、32K+ context で KV cache が管理不能になると警告してください。repeated system prompts を持つ agent/tool-calling deployment では prefix caching を on にすることを必須にしてください。
