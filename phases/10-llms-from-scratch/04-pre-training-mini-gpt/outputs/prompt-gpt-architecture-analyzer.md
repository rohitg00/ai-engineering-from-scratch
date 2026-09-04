---
name: prompt-gpt-architecture-analyzer
description: Analyze architecture choices in any GPT-style transformer model
version: 1.0.0
phase: 10
lesson: 4
tags: [gpt, transformer, architecture, attention, kv-cache, scaling, pre-training]
---

# GPT Architecture Analyzer

When evaluating a GPT-style model from a technical report, model card, or training log, use this framework to break down the architecture and identify design tradeoffs.

## Analysis Protocol

### 1. Parameter Allocation Breakdown

Compute the exact parameter count for each component:

- **Token embeddings**: vocab_size x embed_dim
- **Position embeddings**: max_seq_len x embed_dim
- **Per-block attention**: 4 x embed_dim x embed_dim (Q, K, V, output projections)
- **Per-block FFN**: 2 x embed_dim x ff_dim + embed_dim + ff_dim (two linear layers + biases)
- **Per-block LayerNorm**: 4 x embed_dim (two norms, each with scale + bias)
- **Final LayerNorm**: 2 x embed_dim
- **Output head**: vocab_size x embed_dim (or 0 if weight-tied with token embeddings)

Flag if any single component exceeds 40% of total parameters. The embedding matrix dominates in small models. Attention and FFN dominate in large models.

### 2. Attention Design Analysis

Evaluate the attention configuration:

- **Head dimension**: embed_dim / num_heads. Standard is 64 (GPT-2) or 128 (Llama 3). Below 32 limits per-head expressiveness. Above 128 wastes compute with little benefit.
- **Heads per layer**: More heads = more diverse attention patterns but more memory for KV cache.
- **Grouped Query Attention (GQA)**: Does the model share K/V heads across multiple Q heads? Llama 3 uses GQA with 8 KV heads for 32 Q heads. This reduces KV cache by 4x.
- **Context length**: Max position embeddings. RoPE allows extrapolation beyond training length. Absolute position embeddings do not.

### 3. Memory Budget

For inference at the model's maximum context length:

- **Weights (FP16)**: total_params x 2 bytes
- **KV Cache (FP16)**: 2 x num_layers x num_kv_heads x head_dim x max_seq_len x 2 bytes
- **Activations**: batch_size x seq_len x embed_dim x 2 bytes x num_layers (approximate)

Flag if KV cache exceeds weight memory. This happens for long-context models (128K+) and indicates the model is memory-bound during decode.

### 4. Compute Profile

- **Prefill FLOPS per token**: approximately 2 x total_params (one matmul per parameter, forward pass)
- **Decode FLOPS per token**: same as prefill but on a single token
- **Prefill bottleneck**: compute-bound (GPU TFLOPS)
- **Decode bottleneck**: memory-bound (GPU memory bandwidth)
- **Arithmetic intensity**: FLOPS per byte of memory accessed. Below 100 = memory-bound.

### 5. Scaling Decisions

Evaluate against known scaling laws:

- **Chinchilla optimal**: For a given compute budget C, optimal model size N and token count D satisfy N ~ D (roughly equal scaling). A 7B model needs ~140B tokens.
- **Llama 3 overtrained**: Meta trained Llama 3 8B on 15T tokens (100x Chinchilla optimal). Overtraining small models on more data produces better per-token inference cost.
- **Width vs depth**: Deeper models (more layers) are generally more sample-efficient than wider models (larger embed_dim) for the same parameter count.

## Red Flags

- **FFN ratio not 4x**: Standard is ff_dim = 4 x embed_dim. Llama uses 8/3 x embed_dim with SwiGLU. Deviations should be justified.
- **No weight tying**: The output head should share weights with token embeddings unless vocab_size is very large relative to embed_dim.
- **No GQA above 13B**: Models above 13B without grouped-query attention will have excessively large KV caches.
- **No RoPE for long context**: Absolute position embeddings do not extrapolate beyond training length. Models targeting 32K+ context should use rotary embeddings.
- **Learning rate too high for model size**: Larger models need lower peak learning rates. GPT-2 Small uses 6e-4. Llama 3 405B uses 8e-5.

## Output Format

1. **Parameter Table**: component-by-component parameter counts with percentages
2. **Memory Budget**: weights, KV cache, and activation memory at max context length
3. **Compute Profile**: prefill and decode throughput estimates for A100/H100
4. **Design Assessment**: what the model gets right and what is non-standard
5. **Scaling Verdict**: whether the model is appropriately sized for its training data
