import numpy as np
import warnings
warnings.filterwarnings("ignore")


def true_function(x):
    return np.sin(1.5 * x) + 0.5 * x


def generate_data(n_samples=30, noise_std=0.5, x_range=(-3, 3), seed=None):
    rng = np.random.RandomState(seed)
    x = rng.uniform(x_range[0], x_range[1], n_samples)
    y = true_function(x) + rng.normal(0, noise_std, n_samples)
    return x, y


def fit_polynomial(x_train, y_train, degree, lam=0.0):
    X = np.column_stack([x_train ** d for d in range(degree + 1)])
    if lam > 0:
        penalty = lam * np.eye(X.shape[1])
        penalty[0, 0] = 0
        w = np.linalg.solve(X.T @ X + penalty, X.T @ y_train)
    else:
        w = np.linalg.lstsq(X, y_train, rcond=None)[0]
    return w


def predict_polynomial(x, w):
    degree = len(w) - 1
    X = np.column_stack([x ** d for d in range(degree + 1)])
    return X @ w


def bias_variance_decomposition(
    degrees,
    n_bootstrap=200,
    n_train=30,
    noise_std=0.5,
    n_test=100,
    lam=0.0,
):
    rng = np.random.RandomState(42)
    x_test = np.linspace(-2.5, 2.5, n_test)
    y_true = true_function(x_test)

    results = {}

    for degree in degrees:
        predictions = np.zeros((n_bootstrap, n_test))

        for b in range(n_bootstrap):
            x_train, y_train = generate_data(
                n_samples=n_train, noise_std=noise_std, seed=rng.randint(0, 100000)
            )
            w = fit_polynomial(x_train, y_train, degree, lam=lam)
            predictions[b] = predict_polynomial(x_test, w)

        mean_pred = predictions.mean(axis=0)
        bias_sq = np.mean((mean_pred - y_true) ** 2)
        variance = np.mean(predictions.var(axis=0))
        total_error = np.mean(np.mean((predictions - y_true) ** 2, axis=1))

        results[degree] = {
            "bias_sq": bias_sq,
            "variance": variance,
            "total_error": total_error,
            "noise": noise_std ** 2,
        }

    return results


def print_decomposition(results):
    print(f"{'Degree':>6}  {'Bias^2':>10}  {'Variance':>10}  {'Noise':>10}  {'Total':>10}  {'B+V+N':>10}")
    print("-" * 70)
    for degree, r in sorted(results.items()):
        bvn = r["bias_sq"] + r["variance"] + r["noise"]
        print(
            f"{degree:>6d}  {r['bias_sq']:>10.4f}  {r['variance']:>10.4f}  "
            f"{r['noise']:>10.4f}  {r['total_error']:>10.4f}  {bvn:>10.4f}"
        )


def find_optimal(results):
    best_degree = min(results, key=lambda d: results[d]["total_error"])
    return best_degree


def demo_basic_decomposition():
    print("=" * 70)
    print("BIAS-VARIANCE DECOMPOSITION")
    print("True function: sin(1.5x) + 0.5x")
    print("Noise std: 0.5, Training samples: 30, Bootstrap rounds: 200")
    print("=" * 70)
    print()

    degrees = [1, 2, 3, 5, 7, 10, 15]
    results = bias_variance_decomposition(degrees)
    print_decomposition(results)

    best = find_optimal(results)
    print(f"\nOptimal degree: {best}")
    print(f"  Bias^2:   {results[best]['bias_sq']:.4f}")
    print(f"  Variance: {results[best]['variance']:.4f}")
    print(f"  Total:    {results[best]['total_error']:.4f}")


