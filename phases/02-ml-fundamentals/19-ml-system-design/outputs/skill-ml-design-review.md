---
name: skill-ml-design-review
description: Review an ML system design document before training starts, blocking gaps first
version: 1.0.0
phase: 2
lesson: 19
tags: [ml-system-design, design-review, baselines, serving, rollout]
---

# ML Design Review

Use this skill when someone shares a design document, a proposal, or a plan for a model that will make real decisions. Review the document in the order below. Report the blocking gaps first, then the other gaps, then the questions.

## Step 1: Check the six blocking items

Stop the review and ask for a fix when any of these items is missing:

1. **Decision.** The document names the action that uses each prediction and who or what takes it.
2. **Business metric.** The document names the company outcome that the decision must change and how an experiment measures it.
3. **Strong baseline.** The document compares the model with a heuristic rule or with the current system. A majority-class baseline alone does not count.
4. **No leakage.** The document confirms that every feature exists at the moment of the prediction.
5. **Rollout and rollback.** The plan has a shadow or canary stage and a rollback that takes minutes.
6. **Failure defaults.** Every failure mode has a default action, such as the heuristic rule or the last good score.

## Step 2: Check the problem framing

- The prediction names an entity, a target, and a horizon, such as "user cancels in the next 30 days".
- The document says why a rule or a lookup table is not enough.
- The ML task type matches the decision: classification, regression, ranking, forecasting, or anomaly detection.

## Step 3: Check the metrics

| Layer | Ask |
|---|---|
| Offline | Does the metric match the decision threshold? Use precision in the top 5 percent if the job acts on the top 5 percent. |
| Online | Which live signals show that the model works: acceptance rate, share of requests scored, score distribution? |
| Business | Which experiment measures the outcome, and how long until the result? |
| Guardrails | Which metrics must not get worse: cost, latency, complaints, unsubscribes? |

## Step 4: Check the data and labels

- Where the labels come from and who owns that table
- The label delay in days, and what the team monitors until labels arrive
- The number of positive examples
- A time-based holdout set, with the most recent period held out

## Step 5: Check the serving choice with arithmetic

Ask for five numbers: entities, requests per day, peak QPS, maximum staleness in hours, and the p99 latency budget. Then price both modes:

```text
batch runs per day   = 24 / (max_staleness_hours - batch_job_hours)
batch cost per day   = entities * runs per day * price per prediction + lookups * price per lookup
online replicas      = max(2, ceil(peak_qps / qps per replica))
online cost per day  = replicas * price per replica hour * 24
```

- Batch cannot work when the staleness limit is shorter than one batch job.
- Online cannot work when model latency is above the p99 budget.
- When both work, prefer the cheaper one, and check how many batch scores nobody reads.
- New entities with no history need an online path or a rule.

## Step 6: Check feedback loops

Ask how the model's decisions change its future training data:

- Does an intervention, such as an offer or a block, hide the true outcome?
- Do only the items that the model shows collect feedback?
- Is there a random holdout group or an exploration share that keeps clean data?
- Does the system log the score and the decision with each example?

## Step 7: Write the review

Use this format:

```text
Verdict: ready for review | revise
Blocking: <list, or "none">
Missing: <list of non-blocking gaps>
Serving check: <batch $/day, online $/day, chosen mode, pass or fail>
Questions: <at most five questions for the author>
```

To score a JSON version of the document, run `python3 code/main.py path/to/design_doc.json` from the lesson folder.
