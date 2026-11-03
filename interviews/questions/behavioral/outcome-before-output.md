---
id: outcome-before-output
title: Reframe a request that names its own solution
card: behavioral
kind: concept
level: 1
roles: [applied-ai-engineer, forward-deployed-ai-engineer, ai-developer-relations-engineer, agentic-ai-engineer]
rounds: [behavioral, screen]
tags: [outcome-frame, requirements, solution-leakage]
minutes: 8
lessons: [phases/14-agent-engineering/47-outcomes-before-output]
manuals: []
practice: []
cheatsheet: [product-discovery]
related: [behavioral/riskiest-assumption-first]
updated: 2026-11-03
---

A product manager asks you to build an incident assistant for the on-call team. You have one week. Before you plan any work, what do you ask, and what do you write down first?

## Short answer

The request names an artifact, not a result. I write an outcome frame first: who has the problem, when it happens, what they do today, which observable state must improve, which limits are fixed, and which nearby work is out of scope. Then I check the frame for a product form, a model or an architecture that no evidence supports yet.

## Full answer

### The six parts of the frame

| Part | Question I answer |
|---|---|
| User | Who feels the problem directly? |
| Situation | When and where does it happen? |
| Current behavior | What happens today, including the workarounds? |
| Desired outcome | Which observable state must get better? |
| Constraints | Which safety, policy, cost or compatibility limits are fixed? |
| Non-goals | Which tempting adjacent work is excluded? |

For the on-call team, the desired outcome could read: when an alert arrives, the engineer finds the failing service and one safe next step inside the incident time budget, and the diagnosis stays read-only and auditable. A runbook, a data repair or a smaller interface change can all satisfy that sentence. The team stays attached to the result, not to the first tool someone imagined.

### Leakage

A frame leaks a solution when it contains an interface, a model choice, a framework or a storage system that evidence has not earned. "Users get a weekly summary from a model" leaks the summary and the cadence. "Users understand account changes before approval" states the result. A constraint can name a technology when compatibility really fixes it. I record why it is fixed.

### Constraints and non-goals do real work

Constraints are part of the goal. No production writes during diagnosis, a response inside the incident time budget, and no new runtime dependency all remove whole classes of solutions. Non-goals keep the first slice from growing into a platform: no automatic remediation, no new alert routing, no replacement of the incident commander.

## Follow-ups

- **Level 1:** How do you tell an outcome from an output? Expected: an outcome names an observable change for a user; an output names an artifact such as a page, a tool or a model.
- **Level 2:** The manager insists on a chat interface. Where does that go in the frame? Expected: into the constraints only when policy or compatibility fixes it, with the reason written down; otherwise it waits for evidence.
- **Level 2:** Name two non-goals that keep the first slice small. Expected: no automatic fix of the incident and no new alert routing, for example; each one must be concrete enough to reject work.
- **Level 3:** What is the first observation that would show the desired outcome is wrong? Expected: a measured time to find the failing service that is already short, which means the frame targets a problem that does not exist.

## Wrong answers

- "Start with the interface and refine the goal later." The interface is one output. It ties the team to the first artifact before anyone knows what must improve.
- "Constraints are implementation details for later." A build that reaches the outcome and breaks a constraint has not reached the outcome.
- "Non-goals are optional." Without them, a useful slice grows into a platform before the first result is measured.

## Taught in

The [outcome frame lesson](../../../phases/14-agent-engineering/47-outcomes-before-output/) gives the six-part frame and the leakage check.
