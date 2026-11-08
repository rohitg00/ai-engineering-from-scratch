---
id: alignment-training
title: Alignment Training: Instructions, DPO Family, RLAIF
code: AI
subtitle: Pick and tune RLHF, DPO, IPO, KTO, SimPO, ORPO, BPO and Constitutional AI. Losses, defaults and failures.
hue: 290
sources: phases/18-ethics-safety-alignment/01-instruction-following-alignment-signal, phases/18-ethics-safety-alignment/03-direct-preference-optimization-family, phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif, phases/10-llms-from-scratch/07-rlhf, phases/10-llms-from-scratch/08-dpo
source_hash: b28964c127b9549a
---

## RLHF vs RLAIF vs DPO
type: comparison
span: 2
from: phases/10-llms-from-scratch/08-dpo/docs/en.md, phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif/docs/en.md, phases/18-ethics-safety-alignment/01-instruction-following-alignment-signal/docs/en.md, phases/18-ethics-safety-alignment/03-direct-preference-optimization-family/docs/en.md

| Factor | RLHF (PPO) | RLAIF (CAI) | DPO |
|---|---|---|---|
| Preference signal | Human labelers rank pairs | Feedback model reads principles | Human or AI prefs |
| Reward model | Required (separate training) | Trained on AI preferences | Implicit in model probabilities |
| RL algorithm | PPO (complex, unstable) | PPO against the RM | Supervised learning (stable) |
| Models to train | 3 (SFT + reward + policy) | Same as RLHF | 1 (policy only) |
| Models in memory | 3-4 | Same as RLHF | 2 (current + reference) |
| Hyperparameters | lr, KL coeff, clip ratio, RM lr, epochs x3 | Same as RLHF | lr, beta, epochs |
| Online loop | Yes, retrain the RM on new ratings | Yes, uses the iterative loop | No, fixed dataset of pairs |
| Main failure | Reward hacking | Goodhart persists, sycophancy drops | Over-optimizes the reference ratio |

## DPO family losses
type: comparison
span: 2
from: phases/18-ethics-safety-alignment/03-direct-preference-optimization-family/docs/en.md, phases/18-ethics-safety-alignment/03-direct-preference-optimization-family/code/main.py, phases/10-llms-from-scratch/08-dpo/docs/en.md

| Factor | IPO | KTO | SimPO | ORPO |
|---|---|---|---|---|
| Data | Pairs | Unpaired good or bad labels | Pairs | Pairs |
| Reference policy | Yes | Yes | No | No |
| Fixes in DPO | Unbounded reward gap | Needs paired data | Length bias | Separate SFT stage |
| Loss shape | Squared error, target 1/(2 beta) | Prospect theory, loss aversion | Length-normalized log-prob, margin gamma | NLL plus lambda times odds ratio |
| Toy function | `train_dpo(pairs, variant="ipo")` | `train_kto(labels)` | `train_simpo(pairs)` | `train_orpo(pairs)` |
| Toy defaults | `beta: float = 0.1` | `beta: float = 0.1` | `beta: float = 1.5`, `gamma: float = 0.5` | `lam: float = 0.1` |

## Use X when
type: tips
from: phases/18-ethics-safety-alignment/03-direct-preference-optimization-family/docs/en.md, phases/10-llms-from-scratch/08-dpo/docs/en.md, phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif/docs/en.md

- DPO: you have 5,000-20,000 pairs or limited compute. It needs about one third of the RLHF compute.
- SimPO: length bias is evident in DPO.
- KTO: you have unpaired binary feedback.
- ORPO: you want a single-stage pipeline from a base model.
- BPO: DPO logs show degraded chosen log-probs.
- IPO: preference strengths vary widely and DPO saturates.
- RLHF: "better" has many dimensions, or you rate new samples in an online loop.
- RLAIF: you replace the human labeler with a model that reads explicit principles.

## InstructGPT pipeline
type: architecture
from: phases/18-ethics-safety-alignment/01-instruction-following-alignment-signal/docs/en.md, phases/10-llms-from-scratch/07-rlhf/docs/en.md

