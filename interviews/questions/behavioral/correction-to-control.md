---
id: correction-to-control
title: The same correction for the third time
card: behavioral
kind: concept
level: 2
roles: [agentic-ai-engineer, applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [behavioral]
tags: [feedback, controls, root-cause, agent-workbench]
minutes: 10
lessons: [phases/14-agent-engineering/46-turn-feedback-into-system]
manuals: []
practice: []
cheatsheet: [delegation-feedback, agent-workbench-ops]
related: [behavioral/retire-a-rule, behavioral/feedback-ratchet-owner]
updated: 2026-11-03
---

For the third time this month you have told a coding agent not to edit the project README during a feature change. Each time it apologized and fixed the run. Tell me what you do now, and why the fix is not a better prompt.

## Short answer

A correction that lives in chat fixes one run. I treat the repeat as evidence about the work system: the scope boundary was not executable. I find the cause behind the symptom, then put a control at the earliest layer that can stop the recurrence, which here is a scope or permission policy rather than another paragraph in the instructions. The control gets an owner, a verification and a date to review or retire it.

## Full answer

### Separate the cause from the symptom

"The agent edited the README" is a symptom. The cause can be any of these:

- the task allowed writes to the repository root;
- documentation was treated as safe by default;
- the plan bundled implementation and documentation in one item;
- two workers had overlapping ownership.

Each cause belongs to a different control. A rule that only repeats the symptom fails in the next slightly different case.

### Promote to the earliest effective layer

| Recurring failure | Durable destination |
|---|---|
| Wrong result or regression | Test or evaluation |
| Off-scope or unsafe action | Scope or permission policy |
| Repeated setup or command mistake | Automation or tool |
| Repeated output-format mistake | Canonical example plus validator |
| Ambiguous local convention | Instruction with a scenario check |
| Product disagreement | Human decision record |

Earlier controls are cheaper. A permission that makes the write impossible is stronger than a review comment that catches it later, and a focused test is stronger than a paragraph that asks the agent to remember.

### The record

For each promoted correction I capture the symptom, the root cause, the consequence, the recurrence count, the chosen control, how the control is verified, the owner, and a date to review or retire it. Not every one-off preference gets promoted. Recurrence or consequence has to justify permanent complexity.

### Why not a better prompt

The prompt was already clear three times. The failure is that the boundary depended on the agent reading and remembering. A policy that refuses the write does not depend on memory.

## Follow-ups

- **Level 2:** Two corrections use different words for the same cause. How do you keep them from becoming two rules? Expected: normalize them to a stable fingerprint of the cause, so they collapse into one control without merging unrelated failures.
- **Level 2:** A first-time failure deleted customer data. Does it wait for recurrence? Expected: no; consequence weighting lets a severe first occurrence be promoted at once.
- **Level 3:** When would you remove the control you added? Expected: when the architecture changed, a stronger executable control replaced it, the failure has not recurred across a meaningful window, or the control blocks more legitimate work than the risk it prevents.
- **Level 3:** What is the smallest system you aim for? Expected: the smallest set of controls that preserves the hard-won judgment, not the longest instruction file.

## Wrong answers

- "Add the rule in capital letters at the top of the instructions." The instruction already existed; a louder copy still depends on the agent reading it.
- "Promote every correction so nothing is lost." Controls accumulate, conflict and bloat context; promotion needs recurrence or consequence.
- "The agent is the problem, switch models." The boundary was not executable; a different model meets the same missing control.

## Taught in

The [feedback-to-system lesson](../../../phases/14-agent-engineering/46-turn-feedback-into-system/) gives the destination table, the ratchet record and the retirement checks.
