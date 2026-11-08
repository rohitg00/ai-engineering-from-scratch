---
id: transformers-attention
title: Transformers and Attention
code: TA
subtitle: Compute attention, mask it, split heads, add positions and stack the block. PyTorch and NumPy from the lessons.
hue: 12
sources: phases/07-transformers-deep-dive/02-self-attention-from-scratch, phases/07-transformers-deep-dive/03-multi-head-attention, phases/07-transformers-deep-dive/04-positional-encoding, phases/07-transformers-deep-dive/05-full-transformer, phases/07-transformers-deep-dive/07-gpt-causal-language-modeling, phases/07-transformers-deep-dive/12-kv-cache-flash-attention, phases/07-transformers-deep-dive/13-scaling-laws, phases/07-transformers-deep-dive/14-build-a-transformer-capstone, phases/05-nlp-foundations-to-advanced/10-attention-mechanism, phases/19-capstone-projects/32-token-positional-embeddings, phases/19-capstone-projects/33-multihead-self-attention, phases/19-capstone-projects/34-transformer-block, phases/19-capstone-projects/35-gpt-model-assembly, phases/10-llms-from-scratch/04-pre-training-mini-gpt
source_hash: 06904d9e0a23754d
---

## One pre-LN decoder block
type: architecture
from: phases/19-capstone-projects/34-transformer-block/docs/en.md, phases/19-capstone-projects/34-transformer-block/code/main.py, phases/19-capstone-projects/35-gpt-model-assembly/docs/en.md

```arch
node | in | 1,1 | Input embedding | token + position, B, T, D
node | ln1 | 2,1 | LayerNorm 1 |
node | mha | 2,2 | Multi head causal attention | Q, K, V and mask
node | r1 | 1,2 | Add residual | x + attn(ln1(x))
node | ln2 | 1,3 | LayerNorm 2 |
node | mlp | 2,3 | Position wise MLP | D to 4D to D
node | r2 | 2,4 | Add residual | x + mlp(ln2(x))
node | out | 1,4 | Final LayerNorm, LM head | logits B, T, 50257
edge | in | ln1 |
edge | ln1 | mha |
edge | mha | r1 |
edge | r1 | ln2 |
edge | ln2 | mlp |
edge | mlp | r2 |
edge | r2 | out | x 12
```

## Attention forward
type: flow
from: phases/19-capstone-projects/33-multihead-self-attention/docs/en.md, phases/19-capstone-projects/33-multihead-self-attention/code/main.py

1. **qkv_proj**: one linear layer maps `(B, T, D)` to `(B, T, 3 * D)`.
2. **Split**: chunk into Q, K, V, then reshape to `(B, H, T, d_head)`.
3. **Scores**: `q @ k.transpose(-2, -1)` gives `(B, H, T, T)`.
4. **Scale**: divide the scores by `sqrt(d_head)`.
5. **Mask and softmax**: future entries get `-inf`, then softmax over keys.
6. **Weighted sum**: `weights @ V`, then merge heads to `(B, T, D)`.
7. **out_proj**: a `(D, D)` linear layer mixes the heads.

## Shapes
type: command-table
from: phases/19-capstone-projects/32-token-positional-embeddings/docs/en.md, phases/19-capstone-projects/33-multihead-self-attention/docs/en.md, phases/19-capstone-projects/35-gpt-model-assembly/docs/en.md, phases/05-nlp-foundations-to-advanced/10-attention-mechanism/docs/en.md

| Tensor | Shape |
|---|---|
| Token ids | `(B, T)`, int64 |
| Token embedding matrix | `(V, D)` |
| Input to attention | `(B, T, D)` |
| QKV projection output | `(B, T, 3 * D)` |
| Q, K, V per head | `(B, H, T, d_head)`, `d_head = D // H` |
| Scores and weights | `(B, H, T, T)` |
| Logits | `(B, T, 50257)` for GPT-2 small |
| Cross attention weights | `(batch, T_dec, T_enc)` |

## Key formulas
type: concepts
from: phases/07-transformers-deep-dive/02-self-attention-from-scratch/docs/en.md, phases/07-transformers-deep-dive/03-multi-head-attention/docs/en.md, phases/07-transformers-deep-dive/04-positional-encoding/docs/en.md, phases/07-transformers-deep-dive/07-gpt-causal-language-modeling/docs/en.md, phases/10-llms-from-scratch/04-pre-training-mini-gpt/docs/en.md

