---
id: seven-surfaces-one-symptom-each
title: Seven surfaces, and the symptom when each is missing
card: agents
kind: concept
level: 1
roles: [agentic-ai-engineer, ai-developer-relations-engineer, forward-deployed-ai-engineer]
rounds: [screen, ml-breadth]
tags: [workbench, surfaces, harness, definition-of-done, system-of-record]
minutes: 6
lessons: [phases/14-agent-engineering/31-agent-workbench-why-models-fail]
manuals: []
practice: []
cheatsheet: [agent-harness, agent-workbench-ops]
related: [agents/a-login-fix-touched-five-files]
updated: 2026-11-03
---

A team ran a frontier model on a small repo task. The result had plausible code, two red tests, one edit in a file that had nothing to do with the task, and no note of what the model assumed or what remains. The team wants to buy a bigger model. What do you tell them?

## Short answer

The model was right about the language and wrong about the work, and a bigger model does not fix that. Reliable agents need a workbench with seven surfaces around the model: instructions, state, scope, feedback, verification, review and handoff. Each symptom in the run maps to one missing surface. You can swap the model and keep the surfaces, but you cannot drop the surfaces and keep the reliability.

## Full answer

### The seven surfaces

| Surface | What it carries | Failure when it is missing |
|---|---|---|
| Instructions | Startup rules, forbidden actions, the definition of done | The agent guesses what done means |
| State | Current task, touched files, blockers, next action | Every session starts from zero |
| Scope | Allowed files, forbidden files, acceptance criteria | Edits spread into unrelated code |
| Feedback | Real command output captured into the loop | The agent declares success on an error |
| Verification | Tests, lint, smoke run, scope check | "Looks good" reaches the main branch |
| Review | A second pass with a different role | The builder grades its own work |
| Handoff | What changed, why, what is left | The next session finds everything again |

### Map the run to the table

- Two red tests and a success claim: feedback and verification were missing.
- An edit in an unrelated file: scope was missing.
- No note of assumptions or of what remains: state and handoff were missing.
- Nobody but the builder read the diff: review was missing.

### Why not a bigger model

The loop closes on the state file, not on the chat history. Chat is volatile. The repo is the system of record. The lesson collects the receipts: one coding agent moved from outside the top 30 to rank five on a terminal benchmark with the same model and a changed harness, and one team deleted 80 percent of its agent's tools and saw the success rate go from 80 percent to 100 percent. The load today is carried by the engineering around the model.

### What a workbench is not

It is not prompt engineering, which tells the model what you want this turn. It is not the framework, which gives you a runtime. The workbench is the place the agent works in, across turns and across sessions, inside whatever runtime you chose.

## Follow-ups

- **Level 1:** Which of the seven surfaces does a pull request template cover? Expected: handoff, because it records what changed, why, and what is left.
- **Level 2:** Which surface catches an agent that writes an extra file nobody asked for? Expected: scope first, because the diff check compares touched files with the contract, and then verification, which refuses the forbidden write.
- **Level 2:** Why does the lesson say the loop closes on a file and not on the chat? Expected: sessions end and conversations get trimmed, so the file is the only record that the next session can trust.
- **Level 3:** The lesson maps each surface to a distributed-systems primitive. What is verification? Expected: a function that is deterministic over its inputs, triggered when the task closes, and that fails closed.

## Wrong answers

- "The model hallucinated, so pick a model that hallucinates less." The model did not know what done meant or where it could write, and no model knows that without the surfaces.
- "Write a longer system prompt with all the rules." A prompt covers one turn, while the surfaces carry the work across turns and sessions.
- "The framework already does this." A framework gives the agent a runtime, and the workbench is what the agent reads and writes inside that runtime.

## Taught in

The [why capable models still fail lesson](../../../phases/14-agent-engineering/31-agent-workbench-why-models-fail/) names the seven surfaces and runs the same task with and without them.
