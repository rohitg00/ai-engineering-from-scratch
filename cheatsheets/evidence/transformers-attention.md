# Evidence: cheatsheets/transformers-attention.md

Abbreviations: P07 = phases/07-transformers-deep-dive, P19 = phases/19-capstone-projects, P05A = phases/05-nlp-foundations-to-advanced/10-attention-mechanism, P10G = phases/10-llms-from-scratch/04-pre-training-mini-gpt.

## Architecture: One pre-LN decoder block
- in "Input embedding, token + position, B, T, D": P19/35-gpt-model-assembly/docs/en.md:28-32, P19/34-transformer-block/docs/en.md:30
- ln1 "LayerNorm 1": P19/34-transformer-block/docs/en.md:30
- mha "Multi head causal attention": P19/34-transformer-block/docs/en.md:31, 62
- r1 "Add residual", x + attn(ln1(x)): P19/34-transformer-block/docs/en.md:32-33, P19/34-transformer-block/code/main.py:154
- ln2 "LayerNorm 2": P19/34-transformer-block/docs/en.md:34
- mlp "Position wise MLP, D to 4D to D": P19/34-transformer-block/docs/en.md:35
- r2 "Add residual", x + mlp(ln2(x)): P19/34-transformer-block/docs/en.md:36-37, P19/34-transformer-block/code/main.py:155
- out "Final LayerNorm, LM head, logits B, T, 50257": P19/35-gpt-model-assembly/docs/en.md:38-40
- edge "x 12": P19/35-gpt-model-assembly/docs/en.md:34-37

## Flow: Attention forward
1. qkv_proj D to 3D: P19/33-multihead-self-attention/docs/en.md:25, 35; code/main.py:47, 76
2. chunk and reshape (B, H, T, d_head): P19/33-multihead-self-attention/code/main.py:55-57, 77-81; docs/en.md:57
3. scores (B, H, T, T): P19/33-multihead-self-attention/docs/en.md:59, 77
4. divide by sqrt(d_head): P19/33-multihead-self-attention/docs/en.md:63, 78; code/main.py:83
5. -inf mask, softmax over keys: P19/33-multihead-self-attention/docs/en.md:67, 79-80; code/main.py:84-87
6. weights @ V, merge to (B, T, D): P19/33-multihead-self-attention/docs/en.md:41, 88; code/main.py:90-91
7. out_proj (D, D) mixes heads: P19/33-multihead-self-attention/docs/en.md:88; code/main.py:93

## Shapes
- Token ids (B, T), int64: P19/32-token-positional-embeddings/docs/en.md:31, 51
- Token embedding (V, D): P19/32-token-positional-embeddings/docs/en.md:49
- Input (B, T, D): P19/33-multihead-self-attention/docs/en.md:31
- QKV output (B, T, 3 * D): P19/33-multihead-self-attention/docs/en.md:25
- Q, K, V (B, H, T, d_head), d_head = D // H: P19/33-multihead-self-attention/docs/en.md:31
- Scores and weights (B, H, T, T): P19/33-multihead-self-attention/docs/en.md:59, 92
- Logits (B, T, 50257): P19/35-gpt-model-assembly/docs/en.md:40
- Cross attention weights (batch, T_dec, T_enc): P05A/docs/en.md:194

## Key formulas
- Attention: P07/02-self-attention-from-scratch/docs/en.md:163
- Head width: P07/03-multi-head-attention/docs/en.md:22
- Causal mask M_ij: P07/07-gpt-causal-language-modeling/docs/en.md:29
- Sinusoidal even: P07/04-positional-encoding/docs/en.md:34
- Sinusoidal odd: P07/04-positional-encoding/docs/en.md:35
- RoPE angle, (m - n): P07/04-positional-encoding/docs/en.md:47, 50
- ALiBi: P07/04-positional-encoding/docs/en.md:59
- Stable softmax: P10G/docs/en.md:261