```arch
node | base | 1,1 | Base model | completes text | model
node | sft | 2,1 | SFT model | cross-entropy on pairs | model
node | prefs | 3,1 | Preference pairs | prompt, winner, loser | store
node | rm | 4,1 | Reward model | scalar head, Bradley-Terry | model
node | ref | 1,2 | Reference model | frozen SFT | model
node | pol | 2,2 | Policy model | being optimized | model
node | ppo | 3,2 | PPO update | reward - beta * KL | process
node | lab | 4,2 | Human annotators | rank K completions | client
edge | base | sft | SFT
edge | sft | prefs | generate
edge | lab | prefs | rank
edge | prefs | rm | train
edge | sft | ref | freeze
edge | sft | pol | init
edge | pol | rm | response
edge | rm | ppo | reward
edge | ref | ppo | KL penalty
edge | ppo | pol | update
```

## Constitutional AI pipeline
type: flow
from: phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif/docs/en.md

1. **SFT model**: helpful but not yet harmless. It answers a red-team prompt.
2. **Critique model**: reads a sampled principle and critiques the response.
3. **Revision step**: revises the response. The revised response is the SFT target.
4. **Feedback model**: ranks pairs of completions against sampled principles.
5. **Reward model**: trains on the AI-generated preferences.
6. **PPO**: optimizes the policy against the RM, as in InstructGPT.
7. **Constitutional Classifier**: gates outputs. v1 had 23.7% compute overhead, v2 ~1%.

## Loss formulas
type: concepts
from: phases/18-ethics-safety-alignment/01-instruction-following-alignment-signal/docs/en.md, phases/18-ethics-safety-alignment/03-direct-preference-optimization-family/docs/en.md, phases/10-llms-from-scratch/07-rlhf/docs/en.md, phases/10-llms-from-scratch/08-dpo/docs/en.md

- **Bradley-Terry RM**: $L_{\text{RM}} = -\log \sigma(r(x, y_w) - r(x, y_l))$
- **RLHF objective**: $\mathbb{E}[r(x, y)] - \beta \, \mathrm{KL}(\pi \,\|\, \pi_{\text{SFT}})$
- **PPO-ptx**: $J(\pi) + \gamma \, \mathbb{E}_{x \sim D_{\text{pretrain}}}[\log \pi(x)]$
- **Implicit reward**: $\beta \log \frac{\pi(y \mid x)}{\pi_{\text{ref}}(y \mid x)}$
- **DPO**: $-\log \sigma(\beta (\log \frac{\pi(y_w)}{\pi_{\text{ref}}(y_w)} - \log \frac{\pi(y_l)}{\pi_{\text{ref}}(y_l)}))$
- **IPO**: square of (log-ratio gap $- \frac{1}{2\beta}$). The margin stays bounded.
- **SimPO**: $-\log \sigma(\frac{\beta}{|y_w|} \log \pi(y_w) - \frac{\beta}{|y_l|} \log \pi(y_l) - \gamma)$
- **ORPO**: $L_{\text{NLL}}(y_w) + \lambda L_{\text{OR}}$, no reference policy.

## Two pairwise losses in code
type: annotated-code
lang: python
from: phases/10-llms-from-scratch/07-rlhf/code/main.py, phases/10-llms-from-scratch/08-dpo/code/main.py

```python
def bradley_terry_loss(reward_preferred, reward_rejected):
    diff = reward_preferred - reward_rejected        # RM score gap
    loss = -np.log(sigmoid(diff) + 1e-8)             # stage 2 RM loss

def dpo_loss(policy_logprob_preferred, policy_logprob_rejected,
             ref_logprob_preferred, ref_logprob_rejected, beta=0.1):
    preferred_ratio = policy_logprob_preferred - ref_logprob_preferred
    rejected_ratio = policy_logprob_rejected - ref_logprob_rejected
    logit = beta * (preferred_ratio - rejected_ratio)  # 4 log-probs in
    loss = -np.log(sigmoid(logit) + 1e-8)            # no reward model
    preferred_reward = beta * preferred_ratio        # implicit reward
    rejected_reward = beta * rejected_ratio
    "reward_margin": float(preferred_reward - rejected_reward)  # must grow
```

## Toy pipelines in code
type: task-table
from: phases/18-ethics-safety-alignment/01-instruction-following-alignment-signal/code/main.py, phases/18-ethics-safety-alignment/03-direct-preference-optimization-family/code/main.py, phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif/code/main.py, phases/10-llms-from-scratch/07-rlhf/code/main.py, phases/10-llms-from-scratch/08-dpo/code/main.py

