---
id: feature-store-design
title: Design a feature store that keeps training honest
card: system-design
kind: design
level: 2
roles: [ai-data-engineer, applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design]
tags: [feature-store, point-in-time-join, training-serving-skew, ttl]
minutes: 15
lessons: [phases/02-ml-fundamentals/21-feature-stores-and-training-serving-skew]
manuals: []
practice: []
cheatsheet: [feature-engineering, ml-system-design]
related: [system-design/skew-triage, system-design/feedback-loop-clean-data]
updated: 2026-11-03
---

Design the feature layer for a churn model. Training needs the value of each feature for millions of user and time pairs. Serving needs the latest value for one user in a few milliseconds. Name the parts, explain how a training row gets its features, and show with the lesson's numbers what goes wrong without the right join.

## Short answer

One registry holds each feature definition with its entity, window, default, TTL and version, and both paths compute from it. An offline store keeps the full history with event timestamps for training and backfills; a materialization job copies the latest value per entity into an online key-value store with a TTL. A training row takes the latest feature row at or before its label time, inside the TTL. Without that point-in-time join the lesson's demo looks better offline, 0.948 against 0.893, and worse on new data, 0.763 against 0.876, because the newest snapshot leaks the answer.

## Full answer

### The parts

| Part | Job |
|---|---|
| Registry | One definition per feature: entity, source, transformation, window, default, TTL, owner, version |
| Offline store | Full history with event timestamps, read by training and backfills |
| Point-in-time join | Pairs each label with the latest row at or before the label time, dropped if older than the TTL |
| Materialization | Copies the latest values from offline to online |
| Online store | Latest value per entity, read in milliseconds, refuses rows older than the TTL |
| Skew check | Compares logged serving features with the training path for the same entity and time |

### Two readers, one definition

Training asks "what was the value for each of millions of entity and time pairs". Serving asks "what is the value for this entity now". Both read the same definition from the registry; no service keeps a private copy of the transformation. A change creates a new version, and old models pin the version they trained on.

### The join

1. Find the feature rows of the same entity.
2. Keep rows whose event timestamp is at or before the label time.
3. Take the latest of those.
4. Drop it if the label time minus its event time exceeds the TTL.

A naive join on the entity alone returns the newest row for every label. For a churn label, the newest snapshot already counts the quiet days after the label day, so the feature contains the answer. The demo fits a rule on both training sets and tests on later labels: the naive join scores 0.948 offline and 0.763 on new data, the point-in-time join scores 0.893 offline and 0.876 on new data, and the leaked feature moved the threshold from 19 to 53 idle days.

### TTL and defaults

With a TTL of 10 days, a read five days after the last snapshot returns it, and a read 20 days later returns the defaults because the row is too old. The default lives in the registry so both paths fill a missing value the same way.

### Backfills and created time

A new feature has no history, so a backfill runs the definition at each past date and reads only events at or before that date. A backfill run today can still read data that arrived late, so a strict join also checks the created timestamp.

### The skew check

Log a sample of served features and compare each value with the training path for the same entity and time. Report the mismatch rate and the mean absolute difference per feature, and flag a feature above 1 percent mismatch. Three comparisons separate the causes: store read against training join for the whole system, fresh computation against training join for staleness, and a second code path against fresh computation for code differences.

## Follow-ups

- **Level 2:** Why does the leaked model look better offline? Expected: the feature contains the outcome, so the offline split rewards it; on new data the information is not there.
- **Level 2:** What does the TTL do in the join, and relative to what time? Expected: it drops a feature row too old for the label; the age is measured from each label time, not from the query time.
- **Level 3:** Two teams compute the same feature in two services. Which skew cause is that, and how does the registry remove it? Expected: two code paths; both services call the registry definition instead of their own copy.
- **Level 3:** Fresher serving features turn out to hurt. Why? Expected: the model trained on weekly snapshots, so values up to six days old are what it learned; staleness skew runs both ways.

## Wrong answers

- "Join labels to the feature table on the user id." That returns the newest value and copies the outcome into the input.
- "Fresher features are always better at serving time." The model learned the freshness of its training data; a different age is skew.
- "Snapshots every day remove the problem." Daily snapshots reduce staleness but the join still needs the as-of rule and the TTL.

## Taught in

The [feature store lesson](../../../phases/02-ml-fundamentals/21-feature-stores-and-training-serving-skew/) builds the registry, the point-in-time join, the online store and the skew check, and measures the naive join against the correct one.
