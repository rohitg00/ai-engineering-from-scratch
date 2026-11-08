# Evidence: cheatsheets/attention-variants.md

Abbreviations: A = phases/07-transformers-deep-dive/15-attention-variants, K = phases/07-transformers-deep-dive/12-kv-cache-flash-attention, D = phases/10-llms-from-scratch/16-differential-attention-v2, N = phases/10-llms-from-scratch/17-native-sparse-attention. d = docs/en.md, c = code/main.py.

## Variants side by side (comparison, 6 rows)
- Full attention, O(N^2), O(N) per layer, baseline: A/d:80
- SWA window 1024, O(N W), O(W) per layer, -0.1 ppl good with global layers: A/d:81
- Local + strided sparse, O(N sqrt N), mixed, similar to SWA: A/d:82
- BigBird local + global + random, O(N) approx, mixed, matches full at 2× context: A/d:83
- Native Sparse (DeepSeek-V3.2), O(N active fraction), O(N), within 0.05 ppl: A/d:84
- Differential, O(2 N^2), O(2N), -5 to -10% ppl: A/d:85

## Use X when (tips, 7)
- Full attention up to ~16K or retrieval quality paramount: A/d:176
- SWA + global mix above 32K, the 2026 default: A/d:177
- Sparse block attention, custom kernel and pattern, retrieval and audio: A/d:178
- Differential attention for sink contamination, long-context RAG, needle-in-haystack: A/d:179
- DIFF from the start for 64k-plus effective context: D/d:159
- NSA for pre-training or continued training at 64k-plus: N/d:145
- Not DIFF or NSA for a pre-trained dense model or context under 16k: D/d:164-165, N/d:150-151

## Mask builders (annotated-code, 12 lines)
- swa_mask body, lo = max(0, i - window + 1), M[i][j] = 0.0: A/c:21-27
- window >= n recovers full causal: A/d:116
- strided_mask signature and stride loop: A/c:30, 36-37
- every stride-th token back to the start: A/d:132
- render calls with window=4 and window=2, stride=3: A/c:110-111

## SWA with FlexAttention (annotated-code, 6 lines)
- import, swa_pattern, create_block_mask, flex_attention lines: A/d:163-169
- compiles to a custom Triton kernel: A/d:172

## NSA: three branches (architecture, 6 nodes, 7 edges)
- Compressed branch, block means, N/l keys: N/d:31, N/c:44-56, N/d:63
- Selected branch, top-k blocks, k*l keys: N/d:33, N/c:59-61, 148-149
- Sliding window, last W tokens: N/d:35, N/c:75-79
- KV cache fine-grained tokens loaded for selected blocks: N/c:64-72, N/d:49
- Gate, sigmoid, 3 weights: N/c:82-85
- Combination out_cmp, out_sel, out_win: N/d:40, N/c:111-113

## Flash Attention tile loop (flow, 7 steps)
1. load Q tile ~128 × 128 into SRAM: K/d:77-78
2. load K_tile, V_tile into SRAM: K/d:79-80
3. S_tile = Q_tile @ K_tile^T: K/d:81
4. running (max, sum) across tiles: K/d:82, 89
5. rescale by exp_old and add the new block: K/c:50-54
6. write O_tile to HBM, one HBM trip per tile: K/d:84, 87
7. bit-identical, O(N^2) to O(N) memory: K/d:87, 89

## Tasks in code (task-table, 8)
- swa_mask(n, window): A/c:21
- strided_mask(n, window, stride): A/c:30
- count_nonmasked(M): A/c:41
- kv_cache_bytes(N, n_layers, n_heads_kv, d_head, dtype=2): K/c:100
- tiled_softmax_dot(q, Ks, Vs, tile=4): K/c:35
- snr(weights_row, signal_pos): D/c:113
- compute_param_diff(hidden=4096, n_heads=32, kv_heads=8): D/c:244
- count_nsa(N, l, k, W): N/c:148

## Numbers to know (defaults, 8)
- 4096 bytes per token per layer, 80 layers, 8 KV heads: K/d:45, 48
- 10 GiB at 32K, GQA 8 KV heads: K/d:45, 49
- Gemma 3 5:1 SWA:global, window=1024: A/d:46, 155
- SWA KV drops 128× at 1024 window, 128K context: A/d:44
- Gemma-3 mix ~6x vs pure full attention: A/c:152
- lambda_init 0.8, learned per head: D/d:58
- NSA W typically 512, l = 64, k = 16 at 64k, 25x: N/d:35, 69
- NSA 3536 keys at 128k, 36x reduction: N/d:71

## Troubleshooting (8)
- SWA-only fails long-range retrieval, interleave full layers 5:1: A/d:46
- weight bleeds to token 0, attention sink, differential attention: A/d:60-62, 201
- lost in the middle past 32k, noise floor grows, DIFF from start or LoRA on Q: D/d:19-21, 159-160
- DIFF V1 decode slower, value cache loaded twice, V2: D/d:23, 66-70
- late training unstable at 70B-plus, V1 RMSNorm, V2 removes it: D/d:23, 74
- NSA cannot retrofit without continued training: N/d:150
- under 16k three-branch overhead dominates: N/d:151
- inference-time sparsity recovers only a fraction, model never routed: N/d:21, 51

## Q&A (5)
- Flash Attention hides activation memory, does not change arithmetic cost: A/d:12
- NSA gradients flow through compressed-branch scores, top_k only picks blocks: N/d:49
- DIFF noise floor grows with context, small at 4k: D/d:86
- DIFF V2 increases Q heads, not KV heads, GQA yes: D/d:92
- 32 + 128 + 128 = 288 keys, 3.5x fewer at l = 32, k = 4, w = 128: N/d:132

## Glossary (glossary, 7)
- SWA, last W tokens: A/d:196
- Receptive field L × W: A/d:197
- Attention sink, rows sum to 1, position 0: A/d:201
- NSA, learned block sparsity, skip zero blocks at kernel level: A/d:199
- DSA, Deepseek Sparse Attention, successor: N/d:138, 183
- HBM ~3 TB/s on H100: K/d:72, 220
- SRAM per-SM, ~30 TB/s: K/d:72, 221
