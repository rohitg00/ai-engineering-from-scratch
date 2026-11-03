---
id: harness-or-a-smarter-model
title: Build the harness now, or wait for a smarter model
card: agents
kind: tradeoff
level: 3
roles: [agentic-ai-engineer, forward-deployed-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design, design-review]
tags: [harness, model-capability, reliability, receipts, primitives]
minutes: 10
lessons: [phases/14-agent-engineering/31-agent-workbench-why-models-fail]
manuals: []
practice: []
cheatsheet: [agent-harness]
related: [agents/seven-surfaces-one-symptom-each, agents/vendor-patterns-to-primitives]
updated: 2026-11-03
---

Leadership wants to pause the harness work for two quarters and wait for the next model generation, on the theory that a better model will not need the scaffolding. Make the case with evidence, and say what part of their argument is right.

## Short answer

Today the engineering that carries the load is around the model, not inside it, and the numbers say so. The same model moved a coding agent from outside the top 30 to rank five on a terminal benchmark when only the harness changed, and a team that deleted 80 percent of its agent's tools saw success go from 80 percent to 100 percent. Most enterprise agent projects that fail do so around runtime, not reasoning. Leadership is right that models absorb harness tricks over time, which is why you build the harness from primitives that survive a model swap.

## Full answer

### The receipts

| Observation | What changed | Result |
|---|---|---|
| Coding agent on a terminal benchmark | Harness only, same model | Outside the top 30 to rank five |
| One team's agent | Deleted 80 percent of the tools | Success rate from 80 percent to 100 percent |
| Legal agents | Harness optimization alone | Accuracy more than doubled |
| Enterprise agent projects | None | 88 percent fail to reach production, with failures around runtime |
| Three open frameworks on a benchmark | None | About 50 percent task completion |
| A web agent in long context | Longer context | From 40 to 50 percent down to under 10 percent, mostly infinite loops and goal loss |

The last two rows are the argument against waiting. Infinite loops and goal loss are not reasoning failures. They are a missing turn budget, a missing state file and a missing scope.

### What the harness is made of

The seven surfaces are a user-facing layer. Underneath them are the primitives every reliable production system already has: functions, workers, triggers, a runtime, a wire, queues, session persistence and an authorization policy. The agent loop is a worker that consumes events, calls functions, writes records and emits triggers. None of that is specific to this model generation, and none of it goes away when the model improves.

### What leadership gets right

Models do absorb harness tricks. A pattern that was a prompt trick two years ago is native now, and the thought-token scheme of the original loop became a reasoning channel. The honest claim is not that the harness wins forever. It is that today the load is around the model, and that the primitives you build to carry it are the ones you would need for any production system, model or not.

### The proposal to leadership

Build the surfaces as primitives, not as prompt text. Keep the state, the scope, the feedback, the gate and the handoff as files and checks that do not know which model is in the loop. When the next model arrives, swap it and keep the surfaces. The harness work is not a bet against the model. It is the part of the system you keep.

## Follow-ups

- **Level 3:** Which of the receipts is the weakest evidence, and why? Expected: the enterprise failure rate, because it is a survey figure without a controlled comparison, while the benchmark rank change held the model fixed.
- **Level 3:** A newer model stops needing the repeat detector. What do you remove? Expected: nothing yet, because the detector is a trigger plus a function that costs little, and you remove it only when the trace data shows it never fires.
- **Level 4:** How do you make the harness investment visible to leadership each quarter? Expected: run the same task set with and without the surfaces on the current model, report completion, scope violations and interventions, and show the gap.
- **Level 4:** What is the one harness piece most likely to be absorbed by models next? Expected: a reasoned pick, such as self-correction on tool errors, with the argument that the model sees the observation and the surface only formats it.

## Wrong answers

- "The model is the product, so the harness is overhead." The harness decided the rank on the benchmark while the model stayed the same.
- "A longer context window will fix the goal loss." The long-context result in the lesson went the other way, with completion falling under 10 percent as context grew.
- "Harness work is prompt engineering by another name." Prompting tells the model what you want this turn, and the harness carries the work across turns and sessions in files and checks.

## Taught in

The [why capable models still fail lesson](../../../phases/14-agent-engineering/31-agent-workbench-why-models-fail/) collects the receipts and reduces the harness to primitives.
