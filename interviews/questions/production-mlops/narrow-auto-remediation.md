---
id: narrow-auto-remediation
title: Which fixes an operations agent may run alone
card: production-mlops
kind: tradeoff
level: 3
roles: [ai-evaluation-reliability-engineer, inference-engineer]
rounds: [system-design, design-review]
tags: [ai-sre, auto-remediation, runbooks, human-approval]
minutes: 12
lessons: [phases/17-infrastructure-and-production/23-sre-for-ai]
manuals: []
practice: []
cheatsheet: [sre-for-ai]
related: [production-mlops/two-models-disagree, production-mlops/prediction-without-action]
updated: 2026-11-03
---

A vendor demo shows an operations agent that repairs incidents on its own. Your director asks which actions you would let such an agent take on the model service without a person in the loop. Draw the line and defend it.

## Short answer

Allow a narrow set that was approved in advance: restart a pod, revert one named deployment, scale a pool inside approved bounds, and flip an approved feature flag. Keep everything that changes the shape of the system behind a person: topology, resource limits, new code, access rights and databases. The agent proposes, a person approves the judgment calls, and the safe set grows only as the agent builds a record.

## Full answer

### The two sets

| Safe, automated | Not safe, human only |
|---|---|
| restart a pod | change the service topology |
| revert one specific deployment | modify resource limits |
| scale a pool within pre-approved bounds | deploy new code |
| enable a pre-approved feature flag | change access rights |
| | alter a database |

### What makes an action safe

It is reversible, its blast radius is bounded in advance, and it matches a step in a runbook that a person wrote. The lesson's example incident is a KV cache spike that pushed a serving engine out of memory. A pod restart clears it, and a restart is on the safe list. Raising the memory limit might also clear it, and that change alters how every pod runs from then on, so it stays with a person.

### How an action earns automation

1. Write the runbook in structured form: symptom, hypothesis, verify, act.
2. Give the action a success criterion and a verify step that runs after it.
3. Record every proposal and every human decision.
4. Promote the action from proposed to automatic after a run of incidents where the proposal matched what the person chose.

### The approval gate stays

The architecture is a supervisor over log, metric and runbook agents, a hypothesis with evidence, a human approval, and then an action from the narrow set. Even when two independent models agree on the cause, the approval stays for anything outside the safe set. The lesson is direct about vendors who sell a system that needs no supervision: they are overselling.

## Follow-ups

- **Level 3:** Why is a scale-up inside bounds safe while a resource limit change is not? Expected: the bounds were approved in advance and the action reverses cleanly. A limit change alters how every pod runs and can trigger the next incident.
- **Level 3:** What has to be true before the agent may run an action unsupervised? Expected: a structured runbook, a verify step with a success criterion, an audit record, and a record of proposals that matched the human decision.
- **Level 4:** The agent restarted the busiest pod during a load spike because a probe failed. Was that inside the rules? Expected: the action was allowed and the trigger was wrong. A restart under load drops the running requests, so the rule needs a condition on load and on the probe type, not only on the action.

## Wrong answers

- "If the agent is accurate enough, let it do everything." Accuracy on past incidents does not bound the damage of one wrong broad action.
- "No automation until the agent is perfect." A restart and a revert are safe today, and they remove the first part of most investigations.
- "An approval step makes the agent useless at night." The agent still does the investigation. The person approves one proposed action instead of starting from the dashboards.

## Taught in

The [SRE for AI lesson](../../../phases/17-infrastructure-and-production/23-sre-for-ai/) draws the line between narrow and broad remediation and keeps the human approval gate.
