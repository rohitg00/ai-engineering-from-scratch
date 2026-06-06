# MARL — MADDPG, QMIX, MAPPO

> The reinforcement-learning heritage of multi-agent coordination, which still informs LLM-agent systems in 2026. **MADDPG** (Lowe et al., NeurIPS 2017, arXiv:1706.02275) introduced Centralized Training, Decentralized Execution (CTDE): each critic sees all agents' states and actions during training; at test time only local actors run. Works for cooperative, competitive, and mixed settings. **QMIX** (Rashid et al., ICML 2018, arXiv:1803.11485) is value-decomposition with a monotonic mixing network; per-agent Qs combine into joint Q so `argmax` distributes cleanly — dominant on StarCraft Multi-Agent Challenge (SMAC). **MAPPO** (Yu et al., NeurIPS 2022, arXiv:2103.01955) is PPO with a centralized value function; "surprisingly effective" on particle-world, SMAC, Google Research Football, Hanabi with minimal tuning. These underpin training policies for agent teams that must act decentrally. MAPPO is the **default 2026 cooperative-MARL baseline**. This lesson builds each from a small grid-world toy and lands the three ideas in muscle memory before touching LLM-agent training.

**Type:** Learn
**Languages:** Python (stdlib, small NumPy-free implementations)
**Prerequisites:** Phase 09 (Reinforcement Learning), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~90 minutes

## Problem

LLM-agent systems increasingly train policies for inter-agent coordination: when to defer, when to act, which peer to call. The literature that tells you how to train such policies is Multi-Agent Reinforcement Learning (MARL), which predates the LLM wave and has a small set of dominant algorithms.

Reading MARL papers without the pattern vocabulary is painful. Centralized training with decentralized execution (CTDE), value decomposition, and centralized critics are not buzzwords — they are specific answers to specific problems:

- Independent RL (each agent learns alone) is non-stationary from each agent's perspective. Bad.
- Centralized RL (one agent controls all) does not scale and violates execution constraints.
- CTDE gets the best of both: train with global information, deploy with local policies.

## Concept

### Three environments the papers use

- **Particle World (multi-agent particle env).** Simple 2D physics with cooperative/competitive tasks. MADDPG's original testbed.
- **StarCraft Multi-Agent Challenge (SMAC).** Cooperative micro-management, partial observation. QMIX's testbed. Discrete actions, continuous states.
- **Google Research Football, Hanabi, MPE.** MAPPO baselines.

Different envs have different action/observation types. The algorithms pick accordingly.

### MADDPG (2017) — the CTDE pattern

Each agent `i` has an actor `mu_i(o_i)` that maps its own observation to action. Each agent also has a critic `Q_i(x, a_1, ..., a_n)` that sees all observations and all actions during training. The actor is updated by policy gradient against the critic's evaluation.

```
actor update:    grad_theta_i J = E[grad_theta mu_i(o_i) * grad_a_i Q_i(x, a_1..n) at a_i=mu_i(o_i)]
critic update:   TD on Q_i(x, a_1..n) given next-state joint estimate
```

Why CTDE: at training time, we know everyone's actions; we use that to reduce variance in each critic. At deploy time, each agent only sees `o_i` and calls `mu_i(o_i)`.

Failure mode: critics grow with N agents (input includes all actions). Does not scale past ~10 agents without approximations.

### QMIX (2018) — value decomposition

Cooperative only. Global reward is the sum of a monotone function of per-agent Q-values:

```
Q_tot(tau, a) = f(Q_1(tau_1, a_1), ..., Q_n(tau_n, a_n)),   df/dQ_i >= 0
```

The monotonicity guarantees `argmax_a Q_tot` can be computed by each agent choosing `argmax_{a_i} Q_i` independently. That is **exactly the decentralized execution property** you need. At training time, a mixing network produces `Q_tot` from the per-agent Qs.

Why QMIX wins on SMAC: cooperative StarCraft micro-management has homogeneous agents, local obs, global reward — perfect fit for value decomposition.

Failure mode: the monotonicity constraint is restrictive; some tasks have reward structures that are not monotone decomposable (one agent sacrificing for the team). Extensions (QTRAN, QPLEX) relax this.

### MAPPO (2022) — the overlooked default

Multi-Agent PPO: PPO with a centralized value function. Each agent has its own policy; all agents share (or have per-agent) value functions that see the full state. Yu et al. 2022 benchmarked MAPPO against MADDPG, QMIX, and their extensions on five benchmarks and found:

- MAPPO matches or beats off-policy MARL methods on particle-world, SMAC, Google Research Football, Hanabi, MPE.
- Minimal hyperparameter tuning required.
- Stable training; reproducible across seeds.

The community underrated on-policy MARL until this paper. In 2026, MAPPO is the default baseline for cooperative MARL; any new method must beat it.

### Why LLM-agent engineers should care

Three direct uses:

1. **Router training.** A meta-agent chooses which sub-agent handles a task. This is a MARL problem with N decentralized sub-agents and one centralized router. MAPPO fits.
2. **Role emergence.** In generative-agent simulations, training agents to adopt complementary roles over time is a MARL problem in disguise. QMIX-style value decomposition forces complementarity by construction.
3. **Multi-agent tool use.** When agents share tools and compete for budget, training them via CTDE produces deployable local policies that respect resource constraints.

Practical caveat: in 2026, most production LLM-agent systems prompt their policies rather than train them. MARL comes in when you have (a) lots of interaction data, (b) a clear reward signal, and (c) willingness to invest in training infrastructure.

