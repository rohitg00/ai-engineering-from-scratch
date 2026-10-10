# Monitoring Models in Production — Data Drift and Concept Drift

> A deployed model fails without an error message. It keeps returning scores while the world moves away from its training data, and only monitoring shows the gap.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 2, Lessons 09 (Model Evaluation), 16 (Anomaly Detection), and 19 (ML System Design)
**Time:** ~110 minutes

## Learning Objectives

- Choose monitoring signals at four layers: system health, inputs, predictions, and outcomes
- Distinguish covariate drift, prior drift, and concept drift by the part of the joint distribution that changes
- Implement the Population Stability Index, the two-sample Kolmogorov-Smirnov statistic, and the chi-square test from scratch
- Compare a fixed reference window with sliding current windows, and explain how window size changes noise and delay
- Design an alert policy that limits false alarms with effect sizes, a multiple-testing correction, and a persistence rule
- Decide which kind of drift needs retraining, which needs new labels, and which needs no action

## The Problem

A payment-risk model goes live with 95 percent accuracy. Two months later, a marketing campaign brings in app users with larger baskets. Four months later, fraudsters change their tactics, and payments that used to be safe start to turn into chargebacks.

The model service returns HTTP 200 for every request during all of this. The latency is normal, and the logs show no errors. The first sign of trouble is a finance report about chargebacks, weeks after the damage.

Software monitoring checks whether a service answers. Model monitoring checks whether the answers are still right, and whether the data still looks like the data that trained the model. This lesson builds the statistics, the windows, and the alert policy for that second job. You run them on a synthetic stream with two injected changes and watch which monitor reacts to which change.

## The Concept

### What to monitor

Monitor four layers. The first three give early warnings. Only the fourth measures correctness, and it arrives late.

| Layer | Signals | Available | Question it answers |
|---|---|---|---|
| System health | p50 and p99 latency, error rate, throughput, memory | At once | Does the service answer? |
| Inputs | Distribution of each feature, missing-value rate, schema, new categories | At once | Does live data look like training data? |
| Predictions | Score distribution, positive rate, share of default answers | At once | Does the model behave as before? |
| Outcomes | Accuracy, precision, calibration, business metric | After the label delay | Is the model still right? |

Input monitoring is the main subject of this lesson, because it works before labels arrive. It has a limit that the demo shows: some changes leave the inputs untouched.

### Three kinds of drift

Write the joint distribution of inputs `x` and labels `y` in two ways:

```text
P(x, y) = P(x) * P(y | x) = P(y) * P(x | y)
```

Each kind of drift changes a different factor:

| Drift | What changes | What stays | Payment example | Which monitor sees it |
|---|---|---|---|---|
| Covariate drift | `P(x)` | `P(y \| x)` | More app users with larger baskets | Input monitors |
| Prior drift | `P(y)` | `P(x \| y)` | The fraud rate doubles during an attack, and fraud looks the same | Prediction and outcome monitors |
| Concept drift | `P(y \| x)` | Can stay | The same basket now has a different fraud risk | Outcome monitors only |

Gama et al. call a change in `P(y | x)` real concept drift. They call a change in `P(x)` that leaves `P(y | x)` alone virtual drift. Their survey also sorts drift by how it happens over time: sudden, incremental, gradual, or as a concept that comes back.

Covariate drift does not always hurt. If the model learned `P(y | x)` well, it stays right for each input. It can still lose accuracy when traffic moves into regions with little training data or close to the decision boundary.

### Delayed labels

The outcome arrives after the prediction. The delay depends on the problem:

| Problem | When the label arrives |
|---|---|
| Ad click | Seconds |
| Churn in the next 30 days | 30 days |
| Card fraud | When the chargeback arrives, often weeks later |
| Loan default | Months or years |

During the delay, you have inputs and predictions but no outcomes. Monitor the inputs and predictions, join the labels when they arrive, and compute outcome metrics on the labeled part only. The demo uses a label delay of 500 events, so the outcome monitor always looks 500 events into the past.

