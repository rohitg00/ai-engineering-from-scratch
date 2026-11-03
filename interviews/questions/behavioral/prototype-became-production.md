---
id: prototype-became-production
title: A prototype that quietly acquired real users
card: behavioral
kind: debug
level: 3
roles: [applied-ai-engineer, agentic-ai-engineer, forward-deployed-ai-engineer, inference-engineer]
rounds: [behavioral]
tags: [stage-drift, prototype, pilot, production, ownership]
minutes: 12
lessons: [phases/14-agent-engineering/53-prototype-pilot-or-production]
manuals: []
practice: []
cheatsheet: [product-discovery, production-llm-app]
related: [behavioral/smallest-slice-that-decides, behavioral/decision-brief-after-setback]
updated: 2026-11-03
---

You discover that a weekend prototype you shared internally is now used every day by another team, with production data, and someone just reported an outage to you. Walk me through what went wrong before this moment and what you do in the first week.

## Short answer

The system drifted across stages. It gained users, data and authority without gaining ownership, and nothing in the system itself marked it as a prototype. In the first week I make the stage observable in configuration, access control, telemetry and documentation, cut the production data path until a named owner accepts it, and decide with that team whether the right next stage is a bounded pilot or a stop.

## Full answer

### Three stages ask three questions

| Stage | Primary question |
|---|---|
| Prototype | Can this mechanism produce the evidence at all? |
| Pilot | Does it work safely with a bounded real audience and real conditions? |
| Production | Can we own it continuously at the promised reliability and risk level? |

These are learning environments, not levels of polish. A prototype can be technically complete and still be disposable. Production begins when the organization accepts ongoing responsibility.

### What went wrong

The prototype was built for one question and had no false operational guarantees, which was right. The failure was stage drift: it acquired an audience, real data and the authority to affect another team's work, and nobody acquired ownership. A warning banner would not have prevented this. The stage has to be enforced by the system: a configuration flag that blocks production data, access control that limits the audience, telemetry that shows who uses it, and documentation that says what it is.

### The first week

1. Stop the bleeding: block the production data path with a technical control, not a message.
2. Name the stage in the system so anyone can see it.
3. Meet the other team with the pilot requirements: a named audience, a human owner, bounded duration and authority, audit and rollback, outcome and guardrail thresholds, and exit criteria for expand, revise or stop.
4. Decide. If no one will own it, the honest outcome is a stop, and the evidence it produced still counts.

### What production would require

A service level objective, on-call and incident ownership, security and privacy review, cost and capacity controls, rollback and recovery, continuous monitoring, and a retirement path. Deployment is not production. Ownership is.

## Follow-ups

- **Level 3:** The other team says the outage shows the tool is valuable. How do you answer? Expected: value is a reason to run a bounded pilot with an owner, not a reason to keep an unowned system on production data.
- **Level 3:** Which technical control would have prevented the drift? Expected: a configuration or access control that refuses production data unless the stage is set to pilot or production by an owner.
- **Level 4:** What is the first operational responsibility that makes a build production? Expected: someone accepts an on-call or incident ownership commitment; before that, the system has users but no owner.
- **Level 4:** The team wants to skip the pilot and go straight to production. What evidence would justify that? Expected: low consequence, operational readiness, and measured outcome and guardrail results from a bounded real audience.

## Wrong answers

- "Add a banner that says prototype." A banner does not stop data, users or authority from flowing in.
- "Harden the prototype into the product since people already use it." Prototype code earned another stage only if the evidence says so; usage is not that evidence.
- "Shut it down with no discussion." The evidence it produced is real; the decision owner needs options, not a surprise.

## Taught in

The [prototype, pilot or production lesson](../../../phases/14-agent-engineering/53-prototype-pilot-or-production/) gives the three stage questions, the pilot requirements and the stage drift controls.
