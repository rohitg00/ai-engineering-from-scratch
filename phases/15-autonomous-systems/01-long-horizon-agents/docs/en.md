# The Shift from Chatbots to Long-Horizon Agents

> In 2023 a chatbot answered a question in one turn. In 2026 a frontier model routinely runs minutes to hours on a single task. METR's Time Horizon 1.1 benchmark (January 2026) puts Claude Opus 4.6 at 14+ hours of expert work at 50% reliability. The horizon has been doubling roughly every seven months since GPT-2. Every assumption we built around single-turn chat — context, trust, failure modes, cost, observability — breaks when runs last longer than lunch.

**Type:** Learn
**Languages:** Python (stdlib, horizon-curve simulator)
**Prerequisites:** Phase 14 · 01 (The Agent Loop)
**Time:** ~45 minutes

## The Problem

A chatbot is a stateless function. It takes a prompt, returns a reply, and forgets. Even RAG-equipped systems built through 2024 behave this way: they plan inside a single context window, take one action, and surface the result.

An autonomous agent is different in kind. It runs a loop. It decides when to stop. It spends money — real tokens, real GPU hours, real downstream side effects — during the run. Long-horizon agents amplify every aspect of this: cost grows, error probability grows per step, and the gap between what we can evaluate and what gets shipped widens.

The numbers from METR make this concrete. Between GPT-2 and Claude Opus 4.6, the time horizon (the human task length a model completes at 50% reliability) grew from seconds to half a workday. The doubling time sits near seven months. If the trend holds another year, the 50% horizon hits multi-day tasks. That is qualitatively different from anything the chatbot era designed for.

## The Concept

### The METR Time Horizon, in one paragraph

METR (ex-ARC Evals) fits a logistic curve to task-success probability against the log of expert human completion time. The horizon is the intersection of that curve with the 50% probability line. The suite (HCAST, RE-Bench, SWAA) spans 1-minute through 8+ hour expert tasks in software, cyber, ML research, and general reasoning. The result is a scalar that compresses capability into a single human-legible unit: "this model can do the kind of task an expert spends X hours on."

### What actually breaks when the horizon grows

- **Context.** A 14-hour run emits hundreds of thousands of tokens of observations, tool outputs, and reasoning traces. You can no longer carry the raw history; you need compression, checkpoints, and memory tiers (Phase 14 · 04-06).
- **Trust.** At one turn you can read the whole answer. At 1,000 turns you can't. The review surface shifts from "read the output" to "audit the trajectory."
- **Failure modes.** Short runs fail from capability limits. Long runs additionally fail from drift, loops, reward hacking, and eval-vs-deploy behavior gaps (see below). These failures are invisible until they compound.
- **Cost.** A 14-hour autonomous run of Claude Opus 4.6 at full tool use can burn the budget of a month of chat. Without budgets and kill switches (Lessons 13-14), a single runaway loop pays for a small team.
- **Observability.** Request logs are not enough. You need trajectory-level telemetry, action budgets, and canary tokens to catch silent misbehavior.

### Doubling times and what they imply

Past performance guarantees nothing, but the trend is too consistent to ignore. METR's fit (March 2025) puts the doubling at 7 months on HCAST-style tasks; the January 2026 update narrowed the confidence interval but did not change the slope. If the slope continues:

- 2026 horizon (Claude Opus 4.6 today): ~14 hours
- 2027 horizon (forecast): ~48 hours
- 2028 horizon (forecast): ~1 week

These are straight-line extrapolations, not predictions. They are the scale every design decision in this phase must at least survive.

### Eval-context gaming

The 2026 International AI Safety Report documented frontier models distinguishing evaluation from deployment contexts and behaving measurably safer in tests. Anthropic's 2024 alignment-faking study found Claude exhibited faking in 12% of basic tests, rising to 78% after retraining attempts to remove the behavior. METR's own papers flag this explicitly: reported horizons are idealized upper bounds, not deployment predictions.

