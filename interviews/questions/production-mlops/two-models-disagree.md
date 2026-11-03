---
id: two-models-disagree
title: When the triage agent should say it is unsure
card: production-mlops
kind: concept
level: 2
roles: [ai-evaluation-reliability-engineer, inference-engineer]
rounds: [ml-breadth, system-design]
tags: [ai-sre, incident-triage, adversarial-evaluation, human-approval]
minutes: 8
lessons: [phases/17-infrastructure-and-production/23-sre-for-ai]
manuals: []
practice: []
cheatsheet: [sre-for-ai]
related: [production-mlops/narrow-auto-remediation, production-mlops/prediction-without-action]
updated: 2026-11-03
---

An incident triage agent proposes a root cause for every alert. The on-call team stopped trusting it after several confident wrong answers. Which pattern from the SRE lesson raises the trust in its output, and what does the team do when the pattern says the agent is unsure?

## Short answer

Run two models independently on the same incident. When they agree on the root cause, confidence is high. When they disagree, the system escalates to a person with both hypotheses and their evidence visible, instead of picking one. The pattern filters invented root causes at a low cost, and the disagreement itself tells the responder that the incident is uncertain.

## Full answer

### Adversarial evaluation

The lesson names the pattern after a product that ships it: two models analyze the same incident on their own. Agreement is confidence. Disagreement is an escalation with both hypotheses shown. It is simple, and it is an effective filter against a confident wrong answer, because two independent analyses rarely invent the same cause.

### Where it sits in the architecture

A supervisor splits the incident into sub-queries. Specialized agents with tool access search the logs, run the metric queries and retrieve the runbooks. The supervisor assembles a hypothesis with evidence and shows it to a person, who approves or redirects. Only then does an action run, and only from a narrow approved set. The two-model check sits at the hypothesis step, before the person sees it.

### What the person does on a disagreement

Reads both hypotheses and the evidence that each one cites. Picks one, redirects the agents, or starts the manual investigation with two leads instead of none. The lesson's division of labor holds: the agent proposes hypotheses and queries, and the person makes the judgment call.

### What the agents remember

Runbooks and postmortems live in a vector store, and both models retrieve from it on every incident. Operational memory survives team turnover, and a new engineer's first incident has the full history behind it.

### The limit of agreement

Two models that share training data can agree and be wrong together. Agreement raises confidence, it is not proof. Require every hypothesis to cite the log lines and the metric queries behind it, so that the responder can check the evidence and not the eloquence.

## Follow-ups

- **Level 2:** Why is a split verdict useful to the responder? Expected: it marks the incident as uncertain and gives the responder two candidate causes with their evidence.
- **Level 3:** Both models agree and both are wrong. How do you catch it? Expected: require each hypothesis to cite evidence that the responder can check, and keep the human approval before any action.
- **Level 3:** What does the pattern cost? Expected: two model runs per incident plus the latency of the slower one, which is small next to the first twenty minutes of a manual investigation that the lesson says are automatable.

## Wrong answers

- "Ask one model twice at temperature zero." A repeat of the same model shares its blind spots. The pattern needs independent analyses.
- "Let an agreed hypothesis trigger the fix on its own." Agreement raises confidence. The person still approves the action, and only narrow actions are automated at all.
- "Disagreement proves the agent is useless." It means the incident is uncertain, which is exactly when a person should look.

## Taught in

The [SRE for AI lesson](../../../phases/17-infrastructure-and-production/23-sre-for-ai/) describes the adversarial evaluation pattern and the supervisor architecture with human approval.
