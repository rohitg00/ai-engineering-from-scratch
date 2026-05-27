# The Direct Preference Optimization Family

> Rafailov et al. (2023) showed RLHF's optimum has a closed form in terms of the preference data, so you can skip the explicit reward model and optimize the policy directly. That insight spawned a family — IPO, KTO, SimPO, ORPO, BPO — each fixing a failure mode of DPO. In 2026, direct alignment algorithms ship more frontier post-training runs than PPO. But the over-optimization curve from Lesson 2 still applies: DAAs do not escape Goodhart, they just move where it bites.

**Type:** Learn
**Languages:** Python (stdlib, six-variant preference-loss comparator)
**Prerequisites:** Phase 18 · 01 (InstructGPT), Phase 18 · 02 (Reward hacking), Phase 10 · 08 (DPO basics)
**Time:** ~75 minutes

## Learning Objectives

- Derive the DPO closed form from the RLHF-with-KL optimum.
- State the failure mode each of IPO, KTO, SimPO, ORPO, BPO fixes in DPO.
- Distinguish "implicit reward gap" from "preference strength" and explain why IPO's identity mapping matters.
- Explain why Rafailov et al. (NeurIPS 2024) prove DAAs over-optimize despite having no explicit RM.

## The Problem

The RLHF objective (Lesson 1):

```
max_pi E_{x,y~pi} [ r(x, y) ] - beta * KL(pi || pi_ref)
```

has a known optimum:

```
pi*(y|x) = (1/Z(x)) * pi_ref(y|x) * exp(r(x, y) / beta)
```

So the reward is implicitly defined by the ratio of the optimal policy to the reference:

```
r(x, y) = beta * log(pi*(y|x) / pi_ref(y|x)) + beta * log Z(x)
```

Substitute this into the Bradley-Terry preference likelihood and the partition function `Z(x)` cancels because it depends only on `x`. What remains is a loss in the policy parameters alone — no reward model needed. That is DPO.

The wrinkle: the derivation assumes the optimum is reachable, the preference data is in-distribution, and the reference policy is the true mode anchor. None of these hold exactly. Every family member fixes a different violated assumption.

## The Concept

### DPO (Rafailov et al., 2023)

```
L_DPO = -log sigmoid(
  beta * log(pi(y_w | x) / pi_ref(y_w | x))
  - beta * log(pi(y_l | x) / pi_ref(y_l | x))
)
```

What can go wrong:

- The implicit reward gap `beta * (log(pi/pi_ref)_w - log(pi/pi_ref)_l)` is unbounded. A tiny preference can produce an arbitrarily large gap.
- The loss drives chosen and rejected log-probs in opposite directions. It can push the chosen absolute log-prob down as long as the rejected falls faster. This is the Degraded Chosen Response phenomenon.
- Out-of-distribution preferences (rare rare pair vs rare rare pair) produce arbitrary implicit rewards.

### IPO (Azar et al., 2024)

Identity Preference Optimization replaces the log-sigmoid with an identity mapping on the preference probability. The loss becomes a squared-error on a bounded target:

```
L_IPO = (log(pi(y_w | x) / pi_ref(y_w | x)) - log(pi(y_l | x) / pi_ref(y_l | x)) - 1/(2 beta))^2
```

The margin is bounded by `1/(2 beta)`. Preference strength and implicit-reward gap are proportional. No blow-up.

### KTO (Ethayarajh et al., 2024)

Kahneman-Tversky Optimization drops pairwise structure entirely. Given a single labeled output and a binary "desirable" or "undesirable" signal, it maps to a prospect-theory utility:

```
v(x, y) = sigma(beta * log(pi(y|x) / pi_ref(y|x)) - z_ref)
```

with different weights for gains and losses (loss aversion). Benefit: you can use unpaired data, which is far more plentiful.

### SimPO (Meng et al., 2024)

Simple Preference Optimization aligns the training signal with generation. Remove the reference policy entirely and normalize log-likelihood by length:

```
L_SimPO = -log sigmoid(
  (beta / |y_w|) * log pi(y_w | x)
  - (beta / |y_l|) * log pi(y_l | x)
  - gamma
)
```

with a margin `gamma` to stabilize. The length normalization removes the incentive to exploit DPO's length-bias failure mode (longer `y_w` gives a larger log-prob gap by construction).

### ORPO (Hong et al., 2024)

Odds-Ratio Preference Optimization adds a preference term to the standard SFT negative log-likelihood:

```
L_ORPO = L_NLL(y_w) + lambda * L_OR
L_OR = -log sigmoid(log(odds(y_w) / odds(y_l)))
```

No reference policy — the SFT term is the regularizer. Train in a single stage from the base model to the aligned model. No separate SFT checkpoint.

### BPO (ICLR 2026 submission, OpenReview id=b97EwMUWu7)