def demo_complexity_tradeoff():
    print()
    print("=" * 70)
    print("MODEL COMPLEXITY TRADEOFF")
    print("Sweeping polynomial degree from 1 to 15")
    print("=" * 70)
    print()

    degrees = list(range(1, 16))
    results = bias_variance_decomposition(degrees)

    print(f"{'Degree':>6}  {'Bias^2':>10}  {'Variance':>10}  {'Total':>10}  {'Dominant':>12}")
    print("-" * 60)
    for degree in degrees:
        r = results[degree]
        dominant = "BIAS" if r["bias_sq"] > r["variance"] else "VARIANCE"
        print(
            f"{degree:>6d}  {r['bias_sq']:>10.4f}  {r['variance']:>10.4f}  "
            f"{r['total_error']:>10.4f}  {dominant:>12}"
        )

    crossover = None
    for d in degrees[:-1]:
        if results[d]["bias_sq"] > results[d]["variance"]:
            if results[d + 1]["bias_sq"] <= results[d + 1]["variance"]:
                crossover = d + 1
                break

    if crossover:
        print(f"\nBias-variance crossover at degree {crossover}")
        print("Below this: bias dominates (underfitting)")
        print("Above this: variance dominates (overfitting)")


def demo_regularization_effect():
    print()
    print("=" * 70)
    print("REGULARIZATION EFFECT (L2 / Ridge)")
    print("Fixed degree=10, sweeping lambda")
    print("=" * 70)
    print()

    lambdas = [0.0, 0.001, 0.01, 0.1, 1.0, 10.0, 100.0]

    print(f"{'Lambda':>10}  {'Bias^2':>10}  {'Variance':>10}  {'Total':>10}")
    print("-" * 50)

    for lam in lambdas:
        results = bias_variance_decomposition([10], lam=lam)
        r = results[10]
        print(f"{lam:>10.3f}  {r['bias_sq']:>10.4f}  {r['variance']:>10.4f}  {r['total_error']:>10.4f}")

    print()
    print("As lambda increases:")
    print("  - Variance decreases (model is more constrained)")
    print("  - Bias increases (model is forced to be simpler)")
    print("  - Optimal lambda balances these two effects")


def demo_data_size_effect():
    print()
    print("=" * 70)
    print("TRAINING SET SIZE EFFECT")
    print("Fixed degree=5, varying n_train")
    print("=" * 70)
    print()

    sizes = [10, 20, 50, 100, 200, 500]

    print(f"{'N_train':>8}  {'Bias^2':>10}  {'Variance':>10}  {'Total':>10}")
    print("-" * 50)

    for n in sizes:
        results = bias_variance_decomposition([5], n_train=n)
        r = results[5]
        print(f"{n:>8d}  {r['bias_sq']:>10.4f}  {r['variance']:>10.4f}  {r['total_error']:>10.4f}")

    print()
    print("More data reduces variance but does not affect bias.")
    print("If your problem is high bias, more data will not help.")


def demo_diagnosis():
    print()
    print("=" * 70)
    print("UNDERFITTING vs OVERFITTING DIAGNOSIS")
    print("=" * 70)
    print()

    rng = np.random.RandomState(42)
    x_train, y_train = generate_data(n_samples=30, seed=42)
    x_test, y_test = generate_data(n_samples=100, seed=99)

    cases = [
        (1, "Linear (degree 1)"),
        (4, "Polynomial (degree 4)"),
        (15, "Polynomial (degree 15)"),
    ]

    for degree, name in cases:
        w = fit_polynomial(x_train, y_train, degree)
        train_pred = predict_polynomial(x_train, w)
        test_pred = predict_polynomial(x_test, w)

        train_mse = np.mean((train_pred - y_train) ** 2)
        test_mse = np.mean((test_pred - y_test) ** 2)
        gap = test_mse - train_mse

        if train_mse > 0.5 and test_mse > 0.5 and gap < train_mse * 0.5:
            diagnosis = "HIGH BIAS (underfitting)"
        elif gap > train_mse * 2:
            diagnosis = "HIGH VARIANCE (overfitting)"
        else:
            diagnosis = "REASONABLE FIT"

        print(f"{name}:")
        print(f"  Train MSE: {train_mse:.4f}")
        print(f"  Test MSE:  {test_mse:.4f}")
        print(f"  Gap:       {gap:.4f}")
        print(f"  Diagnosis: {diagnosis}")
        print()


