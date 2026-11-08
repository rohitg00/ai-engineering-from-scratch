import numpy as np

from support import DEGREES, N_ROUNDS, N_TRAIN, NOISE_STD, X_TEST, fit_polynomial, generate_data, predict_polynomial, true_function


def decompose(predictions, y_true):
    mean_pred = predictions.mean(axis=0)
    bias_sq = float(np.mean((mean_pred - y_true) ** 2))
    variance = float(np.mean(predictions.var(axis=0)))
    return bias_sq, variance


def expected_test_error(predictions, y_true, noise_std):
    return float(np.mean((predictions - y_true) ** 2) + noise_std ** 2)


def sweep_degrees(degrees, n_rounds=N_ROUNDS, n_train=N_TRAIN, noise_std=NOISE_STD, seed=0):
    y_true = true_function(X_TEST)
    results = {}
    for degree in degrees:
        predictions = np.zeros((n_rounds, X_TEST.size))
        for b in range(n_rounds):
            x_train, y_train = generate_data(n_train, noise_std, seed=seed)
            w = fit_polynomial(x_train, y_train, degree)
            predictions[b] = predict_polynomial(X_TEST, w)
        bias_sq, variance = decompose(predictions, y_true)
        results[degree] = {"bias_sq": bias_sq, "variance": variance, "test_error": expected_test_error(predictions, y_true, noise_std)}
    return results


def best_degree(results):
    return min(sorted(results), key=lambda d: results[d]["test_error"])


def crossover_degree(results):
    for degree in sorted(results):
        if results[degree]["variance"] >= results[degree]["bias_sq"]:
            return degree
    return None


def answers():
    results = sweep_degrees(DEGREES)
    best = best_degree(results)
    return {
        "best_degree": float(best),
        "best_test_error": results[best]["test_error"],
        "crossover_degree": float(crossover_degree(results)),
        "bias_sq_degree_1": results[1]["bias_sq"],
        "variance_degree_12": results[12]["variance"],
    }
