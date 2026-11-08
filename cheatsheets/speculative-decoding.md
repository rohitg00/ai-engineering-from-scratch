---
id: speculative-decoding
title: Speculative Decoding: Draft, EAGLE, MTP
code: SD
subtitle: Draft and verify with no quality loss. Vanilla, Medusa, EAGLE-3 and MTP drafts, speedup math, vLLM config, gates.
hue: 252
sources: phases/07-transformers-deep-dive/16-speculative-decoding, phases/10-llms-from-scratch/15-speculative-decoding-eagle3, phases/10-llms-from-scratch/18-multi-token-prediction, phases/10-llms-from-scratch/25-speculative-decoding, phases/17-infrastructure-and-production/05-eagle3-speculative-decoding, phases/19-capstone-projects/14-speculative-decoding-server
source_hash: defbe2502f92af6a
---

## Draft types side by side
type: comparison
from: phases/10-llms-from-scratch/15-speculative-decoding-eagle3/docs/en.md, phases/10-llms-from-scratch/18-multi-token-prediction/docs/en.md, phases/07-transformers-deep-dive/16-speculative-decoding/docs/en.md

| Factor | Vanilla draft | Medusa | EAGLE-3 | MTP (DeepSeek-V3) |
|---|---|---|---|---|
| Draft | Separate small LLM | Extra LM heads on verifier | Multi-layer feature fusion + TTT | 1 transformer block + projection |
| Trained when | Reuse an existing model | SFT stage on the verifier | Post-pre-training | During pre-training |
| Training cost | None | ~1B SFT tokens | ~60-200B tokens | About 10% slower pre-training |
| `α` | 0.55-0.70 | 0.65-0.75 | 0.88-0.92 | 0.80+ at depth 1 |
| Speedup | 1.8-2.3× | 2-3× | 3.5-6.5× | 1.8× |
| Second model | Yes | No | Tiny draft head | No, part of the model |
| Existing weights | Yes | Needs fine-tune | Yes | No, re-train |

## One speculative step
type: flow
from: phases/07-transformers-deep-dive/16-speculative-decoding/docs/en.md, phases/10-llms-from-scratch/15-speculative-decoding-eagle3/docs/en.md

1. **Draft**: the cheap model $M_p$ proposes $N$ tokens with probabilities $p_1 \ldots p_N$.
2. **Verify**: the verifier $M_q$ runs once on prefix plus drafts. It returns $q_1 \ldots q_{N+1}$.
3. **Accept**: walk left to right. Accept with probability $\min(1, q_i(d_i) / p_i(d_i))$.
4. **Reject**: at the first rejection, sample from $(q_j - p_j)_+$ normalized. Discard later drafts.
5. **Bonus**: when all $N$ accept, sample one more token from $q_{N+1}$.
6. **Roll back**: set the KV cache to the accepted prefix length.
7. **Result**: output is identically distributed to the verifier alone.

## The loop in code
type: annotated-code
lang: python
from: phases/10-llms-from-scratch/15-speculative-decoding-eagle3/code/main.py

```python
for i, d in enumerate(drafts):
    u = rng.random()
    ratio = q_prob / p_prob if p_prob > 0 else float("inf")   # q verifier, p draft
    if u < min(1.0, ratio):
        emitted.append(d)
        kv.extend(1)   # accepted: cache grows by one
    else:
        correction = sample(residual(q, p), rng)   # (q - p)+ renormalized
        emitted.append(correction)
        kv.truncate_to(prefix_len + len(emitted))   # KV rollback
        return emitted, 1   # one verifier forward
bonus = sample(q, rng)   # all N accepted: free token
emitted.append(bonus)
```

## Serving stack
type: architecture
from: phases/19-capstone-projects/14-speculative-decoding-server/docs/en.md

