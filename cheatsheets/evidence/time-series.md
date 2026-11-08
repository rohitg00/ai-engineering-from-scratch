# Evidence: cheatsheets/time-series.md

Abbreviations: L15 = phases/02-ml-fundamentals/15-time-series, L22 = phases/01-math-foundations/22-stochastic-processes, L16 = phases/02-ml-fundamentals/16-anomaly-detection. d = docs/en.md. TS = L15/code/time_series.py, ST = L22/code/stochastic.py.

## From series to honest forecast (architecture, 8 nodes, 7 edges)
- Raw series, plot it first: L15/d:418
- Stationarity check, rolling mean and std: L15/d:90, TS:36-58
- Differencing, at most two rounds: L15/d:92-98
- Lag features, t-1 or earlier: L15/d:123, 145
- walk_forward_split, train before test: L15/d:262-273, TS:89
- Model Ridge, SimpleAR, ARIMA: L15/d:280, 344, 354
- Baselines persistence, seasonal naive: L15/d:408-414
- Score MAE, RMSE, MAPE: L15/d:389-391

## Walk-forward validation (flow, 6 steps)
1. train up to t: L15/d:181
2. predict t+1 or t+1 to t+k: L15/d:182
3. slide the window: L15/d:183
4. repeat, test after training: L15/d:184-186
5. expanding window, old data relevant: L15/d:188
6. sliding window, old data hurts: L15/d:188

## Tasks in code (task-table, 8)
- difference(series, order=1): TS:29
- check_stationarity(series, window=50) returns rolling stats and is_stationary: TS:36, 57
- autocorrelation(series, max_lag=20): TS:60
- make_lag_features(series, n_lags): TS:75
- walk_forward_split(n_samples, n_splits=5, min_train=50): TS:89
- SimpleAR(n_lags=5) and fit_series(series): TS:106-107, 122
- forecast(last_values, n_steps), recursive: TS:126-140
- mape(y_true, y_pred), mask zeros: TS:151-153

## Library versions (annotated-code, 11 lines)
- make_lag_features(series, n_lags=10) with walk_forward_split and Ridge(alpha=1.0): L15/d:341-346
- ARIMA(train_series, order=(5, 1, 2)), fitted = model.fit(), fitted.forecast(steps=30): L15/d:354-356
- TimeSeriesSplit(n_splits=5): L15/d:368
- cross_val_score with cv=TimeSeriesSplit(n_splits=5): L15/d:381

## Core definitions (concepts, 8)
- trend, seasonality, residual, white noise: L15/d:80-82
- stationary definition: L15/d:86, 446
- differencing formula: L15/d:94-96
- ACF and lags until negligible: L15/d:112, 117
- PACF: L15/d:449
- ARIMA(p, d, q): L15/d:194-198
- MAE, RMSE, MAPE: L15/d:389-391
- target alignment trap: L15/d:145

## Pick an approach (command-table, 7)
- Lag features + ML, external features, gradient boosting start: L15/d:206, 212
- ARIMA univariate short-term, SARIMA: L15/d:207
- Exponential smoothing, Holt-Winters: L15/d:208
- Neural networks, long sequences, many series: L15/d:210
- Recursive, 1-5 steps: L15/d:218, 224
- Direct, longer horizons: L15/d:220, 224
- Multi-output: L15/d:222

## Defaults and numbers (defaults, 8)
- window 50: TS:36
- mean shift 0.5 std: TS:55, L15/d:317
- variance ratio 2.0: TS:55, L15/d:317
- ADF p-value 0.05: L15/d:108
- max_lag 20: TS:60
- n_splits 5, min_train=50: TS:89
- rolling windows 7 and 14: L15/d:396
- lag 7, possibly 14: L15/d:143

## Mistakes and fixes (troubleshooting, 8)
- random split lower MSE, future leakage: TS:284-285, L15/d:230
- future features, audit alignment: L15/d:231
- hold out full seasonal cycle: L15/d:232, 422
- scale changes, percentage change: L15/d:233
- too many lags, use ACF: L15/d:234
- linear models need stationarity, difference first: L15/d:235, 420
- loses to seasonal naive is a bug: L15/d:414
- errors rise, retrain on recent data: L15/d:424

## Stochastic processes in code (annotated-code, 9 lines)
- random_walk_1d(n_steps, seed=None): ST:4, sqrt(n): L22/d:43
- MarkovChain(P, state_names=names): ST:143, rows sum to 1: L22/d:80
- mc.stationary_distribution(): ST:145, left eigenvector: L22/d:297
- mc.simulate(start_state=0, n_steps=100000, seed=42): ST:150
- langevin_dynamics(grad_U, x0, dt, temperature, n_steps): ST:65, L22/d:448
- metropolis_hastings call with proposal_std=2.0, n_samples=100000, seed=42: ST:207-213
- samples[10000:, 0], burn-in: ST:215, L22/d:215

## Random walks and Markov chains (concepts, 8)
- mean 0, std sqrt(n), 10000 steps about 100: L22/d:41-51
- Markov property: L22/d:68
- pi P = pi, [0.55, 0.18, 0.27]: L22/d:92-94
- irreducible and aperiodic: L22/d:116-118
- spectral gap 0.2 about 5 steps: L22/d:124, 388
- Brownian step: L22/d:152-154
- Langevin update: L22/d:162-164
- MH min(1, a), about 23%: L22/d:205, 218

## Anomalies in time (tips, 5)
- contextual anomaly, 90 degrees summer vs winter, time features: L16/d:34, 37
- collective anomalies, sequence-aware, fifty failed logins: L16/d:35, 37
- rolling statistics, ratios, time-since-last-event: L16/d:402
- 30 days history buffer: L16/d:426
- score distribution monitoring, threshold drift: L16/d:399, 427

## Questions (qa, 6)
- not independent, random splits leak: L15/d:23, 149
- at most two rounds: L15/d:98
- ACF lag 12 yearly seasonality: L15/d:116, 143
- trees handle trends, linear needs stationarity: L15/d:235
- log space then exponentiate: L15/d:428
- baselines last value, seasonal naive, moving average: L15/d:410-412
