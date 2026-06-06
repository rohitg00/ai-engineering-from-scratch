# Actor-Critic — A2C and A3C

> REINFORCE is noisy. Add a critic that learns `V̂(s)`, subtract it from the return, and you get an advantage that has the same expectation but far lower variance. That is actor-critic. A2C runs it synchronously; A3C runs it across threads. Both are the mental model for every modern deep-RL method.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 9 · 04 (TD Learning), Phase 9 · 06 (REINFORCE)
**Time:** ~75 minutes

## The Problem

Vanilla REINFORCE works, but its variance is terrible. Monte Carlo returns `G_t` can swing over a factor of 10 between episodes. Multiplying that noise by `∇ log π` and averaging produces a gradient estimator that takes thousands of episodes to move the policy the same distance you could move it with far fewer DQN updates.

The variance comes from using raw returns. If you subtract a baseline `b(s_t)` — any function of state, including a learned value — the expectation is unchanged and the variance drops. The best tractable baseline is `V̂(s_t)`. Now the quantity multiplying `∇ log π` is the *advantage*:

`A(s, a) = G - V̂(s)`

An action is good if it produced above-average return; bad if below. REINFORCE with a learned critic is *actor-critic*. The critic gives the actor a low-variance teacher. This is every deep-policy method after 2015 (A2C, A3C, PPO, SAC, IMPALA).

## The Concept

![Actor-critic: policy net plus value net, TD residual as advantage](../assets/actor-critic.svg)

**Two networks, one shared loss:**

- **Actor** `π_θ(a | s)`: the policy. Sampled to act. Trained with policy gradient.
- **Critic** `V_φ(s)`: estimates expected return from state. Trained to minimize `(V_φ(s) - target)²`.

**The advantage.** Two standard forms:

- *MC advantage:* `A_t = G_t - V_φ(s_t)`. Unbiased, higher variance.
- *TD advantage:* `A_t = r_{t+1} + γ V_φ(s_{t+1}) - V_φ(s_t)`. Biased (uses `V_φ`), far lower variance. Also called the *TD residual* `δ_t`.

**n-step advantage.** Interpolate between the two:

`A_t^{(n)} = r_{t+1} + γ r_{t+2} + … + γ^{n-1} r_{t+n} + γ^n V_φ(s_{t+n}) - V_φ(s_t)`

`n = 1` is pure TD. `n = ∞` is MC. Most implementations use `n = 5` for Atari, `n = 2048` for PPO on MuJoCo.

**Generalized Advantage Estimation (GAE).** Schulman et al. (2016) proposed an exponentially weighted average over all n-step advantages:

`A_t^{GAE} = Σ_{l=0}^{∞} (γλ)^l δ_{t+l}`

with `λ ∈ [0, 1]`. `λ = 0` is TD (low variance, high bias). `λ = 1` is MC (high variance, unbiased). `λ = 0.95` is the 2026 default — tune until the bias/variance dial is where you want it.

**A2C: synchronous advantage actor-critic.** Collect `T` steps across `N` parallel environments. Compute advantages for each step. Update actor and critic on the combined batch. Repeat. The simpler, more-scalable sibling of A3C.

**A3C: asynchronous advantage actor-critic.** Mnih et al. (2016). Spawn `N` worker threads, each running an env. Each worker computes gradients locally on its own rollout, then asynchronously applies them to a shared parameter server. No replay buffer needed — workers decorrelate by running different trajectories. A3C proved you could train on CPUs at scale. In 2026, GPU-based A2C (batched parallel envs) dominates because GPUs want large batches.

**The combined loss.**

`L(θ, φ) = -E[ A_t · log π_θ(a_t | s_t) ]  +  c_v · E[(V_φ(s_t) - G_t)²]  -  c_e · E[H(π_θ(·|s_t))]`

Three terms: policy-gradient loss, value regression, entropy bonus. `c_v ~ 0.5`, `c_e ~ 0.01` are canonical starting points.

## Build It

### Step 1: a critic

Linear critic `V_φ(s) = w · features(s)` updated with MSE:

```python
def critic_update(w, x, target, lr):
    v_hat = dot(w, x)
    err = target - v_hat
    for j in range(len(w)):
        w[j] += lr * err * x[j]
    return v_hat
```

On a tabular env the critic converges in a few hundred episodes. On Atari, replace the linear critic with a shared CNN trunk + value head.

### Step 2: n-step advantage

Given a rollout of length `T` and a bootstrapped final `V(s_T)`:

```python
def compute_advantages(rewards, values, gamma=0.99, lam=0.95, last_value=0.0):
    advantages = [0.0] * len(rewards)
    gae = 0.0
    for t in reversed(range(len(rewards))):
        next_v = values[t + 1] if t + 1 < len(values) else last_value
        delta = rewards[t] + gamma * next_v - values[t]
        gae = delta + gamma * lam * gae
        advantages[t] = gae
    returns = [a + v for a, v in zip(advantages, values)]
    return advantages, returns
```

`returns` is the critic target. `advantages` is what multiplies `∇ log π`.

### Step 3: combined update

```python
for step_i, (x, a, _r, probs) in enumerate(traj):
    adv = advantages[step_i]
    target_v = returns[step_i]

    # critic
    critic_update(w, x, target_v, lr_v)

    # actor
    for i in range(N_ACTIONS):
        grad_logpi = (1.0 if i == a else 0.0) - probs[i]
        for j in range(N_FEAT):
            theta[i][j] += lr_a * adv * grad_logpi * x[j]
```

On-policy, one rollout per update, separate learning rates for actor and critic.

