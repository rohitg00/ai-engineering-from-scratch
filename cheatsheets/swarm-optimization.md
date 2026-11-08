---
id: swarm-optimization
title: Swarm Optimization and MARL for Agents
code: SM
subtitle: PSO and ACO for prompts and routing, queue swarms, and MADDPG, QMIX, MAPPO and self-play set side by side.
hue: 160
sources: phases/16-multi-agent-and-swarms/19-swarm-optimization-pso-aco, phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo, phases/16-multi-agent-and-swarms/09-parallel-swarm-networks, phases/09-reinforcement-learning/10-multi-agent-rl
source_hash: 9890d657357bead1
---

## PSO vs ACO
type: comparison
from: phases/16-multi-agent-and-swarms/19-swarm-optimization-pso-aco/docs/en.md, phases/16-multi-agent-and-swarms/19-swarm-optimization-pso-aco/code/main.py

| Factor | PSO | ACO |
|---|---|---|
| Problem | Continuous search space | Routing or path selection |
| Memory | `p_best` and `g_best` | Pheromone per task-type × agent |
| Agent use | LMPSO, Model Swarms | AMRO-S routing |
| Reported gain | 13.3% over 12 baselines | 4.7x speedup |
| Population | 10-30 particles | 3 agents, 4 task types in the demo |
| Update rule | Inertia + cognitive + social | Decay, then gated deposit |
| Demo function | `run_lmpso()` | `run_amro_s()` |

## MARL algorithms
type: comparison
from: phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo/docs/en.md, phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo/code/main.py

| Factor | MADDPG | QMIX | MAPPO |
|---|---|---|---|
| Year, venue | NeurIPS 2017 | ICML 2018 | NeurIPS 2022 |
| Setting | Coop, competitive, mixed | Cooperative only | Cooperative |
| Training signal | Per-agent critic sees all actions | Monotone mixer of per-agent Qs | Centralized value function |
| Policy type | Off-policy | Off-policy | On-policy PPO |
| Testbed | Particle World | SMAC | Football, Hanabi, MPE |
| Limit | Past ~10 agents critics grow | Reward must be monotone | Default baseline to beat |
| Demo | `run_maddpg_style` | `run_qmix_style` | `run_mappo_style` |

## MARL regimes
type: comparison
from: phases/09-reinforcement-learning/10-multi-agent-rl/docs/en.md

| Factor | IQL / IPPO | CTDE | Self-play | League play |
|---|---|---|---|---|
| Idea | Others are environment | Central critic, local policy | Copy of past self | Population of past policies |
| Fits | Loosely-coupled tasks | Cooperative navigation | Zero-sum games | Strategy cycles |
| Examples | Independent Q | MADDPG, COMA, MAPPO, QMIX | AlphaZero | AlphaStar |
| Note | Theoretical convergence: none | Most common modern paradigm | Can stick in a dominance cycle | Adds exploiters and main exploiters |

## Queue swarm vs fixed assignment
type: comparison
from: phases/16-multi-agent-and-swarms/09-parallel-swarm-networks/docs/en.md, phases/16-multi-agent-and-swarms/09-parallel-swarm-networks/code/main.py

| Factor | Sequential | Fixed assignment | Swarm |
|---|---|---|---|
| Who picks work | One worker | Pre-assigned worker id | Workers pull from a shared queue |
| Function | `run_sequential` | `run_fixed_assignment` | `run_swarm` |
| Load balance | None | Fast workers sit idle | Automatic |
| Fits | Baseline only | Durations known ahead | Many independent tasks |
| Weak point | Wall-clock time | Worker 0 gets all slow tasks | Ordering and debugging |

## Use each method when
type: concepts
from: phases/16-multi-agent-and-swarms/19-swarm-optimization-pso-aco/docs/en.md, phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo/docs/en.md, phases/16-multi-agent-and-swarms/09-parallel-swarm-networks/docs/en.md, phases/09-reinforcement-learning/10-multi-agent-rl/docs/en.md

- **PSO**: continuous parameters, cheap automatic fitness, population 10-30.
- **ACO**: routing that repeats over time and needs interpretable evidence.
- **Neither**: fitness needs human review, or latency must be strict.
- **Genetic algorithm**: discrete combinatorial space that PSO does not cover.
- **Swarm**: many independent tasks with variable duration.
- **Supervisor**: the task needs one coherent global plan.
- **MAPPO**: start here for cooperative MARL.
- **Self-play**: zero-sum games. League play when strategies cycle.

## Run the patterns
type: task-table
from: phases/16-multi-agent-and-swarms/19-swarm-optimization-pso-aco/code/main.py, phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo/code/main.py, phases/16-multi-agent-and-swarms/09-parallel-swarm-networks/code/main.py, phases/09-reinforcement-learning/10-multi-agent-rl/code/main.py, phases/16-multi-agent-and-swarms/19-swarm-optimization-pso-aco/docs/en.md

| Task | Code |
|---|---|
| Run any lesson demo | `python3 code/main.py` |
| PSO over 2 prompt parameters | `history = run_lmpso()` |
| ACO routing vs random | `run_amro_s(n_tasks=200, seed=0)` |
| Print the trail | `print_pheromone_table(router)` |
| Steps-to-goal per MARL style | `bench(label, runner)` over 500 trials |
| Pull from a shared queue | `run_swarm(tasks, n_workers)` |
| Independent Q on the grid | `independent_q(episodes=1500)` |
| Joint Q over 16 actions | `joint_q_learning(episodes=1500)` |

