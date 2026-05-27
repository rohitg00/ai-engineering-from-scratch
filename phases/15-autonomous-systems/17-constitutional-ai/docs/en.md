# Constitutional AI and Rule Overrides

> Anthropic's January 22, 2026 Claude Constitution runs 79 pages and is CC0. It moves from rule-based to reason-based alignment and establishes a four-tier priority hierarchy: (1) safety and supporting human oversight, (2) ethics, (3) Anthropic guidelines, (4) helpfulness. Behaviours split into hardcoded prohibitions (bioweapons uplift, CSAM) that operators and users cannot override and soft-coded defaults that operators can adjust within defined bounds. The 2022 original (Bai et al.) trained harmlessness via self-critique and RLAIF against a constitution. The honest caveat: reason-based alignment relies on the model generalising principles to unanticipated situations. Anthropic's own 2023 participatory experiment showed ~50% divergence between public-sourced and corporate principles; the 2026 version did not incorporate those findings.

**Type:** Learn
**Languages:** Python (stdlib, four-tier priority resolver)
**Prerequisites:** Phase 15 · 06 (Automated alignment research), Phase 15 · 10 (Permission modes)
**Time:** ~60 minutes

## The Problem

A fielded agent sees inputs that its designers never saw. No rule list is long enough to cover them. No rule list is short enough to apply quickly under compute pressure. The practical question: how do you align an agent to principles that survive both a long tail of cases and fast inference?

Rule-based alignment (RBA): list every disallowed thing. Fast to check, easy to audit, impossible to keep current, often over-refuses on close analogs it didn't anticipate. Reason-based alignment (the 2026 Claude Constitution): encode principles, let the model reason. Scales across unseen cases, harder to audit, failure mode is principle-misapplication rather than miss-the-rule.

The 2026 Constitution takes an explicit middle position. Hardcoded prohibitions — things whose wrongness does not depend on context (bioweapons uplift, CSAM) — are RBA: never, regardless of operator or user instruction. Everything else is reason-based within a four-tier hierarchy: safety and supporting human oversight first; ethics second; Anthropic-declared guidelines third; helpfulness last. Operators can adjust defaults within the soft-coded zone but cannot touch the hardcoded prohibitions.

## The Concept

### The four-tier priority hierarchy

1. **Safety and supporting human oversight.** Highest. The model prioritises not undermining the ability of humans and Anthropic to supervise and correct AI. This is not "be cautious"; it is specifically "do not act in ways that make human oversight harder."
2. **Ethics.** Honesty, avoiding harm to persons, not deceiving, not manipulating. Supersedes Anthropic's guidelines when they conflict.
3. **Anthropic guidelines.** Operational norms Anthropic has decided matter: product scope, interaction patterns, what tools to use when.
4. **Helpfulness.** Lowest. Be as useful as possible within the higher priorities.

When tiers conflict, higher wins. This is the same shape as Unix priorities or network QoS — the framing is meant to produce predictable resolution, not necessarily best-case behaviour on any single axis.

### Hardcoded prohibitions vs soft-coded defaults

**Hardcoded:**
- Bioweapons / CBRN uplift
- CSAM
- Attacks on critical infrastructure
- Deception of users about the model's identity when asked directly

The operator cannot override these. The user cannot override these. They are enforced at the model-weights level where possible (RLHF / Constitutional AI training) and at the inference layer where not.

