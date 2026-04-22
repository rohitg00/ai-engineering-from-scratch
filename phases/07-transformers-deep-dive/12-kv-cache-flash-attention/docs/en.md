# KV Cache, Flash Attention & Inference Optimization

> Training is parallel and FLOP-bound. Inference is serial and memory-bound. Different bottleneck, different tricks.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~75 minutes

## The Problem

A naive autoregressive decoder does `O(N²)` work to generate `N` tokens: at each step it recomputes attention over the full prefix. For a 4K-token response that is 16M attention operations, most of them redundant. Every hidden state of a prefix token is deterministic once computed — you only need to run the new token's query against the cached keys and values of everything before.

On top of that, attention itself moves a lot of data. Standard attention materializes an N×N score matrix, N×d softmax output, N×d final output — too many reads and writes to HBM. For N≥2K, attention becomes memory-bound before it becomes FLOP-bound. Classic attention kernels underuse modern GPUs by 4–10×.

Two optimizations, both from Dao et al., pushed frontier inference from "slow" to "fast":

1. **KV cache.** Store the K and V vectors of every prefix token. Each new token's attention is one query against the cached keys. Inference reduces from `O(N²)` to `O(N)` per generation step.
2. **Flash Attention.** Tile the attention computation so the full N×N matrix never hits HBM. All of softmax + matmul happens in SRAM. 2–4× wall-clock speedup on A100; 5–10× on H100 with FP8.

By 2026 both are universal. Every production inference stack (vLLM, TensorRT-LLM, SGLang, llama.cpp) assumes them. Every frontier model ships with Flash Attention enabled.

## The Concept

![KV cache growth and Flash Attention tiling](../assets/kv-cache-flash-attn.svg)

### KV cache math

Per decoder layer, per token, per head:

```
bytes_per_token_per_layer = 2 * d_head * dtype_size
                          ^
                          K and V
```

For a 7B model with 32 layers, 32 heads, d_head=128, fp16:

```
per token per layer = 2 * 128 * 2 = 512 bytes
per token (32 layers) = 16 KB
per 32K context = 512 MB
```

For Llama 3 70B (80 layers, d_head=128, GQA with 8 KV heads):

```
per token per layer = 2 * 8 * 128 * 2 = 4096 bytes (4 KB)
per 32K context = 10.4 GB
```

That 10 GB is why Llama 3 70B at 128K context needs most of a 40 GB A100 just for KV cache at batch size 1.

**GQA is the KV-cache win.** MHA with 64 heads would be 32 GB. MLA compresses even further.

### Flash Attention — the tiling trick

Standard attention:

```
S = Q @ K^T          (HBM read, N×N, HBM write)
P = softmax(S)       (HBM read, HBM write)
O = P @ V            (HBM read, HBM write)
```

Three HBM round trips. On H100, HBM bandwidth is 3 TB/s; SRAM is 30 TB/s. Every HBM trip is a factor-of-10 slowdown vs keeping everything on-chip.

Flash Attention:

```
for each block of Q (tile size ~128 × 128):
    load Q_tile into SRAM
    for each block of K, V:
        load K_tile, V_tile into SRAM
        compute S_tile = Q_tile @ K_tile^T     (SRAM)
        running softmax aggregation             (SRAM)
        accumulate into O_tile                  (SRAM)
    write O_tile to HBM
```

One HBM trip per tile. Total memory footprint drops from `O(N²)` to `O(N)`. Backward pass recomputes some values from the forward pass instead of storing them — another memory win.

**Numerical trick.** Running softmax maintains `(max, sum)` across tiles so the final normalization is exact. Not an approximation — Flash Attention computes bit-identical output to standard attention (modulo fp16 non-associativity).

**Version evolution:**

| Version | Year | Key change | Speedup on reference hardware |
|---------|------|-----------|-------------------------------|
| Flash 1 | 2022 | Tiled SRAM kernel | 2× on A100 |
| Flash 2 | 2023 | Better parallelism, causal-first ordering | 3× on A100 |
| Flash 3 | 2024 | Hopper asynchrony, FP8 | 1.5–2× on H100 (~740 TFLOPs FP16) |
| Flash 4 | 2026 | Blackwell 5-stage pipeline, software exp2 | Inference-first (forward only initially) |

