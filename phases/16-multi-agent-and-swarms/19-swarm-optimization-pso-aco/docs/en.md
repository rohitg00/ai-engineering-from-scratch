# Swarm Optimization for LLMs (PSO, ACO)

> Bio-inspired optimization is making an LLM comeback. **LMPSO** (arXiv:2504.09247) uses PSO where each particle's velocity is a prompt and the LLM generates the next candidate; works well on structured-sequence outputs (math expressions, programs). **Model Swarms** (arXiv:2410.11163) treats each LLM expert as a PSO particle on a model-weight manifold and reports **13.3% average gain** over 12 baselines on 9 datasets with just 200 instances. **SwarmPrompt** (ICAART 2025) hybridizes PSO + Grey Wolf for prompt optimization. **AMRO-S** (arXiv:2603.12933) is ACO-inspired pheromone specialists for multi-agent LLM routing — **4.7x speedup**, interpretable routing evidence, quality-gated asynchronous update that decouples inference from learning. This lesson implements PSO on prompt parameter space and ACO on agent routing, measures why these classical algorithms fit the LLM era, and when they do not.

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 09 (Parallel Swarm Networks), Phase 16 · 14 (Consensus and BFT)
**Time:** ~75 minutes

## Problem

You have a prompt that scores 62% on your task eval. You want to improve it. The naive move is gradient-free manual tweaking, which scales badly. Reinforcement learning needs reward signals and enough rollouts to train. Backprop through prompts is not really possible — the prompt is a discrete string, not a differentiable parameter.

Classical bio-inspired optimization — PSO for continuous search spaces, ACO for path selection — was designed exactly for this regime: gradient-free, population-based, cheap per evaluation. Pair them with LLMs for the gradient-free search step, and you get a surprisingly practical optimizer.

The same patterns apply to agent *routing* in multi-agent systems. An ACO-style pheromone trail records which agent worked best on which task-type, lets the router exploit the trail, and decays pheromones so routes can be rediscovered.

## Concept

### PSO refresher (Kennedy & Eberhart 1995)

Particle Swarm Optimization: population of particles in a continuous search space. Each particle has position `x_i` and velocity `v_i`. Each iteration:

```
v_i <- w * v_i + c1 * r1 * (p_best_i - x_i) + c2 * r2 * (g_best - x_i)
x_i <- x_i + v_i
evaluate fitness(x_i)
update p_best_i if improved
update g_best if global best
```

Where `p_best` is particle's own best, `g_best` is swarm's best, `w, c1, c2` are inertia + cognitive + social weights, `r1, r2` are random factors.

### PSO on LLM outputs — LMPSO

arXiv:2504.09247 adapts PSO for LLM-generated structured outputs (math expressions, programs). Each particle is a candidate output. Velocity is a *prompt* that describes how to modify the current output toward the personal/global best. The LLM generates the new output from the velocity prompt. The "inertia" of the velocity is a prompt like "make small incremental changes."

This works well when:
- The output is structured (parseable, evaluable).
- Fitness is automatic (test runs, arithmetic evaluation).
- Population is small (~10-30 particles) so total LLM calls stay manageable.

It does not work well when fitness needs human review — the per-iteration cost becomes prohibitive.

### Model Swarms

arXiv:2410.11163 takes PSO off the output layer and into the *model* layer. Each "particle" is an expert LLM (parameters). The swarm moves the parameters toward the collective best via a gradient-free update. Reported: 13.3% average gain over 12 baselines on 9 datasets, with just 200 instances per iteration.

The key insight is that LLM expert models are already nearby in a shared parameter manifold (adapter weights, LoRA deltas). PSO on this low-dimensional subspace is cheap and effective.

### ACO refresher (Dorigo 1992)

Ant Colony Optimization: ants traverse a graph; each path has a pheromone trail. Ant move probabilities weight by pheromone strength. Ants that complete the task deposit pheromone proportional to solution quality. Pheromone decays over time.

### AMRO-S — ACO for agent routing

arXiv:2603.12933 uses ACO for multi-agent routing. Each task-type is a "destination"; each agent is a possible route. Pheromones strengthen routes that produce good outputs. Key contributions:

- **Interpretable routing evidence.** Pheromone strength is a human-readable signal.
- **Quality-gated asynchronous update.** Pheromones update only after quality checks pass, decoupling inference from learning.
- **4.7x speedup** on the multi-agent routing benchmark.

The quality gate matters: without it, fast-but-wrong agents accrue pheromone, and the system locks in on bad routes.

### When to use PSO / ACO for LLMs

**Use PSO when:**
- Search space is continuous or maps to continuous parameters (prompt embeddings, LoRA weights, numeric generation parameters).
- Fitness is cheap and automatic.
- Population can be small (10-30).

**Use ACO when:**
- You have a routing or path-selection problem.
- Decisions reinforce over time (the same task types come back).
- You need interpretable evidence for routing decisions.

**Do not use either when:**
- Fitness requires human review (too expensive per iteration).
- The search space is discrete and combinatorial in a way that PSO does not cover (use genetic algorithms instead).
- Real-time decisions need strict latency (PSO/ACO converge slowly relative to single-pass heuristics).

