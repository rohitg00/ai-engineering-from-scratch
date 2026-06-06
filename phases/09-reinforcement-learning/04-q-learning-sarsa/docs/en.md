# Temporal Difference — Q-Learning & SARSA

> Monte Carlo waits until the episode ends. TD updates after every step by bootstrapping the next value estimate. Q-learning is off-policy and optimistic; SARSA is on-policy and cautious. Both are one line of code. Both underpin every deep-RL method in this phase.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (Dynamic Programming), Phase 9 · 03 (Monte Carlo)
**Time:** ~75 minutes

## The Problem

Monte Carlo works but it has two expensive demands. It needs episodes that terminate, and it only updates after the final return is in. If your episode is 1,000 steps, MC waits 1,000 steps to update anything. It is high-variance, low-bias, and slow in practice.

Dynamic programming has the opposite profile — zero-variance bootstrapped backups — but requires a known model.

Temporal difference (TD) learning splits the difference. From a single transition `(s, a, r, s')`, form a one-step target `r + γ V(s')` and nudge `V(s)` toward it. No model. No complete episodes. Bias from using an approximate `V` on the RHS, but dramatically lower variance than MC and online updates from step one.

This is the pivot on which all of modern RL — DQN, A2C, PPO, SAC — turns. The rest of Phase 9 is layers of function approximation and tricks built on top of the one-step TD update you will write in this lesson.

## The Concept

![Q-learning vs SARSA: off-policy max vs on-policy Q(s', a')](../assets/td.svg)

**The TD(0) update for V:**

`V(s) ← V(s) + α [r + γ V(s') - V(s)]`

The bracketed quantity is the TD error `δ = r + γ V(s') - V(s)`. It is the online analogue of `G_t - V(s_t)` in MC. Convergence requires `α` satisfying Robbins-Monro (`Σ α = ∞`, `Σ α² < ∞`) and all states visited infinitely often.

**Q-learning.** An off-policy TD method for control:

`Q(s, a) ← Q(s, a) + α [r + γ max_{a'} Q(s', a') - Q(s, a)]`

The `max` assumes the *greedy* policy will be followed from `s'` onward, regardless of what action the agent actually takes. That decoupling makes Q-learning learn `Q*` while the agent explores via ε-greedy. Mnih et al. (2015) converted this into deep Q-learning on Atari (Lesson 05).

**SARSA.** An on-policy TD method:

`Q(s, a) ← Q(s, a) + α [r + γ Q(s', a') - Q(s, a)]`

The name is the tuple `(s, a, r, s', a')`. SARSA uses the action `a'` the agent *actually* takes next, not the greedy `argmax`. Converges to `Q^π` for whatever ε-greedy `π` is running, which in the limit `ε → 0` becomes `Q*`.

**The cliff-walking difference.** On the classic cliff-walking task (fall-off-cliff = reward -100), Q-learning learns the optimal path along the cliff edge but occasionally takes the penalty during exploration. SARSA learns a safer path one step away from the cliff because it factors exploration noise into its Q-value. With training, both reach optimal at `ε → 0`. In practice it matters: when exploration is actually happening at deployment, SARSA's behavior is more conservative.

**Expected SARSA.** Replace `Q(s', a')` with its expected value under `π`:

`Q(s, a) ← Q(s, a) + α [r + γ Σ_{a'} π(a'|s') Q(s', a') - Q(s, a)]`

Lower variance than SARSA (no sample of `a'`), same on-policy target. Often the default in modern textbooks.

**n-step TD and TD(λ).** Interpolate between TD(0) and MC by waiting `n` steps before bootstrapping. `n=1` is TD, `n=∞` is MC. TD(λ) averages over all `n` with geometric weights `(1-λ)λ^{n-1}`. Most deep-RL uses `n` between 3 and 20.

## Build It

### Step 1: SARSA on ε-greedy policy

```python
def sarsa(env, episodes, alpha=0.1, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})

    def choose(s):
        if random() < epsilon:
            return choice(ACTIONS)
        return max(Q[s], key=Q[s].get)

    for _ in range(episodes):
        s = env.reset()
        a = choose(s)
        while True:
            s_next, r, done = env.step(s, a)
            a_next = choose(s_next) if not done else None
            target = r + (gamma * Q[s_next][a_next] if not done else 0.0)
            Q[s][a] += alpha * (target - Q[s][a])
            if done:
                break
            s, a = s_next, a_next
    return Q
```

Eight lines. The *only* difference from Q-learning is the target line.

### Step 2: Q-learning

```python
def q_learning(env, episodes, alpha=0.1, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})
    for _ in range(episodes):
        s = env.reset()
        while True:
            a = choose(s, Q, epsilon)
            s_next, r, done = env.step(s, a)
            target = r + (gamma * max(Q[s_next].values()) if not done else 0.0)
            Q[s][a] += alpha * (target - Q[s][a])
            if done:
                break
            s = s_next
    return Q
```

The `max` decouples target from behavior. That one symbol is the difference between on-policy and off-policy.

### Step 3: learning curves

Track mean return per 100 episodes. Q-learning converges faster on simple deterministic GridWorld; SARSA is more conservative on cliff-walking. On the 4×4 GridWorld in `code/main.py`, both are near-optimal after ~2,000 episodes with `α=0.1, ε=0.1`.

### Step 4: compare to DP truth

Run value iteration (Lesson 02) to get `Q*`. Check `max_{s,a} |Q_learned(s,a) - Q*(s,a)|`. A healthy tabular TD agent lands within `~0.5` on the 4×4 GridWorld after 10,000 episodes.

## Pitfalls

