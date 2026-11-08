---
id: who-picks-the-next-speaker
title: Round-robin, a model selector, or the current agent decides
card: multi-agent
kind: tradeoff
level: 2
roles: [agentic-ai-engineer, ai-developer-relations-engineer]
rounds: [design-review, ml-breadth]
tags: [speaker-selection, group-chat, handoff, orchestrator, termination]
minutes: 10
lessons: [phases/16-multi-agent-and-swarms/10-group-chat-speaker-selection, phases/16-multi-agent-and-swarms/11-handoffs-and-routines]
manuals: []
practice: []
cheatsheet: [multi-agent, agent-frameworks-compared]
related: [multi-agent/two-agents-hand-off-forever, multi-agent/four-primitives-for-any-framework]
updated: 2026-11-03
---

Four agents, a coder, a reviewer, a tester and a researcher, share one conversation. You must decide how the next speaker is chosen on each turn. The options on the table are a fixed rotation, a model that reads the recent messages and picks, and letting the current agent name its successor. Compare them and say what you would ship with each.

## Short answer

A fixed rotation is deterministic and cheap, and it gives the coder the turn when the topic is a legal question. A model selector is context-aware, and it costs one extra model call per turn, picks differently on identical input, and tends to favor one agent. A handoff by the current agent keeps the routing in the prompts with no external manager, and it is the pattern that loops when two prompts disagree. Most production chats use a selector with fallback rules, a round cap, a termination signal and a log of every selection.

## Full answer

### The three selectors

| Selector | Strength | Weakness |
|---|---|---|
| Round-robin | Deterministic, no extra calls, scales linearly in agents | Ignores context, so the wrong agent gets the turn |
| Model-selected | Reads the pool and picks the best next speaker | One extra call per turn, inconsistent across runs, and it can favor a hot speaker |
| Current agent hands off | No manager, routing lives in each prompt | Two prompts can form a cycle, and an injected message can force a handoff |

### Who decides, and where

The difference between the second and the third is where the decision lives. In a group chat the selector sits outside the agents and reads the shared pool. In the handoff pattern the active agent decides by calling a tool that returns the next agent. A manager outside can see an alternation between two agents and break it. An agent inside the loop cannot.

### What goes wrong in a group chat

- **Nondeterminism.** The same pool gives different next speakers on different runs, which hurts audit and replay.
- **Deference cascades.** Agents follow whoever spoke most confidently, so the prompts must say when to disagree.
- **Context growth.** Every agent reads every message, and after about 10 turns the pool is large, so give each agent a scoped view.
- **One agent dominates.** The selector keeps picking the agent whose specialty matches the recent messages, so track turns per agent and alert on imbalance.

### What to ship

1. A round cap, 10 to 20 for a typical task.
2. A termination signal: a sentinel token from an agent, or a verifier that checks the goal each turn.
3. A speaker-balance metric, with an alert when one agent takes too many turns.
4. A custom selector that combines the model's pick with rules such as "the tester speaks after the coder".
5. A log of the selector's input and its choice, because without it a wrong selection cannot be debugged.

### When each one fits

A fixed rotation fits a staged pipeline where the order is known. A model selector fits an exploratory conversation where the flow is not a graph. Handoffs fit triage, where a front agent routes a user to one specialist and the conversation is short.

## Follow-ups

- **Level 2:** Why does the model selector need a log of its input as well as its output? Expected: the choice depends on what the selector saw, and without the input a reviewer cannot tell whether the pick was wrong or the pool was.
- **Level 2:** What does a verifier-based termination add over a sentinel token? Expected: the chat stops when a check passes, not when an agent claims it is done, which removes early termination by a confident agent.
- **Level 3:** Which of the three makes prompt injection worse, and why? Expected: the handoff pattern, because the deciding tool call is made by the agent that just read the injected text, while an external selector can apply rules the agents do not control.
- **Level 3:** How does a custom selector fix the hot-speaker problem without losing context awareness? Expected: let the model propose, then apply a rule that caps consecutive turns per agent and forces the verifier or a quiet agent in.

## Wrong answers

- "Use the model selector, because it understands the conversation." It also adds a call per turn, picks inconsistently, and favors one agent unless rules and a balance metric constrain it.
- "Round-robin is fair, so it is safe." Fair turns are not useful turns, and a coder speaking on a legal question wastes a round and adds noise to the pool.
- "Let the agents decide among themselves." That is the handoff pattern, and it is the one that forms cycles and that an injected message can steer.

## Taught in

The [group chat lesson](../../../phases/16-multi-agent-and-swarms/10-group-chat-speaker-selection/) builds the three selectors and the termination rules, and the [handoffs and routines lesson](../../../phases/16-multi-agent-and-swarms/11-handoffs-and-routines/) contrasts the manager's decision with the agent's.
