# Jamba — Hybrid SSM-Transformer

> State space models (SSMs) and transformers want different things. Transformers buy quality via attention at quadratic cost. SSMs buy linear-time inference and constant memory via a recurrence but lag quality. AI21's Jamba (March 2024) and Jamba 1.5 (August 2024) put them in the same model: 1 Transformer layer for every 7 Mamba layers, MoE on every other block, and a 256k context window that fits on a single 80GB GPU. Mamba-3 (ICLR 2026) tightens the SSM side with complex-valued state spaces and MIMO projections. This lesson reads both architectures end to end and explains why the hybrid recipe has survived three years of scaling when pure-SSM and pure-Transformer long-context attempts have not.

**Type:** Learn
**Languages:** Python (stdlib, layer-mix calculator)
**Prerequisites:** Phase 10 · 14 (open-model architectures), Phase 10 · 17 (native sparse attention)
**Time:** ~60 minutes

## Learning Objectives

- Explain the three primitives in a Jamba block — Transformer layers, Mamba layers, MoE — and the 1:7:even interleaving recipe.
- State what an SSM's recurrence looks like at a high level and why it enables constant-memory inference.
- Compute the KV cache footprint of a Jamba model at 256k context and compare to what a pure-Transformer model would need.
- Name the three Mamba-3 innovations (exponential-trapezoidal discretization, complex-valued state update, MIMO) and the problem each one targets.

## The Problem

Attention is quadratic in sequence length. State space models are linear. That difference compounds: at 256k tokens, a Transformer attention map is 65B entries per head; an SSM's recurrent state is fixed-size regardless of sequence length.

Pure-SSM models (Mamba, Mamba-2) match Transformer perplexity at small scales but lag on state-tracking tasks and fail on some categories of in-context retrieval. The intuition: SSMs compress history into a fixed state, and when history is long, information leaks. Attention remembers everything exactly but pays quadratic cost.

The obvious fix: use both. Put Transformer layers where exact recall matters. Use SSM layers elsewhere. Tune the ratio. Jamba is the first production-grade model to ship this hybrid recipe at scale (52B total, 12B active, 256k context, single 80GB GPU). Jamba 1.5 extends the family to 398B total / 94B active. Mamba-3 (ICLR 2026) is the current-best pure-SSM baseline that hybrids can be rebuilt around.

This lesson reads all three papers and produces the mental model for "pick the right ratio."

## The Concept

### An SSM in one page

A state space model processes a sequence `x_1, ..., x_N` via a fixed-size state `h`:

```
h_t = A h_{t-1} + B x_t
y_t = C h_t
```

At each step the state evolves via a linear dynamics `A`, takes input `B x_t`, and emits output `C h_t`. `A, B, C` can be learned. Note the critical property: computing `y_t` needs only `h_{t-1}` and `x_t`, not any earlier `x`. Memory is constant. Inference is O(1) per token.

The trick for modeling quality is the structure of `A`. S4 (Gu 2021) used a highly structured matrix that could be evaluated efficiently as a long convolution during training. Mamba (Gu, Dao 2023) replaced the fixed `A, B, C` with data-dependent ones (the "selective" part). Mamba-2 (2024) further simplified the structure. Mamba-3 (2026) re-adds complexity in specific places.

The key property: for a decoder LLM, an SSM layer is a drop-in replacement for an attention layer, with fixed-size per-layer state instead of a growing KV cache.

### The Jamba block

A Jamba block interleaves layers according to two numbers:

- `l`: the attention-to-Mamba ratio. Jamba uses `l = 8`, meaning 1 Transformer layer for every 7 Mamba layers (7 Mamba + 1 Attention = 8 layers per group).
- `e`: the MoE frequency. Jamba uses `e = 2`, meaning every other layer applies MoE.

The layer sequence within a block:

```
M  M  M  M  M  M  M  A    (7 Mamba + 1 Attention)
|  M  |  M  |  M  |  M    (where | marks MoE applied)
```

Each Jamba block is 8 layers. At 4 blocks deep (32 layers total), you get 28 Mamba and 4 Attention layers. 16 of those use MoE.

### Why the 1:7 ratio

AI21 ran ablations: what ratio of attention-to-Mamba gives the best perplexity-per-parameter AND in-context recall on their long-context evals?

- Too much attention (1:1): quality goes up but memory and speed degrade.
- Too little attention (1:15): memory is great but in-context retrieval fails.
- Sweet spot: 1:7 or 1:8.

The intuition: the Transformer layers handle exact recall and state tracking. The Mamba layers handle the cheap bulk of processing.

### Positional encoding