### Step 4: parallelization (A3C vs A2C)

- **A3C:** spin up `N` threads. Each runs its own env and its own forward pass. Periodically push gradient updates to a shared master. No locks on the master — races are ok, they just add noise.
- **A2C:** run `N` env instances in a single process, stack observations into a `[N, obs_dim]` batch, batched forward pass, batched backward pass. Higher GPU utilization, deterministic, easier to reason about. The default in 2026.

Our toy code is single-threaded for clarity; rewriting to batched A2C is three lines of numpy.

## Pitfalls

- **Critic bias before actor gradient.** If the critic is random, its baseline is uninformative and you are training on pure noise. Warm up the critic for a few hundred steps before turning on the policy gradient, or use a slow actor learning rate.
- **Advantage normalization.** Normalize advantages to zero-mean/unit-std per batch. Stabilizes training massively at near-zero cost.
- **Shared trunk.** Use a shared feature extractor for actor and critic on image inputs. Separate heads. The shared features free-ride on both losses.
- **On-policy contract.** A2C reuses data for exactly one update. More and your gradient is biased (importance-sampling correction is what PPO adds).
- **Entropy collapse.** Without `c_e > 0`, policy becomes near-deterministic in a few hundred updates and stops exploring.
- **Reward scale.** Advantage magnitudes depend on reward scale. Normalize rewards (e.g., running-std dividing) for consistent gradient magnitudes across tasks.

## Use It

A2C/A3C are rarely the final choice in 2026 but they are the architecture everything later refines:

| Method | Relation to A2C |
|--------|----------------|
| PPO | A2C + clipped importance ratio for multi-epoch updates |
| IMPALA | A3C + V-trace off-policy correction |
| SAC (Phase 9 · 07) | Off-policy A2C with a soft-value critic (next lesson) |
| GRPO (Phase 9 · 12) | A2C without the critic — group-relative advantage |
| DPO | A2C collapsed into a preference-ranking loss, no sampling |
| AlphaStar / OpenAI Five | A2C with league training + imitation pre-training |

If you see "advantage" in a 2026 paper, think actor-critic.

## Ship It

Save as `outputs/skill-actor-critic-trainer.md`:

```markdown
---
name: actor-critic-trainer
description: Produce an A2C / A3C / GAE configuration for a given environment, with advantage estimation and loss weights specified.
version: 1.0.0
phase: 9
lesson: 7
tags: [rl, actor-critic, gae]
---

Given an environment and compute budget, output:

1. Parallelism. A2C (GPU batched) vs A3C (CPU async) and the number of workers.
2. Rollout length T. Steps per env per update.
3. Advantage estimator. n-step or GAE(λ); specify λ.
4. Loss weights. `c_v` (value), `c_e` (entropy), gradient clip.
5. Learning rates. Actor and critic (separate if using).

Refuse single-worker A2C on environments with horizon > 1000 (too on-policy, too slow). Refuse to ship without advantage normalization. Flag any run with `c_e = 0` and observed entropy < 0.1 as entropy-collapsed.
```

## Exercises

1. **Easy.** Train actor-critic with MC advantage (`G_t - V(s_t)`) on 4×4 GridWorld. Compare sample efficiency to REINFORCE-with-running-mean-baseline from Lesson 06.
2. **Medium.** Switch to TD-residual advantage (`r + γ V(s') - V(s)`). Measure variance of the advantage batches. By how much does it drop?
3. **Hard.** Implement GAE(λ). Sweep `λ ∈ {0, 0.5, 0.9, 0.95, 1.0}`. Plot final return vs sample efficiency. Where is the bias/variance sweet spot for this task?

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Actor | "The policy net" | `π_θ(a\|s)`, updated by policy gradient. |
| Critic | "The value net" | `V_φ(s)`, updated by MSE regression to returns / TD targets. |
| Advantage | "How much better than average" | `A(s, a) = Q(s, a) - V(s)` or its estimators. Multiplier for `∇ log π`. |
| TD residual | "δ" | `δ_t = r + γ V(s') - V(s)`; one-step advantage estimate. |
| GAE | "The interpolation knob" | Exponentially weighted sum of n-step advantages, parameterized by `λ`. |
| A2C | "Synchronous actor-critic" | Batched across envs; one gradient step per rollout. |
| A3C | "Async actor-critic" | Worker threads push gradients to a shared param server. Original paper; less common in 2026. |
| Bootstrap | "Use V at the horizon" | Truncate the rollout, add `γ^n V(s_{t+n})` to close the sum. |

## Further Reading

- [Mnih et al. (2016). Asynchronous Methods for Deep Reinforcement Learning](https://arxiv.org/abs/1602.01783) — A3C, the original async actor-critic paper.
- [Schulman et al. (2016). High-Dimensional Continuous Control Using Generalized Advantage Estimation](https://arxiv.org/abs/1506.02438) — GAE.
- [Sutton & Barto (2018). Ch. 13 — Actor-Critic Methods](http://incompleteideas.net/book/RLbook2020.pdf) — foundations; pair this with Ch. 9 on function approximation when the critic is a neural net.
- [Espeholt et al. (2018). IMPALA](https://arxiv.org/abs/1802.01561) — scalable distributed actor-critic with V-trace off-policy correction.
- [OpenAI Baselines / Stable-Baselines3](https://stable-baselines3.readthedocs.io/) — production A2C/PPO implementations worth reading.
- [Konda & Tsitsiklis (2000). Actor-Critic Algorithms](https://papers.nips.cc/paper/1786-actor-critic-algorithms) — the foundational convergence result for the two-timescale actor-critic decomposition.
