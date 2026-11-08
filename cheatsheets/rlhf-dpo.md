---
id: rlhf-dpo
title: RLHF, DPO and Preference Tuning
code: RD
subtitle: Reward model plus PPO against DPO and its family. Losses, beta and KL settings, failure modes and fixes.
hue: 20
sources: phases/09-reinforcement-learning/09-reward-modeling-rlhf, phases/10-llms-from-scratch/07-rlhf, phases/10-llms-from-scratch/08-dpo, phases/18-ethics-safety-alignment/03-direct-preference-optimization-family, phases/19-capstone-projects/40-dpo-from-scratch
source_hash: 72f1a1b5224c3ea9
---

## RLHF against DPO
type: comparison
from: phases/10-llms-from-scratch/08-dpo/docs/en.md

| Factor | RLHF (PPO) | DPO |
|---|---|---|
| Models to train | 3: SFT, reward, policy | 1: policy only |
| Training loops | 3: SFT, RM, PPO | 2: SFT, DPO |
| Hyperparameters | lr, KL coeff, clip ratio, RM lr, epochs | lr, beta, epochs |
| Reward model | Separate training | Implicit in model probabilities |
| Algorithm | PPO, complex and unstable | Supervised learning, stable |
| Models in memory | 3-4 during PPO | 2: current and reference |
| Compute | Three loops | About one-third of RLHF |
| Data | Online loop with new ratings | Fixed preference dataset |

## Use X when
type: tips
from: phases/10-llms-from-scratch/08-dpo/docs/en.md, phases/18-ethics-safety-alignment/03-direct-preference-optimization-family/docs/en.md, phases/09-reinforcement-learning/09-reward-modeling-rlhf/docs/en.md

- DPO: 5,000-20,000 pairs, limited compute, or many dataset experiments.
- RLHF: large scale, multi-objective rewards, or an iterative online rating loop.
- SimPO: length bias is evident. It also drops the reference model.
- KTO: you only have unpaired good or bad labels.
- ORPO: you want one stage from the base model, with no SFT checkpoint.
- BPO: DPO logs show degraded chosen log-probs.
- IPO: preference strengths vary widely and DPO saturates.

## RLHF pipeline
type: architecture
from: phases/10-llms-from-scratch/07-rlhf/docs/en.md, phases/09-reinforcement-learning/09-reward-modeling-rlhf/docs/en.md

```arch
node | sft | 1,1 | SFT model | stage 1 | model
node | pairs | 1,2 | Preference pairs | prompt, chosen, rejected | store
node | policy | 2,1 | Policy | init from SFT | model
node | rm | 2,2 | Reward model | scalar head, Bradley-Terry | model
node | ref | 3,1 | Reference | frozen SFT copy | model
node | ppo | 3,2 | PPO update | reward minus beta KL | process
edge | sft | policy | initialize
edge | sft | ref | freeze
edge | pairs | rm | train
edge | policy | rm | response
edge | rm | ppo | reward
edge | ref | ppo | KL penalty
edge | ppo | policy | update
```

## One DPO epoch (capstone)
type: flow
from: phases/19-capstone-projects/40-dpo-from-scratch/code/main.py, phases/19-capstone-projects/40-dpo-from-scratch/docs/en.md

1. **Reference**: under `torch.no_grad()`, store chosen and rejected log-probs once.
2. **Policy**: `sequence_log_prob` sums completion log-probs. Prompt tokens add nothing.
3. **Margin**: `diff_w - diff_l`, the chosen log-ratio minus the rejected log-ratio.
4. **Loss**: `-F.logsigmoid(beta * margin)` for each triple.
5. **Step**: `opt.zero_grad()`, `loss.backward()`, `opt.step()` on Adam.
6. **Check**: `run_demo` returns 1 when the margin does not rise or the loss does not drop.

## DPO loss and reference freeze
type: annotated-code
lang: python
from: phases/19-capstone-projects/40-dpo-from-scratch/code/main.py

```python
diff_w = logp_w_pol - logp_w_ref            # chosen log-ratio
diff_l = logp_l_pol - logp_l_ref            # rejected log-ratio
margin = diff_w - diff_l                    # implicit reward gap over beta
z = beta * margin
loss = -F.logsigmoid(z)                     # stable -log sigmoid
policy.load_state_dict(reference.state_dict())  # start from equal weights
for p in reference.parameters():
    p.requires_grad = False                 # reference never moves
target = 1.0 / (2.0 * beta) if beta > 0 else 0.0
loss = (margin - target) ** 2               # IPO variant
```

## Reward model and KL reward (toy)
type: annotated-code
lang: python
from: phases/09-reinforcement-learning/09-reward-modeling-rlhf/code/main.py

```python
p = sigmoid(r_pos - r_neg)                  # Bradley-Terry P(chosen wins)
grad_scale = 1 - p
w[t] += lr * grad_scale * c                 # chosen tokens up, rejected down
kl_term = kl(probs_new, probs_ref)
reward = rm_score - beta * kl_term          # KL-penalized reward
advs = [(r - mean_r) / sd_r for r in rewards]  # normalized advantages
ratio = math.exp(logp - log_pi_old)
clipped = (adv > 0 and ratio > 1 + eps) or (adv < 0 and ratio < 1 - eps)
```

