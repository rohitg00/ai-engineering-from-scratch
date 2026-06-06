# Speculative Decoding and EAGLE-3

> Phase 7 · Lesson 16 proved the math: the Leviathan rejection rule preserves the verifier's distribution exactly. This lesson is the training-stack view of 2026 production speculative decoding. EAGLE-3 turned the draft model from a cheap approximation into a purpose-built tiny network trained on the verifier's own hidden states, then added a training-time test loop that aligns its train and inference distributions. Result: 3× to 6.5× end-to-end speedup, accepted per-token rates above 0.9 on chat, no distributional tradeoff. Every production inference stack in 2026 ships it by default.

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 7 · 16 (speculative decoding math), Phase 10 · 12 (inference optimization)
**Time:** ~75 minutes

## Learning Objectives

- State the Leviathan theorem in one sentence and prove that the speculative loop produces samples identically distributed to the verifier.
- Walk the two-year progression from vanilla spec-decoding (Leviathan 2023) through EAGLE, EAGLE-2, and EAGLE-3 and name the exact limitation each step removed.
- Compute expected speedup from acceptance rate `α` and draft-to-verifier cost ratio `c`, and choose the optimal draft length `N` for each regime.
- Implement the full speculative loop from scratch: draft, verify, reject-sample from the residual, roll the KV cache back on rejection, emit the bonus token on full acceptance.

## The Problem

Autoregressive decoding on a 70B model runs at maybe 35 tokens per second on an H100. The GPU is nowhere near saturated. Memory bandwidth is the ceiling: every token loads 70B of weights from HBM, does one step of arithmetic, and produces one float. The compute units sit mostly idle.

Speculative decoding turns that into a throughput problem you can actually solve. A cheap draft proposes `N` tokens in `N` small forward passes. The verifier runs once on the prefix plus all `N` drafts. If the verifier's distribution at position `i` agrees with the draft (in a statistical sense we will make precise), we accept; if not, we reject and sample a correction from the residual distribution. A single big-model forward produces up to `N+1` accepted tokens instead of one.

The theorem that matters is Leviathan, Kalman, Matias (ICML 2023): the output distribution is identical to what sampling from the verifier directly would have produced. Not approximately. Identically. This is the entire reason speculative decoding is acceptable in production — it is a pure latency optimization with no quality tradeoff.

What Phase 7 · Lesson 16 gave you was the math. What this lesson gives you is the training stack. A good draft is worth 2× more speedup than a cheap draft. EAGLE, EAGLE-2, and EAGLE-3 (Li et al., 2024–2025) turned "draft = smaller version of the same model" into a precise engineering discipline. 2026 production inference servers default to EAGLE-3.

## The Concept

### The invariant: Leviathan rejection sampling

Let `p(t)` be the draft's distribution for the next token given some prefix, and `q(t)` be the verifier's. Sample a draft token `d ~ p`. Accept with probability `min(1, q(d) / p(d))`. On reject, sample from the residual distribution `(q - p)_+ / ||(q - p)_+||_1`. The resulting samples are distributed according to `q`. This is true regardless of how bad `p` is — the worse it is, the more often you reject, but the output remains exact.

Stack `N` of these calls back to back using one verifier forward pass on `prefix + d_1 + ... + d_N`. The verifier returns `q_1, q_2, ..., q_{N+1}` simultaneously. Walk left to right. On the first rejection at position `j`, sample from `residual(q_j, p_j)` and stop. On full acceptance, sample one bonus token from `q_{N+1}`.

### What determines speedup

Let `α` be the expected acceptance rate per drafted token. Let `c = cost(draft) / cost(verifier)` be the cost ratio. The expected number of accepted tokens per verifier forward is:

```
E[accepted] = (1 - α^(N+1)) / (1 - α)
```

The expected total wall time per accepted token is `(N * c + 1) / E[accepted]`. Minimize that with respect to `N` and you get the sweet spot. For `α = 0.8, c = 0.05`: optimal `N` is around 5–7, speedup is 3.2×. For `α = 0.95, c = 0.02`: optimal `N` is around 8–10, speedup pushes 5×.

The single biggest lever is `α`. Going from `α = 0.6` (vanilla draft) to `α = 0.9` (EAGLE-3) at fixed `N = 5` takes you from 2.2 expected accepted tokens per verifier forward to 4.1. Nearly 2× more throughput from the same verifier.

### The two-year progression

**Vanilla speculative (Leviathan, 2023).** Draft model is an independently trained smaller LLM from the same family. Easy to wire up, `α ≈ 0.6`, speedup around 2× at best.

**EAGLE-1 (Li et al., 2024).** Draft is a tiny transformer — typically one or two layers — that takes the verifier's last-layer hidden state as input and predicts the next token directly. Because the draft sees the verifier's feature representation, its distribution is much closer to the verifier's. `α` climbs to 0.7–0.8.

