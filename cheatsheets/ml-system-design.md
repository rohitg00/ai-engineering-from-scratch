---
id: ml-system-design
title: ML System Design, Drift and Feature Stores
code: MS
subtitle: Frame the task, price serving, beat baselines, roll out safely, catch drift and training-serving skew.
hue: 220
sources: phases/02-ml-fundamentals/01-what-is-machine-learning, phases/02-ml-fundamentals/19-ml-system-design, phases/02-ml-fundamentals/20-model-monitoring-and-drift, phases/02-ml-fundamentals/21-feature-stores-and-training-serving-skew
source_hash: 89d7b8dde8c0353a
---

## One definition, two readers
type: architecture
from: phases/02-ml-fundamentals/21-feature-stores-and-training-serving-skew/docs/en.md

```arch
node | raw | 1,1 | Raw events |
node | reg | 2,1 | Registry | feature definitions
node | off | 3,1 | Offline store | history with timestamps
node | pit | 4,1 | Point-in-time join | labels to training set
node | on | 3,2 | Online store | latest value per entity
node | serve | 2,2 | Serving request | a few milliseconds
node | log | 2,3 | Logged features | serving time
node | skew | 4,3 | Skew check | mismatch rate per feature
edge | raw | reg |
edge | reg | off | backfill
edge | off | pit |
edge | off | on | materialize
edge | on | serve |
edge | serve | log |
edge | log | skew |
edge | pit | skew |
```

## From goal to safe launch
type: flow
from: phases/02-ml-fundamentals/19-ml-system-design/docs/en.md

1. **Task**: name the prediction, the entity, the horizon and the decision that uses it.
2. **Metrics**: pick offline, online, business and guardrail metrics before the model.
3. **Baselines**: trivial, heuristic and current system. Set a minimum lift first.
4. **Data**: check label source, label delay and that every feature exists at prediction time.
5. **Budgets**: set p99 latency, peak QPS, cost per day and staleness.
6. **Shadow**: the new model scores a copy of live traffic. Nobody uses its output.
7. **Canary**: real decisions for 1 to 5 percent of traffic. Roll back on a guardrail break.
8. **A/B test**: random user split. Measure the business metric with a statistical test.

## Toolkit calls
type: task-table
from: phases/02-ml-fundamentals/19-ml-system-design/code/main.py, phases/02-ml-fundamentals/20-model-monitoring-and-drift/code/main.py, phases/02-ml-fundamentals/21-feature-stores-and-training-serving-skew/code/main.py

| Task | Code |
|---|---|
| Cheapest plan in budget | `choose_serving(workload, costs)` |
| Lift over the best baseline | `compare_to_baselines(..., min_lift=0.02)` |
| Score a design doc | `review_design_doc(doc, ready_score=0.85)` |
| Numeric drift, decile bins | `psi(reference, current, bins=10)` |
| Largest CDF gap | `ks_statistic(sample_a, sample_b)` |
| Categorical drift | `chi_square_test(reference_counts, current_counts)` |
| As-of join with TTL | `point_in_time_join(labels, rows, ttl_days)` |
| Compare logged features | `detect_skew(training, serving, features)` |

## Price batch and online serving
type: annotated-code
lang: python
from: phases/02-ml-fundamentals/19-ml-system-design/code/main.py

```python
refresh_hours = workload.max_staleness_hours - costs.batch_job_hours
if refresh_hours <= 0:                       # job longer than the limit
    return ServingPlan("batch", False, ...)
runs_per_day = 24.0 / refresh_hours
predictions = workload.entities * runs_per_day
dollars = (predictions / 1e6 * costs.batch_dollars_per_million
    + workload.requests_per_day / 1e6 * costs.lookup_dollars_per_million)
replicas = max(costs.min_replicas, math.ceil(workload.peak_qps / costs.replica_qps))
dollars = replicas * costs.replica_dollars_per_hour * 24.0   # online pays for idle
feasible = costs.online_latency_ms <= workload.latency_budget_ms
```

## Commands
type: command-table
from: phases/02-ml-fundamentals/19-ml-system-design/docs/en.md, phases/02-ml-fundamentals/20-model-monitoring-and-drift/docs/en.md, phases/02-ml-fundamentals/21-feature-stores-and-training-serving-skew/docs/en.md

