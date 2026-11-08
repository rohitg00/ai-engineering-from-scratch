---
id: evidence-ladder-for-workflows
title: Weigh what a stakeholder tells you about their workflow
card: behavioral
kind: concept
level: 2
roles: [forward-deployed-ai-engineer, applied-ai-engineer, ai-developer-relations-engineer]
rounds: [behavioral, customer]
tags: [workflow-discovery, evidence, requirements]
minutes: 10
lessons: [phases/14-agent-engineering/48-discover-the-real-workflow]
manuals: []
practice: []
cheatsheet: [product-discovery]
related: [behavioral/two-users-two-workflows]
updated: 2026-11-03
---

A customer lead spends an hour describing how their support team handles a refund request. You now have to decide what the first version of an assistant does. Tell me how you treat that hour of description, and what you do next.

## Short answer

An interview is reported behavior, which is the third rung of a four-rung ladder. I label every claim from the hour by its rung, then look for direct evidence for the claims that matter most: a trace, a recording, a ticket or a completed form. The steps that stay unproven remain visible as open claims instead of turning into requirements.

## Full answer

### The ladder

1. Direct behavior: an observation, a trace, a recording or a system event.
2. An artifact: a ticket, a runbook, a log, a form or a finished output.
3. Reported behavior: a person describes what they do.
4. Inference: the team concludes what probably happens.

All four help. Only the first two prove current behavior. When I write the workflow down, each step carries its rung, so confidence does not grow on its own.

### What I reconstruct

I do not begin with feature wishes. I rebuild what happens now, step by step, with the actor, the trigger, the action, the input, the output, the friction, who holds authority for a consequential change, and the evidence. The workflow is larger than the screen. It includes waiting, copy and paste, side channels, approvals, error recovery and steps people have stopped noticing.

### Four things I search for

- Friction: repeated effort, delay, re-entry or recovery.
- Hidden state: facts carried in memory, chat or personal notes.
- Authority: the person or system allowed to make the consequential change.
- Exceptions: the case where the normal path stops being normal.

Assistants fail most often at handoffs and exceptions, because only the happy path was shaped. So the first thing I ask for after the interview is one real trace of an exception.

### How this changes the first version

A step with direct evidence can become a requirement. A step with only reported evidence becomes an assumption to test. The description from the hour tells me where to look, not what to build.

## Follow-ups

- **Level 2:** The lead says "we always check the order history first." How do you confirm that? Expected: ask for a recording or a log of three real cases and mark the claim as reported until one of them shows it.
- **Level 2:** What is the direct-evidence ratio and why track it? Expected: the share of workflow steps backed by observation or an artifact; a low ratio means the model of the workflow is mostly belief.
- **Level 3:** You can only observe the happy path. What is the risk? Expected: the exception path, where most failures live, stays unshaped, so the assistant breaks at the handoff that matters.
- **Level 3:** A proposed feature removes a visible step. What do you check before you accept it? Expected: whether hidden work behind that step still exists, so the feature only moves the effort somewhere invisible.

## Wrong answers

- "The customer knows their process, so the interview is the requirement." A description is reported behavior; it is useful but it does not prove what happens.
- "Average the descriptions from several people into one workflow." An averaged workflow can describe nobody; the variants must stay separate until their cause is known.
- "Infer the missing steps from similar teams." Inference is the weakest rung and must stay labeled as a guess.

## Taught in

The [workflow discovery lesson](../../../phases/14-agent-engineering/48-discover-the-real-workflow/) gives the evidence ladder and the step record.
