# Supervisor / Orchestrator-Worker Pattern

> One lead agent plans and delegates; specialized workers execute in parallel contexts and report back. This is the pattern behind Anthropic's Research system (Claude Opus 4 as lead, Sonnet 4 as subagents), measured at +90.2% over single-agent Opus 4 on internal research evals. Anthropic's engineering post reports that 80% of the variance on BrowseComp is explained by token usage alone — multi-agent wins largely because each subagent gets a fresh context window. This lesson builds the supervisor pattern from the primitives and covers the 2026 engineering lessons from production deployments.

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`)
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~75 minutes

## Problem

Research is the prototypical task that single-agent systems fail. You ask "what changed in multi-agent systems between 2023 and 2026?" A single agent reads five papers sequentially, fills half its context with their text, and then has to reason about all of them together. It forgets the first paper by the time it reaches the fifth. It cannot parallelize.

The supervisor pattern fixes this: one lead agent plans the search, delegates each sub-question to a worker, and synthesizes. Each worker gets its own 200k-token window for a narrow question. The lead never sees the raw papers — only the worker summaries.

Anthropic's production Research system reports +90.2% on internal research evals vs a single Opus 4. The same post notes that 80% of the BrowseComp variance is explained by *token usage alone*. Fresh context per subagent is the main mechanism.

## Concept

### The pattern

```
                 ┌──────────────┐
                 │   Lead       │  plans, decomposes,
                 │  (Opus 4)    │  synthesizes
                 └──┬────┬───┬──┘
                    │    │   │
            ┌───────┘    │   └───────┐
            ▼            ▼           ▼
      ┌─────────┐  ┌─────────┐  ┌─────────┐
      │ Worker1 │  │ Worker2 │  │ Worker3 │
      │(Sonnet) │  │(Sonnet) │  │(Sonnet) │
      └─────────┘  └─────────┘  └─────────┘
         fresh       fresh        fresh
         context     context      context
