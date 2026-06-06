# Speculative Decoding — Draft, Verify, Repeat

> Autoregressive decoding is serial. Each token waits for the previous one. Speculative decoding breaks the chain: a cheap model drafts N tokens, the expensive model verifies all N in one forward pass. When the draft is right you paid one big forward for N generations.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 07 (GPT Causal LM), Phase 7 · 12 (KV Cache & Flash Attention)
**Time:** ~60 minutes

## The Problem

A 70B LLM sampling one token takes ~30 ms on an H100. A 3B draft model takes ~3 ms. If we let the 3B draft 5 tokens ahead, then run the 70B *once* to verify all 5, the total is `5×3 + 30 = 45 ms` for up to 5 accepted tokens — versus `5×30 = 150 ms` for straight-line generation. That is the full speculative-decoding pitch: trade a small amount of extra GPU memory (draft model) for 2–4× lower decode latency.

The trick has to preserve the distribution. Speculative sampling, introduced by Leviathan et al. (2023) and by Chen et al. concurrently, guarantees that the output sequence is **identically distributed** to what the big model would have produced on its own. No quality tradeoff. Just faster.

Four families of draft-verifier pairs dominate 2026 inference:

1. **Vanilla speculative (Leviathan 2023).** Separate draft model (e.g., Llama 3 1B) + verifier (e.g., Llama 3 70B).
2. **Medusa (Cai 2024).** Multiple decoding heads on the verifier predict positions `t+1..t+k` in parallel. No separate draft model.
3. **EAGLE family (Li 2024, 2025).** Lightweight draft that reuses the verifier's hidden states; closer acceptance rate than vanilla; 3–4× typical.
4. **Lookahead decoding (Fu 2024).** Jacobi iteration; no draft model required at all. Self-speculation. Niche but dependency-free.

Every production inference stack in 2026 ships speculative decoding by default. vLLM, TensorRT-LLM, SGLang, and llama.cpp all support at least vanilla + EAGLE-2.

## The Concept

### The core algorithm

Given a verifier `M_q` and a cheaper draft `M_p`:

1. Let `x_1..x_k` be the prefix already decoded.
2. **Draft**: use `M_p` to autoregressively propose `d_{k+1}, d_{k+2}, ..., d_{k+N}` with draft probabilities `p_1..p_N`.
3. **Verify in parallel**: run `M_q` once on `x_1..x_k, d_{k+1}, ..., d_{k+N}`, getting verifier probabilities `q_1..q_{N+1}` for positions `k+1..k+N+1`.
4. **Accept/reject each draft token left to right**: for each `i`, accept with probability `min(1, q_i(d_i) / p_i(d_i))`.
5. On first rejection at position `j`: sample `t_j` from the "residual" distribution `(q_j - p_j)_+` normalized. All drafts after `j` are discarded.
6. On accepting all `N`: sample one extra token `t_{N+1}` from `q_{N+1}` (the free bonus token).

The residual distribution trick is the mathematical insight that keeps the output distributed exactly as if `M_q` had sampled from scratch.

### What determines speedup

Let `α` = expected acceptance rate per draft token. Let `c` = draft-to-verifier cost ratio. Per step:

- Naive generation makes 1 big-model call per token.
- Speculative makes 1 big-model call per `(1 - α^{N+1}) / (1 - α) ≈ 1/(1-α)` tokens when `α` is high.

Typical rule of thumb at `α = 0.75` and `N = 5`: 3× fewer big-model calls. Draft cost is 5× cheap. Total wall-clock drops ~2.5×.

**α depends on:**

- How well the draft approximates the verifier. Same family / same training data boosts α significantly.
- Decoding strategy. Greedy draft against greedy verifier: high α. Temperature sampling: harder to match; acceptance drops.
- Task type. Code and structured output accept more (predictable); free-form creative writing accepts less.

### Medusa — drafts without a draft model

Medusa replaces the draft model with extra output heads on the verifier. At position `t`:

```
shared trunk → hidden h_t
    ├── head_0: predict token at t+1  (standard LM head)
    ├── head_1: predict token at t+2
    ├── head_2: predict token at t+3
    ├── head_3: predict token at t+4
```

