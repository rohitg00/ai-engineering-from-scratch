# Evidence: cheatsheets/moe-hybrid-architectures.md

Abbreviations: L11 = phases/07-transformers-deep-dive/11-mixture-of-experts, L14 = phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs, L20 = phases/10-llms-from-scratch/20-deepseek-v3-walkthrough, L21 = phases/10-llms-from-scratch/21-jamba-hybrid-ssm-transformer. d = docs/en.md, c = code/main.py.

## One MoE layer (architecture, 8 nodes, 8 edges)
- Token hidden state after attention + norm: L11/d:34-35, L14/d:120
- Router, single linear layer, scores (N_tokens, E): L11/d:35, L11/d:42
- scores + bias for selection only: L11/d:52, L11/d:110
- Top-k selection, k of E per token: L11/d:36, L14/d:121
- Shared expert, every token passes: L11/d:56
- First routed expert is a SwiGLU FFN: L11/d:42
- Second routed expert is a SwiGLU FFN: L11/d:42
- Weighted sum, gates from raw scores: L11/d:52, L14/d:125

## Aux-loss-free balance loop (flow, 7 steps)
1. bias = [0.0] * n_experts, target = n_tokens * top_k / n_experts: L11/c:113-114
2. selection by biased scores: L11/c:43-44
3. softmax over original scores of chosen experts: L11/c:45-49
4. run_epoch counts usage: L11/c:75-81
5. bias[e] -= gamma over target, += gamma under target: L11/c:65-72
6. gamma=0.15 for iterations 1 to 10: L11/c:122-123
7. entropy and max entropy ln(n_experts): L11/c:84-89, L11/c:126; converges to uniform: L11/d:114

## The router in code (annotated-code, 11 lines)
- route function body: L11/c:35-50
- bias affects selection, not gate weight: L11/c:38-39, L11/d:110

## Calculators in the lessons (task-table, 8)
- print_report(name, cfg, ctx=131_072): L20/c:212, L20/c:235
- update_bias(bias, usage, target, gamma=0.15): L11/c:65, L11/c:123
- entropy(counts): L11/c:84
- analyze(name, config): L14/c:212
- attention_scheme(config): L14/c:127
- compute_totals(cfg, ctx=None): L20/c:141
- ssm_state_bytes(cfg, bytes_per_elem): L21/c:38
- kv_cache_bytes(cfg, ctx, bytes_per_elem): L21/c:33

## Formulas (concepts, 8)
- Total = E x FFN size, active = k x FFN size: L11/d:14
- Sparsity 37/671 ≈ 5.5%: L11/d:162
- binom(256, 8) ≈ 400 trillion: L11/d:62
- KV cache formula: L14/d:214
- MLA cache formula: L20/d:36
- SSM recurrence, constant memory: L21/d:35-36, L21/d:40
- SwiGLU ff_dim = (2/3) * 4 * hidden = 8/3 * hidden: L14/d:85
- l = 8, e = 2: L21/d:50-51

## DeepSeek-V3 config (annotated-code, 11 lines)
- hidden_size 7168, embedding dimension: L20/d:75, L20/d:95
- intermediate_size 18432, first 3 layers: L20/d:76, L20/d:97
- moe_intermediate_size 2048: L20/d:77, L20/d:102
- num_hidden_layers 61, remaining 58 MoE: L20/d:78, L20/d:97
- first_k_dense_layers 3, dense MLP for stability: L20/d:79, L20/d:179
- num_attention_heads 128 query heads: L20/d:80, L20/d:98
- kv_lora_rank 512 latent: L20/d:83, L20/d:31
- num_experts 256: L20/d:84
- num_experts_per_tok 8, top-8: L20/d:85
- shared_experts 1, dense floor: L20/d:86, L20/d:101
- mtp_module 1, predicts t+2, 14B: L20/d:90, L20/d:64, L20/d:183