## PSO update
type: annotated-code
lang: python
from: phases/16-multi-agent-and-swarms/19-swarm-optimization-pso-aco/code/main.py

```python
w, c1, c2 = 0.6, 1.2, 1.2                  # inertia, cognitive, social
r1, r2 = rng.random(), rng.random()
cognitive = c1 * r1 * (p.p_best[d] - p.x[d])
social = c2 * r2 * (g_best_x[d] - p.x[d])
p.v[d] = w * p.v[d] + cognitive + social
p.x[d] += p.v[d]
p.x[d] = max(bounds[d][0], min(bounds[d][1], p.x[d]))  # clamp to bounds
f = fitness(p.x)                           # only an evaluator, no gradient
if f > p.p_best_fit:                       # then check g_best_fit
```

## ACO router
type: annotated-code
lang: python
from: phases/16-multi-agent-and-swarms/19-swarm-optimization-pso-aco/code/main.py

```python
router = PheromoneRouter(task_types, agents)   # every trail starts at 1.0
aco_agent = router.choose(tt, rng)             # sample by pheromone weight
aq = simulate_task(aco_agent, tt, rng)
router.deposit(tt, aco_agent, aq)
self.pheromones[task_type][a] *= (1.0 - self.decay)    # all agents decay
if quality >= self.quality_threshold:                   # quality gate
    self.pheromones[task_type][agent] += self.reinforce * quality
```

## CTDE pattern
type: architecture
from: phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo/docs/en.md, phases/09-reinforcement-learning/10-multi-agent-rl/docs/en.md

```arch
node | state | 1,1 | Global state | all obs + joint action | store
node | critic | 2,1 | Centralized critic | training time only | model
node | o1 | 1,2 | Agent 1 obs | o_i |
node | a1 | 2,2 | Actor 1 | mu_i(o_i) | process
node | o2 | 3,2 | Agent 2 obs | o_i |
node | a2 | 4,2 | Actor 2 | mu_i(o_i) | process
edge | state | critic | train
edge | critic | a1 | gradient
edge | o1 | a1 | deploy
edge | o2 | a2 | deploy
edge | critic | a2 | gradient
```

## Defaults in the lesson code
type: defaults
from: phases/16-multi-agent-and-swarms/19-swarm-optimization-pso-aco/code/main.py, phases/09-reinforcement-learning/10-multi-agent-rl/code/main.py

| Setting | Default | Note |
|---|---|---|
| `n_particles` | 20 | `run_lmpso` population |
| `iterations` | 30 | PSO iterations |
| `decay` | 0.05 | Pheromone decay per deposit |
| `reinforce` | 0.2 | Deposit is reinforce times quality |
| `quality_threshold` | 0.6 | No deposit below it |
| `n_tasks` | 200 | Routed tasks in `run_amro_s` |
| `epsilon` | 0.15 | Exploration in `independent_q` |
| `gamma` | 0.95 | Discount, with `alpha` 0.1 |

## Failure modes
type: troubleshooting
from: phases/16-multi-agent-and-swarms/19-swarm-optimization-pso-aco/docs/en.md, phases/16-multi-agent-and-swarms/09-parallel-swarm-networks/docs/en.md, phases/09-reinforcement-learning/10-multi-agent-rl/docs/en.md, phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Router locks on a bad agent | Fast-but-wrong agent got pheromone | Quality-gate the deposits |
| Best fitness diverges | Catastrophic drift after data shift | Reset or double the decay rate |
| Swarm forgets good solutions | Decay too fast | Slower decay, monitor best fitness |
| Long tasks never run | Queue starvation | Priority queue with aging |
| Task output appears twice | Worker crashed mid-run | Idempotent workers, durable queue |
| Agents chase each other | Policy drift, non-stationarity | Centralized critic, slow learning rates |
| Old replay hurts learning | Transitions from obsolete opponents | Relabel or weight by recency |
| Auction agents bid zero | Reward hacking via coordination | Careful reward design, constraints |

## Questions
type: qa
from: phases/16-multi-agent-and-swarms/19-swarm-optimization-pso-aco/docs/en.md, phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo/docs/en.md, phases/09-reinforcement-learning/10-multi-agent-rl/docs/en.md

- **Why gradient-free for prompts?** A prompt is a discrete string. PSO and ACO need only an evaluator.
- **What does a 20-particle, 50-iteration PSO cost?** About $20 at ~$0.02 per call.
- **Why does QMIX decentralize?** Monotone mixing lets each agent take its own argmax.
- **Why not train MARL for LLM agents?** Most systems prompt policies. Train only with data, reward and infrastructure.
- **Why is the joint-Q demo slow to scale?** Its action space is `|A|² = 16` for two agents.

## Ship checklist
type: tips
from: phases/16-multi-agent-and-swarms/19-swarm-optimization-pso-aco/docs/en.md, phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo/docs/en.md, phases/16-multi-agent-and-swarms/09-parallel-swarm-networks/docs/en.md

- Start with 10-20 particles and 20-50 iterations.
- Log pheromones or g_best per iteration.
- Emit a cost-per-iteration metric.
- Give every swarm task a trace ID. Apply back-pressure when the queue grows.
- Let the execution path see only `o_i`.
- Log every agent's observation and action stream.