Each head outputs its own logits. At inference you sample from each head to get a candidate sequence, then verify with one forward pass using a tree-attention scheme that considers all candidate continuations at once.

Pros: no second model. Cons: adds trainable parameters; needs a supervised fine-tuning stage (~1B tokens); acceptance rate is a bit lower than vanilla speculative with a good draft.

### EAGLE — better draft by reusing hidden states

EAGLE-1/2/3 (Li et al., 2024–2025) makes the draft model a tiny transformer (typically 1 layer) that ingests the verifier's last-layer hidden states. Because the draft sees the verifier's feature representation, its predictions correlate strongly with the verifier's output distribution. Acceptance rates climb from ~0.6 (vanilla) to 0.85+.

EAGLE-3 (2025) added tree search over candidate continuations. vLLM and SGLang ship EAGLE-2/3 as the default spec pathway for Llama 3/4 and Qwen 3.

### The KV cache dance

Verification feeds `N` draft tokens into the verifier in one forward pass. This extends the verifier's KV cache by `N` entries. If some drafts are rejected, you must roll the cache back to the accepted prefix length.

Production implementations (vLLM's `--speculative-model`, TensorRT-LLM's LookaheadDecoder) handle this with scratch KV buffers. Write first, commit on acceptance. It's not conceptually hard, but it is fiddly.

## Build It

See `code/main.py`. We implement the core speculative-sampling algorithm (rejection step + residual distribution) with:

- A "big model" that is a deterministic-softmax over a hand-coded distribution (so we can verify acceptance math analytically).
- A "draft model" that is a perturbation of the big model.
- An acceptance / rejection loop that produces the same marginal distribution as direct sampling.

### Step 1: the rejection step

```python
def accept_or_reject(q_prob, p_prob, draft_token, u):
    ratio = q_prob / p_prob if p_prob > 0 else float("inf")
    return u < min(1.0, ratio)
```

`u` is a uniform random number. `q_prob` is the verifier's probability for the drafted token. `p_prob` is the draft model's probability. The Leviathan theorem is that this Bernoulli decision, followed by sampling from the residual on rejection, preserves the verifier's distribution exactly.

### Step 2: residual distribution

```python
def residual_dist(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    return [r / s for r in raw]
```

Subtract `p` from `q` element-wise, clamp negative values to zero, renormalize. Sample from this on any rejection.

### Step 3: one speculative step

```python
def spec_step(prefix, q_model, p_model, N, rng):
    drafts = []
    p_probs = []
    ctx = list(prefix)
    for _ in range(N):
        p_dist = p_model(ctx)
        d = sample(p_dist, rng)
        drafts.append(d)
        p_probs.append(p_dist[d])
        ctx.append(d)

    q_dists = [q_model(prefix + drafts[:i]) for i in range(N + 1)]

    for i, d in enumerate(drafts):
        u = rng.random()
        q_prob = q_dists[i][d]
        p_prob = p_probs[i]
        if u < min(1.0, q_prob / p_prob if p_prob > 0 else float("inf")):
            prefix = prefix + [d]
        else:
            res = residual_dist(q_dists[i], p_model(prefix))
            prefix = prefix + [sample(res, rng)]
            return prefix
    prefix = prefix + [sample(q_dists[N], rng)]
    return prefix
```

Five accepted → one bonus → six tokens produced in one verifier pass.

### Step 4: measure acceptance rate

Run 10,000 speculative steps at varying draft-quality levels. Plot acceptance rate vs. KL divergence between draft and verifier distributions. You should see a clean monotone relationship.

### Step 5: verify distribution equivalence

Empirically: the histogram of tokens produced by the speculative loop should match the histogram produced by sampling directly from the verifier. This is the Leviathan theorem in practice. A chi-square test confirms within sampling error.

## Use It

Production:

```bash
# vLLM with EAGLE
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-model /models/llama-3.1-eagle-70b \
    --speculative-draft-tensor-parallel-size 1 \
    --num-speculative-tokens 5

# vLLM with vanilla draft model
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-model meta-llama/Llama-3.2-1B-Instruct \
    --num-speculative-tokens 5
```