- **Attention**: $\text{Attention}(Q, K, V) = \mathop{\mathrm{softmax}}\left( \frac{Q K^T}{\sqrt{d_k}} \right) V$
- **Head width**: $d_{\text{head}} = d_{\text{model}} / n_{\text{heads}}$
- **Causal mask**: $M_{ij} = \begin{cases} 0 & \text{if } j \le i \\ -\infty & \text{if } j > i \end{cases}$
- **Sinusoidal even**: $PE_{(pos, 2i)} = \sin\left(pos / 10000^{2i / d_{\text{model}}}\right)$
- **Sinusoidal odd**: $PE_{(pos, 2i+1)} = \cos\left(pos / 10000^{2i / d_{\text{model}}}\right)$
- **RoPE angle**: $\theta_i = \text{base}^{-2i / d_{\text{head}}}$. Score depends on $(m - n)$.
- **ALiBi**: $\text{attn\_score}[i, j] = \frac{q_i \cdot k_j}{\sqrt{d}} - m_h \cdot |i - j|$
- **Stable softmax**: $\mathop{\mathrm{softmax}}(x - c) = \mathop{\mathrm{softmax}}(x)$

## Tasks in code
type: task-table
from: phases/19-capstone-projects/33-multihead-self-attention/code/main.py, phases/19-capstone-projects/32-token-positional-embeddings/code/main.py, phases/07-transformers-deep-dive/03-multi-head-attention/docs/en.md, phases/07-transformers-deep-dive/04-positional-encoding/docs/en.md, phases/19-capstone-projects/35-gpt-model-assembly/code/main.py

| Task | Code |
|---|---|
| Apply causal mask | `scores.masked_fill(mask_slice == 0, float("-inf"))` |
| Softmax over keys | `F.softmax(scores, dim=-1)` |
| Merge heads | `x.transpose(1, 2).contiguous().view(b, t, h * dh)` |
| Add positions | `x = tok + pos.unsqueeze(0)` |
| Fill sinusoidal table | `pe[:, 0::2] = torch.sin(angle)` |
| Rotate Q and K | `apply_rope(x, pos, base=10000)` |
| Fused kernel with GQA | `scaled_dot_product_attention(q, k, v, is_causal=True, enable_gqa=True)` |
| Tie LM head | `self.lm_head.weight = self.tok_embed.weight` |

## MultiHeadSelfAttention forward
type: annotated-code
lang: python
from: phases/19-capstone-projects/33-multihead-self-attention/code/main.py

```python
self.qkv_proj = nn.Linear(d_model, 3 * d_model, bias=True)  # Q, K, V in one matmul
causal_mask = torch.tril(torch.ones(max_context_length, max_context_length))
self.register_buffer("causal_mask", causal_mask, persistent=False)  # no grad
qkv = self.qkv_proj(x)                          # (B, T, 3D)
q, k, v = qkv.chunk(3, dim=-1)                  # three (B, T, D) views
q = self._split_heads(q)                        # (B, H, T, d_head)
k = self._split_heads(k)
v = self._split_heads(v)
scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(self.d_head)
mask_slice = self.causal_mask[:t, :t]           # top left (T, T)
scores = scores.masked_fill(mask_slice == 0, float("-inf"))
weights = F.softmax(scores, dim=-1)             # rows sum to 1
context = self._merge_heads(torch.matmul(weights, v))  # (B, T, D)
out = self.out_proj(context)                    # mixes the heads
```

## Defaults and numbers
type: defaults
from: phases/07-transformers-deep-dive/04-positional-encoding/docs/en.md, phases/19-capstone-projects/34-transformer-block/code/main.py, phases/07-transformers-deep-dive/03-multi-head-attention/docs/en.md, phases/19-capstone-projects/35-gpt-model-assembly/code/main.py, phases/19-capstone-projects/35-gpt-model-assembly/docs/en.md, phases/07-transformers-deep-dive/12-kv-cache-flash-attention/docs/en.md, phases/07-transformers-deep-dive/13-scaling-laws/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Sinusoidal and RoPE base | 10000 | raise RoPE base for longer context |
| mlp_expansion | 4 | MLP is D to 4D to D |
| d_head | 64 | 64 or 128 in production |
| Init std | 0.02 | Linear and Embedding weights |
| Residual projection scale | 1 / sqrt(2 * num_layers) | out_proj and fc2 |
| GPT-2 small d_model | 768 | 12 heads, 12 layers, about 124M |
| KV bytes per token per layer | `2 * n_kv_heads * d_head * dtype_size` | all KV heads, K and V |
| Compute optimal ratio | 20 | tokens per parameter |