**Soft-coded defaults (operator-adjustable):**
- Response length defaults
- Topical scope (the model can refuse topics outside the operator's deployment)
- Style (formal vs casual)
- Tool-use patterns

Operator adjustments happen inside a declared bound. The operator cannot remove the hardcoded prohibitions by renaming them.

### The 2022 CAI training

The original Constitutional AI (Bai et al., 2022) trained harmlessness:

1. Generate responses to a set of prompts.
2. Ask the model to critique each response against a constitution (explicit principles).
3. Revise the response based on the critique.
4. RLAIF (reinforcement learning from AI feedback) on the revised pairs.

Result: a model that refuses harmful requests with principled explanations, not blanket refusals. The 2026 Constitution uses a descendant of this training plus additional post-training on the explicit tier hierarchy.

### What reason-based alignment catches and misses

**Catches:**
- Unanticipated combinations of allowed primitives where the principle applies clearly.
- Novel requests that are close analogs of prohibited ones.
- Social-engineering attacks that rely on "you didn't say X was disallowed."

**Misses:**
- Attacks that exploit principle ambiguity ("the user asked for this so helpfulness says yes").
- Scenarios where two principles conflict in an unanticipated way, and the tier order is ambiguous.
- Slow drift in principle interpretation over training cycles (reinterpretation).

### The 2023 participatory experiment

Anthropic ran a 2023 experiment comparing a corporate-authored constitution to one generated via public input (~1,000 US respondents). The two versions agreed on ~50% of principles. Where they diverged, the public-sourced version was more restrictive on some issues (political-content handling) and less restrictive on others (self-disclosure of AI identity). The 2026 Constitution did not incorporate the public-sourced findings. This is a documented tension in the approach.

### Why hardcoded prohibitions are necessary

Reason-based alignment alone cannot close the tail. An attacker who can get the model to accept a premise (e.g., "we are a licensed bioweapons research lab") can often talk past principles that depend on case reasoning. Hardcoded prohibitions do not bend to premise framing. They are the Lesson 14 "hard constitutional limit" at the alignment layer.

### Where the Constitution sits in the stack

The Constitution is not Lesson 14's kill switch. It lives at the model layer: what the model's weights are trained to prefer. Kill switches and canary tokens live at the runtime layer: what the runtime permits. Both are required. A runtime that fires all the wrong actions because the model weights are permissive is a runtime problem. A model that refuses all the right actions because the runtime is over-restrictive is a runtime problem. Layers cover different classes.

## Use It

`code/main.py` implements a minimal four-tier priority resolver. The resolver takes a proposed action and a set of principle-evaluations (safety, ethics, guidelines, helpfulness) and returns the action, a refusal, or a modified action. The driver runs a small case set: clear allow, clear disallow, hardcoded prohibition, ambiguous case across tiers.

## Ship It

`outputs/skill-constitution-review.md` audits a deployment's constitutional layer: what is hardcoded, what is soft-coded, where the operator can adjust, and whether the four-tier hierarchy is actually the resolution order.

## Exercises

1. Run `code/main.py`. Confirm the hardcoded prohibition fires even when helpfulness is high. Modify the resolver to weight helpfulness above ethics; observe the failure mode.

2. Read the Claude Constitution (public, 79 pages, CC0). Identify one principle you believe is under-specified. Write two paragraphs explaining the specific ambiguity and proposing a tighter formulation.

3. Design a soft-coded default set for a customer-support agent. What does the operator adjust? What can the operator not touch? Justify each boundary.

4. Read the Bai et al. 2022 CAI paper. Describe one case where Constitutional AI's critique-and-revise loop would produce a worse outcome than a blanket rule. Identify the class.

5. Anthropic's 2023 participatory experiment found ~50% divergence between public and corporate principles. Pick one category where this matters for production deployment (e.g., political neutrality). Propose a design that lets operators express their own values while the hardcoded prohibitions remain untouched.

## Key Terms

| Term | What people say | What it actually means |
|---|---|---|
| Constitutional AI | "Anthropic's alignment method" | Self-critique + RLAIF against a written constitution |
| Reason-based alignment | "Principles, not rules" | Model reasons over principles to handle unseen cases |
| Hardcoded prohibition | "Never do X" | Rule-based prohibition no operator or user can override |
| Soft-coded default | "Operator-adjustable" | Behaviour within a declared bound, operator controls |
| Four-tier hierarchy | "Priority order" | safety > ethics > guidelines > helpfulness |
| RLAIF | "AI feedback RL" | RL where the reward comes from model-generated critiques |
| Participatory constitution | "Public-sourced principles" | 2023 Anthropic experiment; ~50% divergence from corporate |
| Principle drift | "Interpretation slip" | Slow change in how the model reads a fixed principle text |

## Further Reading

- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) — the 79-page CC0 document.
- [Bai et al. — Constitutional AI: Harmlessness from AI Feedback](https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback) — 2022 original.
- [Anthropic — Collective Constitutional AI (2023)](https://www.anthropic.com/research/collective-constitutional-ai-aligning-a-language-model-with-public-input) — participatory experiment.
- [Anthropic — Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — where the Constitution sits in the RSP stack.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — Constitution's role in long-horizon deployments.