### Reference and current windows

Every drift test compares two samples:

- **Reference window.** The training data, or a period of production that you checked by hand. It stays fixed until you retrain.
- **Current window.** The most recent events, either the last `N` events or the last `T` hours.

A sliding window moves forward by a step smaller than its size, so consecutive windows overlap. A tumbling window moves by its full size. Window size is a trade-off. A small window reacts quickly but scores noise as drift. A large window is stable but reports a change late.

Seasonality breaks naive windows. Monday traffic differs from Saturday traffic in many products. Make the reference cover a full cycle, or compare each window with the same period in an earlier cycle.

### Population Stability Index

PSI comes from credit scoring. Cut the reference values into bins, usually ten bins at the reference deciles, so that each bin holds 10 percent of the reference. Count the share of current values in each bin. Then add up one term per bin:

```text
PSI = sum over bins of (current_share - reference_share) * ln(current_share / reference_share)
```

A bin with a share of zero makes the log infinite, so clip every share to a small value such as 0.0001. PSI is symmetric. It equals the KL divergence from current to reference plus the KL divergence from reference to current.

Practitioners read PSI with fixed bands: below 0.1 is stable, 0.1 to 0.25 is a moderate shift, and above 0.25 is a significant shift. Treat these bands as a convention, not a test. PSI grows with the number of bins and shrinks with sample size. In the demo, windows of 500 events with no drift score between 0.01 and 0.04.

### Kolmogorov-Smirnov statistic

The two-sample KS statistic `D` is the largest vertical gap between the two empirical cumulative distribution functions:

```text
D = max over x of | F_reference(x) - F_current(x) |
```

`D` is 0 for identical samples and 1 for samples that do not overlap. It needs no bins. The p-value comes from the Kolmogorov distribution with the effective sample size `n * m / (n + m)`.

With large samples, the p-value goes to zero for a gap that nobody cares about. A shift of 0.02 standard deviations is "significant" with a million events per window. Use `D` itself as an effect size, and alert only when both `D` and the p-value pass their thresholds.

### Chi-square test for categorical features

For a categorical feature, such as the payment channel, build a table with two rows (reference, current) and one column per category. The expected count in each cell comes from the row and column totals:

```text
expected[r][c] = row_total[r] * column_total[c] / grand_total
chi2 = sum over cells of (observed - expected)^2 / expected
```

The test has `k - 1` degrees of freedom for `k` categories. A category that appears only in the current window adds a large term, so the test reacts to new values. Cramér's V is the effect size. For a table with two rows, it equals the square root of `chi2 / grand_total`.

### Alert thresholds and false alarms

Each test has a false-alarm rate `alpha` when nothing changed. Monitoring runs many tests. With 50 features checked every hour at `alpha = 0.05`, you expect about 60 false alarms per day when nothing changed. People stop reading alerts long before that.

Four rules keep the alert rate useful:

1. **Correct for multiple tests.** The Bonferroni correction divides `alpha` by the number of tests. The demo uses a family `alpha` of 0.01 over two tests, so each test uses 0.005.
2. **Require an effect size.** Alert only when PSI, `D`, or Cramér's V also passes a threshold.
3. **Require persistence.** Alert only after `k` consecutive drift windows. The demo uses `k = 2`.
4. **Separate warnings from alerts.** A warning goes to a dashboard. An alert goes to a person.

The demo shows rule 2 at work. One clean window has a chi-square p-value of 0.0009, below the per-test `alpha`. Its Cramér's V is below 0.1, so the policy logs a warning, not an alert.

### Retraining triggers

There are three common triggers for retraining:

- **Schedule.** Retrain every week or month. This is simple, but it retrains when nothing changed and waits when something did.
- **Drift.** Retrain when input drift on important features stays above the threshold.
- **Performance.** Retrain when an outcome metric drops below the reference value minus a tolerance.

The kind of drift decides what retraining can do:

