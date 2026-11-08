---
id: positional-encoding
title: Positional Encoding: Sinusoidal, RoPE, ALiBi
code: PR
subtitle: Pick, build and check a position scheme. Sinusoidal, learned, RoPE, YaRN and ALiBi side by side, in Python.
hue: 285
sources: phases/07-transformers-deep-dive/04-positional-encoding, phases/19-capstone-projects/32-token-positional-embeddings, phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs
source_hash: c52bb51c4688d3d8
---

## Side by side
type: comparison
from: phases/07-transformers-deep-dive/04-positional-encoding/docs/en.md, phases/19-capstone-projects/32-token-positional-embeddings/docs/en.md

| Scheme | Acts on | Extrapolation | Training cost | Used by |
|---|---|---|---|---|
| Absolute sinusoidal | Embeddings, sum | poor | free | original transformer, early BERT |
| Learned absolute | Embeddings, lookup | none | tiny | GPT-2, GPT-3 |
| RoPE | Rotates Q and K | good with scaling | free | Llama 2/3/4, Qwen 2/3, Mistral, DeepSeek-V3, Kimi |
| RoPE + YaRN | Rotates Q and K | excellent | fine-tune stage | Qwen2-1M, Llama 3.1 128K |
| ALiBi | Attention scores | excellent | free | BLOOM, MPT, Baichuan |

## Where each scheme acts
type: architecture
from: phases/07-transformers-deep-dive/04-positional-encoding/docs/en.md, phases/19-capstone-projects/32-token-positional-embeddings/docs/en.md

```arch
node | ids | 1,1 | Token ids | (B, T) | client
node | tok | 2,1 | Token embedding | (B, T, D) | store
node | abs | 3,1 | Add absolute PE | sinusoidal or learned | process
node | qk | 4,1 | Q and K | per head | process
node | rope | 4,2 | RoPE | rotate Q and K | process
node | score | 3,2 | Scores | q dot k over sqrt d | process
node | alibi | 2,2 | ALiBi bias | minus m_h times distance | process
node | soft | 1,2 | Softmax | then times V | process
edge | ids | tok | lookup
edge | tok | abs | sum
edge | abs | qk | X
edge | qk | rope | pos
edge | rope | score | dot
edge | score | alibi | add
edge | alibi | soft |
```

## The three schemes in code
type: annotated-code
lang: python
from: phases/07-transformers-deep-dive/04-positional-encoding/code/main.py

```python
def sinusoidal_pe(n, d, base=10000.0):  # add to embeddings
    theta = pos / (base ** (2 * i / d))  # one frequency per pair i
    pe[pos][2 * i] = math.sin(theta)  # even dim
    pe[pos][2 * i + 1] = math.cos(theta)  # odd dim
def apply_rope(x, pos, base=10000.0):  # call on Q and on K
    c = math.cos(theta)  # same theta as above
    out[2 * i] = a * c - b * s  # 2D rotation of pair i
    out[2 * i + 1] = a * s + b * c
def alibi_slopes(n_heads):  # one slope per head
    return [2 ** (-8 * (h + 1) / n_heads) for h in range(n_heads)]
row.append(-m * abs(i - j))  # bias for head slope m
row.append(float("-inf"))  # causal and j > i
```

## Tasks in code
type: task-table
span: 2
from: phases/07-transformers-deep-dive/04-positional-encoding/code/main.py, phases/19-capstone-projects/32-token-positional-embeddings/code/main.py, phases/19-capstone-projects/32-token-positional-embeddings/docs/en.md

| Task | Code |
|---|---|
| Sinusoidal table, n positions | `sinusoidal_pe(n, d, base=10000.0)` |
| Rotate one Q or K vector | `apply_rope(x, pos, base=10000.0)` |
| ALiBi bias per head | `alibi_bias(n_heads, seq_len, causal=True)` |
| Learned table, one row per position | `LearnedPositionalEmbedding(max_context_length, d_model)` |
| Fixed table as a buffer | `SinusoidalPositionalEmbedding(max_context_length, d_model)` |
| Sum token and position vectors | `EmbeddingComposer(token_emb, learned_pos)` |
| Neighbour similarity diagnostic | `neighbour_cosine_curve(table, max_offset=8)` |
| Run the demo | `python3 code/main.py` |

## Check the RoPE relative property
type: flow
from: phases/07-transformers-deep-dive/04-positional-encoding/code/main.py, phases/07-transformers-deep-dive/04-positional-encoding/docs/en.md

1. **Vectors**: draw `q` and `k` with `rng.gauss(0, 1)`, `d = 16`.
2. **Rotate**: `apply_rope(q, pq)` and `apply_rope(k, pk)` with the same function.
3. **Score**: `dot(q_rot, k_rot)` for pairs (3, 5), (7, 9), (100, 102), (1024, 1026).
4. **Expect**: all rows with gap=2 give the same dot product within floating-point error.
5. **Base sweep**: score at `pos=4096` and `pos=4098` for base 10000, 100000, 1_000_000.
6. **Read**: larger base gives slower rotation and longer context without phase wrap.