```

The lead never reads the raw materials. The workers never see each other's work until the lead synthesizes. Each arrow is a handoff with a narrow artifact.

### Why it wins

Three mechanisms:

1. **Fresh context per subagent.** A worker exploring "FIPA-ACL heritage" does not carry the 40k tokens the lead spent planning. It gets a 200k window for one question.
2. **Specialization via prompt.** The lead's prompt is "decompose and synthesize," not "research." Each worker's prompt is narrow: "find what changed in X." Focused prompts produce focused outputs.
3. **Parallelism.** Workers run concurrently. Wall-clock time is roughly `max(worker_times) + plan + synthesis`, not `sum(worker_times)`.

### Engineering lessons (Anthropic 2025)

The Anthropic post lists several production lessons that are still 2026-relevant:

- **Scale effort to query complexity.** Simple queries: one agent, 3-10 tool calls. Complex queries: 10+ agents. The lead must estimate this, not the caller.
- **Broad then narrow.** Decompose into broad sub-questions first, then spawn more workers per sub-question if the answer warrants depth.
- **Rainbow deployments.** Agents are long-running and stateful. Traditional blue-green does not work. Anthropic uses rainbow: gradual rollout of new versions while old ones drain.
- **Token usage dominates.** Multi-agent is ~15× the tokens of single-agent. Only run it when the task value justifies the cost.

### The LangGraph turn

LangGraph originally shipped a `langgraph-supervisor` library with a high-level `create_supervisor` helper. In 2025 LangChain moved the recommendation to implementing the supervisor pattern via tool-calling directly, because tool calls give more control over *what the supervisor sees* (context engineering). The library still works; the docs now recommend the tool-calling form.

### The failure modes

- **Lead hallucinates the plan.** If the lead generates sub-questions that do not decompose the real question, workers do precise research on the wrong target.
- **Workers over-explore.** Without explicit scope boundaries, workers drift beyond their assigned sub-question and pollute the synthesis step.
- **Synthesis conflicts.** Two workers return contradictory facts. The lead must either re-ask (add a round) or note the disagreement explicitly. Silent picking of one side is the worst failure: the user never knows disagreement happened.

### When supervisor is wrong

- **Sequential tasks.** If step 2 literally needs step 1's output, parallelism buys nothing. Use a pipeline (CrewAI Sequential, LangGraph linear graph).
- **Simple queries.** Single-agent handles them faster and cheaper. Use the lead's "scale effort" check before spawning workers.
- **Strict determinism.** Supervisor uses LLM-selected delegation. Static graphs are better when audit/replay matter more than adaptability.

## Build It

`code/main.py` implements a supervisor of three parallel workers using `threading`. The lead decomposes a query into sub-questions, workers run concurrently on each sub-question, and the lead synthesizes. No real LLMs — the workers are scripted to simulate fetch-and-summarize.

Key structure:

- `Lead.plan(query)` splits a query into 3 sub-questions.
- `Worker.run(sub_q)` returns a fake summary (could be any tool-using agent in production).
- `Lead.run(query)` kicks off workers in threads, joins, and synthesizes.

Run:

```
python3 code/main.py
```

Output shows the plan, the parallel worker traces with start/end timestamps, and the final synthesis. You can see the wall-clock wins: three 0.3-second workers run in ~0.35 seconds, not 0.9.

## Use It

`outputs/skill-supervisor-designer.md` takes a user query and produces a supervisor-pattern design: lead system prompt, worker roles, sub-question decomposition rules, and the synthesis template. Use this before building a new research-style agent system.

## Ship It

Checklist before deploying a supervisor pattern:

- **Model pairing.** Lead on a reasoning-tier model (Opus class, `o3` class). Workers on a faster, cheaper model (Sonnet, `o4-mini`).
- **Worker timeout.** Any worker that exceeds 2× median runtime gets killed; the lead either re-spawns with narrower scope or proceeds without it.
- **Token cap per worker.** Hard limit (say 10× the expected synthesis input) prevents a runaway worker from blowing the budget.
- **Observability.** Trace the lead's plan, each worker's tool calls, and the synthesis. This is the basis for any post-hoc debugging.
- **Rainbow rollout.** Stateful long-running agents need gradual version transition, not hot swap.

## Exercises

1. Run `code/main.py`, then modify the lead to spawn 5 workers instead of 3. Observe the wall-clock effect. At what worker count does spawn overhead exceed parallel savings in this demo?
2. Implement a worker timeout: kill any worker that runs longer than 0.5 seconds and have the lead synthesize the remaining results. What observability do you need to know a worker was cut?
3. Add a conflict-detection step to the lead's synthesis: if two workers return contradictory answers, the lead notes the disagreement rather than picking one. How do you detect contradiction without calling an LLM?
4. Read Anthropic's Research-system engineering post. List three practices that this toy demo would need to adopt to run in production.
5. Compare LangGraph's `create_supervisor` (legacy) vs the new tool-calling recommendation. Which gives you better control over what the supervisor sees? Why does Anthropic explicitly pass only sub-answers and not raw worker context into synthesis?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Supervisor | "Lead agent" | An orchestrator agent that plans, delegates, and synthesizes. Does not do the work itself. |
| Worker | "Subagent" | A focused agent invoked by the supervisor with narrow scope and its own context window. |
| Orchestrator-worker | "Supervisor pattern" | Same thing, different name. The 2026 literature uses both. |
| Fresh context | "Clean window" | A worker's context starts from its system prompt and assigned question, not the lead's history. |
| Rainbow deployment | "Gradual rollout" | Long-running stateful agents need versioned drain-and-replace, not blue-green. |
| Token dominance | "Context is the variable" | 80% of research-eval variance comes from total tokens used, not model choice, per Anthropic. |
| Scale effort | "Match agent count to complexity" | Lead estimates query difficulty, spawns 1 vs 10+ workers accordingly. |
| Synthesis conflict | "Workers disagree" | Two workers return contradictory facts; the lead must surface disagreement, not silently pick one. |

## Further Reading

- [Anthropic engineering — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — the production reference for supervisor pattern
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — tool-calling supervisor is now the recommended form
- [LangGraph supervisor reference](https://reference.langchain.com/python/langgraph-supervisor) — the legacy helper, still used in 2026 production
- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) — handoff-based supervisor variant
