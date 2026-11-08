---
id: moe-hybrid-architectures
title: Mixture of Experts and Hybrid Architectures
code: MH
subtitle: Routers, experts, aux-loss-free balance, MLA, DeepSeek-V3 counts and Jamba SSM hybrids. Formulas and stdlib calculators.
hue: 168
sources: phases/07-transformers-deep-dive/11-mixture-of-experts, phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs, phases/10-llms-from-scratch/20-deepseek-v3-walkthrough, phases/10-llms-from-scratch/21-jamba-hybrid-ssm-transformer
source_hash: 47145a3c1db1c893
---

## One MoE layer
type: architecture
from: phases/07-transformers-deep-dive/11-mixture-of-experts/docs/en.md, phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs/docs/en.md

```arch
node | tok | 1,1 | Token hidden state | after attention + norm | client
node | router | 2,1 | Router | one linear layer, scores (N_tokens, E) | process
node | bias | 3,1 | scores + bias | selection only | store
node | topk | 4,1 | Top-k selection | k of E per token | process
node | shared | 1,2 | Shared expert | every token | model
node | e1 | 2,2 | Routed expert | SwiGLU FFN | model
node | e2 | 3,2 | Routed expert | SwiGLU FFN | model
node | sum | 4,2 | Weighted sum | gates from raw scores | process
edge | tok | router |
edge | router | bias |
edge | bias | topk |
edge | topk | e1 |
edge | topk | e2 |
edge | e1 | sum |
edge | e2 | sum |
edge | shared | sum |
```

## Aux-loss-free balance loop
type: flow
from: phases/07-transformers-deep-dive/11-mixture-of-experts/code/main.py, phases/07-transformers-deep-dive/11-mixture-of-experts/docs/en.md

1. **Init**: `bias = [0.0] * n_experts`. Target usage is `n_tokens * top_k / n_experts`.
2. **Route**: select the top k by `scores + bias`.
3. **Gate**: softmax over the original scores of the chosen experts.
4. **Count**: `run_epoch` counts how often each expert fires.
5. **Update**: over target, `bias[e] -= gamma`. Under target, `bias[e] += gamma`.
6. **Repeat**: the demo uses `gamma=0.15` for 10 iterations.
7. **Check**: entropy rises toward `ln(n_experts)`, the uniform maximum.

## The router in code
type: annotated-code
lang: python
from: phases/07-transformers-deep-dive/11-mixture-of-experts/code/main.py

```python
def route(hidden, W_router, top_k, bias):
    E = len(W_router)
    scores = [sum(h * w for h, w in zip(hidden, W_router[e])) for e in range(E)]
    biased = [s + b for s, b in zip(scores, bias)]   # bias moves selection
    top_idx = sorted(range(E), key=lambda i: -biased[i])[:top_k]
    chosen = [scores[i] for i in top_idx]   # original scores, not biased
    m = max(chosen)
    exps = [math.exp(c - m) for c in chosen]
    s = sum(exps)
    gates = [e / s for e in exps]   # softmax gates sum to 1
    return top_idx, gates
```

## Calculators in the lessons
type: task-table
from: phases/07-transformers-deep-dive/11-mixture-of-experts/code/main.py, phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs/code/main.py, phases/10-llms-from-scratch/20-deepseek-v3-walkthrough/code/main.py, phases/10-llms-from-scratch/21-jamba-hybrid-ssm-transformer/code/main.py

| Task | Code |
|---|---|
| DeepSeek-V3 report | `print_report(name, cfg, ctx=131_072)` |
| Balance experts | `update_bias(bias, usage, target, gamma=0.15)` |
| Score routing balance | `entropy(counts)` |
| Count any config.json | `analyze(name, config)` |
| Name the attention | `attention_scheme(config)` |
| DeepSeek-V3 totals | `compute_totals(cfg, ctx=None)` |
| Hybrid SSM state | `ssm_state_bytes(cfg, bytes_per_elem)` |
| Hybrid KV cache | `kv_cache_bytes(cfg, ctx, bytes_per_elem)` |