## Models side by side (comparison, 5 rows)
- Family: Llama 3 70B dense, Mixtral and DeepSeek MoE: L14/d:149, L14/d:152, L14/d:156. Jamba mixes Transformer, Mamba, MoE: L21/d:12
- Total / active: 70B/70B, 47B/13B, 671B/37B: L14/d:149, 152, 156. Jamba 52B/12B: L21/d:23
- Experts: Mixtral 8 experts top-2, DeepSeek 256 top-8: L14/d:152, L14/d:156. 1 shared: L11/d:56. Jamba MoE every other layer: L21/d:51
- Attention: GQA (64/8), GQA, MLA: L14/d:149, 152, 156. Jamba 1 per 7 Mamba: L21/d:50
- Context: 128k, 32k, 128k: L14/d:149, 152, 156. Jamba 256k on a single 80GB GPU: L21/d:23

## Memory numbers (concepts, 6)
- Llama 3 8B 128k KV 17.2 GB, weights 16 GB: L14/d:218-220
- MLA 7.6 GB, GQA 30.5 GB: L20/d:38, L20/d:45
- Full MHA 32 layers 256k 128 GB: L21/d:83. Only the 4 attention layers contribute: L21/d:80. Jamba 1:7 at 16 GB: L21/d:83
- SSM state 3.7 MB, fixed size: L21/d:81
- 671B needs ~1.3 TB fp16, all experts on GPU: L11/d:79
- MTP 14B, 2.1%: L20/d:64

## Calculator defaults (defaults, 6)
- kv_lora_rank default 512: L14/c:149
- activation default "gelu"; swiglu/geglu use gate_and_up 2*h*ff: L14/c:188-193, L14/c:200
- norms_per_layer default 2; rmsnorm norms * h else norms * 2 * h: L14/c:204-209
- head_dim default hidden_size // num_attention_heads: L14/c:139-140, L14/d:183. Gemma 2 9B 256: L14/d:183
- layer_types default full_attention for every layer: L14/c:161-165, L14/d:222
- rope_theta default 10k, Llama 3 500k: L14/d:193

## Troubleshooting (troubleshooting, 8)
- 90% of tokens through one expert, starve the others: L11/d:46. Bias outside the loss: L11/d:50
- Capacity and token dropping hurts quality: L11/d:49
- Auxiliary loss slightly degrades main-task performance: L20/d:54, aux-loss-free: L20/d:56
- Bias must not affect gate weights: L11/d:52, L11/d:110
- All-to-all communication dominates latency: L11/d:79. Not for latency-critical single-user serving: L11/d:138
- Full MHA at scale is a KV cache disaster; GQA or MLA: L14/d:104, L14/d:220
- Too little attention (1:15) fails retrieval; 1:7 or 1:8: L21/d:67-68
- Untied LM head is 525M parameters missed: L14/d:184

## Use each design when (tips, 7)
- MoE for frontier quality at lower inference cost: L11/d:132
- VRAM / expert-parallel infrastructure: L11/d:133
- Not on edge, latency-critical single-user, under 7B: L11/d:137-139
- Hybrid at 64k+ or single-GPU memory budget: L21/d:105, L21/d:107
- Not under 16k or for everywhere-to-everywhere attention: L21/d:111-112
- GQA or MLA above ~13B: L14/d:104
- Read the ratio of full to sliding layers first: L14/d:229

## Abbreviations (glossary, 7)
- MoE: L14/d:296
- GQA: L14/d:93, L14/d:294
- MQA: L14/d:91
- MLA: L14/d:95, L20/d:177
- MTP predicts t+2, free speculative-decoding draft: L20/d:183
- SSM recurrence with fixed state: L21/d:173
- MIMO matrix-valued projections: L21/d:180

## Questions (qa, 5)
- Bias corrects load imbalance without steering predictions: L11/d:110
- Shared experts capture common knowledge, routed specialize: L11/d:56
- First k dense layers skip the router for stability: L20/d:179
- Transformer layers handle exact recall, Mamba the cheap bulk: L21/d:70
- Pure-Transformer + MLA + MoE wins at trillion scale: L21/d:113
