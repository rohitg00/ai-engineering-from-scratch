# Planning with HTN and Evolutionary Search

> Symbolic planning handles the cases where the plan is provably correct. Evolutionary code search handles the cases where the fitness function is machine-checkable. ChatHTN (2025) and AlphaEvolve (2025) show what each unlocks when paired with an LLM.

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 02 (ReWOO and Plan-and-Execute)
**Time:** ~75 minutes

## Learning Objectives

- Explain Hierarchical Task Networks: tasks, methods, operators, preconditions, effects.
- Describe ChatHTN's hybrid loop — symbolic search with LLM fallback decomposition.
- Explain AlphaEvolve's evolutionary loop and why it only works with a programmatic evaluator.
- Implement a toy HTN planner plus a toy evolutionary search in stdlib.

## The Problem

ReWOO (Lesson 02), Plan-and-Execute, and ReAct cover most agent planning. Two cases they don't cover well:

1. **Plans with provable correctness.** Scheduling, flight pathing, compliance workflows — the plan must be sound by construction. A fluent LLM plan that sometimes hallucinates a step is unacceptable.
2. **Optimizations with a machine-checkable fitness function.** Matrix multiplication, scheduling heuristics, compiler passes — the goal is not "a correct plan" but "the best plan."

HTN planning and AlphaEvolve solve the two different problems. Both use LLMs as amplifiers, not replacements.

## The Concept

### Hierarchical Task Networks

An HTN is:

- **Tasks** — compound (to be decomposed) and primitive (directly executable).
- **Methods** — ways to decompose a compound task into subtasks, with preconditions.
- **Operators** — primitive actions with preconditions and effects.
- **State** — a set of facts.

Planning: given a goal task and an initial state, find a decomposition into primitive operators whose preconditions are satisfied in sequence.

HTN is older than LLMs and still the reference for provably-correct plans.

### ChatHTN (Gopalakrishnan et al., 2025)

ChatHTN (arXiv:2505.11814) interleaves symbolic HTN with LLM queries:

1. Try to decompose the current compound task with existing methods.
2. If no method applies, ask the LLM: "how would you decompose `task` in state `s`?"
3. Translate the LLM response into candidate subtasks.
4. Validate against the operator schema; reject invalid decompositions.
5. Recurse.

The paper's central claim: every plan produced is provably sound because LLM suggestions only enter as candidate decompositions, never as direct plan edits. The symbolic layer owns correctness; the LLM expands the method library.

Online method learning (OpenReview `gwYEDY9j2x`, 2025 follow-up) adds a learner that generalizes LLM-produced decompositions by regression — cutting LLM query frequency up to 75%.

### AlphaEvolve (Novikov et al., 2025)

AlphaEvolve (arXiv:2506.13131, DeepMind, June 2025) is a different beast: evolutionary code search orchestrated by a Gemini 2.0 Flash/Pro ensemble.

Loop:

1. Start with a seed program + a programmatic evaluator (returns a fitness score).
2. Ensemble of LLMs proposes mutations.
3. Run mutations through the evaluator.
4. Keep the best; mutate again.

Published wins:

- First improvement over Strassen for 4x4 complex matrix multiplication in 56 years (48 scalar multiplications).
- 0.7% recovered Google compute via a Borg scheduling heuristic.
- 32% FlashAttention speedup on a frontier workload.

The hard constraint: the fitness function must be machine-checkable. Evolutionary search over prose answers does not converge.

### When to use which

| Problem class | Use | Why |
|---------------|-----|-----|
| Scheduling with hard constraints | HTN + ChatHTN | Provable soundness |
| Compiler optimization | AlphaEvolve | Machine-checkable fitness |
| Multi-step task execution | ReAct / ReWOO | LLM in the loop, no formal guarantees |
| Code improvement with tests | AlphaEvolve | Tests are the evaluator |
| Policy-bound automation | HTN | Preconditions encode policy |

### Where this pattern goes wrong

- **HTN without operators.** Without precondition/effect schemas the soundness claim collapses. ChatHTN's "LLM suggests decomposition" requires the schema to reject invalid moves.
- **AlphaEvolve without a real evaluator.** "Ask the LLM if the code is better" is not a fitness function. The evaluator must be deterministic and fast.
- **Over-engineering.** Most agent tasks don't need either. Reach for ReAct or ReWOO first.

## Build It

`code/main.py` implements two toys:

- A stdlib HTN planner with operators, methods, preconditions, effects, and a `LLMFallback` that kicks in when no method matches a compound task. The "LLM" is a scripted decomposer so the planner runs offline.
- A stdlib evolutionary search over arithmetic programs: grow expressions whose output minimizes `|f(x) - target|` over a test set. Evaluator is deterministic.

Run it:

```
python3 code/main.py
```

The trace shows the HTN planner decomposing a compound task (with a mid-plan LLM fallback) and the evolutionary loop converging on a target expression.

## Use It

- **HTN planners** — `pyhop`, `SHOP3`, or build your own for domain-specific policy enforcement.
- **ChatHTN** — research code; the pattern (symbolic + LLM fallback) ports cleanly to any HTN planner.
- **AlphaEvolve** — DeepMind paper; the pattern (ensemble + evaluator) is reproducible. OpenEvolve and similar open-source forks are emerging.
- **Agent frameworks** — none ship first-class HTN or AlphaEvolve yet. Build it as a subagent or a background worker.

## Ship It

`outputs/skill-hybrid-planner.md` generates a hybrid planner scaffold (HTN or evolutionary) with the LLM role explicitly scoped.

## Exercises

1. Extend the HTN planner with backtracking: when an operator's postcondition fails at runtime, roll back and try the next method.
2. Add a LLM-method cache to ChatHTN: when the LLM decomposes task `T` in state pattern `P`, store the result. Re-check the method library first on the next call.
3. Swap the evolutionary search evaluator to a real test suite. Evolve a sort function that passes 20 test cases; report generations to convergence.
4. Read AlphaEvolve's evaluator design notes. Design an evaluator for a domain you care about (SQL query optimization, test-suite minimization, deployment YAML).
5. Combine: use HTN to decompose a compound task into subtasks, then use evolutionary search on each subtask's primitive operator. Where does it shine, where does it over-engineer?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| HTN | "Hierarchical planner" | Task decomposition with operators, preconditions, effects |
| Method | "Decomposition rule" | Way to break a compound task into subtasks |
| Operator | "Primitive action" | Concrete step with precondition and effect |
| ChatHTN | "LLM + HTN" | Symbolic planner asks LLM when no method matches |
| AlphaEvolve | "Evolutionary code search" | Ensemble LLMs mutate code; deterministic evaluator selects |
| Fitness function | "Evaluator" | Deterministic, machine-checkable score over outputs |
| Online method learning | "Cached LLM decomposition" | Store + generalize LLM plans to cut query cost |

## Further Reading

- [Gopalakrishnan et al., ChatHTN (arXiv:2505.11814)](https://arxiv.org/abs/2505.11814) — symbolic + LLM hybrid planner
- [Novikov et al., AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131) — evolutionary code search with LLM mutations
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — when to reach for a planner vs a simple loop
