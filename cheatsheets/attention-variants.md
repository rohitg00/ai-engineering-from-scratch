---
id: attention-variants
title: Attention Variants Compared
code: AV
subtitle: Full, sliding window, strided, BigBird, differential and native sparse attention. Cost, KV cache, code, fixes.
hue: 265
sources: phases/07-transformers-deep-dive/12-kv-cache-flash-attention, phases/07-transformers-deep-dive/15-attention-variants, phases/10-llms-from-scratch/16-differential-attention-v2, phases/10-llms-from-scratch/17-native-sparse-attention
source_hash: 2d7b00775e872f21
---

## Variants side by side
type: comparison
from: phases/07-transformers-deep-dive/15-attention-variants/docs/en.md

| Variant | Compute | KV cache | Quality vs full |
|---|---|---|---|
| Full attention | `O(N^2)` | `O(N)` per layer | baseline |
| SWA, window 1024 | N times W | `O(W)` per layer | -0.1 ppl, good with global layers |
| Local + strided sparse | N times sqrt N | mixed | similar to SWA |
| BigBird, local + global + random | `O(N)` approx | mixed | matches full at 2× context |
| Native Sparse (DeepSeek-V3.2) | N times active fraction | `O(N)` | within 0.05 ppl |
| Differential | 2 times N squared | `O(2N)` | -5 to -10% ppl |

## Use X when
type: tips
from: phases/07-transformers-deep-dive/15-attention-variants/docs/en.md, phases/10-llms-from-scratch/16-differential-attention-v2/docs/en.md, phases/10-llms-from-scratch/17-native-sparse-attention/docs/en.md

- **Full attention**: every layer up to ~16K context, or when retrieval quality is paramount.
- **SWA + global mix**: long context above 32K. The 2026 default above 32K.
- **Sparse block attention**: custom kernel, custom pattern. For retrieval and audio.
- **Differential attention**: attention sinks hurt, as in long-context RAG and needle-in-haystack.
- **DIFF from the start**: a new model that targets 64k-plus effective context.
- **NSA**: pre-training or continued training that targets 64k-plus context.
- **Not DIFF or NSA**: a pre-trained dense model, or context under 16k.

## Mask builders
type: annotated-code
lang: python
from: phases/07-transformers-deep-dive/15-attention-variants/code/main.py, phases/07-transformers-deep-dive/15-attention-variants/docs/en.md

```python
def swa_mask(n, window):
    M = [[NEG_INF] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)  # window >= n gives full causal
        for j in range(lo, i + 1):
            M[i][j] = 0.0  # 0.0 attends, NEG_INF masks
    return M

def strided_mask(n, window, stride):  # local window, then:
        for j in range(0, i + 1, stride):
            M[i][j] = 0.0  # every stride-th token back to 0

render(swa_mask(8, window=4), "sliding window (W=4)")
render(strided_mask(8, window=2, stride=3), "local (W=2) + strided (stride=3)")
```

## SWA with FlexAttention
type: annotated-code
lang: python
from: phases/07-transformers-deep-dive/15-attention-variants/docs/en.md

```python
from torch.nn.attention.flex_attention import flex_attention, create_block_mask

def swa_pattern(b, h, q_idx, kv_idx):
    return (q_idx - kv_idx < 1024) & (q_idx >= kv_idx)  # window 1024, causal

mask = create_block_mask(swa_pattern, B=batch, H=heads, Q_LEN=n, KV_LEN=n)
out = flex_attention(q, k, v, block_mask=mask)  # compiles to a Triton kernel
```

## NSA: three branches
type: architecture
from: phases/10-llms-from-scratch/17-native-sparse-attention/docs/en.md, phases/10-llms-from-scratch/17-native-sparse-attention/code/main.py

```arch
node | q | 1,2 | Query | one per position | client
node | cmp | 2,1 | Compressed branch | block means, N/l keys | process
node | sel | 2,2 | Selected branch | top-k blocks, k*l keys | process
node | win | 2,3 | Sliding window | last W tokens | process
node | kv | 3,2 | KV cache | fine-grained tokens | store
node | gate | 4,2 | Gate | sigmoid, 3 weights | model
edge | q | cmp | attend
edge | cmp | sel | top_k_blocks
edge | q | win | attend
edge | kv | sel | load blocks
edge | sel | gate | out_sel
edge | cmp | gate | out_cmp
edge | win | gate | out_win
```

## Flash Attention tile loop
type: flow
from: phases/07-transformers-deep-dive/12-kv-cache-flash-attention/docs/en.md, phases/07-transformers-deep-dive/12-kv-cache-flash-attention/code/main.py

1. **Outer loop**: load one Q tile, about 128 × 128, into SRAM.
2. **Inner loop**: load each K tile and V tile into SRAM.
3. **SRAM**: compute `S_tile = Q_tile @ K_tile^T`.
4. **SRAM**: keep a running `(max, sum)` across tiles.
5. **SRAM**: rescale the old output by `exp_old` and add the new block.
6. **HBM**: write `O_tile` to HBM. One HBM trip per tile.
7. **Result**: bit-identical to standard attention, memory O(N) not O(N^2).

