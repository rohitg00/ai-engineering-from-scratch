# ReWOO and Plan-and-Execute: Decoupled Planning

> ReAct interleaves thought and action in one stream. ReWOO separates them: one big plan up front, then execute. 5x fewer tokens, +4% accuracy on HotpotQA, and you can distill the planner into a 7B model. Plan-and-Execute generalized it; Plan-and-Act scaled it to web navigation.

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop)
**Time:** ~60 minutes

## Learning Objectives

- Explain why ReWOO's Planner / Worker / Solver split saves tokens and improves robustness over ReAct's interleaved loop.
- Implement a plan DAG, a dependency-ordered executor, and a solver that composes worker outputs — all stdlib.
- Decide when a task should run as plan-then-execute vs interleaved ReAct, using the 2026 "five workflow patterns" framing (Anthropic).
- Recognize when Plan-and-Act's synthetic plan data is needed for long-horizon web or mobile tasks.

## The Problem

ReAct's interleaved thought-action-observation loop is simple and flexible, but each tool call has to carry the full prior context — including every previous thought. Token usage grows quadratically with depth. Worse: when a tool fails mid-loop, the model has to re-derive the whole plan from the error observation.

ReWOO (Xu et al., arXiv:2305.18323, May 2023) noticed this and made a bet: plan the whole thing up front, fetch evidence in parallel, compose the answer at the end. One LLM call to plan, N tool calls for evidence (can be parallel), one LLM call to solve. The trade is less flexibility (the plan is static) for much better token efficiency and clearer failure modes.

## The Concept

### The three roles

```
Planner:  user_question -> [plan_dag]
Workers:  [plan_dag]     -> [evidence]        (tool calls, possibly parallel)
Solver:   user_question, plan_dag, evidence -> final_answer
```

Planner produces a DAG. Each node names a tool, its arguments, and which earlier nodes it depends on (references like `#E1`, `#E2`). Workers execute nodes in topological order. Solver stitches everything together.

### Why 5x fewer tokens

ReAct grows prompt length linearly with step count. At step 10, the prompt contains thought 1 plus action 1 plus observation 1 plus thought 2 plus action 2 plus observation 2, and so on. Each intermediate step also redundantly includes the original prompt.

ReWOO pays one planner prompt (large), N small worker prompts (each just the tool call, no chain), and one solver prompt. On HotpotQA the paper measures ~5x fewer tokens while scoring +4 absolute accuracy.

### Why it is more robust

If worker 3 fails in ReAct, the loop has to reason out of the error mid-stream. In ReWOO, worker 3 returns an error string; the solver sees it in context with the original plan and can degrade gracefully. Failure localization is per-node, not per-step.

### Planner distillation

The paper's second result: because the planner does not see observations, you can fine-tune a 7B model on planner outputs from a 175B teacher. The small model handles planning; the big model is not needed at inference. This is now standard — many 2026 production agents use a small planner and a big executor or vice-versa.

### Plan-and-Execute (LangChain, 2023)

The LangChain team's August 2023 post generalized ReWOO into a pattern name: Plan-and-Execute. Up-front planner emits a step list, executor runs each step, an optional replanner can revise after observing results. This is closer to ReAct than ReWOO (the replanner brings observations back into planning) but preserves the token savings.

### Plan-and-Act (Erdogan et al., arXiv:2503.09572, ICML 2025)

Plan-and-Act scales the pattern to long-horizon web and mobile agents. The key contribution is synthetic plan data: a labeled trajectory generator produces training data where the plan is explicit. Used to fine-tune planner models that keep working past 30–50 steps on WebArena-like tasks where a single ReAct trajectory loses coherence.

### When to pick which

| Pattern | When |
|---------|------|
| ReAct | Short tasks, unknown environment, need reactive exception handling |
| ReWOO | Structured tasks with known tools, token-sensitive, parallelizable evidence |
| Plan-and-Execute | Like ReWOO but with replanning after partial execution |
| Plan-and-Act | Long-horizon (>30 steps), web/mobile/computer-use |
| Tree of Thoughts | Search is worth paying for (Lesson 04) |

Anthropic's Dec 2024 guidance: start with the simplest. If the task is one tool call plus a summary, do not build ReWOO. If the task is a 40-step research assignment, do not do ReAct alone.

## Build It

`code/main.py` implements a toy ReWOO:

- `Planner` — a scripted policy that emits a plan DAG from a prompt.
- `Worker` — dispatches each node's tool call via the registry.
- `Solver` — scripted composition that reads evidence and produces a final answer.
- Dependency resolution — references like `#E1` are substituted with earlier worker outputs.

The demo answers "What is the population of the capital of France, rounded to millions?" using a two-step plan: (1) look up the capital, (2) look up the population, then solve.

Run it:

```
python3 code/main.py
```

The trace shows the full plan first, then worker results, then solver composition. Compare the token count (we print a rough character count) to a ReAct-style interleaved run — ReWOO wins on this kind of structured task.

## Use It

LangGraph ships Plan-and-Execute as a recipe (`create_react_agent` for ReAct, custom graphs for plan-execute). CrewAI's Flows encode the pattern directly: you define tasks up front and the Flow DAG executes them. Plan-and-Act's synthetic data approach is still mostly research; the runtime pattern (explicit plan DAG) ships in production through LangGraph and CrewAI Flows.

## Ship It

`outputs/skill-rewoo-planner.md` generates a ReWOO plan DAG from a user request, given a tool catalog. It validates the plan (acyclic, every reference resolved, every tool exists) before handing off to an executor.

## Exercises

1. Parallelize worker execution for independent plan nodes. What does it buy you on a 6-node DAG with 2 parallel groups?
2. Add a replanner node that fires if any worker returns an error. What is the smallest change to ReWOO that makes it Plan-and-Execute?
3. Replace `Planner` with a small model (7B class) and keep `Solver` on a frontier model. Compare end-to-end quality — where does the split fail?
4. Read Section 4 of the ReWOO paper on planner distillation. Reproduce the 175B -> 7B result conceptually: what training data do you need, and how do you score plan quality?
5. Port the toy to Plan-and-Act's trajectory shape: plan is a sequence, not a DAG. What tradeoffs change?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| ReWOO | "Reasoning without observations" | Plan, then fetch evidence in parallel, then solve — no observations in the planning prompt |
| Plan-and-Execute | "LangChain's plan-execute pattern" | ReWOO with an optional replanner node after execution |
| Plan-and-Act | "Scaled plan-execute" | Explicit planner/executor split with synthetic plan training data for long-horizon tasks |
| Evidence reference | "#E1, #E2, ..." | Plan-node placeholder substituted with prior worker output at dispatch time |
| Planner distillation | "Small planner, big executor" | Fine-tune a small model on planner traces from a large teacher |
| Token efficiency | "Fewer round trips" | 5x fewer tokens on HotpotQA vs ReAct in the paper |
| DAG executor | "Topological dispatcher" | Runs plan nodes in dependency order; parallel at each level |

## Further Reading

- [Xu et al., ReWOO: Decoupling Reasoning from Observations (arXiv:2305.18323)](https://arxiv.org/abs/2305.18323) — the canonical paper
- [Erdogan et al., Plan-and-Act (arXiv:2503.09572)](https://arxiv.org/abs/2503.09572) — scaled planner-executor with synthetic plans
- [LangGraph Plan-and-Execute tutorial](https://docs.langchain.com/oss/python/langgraph/overview) — the framework recipe
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — pick the simplest pattern that works