## Tasks in code
type: task-table
from: phases/09-reinforcement-learning/09-reward-modeling-rlhf/code/main.py, phases/09-reinforcement-learning/09-reward-modeling-rlhf/docs/en.md, phases/10-llms-from-scratch/08-dpo/code/main.py, phases/18-ethics-safety-alignment/03-direct-preference-optimization-family/code/main.py, phases/19-capstone-projects/40-dpo-from-scratch/code/main.py

| Task | Code |
|---|---|
| Train a Bradley-Terry RM | `train_rm(n_pairs=500, lr=0.1)` |
| Toy PPO-RLHF loop | `rlhf_loop(w, updates=300, beta=0.1)` |
| TRL PPO with adaptive KL | `PPOConfig(init_kl_coef=0.05, target_kl=6.0)` |
| Train DPO, lesson 10.08 | `dpo_train(..., lr=5e-6, beta=0.1)` |
| Sweep beta | `betas=[0.01, 0.1, 0.3, 1.0]` |
| Response log-prob | `sequence_log_prob(policy, prompt, chosen)` |
| Compare six losses | `python3 code/main.py` |
| Capstone end to end | `sys.exit(run_demo())` |

## Losses
type: concepts
from: phases/09-reinforcement-learning/09-reward-modeling-rlhf/docs/en.md, phases/10-llms-from-scratch/08-dpo/docs/en.md, phases/18-ethics-safety-alignment/03-direct-preference-optimization-family/docs/en.md, phases/19-capstone-projects/40-dpo-from-scratch/docs/en.md

- **RM loss**: $-\log \sigma(R_\phi(x, y_+) - R_\phi(x, y_-))$, the Bradley-Terry pairwise logistic.
- **Implicit reward**: $r = \beta \log \frac{\pi^*(y \mid x)}{\pi_{\text{ref}}(y \mid x)} + \beta \log Z(x)$. $Z(x)$ cancels.
- **DPO**: $-\log \sigma(\beta (\log \frac{\pi(y_w)}{\pi_{\text{ref}}(y_w)} - \log \frac{\pi(y_l)}{\pi_{\text{ref}}(y_l)}))$
- **IPO**: squared error of the log-ratio gap against $\frac{1}{2\beta}$. The gap stays bounded.
- **SimPO**: length-normalized $\frac{\beta}{|y|} \log \pi(y \mid x)$ with a margin $\gamma$. No reference.
- **Gradient sign**: $\partial L / \partial \log \pi_\theta(y_w) = -\beta (1 - \sigma(z))$. Chosen goes up.

## Defaults
type: defaults
from: phases/09-reinforcement-learning/09-reward-modeling-rlhf/docs/en.md, phases/10-llms-from-scratch/07-rlhf/docs/en.md, phases/10-llms-from-scratch/08-dpo/docs/en.md, phases/19-capstone-projects/40-dpo-from-scratch/code/main.py

| Setting | Default | Note |
|---|---|---|
| RLHF KL β | 0.01-0.05 | Typical range |
| InstructGPT KL β | 0.02 | lr=1.5e-5, 4 PPO epochs |
| PPO clip ε | 0.2 | Ratio clipped to 1 ± ε |
| TRL `init_kl_coef` | 0.05 | With `target_kl=6.0` |
| DPO β, lesson 10.08 | 0.1 | Sweet spot 0.1 to 0.3 |
| DPO lr, lesson 10.08 | 5e-6 | 5 epochs |
| Capstone `DPOConfig` beta | 0.2 | lr 1e-3, 30 epochs |
| Capstone `warmup_epochs` | 8 | Reference pretrain first |

## Troubleshooting
type: troubleshooting
from: phases/09-reinforcement-learning/09-reward-modeling-rlhf/docs/en.md, phases/10-llms-from-scratch/07-rlhf/docs/en.md, phases/10-llms-from-scratch/08-dpo/docs/en.md, phases/18-ethics-safety-alignment/03-direct-preference-optimization-family/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Reward climbs, human eval flat | Reward hacking | Stop early, raise β, broaden RM data |
| Responses get longer | Length hacking | Length-normalized reward, or SimPO |
| Mean KL past ~5-10 | Policy drifted from SFT | Adaptive β that targets a fixed KL |
| Policy barely changes | β too high | Lower β |
| Chosen log-prob falls in DPO | Degraded Chosen Response | BPO penalty on the chosen response |
| DPO gap blows up | Implicit reward gap is unbounded | IPO, gap capped at 1/(2 beta) |
| RM scores unreliable | RM smaller than the policy | RM at least as large as the policy |
| ~30% noisy labels | Ambiguous preferences | Agreement-filtered data, BT temperature |

## Questions
type: qa
from: phases/10-llms-from-scratch/07-rlhf/docs/en.md, phases/09-reinforcement-learning/09-reward-modeling-rlhf/docs/en.md, phases/10-llms-from-scratch/08-dpo/docs/en.md, phases/18-ethics-safety-alignment/03-direct-preference-optimization-family/docs/en.md

- **Why pairs, not absolute scores?** People rank two answers well. They score one answer badly.
- **Why the KL term?** It keeps the policy near the data where the RM was trained.
- **Why does the RM read the last token?** The causal mask lets it see the whole sequence.
- **How many forward passes per DPO pair?** Four: two models times two responses.
- **Do DAAs escape over-optimization?** No. They over-optimize the reference ratio instead.
