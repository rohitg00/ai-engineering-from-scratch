---
id: the-agent-loops-forever
title: This agent loops forever, find out why
card: agents
kind: debug
level: 2
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, screen]
tags: [infinite-loop, turn-budget, stop-condition, observation, tool-error]
minutes: 10
lessons: [phases/14-agent-engineering/01-the-agent-loop, phases/19-capstone-projects/20-agent-harness-loop-contract, phases/15-autonomous-systems/10-claude-code-permission-modes]
manuals: []
practice: []
cheatsheet: [agent-harness, agent-failure-modes]
related: [agents/five-parts-of-an-agent-loop]
updated: 2026-11-03
---

An on-call engineer pages you. A coding agent has run for two hours on a task that normally takes ten minutes. The trace shows one shell command, one result, and then the same command again, over and over. Walk through how you find the cause and what you change so that this cannot happen again.

## Short answer

Read the trace for the pair of action and observation that repeats, then ask why the model does not react to the observation. The usual causes are an error that the loop never shows to the model, an observation that reads the same on every turn, and a missing turn budget. Fix the cause, then add the two guards that stop any future loop: a budget that yields control to the caller, and a check for a repeated action with a repeated observation.

## Full answer

### Find the cause

1. **Find the repeated pair.** Pull the last twenty turns and compare each action with the one before it. A loop is an action plus observation that repeats with no change in the message buffer between them.
2. **Check what the model saw.** If the tool raised an exception and the runner caught it outside the loop, the model never received an observation. It then does the only thing it knows: the same call. The lesson rule is that every error, including a 400 from a service, must come back as an observation string.
3. **Check whether the observation carries information.** An observation of `ok` after a write that did nothing, or a test runner that prints nothing on failure, gives the model no reason to change its plan. The observation formatter must include the exit code and the tail of the output.
4. **Check the stop conditions.** A loop that ends only on an explicit finish call runs until the context is full when the model never calls finish. A loop with no turn budget runs until someone pages you.

### Fix it so the loop cannot recur

- **A turn budget per task class.** Agents run 40 to 400 steps per task, so pick a cap for the class, not one cap for every task. In the harness contract the budget is not a kill switch. When a limit is reached the loop fires `on_budget_exceeded`, emits `budget.warn`, and yields to the caller. The caller extends the budget or closes the session.
- **A repeat detector.** The permission-mode lesson describes a classifier that sees action N+1 as almost equal to action N five times in a row. You do not need a model for the simple case. Hash the action and the observation, keep the last few hashes, and pause when one repeats.
- **Errors as observations.** Route every exception through the formatter so that the model can correct the call.
- **A no-tool-call stop.** When an assistant turn contains no tool call, treat the run as finished.

### Prove the fix

Replay the saved trace through the fixed loop. The harness contract is a deterministic state machine, so the same event log re-enters the same state without a new model call. The replay must pause at the repeat and emit the budget event where the old run kept going.

## Follow-ups

- **Level 2:** The model repeats a call because the tool returns an empty string on failure. Who owns the fix? Expected: the observation formatter, which must add the exit code and the error text so that the observation changes when the call fails.
- **Level 3:** Why does the harness yield on a budget instead of raising? Expected: a yield is a return value that the caller can inspect and resume from, while an exception loses the partial state and forces a restart.
- **Level 3:** A repeat detector hashes the action only. What loop does it miss? Expected: a loop where the action changes slightly each time, such as a counter in an argument, while the observation never changes, so hash the observation too.
- **Level 4:** The loop is fixed, but the agent still ran for two hours before anyone noticed. What is the missing surface? Expected: observability, a wall-clock budget with an alert, and a trace that someone can read at step 38 without reading the whole run.

## Wrong answers

- "Raise the maximum turns so that the task can finish." The task was not progressing, so more turns give more of the same call.
- "Add a line to the prompt that says do not repeat yourself." The model repeated because it never saw the error, and a prompt cannot show it what the loop hid.
- "Kill the process when the budget is reached." A kill loses the partial state, while a yield lets the caller inspect it, extend the budget, or close the session with a clean handoff.

## Taught in

The [agent loop lesson](../../../phases/14-agent-engineering/01-the-agent-loop/) names the turn budget and the formatter for observations, the [harness loop contract](../../../phases/19-capstone-projects/20-agent-harness-loop-contract/) makes the budget a yield, and the [permission modes lesson](../../../phases/15-autonomous-systems/10-claude-code-permission-modes/) describes the repeated-action classifier.
