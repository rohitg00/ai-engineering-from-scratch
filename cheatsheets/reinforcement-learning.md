---
id: reinforcement-learning
title: Reinforcement Learning
code: RL
subtitle: MDPs, value methods, policy gradients, PPO, RLHF and GRPO. Formulas, update lines and diagnostics from Phase 9.
hue: 75
sources: phases/09-reinforcement-learning/01-mdps-states-actions-rewards, phases/09-reinforcement-learning/02-dynamic-programming, phases/09-reinforcement-learning/03-monte-carlo-methods, phases/09-reinforcement-learning/04-q-learning-sarsa, phases/09-reinforcement-learning/05-dqn, phases/09-reinforcement-learning/06-policy-gradients-reinforce, phases/09-reinforcement-learning/07-actor-critic-a2c-a3c, phases/09-reinforcement-learning/08-ppo, phases/09-reinforcement-learning/09-reward-modeling-rlhf, phases/09-reinforcement-learning/12-rl-for-games
source_hash: a115ea75e61f42aa
---

## PPO training loop
type: architecture
from: phases/09-reinforcement-learning/08-ppo/docs/en.md, phases/09-reinforcement-learning/08-ppo/code/main.py, phases/09-reinforcement-learning/07-actor-critic-a2c-a3c/docs/en.md

```arch
node | envs | 1,1 | N parallel envs | T steps each
node | actor | 2,1 | Actor | softmax policy
node | buf | 1,2 | Rollout buffer | s, a, r, log_pi_old
node | critic | 2,2 | Critic | v_old per state
node | gae | 1,3 | GAE | advantages, returns
node | clip | 2,3 | Clipped surrogate | K epochs, minibatches
node | diag | 1,4 | Diagnostics | mean KL, clip fraction
edge | actor | envs | action
edge | envs | buf | transition
edge | critic | buf | value
edge | buf | gae |
edge | gae | clip | advantage
edge | clip | actor | update
edge | clip | diag |
```

## RLHF in three stages
type: flow
from: phases/09-reinforcement-learning/09-reward-modeling-rlhf/docs/en.md

1. **SFT**: fine tune the base model on human demonstrations.
2. **Preference data**: collect rows of prompt, chosen and rejected.
3. **Reward model**: train a scalar head on the SFT model with the Bradley-Terry loss.
4. **Policy and reference**: start the policy from SFT. Freeze a copy as the reference.
5. **Reward**: RM score minus $\beta$ times the KL to the reference.
6. **PPO**: update the token level policy against that reward.
7. **Monitor**: watch mean KL. Past about 5 to 10, drift or reward hacking starts.

## Value formulas
type: concepts
from: phases/09-reinforcement-learning/01-mdps-states-actions-rewards/docs/en.md, phases/09-reinforcement-learning/02-dynamic-programming/docs/en.md, phases/09-reinforcement-learning/04-q-learning-sarsa/docs/en.md, phases/09-reinforcement-learning/05-dqn/docs/en.md

