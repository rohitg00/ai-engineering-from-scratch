---
name: skill-feature-skew-audit
description: Audit a feature pipeline for time travel and training-serving skew
version: 1.0.0
phase: 2
lesson: 21
tags: [feature-store, point-in-time, training-serving-skew, leakage, backfill]
---

# Feature Skew Audit

Use this skill when a model scores well offline and worse in production. Also use it when a team adds a feature store, and before a new feature goes live. Work through the steps in order and record each finding.

## Step 1: Map both paths

For every feature, write down two lines:

```text
training path: <source table> -> <transformation code> -> <join to labels>
serving path:  <source> -> <transformation code> -> <store or request-time compute>
```

If the two lines name different transformation code, mark the feature "two code paths". That is the first skew risk.

## Step 2: Check the training join for time travel

- The join uses the label timestamp, not only the entity key.
- The join takes the latest row with event time at or before the label time.
- The join drops rows older than the TTL.
- Backfilled or corrected rows carry a created timestamp, and the join ignores rows created after the label time.
- Aggregation windows end at the label time. A window such as "the 30 days around the label" leaks.

Quick test: count the training rows whose feature row is later than the label. Any count above zero is a leak.

## Step 3: Compare the definitions

For each feature, compare the two paths on these points:

| Point | Question |
|---|---|
| Window edges | Is each window edge inclusive or exclusive in both paths? |
| Missing values | Do both paths use the same default for no history and for expired values? |
| Units and types | Same currency, same time zone, same integer or float type? |
| Rounding | Same rounding, at the same step? |
| Category mapping | Same vocabulary, same handling of unknown values? |

## Step 4: Compare freshness

- How old is a training value at its label time, on average and at most?
- How old is a serving value at request time, on average and at most?
- What happens when materialization fails? The TTL must turn old values into defaults, not serve them silently.

A model that trained on values up to a week old can behave differently on fresh values. Match the freshness, or retrain on values with the serving freshness.

## Step 5: Measure skew

1. Log the feature values that the serving path used, with the entity and the request time.
2. Recompute the same keys with the training path.
3. Per feature, report the mismatch rate and the mean absolute difference.
4. Split the cause with three comparisons: store read versus training, fresh compute versus training, second path versus fresh compute.

Flag a feature when more than 1 percent of values differ, unless the difference is a documented freshness gap.

## Step 6: Write the audit result

```text
Feature: <name, version>
Paths: shared definition | two code paths
Time travel: none found | <rows affected and cause>
Definition gaps: <window edges, defaults, units, rounding>
Freshness: training <age>, serving <age>, TTL <days>
Measured skew: <mismatch rate, mean |diff|>
Fix: <move both paths to one registry definition | fix join | align default | align TTL>
```

Fix order: remove time travel first, then move both paths to one definition, then align freshness.