| Task | Code |
|---|---|
| Run a lesson demo | `python3 code/main.py` |
| Standard toy RLHF | `stage3_ppo(sft, rm, beta=0.1)` |
| Show reward hacking | `stage3_ppo(sft, rm, beta=0.0)` |
| Inject a reward model bug | `stage2_reward_model(bias=[0.5, 0.0, 0.0])` |
| Train DPO, IPO or BPO | `train_dpo(pairs, variant="bpo")` |
| Build the CAI SFT corpus | `build_cai_sft_corpus(500)` |
| AI labeler ranks a pair | `ai_feedback_rank(a, b)` |
| Sweep DPO beta | `betas=[0.01, 0.1, 0.3, 1.0]` |

## Troubleshooting
type: troubleshooting
from: phases/18-ethics-safety-alignment/01-instruction-following-alignment-signal/docs/en.md, phases/18-ethics-safety-alignment/03-direct-preference-optimization-family/docs/en.md, phases/10-llms-from-scratch/07-rlhf/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Reward climbs, outputs degenerate | beta too low, RM blind spots | Raise the KL penalty |
| No gain over SFT | beta too high | Lower beta |
| Benchmarks drop after RLHF | Alignment tax | PPO-ptx: mix in pretraining gradients |
| Longer and longer responses | RM scores length | Adversarial RM data, or SimPO |
| Model agrees with everything | Sycophancy from annotators | Several reward models, adversarial data |
| Chosen log-prob falls in DPO | Degraded Chosen Response | Switch to BPO |
| DPO reward gap blows up | Implicit gap is unbounded | Use IPO, gap capped by 1/(2 beta) |
| Gold reward peaks, then collapses | DAAs over-optimize too | Better data, ensembles, early stopping |

## Defaults
type: defaults
span: 1
from: phases/10-llms-from-scratch/07-rlhf/docs/en.md, phases/10-llms-from-scratch/07-rlhf/code/main.py, phases/10-llms-from-scratch/08-dpo/docs/en.md, phases/10-llms-from-scratch/08-dpo/code/main.py, phases/18-ethics-safety-alignment/01-instruction-following-alignment-signal/code/main.py, phases/18-ethics-safety-alignment/03-direct-preference-optimization-family/code/main.py

| Setting | Default | Note |
|---|---|---|
| PPO `kl_coeff` | 0.02 | InstructGPT. Llama 2 Chat used 0.01 |
| PPO `lr` | 1.5e-5 | InstructGPT: 256K episodes, 4 PPO epochs per batch |
| PPO clip epsilon | 0.2 | Typical value |
| DPO `beta` | 0.1 | Sweet spot 0.1 to 0.3 |
| DPO `lr` | 5e-6 | `num_epochs=5` in `dpo_train` |
| RM `lr` | 1e-4 | `num_epochs=10` in `train_reward_model` |
| Toy `stage3_ppo` | `steps: int = 300` | `batch: int = 32`, `lr: float = 0.1` |
| KTO loss aversion | 2.0 | Toy weight on bad labels. Lesson 08 says 1.5x |

## Questions
type: qa
from: phases/18-ethics-safety-alignment/01-instruction-following-alignment-signal/docs/en.md, phases/10-llms-from-scratch/07-rlhf/docs/en.md, phases/10-llms-from-scratch/08-dpo/docs/en.md, phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif/docs/en.md, phases/18-ethics-safety-alignment/03-direct-preference-optimization-family/docs/en.md

- **Why did 1.3B InstructGPT beat 175B GPT-3?** Labelers preferred it about 70% of the time. Alignment is a different axis from capability.
- **Can RLHF add facts?** No. The base model sets the capability floor.
- **Why pairwise labels?** Humans compare two responses well. They assign absolute scores badly.
- **What RM accuracy is good?** About 72% on held-out pairs. Inter-annotator agreement was about 73%.
- **Is RLAIF only a cheaper RLHF?** No. The signal is legible: you read the principle, critique and revision.
- **Do DAAs escape Goodhart?** No. Over-optimization moves to the reference policy ratio.
