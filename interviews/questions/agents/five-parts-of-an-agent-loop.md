---
id: five-parts-of-an-agent-loop
title: What makes a loop an agent and not a chat bot
card: agents
kind: concept
level: 1
roles: [agentic-ai-engineer, ai-developer-relations-engineer, forward-deployed-ai-engineer]
rounds: [screen, ml-breadth]
tags: [agent-loop, react, tool-registry, stop-condition, turn-budget]
minutes: 5
lessons: [phases/14-agent-engineering/01-the-agent-loop]
manuals: []
practice: []
cheatsheet: [agent-harness]
related: []
updated: 2026-11-03
---

A teammate says that their chat application is an agent because it calls a model inside a while loop. Name the parts that a real agent loop needs, and say what goes wrong when each one is missing.

## Short answer

An agent loop needs five parts: a message buffer that grows with each turn, a tool registry that the model calls by name, a stop condition, a turn budget, and an observation formatter. The model is the same in a chat bot and in an agent. The difference is that the agent can pause, call a tool, read the result and continue. Without the five parts, the loop is a chat bot with extra steps.

## Full answer

### The loop

The pattern is the one from the ReAct paper. The model writes a thought, picks an action, reads an observation, and repeats until it decides to finish. Modern models move the thought to a separate reasoning channel, but the control flow is the same. Observe, think, act, observe, think, act, stop.

### The five parts

| Part | What it does | Failure when missing |
|---|---|---|
| Message buffer | Holds the user turn, the assistant turns, the tool turns and the final turn in order | The model forgets what it already did and repeats work |
| Tool registry | Maps a tool name to a schema and a callable | The model names tools that do not exist, and nothing runs |
| Stop condition | Ends the run on an explicit finish, on a turn with no tool call, on a budget, or on a guardrail | The run never ends, or ends only when the context is full |
| Turn budget | Caps the number of iterations for this task class | One bad decision at step 38 becomes an endless run |
| Observation formatter | Converts every tool output, including every error, into a string the model can read | A failed call becomes a crash instead of a correction |

The formatter is the part that people forget. The lesson says that every 400 error in the stack must become an observation string, not an exception. A model that sees the error can correct the next call. A model that never sees it cannot.

### Why the parts matter now

Agents run 40 to 400 steps per task. Every framework in use today builds the same loop under its own names. The things that differ live around the loop: checkpoints, actor messaging, role templates, tracing. The loop itself does not change.

## Follow-ups

- **Level 1:** What is an observation? Expected: the string form of a tool result that the loop appends to the buffer for the next model call.
- **Level 2:** Why is a turn budget a separate part from the stop condition? Expected: the stop condition depends on what the model emits, and the budget protects the run when the model never emits a stop.
- **Level 2:** Where does the thought go in a model with a native reasoning channel? Expected: in a separate field that the runtime passes between turns, so the transcript shows tool calls and results without inline thought text.
- **Level 3:** What changes when two tool calls in one turn return out of order? Expected: each result needs a correlation id that ties it to its call, or the model reads the wrong result for a call.

## Wrong answers

- "An agent is a model with a long system prompt." A prompt cannot run a tool or read a result, so the model still stops at its first wrong guess.
- "The loop ends when the model says it is done." A model can say it is done too early or never, so the loop also needs a turn budget and a no-tool-call stop.
- "Tool errors should raise so that the developer sees them." An error that raises ends the run, while an error that becomes an observation lets the model fix the call.

## Taught in

The [agent loop lesson](../../../phases/14-agent-engineering/01-the-agent-loop/) builds the five parts with a scripted model and three tools.