**EAGLE-2 (Li et al., 2024).** Adds a dynamic draft tree: instead of proposing a single sequence of `N` tokens, propose a small tree of candidates, score each with the verifier in one forward pass (tree attention), and walk the highest-probability path. Draft length becomes adaptive per step. `α` per accepted-path token climbs above 0.85.

**EAGLE-3 (Li et al., 2025, NeurIPS).** Two more changes. First, drop the feature-prediction loss entirely — EAGLE-1/2 trained the draft to match the verifier's hidden states, which caps how much data helps. EAGLE-3 trains directly on token prediction. Second, training-time test (TTT): during draft training, feed the draft's own previous predictions back as inputs over multiple steps, the same way it operates at inference. This aligns the train and test distributions and stops error accumulation. Measured speedup: up to 6.5× on chat, 38% throughput improvement at batch 64 in SGLang on H100.

### KV cache rollback

Verification extends the verifier's KV cache by `N` entries in one pass. If rejection happens at position `j`, the cache contents past position `j-1` are now wrong. Two common implementations: write to a scratch buffer and commit on acceptance (vLLM, TensorRT-LLM), or keep a physical KV cache plus a logical length and truncate on reject. Either way, the rollback cost is bytes per layer per head, which is negligible next to the forward-pass cost.

For EAGLE-2 tree search, the verifier runs attention with a non-causal mask that respects tree topology. The engineering is fiddly but the computation is a standard flash-attention call with a custom mask.

### Draft architectures in 2026

| Strategy | Draft type | `α` | Speedup | Training cost |
|----------|-----------|-----|---------|---------------|
| Vanilla | Separate small LLM | 0.55-0.70 | 1.8-2.3× | None (reuse existing small model) |
| Medusa | Extra LM heads on verifier | 0.65-0.75 | 2-3× | ~1B SFT tokens |
| EAGLE-1 | 1-layer transformer on hidden states | 0.70-0.80 | 2.5-3× | ~60B tokens |
| EAGLE-2 | EAGLE-1 + dynamic draft tree | 0.80-0.88 | 3-4× | ~60B tokens |
| EAGLE-3 | Multi-layer feature fusion + TTT | 0.88-0.92 | 3.5-6.5× | ~60-200B tokens |
| Lookahead | No draft (Jacobi iteration) | N/A | 1.3-1.6× | None |

In 2026 production: vLLM and SGLang default to EAGLE-3 when available, EAGLE-2 otherwise. TensorRT-LLM has the fastest Medusa path for Meta and NVIDIA public models. llama.cpp ships vanilla draft for CPU deployments.

## Build It

See `code/main.py`. This is the full Leviathan speculative loop with all the pieces: draft-of-N, verifier parallel pass, per-position rejection, residual sampling, bonus token, KV rollback, and empirical verification that the output distribution matches direct sampling from `q`.

### Step 1: the rejection rule

```python
def accept(q_prob, p_prob, u):
    if p_prob <= 0:
        return True
    return u < min(1.0, q_prob / p_prob)
```

### Step 2: residual distribution

```python
def residual(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    if s == 0:
        return list(q)
    return [r / s for r in raw]
```

### Step 3: a full speculative step

The `spec_step` function drafts `N` tokens from `p`, then verifies all of them in one parallel `q` evaluation. For each drafted token it applies the rejection rule, and on the first rejection it samples the correction from the residual. If everything accepts, it emits a bonus token from `q_{N+1}`.

### Step 4: KV rollback bookkeeping

The simulator tracks a logical `kv_length` per worker. On acceptance of `k` drafts, `kv_length += k`. On a rejection at position `j`, the cache is already written past `j`, but the logical length is set to `prefix_length + j + 1` — one past the correction token. Subsequent reads truncate to the logical length.

### Step 5: the Leviathan check

Run 50,000 speculative steps. Count the empirical distribution of accepted tokens. Compare to 50,000 direct samples from `q`. The chi-square statistic should be well under the critical value. The theorem passes in practice.

### Step 6: speedup vs. α

Sweep the draft quality by perturbing `p` away from `q` at different amplitudes. Measure `α`, then plot expected tokens per verifier call as a function of `α` and `N`. The code prints a table showing how EAGLE-3-class draft quality (`α ≈ 0.9`) unlocks 4–5 tokens per verifier call.

## Use It

Production-level `vllm serve` with EAGLE-3:

```bash
vllm serve meta-llama/Llama-3.3-70B-Instruct \
  --speculative-config '{
    "model": "yuhuili/EAGLE3-LLaMA3.3-Instruct-70B",
    "num_speculative_tokens": 5,
    "method": "eagle3"
  }'
```

