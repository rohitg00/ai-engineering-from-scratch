# Evidence: cheatsheets/positional-encoding.md

Abbreviations: PE = phases/07-transformers-deep-dive/04-positional-encoding, CE = phases/19-capstone-projects/32-token-positional-embeddings, OM = phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs. d = docs/en.md, c = code/main.py.

## Side by side (comparison, 5 rows)
- Absolute sinusoidal, poor, free, original transformer, early BERT: PE/d:68. Added to embeddings: PE/d:39. Sum: CE/d:45
- Learned absolute, none, tiny, GPT-2, GPT-3: PE/d:69. Lookup table: CE/d:25
- RoPE, good with scaling, free, Llama 2/3/4, Qwen 2/3, Mistral, DeepSeek-V3, Kimi: PE/d:70. Rotates Q and K: PE/d:43
- RoPE + YaRN, excellent, fine-tune stage, Qwen2-1M, Llama 3.1 128K: PE/d:71
- ALiBi, excellent, free, BLOOM, MPT, Baichuan: PE/d:72. Acts on attention scores: PE/d:56-59

## Where each scheme acts (architecture, 8 nodes, 7 edges)
- Token ids (B, T): CE/d:31, 35
- Token embedding (B, T, D): CE/d:31, 51
- Add absolute PE before attention, sinusoidal or learned: PE/d:39, CE/d:25, 79
- Q and K, RoPE rotates Q and K: PE/d:43, 116
- Scores q dot k over sqrt d: PE/d:12, 59
- ALiBi bias minus m_h times distance: PE/d:59, 62
- Softmax then times V: PE/d:12, 131
- RoPE and ALiBi act at the attention step: CE/d:106

## The three schemes in code (annotated-code, 12 lines)
- def sinusoidal_pe(n, d, base=10000.0): PE/c:11
- theta = pos / (base ** (2 * i / d)): PE/c:15
- pe[pos][2 * i] = math.sin(theta), pe[pos][2 * i + 1] = math.cos(theta): PE/c:16-17
- def apply_rope(x, pos, base=10000.0): PE/c:21. call on Q and K: PE/d:116
- c = math.cos(theta), out[2 * i] = a * c - b * s, out[2 * i + 1] = a * s + b * c: PE/c:27, 31-32
- def alibi_slopes(n_heads) and slope expression: PE/c:40-41
- row.append(float("-inf")) for causal and j > i: PE/c:52-53
- row.append(-m * abs(i - j)): PE/c:55

## Tasks in code (task-table, 8)
- sinusoidal_pe(n, d, base=10000.0): PE/c:11
- apply_rope(x, pos, base=10000.0): PE/c:21
- alibi_bias(n_heads, seq_len, causal=True): PE/c:44
- LearnedPositionalEmbedding(max_context_length, d_model): CE/c:54-62, 214
- SinusoidalPositionalEmbedding(max_context_length, d_model), buffer: CE/c:91, 103, 215
- EmbeddingComposer(token_emb, learned_pos): CE/c:217
- neighbour_cosine_curve(table, max_offset=8): CE/c:169
- python3 code/main.py: CE/c:11

## Check the RoPE relative property (flow, 6)
1. rng.gauss(0, 1), d = 16: PE/c:73-75
2. apply_rope(q, pq), apply_rope(k, pk): PE/c:80-81. same function: PE/d:116
3. dot(q_rot, k_rot), pairs (3, 5), (7, 9), (100, 102), (1024, 1026): PE/c:77, 82
4. gap=2 matching dot products: PE/c:84. within floating-point error: PE/d:135
5. pos=4096, pos=4098, base 10000, 100000, 1_000_000: PE/c:95-97
6. larger base slower rotation, no phase wrap: PE/c:99

## Defaults and numbers (defaults, 8)
- base 10000.0: PE/c:11, 21
- rope_theta 500000.0, scaled from 10k: OM/d:173, 193
- causal True, masks j > i: PE/c:44, 52-53
- DEFAULT_INIT_STD 0.02: CE/c:23
- max_offset 8: CE/c:169
- max_context_length 128, DemoConfig: CE/c:195, 198
- d_model 64, try 32: CE/c:197, CE/d:114
- GPT-2 learned table 1024, context 1025 off the end: OM/d:65

## Long context with RoPE (concepts, 6)
- base frequency scaler, increase to extend context: PE/d:172
- NTK-aware base * (scale_factor)^(d/(d-2)), 4K to 16K+: PE/d:149
- YaRN preserves attention entropy, Llama 3.1 128K: PE/d:150, 174
- LongRoPE evolutionary search, Phi-3-Long: PE/d:151
- Position interpolation, fine-tune 1–5B tokens: PE/d:152
- Llama 3 8K to 128K: PE/d:52. 8k to 128k with scaling: OM/d:67

## Config fields to read (command-table, 8)
- rope_theta RoPE base frequency: OM/d:193
- max_position_embeddings training context length: OM/d:192
- model.config.rope_scaling, type yarn, factor: PE/d:144
- "position": "rope-yarn", Qwen 2.5 72B: OM/c:87, 93
- "position": "rope-sliding", Gemma 2 9B: OM/c:55, 61. Hybrid: OM/d:75
- "position": "learned", GPT-2 Small, 1024: OM/c:22, 26, 28
- sliding_window last W tokens: OM/d:185, OM/c:64
- layer_types full or sliding: OM/d:185, OM/c:63

## Troubleshooting (troubleshooting, 8)
- seq_len exceeds max_context_length: CE/c:76-78, 119-121
- d_model must be even for sinusoidal: CE/c:97-98
- token and positional embeddings must share d_model: CE/c:147-148
- shuffled tokens give shuffled output, no position signal: PE/d:12, 16
- learned model past trained length, row does not exist: CE/d:59, OM/d:65-67
- sinusoidal fails beyond max_len: PE/d:39
- rotate both Q and K with the same function: PE/d:116
- raise base for long context, phase wrap: PE/d:172, PE/c:99. YaRN: PE/d:150

## Use X when (tips, 6)
- RoPE for new decoder, every Llama, Mistral, Qwen, DeepSeek, and Gemma: OM/d:75, PE/d:22
- RoPE + YaRN, fine-tune stage: PE/d:71
- ALiBi, extrapolation, no embedding needed: PE/d:20, 171
- sinusoidal parameter-free, historical: CE/d:71, PE/d:22
- learned absolute bounded by max context, GPT-2: CE/d:59, OM/d:65
- RoPE and ALiBi at the attention-projection step: CE/d:106

## Questions (qa, 6)
- order-blind, shuffled rows: PE/d:12
- cos((m-n) theta_i) factor: PE/d:116
- sum keeps D constant: CE/d:45
- learned adds max_context_length * D, sinusoidal zero: CE/d:100
- RoPE won: no architecture change, relative, base knob: PE/d:74
- learned near-random at init, sinusoidal smooth decay: CE/d:102