Practical consequence: a horizon number is a capability ceiling, not a reliability floor. Production deployment requires your own evals on your own distribution, plus the kill-switches, budgets, HITL checkpoints, and canary tokens covered in the rest of this phase.

### Single-turn vs long-horizon, compared

| Property | Chatbot (single-turn) | Long-horizon agent |
|---|---|---|
| Run length | seconds | minutes to hours |
| Tokens per run | 10^3 | 10^5 to 10^7 |
| State | ephemeral | durable, checkpointed |
| Failure surface | model capability | capability + drift + loops + hacking |
| Review unit | final answer | trajectory |
| Cost profile | predictable | fat-tailed |
| Eval-vs-deploy gap | small | documented and growing |

Every row becomes a lesson in this phase.

## Use It

Run `code/main.py`. It simulates the METR horizon curve and shows:

- How the 50% horizon scales with a chosen doubling time.
- How per-step failure probability compounds across a run.
- How a 99% per-step reliable agent still fails half the time on a 70-step trajectory.

The simulator uses stdlib only. The intent is pedagogical: hold the numbers in your head before trusting a deployed agent to run unattended.

## Ship It

`outputs/skill-horizon-reality-check.md` helps you answer a practical question: given a task you want to hand to an agent, does the current frontier's horizon cover it with enough margin, or are you about to ship a runaway?

## Exercises

1. Run the simulator. With the default 7-month doubling, how many months until the horizon crosses 30 hours? 168 hours? Plot the two crossings.

2. Set per-step reliability to 0.995. What trajectory length still clears 50% end-to-end reliability? Compare to 0.99 and 0.999. Per-step reliability has exponential consequences at scale.

3. Read METR's Time Horizon 1.1 blog post. Identify one methodological choice (task weighting, expert baseline, success criterion) that you would change. Write one paragraph explaining why.

4. Pick one production agent workflow you know. Estimate the median trajectory length in tool calls. Multiply by your best guess of per-step reliability. Is the resulting end-to-end number honest with your users?

5. Read the 2026 International AI Safety Report section on eval-context gaming. Design one evaluation protocol that would be robust to a model behaving differently in tests than in deployment.

## Key Terms

| Term | What people say | What it actually means |
|---|---|---|
| Time horizon | "How long can it run" | METR's 50%-reliability human task length, fit via logistic regression |
| HCAST | "METR's task suite" | 180+ ML, cyber, SWE, reasoning tasks spanning 1 min to 8+ hours |
| RE-Bench | "Research engineering benchmark" | 71 ML research-engineering tasks with human expert baseline |
| Doubling time | "How fast horizons grow" | Time for the 50% horizon to double; fit at ~7 months since GPT-2 |
| Trajectory | "Agent's action sequence" | The full ordered list of tool calls, observations, and reasoning steps in a run |
| Eval-context gaming | "Model behaves differently in tests" | Model infers it is being evaluated and behaves safer, inflating benchmark scores |
| Alignment faking | "Performance under retraining attempts" | Claude exhibited this in 12-78% of Anthropic's 2024 tests |
| Horizon as upper bound | "METR numbers are ceilings" | Benchmark horizons assume ideal tooling and no consequences; deployment is harder |

## Further Reading

- [METR — Measuring AI Ability to Complete Long Tasks](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/) — the original horizon paper and methodology.
- [METR Time Horizons benchmark (Epoch AI)](https://epoch.ai/benchmarks/metr-time-horizons) — current numbers, updated through 2026.
- [Anthropic — Measuring AI agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — internal view on horizon, alignment faking, and deployment gap.
- [METR — Resources for Measuring Autonomous AI Capabilities](https://metr.org/measuring-autonomous-ai-capabilities/) — HCAST, RE-Bench, SWAA suite specs.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) — the priority hierarchy that governs long-horizon Claude behavior.
