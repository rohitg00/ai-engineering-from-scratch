---
id: skew-triage
title: Offline accuracy was fine and live accuracy is not
card: system-design
kind: debug
level: 3
roles: [ai-data-engineer, applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design, debugging]
tags: [training-serving-skew, feature-store, defaults, staleness]
minutes: 15
lessons: [phases/02-ml-fundamentals/21-feature-stores-and-training-serving-skew]
manuals: []
practice: []
cheatsheet: [feature-engineering, ml-system-design]
related: [system-design/feature-store-design, system-design/concept-drift-blind-spot]
updated: 2026-11-03
---

A churn model scored well offline and does worse than the older, simpler model on live traffic. Serving features are computed by another team's service. You have a sample of logged serving requests. Design the triage: which comparisons you run, in which order, what each one isolates, and what the fix looks like for each cause you find.

## Short answer

Compare the same entity and time across three pairs. The online store read against the training join tests the whole system and should show zero skew when both read one definition. A fresh computation against the training join isolates staleness, and the second team's code path against a fresh computation isolates code differences such as window boundaries and defaults. Each pair gives a mismatch rate and a mean absolute difference per feature, and the fix for every cause is the same shape: one registry definition that both paths call, with logged serving features checked against it.

## Full answer

### The four causes

| Cause | What happens | Example from the lesson |
|---|---|---|
| Two code paths | Training and serving compute the feature differently | The serving window includes one extra day |
| Stale features | The served value has a different age than training saw | Training read weekly snapshots, serving computes fresh |
| Different defaults | The two paths fill a missing value differently | Training used 365 for no purchase yet, serving used -1 |
| Time travel | Training read a value from after the label time | A naive join took the newest snapshot |

### The three comparisons

1. Online store read against the training join. Both read the same materialized rows from one definition, so every feature should show a mismatch of zero. A nonzero result here means the store or the join itself is wrong.
2. Fresh computation against the training join. This isolates staleness. In the lesson's demo the fresh value differs on most requests: 83.0% mismatch for days since last purchase, 30.5% for the purchase count, 37.1% for spend. Fresher is not better here, because the model learned from values up to six days old.
3. Second code path against fresh computation. This isolates code. The demo shows 12.5% mismatch on both window counts, because the other team's window includes one extra day, and 5.5% mismatch on days since last purchase with a mean difference of 20.07, which comes only from new users where the defaults disagree, -1 against 365.

The check needs the same request keys on both sides, and it fails loudly when the keys differ or when there are no requests, because a missing request hides skew and an empty check proves nothing.

### The fixes

- Two code paths: delete the private copy; both services call the registry definition, and a change creates a new version that old models do not pick up.
- Stale features: match the serving age to the training age, or retrain on the fresher snapshots; a feature's freshness is part of its definition.
- Different defaults: one default in the registry, applied by one function in both paths.
- Time travel: the point-in-time join with the TTL, which the demo shows moves offline accuracy from an inflated 0.948 to an honest 0.893 and live accuracy from 0.763 to 0.876.

### Why the simpler model won live

The older model used features that both paths computed the same way. The new model trusted a feature whose live values came from a different window and a different default, so it saw inputs it never trained on.

## Follow-ups

- **Level 3:** Which comparison would you run first with one hour available? Expected: the first one; if the store read matches the training join, the system is consistent and the problem is elsewhere, and if not, every downstream check is moot.
- **Level 3:** The defaults differ only for new users. Why does the mismatch rate understate the damage? Expected: the rate is low because new users are few, but the difference per mismatch is huge, so the model's output for every new user is wrong.
- **Level 4:** The other team cannot change their service this quarter. What do you do? Expected: log their served features, train the next model on those logged values so training matches serving, and keep the skew check running so the gap is visible.
- **Level 4:** How does a created timestamp enter the triage? Expected: a backfill written today can read late-arriving data, so a strict join also drops rows created after the label time; otherwise the training path itself is skewed.

## Wrong answers

- "Fresh serving features are always better than training snapshots." The model learned the training freshness; a different age is skew in either direction.
- "A mismatch rate under a few percent is fine." A small rate with a large mean difference, as with the defaults, still breaks every affected prediction.
- "Compare offline accuracy with live accuracy and call it drift." Drift is a change over time; skew is a difference between two readers of the same feature at the same time, and the three comparisons tell them apart.

## Taught in

The [feature store lesson](../../../phases/02-ml-fundamentals/21-feature-stores-and-training-serving-skew/) names the four causes of skew and runs the three comparisons on logged requests.
