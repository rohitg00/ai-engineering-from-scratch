---
id: time-series
title: Time Series Fundamentals
code: TS
subtitle: Check stationarity, build lag features, validate walk-forward, beat naive baselines. Random walks and Markov chains.
hue: 170
sources: phases/02-ml-fundamentals/15-time-series, phases/01-math-foundations/22-stochastic-processes, phases/02-ml-fundamentals/16-anomaly-detection
source_hash: 32f26254a2e7a0f0
---

## From series to honest forecast
type: architecture
from: phases/02-ml-fundamentals/15-time-series/docs/en.md, phases/02-ml-fundamentals/15-time-series/code/time_series.py

```arch
node | raw | 1,1 | Raw series | plot it first
node | stat | 2,1 | Stationarity check | rolling mean and std
node | diff | 3,1 | Differencing | at most two rounds
node | lags | 4,1 | Lag features | values at t-1 or earlier
node | wf | 4,2 | walk_forward_split | train before test
node | model | 3,2 | Model | Ridge, SimpleAR, ARIMA
node | base | 2,2 | Baselines | persistence, seasonal naive
node | score | 1,2 | Score | MAE, RMSE, MAPE
edge | raw | stat |
edge | stat | diff | drifts
edge | diff | lags |
edge | lags | wf |
edge | wf | model | folds
edge | model | base | must beat
edge | base | score |
```

## Walk-forward validation
type: flow
from: phases/02-ml-fundamentals/15-time-series/docs/en.md

1. **Train**: fit on data up to time t.
2. **Predict**: forecast t+1, or t+1 to t+k for multi-step.
3. **Slide**: move the window forward.
4. **Repeat**: each test fold comes after all its training data.
5. **Expanding window**: training set grows. Use it when old data stays relevant.
6. **Sliding window**: fixed size. Use it when the world changes and old data hurts.

## Tasks in code
type: task-table
from: phases/02-ml-fundamentals/15-time-series/code/time_series.py

| Task | Code |
|---|---|
| Remove a trend | `difference(series, order=1)` |
| Rolling stats and a verdict | `check_stationarity(series, window=50)` |
| ACF up to a lag | `autocorrelation(series, max_lag=20)` |
| Series to X and y | `make_lag_features(series, n_lags)` |
| Time-ordered folds | `walk_forward_split(n_samples, n_splits=5, min_train=50)` |
| AR on lag features | `SimpleAR(n_lags=5).fit_series(series)` |
| Recursive multi-step | `forecast(last_values, n_steps)` |
| Percent error, skips zeros | `mape(y_true, y_pred)` |

## Library versions
type: annotated-code
lang: python
from: phases/02-ml-fundamentals/15-time-series/docs/en.md

```python
X, y = make_lag_features(series, n_lags=10)
for train_idx, test_idx in walk_forward_split(len(X)):
    model = Ridge(alpha=1.0)
    model.fit(X[train_idx], y[train_idx])
    predictions = model.predict(X[test_idx])
model = ARIMA(train_series, order=(5, 1, 2))      # p, d, q
fitted = model.fit()
forecast = fitted.forecast(steps=30)            # 30 steps ahead
tscv = TimeSeriesSplit(n_splits=5)                # sklearn walk-forward
scores = cross_val_score(model, X, y, cv=TimeSeriesSplit(n_splits=5))
```

## Core definitions
type: concepts
from: phases/02-ml-fundamentals/15-time-series/docs/en.md

- **Components**: trend, seasonality and residual. A white-noise residual means the split worked.
- **Stationary**: mean, variance and autocorrelation do not change over time.
- **Differencing**: $\text{diff}[t] = \text{value}[t] - \text{value}[t-1]$
- **ACF**: correlation of the series with a lagged copy. Use lags up to where it is negligible.
- **PACF**: autocorrelation at lag k after the effect of shorter lags is removed.
- **ARIMA(p, d, q)**: p past values, d rounds of differencing, q past errors.
- **MAE / RMSE / MAPE**: mean absolute error, squared error root, percent error.
- **Target alignment**: target at t. Every feature uses t-1 or earlier.

## Pick an approach
type: command-table
from: phases/02-ml-fundamentals/15-time-series/docs/en.md

| Command | What it does |
|---|---|
| Lag features + ML | Many external features. Strongest start with boosting |
| ARIMA | One univariate series, short term. SARIMA for seasons |
| Exponential smoothing | Simple trend + seasonality with Holt-Winters |
| Neural networks | Long sequences, many series |
| Recursive forecast | Feeds predictions back. Use for 1-5 steps |
| Direct forecast | One model per horizon. Use for long horizons |
| Multi-output | One model outputs all horizons |