Flash 4 is forward-pass only at launch. Training still uses Flash 3. GQA and varlen support for Flash 4 is pending (mid-2026).

### Speculative decoding — the other latency win

Cheap model proposes N tokens. Big model verifies all N in parallel. If verification accepts k tokens, you paid 1 big-model forward pass for k generations. Typical k=3–5 on code and prose.

2026 defaults:
- **EAGLE 2 / Medusa.** Integrated draft heads that share the verifier's hidden states. 2–3× speedup with no quality loss.
- **Speculative decoding with draft model.** 2–4× speedup on consumer hardware.
- **Lookahead decoding.** Jacobi iteration; no draft model needed. Niche but free.

### Continuous batching

Classic batched inference: wait for the slowest sequence to finish, then start a new batch. Wastes GPU when short responses finish early.

Continuous batching (first shipped in Orca, now in vLLM, TensorRT-LLM, SGLang): swap new requests into the batch as soon as old ones finish. 5–10× throughput gain for typical chat workloads.

### PagedAttention — KV cache as virtual memory

vLLM's headline feature. KV cache is allocated in 16-token blocks; a page table maps logical positions to physical blocks. Lets you share KV across parallel samples (beam search, parallel sampling), hot-swap prefixes for prompt caching, and defragment memory. 4× throughput improvement over naive contiguous allocation.

## Build It

See `code/main.py`. We implement:

1. A naive `O(N²)` incremental decoder.
2. A `O(N)` KV-cached decoder.
3. A tiled softmax that simulates Flash Attention's running-max algorithm.

### Step 1: KV cache

```python
class KVCache:
    def __init__(self, n_layers, n_heads, d_head):
        self.K = [[[] for _ in range(n_heads)] for _ in range(n_layers)]
        self.V = [[[] for _ in range(n_heads)] for _ in range(n_layers)]

    def append(self, layer, head, k, v):
        self.K[layer][head].append(k)
        self.V[layer][head].append(v)

    def read(self, layer, head):
        return self.K[layer][head], self.V[layer][head]
```

Simple: keep growing per-token K, V vectors in per-layer, per-head lists.

### Step 2: tiled softmax

```python
def tiled_softmax_dot(q, K, V, tile=4):
    """Flash-attention-style softmax(qK^T)V with running max/sum."""
    m = float("-inf")
    s = 0.0
    out = [0.0] * len(V[0])
    for start in range(0, len(K), tile):
        k_block = K[start:start + tile]
        v_block = V[start:start + tile]
        scores = [sum(qi * ki for qi, ki in zip(q, k)) for k in k_block]
        new_m = max(m, *scores)
        exp_old = math.exp(m - new_m) if m != float("-inf") else 0.0
        exp_new = [math.exp(sc - new_m) for sc in scores]
        s = s * exp_old + sum(exp_new)
        for j in range(len(out)):
            out[j] = out[j] * exp_old + sum(e * v[j] for e, v in zip(exp_new, v_block))
        m = new_m
    return [o / s for o in out]
```

Bit-identical output to `softmax(qK) V` in one shot, but at any time the working set is a `tile × d_head` block, not the full `N × d_head`.

### Step 3: compare naive vs cached decoding on 100-token generation

Count attention operations. Naive: `O(N²)` = 5050. Cached: `O(N)` = 100. The code prints both.

## Use It

```python
# HuggingFace transformers auto-enables KV cache on decoder-only generate().
from transformers import AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-3B",
    attn_implementation="flash_attention_2",  # use FA3 if Hopper
    torch_dtype="bfloat16",
)
# generate() uses KV cache automatically
```

vLLM production:

```bash
pip install vllm
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --tensor-parallel-size 4 \
    --max-model-len 32768 \
    --enable-prefix-caching \
    --kv-cache-dtype fp8
```

Prefix caching across requests is a big 2026 win — the same system prompt, few-shot examples, or long context document reuses KV across calls. For agent workloads with repeated tool prompts, prefix caching is routinely 5× throughput gain.