- **Initial Q values matter.** Optimistic init (`Q = 0` for a negative-reward task) encourages exploration. Pessimistic init can trap a greedy policy forever.
- **α schedule.** Constant `α` is fine for non-stationary problems. Decaying `α_n = 1/n` gives convergence in theory but is too slow in practice — pin `α` in `[0.05, 0.3]` and monitor the learning curve.
- **ε schedule.** Start high (`ε=1.0`), decay to `ε=0.05`. "GLIE" (greedy in the limit with infinite exploration) is the convergence condition.
- **Max bias in Q-learning.** The `max` operator is biased upward when `Q` is noisy. Leads to overestimation — Hasselt's Double Q-learning (used by DDQN in Lesson 05) fixes this with two Q tables.
- **Non-terminating episodes.** TD can learn without terminals, but you need to either cap steps or handle bootstrap correctly at the cap. Standard: treat cap as non-terminal, keep bootstrapping.
- **State hashing.** If states are tuples/tensors, use a hashable key (tuple, not list; tuple of floats rounded, not raw).

## Use It

The 2026 TD landscape:

| Task | Method | Reason |
|------|--------|--------|
| Small tabular environments | Q-learning | Learns optimal policy directly. |
| On-policy safety-critical | SARSA / Expected SARSA | Conservative during exploration. |
| High-dimensional state | DQN (Phase 9 · 05) | Neural-net Q-function with replay and target net. |
| Continuous actions | SAC / TD3 (Phase 9 · 07) | TD update on a Q-network; policy net emits actions. |
| LLM RL (reward-model-based) | PPO / GRPO (Phase 9 · 08, 12) | Actor-critic with TD-style advantage via GAE. |
| Offline RL | CQL / IQL (Phase 9 · 08) | Q-learning with conservative regularization. |

Ninety percent of the "RL" you read about in 2026 papers is some elaboration of Q-learning or SARSA. Understand the tabular update in your fingers before reading deeper.

## Ship It

Save as `outputs/skill-td-agent.md`:

```markdown
---
name: td-agent
description: Pick between Q-learning, SARSA, Expected SARSA for a tabular or small-feature RL task.
version: 1.0.0
phase: 9
lesson: 4
tags: [rl, td-learning, q-learning, sarsa]
---

Given a tabular or small-feature environment, output:

1. Algorithm. Q-learning / SARSA / Expected SARSA / n-step variant. One-sentence reason tied to on-policy vs off-policy and variance.
2. Hyperparameters. α, γ, ε, decay schedule.
3. Initialization. Q_0 value (optimistic vs zero) and justification.
4. Convergence diagnostic. Target learning curve, `|Q - Q*|` check if DP is possible.
5. Deployment caveat. How will exploration behave at inference? Is SARSA's conservatism needed?

Refuse to apply tabular TD to state spaces > 10⁶. Refuse to ship a Q-learning agent without a max-bias caveat. Flag any agent trained with ε held at 1.0 throughout (no exploitation phase).
```

## Exercises

1. **Easy.** Implement Q-learning and SARSA on the 4×4 GridWorld. Plot learning curves (mean return per 100 episodes) for 2,000 episodes. Who converges faster?
2. **Medium.** Build a cliff-walking environment (4×12, last row is the cliff with reward -100 and reset to start). Compare Q-learning and SARSA final policies. Screenshot the paths each takes. Which is closer to the cliff?
3. **Hard.** Implement Double Q-learning. On a noisy-reward GridWorld (Gaussian noise σ=5 added to per-step reward), show Q-learning overestimates `V*(0,0)` by a meaningful amount while Double Q-learning does not.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| TD error | "The update signal" | `δ = r + γ V(s') - V(s)`, the bootstrapped residual. |
| TD(0) | "One-step TD" | Update after every transition using only the next state's estimate. |
| Q-learning | "Off-policy RL 101" | TD update with `max` over next-state actions; learns `Q*` regardless of behavior policy. |
| SARSA | "On-policy Q-learning" | TD update using the actual next action; learns `Q^π` for current ε-greedy π. |
| Expected SARSA | "The low-variance SARSA" | Replace sampled `a'` with its expectation under π. |
| GLIE | "Correct exploration schedule" | Greedy in the Limit with Infinite Exploration; needed for Q-learning convergence. |
| Bootstrapping | "Using current estimate in the target" | What distinguishes TD from MC. Source of bias but massive variance reduction. |
| Maximization bias | "Q-learning overestimates" | `max` over noisy estimates is upward-biased; fixed by Double Q-learning. |

## Further Reading

- [Watkins & Dayan (1992). Q-learning](https://link.springer.com/article/10.1007/BF00992698) — the original paper and convergence proof.
- [Sutton & Barto (2018). Ch. 6 — Temporal-Difference Learning](http://incompleteideas.net/book/RLbook2020.pdf) — TD(0), SARSA, Q-learning, Expected SARSA.
- [Hasselt (2010). Double Q-learning](https://papers.nips.cc/paper_files/paper/2010/hash/091d584fced301b442654dd8c23b3fc9-Abstract.html) — fix for maximization bias.
- [Seijen, Hasselt, Whiteson, Wiering (2009). A Theoretical and Empirical Analysis of Expected SARSA](https://ieeexplore.ieee.org/document/4927542) — expected SARSA motivation.
- [Rummery & Niranjan (1994). On-line Q-learning using connectionist systems](https://www.researchgate.net/publication/2500611_On-Line_Q-Learning_Using_Connectionist_Systems) — the paper that coined SARSA (then called "modified connectionist Q-learning").
- [Sutton & Barto (2018). Ch. 7 — n-step Bootstrapping](http://incompleteideas.net/book/RLbook2020.pdf) — generalizes TD(0) to TD(n), the path from Q-learning to eligibility traces and, later, GAE in PPO.