## Defaults and numbers
type: defaults
from: phases/02-ml-fundamentals/15-time-series/docs/en.md, phases/02-ml-fundamentals/15-time-series/code/time_series.py

| Setting | Default | Note |
|---|---|---|
| `check_stationarity` window | 50 | Rolling window size |
| Mean shift limit | 0.5 | Times the series std, half against half |
| Variance ratio limit | 2.0 | Above it, flagged non-stationary |
| ADF p-value | 0.05 | Below it, reject non-stationary |
| `max_lag` | 20 | Autocorrelation default |
| `n_splits`, `min_train` | 5 | min_train=50 rows before the first test |
| Rolling windows | 7 and 14 | Mean, std, min, max in days |
| Weekly seasonality | lag 7 | Possibly 14 too |

## Mistakes and fixes
type: troubleshooting
from: phases/02-ml-fundamentals/15-time-series/docs/en.md, phases/02-ml-fundamentals/15-time-series/code/time_series.py

| Symptom | Cause | Fix |
|---|---|---|
| Random split MSE lower | Future leakage | Walk-forward or temporal split |
| Near-perfect backtest | Feature at time t included | Audit every feature alignment |
| Misses the seasonal pattern | Test set shorter than one cycle | Hold out a full seasonal cycle |
| Revenue doubles, model lags | Absolute scale changed | Model percentage change |
| Overfit with many lags | "More history is better" | Pick lags from the ACF |
| Linear model drifts | Trend not removed | Difference first, model second |
| Loses to seasonal naive | Leakage, wrong eval, or random series | Fix the bug before tuning |
| Errors rise in production | World changed | Retrain on recent data |

## Stochastic processes in code
type: annotated-code
lang: python
from: phases/01-math-foundations/22-stochastic-processes/code/stochastic.py, phases/01-math-foundations/22-stochastic-processes/docs/en.md

```python
positions = random_walk_1d(n_steps, seed=None)    # std grows as sqrt(n)
mc = MarkovChain(P, state_names=names)            # rows of P sum to 1
pi = mc.stationary_distribution()                 # left eigenvector, eigenvalue 1
states = mc.simulate(start_state=0, n_steps=100000, seed=42)
traj = langevin_dynamics(grad_U, x0, dt, temperature, n_steps)
samples, acc_rate = metropolis_hastings(
    target_log_prob=bimodal_log_prob,
    proposal_std=2.0, x0=np.array([0.0]), n_samples=100000, seed=42)
samples_flat = samples[10000:, 0]                 # burn-in discarded
```

## Random walks and Markov chains
type: concepts
from: phases/01-math-foundations/22-stochastic-processes/docs/en.md

- **Random walk**: mean 0, standard deviation $\sqrt{n}$. 10000 steps gives about 100.
- **Markov property**: the next state depends only on the current state.
- **Stationary distribution**: $\pi P = \pi$. Weather chain gives [0.55, 0.18, 0.27].
- **Convergence**: needs an irreducible and aperiodic chain.
- **Spectral gap**: 1 minus the second eigenvalue. A gap of 0.2 mixes in about 5 steps.
- **Brownian step**: $B(t + dt) = B(t) + \sqrt{dt} \, z$
- **Langevin**: $x_{t+1} = x_t - dt \, \nabla U(x_t) + \sqrt{2 T \, dt} \, z_t$
- **Metropolis-Hastings**: accept with $\min(1, a)$. Aim for about 23% acceptance.

## Anomalies in time
type: tips
from: phases/02-ml-fundamentals/16-anomaly-detection/docs/en.md

- 90 degrees is normal in summer and anomalous in winter. Contextual anomalies need time features.
- Collective anomalies need sequence-aware methods. Fifty failed logins in a row is an attack.
- Add rolling statistics, ratios and time-since-last-event features.
- Rolling statistics over 30 days need 30 days of buffered history at scoring time.
- Track the anomaly score distribution. A fixed threshold drifts out of date.

## Questions
type: qa
from: phases/02-ml-fundamentals/15-time-series/docs/en.md

- **Why not k-fold?** Samples are not independent. Random folds leak the future into training.
- **How many differences?** Most real series need at most two rounds.
- **How many lags?** Use the ACF. Spikes at lag 12 on monthly data mean yearly seasonality.
- **Do trees need differencing?** Tree models handle trends. Linear models need stationarity.
- **Skewed revenue?** Forecast in log space, then exponentiate.
- **Which baseline first?** Last value, then seasonal naive, then moving average.