## Tasks in code
- masked_fill: P19/33-multihead-self-attention/code/main.py:85
- F.softmax: P19/33-multihead-self-attention/code/main.py:87
- merge heads: P19/33-multihead-self-attention/code/main.py:61
- tok + pos.unsqueeze(0): P19/33-multihead-self-attention/code/main.py:173
- pe sin fill: P19/32-token-positional-embeddings/code/main.py:112
- apply_rope: P07/04-positional-encoding/docs/en.md:104
- scaled_dot_product_attention: P07/03-multi-head-attention/docs/en.md:120
- lm_head tie: P19/35-gpt-model-assembly/code/main.py:137

## Annotated code: MultiHeadSelfAttention forward
- qkv_proj: P19/33-multihead-self-attention/code/main.py:47
- causal_mask tril, register_buffer: 52-53
- qkv, chunk, split heads: 76-81
- scores, mask_slice, masked_fill, softmax: 83-87
- merge of matmul(weights, v): 90-91 (two source lines joined into one)
- out_proj: 93; "mixes the heads" P19/33-multihead-self-attention/docs/en.md:88

## Defaults and numbers
- base 10000: P07/04-positional-encoding/docs/en.md:34, 47, 172
- mlp_expansion 4: P19/34-transformer-block/code/main.py:30
- d_head 64 (or 128): P07/03-multi-head-attention/docs/en.md:132
- init std 0.02: P19/35-gpt-model-assembly/code/main.py:147, 151
- 1 / sqrt(2 * num_layers): P19/35-gpt-model-assembly/docs/en.md:105
- d_model 768, 12 heads, 12 layers, 124M: P19/35-gpt-model-assembly/code/main.py:28-30; docs/en.md:13
- 2 * n_kv_heads * d_head * dtype_size: P07/12-kv-cache-flash-attention/docs/en.md:32
- 20 tokens per parameter: P07/13-scaling-laws/docs/en.md:53

## Troubleshooting
- ValueError d_model / n_heads: P19/33-multihead-self-attention/code/main.py:36-39
- seq_len exceeds max_context_length: P19/33-multihead-self-attention/code/main.py:73-74; crop P19/35-gpt-model-assembly/docs/en.md:132
- model cheats without mask: P19/34-transformer-block/docs/en.md:62; fix P19/33-multihead-self-attention/docs/en.md:67
- softmax inf, subtract max: P10G/docs/en.md:261
- learning stalls without scaling: P19/33-multihead-self-attention/docs/en.md:63
- post-LN diverges, pre-LN fix: P19/34-transformer-block/docs/en.md:58
- weight tying copy vs share: P19/35-gpt-model-assembly/docs/en.md:109
- extrapolation, RoPE base scaling: P07/04-positional-encoding/docs/en.md:39, 52

## Abbreviations
- MHA: P07/03-multi-head-attention/docs/en.md:34
- MQA: P07/03-multi-head-attention/docs/en.md:152
- GQA: P07/03-multi-head-attention/docs/en.md:153
- MLA: P07/03-multi-head-attention/docs/en.md:154
- RoPE: P07/04-positional-encoding/docs/en.md:19, 170
- ALiBi: P07/04-positional-encoding/docs/en.md:20, 171
- RMSNorm: P07/05-full-transformer/docs/en.md:162
- KV cache: P07/12-kv-cache-flash-attention/docs/en.md:219

## Questions
- sqrt(d_k): P07/02-self-attention-from-scratch/docs/en.md:112
- -inf: P07/07-gpt-causal-language-modeling/docs/en.md:32
- permutation invariant: P07/04-positional-encoding/docs/en.md:3, 12
- GQA N/G: P07/03-multi-head-attention/docs/en.md:39
- Flash exact via (max, sum): P07/12-kv-cache-flash-attention/docs/en.md:89

## Tips
- rows sum to 1: P19/33-multihead-self-attention/code/tests/test_attention.py:78-83
- future tokens do not change past output: P19/33-multihead-self-attention/code/tests/test_attention.py:85-91
- loss near log(V): P19/33-multihead-self-attention/docs/en.md:98
- count parameters vs reference: P19/35-gpt-model-assembly/docs/en.md:22
- dropout in two places: P19/34-transformer-block/docs/en.md:107
- attention weights not explanation: P05A/docs/en.md:175
