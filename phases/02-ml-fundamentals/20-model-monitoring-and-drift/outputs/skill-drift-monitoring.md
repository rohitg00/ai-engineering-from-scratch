---
name: skill-drift-monitoring
description: Plan drift monitors for a deployed model and triage a drift alert
version: 1.0.0
phase: 2
lesson: 20
tags: [monitoring, drift, psi, kolmogorov-smirnov, chi-square, alerting]
---

# Drift Monitoring

Use this skill in two situations. Use Part A when a model is about to launch and needs monitors. Use Part B when a drift alert fires.

## Part A: Plan the monitors

### Step 1: List the signals per layer

| Layer | Minimum signals |
|---|---|
| System health | p99 latency, error rate, requests per minute |
| Inputs | One drift test per important feature, missing-value rate, new categories |
| Predictions | Score distribution (PSI on score deciles), positive-prediction rate |
| Outcomes | The offline metric from the design, computed on labeled events only |

### Step 2: Pick the test for each input

- Numeric feature: PSI on reference deciles, plus the KS statistic `D`
- Categorical feature: chi-square test on a two-row table, plus Cramér's V
- Feature with five or fewer distinct values: treat it as categorical

### Step 3: Set the windows

- Reference: the training data, or a production period that someone checked
- Current: a window large enough that clean windows stay below the warning level. Run the tests on old clean data to measure this.
- Cover a full weekly cycle in the reference when traffic changes by weekday

### Step 4: Set the alert policy

Write these numbers down before launch:

```text
family alpha          = 0.01
per-test alpha        = family alpha / number of tests
PSI warn / drift      = 0.10 / 0.25
KS D for drift        = 0.10 together with p < per-test alpha
Cramér's V for drift  = 0.10 together with p < per-test alpha
persistence           = 2 consecutive drift windows before an alert
outcome alert         = metric below reference metric - tolerance, for 2 windows
```

Send warnings to a dashboard. Send alerts to a person.

### Step 5: Record the label delay

State how long labels take to arrive and what the team watches until they do. If the delay is longer than a week, add a performance estimate that uses calibrated probabilities. Such an estimate handles covariate drift but cannot detect concept drift.

## Part B: Triage an alert

### Step 1: Rule out a pipeline defect

Check these first, because they look like drift:

- A schema change, a renamed column, or a unit change
- A spike in missing values or in a default value
- A new category that comes from a code change, not from users
- A broken join that fills features with nulls

### Step 2: Name the kind of drift

| Evidence | Likely drift | Action |
|---|---|---|
| Inputs moved, outcome metric stable | Covariate drift | Keep watching. Retrain only if traffic moved into regions with little data. |
| Positive rate moved, inputs per class look the same | Prior drift | Recalibrate scores or move the decision threshold |
| Inputs stable, outcome metric dropped | Concept drift | Collect new labels, then retrain on recent labeled data |
| Inputs moved and outcome metric dropped | Covariate drift with damage, or both kinds | Retrain on recent labeled data and check the new model on the newest period |

### Step 3: Check the size of the effect

A small p-value with a large window says little. Report PSI, `D`, or Cramér's V, and the change in the outcome metric. Rank the drifted features by their importance to the model.

### Step 4: Write the triage note

```text
Alert: <signal, window end, value, threshold>
Pipeline check: <defect found or none>
Drift kind: covariate | prior | concept | unclear
Impact: <outcome metric change, or "labels pending until <date>">
Action: wait | recalibrate | collect labels | retrain | roll back
Owner and review date: <name, date>
```

After any retraining, reset the reference window to the new training data.