## Formulas
type: concepts
from: phases/07-transformers-deep-dive/11-mixture-of-experts/docs/en.md, phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs/docs/en.md, phases/10-llms-from-scratch/20-deepseek-v3-walkthrough/docs/en.md, phases/10-llms-from-scratch/21-jamba-hybrid-ssm-transformer/docs/en.md

- **MoE params**: total is $E \times$ FFN size. Active per token is $k \times$ FFN size.
- **Sparsity**: active over total. 37/671 ≈ 5.5% for DeepSeek-V3.
- **Fine-grained**: $\binom{256}{8} \approx 400$ trillion expert sets per token.
- **KV cache**: `2 * num_layers * num_kv_heads * head_dim * max_seq_len * bytes_per_element`
- **MLA cache**: `num_layers * kv_lora_rank * max_seq_len * bytes_per_element`
- **SSM**: $h_t = A h_{t-1} + B x_t$, $y_t = C h_t$. Memory is constant per token.
- **SwiGLU width**: `ff_dim = (2/3) * 4 * hidden = 8/3 * hidden`
- **Jamba mix**: `l = 8` is 1 attention per 7 Mamba. `e = 2` is MoE on every other layer.

## DeepSeek-V3 config
type: annotated-code
lang: text
from: phases/10-llms-from-scratch/20-deepseek-v3-walkthrough/docs/en.md

```text
hidden_size: 7168              # embedding dimension
intermediate_size: 18432       # dense MLP, first 3 layers
moe_intermediate_size: 2048    # each expert MLP
num_hidden_layers: 61          # 3 dense + 58 MoE
first_k_dense_layers: 3        # dense MLP for stability
num_attention_heads: 128       # query heads
kv_lora_rank: 512              # MLA latent per token per layer
num_experts: 256               # routed experts per block
num_experts_per_tok: 8         # top-8 routing
shared_experts: 1              # always-on dense floor
mtp_module: 1                  # predicts t+2, 14B params
```

## Models side by side
type: comparison
from: phases/07-transformers-deep-dive/11-mixture-of-experts/docs/en.md, phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs/docs/en.md, phases/10-llms-from-scratch/20-deepseek-v3-walkthrough/docs/en.md, phases/10-llms-from-scratch/21-jamba-hybrid-ssm-transformer/docs/en.md

| Factor | Llama 3 70B | Mixtral 8x7B | DeepSeek V3 | Jamba |
|---|---|---|---|---|
| Family | Dense Transformer | MoE Transformer | MoE Transformer | Mamba + attention + MoE |
| Total / active | 70B / 70B | 47B / 13B | 671B / 37B | 52B / 12B |
| Experts | None | 8 experts, top-2 | 256 + 1 shared, top-8 | MoE every other layer |
| Attention | GQA (64/8) | GQA | MLA | 1 per 7 Mamba layers |
| Context | 128k | 32k | 128k | 256k on one 80GB GPU |

## Memory numbers
type: concepts
from: phases/07-transformers-deep-dive/11-mixture-of-experts/docs/en.md, phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs/docs/en.md, phases/10-llms-from-scratch/20-deepseek-v3-walkthrough/docs/en.md, phases/10-llms-from-scratch/21-jamba-hybrid-ssm-transformer/docs/en.md

- **Llama 3 8B at 128k**: KV cache 17.2 GB. The BF16 weights are 16 GB.
- **DeepSeek-V3 at 128k**: MLA cache 7.6 GB. A GQA baseline pays 30.5 GB.
- **32 layers at 256k**: full MHA 128 GB. Jamba 1:7 caches only 4 attention layers, 16 GB.
- **Jamba SSM state**: 3.7 MB total. It does not grow with sequence length.
- **671B in fp16**: about 1.3 TB of VRAM. All experts stay on GPU.
- **MTP module**: 14B on top of 671B. Overhead 2.1%.

## Calculator defaults
type: defaults
from: phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs/code/main.py, phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs/docs/en.md

