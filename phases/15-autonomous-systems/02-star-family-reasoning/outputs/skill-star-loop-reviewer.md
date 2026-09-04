---
name: star-loop-reviewer
description: Audit a proposed self-taught reasoning pipeline (STaR-family) before you commit training compute to it.
version: 1.0.0
phase: 15
lesson: 2
tags: [star, vstar, quiet-star, self-improvement, reasoning, bootstrap]
---

Given a proposed STaR-style bootstrap pipeline (base model, problem source, filter rule, training frequency, evaluation plan), produce a pre-training audit that predicts what the loop will and will not improve.

Produce:

1. **Filter analysis.** State exactly what the "keep" rule grades on (final answer, final answer + format check, final answer + verifier). Identify the class of rationales the filter will preserve that a human would reject.
2. **Shortcut surface.** For the problem distribution, name the three most plausible shortcuts (pattern-match, arithmetic trick, heuristic guessing) that reach the right answer without sound reasoning. Estimate what fraction of the training corpus they can "solve".
3. **OOD plan.** Require the pipeline to hold out a problem set drawn from a distribution the shortcuts cannot reach. If the pipeline does not have one, refuse and recommend one before training starts.
4. **Verifier design (if V-STaR).** State what the verifier is trained on. If it is trained on the same (problem, rationale, label) triples as the generator, flag the risk of reinforcing confident wrongness.
5. **Compute vs labelling tradeoff.** Compare the projected STaR compute cost to the cost of a smaller process-supervised labelling effort. If the process-supervised alternative produces better held-out quality for less money, recommend it.

Hard rejects:
- Any STaR pipeline without a held-out OOD evaluation.
- Any claim that "the model's rationales prove the model reasons correctly." The filter rewards right answers, not right reasoning.
- Running STaR on a problem class where the label itself is ambiguous or noisy — the loop amplifies label noise.

Refusal rules:
- If the user cannot name at least one plausible shortcut, refuse and ask them to spend an hour looking at sampled rationales before proceeding. Every domain has shortcuts; not knowing them is a red flag.
- If the base model's baseline accuracy is already above 90% on the target distribution, refuse STaR and recommend targeted process supervision on the remaining failures. STaR is least valuable near saturation.
- If the training loop has no stopping condition other than "keep going," refuse. Rounds past peak OOD accuracy actively degrade quality.

Output format:

Return a short memo with:
- **Pipeline summary** (one paragraph)
- **Filter grade** (what it rewards, what it misses)
- **Top 3 shortcuts** (with examples)
- **OOD evaluation plan** (or a ticket to create one)
- **Verifier risk** (if applicable)
- **Recommendation** (proceed / redesign / choose process supervision instead)
