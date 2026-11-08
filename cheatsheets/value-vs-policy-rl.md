---
id: value-vs-policy-rl
title: Value Methods against Policy Methods
code: VM
subtitle: Q-learning, SARSA, DQN, REINFORCE, A2C and PPO side by side. Targets, defaults, diagnostics and fixes.
hue: 150
sources: phases/09-reinforcement-learning/04-q-learning-sarsa, phases/09-reinforcement-learning/05-dqn, phases/09-reinforcement-learning/06-policy-gradients-reinforce, phases/09-reinforcement-learning/07-actor-critic-a2c-a3c, phases/09-reinforcement-learning/08-ppo
source_hash: 7bd8a51529d66de6
---

## Four methods side by side
type: comparison
span: 2
from: phases/09-reinforcement-learning/04-q-learning-sarsa/docs/en.md, phases/09-reinforcement-learning/05-dqn/docs/en.md, phases/09-reinforcement-learning/06-policy-gradients-reinforce/docs/en.md, phases/09-reinforcement-learning/07-actor-critic-a2c-a3c/docs/en.md, phases/09-reinforcement-learning/08-ppo/docs/en.md

| Factor | Q-learning, SARSA | DQN | REINFORCE | A2C, PPO |
|---|---|---|---|---|
| Learns | Q table | Neural $Q(s, a; \theta)$ | Policy $\pi_\theta(a \mid s)$ | Actor $\pi_\theta$ plus critic $V_\phi(s)$ |
| Picks actions | ε-greedy on Q | ε-greedy on Q | Sample from $\pi_\theta$ | Sample from $\pi_\theta$ |
| Data | Q-learning off-policy, SARSA on-policy | Off-policy, replay buffer | On-policy, one update | A2C one update, PPO K epochs |
| Target | $r + \gamma \max_{a'} Q(s', a')$ | Same, from target net $\theta^-$ | Return $G_t$ | GAE advantage |
| Bias and variance | Bootstrap bias, low variance | Max bias upward | Unbiased, high variance | Critic bias, far lower variance |
| Continuous actions | No | No, route to SAC or TD3 | Yes, Gaussian policy | Yes, Gaussian policy |
| Toy GridWorld | ~2,000 episodes | ~500 episodes | ~500 episodes with a baseline | PPO with ε 0.2, K 4 |

## Use X when
type: tips
from: phases/09-reinforcement-learning/04-q-learning-sarsa/docs/en.md, phases/09-reinforcement-learning/05-dqn/docs/en.md, phases/09-reinforcement-learning/06-policy-gradients-reinforce/docs/en.md, phases/09-reinforcement-learning/07-actor-critic-a2c-a3c/docs/en.md, phases/09-reinforcement-learning/08-ppo/docs/en.md

- Q-learning: small tabular environments. It learns the optimal policy directly.
- SARSA or Expected SARSA: on-policy safety-critical tasks. They stay conservative during exploration.
- DQN: high-dimensional state with discrete actions. It is the reference off-policy algorithm.
- REINFORCE: read it, rarely run it. `loss = -advantage * log_prob` is REINFORCE with a baseline.
- A2C: batched parallel envs on a GPU. GPU-based A2C dominates A3C in 2026.
- PPO: the default for MuJoCo, Atari and RLHF for LLMs.
- SAC or TD3: continuous control. DQN has no policy network.
- GRPO: reasoning LLMs. It is a PPO variant without a critic.

## DQN training loop
type: architecture
from: phases/09-reinforcement-learning/05-dqn/docs/en.md, phases/09-reinforcement-learning/05-dqn/code/main.py

```arch
node | env | 1,1 | Environment | 4x4 GridWorld | client
node | buf | 2,1 | Replay buffer | capacity 2000 | store
node | online | 3,1 | Online net | weights theta | model
node | target | 3,2 | Target net | frozen copy | model
node | loss | 4,1 | train_step | squared TD error | process
edge | env | buf | transitions
edge | buf | online | minibatch 32
edge | online | env | ε-greedy action
edge | target | loss | y = r + γ max
edge | online | loss | q[a]
edge | online | target | clone every 200 steps
```

## PPO training loop
type: flow
from: phases/09-reinforcement-learning/08-ppo/docs/en.md, phases/09-reinforcement-learning/08-ppo/code/main.py

1. **Rollout**: collect N times T transitions across N parallel envs.
2. **Snapshot**: store `log_pi_old` for each action at rollout time.
3. **GAE**: compute advantages, freeze them, normalize per batch.
4. **Epochs**: for K epochs, shuffle the buffer into minibatches.
5. **Ratio**: `ratio = exp(logp - rec["log_pi_old"])`.
6. **Clip**: a sample past 1 ± ε on the beneficial side gets zero gradient.
7. **Losses**: add value MSE and the entropy bonus. Take the gradient step.
8. **Discard**: drop the rollout and collect a new one.

## Value side: TD targets
type: annotated-code
lang: python
from: phases/09-reinforcement-learning/04-q-learning-sarsa/code/main.py

```python
a = epsilon_greedy(Q, s, rng, epsilon)     # behaviour action
s_next, r, done = step(s, a)
best_next = max(Q[s_next].values())        # Q-learning: greedy max
target = r + gamma * best_next
a_next = epsilon_greedy(Q, s_next, rng, epsilon)
target = r + gamma * Q[s_next][a_next]     # SARSA: the next action taken
Q[s][a] += alpha * (target - Q[s][a])      # same TD update for both
Q[s][a] += alpha * (r - Q[s][a])           # terminal step, no bootstrap
```

## Policy side: gradient, GAE, clip
type: annotated-code
lang: python
from: phases/09-reinforcement-learning/06-policy-gradients-reinforce/code/main.py, phases/09-reinforcement-learning/07-actor-critic-a2c-a3c/code/main.py, phases/09-reinforcement-learning/08-ppo/code/main.py

```python
G = r + gamma * G                           # reward-to-go, walked backwards
grad = (1.0 if i == a else 0.0) - probs[i]  # onehot minus probs
theta[i][j] += lr * adv * grad * x[j]       # REINFORCE ascent
delta = traj[t]["r"] + gamma * next_v - traj[t]["v"]  # TD residual
gae = delta + gamma * lam * gae             # GAE with lam=0.95
ratio = math.exp(logp - rec["log_pi_old"])  # PPO importance ratio
clipped = (adv > 0 and ratio > 1 + eps) or (adv < 0 and ratio < 1 - eps)
pg_scale = 0.0                              # clipped sample, no gradient
```

## Tasks in code
type: task-table
from: phases/09-reinforcement-learning/04-q-learning-sarsa/code/main.py, phases/09-reinforcement-learning/05-dqn/code/main.py, phases/09-reinforcement-learning/06-policy-gradients-reinforce/code/main.py, phases/09-reinforcement-learning/07-actor-critic-a2c-a3c/code/main.py, phases/09-reinforcement-learning/08-ppo/code/main.py

| Task | Code |
|---|---|
| Tabular SARSA | `sarsa(episodes, alpha=0.1, gamma=0.99)` |
| Tabular Q-learning | `q_learning(episodes, alpha=0.1, gamma=0.99)` |
| One DQN gradient step | `train_step(online, target, mb, gamma, lr)` |
| Sync the target net | `target = clone(online)` |
| REINFORCE with baseline | `reinforce(episodes, use_baseline=True)` |
| GAE advantages | `gae_advantages(traj, gamma=0.99, lam=0.95)` |
| Train A2C | `actor_critic(episodes, lam=0.95)` |
| PPO update with diagnostics | `mean_kl, clip_frac = ppo_update(...)` |

## Key formulas
type: concepts
from: phases/09-reinforcement-learning/04-q-learning-sarsa/docs/en.md, phases/09-reinforcement-learning/05-dqn/docs/en.md, phases/09-reinforcement-learning/06-policy-gradients-reinforce/docs/en.md, phases/09-reinforcement-learning/07-actor-critic-a2c-a3c/docs/en.md, phases/09-reinforcement-learning/08-ppo/docs/en.md

- **TD error**: $\delta = r + \gamma V(s') - V(s)$
- **SARSA target**: $r + \gamma Q(s', a')$ with the action taken next.
- **DQN loss**: $(r + \gamma \max_{a'} Q(s', a'; \theta^-) - Q(s, a; \theta))^2$
- **Double DQN**: $r + \gamma Q(s', \arg\max_{a'} Q(s', a'; \theta); \theta^-)$
- **Policy gradient**: $\nabla J = \mathbb{E}[G_t \nabla_\theta \log \pi_\theta(a_t \mid s_t)]$
- **Advantage**: $A = G - \hat{V}(s)$. Same expectation, lower variance.
- **GAE**: $A_t = \sum_l (\gamma \lambda)^l \delta_{t+l}$. λ 0 is TD, λ 1 is MC.
- **PPO clip**: $\min(r_t A_t, \mathrm{clip}(r_t, 1-\epsilon, 1+\epsilon) A_t)$

## Defaults
type: defaults
from: phases/09-reinforcement-learning/04-q-learning-sarsa/docs/en.md, phases/09-reinforcement-learning/05-dqn/docs/en.md, phases/09-reinforcement-learning/07-actor-critic-a2c-a3c/docs/en.md, phases/09-reinforcement-learning/08-ppo/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Tabular α and ε | 0.1 | Pin α in [0.05, 0.3] |
| Discount γ | 0.99 | Default in the lesson code |
| DQN target sync | 10,000 | Atari env steps |
| GAE λ | 0.95 | The 2026 default |
| Value weight `c_v` | 0.5 | A2C and PPO |
| Entropy weight `c_e` | 0.01 | A2C and PPO |
| PPO clip ε | 0.2 | 0.1 is timid, 0.3+ is unstable |
| PPO epochs K | 10 | Minibatches of 64 |

## Troubleshooting
type: troubleshooting
from: phases/09-reinforcement-learning/04-q-learning-sarsa/docs/en.md, phases/09-reinforcement-learning/05-dqn/docs/en.md, phases/09-reinforcement-learning/06-policy-gradients-reinforce/docs/en.md, phases/09-reinforcement-learning/07-actor-critic-a2c-a3c/docs/en.md, phases/09-reinforcement-learning/08-ppo/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Q values overestimate | `max` over noisy Q is biased up | Double DQN or Double Q-learning |
| DQN diverges | Deadly triad | Keep the target net and the replay buffer |
| DQN overfits early | Gradients on ~20 samples | Wait for a few thousand transitions |
| Policy stops exploring | Entropy collapse | Entropy bonus, `c_e` above 0 |
| Policy gradient explodes | Huge returns | Normalize G to ~N(0, 1) per batch |
| Actor learns noise | Critic is still random | Warm up the critic, slow actor LR |
| PPO mean KL past 0.1 | Too many epochs or high LR | Reduce `K_EPOCHS` or `LR` |
| Clip fraction near 0 | Clip never triggers | Raise `LR` or `K_EPOCHS` |

## Abbreviations
type: glossary
from: phases/09-reinforcement-learning/04-q-learning-sarsa/docs/en.md, phases/09-reinforcement-learning/05-dqn/docs/en.md, phases/09-reinforcement-learning/07-actor-critic-a2c-a3c/docs/en.md, phases/09-reinforcement-learning/08-ppo/docs/en.md

- **TD**: temporal difference. Update after every step from a bootstrapped target.
- **SARSA**: the tuple (s, a, r, s', a'). On-policy TD.
- **GLIE**: Greedy in the Limit with Infinite Exploration. The ε condition.
- **DQN**: Q-learning with a neural Q, replay buffer and target network.
- **GAE**: Generalized Advantage Estimation. Weighted sum of n-step advantages.
- **A2C, A3C**: synchronous batched, or asynchronous threaded, actor-critic.
- **TRPO**: Trust Region Policy Optimization. KL constraint, conjugate gradients.
- **PPO**: Proximal Policy Optimization. Clipped importance ratio.

## Questions
type: qa
from: phases/09-reinforcement-learning/04-q-learning-sarsa/docs/en.md, phases/09-reinforcement-learning/06-policy-gradients-reinforce/docs/en.md, phases/09-reinforcement-learning/08-ppo/docs/en.md, phases/09-reinforcement-learning/07-actor-critic-a2c-a3c/docs/en.md

- **Why is Q-learning off-policy?** The `max` assumes the greedy policy, whatever action the agent takes.
- **Why is SARSA safer on the cliff?** It puts exploration noise into its Q values.
- **Why are value methods weak on continuous actions?** `argmax` over a 10-dimensional torque is hard.
- **Why is a baseline unbiased?** The expected baseline times the log-policy gradient is 0.
- **Why can PPO reuse a rollout?** The clip stops the update once the policy drifts too far.
- **Most common PPO bug?** A flipped sign. Minimize the negative of the clipped surrogate.