Identifies the Degraded Chosen Responses problem: DPO preserves the ranking `y_w > y_l` but the absolute log-prob of `y_w` can drop. BPO adds a single-line correction that penalizes downward moves on the chosen response. Reported +10.1% accuracy on Llama-3.1-8B-Instruct on math reasoning over DPO.

### The universal result: DAAs still over-optimize

Rafailov et al. "Scaling Laws for Reward Model Overoptimization in Direct Alignment Algorithms" (NeurIPS 2024) trained policies with DPO, IPO, SLiC on multiple datasets across KL budgets. The gold-reward-vs-KL curves have the same Gao et al. peak-and-collapse shape. The implicit reward queries out-of-distribution samples during training; KL regularization does not stabilize this.

DAAs do not escape Goodhart. They change the surface where it bites from "reward model over-optimized" to "reference policy ratio over-optimized." The universal fix — better data, ensembles, early stopping — applies to both.

### Choosing among them (2026)

- If you have large paired preference data: DPO with conservative beta, SimPO if length bias is evident.
- If you have unpaired binary feedback: KTO.
- If you want a single-stage pipeline from a base model: ORPO.
- If you see degraded chosen log-probs in DPO logs: BPO.
- If preference strengths vary widely and DPO is saturating: IPO.

Every lab runs all five on a battery and picks the winner per task. There is no reason the optimum is the same for math reasoning and safety.

## Use It

`code/main.py` compares six losses (DPO, IPO, KTO, SimPO, ORPO, BPO) on a toy preference dataset where the true preference strength varies by pair. Each loss is optimized against the same 500-pair sample with a small softmax policy. Plots final win rate, chosen-log-prob drift, and implicit-reward spread per method.

## Ship It

This lesson produces `outputs/skill-preference-loss-selector.md`. Given dataset statistics (paired vs unpaired, variable vs uniform preference strength, length distribution) and a target (single-stage or SFT-then-preference), recommend a preference loss and report the failure mode it protects against.

## Exercises

1. Run `code/main.py`. Report the final chosen-log-prob drop for DPO and BPO. BPO should retain higher chosen absolute probability — verify this.

2. Modify the preference data so that all pairs have equal strength. Which of the six methods is most robust? Which degrades? Explain IPO's advantage here.

3. Make the rejected responses on average 2x longer than chosen. Without changing anything else, show DPO's length exploitation numerically and SimPO's fix.

4. Rafailov et al. (NeurIPS 2024) claim DAAs over-optimize. Reproduce a single-point version: plot chosen-minus-rejected KL divergence and observe over-optimization in DPO at large beta.

5. Read the BPO paper abstract (OpenReview b97EwMUWu7). Write down the one-line correction BPO adds to DPO. Confirm against the implementation in `code/main.py`.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| DPO | "RLHF without a reward model" | Loss derived from the closed-form RLHF optimum; policy parameters only |
| Implicit reward | "the log-ratio" | `beta * log(pi(y|x) / pi_ref(y|x))` — the DPO-implied reward |
| IPO | "bounded DPO" | Replaces log-sigmoid with identity; implicit reward gap capped by `1/(2 beta)` |
| KTO | "unpaired DPO" | Prospect-theory utility over single labels with loss aversion |
| SimPO | "reference-free DPO" | Length-normalized log-likelihood + margin; no reference policy |
| ORPO | "one-stage DPO" | NLL + odds-ratio preference term; trains from base model in one pass |
| BPO | "chosen-preserving DPO" | DPO plus a penalty for decreasing the chosen response's absolute log-prob |
| Degraded Chosen | "chosen goes down" | DPO decreases chosen log-prob so long as rejected falls faster |
| DAA | "direct alignment algorithm" | Any preference-loss method that skips an explicit RM |

## Further Reading

- [Rafailov et al. — Direct Preference Optimization (NeurIPS 2023, arXiv:2305.18290)](https://arxiv.org/abs/2305.18290)
- [Azar et al. — A General Theoretical Paradigm to Understand Learning from Human Preferences (AISTATS 2024, arXiv:2310.12036)](https://arxiv.org/abs/2310.12036) — IPO
- [Ethayarajh et al. — KTO: Model Alignment as Prospect Theoretic Optimization (arXiv:2402.01306)](https://arxiv.org/abs/2402.01306)
- [Meng, Xia, Chen — SimPO (NeurIPS 2024, arXiv:2405.14734)](https://arxiv.org/abs/2405.14734)
- [Hong, Lee, Thorne — ORPO (EMNLP 2024, arXiv:2403.07691)](https://arxiv.org/abs/2403.07691)
- [BPO — Behavior Preservation Optimization (ICLR 2026 OpenReview b97EwMUWu7)](https://openreview.net/forum?id=b97EwMUWu7)
- [Rafailov et al. — Scaling Laws for RM Overoptimization in DAAs (NeurIPS 2024, arXiv:2406.02900)](https://arxiv.org/abs/2406.02900)