## Ship It

See `outputs/skill-inference-optimizer.md`. The skill picks attention implementation, KV cache strategy, quantization, and speculative decoding for a new inference deployment.

## Exercises

1. **Easy.** Run `code/main.py`. Confirm the naive and cached decoders produce the same output; note the op-count difference.
2. **Medium.** Implement prefix caching: given a prompt P and several completions, run one forward pass over P to fill the KV cache, then branch per-completion. Measure speedup vs re-encoding P for each.
3. **Hard.** Implement a toy PagedAttention: KV cache in fixed 16-token blocks with a free-list. When a sequence finishes, return its blocks to the pool. Simulate 1,000 chat completions with varying lengths. Compare memory fragmentation vs contiguous allocation.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| KV cache | "The trick that makes decoding fast" | Stored K and V from every prefix token; new queries attend to them instead of recomputing. |
| HBM | "GPU main memory" | High Bandwidth Memory; 80 GB on H100, 192 GB on B200. ~3 TB/s bandwidth. |
| SRAM | "On-chip memory" | Per-SM fast memory, ~256 KB per SM on H100. ~30 TB/s bandwidth. |
| Flash Attention | "Tiled attention kernel" | Computes attention without materializing N×N in HBM. |
| Continuous batching | "No-wait batching" | Swap finished sequences out, new ones in, without draining the batch. |
| PagedAttention | "vLLM's headline" | KV cache allocated in fixed blocks with a page table; eliminates fragmentation. |
| Prefix caching | "Reuse long prompts" | Cache KV for a shared prefix across requests; major cost cut for agents. |
| Speculative decoding | "Draft + verify" | Cheap draft model proposes tokens; big model verifies k in one pass. |

## Further Reading

- [Dao et al. (2022). FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness](https://arxiv.org/abs/2205.14135) — Flash 1.
- [Dao (2023). FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning](https://arxiv.org/abs/2307.08691) — Flash 2.
- [Shah et al. (2024). FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision](https://arxiv.org/abs/2407.08608) — Flash 3.
- [FlashAttention-4 release notes (Dao-AILab, 2026)](https://github.com/Dao-AILab/flash-attention) — Blackwell 5-stage pipeline and the software-exp2 trick; read the repo README for the forward-only launch caveats this lesson mentions.
- [Kwon et al. (2023). Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180) — vLLM paper.
- [Leviathan et al. (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) — spec decoding.
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) — EAGLE-1/2 paper for the integrated-draft approach the lesson cites.
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) — the Medusa approach referenced alongside EAGLE.
- [Raschka, *LLMs-from-scratch* — Ch. 4 bonus `03_kv-cache`](https://github.com/rasbt/LLMs-from-scratch/tree/main/ch04/03_kv-cache) — naive, cached, and optimized KV cache implementations side-by-side in `gpt_ch04.py`, `gpt_with_kv_cache.py`, `gpt_with_kv_cache_optimized.py`. Diff the three files to watch the O(N²) → O(N) reduction this lesson's Step 3 counts.
- [Raschka, *LLMs-from-scratch* — package `llms_from_scratch/kv_cache/`](https://github.com/rasbt/LLMs-from-scratch/tree/main/pkg/llms_from_scratch/kv_cache) — production-shaped KV cache for Llama 3 and Qwen 3 with batching support (`kv_cache_batched/`).
- [stas00, `ml-engineering/inference/README.md`](https://github.com/stas00/ml-engineering/blob/master/inference/README.md) — practical Flash Attention + continuous batching + quantization notes from a production MLE; best companion to this lesson's Use It section.
- [stas00, `ml-engineering/training/performance/benchmarks/activation-memory-per-layer.py`](https://github.com/stas00/ml-engineering/blob/master/training/performance/benchmarks/activation-memory-per-layer.py) — runnable script that reproduces the KV-cache byte math this lesson lays out for Llama 3 70B.
- [vLLM docs — PagedAttention](https://docs.vllm.ai/en/latest/design/kernel/paged_attention.html) — the canonical deep dive on the 16-token block and page-table design.
