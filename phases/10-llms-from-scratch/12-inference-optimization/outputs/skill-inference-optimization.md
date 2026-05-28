---
name: skill-inference-optimization
description: LLM inference serving の throughput、latency、cost を診断して最適化する
version: 1.0.0
phase: 10
lesson: 12
tags: [inference, kv-cache, batching, speculative-decoding, vllm, optimization]
---

# LLM 推論最適化パターン

2つの phase があります。prefill (compute-bound, parallel) と decode (memory-bound, sequential) です。
すべての最適化は、このどちらか、または両方を対象にします。

```
Request -> Prefill (process prompt) -> Decode (generate tokens) -> Response
              |                            |
         Compute-bound               Memory-bound
         Optimize: fusion,           Optimize: batching,
         prefix caching              quantization, speculation
```

## 意思決定フレームワーク

### Step 1: bottleneck を特定する

workload の ops:byte ratio を測定します。

| ops:byte | Bound | 最適化対象 |
|----------|-------|-----------------|
| < 50 | Memory | KV cache を量子化し、batch size を増やす |
| 50-200 | Transitional | 両方が重要。batching から始める |
| > 200 | Compute | Kernel fusion、tensor parallelism、FP8 |

### Step 2: engine を選ぶ

- **標準**: vLLM (最も広い model support、PagedAttention、OpenAI-compatible API)
- **Multi-turn / structured output**: SGLang (RadixAttention prefix caching、constrained decoding)
- **Max NVIDIA throughput**: TensorRT-LLM (kernel fusion、H100 上の FP8)

### Step 3: 最適化を順番に適用する

1. **KV cache** -- 常に有効化。欠点はない
2. **Continuous batching** -- 常に有効化。欠点はない (vLLM/SGLang は default で実施)
3. **Prefix caching** -- shared system prompts がある場合に有効化する (ほとんどの chatbots が該当)
4. **Quantization** -- KV cache INT8/FP8 は品質低下を最小限にしながら memory を 2-4倍削減する
5. **Speculative decoding** -- throughput より latency が重要な場合に追加する
6. **Tensor parallelism** -- model が 1枚の GPU に収まらない場合、複数 GPU に分割する

## KV cache のメモリ式

```
per_token = 2 * num_layers * num_kv_heads * head_dim * bytes_per_param
total = per_token * sequence_length * num_concurrent_users
```

一般的な models の quick reference (BF16):

| Model | Per token | 100 users @ 4K |
|-------|-----------|----------------|
| Llama 3 8B | 32 KB | 12.5 GB |
| Llama 3 70B | 320 KB | 125 GB |
| Llama 3 405B | 504 KB | 197 GB |

## Speculative decoding checklist

- Draft model は target より 5-10倍小さいのが望ましい (例: 70B に対して 8B draft)
- meaningful speedup には acceptance rate > 70% が必要
- predictable text (code、structured output、natural language) に向いている
- creative/sampling-heavy tasks には弱い (low temperature が役立つ)
- 多くの workloads では EAGLE > draft-target > n-gram

## よくある失敗

- batch=1 で decode を走らせる (memory-bound で、compute では GPU の 95% が idle)
- contiguous KV cache blocks を割り当てる (PagedAttention を使い、waste をほぼゼロにする)
- 80% の requests が同じ system prompt を共有しているのに prefix caching を無視する
- model weights 用に GPU memory を過剰確保し、KV cache に何も残さない
- latency を測らずに throughput だけ測る (10s TTFT で高 throughput でも無意味)
- high temperature で speculative decoding を使う (acceptance rate が 50% 未満に落ちる)

## Monitoring checklist

- Time to first token (TTFT): prefill latency。interactive use では target < 500ms
- Inter-token latency (ITL): decode speed。streaming では target < 50ms
- Throughput (tokens/second): すべての concurrent users の合計
- KV cache utilization: allocated cache のうち使用中の割合
- Batch utilization: iteration ごとに埋まっている batch slots の割合
- Queue depth: batch slot を待っている requests
