---
id: inference-optimization
title: Inference Optimization: KV Cache, Quantization, Batching
code: IO
subtitle: KV cache, quantization, batching and speculation. Formulas, scheduler numbers and the mistakes that cost latency.
hue: 200
sources: phases/07-transformers-deep-dive/12-kv-cache-flash-attention, phases/10-llms-from-scratch/11-quantization, phases/10-llms-from-scratch/12-inference-optimization, phases/17-infrastructure-and-production/04-vllm-serving-internals, phases/17-infrastructure-and-production/05-eagle3-speculative-decoding, phases/17-infrastructure-and-production/08-inference-metrics-goodput, phases/17-infrastructure-and-production/09-production-quantization
source_hash: 24eabbf93445b948
---

## Inference pipeline
type: architecture
from: phases/10-llms-from-scratch/12-inference-optimization/code/main.py, phases/17-infrastructure-and-production/04-vllm-serving-internals/code/main.py

```arch
node | req | 1,1 | Request | queue and arrival | client
node | pc | 1,2 | PrefixCache | shared prompt trie | store
node | admit | 2,1 | Admit | free KV blocks | process
node | kv | 2,2 | KVCache | K and V per token | store
node | pre | 3,1 | Prefill | chunked prompt | gpu
node | dec | 3,2 | Decode | one token per step | gpu
edge | req | admit | arrive
edge | pc | pre | reuse prefix
edge | admit | pre | blocks free
edge | pre | dec | prompt done
edge | dec | kv | append
edge | kv | dec | read
```

## One decode step
type: flow
from: phases/10-llms-from-scratch/12-inference-optimization/code/main.py

1. **Write**: `kv_cache.update` stores the new K and V for each layer.
2. **Read**: The cache returns the slices up to the current length.
3. **Attend**: `scaled_dot_product_attention` runs over the cached prefix.
4. **Advance**: On a one-token decode, `kv_cache.advance(1)` moves the length.

## Core softmax update
type: annotated-code
lang: python
from: phases/07-transformers-deep-dive/12-kv-cache-flash-attention/code/main.py

```python
new_m = max(m, *scores)                      # running max
if m == float("-inf"):
    exp_old = 0.0
else:
    exp_old = math.exp(m - new_m)            # rescale old sums
exp_new = [math.exp(sc - new_m) for sc in scores]
s = s * exp_old + sum(exp_new)               # running sum
```

## Task reference
type: task-table
from: phases/07-transformers-deep-dive/12-kv-cache-flash-attention/code/main.py, phases/10-llms-from-scratch/12-inference-optimization/code/main.py

| Task | Code |
|---|---|
| Count KV cache bytes | `kv_cache_bytes(N, n_layers, n_heads_kv, d_head, dtype=2)` |
| Tiled attention output | `tiled_softmax_dot(q, Ks, Vs, tile=4)` |
| Simulate batching | `simulate_continuous_batching(requests, batch_size)` |
| Cache a shared prefix | `PrefixCache(max_entries=1000)` |
| Speculate tokens | `speculative_decode(draft_model, target_model, context, num_speculative=5)` |
| Check memory fit | `memory_budget(config, gpu_memory_gb)` |

## Defaults
type: defaults
from: phases/07-transformers-deep-dive/12-kv-cache-flash-attention/code/main.py, phases/10-llms-from-scratch/12-inference-optimization/code/main.py, phases/17-infrastructure-and-production/04-vllm-serving-internals/code/main.py

| Setting | Default | Note |
|---|---|---|
| `dtype` in `kv_cache_bytes` | 2 | Bytes per value. fp16 or bf16 |
| `tile` in `tiled_softmax_dot` | 4 | Keys per tile |
| `max_entries` in `PrefixCache` | 1000 | Trie node limit |
| `num_speculative` | 5 | Draft tokens per round |
| `acceptance_rate` in `DraftModel` | 0.8 | Simulated accept rate |
| `CHUNK_SIZE` | 512 | Prefill tokens per slice |
| `KV_BLOCK_SIZE` | 16 | Tokens per KV block |
| `KV_BLOCKS_AVAILABLE` | 1800 | Toy block budget |

## Formulas
type: concepts
from: phases/07-transformers-deep-dive/12-kv-cache-flash-attention/code/main.py, phases/10-llms-from-scratch/12-inference-optimization/code/main.py, phases/10-llms-from-scratch/11-quantization/code/main.py, phases/17-infrastructure-and-production/04-vllm-serving-internals/code/main.py

- **KV cache bytes**: `2 * N * n_layers * n_heads_kv * d_head * dtype`.
- **Per token KV**: two tensors times layers, KV heads, head size and item size.
- **Running max softmax**: the output matches a full softmax. Only one tile is held.
- **Block count**: ceiling of total tokens divided by the block size.
- **Quantization scale**: abs max divided by the integer range maximum.

## Troubleshooting
type: troubleshooting
from: phases/10-llms-from-scratch/12-inference-optimization/code/main.py, phases/17-infrastructure-and-production/04-vllm-serving-internals/code/main.py

| Symptom | Cause | Fix |
|---|---|---|
| Prefix lookup returns 0 | First tokens differ, so the trie walk stops | Keep the shared prompt identical from token one |
| Trie stops inserting | `max_entries` reached | Raise `max_entries` |
| Batch slots sit idle | Static batch waits for the longest output | Use continuous batching |
| Decode stalls on a long prompt | Prefill is not chunked | Set `chunked` so prefill uses `CHUNK_SIZE` |
| Speculation is slower | Low acceptance rate | Measure the rate before enabling it |
| Model does not fit | Weights exceed GPU memory | Quantize or add GPUs |

## Glossary
type: glossary
from: phases/10-llms-from-scratch/12-inference-optimization/code/main.py, phases/17-infrastructure-and-production/04-vllm-serving-internals/code/main.py

- **KV cache**: Stored keys and values for past tokens, so they are not recomputed.
- **Prefill**: Processing the whole prompt before the first output token.
- **Decode**: Producing one output token per step.
- **TTFT**: Time to first token. Set when prefill ends.
- **ITL**: Inter-token latency. Time between output tokens.

## Questions
type: qa
from: phases/10-llms-from-scratch/12-inference-optimization/code/main.py, phases/17-infrastructure-and-production/04-vllm-serving-internals/code/main.py, phases/17-infrastructure-and-production/08-inference-metrics-goodput/code/main.py

- **Why store K and V?** Each decode step reads them instead of recomputing the prefix.
- **Why is static batching wasteful?** Every row waits for the largest output length.
- **Why chunk prefill?** A long prompt would block the decode tokens of other requests.
- **Why do benchmark tools disagree on TPOT?** One counts the TTFT time in the rate and the other does not.

## Tips
type: tips
from: phases/17-infrastructure-and-production/08-inference-metrics-goodput/code/main.py, phases/17-infrastructure-and-production/04-vllm-serving-internals/code/main.py, phases/10-llms-from-scratch/12-inference-optimization/code/main.py

- Report P99 latency, not the mean. Check each request against all three limits.
- Derive the chunk size and block count from the scheduler constants.
- Keep the shared prompt prefix identical across requests.
- Check KV memory against the budget before raising the batch size.
