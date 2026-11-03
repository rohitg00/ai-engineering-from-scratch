---
id: two-agents-hand-off-forever
title: Two agents hand off to each other until the cap
card: multi-agent
kind: debug
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [debugging, screen]
tags: [handoff-loop, routines, stateless, loop-detection, fallback-agent]
minutes: 8
lessons: [phases/16-multi-agent-and-swarms/11-handoffs-and-routines]
manuals: []
practice: []
cheatsheet: [multi-agent, agent-failure-modes]
related: []
updated: 2026-11-03
---

A support system uses handoff-driven orchestration: each agent is a prompt plus a set of tools, and one of the tools returns another agent. The trace shows the triage agent handing a user to billing, billing handing the user back to triage, and the two repeating until the round cap ends the run. The user never got an answer. Why does this happen, and what is the cheap fix?

## Short answer

In this pattern the routing lives in the prompts, and the current agent picks its successor with a tool call. The triage prompt says that a billing question goes to billing, and the billing prompt says that anything outside its tools returns to triage, and the user's message satisfies both. Nothing persists between handoffs, so the new agent starts from its prompt and the history and does not know that the same handoff already failed. The cheap fix is a loop detector on the last few handoffs that forces an exit to a fallback agent, plus a trace event for every handoff.

## Full answer

### Why the pattern loops

The two primitives are the routine, a system prompt that defines a role and its tools, and the handoff, a tool that returns the next agent. The framework's only job is to see the agent-valued return and switch. There is no graph and no state machine. The routing is whatever the prompts say, and two prompts can describe a cycle without anyone writing one. The pattern is stateless between runs, and within a run the only memory is the message history, which the agents do not read for a repeated pattern.

### Find it in the trace

A handoff loop is two agents alternating with no user turn and no tool result between them. Read the handoff events for the pair. If each handoff carries the same reason, the prompts disagree about who owns the case.

### The cheap fix

1. **Loop detection.** Keep the last few handoffs in a ring. When the same two agents have handed off three times in a row, force an exit.
2. **A fallback agent.** The exit goes to a safe default that can answer or escalate to a human. The same fallback catches a handoff to an agent that does not exist.
3. **Handoff logging.** Every handoff writes an event with the sender, the receiver and a context snapshot, so the loop is visible before the cap.

### The real fix

Fix the prompts so that exactly one agent owns each case, and give the billing agent a tool that handles the case instead of a reason to send it back. Decide what context transfers on each handoff: the full history is expensive, the last N messages lose the reason, and a summary written by the outgoing agent is the usual middle. The production successor of this pattern adds sessions, guardrails and tracing around the same primitive, and a handoff filter that controls what the incoming agent sees.

### The security angle

A handoff to an agent with different tool permissions must be authenticated, because a message that the user did not write, such as text pulled from a document, can ask for a handoff to a more capable agent. Treat a handoff as a permission change, not a routing detail.

## Follow-ups

- **Level 2:** Why does the billing agent not notice that it already sent this user back once? Expected: it is stateless and starts from its prompt plus the history, and nothing in the loop reads the history for a repeated handoff.
- **Level 2:** What should the fallback agent do? Expected: answer with what it can, or hand the case to a human with the trace, and never hand off to either agent in the loop.
- **Level 3:** How do you choose what context moves on a handoff? Expected: full history when the case is short, a summary written by the outgoing agent when it is long, and never nothing, because the incoming agent then repeats the questions.
- **Level 3:** How does a group chat with a selector avoid this specific loop? Expected: the selector sits outside the agents and can see the alternation, while in the handoff pattern the agent that is looping is the one making the decision.

## Wrong answers

- "Raise the round cap so the agents have time to settle." The cap is what ended the loop, and more rounds give more of the same two handoffs.
- "Tell triage never to accept a handoff from billing." That blocks a legitimate return when billing really cannot help, and the fix is clear ownership plus a detector.
- "Switch to a graph framework and the problem disappears." A graph can encode the same cycle with two edges, and the loop detector is useful in both.

## Taught in

The [handoffs and routines lesson](../../../phases/16-multi-agent-and-swarms/11-handoffs-and-routines/) builds the handoff loop and lists loop detection and the fallback agent in its checklist.