TensorRT-LLM has the fastest Medusa path as of mid-2026. `faster-whisper` wraps speculative decoding for Whisper-large with a small draft.

**Picking a draft:**

| Strategy | When to pick | Speedup |
|----------|--------------|---------|
| Vanilla draft (1B/3B Llama family) | Fast prototype, no training | 1.8–2.3× |
| Medusa heads | You can fine-tune the verifier | 2–3× |
| EAGLE-2 / 3 | Production, max speed | 3–4× |
| Lookahead | No draft, no training, no extra params | 1.3–1.6× |

**When NOT to spec-decode:**

- Single-sequence generation of 1–5 tokens. Overhead dominates.
- Wildly creative / high-temperature sampling (α drops).
- Memory-constrained deployments (draft model adds VRAM).

## Ship It

See `outputs/skill-spec-decode-picker.md`. The skill picks a speculative decoding strategy (vanilla / Medusa / EAGLE / lookahead) and tuning parameters (N, draft temperature) for a new inference workload.

## Exercises

1. **Easy.** Run `code/main.py`. Confirm the speculative token distribution matches the verifier's direct-sample distribution on 50,000 tokens within chi-square p > 0.05.
2. **Medium.** Plot speedup (tokens per big-model forward) as a function of `N` for `α = 0.5, 0.7, 0.85`. Identify the optimal `N` for each α. (Hint: expected tokens per verify call = `(1 - α^{N+1}) / (1 - α)`.)
3. **Hard.** Implement a tiny Medusa: take the capstone GPT from Lesson 14, add 3 extra LM heads that predict positions t+2, t+3, t+4. Train on tinyshakespeare with a joint multi-head loss. Compare acceptance rates vs a vanilla draft made by truncating the same model.
4. **Hard.** Implement rollback: start with a 10-token prefix KV cache, feed 5 draft tokens, simulate a rejection at position 3. Verify your cache reads correctly match "prefix + first 2 accepted drafts" at the next iteration.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Draft model | "The cheap one" | A smaller model that proposes candidate tokens; usually 10–50× cheaper than the verifier. |
| Verifier | "The big one" | The target model whose distribution we preserve; runs once per speculative step. |
| Acceptance rate (α) | "How often the draft is right" | Per-token probability that the verifier accepts the draft. 0.7–0.9 typical. |
| Residual distribution | "The rejection fallback" | `(q - p)_+` normalized; sampling from this on rejection preserves the verifier's distribution. |
| Bonus token | "The free one" | When all N drafts accepted, sample one more from the verifier's next-step distribution. |
| Medusa | "Draft-less speculative" | Multiple LM heads on the verifier predict positions t+1..t+k in parallel. |
| EAGLE | "Hidden-state draft" | Tiny transformer draft conditioned on the verifier's last-layer hidden states. |
| Lookahead decoding | "Jacobi iteration" | Self-speculation using a fixed-point iteration; no draft model. |
| Tree attention | "Verify many candidates at once" | Branching verification that considers several draft continuations simultaneously. |
| KV rollback | "Undo rejected drafts" | Scratch KV buffer; commit on acceptance, discard on reject. |

## Further Reading

- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) — the core algorithm and the equivalence theorem.
- [Chen et al. (2023). Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318) — concurrent introduction; clean Bernoulli-rejection proof.
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) — Medusa paper; tree-attention verification.
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) — EAGLE-1; hidden-state-conditioned draft.
- [Li et al. (2024). EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees](https://arxiv.org/abs/2406.16858) — EAGLE-2; dynamic tree depth.
- [Li et al. (2025). EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test](https://arxiv.org/abs/2503.01840) — EAGLE-3.
- [Fu et al. (2024). Break the Sequential Dependency of LLM Inference Using Lookahead Decoding](https://arxiv.org/abs/2402.02057) — lookahead, no-draft approach.
- [vLLM docs — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode.html) — canonical production reference with all four strategies wired up.
- [SafeAILab / EAGLE reference implementation](https://github.com/SafeAILab/EAGLE) — the reference code for EAGLE-1/2/3.