Mamba layers are themselves position-aware (via the recurrence). Attention layers in the original Mamba-based hybrids did not use RoPE — the SSM layers provided position info. Jamba 1.5 adds RoPE to the attention layers for longer-context generalization, a post-hoc refinement based on empirical long-context evaluation.

### The memory budget

For a Jamba-1 shape (32 layers: 28 Mamba + 4 Attention, hidden 4096, 32 attention heads):

- KV cache (attention layers only): `2 * 4 * 32 * 128 * 256k * 2 = 8.4 GB` at 256k BF16. Only the 4 attention layers contribute.
- SSM state: `28 * hidden * state_size` per token prefix, but this is a fixed-size per layer, not scaling with sequence length. Typical Mamba state is 16 per feature, hidden 4096: `28 * 4096 * 16 * 2 = 3.7 MB` total.

Compare to a pure Transformer at 32 layers, same hidden, full MHA at 32 heads: `2 * 32 * 32 * 128 * 256k * 2 = 128 GB` at 256k BF16. An 8x reduction in KV cache. Even against the GQA(8) baseline most 2024 models use (`2 * 32 * 8 * 128 * 256k * 2 = 32 GB`), Jamba's 1:7 hybrid at 16 GB is still 2x smaller.

That is what AI21 means by "256k context on a single 80GB GPU." The KV cache of a full-MHA pure Transformer would not fit; even a GQA baseline leaves no room for weights and activations; Jamba's does.

### Mamba-3: the pure-SSM baseline in 2026

Mamba-3 (ICLR 2026, arXiv:2603.15569) introduces three innovations on the pure-SSM side:

1. **Exponential-trapezoidal discretization.** Replaces the Euler-method discretization in Mamba-2 with a more expressive recurrence. Convolution-like operation applied on the state-input within the core recurrence, rather than as an outer convolution on `x_t`.

2. **Complex-valued state update.** Previous Mambas reduced the state matrix from complex (S4) to real diagonal (Mamba) to scaled identity (Mamba-2). Mamba-3 re-adds complex values — equivalent to a data-dependent rotary embedding on the state. This restores state-tracking capabilities that previous real-valued simplifications cost.

3. **Multi-input multi-output (MIMO) projections.** Instead of per-feature scalar projections, use matrix-valued projections. Improves modeling power and inference-time hardware utilization without increasing decode latency.

At 1.5B parameters, Mamba-3 improves average downstream accuracy by 0.6 points over Gated DeltaNet; the MIMO variant adds 1.2 more for a total 1.8-point gain. At the same state size, Mamba-3 matches Mamba-2 with half the state.

Mamba-3 is not yet shipping in a production hybrid at scale — but it is the obvious candidate for the SSM side of the next Jamba-class model.

### When to reach for a hybrid

Hybrids win when:

- Context is long enough that pure Transformer KV cache becomes painful (64k+).
- Tasks mix short-range structure (good for SSM) with long-range recall (needs Transformer).
- You want to deploy on single-GPU memory budgets where the Transformer KV cache alone would not fit.

Hybrids lose when:

- Context is short (under 16k). The SSM overhead is wasted; pure Transformer is fine.
- Tasks need everywhere-to-everywhere attention (deep reasoning, multi-document cross-reference). The sparsity of attention layers in the hybrid hurts.
- You are scaling to trillion-parameter frontier models. Pure-Transformer + MLA + MoE (DeepSeek-V3 style) is currently winning the capability race.

### The competitive landscape

| Model | Family | Scale | Unique claim |
|-------|--------|------|-------------|
| Mamba-2 | pure SSM | 3B | linear time, constant memory |
| Jamba | hybrid | 52B/12B | 256k on 80GB |
| Jamba 1.5 Large | hybrid | 398B/94B | enterprise-grade long-context |
| Mamba-3 | pure SSM | 1.5B (paper) | state-tracking restored |
| DeepSeek-V3 | pure Transformer + MoE | 671B/37B | frontier capability |

The 2026 landscape: pure-Transformer MoE dominates the frontier, but hybrids own the 256k-plus context niche. Mamba-3's state-tracking wins may push hybrid ratios lower (more SSM, less attention) in the next generation.

## Use It

`code/main.py` is a memory calculator for hybrid architectures. Given an SSM-Transformer ratio and a hidden-size / layer-count config, it computes:

- KV cache at target context.
- SSM state memory.
- Total memory at context N for a range of model shapes.

The calculator supports:

- Pure-Transformer baseline (KV cache grows with N).
- Jamba-style 1:7 hybrid.
- Pure-SSM (no KV cache at all).

