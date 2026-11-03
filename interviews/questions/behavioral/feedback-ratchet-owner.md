---
id: feedback-ratchet-owner
title: Turn telemetry nobody owns into a learning loop
card: behavioral
kind: design
level: 4
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [behavioral]
tags: [feedback-loop, ownership, routing, retirement]
minutes: 15
lessons: [phases/14-agent-engineering/54-build-the-feedback-ratchet, phases/14-agent-engineering/52-design-success-metrics]
manuals: []
practice: []
cheatsheet: [delegation-feedback, eval-driven-agents]
related: [behavioral/correction-to-control, behavioral/retire-a-rule, behavioral/metric-before-result]
updated: 2026-11-03
---

You inherit a team that collects traces, evaluation scores, support tickets and incident logs for an assistant. Nobody can name a change that any of it caused. Design the mechanism that turns those signals into improvements, and tell me how you keep it from becoming another backlog.

## Short answer

The missing piece is promotion: a defined path from an observation to a durable change with an owner and proof. Each signal is connected to an outcome, a constraint or an assumption, traced to a root cause, and routed to the earliest layer that owns that cause, which is evaluation, context, policy, runtime or a shaped backlog item. Every resulting action carries one owner, a priority from consequence and recurrence, the artifact to change, the verification, a review window and a retirement condition, so the loop produces controls that are later re-examined rather than rules that only accumulate.

## Full answer

### The loop

1. Observe a concrete signal.
2. Connect it to an outcome, a constraint or an assumption.
3. Identify the earliest system layer that owns the cause.
4. Create a bounded change.
5. Verify that recurrence became less likely.
6. Review whether the control should remain.

### Route to the owning layer

| Signal | Destination |
|---|---|
| False positive, regression, wrong result | Evaluation or test |
| Missing context, duplicate work, stale fact | Context source or retrieval route |
| Unsafe action or authority gap | Policy or permission boundary |
| Timeout, retry storm, unavailable dependency | Runtime control |
| New product need or unresolved tradeoff | Shaped backlog item |

A timeout belongs to the runtime, not to the general backlog, and a wrong answer belongs to a test, not to another prompt paragraph. The cause is fixed at the earliest effective layer.

### Ownership is part of the control

An unowned improvement is an observation with better formatting. Every action gets one owner, a priority based on consequence and recurrence, the artifact to change, the verification that proves the change, a review or expiry window, and a retirement condition.

### Why it is not a backlog

A backlog stores wishes. The ratchet stores controls with proof and expiry. Controls are reviewed when the architecture changes, when a lower-level invariant replaces a higher-level instruction, when the protected failure has stayed away across the window, or when the control blocks legitimate work more than it prevents harm. Retirement needs evidence too.

### Metrics close the loop

The signals only mean something against metrics defined before the result: outcome, guardrail and counter-metric, each with a threshold, a window and a source. The ratchet then changes the outcome frame, the assumptions, the slice or the measurement plan for product evidence, and the tests, context, scope or handoff for coding-agent corrections. Incidents can change both.

## Follow-ups

- **Level 3:** Two teams share the assistant and disagree on a tradeoff a signal exposes. Where does it go? Expected: to a shaped backlog item with a human decision owner; the ratchet does not resolve product disagreements by itself.
- **Level 4:** How do you prioritize across many signals? Expected: by consequence and recurrence together, so a severe single event and a frequent minor one both rise above a rare minor one.
- **Level 4:** What proves the loop works after a quarter? Expected: named controls that trace back to signals, verification results that show recurrence fell, and retirements with their evidence; not the volume of telemetry collected.

## Wrong answers

- "Build a dashboard so everyone can see the signals." Visibility without promotion and ownership changes nothing.
- "Add each lesson learned to the system prompt." Prose is the weakest layer; a permission boundary can make the unsafe action impossible, and a test can block a release that repeats the failure.
- "Keep every control forever since it was earned." Controls decay and conflict; each one needs a retirement condition and periodic review.

## Taught in

The [feedback ratchet lesson](../../../phases/14-agent-engineering/54-build-the-feedback-ratchet/) gives the routing table and the ownership fields, and the [success metrics lesson](../../../phases/14-agent-engineering/52-design-success-metrics/) gives the metric contract the signals are judged against.
