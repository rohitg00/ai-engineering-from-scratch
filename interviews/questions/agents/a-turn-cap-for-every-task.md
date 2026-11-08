---
id: a-turn-cap-for-every-task
title: One turn cap for every task, what number do you give
card: agents
kind: estimate
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [screen, system-design]
tags: [turn-budget, task-class, budgets, wall-clock, cost-cap]
minutes: 8
lessons: [phases/14-agent-engineering/01-the-agent-loop, phases/15-autonomous-systems/10-claude-code-permission-modes]
manuals: []
practice: []
cheatsheet: [agent-harness, autonomous-agents]
related: [agents/the-agent-loops-forever, agents/pick-the-permission-mode]
updated: 2026-11-03
---

The product team wants a single maximum number of turns that applies to every run of your agent. The agent handles one-line edits, multi-file refactors, and unattended runs that drive a computer for hours. What number do you give them, and how do you defend it?

## Short answer

There is no single number, and the estimate shows why. Agents run 40 to 400 steps per task, and a computer-use task runs dozens to hundreds of steps as a normal case. A cap that fits a one-line edit stops every refactor, and a cap that fits an unattended run lets a stuck edit spend hundreds of turns. Give one cap per task class, set each from the trace distribution of successful runs in that class, and pair every cap with a wall-clock budget and a cost cap.

## Full answer

### Why one number fails

| Task class | Normal length | Effect of one shared cap |
|---|---|---|
| One-line edit | A handful of turns | A high cap lets a stuck run burn hundreds of turns before anyone sees it |
| Multi-file refactor | Tens of turns | A low cap ends the run with half the files changed |
| Unattended computer use | Dozens to hundreds of steps | A low cap makes the mode unusable |

The lesson's rule is to pick a cap that fits the task class, not one size for all.

### How to set each cap

1. Pull the traces for the class and read the turn counts of the runs that passed the gate.
2. Set the cap above the longest passing run with a margin, and below the point where the traces show repeated actions.
3. Treat the cap as a yield, not a kill. When the loop reaches it, the caller sees the partial state and decides whether to extend.
4. Review the caps when the traces move. A new model or a new tool changes the distribution.

### The other two budgets

A turn cap alone misses two failure shapes. A run can spend few turns and a lot of wall-clock time, waiting on slow tools. A run can spend few turns and a lot of money, with long contexts on an expensive model. The unattended mode in the lesson ships a turn cap, a dollar cap that aborts the session, and action-count limits per tool. A 24-hour unattended run needs all three, plus an allowlist, and each number needs a written reason.

### What to tell the product team

Give them a table, not a number: one row per task class with the turn cap, the wall-clock budget, the cost cap and the per-tool limits, and the trace data that each row came from. Offer one default for an unclassified task, set low, so that an unknown task yields early and a human decides.

## Follow-ups

- **Level 2:** A run reaches the cap with the task almost done. What happens? Expected: the loop yields with a budget reason, the caller inspects the partial state, and the caller extends the budget or closes the session with a handoff.
- **Level 2:** Why should the fallback cap for a task with no class be small? Expected: an unknown task is the one most likely to loop, and an early yield costs a human decision while a late one costs hours.
- **Level 3:** How do you tell a long run from a stuck run before the cap? Expected: a repeat detector over the action and observation hashes, so that five near-identical actions in a row pause the run early.
- **Level 3:** The traces for a class show two clusters of turn counts. What does that tell you? Expected: the class is two classes, and each needs its own cap.

## Wrong answers

- "Set it high so that no legitimate task is cut off." A high cap on a short task class lets a stuck run spend hundreds of turns, and the point of the cap is to catch the stuck run.
- "Set it low and let users retry." A low cap on a refactor ends every run with half the work, and a retry starts from zero.
- "The turn cap is enough, because turns are what cost money." Turns are one axis, and a run can be slow in time or expensive in tokens with few turns.

## Taught in

The [agent loop lesson](../../../phases/14-agent-engineering/01-the-agent-loop/) sets the cap per task class, and the [permission modes lesson](../../../phases/15-autonomous-systems/10-claude-code-permission-modes/) pairs it with a cost cap and per-tool limits.