| Drift | Useful action |
|---|---|
| Covariate drift, accuracy stable | Often none. Keep watching the outcome metric. |
| Covariate drift into regions with little data | Retrain on recent data that includes those regions |
| Prior drift | Recalibrate the scores or move the decision threshold |
| Concept drift | Collect new labels first. Retraining on old labels teaches the old concept again. |

After retraining, test the new model on the most recent labeled data. Roll it out with the shadow and canary stages from the system design lesson. Then reset the reference window to the new training data.

```figure
mlprod-drift-psi
```

## Build It

The code in `code/main.py` uses only the standard library.

### Step 1: Quantile bins and PSI

The bin edges are the reference deciles. `bisect_right` finds the bin of each value.

```python
def quantile_edges(reference: list[float], bins: int = 10) -> list[float]:
    ordered = sorted(reference)
    n = len(ordered)
    edges = [ordered[min(n - 1, (n * i) // bins)] for i in range(1, bins)]
    return sorted(set(edges))


def psi_from_fractions(expected: list[float], actual: list[float], eps: float = 1e-4) -> float:
    total = 0.0
    for e, a in zip(expected, actual):
        e, a = max(e, eps), max(a, eps)
        total += (a - e) * math.log(a / e)
    return total
```

### Step 2: The KS statistic and its p-value

Walk both sorted samples together. At each distinct value, move past every copy of it in both samples, then compare the two cumulative shares. This handles ties correctly.

```python
def ks_statistic(sample_a: list[float], sample_b: list[float]) -> float:
    a, b = sorted(sample_a), sorted(sample_b)
    n, m = len(a), len(b)
    i = j = 0
    d = 0.0
    while i < n and j < m:
        x = min(a[i], b[j])
        while i < n and a[i] <= x:
            i += 1
        while j < m and b[j] <= x:
            j += 1
        d = max(d, abs(i / n - j / m))
    return d
```

The p-value uses the series for the Kolmogorov distribution, `2 * sum((-1)^(k-1) * exp(-2 k^2 lambda^2))`, with `lambda = sqrt(n * m / (n + m)) * D`.

### Step 3: The chi-square test

`chi2_sf` computes the chi-square survival function through the regularized upper incomplete gamma function. It uses a series for small arguments and a continued fraction for large ones. `chi_square_test` builds the two-row table, computes the statistic, and returns the p-value and Cramér's V.

```python
def chi_square_test(reference_counts: dict[str, int], current_counts: dict[str, int]) -> ChiSquareResult:
    categories = [c for c in sorted(set(reference_counts) | set(current_counts))
                  if reference_counts.get(c, 0) + current_counts.get(c, 0) > 0]
    rows = [[reference_counts.get(c, 0) for c in categories], [current_counts.get(c, 0) for c in categories]]
    row_totals = [sum(r) for r in rows]
    grand = sum(row_totals)
    if len(categories) < 2 or 0 in row_totals:
        return ChiSquareResult(0.0, 0, 1.0, 0.0)
    statistic = 0.0
    for col, _ in enumerate(categories):
        col_total = rows[0][col] + rows[1][col]
        for r in range(2):
            expected = row_totals[r] * col_total / grand
            statistic += (rows[r][col] - expected) ** 2 / expected
    dof = len(categories) - 1
    return ChiSquareResult(statistic, dof, chi2_sf(statistic, dof), math.sqrt(statistic / grand))
```

### Step 4: Windows and the drift monitor

`SlidingWindow` keeps the last `size` events in a `deque`. `DriftMonitor` computes the reference bins and counts once. Its `check` method returns PSI, `D`, and the KS p-value for each numeric feature, and the chi-square result for each categorical feature.

### Step 5: The alert policy

The policy turns each metric set into a level and counts consecutive drift windows per signal:

```python
def level(self, metrics: dict[str, float]) -> str:
    if "psi" in metrics:
        if metrics["psi"] >= self.psi_drift or (metrics["ks"] >= self.ks_drift and metrics["ks_p"] < self.alpha):
            return "drift"
        return "warn" if metrics["psi"] >= self.psi_warn else "ok"
    if metrics["p"] < self.alpha and metrics["v"] >= self.min_cramers_v:
        return "drift"
    return "warn" if metrics["p"] < self.alpha else "ok"
```