### CTDE as a design pattern beyond RL

Even without training, CTDE is a useful architectural pattern:

- During *design*, assume full team visibility.
- At *runtime*, enforce decentralized execution: each agent sees only `o_i`.

The pattern forces you to keep per-agent state explicit and to think about partial observability up front. Many production multi-agent systems silently assume shared state everywhere — CTDE discipline prevents that.

### The non-stationarity problem

When multiple agents learn simultaneously, each agent's environment (which includes others' policies) is non-stationary. Classical single-agent RL proofs break. The MARL algorithms in this lesson all address this:

- MADDPG: global critic sees all actions, so its value estimate is stationary.
- QMIX: value decomposition moves learning to a joint-Q space where optimality is well-defined.
- MAPPO: the centralized value function dampens variance from others' policy changes.

In LLM-agent systems, non-stationarity manifests as "my agent worked last month, now that other agent upstream changed, mine misbehaves." Training MARL with CTDE is the principled fix; prompt-level fixes are faster but less durable.

### What this lesson does NOT cover

Training actual networks is a Phase 09 topic. This lesson builds scripted-policy versions that demonstrate the CTDE, value-decomposition, and centralized-value patterns without gradient updates. The goal is to internalize the patterns before you pick up a full MARL library (PyMARL, MARLlib, RLlib multi-agent).

## Build It

`code/main.py` implements three pattern demonstrations, all on a tiny 2-agent cooperative grid-world:

- Environment: 2 agents on a 4x4 grid, one reward pellet. Reward = 1 if any agent reaches pellet; task finishes.
- `IndependentAgents` — each agent treats others as environment. Baseline.
- `MADDPGStyle` — centralized critic computes a joint value; actor policies update from it. Scripted policy improvement.
- `QMIXStyle` — value decomposition with a monotone mixer.
- `MAPPOStyle` — centralized value function; policies update against the shared baseline.

All four run the same episodes and report average steps-to-goal. The CTDE variants converge to shorter paths than the independent baseline.

Run:

```
python3 code/main.py
```

Expected output: independent agents take ~6 steps on average; CTDE variants converge toward ~3.5 steps (optimal for the 4x4 grid is 3). The pattern difference shows up despite scripted policies.

## Use It

`outputs/skill-marl-picker.md` is a skill that picks a MARL algorithm for a given multi-agent task: cooperative vs competitive, homogeneous vs heterogeneous, action-space type, scale, reward signal.

## Ship It

MARL in production is rare. When you do use it:

- **Start with MAPPO.** The 2022 paper established this as the baseline; reproducing it first saves weeks of chasing fancier methods.
- **Log every agent's observation and action stream.** Debugging MARL without per-agent traces is hopeless.
- **Separate training code from execution code.** CTDE is a discipline; let the execution path really only see `o_i`.
- **Reward shaping warning.** MARL is exquisitely sensitive to reward design. One coordination bug in the shaping and agents learn to exploit it. Run adversarial tests.
- **For LLM agents**, consider prompt-level policies first. Only invest in MARL training when interaction data + reward signal + infrastructure are all present.

## Exercises

1. Run `code/main.py`. Measure the steps-to-goal gap between independent and MAPPO-style agents. Does the gap grow or shrink on a 6x6 grid?
2. Implement a competitive variant: two agents, one pellet, only the first to reach gets reward. Which pattern handles competition cleanly? MADDPG historically.
3. Read MADDPG (arXiv:1706.02275) Section 3. Implement the exact critic update rule symbolically in pseudocode in your own words.
4. Read MAPPO (arXiv:2103.01955). Why do the authors argue centralized value + PPO beats off-policy MARL on their benchmarks? List the three strongest claims.
5. Apply CTDE as a design pattern to a hypothetical LLM-agent system (e.g., research agent + summarizer + coder). What is the joint information available at design time that is not available at runtime?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MARL | "Multi-Agent RL" | Reinforcement learning for multi-agent systems. |
| CTDE | "Centralized Training, Decentralized Execution" | Train with global info; deploy with local policies. |
| MADDPG | "Multi-Agent DDPG" | CTDE with per-agent critic seeing all observations + actions. |
| QMIX | "Value decomposition" | Monotonic mixing of per-agent Qs. Cooperative. |
| MAPPO | "Multi-Agent PPO" | PPO with centralized value function. 2026 default baseline. |
| Value decomposition | "Sum of individual Qs" | Joint Q represented as a monotone function of per-agent Qs. |
| Non-stationarity | "Moving targets" | Each agent's env changes as others learn. The core MARL problem. |
| On-policy / off-policy | "Learn from current / replay" | PPO is on-policy (MAPPO); DDPG and Q-learning are off-policy. |
| SMAC | "StarCraft Multi-Agent Challenge" | Cooperative micromanagement benchmark; QMIX's homegrown ground. |

## Further Reading

- [Lowe et al. — Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments](https://arxiv.org/abs/1706.02275) — MADDPG; NeurIPS 2017
- [Rashid et al. — QMIX: Monotonic Value Function Factorisation for Deep Multi-Agent Reinforcement Learning](https://arxiv.org/abs/1803.11485) — QMIX; ICML 2018
- [Yu et al. — The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games](https://arxiv.org/abs/2103.01955) — MAPPO; NeurIPS 2022
- [BAIR blog post on MAPPO](https://bair.berkeley.edu/blog/2021/07/14/mappo/) — readable framing of the MAPPO result
- [SMAC repository](https://github.com/oxwhirl/smac) — StarCraft Multi-Agent Challenge