def demo_learning_curves():
    print()
    print("=" * 70)
    print("LEARNING CURVES")
    print("Train vs test error as training set size grows")
    print("=" * 70)
    print()

    rng = np.random.RandomState(42)
    x_test = np.linspace(-2.5, 2.5, 200)
    y_test = true_function(x_test)

    sizes = [10, 15, 20, 30, 50, 75, 100, 150, 200, 300]

    for degree, label in [(1, "Degree 1 (high bias)"), (5, "Degree 5 (balanced)"), (12, "Degree 12 (high variance)")]:
        print(f"  {label}:")
        print(f"  {'N_train':>8}  {'Train MSE':>10}  {'Test MSE':>10}  {'Gap':>10}")
        print(f"  {'-' * 48}")

        for n in sizes:
            train_errors = []
            test_errors = []
            for seed in range(50):
                x_train, y_train = generate_data(n_samples=n, seed=rng.randint(0, 100000))
                try:
                    w = fit_polynomial(x_train, y_train, degree)
                    train_pred = predict_polynomial(x_train, w)
                    test_pred = predict_polynomial(x_test, w)
                    train_mse = np.mean((train_pred - y_train) ** 2)
                    test_mse = np.mean((test_pred - y_test) ** 2)
                    train_errors.append(train_mse)
                    test_errors.append(test_mse)
                except (np.linalg.LinAlgError, ValueError):
                    continue

            if train_errors:
                avg_train = np.mean(train_errors)
                avg_test = np.mean(test_errors)
                gap = avg_test - avg_train
                print(f"  {n:>8d}  {avg_train:>10.4f}  {avg_test:>10.4f}  {gap:>10.4f}")

        print()

    print("High bias (degree 1): both curves converge to HIGH error. Gap stays small.")
    print("High variance (degree 12): train error stays low, test error stays high.")
    print("More data reduces variance but cannot fix bias.")


def demo_regularization_sweep():
    print()
    print("=" * 70)
    print("REGULARIZATION SWEEP (Ridge alpha vs Bias/Variance)")
    print("Fixed degree=15, sweeping alpha from 0.001 to 100")
    print("=" * 70)
    print()

    alphas = [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0, 50.0, 100.0]

    print(f"  {'Alpha':>10}  {'Bias^2':>10}  {'Variance':>10}  {'Total':>10}  {'Dominant':>12}")
    print(f"  {'-' * 60}")

    best_alpha = None
    best_total = float("inf")

    for alpha in alphas:
        results = bias_variance_decomposition([15], lam=alpha, n_bootstrap=200)
        r = results[15]
        dominant = "BIAS" if r["bias_sq"] > r["variance"] else "VARIANCE"
        print(
            f"  {alpha:>10.3f}  {r['bias_sq']:>10.4f}  {r['variance']:>10.4f}  "
            f"{r['total_error']:>10.4f}  {dominant:>12}"
        )
        if r["total_error"] < best_total:
            best_total = r["total_error"]
            best_alpha = alpha

    print()
    print(f"Optimal alpha: {best_alpha}")
    print(f"  Total error at optimal: {best_total:.4f}")
    print()
    print("Small alpha: variance dominates (model is unconstrained, fits noise)")
    print("Large alpha: bias dominates (model is over-constrained, misses signal)")
    print("Optimal alpha balances both, sitting at the bottom of the U-curve.")


if __name__ == "__main__":
    demo_basic_decomposition()
    demo_complexity_tradeoff()
    demo_regularization_effect()
    demo_data_size_effect()
    demo_diagnosis()
    demo_learning_curves()
    demo_regularization_sweep()
    print("All bias-variance demos complete.")