`update` returns `ALERT` on the window that completes the streak, and `resolved` on the first clean window after an alert.

### Step 6: A stream with injected drift

The stream has 9000 payment events with an `amount`, a `channel`, and a fraud `label`. Four segments define it:

| Events | Amount | Channel mix (app, store, web) | Label boundary | Change |
|---|---|---|---|---|
| 0 to 2999 | mean 100, sd 20 | 35, 15, 50 percent | 120 | Reference period |
| 3000 to 4999 | mean 118, sd 24 | 60, 10, 30 percent | 120 | Covariate drift |
| 5000 to 6499 | mean 100, sd 20 | 35, 15, 50 percent | 120 | Back to normal |
| 6500 to 8999 | mean 100, sd 20 | 35, 15, 50 percent | 105 | Concept drift |

The model is a threshold on `amount`, fitted on the first 2000 events. Windows hold 500 events and move by 250. Labels arrive 500 events late.

```bash
python3 code/main.py
```

```console
  end    PSI   KS D   chi2 p    acc  levels (amount/channel/accuracy)  events
 3000  0.010  0.041  3.0e-01  0.932  ok/ok/ok
 3250  0.152  0.163  7.6e-06  0.924  drift/warn/ok
 3500  0.463  0.298  2.8e-26  0.936  drift/drift/ok                     ALERT amount
 3750  0.609  0.343  3.5e-35  0.942  drift/drift/ok                     ALERT channel
 ...
 5500  0.026  0.044  2.6e-01  0.898  ok/ok/ok                           resolved amount, resolved channel
 ...
 7250  0.040  0.048  7.1e-01  0.848  ok/ok/drift
 7500  0.022  0.039  6.1e-01  0.778  ok/ok/drift                        ALERT accuracy
```

Read the result in three parts:

- **Covariate drift.** Drift starts at event 3000, and the `amount` alert follows at 3500. Accuracy stays between 0.89 and 0.95, because the label rule did not change.
- **Recovery.** The inputs return to normal at 5000, and both alerts resolve at 5500.
- **Concept drift.** Drift starts at 6500, and the input monitors stay quiet because the inputs did not change. Accuracy falls from 0.946 to between 0.76 and 0.79. The accuracy alert comes at 7500, 1000 events after the change, and the label delay accounts for 500 of them.

## Use It

**scipy.** `scipy.stats` implements both tests. The statistics match the from-scratch code. scipy is not needed to run this lesson.

```python
from scipy import stats

result = stats.ks_2samp(reference_amounts, current_amounts)
print(result.statistic, result.pvalue)

table = [[1000, 700, 300], [140, 290, 70]]
chi2 = stats.chi2_contingency(table)
print(chi2.statistic, chi2.pvalue, chi2.dof)
```

We checked `ks_statistic` and `chi_square_test` against scipy 1.18.1 on random samples. The KS statistic, the chi-square statistic, and the chi-square p-value matched to floating-point precision. Over 200 random pairs of samples, the KS p-values differed from scipy's by up to 18 percent of scipy's value. The largest gaps were at very small p-values.

The gap comes from the method. Our code uses the limiting Kolmogorov distribution. By default, `ks_2samp` uses an exact method when both samples have at most 10,000 values. Its asymptotic mode uses a finite-sample distribution with the rounded effective sample size. With two categories, `chi2_contingency` applies Yates' continuity correction by default, so the statistics differ there.

**Monitoring libraries.** Several open-source libraries package these tests with reports and dashboards:

