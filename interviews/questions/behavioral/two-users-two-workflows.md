---
id: two-users-two-workflows
title: Two users describe two different workflows
card: behavioral
kind: tradeoff
level: 2
roles: [forward-deployed-ai-engineer, applied-ai-engineer, ai-developer-relations-engineer]
rounds: [behavioral, customer]
tags: [workflow-discovery, variants, requirements]
minutes: 8
lessons: [phases/14-agent-engineering/48-discover-the-real-workflow]
manuals: []
practice: []
cheatsheet: [product-discovery]
related: [behavioral/evidence-ladder-for-workflows]
updated: 2026-11-03
---

Two senior analysts on the same team show you how they triage a flagged transaction. Their steps differ in order, in the tools they open, and in who they ask before they act. Your deadline allows one workflow in the first version. What do you do with the disagreement?

## Short answer

I keep both variants separate until I know why they differ. The difference can come from different roles, different risk levels, a legacy process next to a current one, a difference in expertise, or a real policy disagreement, and each of those leads to a different product. An averaged workflow can describe nobody, so the first version targets one variant on purpose and names the other as a known gap.

## Full answer

### Why not average

Two people can perform different workflows for good reasons. Merging their steps into one path produces a sequence that neither of them follows. The assistant then fails at the first handoff or exception, which is where these features fail most.

### What the difference can mean

| Cause | What it tells the build |
|---|---|
| Different roles | Two user types, maybe two outcome frames |
| Different risk levels | The branch is a feature, not noise |
| Legacy and current process | One variant may be retiring; confirm with the owner |
| Expertise difference | The expert path may be the target and the other the training gap |
| Policy disagreement | A human decision is needed before any build |

### How I resolve it

1. Record both variants as ordered steps with evidence and the rung of that evidence.
2. Find where the branch begins and which authority boundary each variant crosses.
3. Ask the owner of the process which cause applies; if it is a policy disagreement, that decision goes to a human and the build waits for it.
4. Pick one variant for the first slice by risk and frequency, and write the other as a non-goal with the reason.

### Where the exception hides

Often one analyst's "extra" step is the exception path the other analyst has stopped noticing. I ask for a real case where the normal path failed before I call a step optional.

## Follow-ups

- **Level 2:** One analyst asks a supervisor before acting and the other does not. What is that step? Expected: an authority boundary; the build must respect it, and the two variants may differ in risk level or role.
- **Level 2:** You can only ship one path. How do you choose? Expected: by the risk and the frequency of each variant, with the other recorded as a named gap, not by averaging.
- **Level 3:** The owner says both are fine. What do you record? Expected: that the policy allows both, with the evidence, so the assistant does not force one on everybody.
- **Level 3:** How do you keep the second variant from disappearing from the plan? Expected: write it as a non-goal with its reason and a review point, so it stays visible as a decision instead of an omission.

## Wrong answers

- "Merge the two into one standard process." The averaged workflow may describe nobody and breaks at the handoff.
- "Follow the more senior person." Seniority is not evidence; the cause of the difference decides.
- "Treat the extra steps as optional and skip them." The extra step is often the exception path that carries most of the risk.

## Taught in

The [workflow discovery lesson](../../../phases/14-agent-engineering/48-discover-the-real-workflow/) explains why disagreement must not be averaged away and lists the causes behind variants.
