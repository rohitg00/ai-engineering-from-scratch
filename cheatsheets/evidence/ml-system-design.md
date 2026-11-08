# Evidence: cheatsheets/ml-system-design.md

Abbreviations: P2 = phases/02-ml-fundamentals. L01 = P2/01-what-is-machine-learning, L19 = P2/19-ml-system-design, L20 = P2/20-model-monitoring-and-drift, L21 = P2/21-feature-stores-and-training-serving-skew. d = docs/en.md, c = code/main.py.

## One definition, two readers (architecture, 8 nodes, 8 edges)
- Raw events to feature definitions in the registry: L21/d:45
- Offline store, history with timestamps: L21/d:46, 39
- Point-in-time join with labels to training set: L21/d:47-48
- Online store, latest value per entity, materialize: L21/d:49-50, 41
- Serving request, a few milliseconds: L21/d:51, 38
- Logged features at serving time: L21/d:52, 120
- Skew check, mismatch rate per feature: L21/d:53-54, 120
- backfill writes the offline store: L21/d:114

## From goal to safe launch (flow, 8 steps)
1. prediction, entity, horizon, decision: L19/d:33-36, 45
2. offline, online, business, guardrail metrics first: L19/d:62-69, 81
3. trivial, heuristic, current system, minimum lift: L19/d:85-91
4. label source, delay, availability at prediction time: L19/d:97-100
5. latency, peak throughput, cost, staleness: L19/d:106-110, 177
6. shadow: L19/d:137
7. canary 1 to 5 percent, roll back on guardrail: L19/d:138
8. A/B test, business metric, statistical test: L19/d:139

## Toolkit calls (task-table, 8)
- choose_serving(workload, costs): L19/c:86
- compare_to_baselines(..., min_lift=0.02): L19/c:155, 162
- review_design_doc(doc, ready_score=0.85): L19/c:355
- psi(reference, current, bins=10): L20/c:40
- ks_statistic(sample_a, sample_b): L20/c:45
- chi_square_test(reference_counts, current_counts): L20/c:124
- point_in_time_join(labels, rows, ttl_days): L21/c:121
- detect_skew(training, serving, features): L21/c:230-233

## Price batch and online serving (annotated-code, 11 lines)
- refresh_hours and the infeasible batch plan: L19/c:51-56
- runs_per_day, predictions, dollars: L19/c:57-62
- replicas with min_replicas and replica_qps: L19/c:74
- online dollars per day: L19/c:75, pays for idle replicas: L19/d:129
- feasible latency check: L19/c:76

## Commands (command-table, 8)
- python3 code/main.py: L19/d:297, L20/d:263, L21/d:277, standard library: L19/d:189
- python3 code/main.py my_design_doc.json: L19/d:324
- stats.ks_2samp(reference_amounts, current_amounts): L20/d:292
- stats.chi2_contingency(table), statistic, pvalue, dof: L20/d:296-297
- DummyClassifier(strategy="most_frequent"): L19/d:337
- feast apply: L21/d:308
- feast materialize-incremental <end time>: L21/d:311
- store.get_historical_features(entity_df=...): L21/d:310

## Drift and skew formulas (concepts, 8)
- covariate drift P(x), input monitors: L20/d:54
- prior drift P(y), prediction and outcome monitors: L20/d:55
- concept drift P(y | x), outcome monitors only: L20/d:56
- PSI formula: L20/d:90-92
- KS D, 0 identical, 1 no overlap: L20/d:100-106
- Cramér's V for two rows: L20/d:121
- Little's law, 400 per second at 50 ms is 20: L19/d:112
- lift: L19/d:91

## Defaults and numbers (defaults, 8)
- family_alpha 0.01, 0.005 per test: L20/c:193, L20/d:129
- psi_warn 0.10, below 0.1 stable: L20/c:194, L20/d:96
- psi_drift 0.25: L20/c:195, L20/d:96
- ks_drift 0.10, with p below alpha: L20/c:196, 205-210
- min_cramers_v 0.10: L20/c:197
- patience 2: L20/c:198, L20/d:131
- window_size 500, step 250, label_delay 500: L20/c:295-297
- share clip 0.0001: L20/d:94

## Failures and fixes (troubleshooting, 8)
- service timeout, heuristic baseline: L19/d:159
- batch job fails, last good scores then rule: L19/d:160
- score distribution moves suddenly, pause and alert: L19/d:163
- covariate drift with stable accuracy, often none: L20/d:148
- concept drift, collect new labels first: L20/d:151, input monitors quiet: L20/d:283
- naive join 0.948 offline, worse live, future snapshot: L21/d:21-23, 215-221
- default -1 vs 365, two code paths: L21/d:23, 96-98, one definition: L21/d:101
- 60 false alarms per day, 50 features hourly at 0.05: L20/d:125, rules: L20/d:129-131

## Abbreviations (glossary, 6)
- PSI from credit scoring: L20/d:88
- KS, needs no bins: L20/d:100, 106
- TTL: L21/d:64
- QPS, size for the busiest minute: L19/d:109
- p99: L19/d:108
- CBPE, does not cope with concept drift: L20/d:307

## Questions (qa, 6)
- when not to use ML: L19/d:51-55, L01/d:266-268
- AUC averages over unused thresholds: L19/d:81
- 60-80%, 10-20%, 10-20%, newest period: L01/d:173-175, L19/d:102
- random holdout for feedback loops: L19/d:151
- three skew comparisons: L21/d:122-126
- after retraining, recent labels, shadow, canary, reset reference: L20/d:153
