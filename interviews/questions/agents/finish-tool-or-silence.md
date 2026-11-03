---
id: finish-tool-or-silence
title: Explicit finish tool or no-tool-call stop
card: agents
kind: tradeoff
level: 2
roles: [agentic-ai-engineer, ai-developer-relations-engineer]
rounds: [ml-breadth, design-review]
tags: [stop-condition, finish-tool, early-termination, agent-loop]
minutes: 8
lessons: [phases/14-agent-engineering/01-the-agent-loop, phases/19-capstone-projects/20-agent-harness-loop-contract]
manuals: []
practice: []
cheatsheet: [agent-harness]
related: [agents/budget-exhausted-looks-like-an-answer]
updated: 2026-11-03
---

Two engineers disagree about how the loop should end. One wants an explicit `finish` tool that the model must call. The other wants the loop to end as soon as an assistant turn has no tool call in it. Which do you pick, and what does each choice get wrong?

## Short answer

Both are stop conditions, and a production loop needs both plus a budget. The no-tool-call stop is simple and matches how models behave, but it ends the run on any turn where the model answers in prose, including a turn where it only meant to think aloud. An explicit finish gives a clear signal with a payload, but a model that never calls it runs until the budget. Pick the no-tool-call stop as the default, keep finish as a tool that carries the final answer, and make the budget the last guard.

## Full answer

### What each one gets right

| Stop | Strength | Weakness |
|---|---|---|
| Explicit `finish` tool | The end is a structured call with the answer as its payload, so the caller never guesses which text is the answer | A model that forgets to call it, or that is told not to, never stops on its own |
| No tool call in the turn | Needs no extra tool, and matches a model that answers when it is done | A turn of prose in the middle of a task ends the run early with an incomplete answer |

### Early termination is the real risk

The lesson asks which choice is safer against early-termination bugs. The no-tool-call stop ends the run on the first prose turn. A model that writes a plan before it acts, or that comments on an observation without a next call, stops the loop too soon. An explicit finish cannot end early by accident, because ending needs a deliberate call.

### Why you need the budget anyway

Neither stop helps when the model loops. A finish tool is never called by a model that keeps retrying. A no-tool-call stop never fires when every turn has a call. The turn budget is the stop that does not depend on what the model emits. In the harness contract the budget yields to the caller, and the caller decides whether to resume.

### A practical shape

1. Register `finish` as a tool whose argument is the final answer.
2. Treat a turn with no tool call as a stop with reason `no_tool_call`, and return the prose as a draft answer, not a final one.
3. Cap turns per task class, and yield at the cap.
4. Record which stop fired in the result, so that the caller and the eval can tell them apart.

## Follow-ups

- **Level 2:** A model returns prose and a tool call in the same turn. Which stop applies? Expected: none, because the turn has a tool call, so the loop dispatches it and continues.
- **Level 3:** Why does the result need the name of the stop that fired? Expected: an eval that counts a no-tool-call stop as success rewards early termination, so the reason must be visible to the scorer.
- **Level 3:** Reasoning now travels on a separate channel. Does that change the no-tool-call stop? Expected: yes, a turn with reasoning content and no visible text or tool call must not count as an answer, so the check must read the visible output.
- **Level 4:** How would you measure early termination across a task set? Expected: compare the stop reason with a gate that checks acceptance commands, and count the runs that stopped with no tool call while the acceptance commands never ran.

## Wrong answers

- "Use only the finish tool, because it is explicit." A model that never calls it runs to the budget on every task that it cannot finish.
- "Use only the no-tool-call stop, because the model knows when it is done." A model that pauses to think in prose ends the run with half the work done.
- "The budget is enough on its own." The budget is the guard for a loop that never converges, and a run that waits for it wastes every turn after the real end.

## Taught in

The [agent loop lesson](../../../phases/14-agent-engineering/01-the-agent-loop/) lists both stops and asks which is safer, and the [harness loop contract](../../../phases/19-capstone-projects/20-agent-harness-loop-contract/) turns the budget into a yield.