## Troubleshooting
type: troubleshooting
from: phases/19-capstone-projects/33-multihead-self-attention/code/main.py, phases/19-capstone-projects/33-multihead-self-attention/docs/en.md, phases/19-capstone-projects/34-transformer-block/docs/en.md, phases/19-capstone-projects/35-gpt-model-assembly/docs/en.md, phases/10-llms-from-scratch/04-pre-training-mini-gpt/docs/en.md, phases/05-nlp-foundations-to-advanced/10-attention-mechanism/docs/en.md, phases/07-transformers-deep-dive/04-positional-encoding/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| `ValueError` on d_model and n_heads | D is not divisible by H | pick H that divides D |
| `seq_len` exceeds max_context_length | T is larger than the mask | crop to the last context_length tokens |
| Model cheats on next token | no causal mask | mask the upper triangle with `-inf` |
| Softmax gives `inf` | `exp` of a large number | subtract the row max first |
| Learning stalls | scores not scaled | divide by `sqrt(d_head)` |
| Deep stack diverges | post-LN on the residual path | use pre-LN |
| Weight tying saves nothing | weights copied, not shared | assign the same parameter |
| Bad output past trained length | positions do not extrapolate | use RoPE with base scaling |

## Abbreviations
type: glossary
from: phases/07-transformers-deep-dive/03-multi-head-attention/docs/en.md, phases/07-transformers-deep-dive/04-positional-encoding/docs/en.md, phases/07-transformers-deep-dive/05-full-transformer/docs/en.md, phases/07-transformers-deep-dive/12-kv-cache-flash-attention/docs/en.md

- **MHA**: Multi-head attention. N query heads, N K/V heads.
- **MQA**: Multi-Query Attention. One shared K/V projection.
- **GQA**: Grouped-Query Attention. Fewer K/V heads, repeated to match Q.
- **MLA**: Multi-head Latent Attention. K and V in a low rank latent.
- **RoPE**: Rotary Position Embeddings. Rotates Q and K by position.
- **ALiBi**: Attention with Linear Biases. Distance penalty on scores.
- **RMSNorm**: LayerNorm without the mean.
- **KV cache**: stored K and V of every prefix token.

## Questions
type: qa
from: phases/07-transformers-deep-dive/02-self-attention-from-scratch/docs/en.md, phases/07-transformers-deep-dive/07-gpt-causal-language-modeling/docs/en.md, phases/07-transformers-deep-dive/04-positional-encoding/docs/en.md, phases/07-transformers-deep-dive/03-multi-head-attention/docs/en.md, phases/07-transformers-deep-dive/12-kv-cache-flash-attention/docs/en.md

- **Why divide by sqrt(d_k)?** Large dot products saturate softmax and gradients vanish.
- **Why -inf in the mask?** exp(-inf) = 0, so future positions get zero weight.
- **Why add positions?** Attention alone is permutation invariant.
- **Why GQA?** It cuts KV cache memory by N/G with nearly full quality.
- **Is Flash Attention approximate?** No. A running (max, sum) keeps it exact.

## Tips
type: tips
from: phases/19-capstone-projects/33-multihead-self-attention/docs/en.md, phases/19-capstone-projects/33-multihead-self-attention/code/tests/test_attention.py, phases/19-capstone-projects/34-transformer-block/docs/en.md, phases/19-capstone-projects/35-gpt-model-assembly/docs/en.md, phases/05-nlp-foundations-to-advanced/10-attention-mechanism/docs/en.md

- Test that weight rows sum to 1.
- Test that future tokens do not change past outputs.
- Expect a loss near log(V) at random init.
- Count parameters against the reference model.
- Put dropout after the softmax and after the second MLP linear.
- Do not use attention weights as proof of reasoning.