| Setting | Default | Note |
|---|---|---|
| `kv_lora_rank` | 512 | MLA latent when the config omits it |
| `activation` | gelu | `swiglu` and `geglu` add a gate matrix |
| `norms_per_layer` | 2 | RMSNorm `h` each, LayerNorm `2 * h` |
| `head_dim` | hidden_size / num_attention_heads | Gemma 2 9B sets 256 |
| `layer_types` | full_attention | Every layer caches the full context |
| `rope_theta` | 10k | Llama 3 scales it to 500k |

## Troubleshooting
type: troubleshooting
from: phases/07-transformers-deep-dive/11-mixture-of-experts/docs/en.md, phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs/docs/en.md, phases/10-llms-from-scratch/21-jamba-hybrid-ssm-transformer/docs/en.md, phases/10-llms-from-scratch/20-deepseek-v3-walkthrough/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| 90% of tokens go to one expert | Router imbalance | Per-expert bias, updated outside the loss |
| Quality drops under load | Capacity overflow drops tokens | Use bias balancing, not token dropping |
| Main-task loss gets worse | Auxiliary load-balancing loss | Use the aux-loss-free scheme |
| Bias steers predictions | Gates computed from biased scores | Gate with the raw `scores` |
| Latency high on many GPUs | All-to-all expert traffic | Avoid MoE for latency-critical serving |
| KV cache larger than weights | Full MHA at long context | Use GQA or MLA |
| Hybrid fails in-context retrieval | Too little attention, 1:15 | Use 1:7 or 1:8 |
| Param count misses 525M | Untied LM head not counted | Read `tie_word_embeddings` |

## Use each design when
type: tips
from: phases/07-transformers-deep-dive/11-mixture-of-experts/docs/en.md, phases/10-llms-from-scratch/21-jamba-hybrid-ssm-transformer/docs/en.md, phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs/docs/en.md

- Use MoE for frontier quality at lower inference cost per token.
- Use MoE when you have the VRAM and expert-parallel infrastructure.
- Do not use MoE on the edge, for latency-critical single-user serving or under 7B.
- Use a hybrid at 64k+ context or on a single-GPU memory budget.
- Do not use a hybrid under 16k context or for everywhere-to-everywhere attention.
- Use GQA or MLA above ~13B parameters.
- Read the full to sliding layer ratio first in a sliding-window config.

## Abbreviations
type: glossary
from: phases/07-transformers-deep-dive/11-mixture-of-experts/docs/en.md, phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs/docs/en.md, phases/10-llms-from-scratch/20-deepseek-v3-walkthrough/docs/en.md, phases/10-llms-from-scratch/21-jamba-hybrid-ssm-transformer/docs/en.md

- **MoE**: Mixture of Experts. N MLPs per block, a router picks top-k per token.
- **GQA**: Grouped-Query Attention. G groups of Q heads share one K and one V.
- **MQA**: Multi-Query Attention. One K and one V for all heads.
- **MLA**: Multi-Head Latent Attention. K and V in a shared low-rank latent.
- **MTP**: Multi-Token Prediction. Predicts $t+2$, a free speculative draft.
- **SSM**: State space model. A recurrence with a fixed-size state.
- **MIMO**: Multi-input multi-output. Mamba-3 matrix-valued projections.

## Questions
type: qa
from: phases/07-transformers-deep-dive/11-mixture-of-experts/docs/en.md, phases/10-llms-from-scratch/20-deepseek-v3-walkthrough/docs/en.md, phases/10-llms-from-scratch/21-jamba-hybrid-ssm-transformer/docs/en.md

- **Why does bias touch selection only?** It corrects load without steering the predictions.
- **What do shared experts do?** They capture common knowledge. Routed experts specialize.
- **Why are the first 3 V3 layers dense?** Early layers skip the router for stability.
- **Why 1:7 in Jamba?** Attention does exact recall. Mamba does the cheap bulk.
- **What wins at trillion scale?** Pure Transformer + MLA + MoE, DeepSeek-V3 style.
