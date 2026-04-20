import numpy as np


def make_synthetic_series(n=500, seed=42):
    rng = np.random.RandomState(seed)
    t = np.arange(n, dtype=float)

    trend = 0.05 * t
    seasonality = 10 * np.sin(2 * np.pi * t / 30)
    noise = rng.normal(0, 2, n)
    series = 50 + trend + seasonality + noise

    return series


def make_seasonal_series(n=365, period=7, seed=42):
    rng = np.random.RandomState(seed)
    t = np.arange(n, dtype=float)

    trend = 0.02 * t
    weekly = 5 * np.sin(2 * np.pi * t / period)
    monthly = 3 * np.sin(2 * np.pi * t / 30)
    noise = rng.normal(0, 1.5, n)
    series = 100 + trend + weekly + monthly + noise

    return series


def difference(series, order=1):
    result = series.copy()
    for _ in range(order):
        result = result[1:] - result[:-1]
    return result


def check_stationarity(series, window=50):
    n = len(series)
    rolling_mean = np.zeros(n)
    rolling_std = np.zeros(n)

    for i in range(n):
        start = max(0, i - window + 1)
        segment = series[start:i + 1]
        rolling_mean[i] = segment.mean()
        rolling_std[i] = segment.std() if len(segment) > 1 else 0.0

    first_half_mean = series[:n // 2].mean()
    second_half_mean = series[n // 2:].mean()
    first_half_var = series[:n // 2].var()
    second_half_var = series[n // 2:].var()

    mean_shift = abs(first_half_mean - second_half_mean)
    var_ratio = max(first_half_var, second_half_var) / max(min(first_half_var, second_half_var), 1e-10)

    is_stationary = mean_shift < 0.5 * series.std() and var_ratio < 2.0

    return rolling_mean, rolling_std, is_stationary


def autocorrelation(series, max_lag=20):
    n = len(series)
    mean = series.mean()
    var = series.var()
    acf = np.zeros(max_lag + 1)

    for k in range(max_lag + 1):
        if k >= n:
            break
        cov = np.mean((series[:n - k] - mean) * (series[k:] - mean)) if k < n else 0
        acf[k] = cov / var if var > 0 else 0.0

    return acf


def make_lag_features(series, n_lags):
    n = len(series)
    X = np.full((n, n_lags), np.nan)

    for lag in range(1, n_lags + 1):
        X[lag:, lag - 1] = series[:-lag]

    valid_mask = ~np.isnan(X).any(axis=1)
    X_valid = X[valid_mask]
    y_valid = series[valid_mask]

    return X_valid, y_valid


def walk_forward_split(n_samples, n_splits=5, min_train=50):
    if n_samples <= min_train:
        return

    step = max(1, (n_samples - min_train) // n_splits)

    for i in range(n_splits):
        train_end = min_train + i * step
        test_start = train_end
        test_end = min(train_end + step, n_samples)

        if test_start >= n_samples:
            break

        yield slice(0, train_end), slice(test_start, test_end)


class SimpleAR:
    def __init__(self, n_lags=5):
        self.n_lags = n_lags
        self.weights = None
        self.bias = None

    def fit(self, X, y):
        X_b = np.column_stack([np.ones(len(X)), X])
        theta = np.linalg.lstsq(X_b, y, rcond=None)[0]
        self.bias = theta[0]
        self.weights = theta[1:]
        return self

    def predict(self, X):
        return X @ self.weights + self.bias

    def fit_series(self, series):
        X, y = make_lag_features(series, self.n_lags)
        return self.fit(X, y)

    def forecast(self, last_values, n_steps):
        if len(last_values) < self.n_lags:
            raise ValueError(
                f"Need at least {self.n_lags} history points, got {len(last_values)}"
            )
        history = list(last_values[-self.n_lags:])
        predictions = []

        for _ in range(n_steps):
            features = np.array(history[-self.n_lags:]).reshape(1, -1)
            pred = self.predict(features)[0]
            predictions.append(pred)
            history.append(pred)

        return np.array(predictions)


def mse(y_true, y_pred):
    return np.mean((y_true - y_pred) ** 2)


def mae(y_true, y_pred):
    return np.mean(np.abs(y_true - y_pred))


def mape(y_true, y_pred):
    mask = y_true != 0
    return np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100


def print_separator(title):
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}\n")


def demo_stationarity():
    print_separator("STATIONARITY CHECK")

    series = make_synthetic_series(n=300, seed=42)
    _, _, is_stat = check_stationarity(series)
    print(f"Original series (trend + seasonality):")
    print(f"  Mean: {series.mean():.2f}, Std: {series.std():.2f}")
    print(f"  Stationary: {is_stat}")

    diff1 = difference(series, order=1)
    _, _, is_stat1 = check_stationarity(diff1)
    print(f"\nAfter first differencing:")
    print(f"  Mean: {diff1.mean():.4f}, Std: {diff1.std():.2f}")
    print(f"  Stationary: {is_stat1}")


def demo_autocorrelation():
    print_separator("AUTOCORRELATION ANALYSIS")

    series = make_seasonal_series(n=365, period=7, seed=42)
    diff_series = difference(series, order=1)
    acf = autocorrelation(diff_series, max_lag=30)

    print("ACF of differenced series (first 15 lags):")
    print(f"{'Lag':>5} {'ACF':>8} {'Significance':>14}")
    print(f"{'-' * 28}")
    threshold = 1.96 / np.sqrt(len(diff_series))
    for k in range(15):
        sig = "***" if abs(acf[k]) > threshold else ""
        bar = "#" * int(abs(acf[k]) * 30)
        print(f"{k:>5} {acf[k]:>8.4f} {sig:>4} {bar}")

    print(f"\nSignificance threshold (95%): +/-{threshold:.4f}")
    print(f"Lags 7 and 14 should show spikes (weekly seasonality)")


def demo_lag_features():
    print_separator("LAG FEATURES AND AR MODEL")

    series = make_synthetic_series(n=400, seed=42)
    n_lags = 10

    X, y = make_lag_features(series, n_lags)
    print(f"Series length: {len(series)}")
    print(f"Feature matrix: {X.shape} (samples x lag features)")
    print(f"Target vector: {y.shape}")

    print(f"\nFirst 3 samples:")
    for i in range(3):
        lags_str = ", ".join(f"{v:.1f}" for v in X[i, :5])
        print(f"  Lags: [{lags_str}, ...] -> Target: {y[i]:.1f}")

    ar = SimpleAR(n_lags=n_lags)
    ar.fit(X, y)

    print(f"\nAR({n_lags}) weights:")
    for i, w in enumerate(ar.weights):
        print(f"  Lag {i+1}: {w:+.4f}")
    print(f"  Bias:  {ar.bias:+.4f}")


def demo_walk_forward():
    print_separator("WALK-FORWARD VALIDATION")

    series = make_synthetic_series(n=400, seed=42)
    n_lags = 10
    X, y = make_lag_features(series, n_lags)

    n_splits = 5
    fold_scores = []

    print(f"Walk-forward with {n_splits} splits:")
    print(f"{'Fold':>6} {'Train':>10} {'Test':>10} {'MSE':>10} {'MAE':>10}")
    print(f"{'-' * 48}")

    for fold, (train_sl, test_sl) in enumerate(walk_forward_split(len(X), n_splits=n_splits, min_train=100)):
        X_train, y_train = X[train_sl], y[train_sl]
        X_test, y_test = X[test_sl], y[test_sl]

        ar = SimpleAR(n_lags=n_lags)
        ar.fit(X_train, y_train)
        y_pred = ar.predict(X_test)

        fold_mse = mse(y_test, y_pred)
        fold_mae = mae(y_test, y_pred)
        fold_scores.append(fold_mse)

        print(f"{fold+1:>6} {X_train.shape[0]:>10} {X_test.shape[0]:>10} {fold_mse:>10.4f} {fold_mae:>10.4f}")

    print(f"\nMean MSE: {np.mean(fold_scores):.4f}")
    print(f"Std MSE:  {np.std(fold_scores):.4f}")


def demo_random_vs_walk_forward():
    print_separator("RANDOM SPLIT vs WALK-FORWARD")

    series = make_synthetic_series(n=500, seed=42)
    n_lags = 10
    X, y = make_lag_features(series, n_lags)

    rng = np.random.RandomState(42)
    idx = rng.permutation(len(X))
    split = int(len(X) * 0.8)
    train_idx, test_idx = idx[:split], idx[split:]

    ar_random = SimpleAR(n_lags=n_lags)
    ar_random.fit(X[train_idx], y[train_idx])
    random_mse = mse(y[test_idx], ar_random.predict(X[test_idx]))

    wf_scores = []
    for train_sl, test_sl in walk_forward_split(len(X), n_splits=5, min_train=100):
        ar_wf = SimpleAR(n_lags=n_lags)
        ar_wf.fit(X[train_sl], y[train_sl])
        y_pred = ar_wf.predict(X[test_sl])
        wf_scores.append(mse(y[test_sl], y_pred))

    wf_mse = np.mean(wf_scores)

    print(f"Random 80/20 split MSE:  {random_mse:.4f}")
    print(f"Walk-forward mean MSE:   {wf_mse:.4f}")
    print(f"Ratio (random/wf):       {random_mse / wf_mse:.4f}")
    print()
    if random_mse < wf_mse:
        print("Random split gives lower MSE -- this is the optimistic bias from future leakage.")
        print("The walk-forward score is the honest estimate of production performance.")
    else:
        print("Walk-forward gives similar or lower MSE -- the series may be stationary enough")
        print("that future leakage is not a major factor here.")


def demo_lag_comparison():
    print_separator("LAG COUNT COMPARISON")

    series = make_seasonal_series(n=365, period=7, seed=42)

    print(f"{'n_lags':>8} {'Mean MSE':>12} {'Mean MAE':>12}")
    print(f"{'-' * 34}")

    for n_lags in [1, 3, 5, 7, 10, 14, 21, 30]:
        X, y = make_lag_features(series, n_lags)

        scores_mse = []
        scores_mae = []

        for train_sl, test_sl in walk_forward_split(len(X), n_splits=5, min_train=max(60, n_lags + 20)):
            ar = SimpleAR(n_lags=n_lags)
            ar.fit(X[train_sl], y[train_sl])
            y_pred = ar.predict(X[test_sl])
            scores_mse.append(mse(y[test_sl], y_pred))
            scores_mae.append(mae(y[test_sl], y_pred))

        if scores_mse:
            print(f"{n_lags:>8} {np.mean(scores_mse):>12.4f} {np.mean(scores_mae):>12.4f}")


def demo_forecasting():
    print_separator("MULTI-STEP FORECASTING")

    series = make_synthetic_series(n=300, seed=42)
    train_series = series[:250]
    true_future = series[250:270]

    n_lags = 10
    ar = SimpleAR(n_lags=n_lags)
    X, y = make_lag_features(train_series, n_lags)
    ar.fit(X, y)

    forecast = ar.forecast(train_series, n_steps=20)

    print(f"Training on {len(train_series)} points, forecasting {len(true_future)} steps ahead")
    print()
    print(f"{'Step':>6} {'True':>10} {'Predicted':>10} {'Error':>10}")
    print(f"{'-' * 38}")

    for i in range(len(true_future)):
        error = true_future[i] - forecast[i]
        print(f"{i+1:>6} {true_future[i]:>10.2f} {forecast[i]:>10.2f} {error:>+10.2f}")

    print(f"\nForecast MSE:  {mse(true_future, forecast):.4f}")
    print(f"Forecast MAE:  {mae(true_future, forecast):.4f}")
    print(f"Forecast MAPE: {mape(true_future, forecast):.2f}%")


if __name__ == "__main__":
    demo_stationarity()
    demo_autocorrelation()
    demo_lag_features()
    demo_walk_forward()
    demo_random_vs_walk_forward()
    demo_lag_comparison()
    demo_forecasting()