The numbers are direct from the Jamba-1 and Jamba-1.5 papers for published shapes and extrapolated for hypothetical variants.

Integration considerations for a real deployment:

- Most production inference servers (vLLM, SGLang) support Jamba and Mamba. Check the specific version.
- At 256k context, Jamba's memory advantage shows up in concurrent-request throughput. On the same VRAM you fit more Jamba sequences than Transformer sequences.
- Mamba-3 as a standalone model is not yet shipping in production — research preview at 1.5B.

## Ship It

This lesson produces `outputs/skill-hybrid-picker.md`. Given a workload specification (context length profile, task mix, memory budget), it recommends between a pure Transformer, a Jamba-style hybrid, and a pure SSM, with explicit reasoning about the memory and quality tradeoffs.

## Exercises

1. Run `code/main.py` to compute KV cache at 256k context for a 32-layer pure Transformer (hidden 4096, 32 heads) and for a Jamba-1 hybrid of the same shape. Verify the ~8x memory reduction the AI21 paper claims.

2. Modify the calculator to model a 1:3 hybrid (4 Mamba : 1 Attention) and a 1:15 hybrid (14 Mamba : 1 Attention). Plot KV cache vs ratio. At what ratio does the KV cache equal the SSM state memory?

3. Read Section 3 of the Jamba paper (arXiv:2403.19887). Explain why AI21 uses Mamba-1 rather than Mamba-2 despite Mamba-2 being faster. Hint: the hybrid ablation section documents this.

4. Compute the parameter overhead of MoE-every-other-layer in Jamba 1.5 Large (398B total, 94B active). Compare the active ratio to DeepSeek-V3 (37B/671B) and explain why Jamba's architecture pushes the active ratio higher.

5. Read Section 3 of the Mamba-3 paper (arXiv:2603.15569). Explain in three sentences why a complex-valued state update is equivalent to a data-dependent rotary embedding. Tie the answer to Phase 7 · Lesson 04's RoPE derivation.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| State space model (SSM) | "Recurrence with a fixed state" | A layer with a learned recurrence `h_t = A h_{t-1} + B x_t`; constant memory per token |
| Selective SSM | "Mamba's trick" | Data-dependent A, B, C parameters that give the model gating-like selectivity at linear time |
| Attention-to-Mamba ratio | "How many attention layers" | In Jamba, `l = 8` means 1 attention layer per 7 Mamba layers |
| Jamba block | "The 8-layer group" | One attention + seven Mamba + MoE on alternate positions |
| SSM state | "The hidden buffer" | Fixed-size per-layer state that replaces the KV cache for Mamba layers |
| 256k context | "Jamba's flagship number" | The sequence length Jamba-1 fits on a single 80GB GPU; pure Transformer cannot at that size |
| Mamba-3 | "2026 pure SSM" | Current-best pure-SSM architecture with complex state + MIMO; the baseline hybrids rebuild around |
| MIMO | "Multi-input multi-output" | Mamba-3 innovation using matrix-valued projections instead of scalar per-feature |
| Exponential-trapezoidal discretization | "Mamba-3's recurrence" | More expressive recurrence that subsumes Mamba-2's Euler-method discretization |
| Hybrid architecture | "Mix attention and SSM" | Any model that interleaves Transformer and SSM layers; Jamba is the production archetype |

## Further Reading

- [Lieber et al. — Jamba: A Hybrid Transformer-Mamba Language Model (arXiv:2403.19887)](https://arxiv.org/abs/2403.19887) — the original Jamba paper, ratio ablations, 256k context claim
- [AI21 — Jamba 1.5: Hybrid Transformer-Mamba at Scale (arXiv:2408.12570)](https://arxiv.org/abs/2408.12570) — the scaled-up family, 398B/94B and 12B/52B public releases
- [Gu, Dao — Mamba: Linear-Time Sequence Modeling with Selective State Spaces (arXiv:2312.00752)](https://arxiv.org/abs/2312.00752) — the selective SSM paper Jamba builds on
- [Dao, Gu — Mamba-2 (arXiv:2405.21060)](https://arxiv.org/abs/2405.21060) — the simplified structured-state-space successor
- [Lahoti et al. — Mamba-3 (arXiv:2603.15569, ICLR 2026)](https://arxiv.org/abs/2603.15569) — complex-valued state, MIMO, the 2026 pure-SSM frontier
- [Gu et al. — Efficiently Modeling Long Sequences with Structured State Spaces (arXiv:2111.00396)](https://arxiv.org/abs/2111.00396) — the S4 paper, the SSM genealogy's starting point for LLMs