SGLang with EAGLE-3 at batch 64 on H100: roughly 1.38× more throughput than batch-64 vanilla decoding, per the EAGLE-3 paper.

When to reach for speculative decoding:

- Any interactive chat workload where p50 latency matters more than peak throughput.
- Code generation and structured output (JSON, SQL). `α` is above 0.9 because the target distribution is highly predictable.
- Long-form generation (thousands of tokens). The amortized speedup keeps paying.

When not to:

- Very small models (< 3B). The draft is not that much cheaper than the verifier.
- Tiny batch-1 CPU deployments. Memory overhead of the draft model may not be worth it.
- Very-high-temperature creative sampling where `α` collapses.

## Ship It

This lesson produces `outputs/skill-eagle3-tuner.md`. Given an inference workload (model, batch size, target latency, task profile), it recommends a speculative-decoding strategy and tuning parameters (draft family, `N`, tree depth, temperature-aware switching).

## Exercises

1. Run `code/main.py`. Confirm the chi-square statistic on the Leviathan distribution check stays below the 95% critical value on 50,000 samples.

2. Sweep `N` from 1 to 10 with `α` held at 0.9 and `c` held at 0.04. Plot expected tokens per verifier call and actual wall time per token. Find the `N` that minimizes wall time. Explain the shape of the curve.

3. Modify the code to simulate EAGLE-2 tree search: at each step, the draft proposes a tree of shape `[2, 2, 2]` (eight candidate paths). The verifier runs once, and the highest-probability accepted path wins. Compute `α` per leaf and total tokens per verifier call. Compare to linear-chain spec-decoding at equivalent compute.

4. Implement a batched KV rollback simulator for two concurrent sequences. Sequence A has all drafts accepted; sequence B rejects at position 2. Show that the correct `kv_length` is updated per sequence and that no work is wasted.

5. Read the EAGLE-3 paper's Section 4 (Training-Time Test). Explain in two sentences why naive draft training without TTT suffers from exposure bias, and why feeding the draft its own predictions during training fixes it. Connect this to the scheduled-sampling literature in seq2seq.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Leviathan rule | "min(1, q over p)" | Bernoulli accept/reject with probability `min(1, q(d)/p(d))`, preserves the verifier distribution exactly when you sample from the residual on rejection |
| Residual distribution | "(q minus p) plus, normalized" | `(q - p)_+` clamped at zero and renormalized — the correct distribution to sample from on rejection |
| Acceptance rate α | "how often the draft is right" | Expected per-token Bernoulli-success probability under the rejection rule; governs all speedup math |
| EAGLE-1 | "hidden-state draft" | Tiny transformer draft conditioned on the verifier's last-layer hidden state (Li et al., 2024) |
| EAGLE-2 | "dynamic draft tree" | EAGLE-1 plus a tree of candidate continuations scored with tree attention in one verifier pass |
| EAGLE-3 | "training-time test" | Drops the feature-prediction loss, trains on direct token prediction with the draft fed its own outputs during training |
| Training-time test (TTT) | "exposure bias fix" | Run the draft autoregressively during training so train and test input distributions match — the direct analog of scheduled sampling |
| KV rollback | "undo rejected drafts" | Bookkeeping that resets the verifier's KV cache to the accepted-prefix length after a rejection |
| Bonus token | "the free one" | When all `N` drafts accept, sample one extra from `q_{N+1}` at no additional verifier cost |
| Tree attention | "verify many candidates at once" | Attention with a non-causal mask that respects the topology of a draft tree; computes `q_i` for every node in the tree in one forward pass |

## Further Reading

- [Leviathan, Kalman, Matias — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192, ICML 2023)](https://arxiv.org/abs/2211.17192) — the foundational paper and equivalence theorem
- [Chen et al. — Accelerating Large Language Model Decoding with Speculative Sampling (arXiv:2302.01318)](https://arxiv.org/abs/2302.01318) — concurrent independent introduction with a clean proof
- [Li et al. — EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty (arXiv:2401.15077)](https://arxiv.org/abs/2401.15077) — EAGLE-1, hidden-state-conditioned draft
- [Li et al. — EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees (arXiv:2406.16858)](https://arxiv.org/abs/2406.16858) — dynamic tree search
- [Li et al. — EAGLE-3: Scaling up Inference Acceleration via Training-Time Test (arXiv:2503.01840, NeurIPS 2025)](https://arxiv.org/abs/2503.01840) — the 2026 production default
- [Cai et al. — Medusa: Multiple Decoding Heads (arXiv:2401.10774)](https://arxiv.org/abs/2401.10774) — alternative draft-free approach
- [vLLM Speculative Decoding documentation](https://docs.vllm.ai/en/latest/features/spec_decode.html) — canonical production reference with all strategies wired up