## Tasks in code
type: task-table
from: phases/07-transformers-deep-dive/15-attention-variants/code/main.py, phases/07-transformers-deep-dive/12-kv-cache-flash-attention/code/main.py, phases/10-llms-from-scratch/16-differential-attention-v2/code/main.py, phases/10-llms-from-scratch/17-native-sparse-attention/code/main.py

| Task | Code |
|---|---|
| SWA causal mask | `swa_mask(n, window)` |
| Local plus strided mask | `strided_mask(n, window, stride)` |
| Count attended cells | `count_nonmasked(M)` |
| KV cache bytes | `kv_cache_bytes(N, n_layers, n_heads_kv, d_head, dtype=2)` |
| Flash style softmax | `tiled_softmax_dot(q, Ks, Vs, tile=4)` |
| Signal to noise of a row | `snr(weights_row, signal_pos)` |
| DIFF V1 and V2 params | `compute_param_diff(hidden=4096, n_heads=32, kv_heads=8)` |
| NSA keys per query | `count_nsa(N, l, k, W)` |

## Numbers to know
type: defaults
from: phases/07-transformers-deep-dive/12-kv-cache-flash-attention/docs/en.md, phases/07-transformers-deep-dive/15-attention-variants/docs/en.md, phases/07-transformers-deep-dive/15-attention-variants/code/main.py, phases/10-llms-from-scratch/16-differential-attention-v2/docs/en.md, phases/10-llms-from-scratch/17-native-sparse-attention/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Llama 3 70B KV per token per layer | 4096 bytes | 80 layers, 8 KV heads, fp16 |
| Llama 3 70B KV, 32K context | 10 GiB | GQA with 8 KV heads |
| Gemma 3 layer mix | 5:1 SWA:global | window=1024 |
| SWA KV at 128K context | 128× | window 1024, last W tokens |
| Gemma-3 mix KV | ~6x | vs pure full attention |
| DIFF `lambda_init` | 0.8 | learned per head |
| NSA window `W` | 512 | `l = 64, k = 16` at 64k, 25x |
| NSA at 128k | 3536 keys | 36x reduction |

## Troubleshooting
type: troubleshooting
from: phases/07-transformers-deep-dive/15-attention-variants/docs/en.md, phases/10-llms-from-scratch/16-differential-attention-v2/docs/en.md, phases/10-llms-from-scratch/17-native-sparse-attention/docs/en.md, phases/07-transformers-deep-dive/12-kv-cache-flash-attention/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| SWA model fails long-range retrieval | No global layers | Interleave full layers, 5:1 |
| Weight bleeds to token 0 | Attention sink from softmax | Differential attention |
| Lost in the middle past 32k | Softmax noise floor grows with N | DIFF from the start, or LoRA on Q |
| DIFF V1 decode slower than baseline | Value cache loaded twice | DIFF V2 |
| Late training unstable at 70B-plus | V1 per-head RMSNorm | V2 removes it |
| NSA on a dense pre-trained model | No retrofit | Continued training |
| No NSA gain under 16k | Three-branch overhead | Full attention |
| Inference-time sparsity gives small speedup | Model never routed through it | Natively trained sparsity |

## Q&A
type: qa
from: phases/07-transformers-deep-dive/15-attention-variants/docs/en.md, phases/10-llms-from-scratch/16-differential-attention-v2/docs/en.md, phases/10-llms-from-scratch/17-native-sparse-attention/docs/en.md, phases/07-transformers-deep-dive/12-kv-cache-flash-attention/docs/en.md

- **Does Flash Attention cut compute?** No. It hides the activation memory. Every token still attends to every token.
- **Why is NSA trainable?** Gradients flow through the compressed-branch scores. `top_k` only picks blocks to load.
- **Why does DIFF help more at 128k?** The noise floor grows with context. At 4k it is small.
- **Is DIFF V2 GQA compatible?** Yes. V2 adds Q heads, not KV heads.
- **NSA keys at 1024 tokens, l 32, k 4, w 128?** 32 + 128 + 128 = 288 keys, 3.5x fewer.

## Glossary
type: glossary
span: 2
from: phases/07-transformers-deep-dive/15-attention-variants/docs/en.md, phases/07-transformers-deep-dive/12-kv-cache-flash-attention/docs/en.md, phases/10-llms-from-scratch/17-native-sparse-attention/docs/en.md

- **SWA**: sliding window attention. Each query attends to its last W tokens.
- **Receptive field**: an L-layer SWA stack with window W sees up to L × W tokens.
- **Attention sink**: rows sum to 1, so uninformative queries put weight on position 0.
- **NSA**: Native Sparse Attention. Learned block sparsity, zero blocks skipped in the kernel.
- **DSA**: Deepseek Sparse Attention, the successor of NSA.
- **HBM**: High Bandwidth Memory. About 3 TB/s on H100.
- **SRAM**: per-SM on-chip memory. About 30 TB/s.
