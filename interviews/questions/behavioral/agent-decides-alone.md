---
id: agent-decides-alone
title: Decide which choices an agent may make alone
card: behavioral
kind: tradeoff
level: 4
roles: [agentic-ai-engineer, applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [behavioral, design-review]
tags: [autonomy, authority, decision-modes, delegation]
minutes: 12
lessons: [phases/14-agent-engineering/45-delegate-with-isolation, phases/14-agent-engineering/51-write-specifications-that-preserve-judgment]
manuals: []
practice: []
cheatsheet: [delegation-feedback, agent-planning]
related: [behavioral/locked-bounded-delegated, behavioral/split-that-only-looks-parallel]
updated: 2026-11-03
---

Your organization wants to let coding agents merge changes without a human in the loop for a class of tasks. You are asked to write the policy that says which decisions an agent may make on its own. How do you draw that line, and how does it move over time?

## Short answer

The line follows consequence and reversibility, not task difficulty. A human keeps the choices that change public behavior, risk, authority or irreversible cost; an agent owns bounded investigation, implementation, verification and review. I express that as locked, bounded and delegated decisions in each task contract, and I widen the delegated set only where evidence and rollback are strong, which is calibrated autonomy rather than a fixed switch.

## Full answer

### Calibrated autonomy

The system grants freedom where evidence and rollback are strong and requires a checkpoint where consequence is high. That is a property of each decision, so the policy is written per decision class, not per task or per model.

### Human-owned and agent-owned

| Human keeps | Agent may own |
|---|---|
| Changes to public behavior or compatibility | Local structure, names, reversible refactors |
| Changes to risk or safety posture | Bounded investigation that returns a fact table |
| Grants of authority or access | Implementation inside exclusive paths with proof |
| Irreversible cost: migrations, deletions, spend | Verification and read-only review of finished artifacts |

### The three modes make it executable

Each decision in a task contract is locked, bounded or delegated. Locked decisions carry a human checkpoint. Bounded decisions state the limits, such as a dependency allowlist or a retry range, and the agent proposes inside them. Delegated decisions require the agent to explain the choice and prove the result. The mode is chosen from consequence and reversibility, and the reason is recorded so a later team can revise it.

### How the line moves

Autonomy expands on evidence. When a class of delegated decisions has a strong proof layer, a clean rollback and a window without incidents, a bounded decision can become delegated. When an incident shows a missing control, the move goes the other way until the control exists. The policy itself is a control with an owner and a review date.

### What never moves

Proof must match the claim. A unit test does not prove a public interface path, and an agent's summary does not replace reading the proof output. The integrator reads the proof, not the story.

## Follow-ups

- **Level 3:** An agent proposes a dependency outside the allowlist with a good argument. What happens? Expected: the bounded decision escalates to a human; the argument is input to the decision, not a permission.
- **Level 4:** How do you widen autonomy for a decision class safely? Expected: show the proof layer, the rollback and an incident-free window for that class, then change the mode and record the evidence and the reviewer.
- **Level 4:** What evidence would make you narrow autonomy again? Expected: an incident that a lower-level control did not catch, which shows the proof layer was weaker than the policy assumed.

## Wrong answers

- "Let the agent decide easy tasks and keep the hard ones." Difficulty is not the axis; a trivial deletion can be irreversible and a hard refactor can be reversible.
- "Autonomy is a single setting per team." Each decision class has its own consequence and reversibility, so one switch is wrong in both directions.
- "A passing test suite is enough to merge anything." The suite proves local contracts; public behavior, authority and irreversible cost need their own proof and a human checkpoint.

## Taught in

The [delegation lesson](../../../phases/14-agent-engineering/45-delegate-with-isolation/) defines calibrated autonomy and the [specification lesson](../../../phases/14-agent-engineering/51-write-specifications-that-preserve-judgment/) gives the three decision modes.
