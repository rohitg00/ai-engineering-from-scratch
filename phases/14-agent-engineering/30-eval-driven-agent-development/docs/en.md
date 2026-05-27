# Eval-Driven Agent Development

> Anthropic's guidance: "start with simple prompts, optimize them with comprehensive evaluation, and add multi-step agentic systems only when needed." Evaluation is not the last step. It's the outer loop that drives every other choice in Phase 14.

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** All of Phase 14.
**Time:** ~60 minutes

## Learning Objectives

- Name the three evaluation layers — static benchmarks, custom offline, online production — and what each is for.
- Explain the evaluator-optimizer tight loop.
- Describe the 2026 best practice: evals live next to code, run in CI, gate PRs.
- Connect every Phase 14 lesson to the eval case it generates.

## The Problem

Agents pass demos. They fail in production in ways demos cannot predict. Benchmarks answer "is this model broadly capable?" not "is this agent shipping the right patches for my product?" The answer: evaluation at three layers, running continuously, with every guardrail and learned rule mapped to an eval case.

## The Concept

### Three evaluation layers

1. **Static benchmarks** — SWE-bench Verified for code (Lesson 19), WebArena/OSWorld for browsing / desktop (Lesson 20), GAIA for generalist (Lesson 19), BFCL V4 for tool use (Lesson 06). Use for cross-model comparison and regression gating. Contamination is real: SWE-bench+ found 32.67% solution leakage. Always report Verified / +-audited scores.

2. **Custom offline evals** — your product's shape:
   - LLM-as-judge (Langfuse, Phoenix, Opik — Lesson 24).
   - Execution-based (run the patch, check tests).
   - Trajectory-based (compare action sequences against gold; OSWorld-Human shows top agents 1.4-2.7x over gold).

3. **Online evals** — production:
   - Session replays (Langfuse).
   - Guardrail-triggered alerts (Lesson 16, 21).
   - Per-step cost / latency tracking (Lesson 23 OTel spans).

### Evaluator-optimizer (Anthropic)

The tight loop:

1. Proposer generates output.
2. Evaluator judges.
3. Refine until evaluator passes.

This is Self-Refine (Lesson 05) generalized. Any agent flow you care about can wrap in evaluator-optimizer for reliability.

### 2026 best practice

- Evals live next to code.
- Run in CI on every PR.
- Gate merge on eval scores (e.g. "no regression > 5% vs main").
- Every guardrail maps to an eval case.
- Every learned rule (Reflexion, pro-workflow learn-rule) maps to a failure case.

### Tying Phase 14 together

Every lesson in Phase 14 generates eval cases:

| Lesson | Eval case it generates |
|--------|------------------------|
| 01 Agent Loop | Budget-exhausted, infinite-loop guard |
| 02 ReWOO | Planner replans correctly when a tool fails |
| 03 Reflexion | Learned reflections apply on retry |
| 05 Self-Refine/CRITIC | Judge passes refined output |
| 06 Tool Use | Argument coercion works; unknown tools rejected |
| 07-10 Memory | Retrieval citations match sources; stale facts invalidate |
| 12 Workflow Patterns | Each pattern produces correct output |
| 13 LangGraph | Resume reproduces state exactly |
| 14 AutoGen Actors | DLQ catches crashed handlers |
| 16 OpenAI Agents SDK | Guardrail trips on the right inputs |
| 17 Claude Agent SDK | Subagent results return to orchestrator |
| 19-20 Benchmarks | SWE-bench Verified score, WebArena success rate, OSWorld efficiency |
| 21 Computer Use | Per-step safety catches injected DOM |
| 23 OTel | Spans emit required attributes |
| 26 Failure Modes | Detectors tag known failures |
| 27 Prompt Injection | PVE refuses poisoned retrievals |
| 28 Orchestration | Supervisor routes to the right specialist |
| 29 Runtime Shapes | DLQ handles N% failure |

If your eval suite has cases for each, you have covered Phase 14.

### Where eval-driven development fails

- **No baseline.** Evals without a last-known-good are unreadable. Store baselines.
- **LLM-judge without grounding.** Judges hallucinate too. CRITIC pattern (Lesson 05) — judge grounds on external tools.
- **Over-fitting to evals.** Optimizing for the eval diverges from production usefulness. Rotate cases.
- **Flaky evals.** Non-deterministic cases cause false alarms. Pin seeds, snapshot state.

## Build It

`code/main.py` is a stdlib eval harness:

- Case registry with categories (benchmark, custom, online).
- A scripted agent under test.
- Evaluator-optimizer loop: propose, judge, refine until pass or max rounds.
- CI gate: aggregate pass rate + regression against baseline.

Run it:

```
python3 code/main.py
```

Output: per-case pass/fail, regression flag, CI gate verdict.

## Use It

- Write eval cases in the same repo as your agent code.
- Run them on every PR via CI.
- Fail the build on regression.
- Track pass rate over time.
- Tie every production failure to a new case.

## Ship It

`outputs/skill-eval-suite.md` builds a three-layer eval suite for an agent product with CI gates and regression tracking.

## Exercises

1. Take one of your production failures. Write an eval case that reproduces it. Does your agent pass it now?
2. Build an LLM-judge rubric for your domain with three dimensions (factual, tone, scope). Score 50 sessions.
3. Wire the eval suite into CI. Fail the build on >=5% regression.
4. Add a trajectory-efficiency metric: how many steps did the agent take vs a gold trajectory?
5. Map every Phase 14 lesson to an eval case in your suite. Any missing? That's a gap to close.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Static benchmark | "Off-the-shelf eval" | SWE-bench, GAIA, AgentBench, WebArena, OSWorld |
| Custom offline eval | "Domain eval" | LLM-as-judge / exec / trajectory on your product shape |
| Online eval | "Production eval" | Session replay, guardrail alerts, cost/latency tracking |
| Evaluator-optimizer | "Propose-judge-refine" | Iterate until judge passes |
| CI gate | "Merge blocker" | Fail the build on eval regression |
| Baseline | "Last-known-good" | Reference score to detect regression |
| Trajectory efficiency | "Steps over gold" | Agent step count divided by human expert minimum |

## Further Reading

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — "start simple, optimize with evals"
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) — the curated benchmark
- [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html) — tool-use benchmark
- [Langfuse docs](https://langfuse.com/) — evals + session replay in practice