```arch
node | client | 1,1 | Request ingress | chat completions | client
node | server | 2,1 | vLLM or SGLang | one replica per GPU | process
node | draft | 3,1 | Draft | EAGLE-3 heads or ngram | model
node | target | 4,1 | Target | FP8 or INT4 quantized | gpu
node | verify | 4,2 | Verify pass | k draft tokens in one pass | process
node | stream | 3,2 | Token stream | accepted prefix to client | client
node | metrics | 2,2 | Prometheus metrics | acceptance, queue wait, p99 | store
node | hpa | 1,2 | HPA | scales on queue wait | queue
edge | client | server |
edge | server | draft |
edge | draft | target | k tokens
edge | target | verify |
edge | verify | stream | accept, resample
edge | stream | metrics |
edge | metrics | hpa |
```

## Commands
type: command-table
span: 2
from: phases/07-transformers-deep-dive/16-speculative-decoding/docs/en.md, phases/10-llms-from-scratch/15-speculative-decoding-eagle3/docs/en.md, phases/10-llms-from-scratch/25-speculative-decoding/code/main.py

| Command | What it does |
|---|---|
| `vllm serve <model> --speculative-config '{"method": "eagle", "model": "<draft>", "num_speculative_tokens": 5}'` | EAGLE draft head |
| `--speculative-config '{"method": "draft_model", "model": "meta-llama/Llama-3.2-1B-Instruct", "num_speculative_tokens": 5}'` | Vanilla draft model |
| `--speculative-config '{"model": "<draft>", "num_speculative_tokens": 5, "method": "eagle3"}'` | EAGLE-3 draft |
| `python main.py --vocab 64 --alpha 0.75 --k 4 --samples 50000` | Rejection rule, alpha sweep, tree mask demo |

## Functions in the lessons
type: task-table
from: phases/07-transformers-deep-dive/16-speculative-decoding/code/main.py, phases/10-llms-from-scratch/15-speculative-decoding-eagle3/code/main.py, phases/10-llms-from-scratch/18-multi-token-prediction/code/main.py, phases/10-llms-from-scratch/25-speculative-decoding/code/main.py, phases/17-infrastructure-and-production/05-eagle3-speculative-decoding/code/main.py, phases/19-capstone-projects/14-speculative-decoding-server/code/main.py

| Task | Code |
|---|---|
| Residual on rejection | `residual(q, p)` |
| One step with KV rollback | `spec_step(q, p, N, kv, rng)` |
| Tokens per verify | `expected_tokens_per_verify(alpha, N)` |
| Wall time per token | `wall_time_per_token(alpha, N, c)` |
| Speedup for a config | `expected_speedup(p)` |
| Tree verify mask | `tree_attention_mask(tree)` |
| Distribution check | `chi_square(observed, expected)` |
| Measured acceptance | `m.acceptance_rate(k)` |

## Speedup math
type: concepts
from: phases/10-llms-from-scratch/15-speculative-decoding-eagle3/docs/en.md, phases/10-llms-from-scratch/25-speculative-decoding/docs/en.md, phases/17-infrastructure-and-production/05-eagle3-speculative-decoding/docs/en.md, phases/10-llms-from-scratch/18-multi-token-prediction/docs/en.md

- **Tokens per verify**: $\mathbb{E}[\text{accepted}] = \frac{1 - \alpha^{N+1}}{1 - \alpha}$
- **Example**: `α = 0.8, K = 4` gives 3.36 tokens per forward.
- **Wall time per token**: `(N * c + 1) / E[accepted]`, with `c = cost(draft) / cost(verifier)`.
- **Biggest lever**: acceptance rate `α` moves the speedup more than draft length `N`.
- **Production form**: `S(alpha, K) = (1 + K*alpha) / (1 + verify_overhead)`
- **Break-even**: `alpha_breakeven = verify_overhead / K`. It rises with concurrency.
- **MTP loss**: $L_{\text{MTP}} = \frac{\lambda}{D} \sum_{k=1}^{D} L_k$, `lambda` 0.3 then 0.1.

## Script defaults
type: defaults
from: phases/10-llms-from-scratch/25-speculative-decoding/code/main.py, phases/17-infrastructure-and-production/05-eagle3-speculative-decoding/code/main.py