| Command | What it does |
|---|---|
| `python3 code/main.py` | Runs each lesson demo with the standard library |
| `python3 code/main.py my_design_doc.json` | Reviews your own design document |
| `stats.ks_2samp(reference_amounts, current_amounts)` | KS statistic and p-value in scipy |
| `stats.chi2_contingency(table)` | Chi-square statistic, p-value and dof |
| `DummyClassifier(strategy="most_frequent")` | Majority-class baseline |
| `feast apply` | Registers feature definitions in Feast |
| `feast materialize-incremental <end time>` | Copies latest values to the online store |
| `store.get_historical_features(entity_df=...)` | Point-in-time training features |

## Drift and skew formulas
type: concepts
from: phases/02-ml-fundamentals/20-model-monitoring-and-drift/docs/en.md, phases/02-ml-fundamentals/19-ml-system-design/docs/en.md

- **Covariate drift**: `P(x)` changes. Input monitors see it.
- **Prior drift**: `P(y)` changes. Prediction and outcome monitors see it.
- **Concept drift**: `P(y | x)` changes. Only outcome monitors see it.
- **PSI**: $\sum (\text{current} - \text{reference}) \cdot \ln(\text{current} / \text{reference})$ over bins.
- **KS D**: largest gap between two empirical CDFs. 0 for identical, 1 for no overlap.
- **Cramér's V**: square root of chi2 / grand_total for a two-row table.
- **Little's law**: in progress = throughput times latency. 400 rps at 50 ms is 20.
- **Lift**: model score minus the strongest baseline score.

## Defaults and numbers
type: defaults
from: phases/02-ml-fundamentals/20-model-monitoring-and-drift/code/main.py, phases/02-ml-fundamentals/20-model-monitoring-and-drift/docs/en.md

| Setting | Default | Note |
|---|---|---|
| `family_alpha` | 0.01 | Bonferroni, 0.005 for each of two tests |
| `psi_warn` | 0.10 | PSI below 0.1 is stable |
| `psi_drift` | 0.25 | Above 0.25 is a significant shift |
| `ks_drift` | 0.10 | D must pass and p below alpha |
| `min_cramers_v` | 0.10 | Effect size for categories |
| `patience` | 2 | Consecutive drift windows before an alert |
| `window_size` | 500 | step=250, label_delay=500 |
| PSI share clip | 0.0001 | Stops an infinite log |

## Failures and fixes
type: troubleshooting
from: phases/02-ml-fundamentals/19-ml-system-design/docs/en.md, phases/02-ml-fundamentals/20-model-monitoring-and-drift/docs/en.md, phases/02-ml-fundamentals/21-feature-stores-and-training-serving-skew/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Model service times out | No plan for the failure | Use the heuristic baseline |
| Nightly batch job fails | Scores go missing | Serve last good scores, then the rule |
| Score distribution jumps | Wrong decisions at scale | Pause actions and alert a person |
| Inputs drift, accuracy stable | Covariate drift | Often none. Watch the outcome |
| Accuracy drops, inputs quiet | Concept drift | Collect new labels, then retrain |
| Offline 0.948, live worse | Naive join reads future rows | Point-in-time join |
| Serving default -1, training 365 | Two code paths | One registry definition |
| 60 false alarms per day | 50 features hourly at 0.05 | Bonferroni, effect size, persistence |

## Abbreviations
type: glossary
from: phases/02-ml-fundamentals/19-ml-system-design/docs/en.md, phases/02-ml-fundamentals/20-model-monitoring-and-drift/docs/en.md, phases/02-ml-fundamentals/21-feature-stores-and-training-serving-skew/docs/en.md

- **PSI**: Population Stability Index. From credit scoring.
- **KS**: Kolmogorov-Smirnov. Two-sample test on CDFs. Needs no bins.
- **TTL**: time to live. An older value counts as missing.
- **QPS**: queries per second. Size for the peak, not the average.
- **p99**: the latency that 99 of 100 requests stay under.
- **CBPE**: Confidence-based Performance Estimation. Fails on concept drift.

## Questions
type: qa
from: phases/02-ml-fundamentals/01-what-is-machine-learning/docs/en.md, phases/02-ml-fundamentals/19-ml-system-design/docs/en.md, phases/02-ml-fundamentals/21-feature-stores-and-training-serving-skew/docs/en.md, phases/02-ml-fundamentals/20-model-monitoring-and-drift/docs/en.md

- **When not to use ML?** A short rule works, no labels, nobody acts, or one error is unacceptable.
- **Why not AUC?** It averages over thresholds you never use. Match the decision instead.
- **How to split data?** Train 60-80%, validation 10-20%, test 10-20%. Hold out the newest period.
- **How to break a feedback loop?** Keep a random holdout that never gets the intervention.
- **How to find the skew cause?** Compare online read, fresh compute and second code path.
- **After retraining?** Test on recent labels, shadow and canary, then reset the reference window.