## Defaults and numbers
type: defaults
from: phases/07-transformers-deep-dive/04-positional-encoding/code/main.py, phases/19-capstone-projects/32-token-positional-embeddings/code/main.py, phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs/docs/en.md

| Setting | Default | Note |
|---|---|---|
| `base` | `10000.0` | Sinusoidal and RoPE |
| `rope_theta` | `500000.0` | Llama 3 8B, scaled from 10k |
| `causal` | `True` | `alibi_bias` masks `j > i` |
| `DEFAULT_INIT_STD` | `0.02` | Learned table init |
| `max_offset` | `8` | `neighbour_cosine_curve` |
| `max_context_length` | `128` | `DemoConfig` |
| `d_model` | `64` | Try 32, watch the bands |
| GPT-2 learned table | 1024 | Context 1025 is off the end |

## Long context with RoPE
type: concepts
from: phases/07-transformers-deep-dive/04-positional-encoding/docs/en.md, phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs/docs/en.md

- **base**: the RoPE frequency scaler. Increase it to extend context at inference.
- **NTK-aware**: rescale `base` to `base * (scale_factor)^(d/(d-2))` when extending from 4K to 16K+.
- **YaRN**: per-dimension interpolation that preserves attention entropy. Llama 3.1 128K uses it.
- **LongRoPE**: evolutionary search picks per-dimension scale factors. Phi-3-Long uses it.
- **Position interpolation**: shrink positions by the extension factor. Fine-tune for 1–5B tokens.
- **Result**: Llama 3 extended from 8K to 128K context with RoPE scaling.

## Config fields to read
type: command-table
from: phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs/docs/en.md, phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs/code/main.py, phases/07-transformers-deep-dive/04-positional-encoding/docs/en.md

| Command | What it does |
|---|---|
| `rope_theta` | RoPE base frequency |
| `max_position_embeddings` | Training context length |
| `model.config.rope_scaling` | Scaling type and factor, for example yarn |
| `"position": "rope-yarn"` | Qwen 2.5 72B in the calculator |
| `"position": "rope-sliding"` | Gemma 2 9B, RoPE plus sliding layers |
| `"position": "learned"` | GPT-2 Small, 1024 positions |
| `sliding_window` | Last W tokens for sliding layers |
| `layer_types` | Which layers are full or sliding |

## Troubleshooting
type: troubleshooting
from: phases/19-capstone-projects/32-token-positional-embeddings/code/main.py, phases/19-capstone-projects/32-token-positional-embeddings/docs/en.md, phases/07-transformers-deep-dive/04-positional-encoding/docs/en.md, phases/07-transformers-deep-dive/04-positional-encoding/code/main.py, phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| `seq_len <n> exceeds max_context_length <L>` | Input longer than the table | Raise `max_context_length` |
| `d_model must be even for sinusoidal` | Odd `d_model` | Use an even `d_model` |
| `token and positional embeddings must share d_model` | Two widths | Build both with one `d_model` |
| Output the same for shuffled tokens | No position signal | Add a position scheme |
| Learned model fails past trained length | The row does not exist | Use RoPE with scaling |
| Sinusoidal fails beyond `max_len` | No training at those positions | Use RoPE or ALiBi |
| Same gap, different RoPE scores | Rotation on Q or K only | Rotate both with `apply_rope` |
| Long context degrades with RoPE | Phase wrap at small base | Raise `base`, try YaRN |

## Use X when
type: tips
from: phases/07-transformers-deep-dive/04-positional-encoding/docs/en.md, phases/19-capstone-projects/32-token-positional-embeddings/docs/en.md, phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs/docs/en.md

- Use RoPE for a new decoder model. Every Llama, Mistral, Qwen, DeepSeek, and Gemma uses RoPE.
- Use RoPE + YaRN when you extend context and can pay a fine-tune stage.
- Use ALiBi when length extrapolation matters most and you want no embeddings.
- Use sinusoidal when you want a parameter-free input table. It is historical for frontier models.
- Use learned absolute only with a fixed maximum context, as in GPT-2.
- Apply RoPE and ALiBi at the attention step, not at the input.

## Questions
type: qa
from: phases/07-transformers-deep-dive/04-positional-encoding/docs/en.md, phases/19-capstone-projects/32-token-positional-embeddings/docs/en.md, phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs/docs/en.md

- **Why does attention need position?** It is order-blind. Shuffled rows of `X` give shuffled output rows.
- **Why is RoPE relative?** The dot product picks up a cos of the gap times theta on each pair.
- **Sum or concatenate?** Sum. It keeps `D` constant through the network.
- **Parameter cost?** Learned adds `max_context_length * D`. Sinusoidal adds zero.
- **Why did RoPE win?** No architecture change, relative position, and a `base` knob for long context.
- **Learned vs sinusoidal at init?** Learned neighbours look random. Sinusoidal decays smoothly.
