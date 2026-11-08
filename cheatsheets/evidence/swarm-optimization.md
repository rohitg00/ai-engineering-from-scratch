# Evidence: cheatsheets/swarm-optimization.md

Abbreviations: P = phases/16-multi-agent-and-swarms/19-swarm-optimization-pso-aco, M = phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo, S = phases/16-multi-agent-and-swarms/09-parallel-swarm-networks, R = phases/09-reinforcement-learning/10-multi-agent-rl. d = docs/en.md, c = code/main.py.

## PSO vs ACO (comparison, 7 rows)
- Problem: continuous vs routing: P/d:68, 73
- Memory p_best / g_best vs pheromone task-type × agent: P/d:32, 144-145
- Agent use LMPSO, Model Swarms, AMRO-S: P/d:36, 47, 57
- 13.3% over 12 baselines, 4.7x speedup: P/d:47, 61
- Population 10-30, 3 agents 4 task types: P/d:41, 70, 103
- Inertia + cognitive + social, decay then gated deposit: P/d:32, P/c:97-101
- run_lmpso(), run_amro_s(): P/c:34, 116

## MARL algorithms (comparison, 7 rows)
- NeurIPS 2017, ICML 2018, NeurIPS 2022: M/d:3
- Cooperative, competitive, mixed; cooperative only; cooperative baseline: M/d:3, 45, 65
- Critic sees all actions, monotone mixer, centralized value: M/d:32, 51, 59
- Off-policy vs on-policy PPO: M/d:61, 157
- Particle World, SMAC, Football / Hanabi / MPE: M/d:24-26
- Past ~10 agents, monotone limit, default baseline: M/d:41, 55, 65
- run_maddpg_style, run_qmix_style, run_mappo_style: M/c:94, 107, 124

## MARL regimes (comparison, 4 rows)
- IQL / IPPO others as environment: R/d:36
- CTDE central critic, local policy: R/d:38
- Self-play copy of past self: R/d:44
- League population of past policies: R/d:46
- Fits: loosely-coupled R/d:36, cooperative navigation R/d:126, zero-sum R/d:44, cycles R/d:46
- Examples: MADDPG, COMA, MAPPO, QMIX R/d:39-42, AlphaZero R/d:44, AlphaStar R/d:46
- Notes: convergence none R/d:36, most common R/d:38, dominance cycle R/d:117, exploiters R/d:46

## Queue swarm vs fixed assignment (comparison, 5 rows)
- Who picks: S/c:30-35, 39-43, 60-64
- run_sequential, run_fixed_assignment, run_swarm: S/c:30, 39, 60
- Load balance, fast workers idle: S/d:83, S/c:120, 124
- Fits: sequential baseline S/d:79, durations anticipated S/d:39, independent tasks S/d:38
- Weak points: worker 0 slow tasks S/c:89-90, 120; ordering and debugging S/d:44-46

## Use each method when (concepts, 8)
- PSO: P/d:67-70
- ACO: P/d:72-75
- Neither: P/d:77-80
- Genetic algorithm: P/d:79
- Swarm: S/d:38-39
- Supervisor for global plan: S/d:3, 45
- Start with MAPPO: M/d:132
- Self-play zero-sum, league for cycles: R/d:44, 46

## Run the patterns (task-table, 8)
- python3 code/main.py: P/d:109
- history = run_lmpso(): P/c:153
- run_amro_s(n_tasks=200, seed=0): P/c:116
- print_pheromone_table(router): P/c:142, 169
- bench(label, runner), 500 trials: M/c:131-133
- run_swarm(tasks, n_workers): S/c:60
- independent_q(episodes=1500): R/c:41, 131
- joint_q_learning(episodes=1500), 16 joint actions: R/c:67, 69, 132

## PSO update (annotated-code, 9 lines)
- w, c1, c2 = 0.6, 1.2, 1.2: P/c:36
- r1, r2: P/c:54
- cognitive, social: P/c:56-57
- velocity and position update: P/c:58-59
- clamp to bounds: P/c:60
- f = fitness(p.x): P/c:61
- if f > p.p_best_fit, then g_best_fit: P/c:62-67

## ACO router (annotated-code, 7 lines)
- PheromoneRouter(task_types, agents), trails start at 1.0: P/c:84, 121
- router.choose sample by weight: P/c:86-95, 134
- simulate_task: P/c:135
- router.deposit: P/c:137
- decay all agents: P/c:98-99
- quality gate and reinforce: P/c:100-101

## CTDE pattern (architecture, 6 nodes, 5 edges)
- Global state, all obs + joint action: R/d:38, M/d:32
- Centralized critic at training time: M/d:39, R/d:38
- Agent 1 obs o_i: M/d:32, 82
- Actor 1 mu_i(o_i): M/d:32, 35
- Agent 2 obs o_i: M/d:32, 82
- Actor 2 mu_i(o_i): M/d:32, 35

## Defaults in the lesson code (defaults, 8)
- n_particles 20: P/c:34
- iterations 30: P/c:34
- decay 0.05: P/c:77
- reinforce 0.2: P/c:77
- quality_threshold 0.6: P/c:78
- n_tasks 200: P/c:116
- epsilon 0.15: R/c:41
- gamma 0.95, alpha 0.1: R/c:41

## Failure modes (troubleshooting, 8)
- Fast-but-wrong agent, quality gate: P/d:63, 124
- Catastrophic drift, reset or double decay: P/d:92, 125
- Decay too fast forgets solutions: P/d:91-92
- Starvation, priority queue with aging: S/d:60-63, 101
- Crash mid-run, idempotent and durable: S/d:102-103
- Policy drift, centralized critic, slow learning rates: R/d:114
- Non-stationary replay, relabel or weight by recency: R/d:112
- Auction agents bid zero, reward design: R/d:115

## Questions (qa, 5)
- Discrete prompt, evaluator only: P/d:12, 86
- 20 particles, 50 iterations, ~$20 at ~$0.02: P/d:90
- Monotone mixing, decentralized argmax: M/d:51
- Prompt policies, train only with data, reward, infrastructure: M/d:75
- |A|² = 16: R/d:78

## Ship checklist (tips, 6)
- 10-20 particles, 20-50 iterations: P/d:122
- Log pheromones or g_best: P/d:123
- Cost-per-iteration metric: P/d:126
- Trace ID and back-pressure: S/d:104-105
- Execution path sees only o_i: M/d:134
- Log every agent's streams: M/d:133