- **MDP**: the tuple $(S, A, P, R, \gamma)$ with the Markov property.
- **Return**: $G_t = r_t + \gamma r_{t+1} + \gamma^2 r_{t+2} + \ldots$
- **Bellman V**: $V^\pi(s) = \sum_a \pi(a \mid s) \sum_{s', r} P(s', r \mid s, a) [r + \gamma V^\pi(s')]$
- **Value iteration**: $V(s) \leftarrow \max_a \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]$
- **TD(0)**: $V(s) \leftarrow V(s) + \alpha [r + \gamma V(s') - V(s)]$
- **Q-learning**: $Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma \max_{a'} Q(s', a') - Q(s, a)]$
- **SARSA**: $Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma Q(s', a') - Q(s, a)]$
- **DQN loss**: $(r + \gamma \max_{a'} Q(s', a'; \theta^-) - Q(s, a; \theta))^2$ over replay samples.

## Policy formulas
type: concepts
from: phases/09-reinforcement-learning/06-policy-gradients-reinforce/docs/en.md, phases/09-reinforcement-learning/07-actor-critic-a2c-a3c/docs/en.md, phases/09-reinforcement-learning/08-ppo/docs/en.md, phases/09-reinforcement-learning/09-reward-modeling-rlhf/docs/en.md, phases/09-reinforcement-learning/12-rl-for-games/docs/en.md

- **Policy gradient**: $\nabla J(\theta) = \mathbb{E}[ \sum_t G_t \cdot \nabla_\theta \log \pi_\theta(a_t \mid s_t) ]$
- **TD advantage**: $\delta_t = r_{t+1} + \gamma V(s_{t+1}) - V(s_t)$
- **GAE**: $A_t^{\text{GAE}} = \sum_{l=0}^{\infty} (\gamma \lambda)^l \delta_{t+l}$
- **PPO ratio**: $r_t(\theta) = \pi_\theta(a_t \mid s_t) / \pi_{\theta_{\text{old}}}(a_t \mid s_t)$
- **PPO clip**: $\mathbb{E}_t [ \min( r_t A_t, \mathop{\mathrm{clip}}(r_t, 1-\epsilon, 1+\epsilon) A_t ) ]$
- **Bradley-Terry**: $L(\phi) = -\mathbb{E}[ \log \sigma(R_\phi(x, y_+) - R_\phi(x, y_-)) ]$
- **RLHF reward**: $R_\phi(x, y) - \beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{ref}})$
- **GRPO advantage**: $A_i = (r_i - \text{mean}_r) / \text{std}_r$ over $G$ samples of one prompt.

## Choose a method
type: command-table
from: phases/09-reinforcement-learning/02-dynamic-programming/docs/en.md, phases/09-reinforcement-learning/04-q-learning-sarsa/docs/en.md, phases/09-reinforcement-learning/05-dqn/docs/en.md, phases/09-reinforcement-learning/08-ppo/docs/en.md, phases/09-reinforcement-learning/09-reward-modeling-rlhf/docs/en.md, phases/09-reinforcement-learning/12-rl-for-games/docs/en.md

| Situation | Method |
|---|---|
| Small tabular MDP, known model | value iteration or policy iteration |
| Small tabular MDP, samples only | Q-learning |
| On-policy, safety critical | SARSA or Expected SARSA |
| High dimensional state, discrete actions | DQN, with Double DQN in production |
| Continuous control | PPO with Gaussian policy, or SAC and TD3 |
| LLM alignment from preferences | DPO first, RLHF-PPO with KL penalty |
| LLM math and code reasoning | GRPO with a verifier reward |
| Two player board games | AlphaZero or MuZero |

## Update lines
type: task-table
from: phases/09-reinforcement-learning/03-monte-carlo-methods/docs/en.md, phases/09-reinforcement-learning/04-q-learning-sarsa/docs/en.md, phases/09-reinforcement-learning/05-dqn/docs/en.md, phases/09-reinforcement-learning/09-reward-modeling-rlhf/docs/en.md, phases/09-reinforcement-learning/12-rl-for-games/docs/en.md

| Task | Code |
|---|---|
| Return, reverse sweep | `G = r + gamma * G` |
| Explore with epsilon greedy | `if random() < epsilon: return choice(ACTIONS)` |
| Q-learning target | `target = r + (gamma * max(Q[s_next].values()) if not done else 0.0)` |
| SARSA target | `target = r + (gamma * Q[s_next][a_next] if not done else 0.0)` |
| TD step | `Q[s][a] += alpha * (target - Q[s][a])` |
| Sync DQN target net | `if steps % sync_every == 0: target = copy(online)` |
| RLHF reward with KL | `reward = dot(w, bag([token])) - beta * kl(probs, probs_ref)` |
| GRPO group advantage | `advs = [(r - mean_r) / std_r for r in rewards]` |

## PPO clipped update
type: annotated-code
lang: python
from: phases/09-reinforcement-learning/08-ppo/code/main.py

```python
for rec, adv in zip(mb, adv_norm):                 # advantages normalized per minibatch
    x = rec["x"]
    probs = softmax(logits(theta, x))              # current policy
    logp = math.log(max(probs[rec["a"]], 1e-12))
    ratio = math.exp(logp - rec["log_pi_old"])     # new over old probability
    clipped = (adv > 0 and ratio > 1 + eps) or (adv < 0 and ratio < 1 - eps)
    pg_scale = 0.0 if clipped else ratio * adv     # clipped means zero gradient
    for action in range(N_ACTIONS):
        grad_logpi = (1.0 if action == rec["a"] else 0.0) - probs[action]
        for j in range(N_FEAT):
            theta[action][j] += lr_a * pg_scale * grad_logpi * x[j]
    err = rec["ret"] - value(w, x)                 # critic error
    for j in range(N_FEAT):
        w[j] += lr_v * err * x[j]                  # critic step
```

## Defaults and numbers
type: defaults
from: phases/09-reinforcement-learning/01-mdps-states-actions-rewards/docs/en.md, phases/09-reinforcement-learning/04-q-learning-sarsa/docs/en.md, phases/09-reinforcement-learning/07-actor-critic-a2c-a3c/docs/en.md, phases/09-reinforcement-learning/08-ppo/docs/en.md, phases/09-reinforcement-learning/09-reward-modeling-rlhf/docs/en.md, phases/09-reinforcement-learning/12-rl-for-games/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Discount $\gamma$ | 0.99 | horizon about $1 / (1 - \gamma)$, so 100 steps |
| Tabular $\alpha$ and $\epsilon$ | 0.1 | Q-learning and SARSA on the 4x4 GridWorld |
| PPO clip $\epsilon$ | 0.2 | 0.1 is too timid, 0.3 and more is unstable |
| Value coefficient $c_v$ | 0.5 | PPO and A2C |
| Entropy coefficient $c_e$ | 0.01 | PPO and A2C |
| GAE $\lambda$ | 0.95 | 0 is TD, 1 is MC |
| RLHF KL $\beta$ | 0.01-0.05 | keeps the policy near SFT |
| GRPO group size $G$ | 8 | 8 to 64 is standard, below 4 is noisy |

## Troubleshooting
type: troubleshooting
from: phases/09-reinforcement-learning/04-q-learning-sarsa/docs/en.md, phases/09-reinforcement-learning/05-dqn/docs/en.md, phases/09-reinforcement-learning/06-policy-gradients-reinforce/docs/en.md, phases/09-reinforcement-learning/07-actor-critic-a2c-a3c/docs/en.md, phases/09-reinforcement-learning/08-ppo/docs/en.md, phases/09-reinforcement-learning/09-reward-modeling-rlhf/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Mean KL past 0.1 | policy drifts far from the old policy | reduce `K_EPOCHS` or `LR` |
| Clip fraction near 0 | clip never triggers | raise `LR` or `K_EPOCHS` |
| Clip fraction 0.5 or more | overfit to the rollout | lower `LR` or `K_EPOCHS` |
| Reward climbs, human eval drops | reward hacking of the RM | stop early, raise $\beta$, broaden RM data |
| Responses get longer | RM rewards length | length normalized reward |
| Q values too high | max bias on noisy Q | Double DQN |
| DQN diverges | deadly triad | keep the target net and the replay buffer |
| Policy stops exploring | entropy collapse | entropy bonus with $c_e > 0$ |

## Abbreviations
type: glossary
from: phases/09-reinforcement-learning/01-mdps-states-actions-rewards/docs/en.md, phases/09-reinforcement-learning/04-q-learning-sarsa/docs/en.md, phases/09-reinforcement-learning/05-dqn/docs/en.md, phases/09-reinforcement-learning/07-actor-critic-a2c-a3c/docs/en.md, phases/09-reinforcement-learning/08-ppo/docs/en.md, phases/09-reinforcement-learning/09-reward-modeling-rlhf/docs/en.md, phases/09-reinforcement-learning/12-rl-for-games/docs/en.md

- **MDP**: Markov Decision Process. States, actions, transitions, rewards, discount.
- **TD**: Temporal Difference. Update from a one step bootstrapped target.
- **DQN**: Deep Q-Network. Q-learning with replay, target net and reward clipping.
- **A2C**: Advantage Actor-Critic. Synchronous batched parallel envs.
- **GAE**: Generalized Advantage Estimation. Weighted sum of TD residuals.
- **PPO**: Proximal Policy Optimization. Clipped importance ratio, many epochs.
- **RLHF**: Reinforcement Learning from Human Feedback. SFT, then RM, then PPO.
- **GRPO**: Group Relative Policy Optimization. PPO variant without a critic.

## Questions
type: qa
from: phases/09-reinforcement-learning/03-monte-carlo-methods/docs/en.md, phases/09-reinforcement-learning/04-q-learning-sarsa/docs/en.md, phases/09-reinforcement-learning/06-policy-gradients-reinforce/docs/en.md, phases/09-reinforcement-learning/09-reward-modeling-rlhf/docs/en.md, phases/09-reinforcement-learning/12-rl-for-games/docs/en.md

- **On-policy or off-policy?** On-policy learns from its own data. Off-policy learns from another policy's data.
- **Q-learning or SARSA?** Q-learning bootstraps on the max. SARSA uses the next action it takes and is more cautious.
- **Why subtract a baseline?** It keeps the gradient unbiased and cuts the variance.
- **Why the KL in RLHF?** It keeps the policy near the data where the RM was trained.
- **Why GRPO for reasoning?** No value network, so half the memory. Per prompt normalization fits sparse rewards.

## Tips
type: tips
from: phases/09-reinforcement-learning/01-mdps-states-actions-rewards/docs/en.md, phases/09-reinforcement-learning/02-dynamic-programming/docs/en.md, phases/09-reinforcement-learning/05-dqn/docs/en.md, phases/09-reinforcement-learning/07-actor-critic-a2c-a3c/docs/en.md, phases/09-reinforcement-learning/08-ppo/docs/en.md

- Write the five MDP tuples before you write a training loop.
- Check a tabular agent against the DP value $V^{\ast}$.
- Decay $\epsilon$ from 1.0 to 0.01 over the first 10% of training.
- Normalize advantages per batch to zero mean and unit std.
- Compute the ratio as exp(log_new minus log_old) for numerical stability.
- Start PPO with $K = 10$ epochs and minibatches of 64.
