---
id: rollback-without-redeploy
title: Make the next rollback take seconds
card: production-mlops
kind: design
level: 2
roles: [ai-evaluation-reliability-engineer, inference-engineer, applied-ai-engineer]
rounds: [system-design, design-review]
tags: [rollback, feature-flags, model-registry, canary]
minutes: 10
lessons: [phases/17-infrastructure-and-production/20-shadow-canary-progressive]
manuals: []
practice: []
cheatsheet: [progressive-delivery]
related: [production-mlops/canary-gates-above-noise, production-mlops/shadow-mode-is-a-smoke-test]
updated: 2026-11-03
---

Last quarter a bad model launch took three hours to undo, because the only way back was a new deployment. You own the release path now. Design it so that the next time, the way back takes seconds. Name the pieces and say what each one holds.

## Short answer

Separate the policy from the model. Keep the traffic split in a feature flag that a configuration change flips, and keep the model in a registry under a pinned digest that never upgrades on its own. A rollback is then two actions: revert the flag, and point the pin at the previous digest, which also restores the prompt and template version pinned with that model. Nothing is rebuilt and nothing is redeployed.

## Full answer

### Two things change in a launch

1. **The policy.** Which share of traffic goes to which model. It lives in a feature-flag system, and a flip takes seconds.
2. **The model.** The artifact itself. It lives in a registry with a content digest. A pinned digest does not move when a new build appears.

A deployment couples the two: to change the policy you ship a new build. The lesson's rule is blunt: if your stack needs a redeploy to roll back, fix that before you roll anything out.

### The rollback

Revert the flag, set the pinned digest to the previous one, and restore the gate thresholds that went with it. The lesson puts the whole sequence at seconds, against hours for a redeploy. In its opening story, the redeploy took three hours and the flag flip would have taken 30 seconds.

### The same flag runs the canary

The canary share lives in the same flag: 1, 10, 25, 50, 75 and then 100 percent. A gate breach sets the share back to zero. That makes the halt and the rollback the same mechanism, so the path you rehearse on every rollout is the path you use in an incident.

### The tooling shape

A progressive delivery controller on the cluster shifts weights at the service mesh or the ingress. A model-serving platform can carry the canary split itself. A feature-flag service holds the policy. Pick one of each, and keep the old model deployed until the new one has held at 100 percent through the gates.

### Rehearse it

The lesson's exercise asks for a rollback under 60 seconds end to end. Time it in staging on every release, and treat a slower result as a release blocker.

## Follow-ups

- **Level 2:** Why pin the model by digest and not by tag? Expected: a tag can move to a new build. A digest is immutable, so the rollback target is exactly the model that ran before.
- **Level 2:** What else must revert together with the model? Expected: the gate thresholds, and any prompt or template version that shipped with the model.
- **Level 3:** How do you know the path works before you need it? Expected: rehearse it in staging on every release and time it end to end, against a target such as the lesson's 60 seconds.
- **Level 3:** The new model needs a new engine image. Does the flag still work? Expected: yes, when both images run side by side and the flag chooses between them. The old deployment stays alive until the new one has held at 100 percent.

## Wrong answers

- "Roll back by redeploying the previous image." A redeploy takes hours, and the lesson's point is to separate the rollback from the deployment.
- "Delete the old model a day after the launch." The old model must stay available until the canary has held at full traffic through every gate.
- "A fast rollback makes the gates unnecessary." The gates decide when to roll back. The fast path only limits the damage once they fire.

## Taught in

The [progressive delivery lesson](../../../phases/17-infrastructure-and-production/20-shadow-canary-progressive/) separates policy flags from model pins and makes the rollback a configuration change.