### Why bio-inspired still wins

Gradient-based methods need differentiable signals. LLM outputs and routing decisions are not trivially differentiable. Pseudo-gradient methods (reinforcement-learned routers, DPO-style prompt tuners) work but need expensive training.

PSO and ACO need only an *evaluator* function. If you can score a candidate output or a routing decision, you can optimize over the space. That makes the bar for applicability much lower.

### Practical limits

- **Population budget.** N particles × T iterations × per-eval cost. For LLM evals at ~$0.02 / call, a 20-particle PSO running 50 iterations costs ~$20. Plan accordingly.
- **Exploration vs exploitation.** Pheromone decay rate and PSO inertia trade off; too fast decay → forget solutions; too slow → stuck on early local optima.
- **Catastrophic drift.** Both algorithms can converge and then diverge if fitness landscape shifts (new data distribution). Monitor best-fitness stability.

## Build It

`code/main.py` implements:

- `LMPSO` — PSO over numeric prompt parameters (temperature, top_k weights). Each particle's "LLM generation" is simulated as a scripted fitness function. Runs the algorithm for 30 iterations and shows g_best convergence.
- `AMRO_S` — ACO-style routing. 3 agents, 4 task types, pheromone matrix, 100 routed tasks. Prints (task_type → agent choices) distribution over time to show trail formation.
- Comparison: random routing vs ACO routing on the same task stream. Measures quality and latency.

Run:

```
python3 code/main.py
```

Expected output:
- LMPSO: g_best fitness improves from random to near-optimal over 30 iterations.
- AMRO-S: pheromone table stabilizes on the right agent per task-type; ACO routing beats random by ~30-40% on quality and also reduces latency (fewer retries).

## Use It

`outputs/skill-swarm-optimizer.md` helps choose between PSO, ACO, genetic algorithms, and gradient-based optimizers for LLM / agent optimization problems.

## Ship It

- **Start small.** 10-20 particles, 20-50 iterations. Scale up only if the convergence curve shows clear gain.
- **Log pheromones or g_best per iteration.** Debugging swarm optimizers without a trail is painful.
- **Quality-gate updates.** Especially for ACO routing: fast-and-wrong agents must not accrue pheromone.
- **Reset decay on distribution shift.** When your eval distribution changes, aged pheromones are stale; reset or double the decay rate temporarily.
- **Cap the per-iteration cost.** Emit a cost-per-iteration metric. PSO that costs $500 / iteration and gains 0.5% is not shippable.

## Exercises

1. Run `code/main.py`. Observe LMPSO convergence. Vary population size 5, 10, 20, 50. At what size does time-to-converge saturate?
2. Implement a "catastrophic drift" experiment: after iteration 30, change the fitness function. How fast does PSO adapt? Does resetting `p_best` help?
3. Add a quality gate to AMRO-S: pheromone deposit only on runs with eval score > 0.7. How does this change convergence vs the un-gated version?
4. Read LMPSO (arXiv:2504.09247). Map the paper's "velocity as a prompt" back to your numeric velocity. What is lost in the simulation and what is preserved?
5. Read AMRO-S (arXiv:2603.12933). Implement the decoupled "inference fast-path" with asynchronous pheromone update. How does this change system latency under sustained load?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| PSO | "Particle Swarm Optimization" | Kennedy-Eberhart 1995. Population-based gradient-free optimizer. |
| ACO | "Ant Colony Optimization" | Dorigo 1992. Path/route optimization via pheromone trails. |
| LMPSO | "PSO with LLM generation" | arXiv:2504.09247. Velocity is a prompt; LLM produces candidates. |
| Model Swarms | "PSO on expert weights" | arXiv:2410.11163. Gradient-free update on model parameter subspace. |
| AMRO-S | "ACO for agent routing" | arXiv:2603.12933. Pheromone matrix over task-type × agent. |
| p_best / g_best | "Personal / global best" | Per-particle and swarm-wide best solutions found so far. |
| Pheromone | "Routing memory" | Strength on an edge; decays over time; deposits on quality. |
| Quality-gated update | "Only learn from good runs" | Pheromone deposit conditioned on quality check. |
| Catastrophic drift | "Distribution shift" | Fitness landscape changes; old p_best and pheromones become stale. |

## Further Reading

- [Kennedy & Eberhart — Particle Swarm Optimization](https://ieeexplore.ieee.org/document/488968) — the 1995 PSO paper
- [Dorigo — Ant Colony Optimization](https://www.aco-metaheuristic.org/about.html) — 1992 ACO foundations
- [LMPSO — Language Model Particle Swarm Optimization](https://arxiv.org/abs/2504.09247) — PSO for structured LLM outputs
- [Model Swarms — gradient-free LLM expert optimization](https://arxiv.org/abs/2410.11163) — PSO on model-weight subspace
- [AMRO-S — ant-colony multi-agent routing](https://arxiv.org/abs/2603.12933) — pheromone-driven routing with quality gate