| Setting | Default | Note |
|---|---|---|
| `--vocab` | 32 | Vocab size, at least 2 |
| `--alpha` | 0.75 | Target acceptance rate in (0, 1] |
| `--k` | 4 | Draft length, at least 1 |
| `--samples` | 20000 | Sample count |
| `--seed` | 0 | Random seed |
| `n_tokens` | 1000 | `simulate_tail` tokens per run |

## Troubleshooting
type: troubleshooting
from: phases/17-infrastructure-and-production/05-eagle3-speculative-decoding/docs/en.md, phases/07-transformers-deep-dive/16-speculative-decoding/docs/en.md, phases/10-llms-from-scratch/15-speculative-decoding-eagle3/docs/en.md, phases/10-llms-from-scratch/25-speculative-decoding/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| No speedup after deploy | Spec decode is opt-in | Set `speculative_config` explicitly |
| Mean ITL drops, P99 ITL rises | Rejected drafts take two passes | Watch P99 ITL, tune before ship |
| `α` below 0.55 on traffic | Draft trained on general data | Train a domain draft or disable |
| `α` collapses | High-temperature creative sampling | Fall back to plain decode |
| No gain at high concurrency | Batching already fills the FLOPs | Measure break-even at that concurrency |
| Cache wrong after a reject | Entries past `j-1` stay written | Truncate to the accepted prefix |
| Gain is small on a tiny model | Draft not much cheaper | Skip spec decode under 3B |

## Use each draft when
type: tips
from: phases/07-transformers-deep-dive/16-speculative-decoding/docs/en.md, phases/10-llms-from-scratch/18-multi-token-prediction/docs/en.md, phases/17-infrastructure-and-production/05-eagle3-speculative-decoding/docs/en.md, phases/10-llms-from-scratch/15-speculative-decoding-eagle3/docs/en.md

- Use a vanilla draft for a fast prototype with no training.
- Use Medusa heads when you can fine-tune the verifier.
- Use EAGLE-2 or EAGLE-3 in production for maximum speed.
- Use lookahead when you want no draft, no training and no extra params. Expect 1.3 to 1.6×.
- Use MTP when you control pre-training and hidden size is at least 4096.
- Use spec decode for chat latency, code and JSON output, and long generations.
- Skip it for outputs under 50 tokens and batch-1 offline jobs.

## Abbreviations
type: glossary
from: phases/10-llms-from-scratch/15-speculative-decoding-eagle3/docs/en.md, phases/17-infrastructure-and-production/05-eagle3-speculative-decoding/docs/en.md, phases/10-llms-from-scratch/18-multi-token-prediction/docs/en.md, phases/19-capstone-projects/14-speculative-decoding-server/docs/en.md

- **α**: acceptance rate. Per-token chance that the verifier accepts a draft.
- **K or N**: draft length. Typical 4-8 tokens per target forward.
- **EAGLE**: tiny draft conditioned on the verifier's hidden states.
- **TTT**: training-time test. The draft sees its own outputs during training.
- **MTP**: multi-token prediction. A module predicts a token `k` positions ahead.
- **P99 ITL**: the tail metric to watch after you enable spec decode. Not P50.
- **HPA**: autoscales the server on queue wait, not CPU.

## Questions
type: qa
from: phases/07-transformers-deep-dive/16-speculative-decoding/docs/en.md, phases/10-llms-from-scratch/15-speculative-decoding-eagle3/docs/en.md, phases/10-llms-from-scratch/18-multi-token-prediction/docs/en.md, phases/17-infrastructure-and-production/05-eagle3-speculative-decoding/docs/en.md

- **Does spec decode change output quality?** No. The output matches the verifier distribution exactly.
- **Why does decode leave room for this?** Decode is memory-bound. Compute sits idle.
- **How do I read alpha in vLLM V1?** Divide `spec_decode_metrics.accepted_tokens_per_request` by draft length.
- **What did EAGLE-3 change?** It drops the feature loss and trains with training-time test.
- **Why is MTP a good draft?** Sequential modules keep the causal chain, like a decoder.