- **Evidently** picks a drift test per column. For a reference with 1000 rows or fewer, it uses the KS test for numeric columns and the chi-square test for categorical columns. For larger data, it uses the Wasserstein distance and the Jensen-Shannon divergence with a threshold of 0.1. PSI is one of the other methods that you can select.
- **NannyML** estimates model performance before labels arrive. Its Confidence-based Performance Estimation (CBPE) uses the model's predicted probabilities, which must be well calibrated. The NannyML documentation states that CBPE handles covariate shift but does not cope with concept drift. The demo stream shows why: only labels revealed the concept drift.
- **TensorFlow Data Validation** compares consecutive spans of data. It uses the L-infinity distance for categorical features and an approximate Jensen-Shannon divergence for numeric features. It also compares training data with serving data, which the feature store lesson covers.

The from-scratch code shows what every one of these tools computes. The tools add storage, scheduling, dashboards, and many more tests.

For LLM applications, the [LLM observability lesson](../../../17-infrastructure-and-production/13-llm-observability/docs/en.md) in the infrastructure phase covers tracing and evaluation tools. The ideas in this lesson still apply to the inputs and outputs of those systems.

## Ship It

This lesson produces `outputs/skill-drift-monitoring.md`. The skill plans the monitors for a new model and triages a drift alert. It asks which layer fired, which kind of drift fits the evidence, and whether the right action is to wait, recalibrate, collect labels, or retrain.

## Exercises

1. Run the stream with windows of 200 and 2000 events. Record the false warnings before event 3000 and the alert delay.
2. Set `n_tests=1`, `patience=1`, and `min_cramers_v=0`. Count the alerts in the clean period from 5000 to 6500.
3. Add a feature whose mean grows by 0.01 per 100 events. Find which signal, PSI or KS, reacts first.
4. Implement the Jensen-Shannon distance on the same decile bins. Compare it with PSI on every window.
5. Add a monitor for the model's positive-prediction rate. Explain why it stays quiet during the concept drift.

## Key Terms

| Term | What people say | What it means |
|------|----------------|----------------------|
| Data drift | "The data changed" | A change in the distribution of inputs, predictions, or labels compared with a reference window |
| Covariate drift | "New kinds of users" | `P(x)` changes while `P(y \| x)` stays the same |
| Prior drift | "More positives than before" | `P(y)` changes while `P(x \| y)` stays the same, also called label shift |
| Concept drift | "The rules of the game changed" | `P(y \| x)` changes, so the same input now has a different correct answer |
| Reference window | "The baseline data" | A fixed sample, often the training data, that every current window is compared with |
| PSI | "The stability score" | A symmetric sum over bins of (current share minus reference share) times the log of their ratio |
| KS statistic | "The KS test" | The largest gap between two empirical cumulative distribution functions |
| Cramér's V | "Effect size for categories" | The chi-square statistic scaled to the range 0 to 1 |
| Label delay | "Ground truth comes later" | The time between a prediction and the arrival of its true outcome |
| Alert fatigue | "Too many pages" | People ignore alerts because most of them were false alarms |

## Further Reading

- [Gama et al., A Survey on Concept Drift Adaptation (ACM Computing Surveys, 2014)](https://research.tue.nl/en/publications/a-survey-on-concept-drift-adaptation): real and virtual drift, drift patterns, and adaptation methods
- [Rabanser, Günnemann, and Lipton, Failing Loudly: An Empirical Study of Methods for Detecting Dataset Shift (NeurIPS 2019)](https://arxiv.org/abs/1810.11953): two-sample tests for shift detection
- [Lu et al., Learning under Concept Drift: A Review (2020)](https://arxiv.org/abs/2004.05785): drift detection, understanding, and adaptation methods
- [Yurdakul, Statistical Properties of Population Stability Index (Western Michigan University, 2018)](https://scholarworks.wmich.edu/dissertations/3208/): how PSI behaves with sample size and bin count
- [scipy.stats.ks_2samp documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ks_2samp.html): exact and asymptotic p-value methods for the two-sample KS test
- [Evidently, How data drift detection works](https://docs.evidentlyai.com/metrics/explainer_drift): default test selection by column type and data size
- [NannyML, Performance estimation](https://nannyml.readthedocs.io/en/stable/how_it_works/performance_estimation.html): CBPE and its assumptions
