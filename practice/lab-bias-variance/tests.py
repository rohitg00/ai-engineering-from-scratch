import numpy as np

from practice_check import check, close, equal, fixture, fixtures, true

KEYS = ["best_degree", "best_test_error", "crossover_degree", "bias_sq_degree_1", "variance_degree_12"]
P = np.array([[1.0, 2.0, 3.0], [3.0, 2.0, 1.0]])
Y = np.array([1.5, 2.0, 2.0])
_cache = {}


def run_answers(sub):
    if sub not in _cache:
        _cache.clear()
        _cache[sub] = sub.answers()
    return _cache[sub]


@check("examples", "decompose two prediction rows", "Bias squared uses the mean prediction at each test point. Variance is the spread of the rows around that mean, with ddof 0.")
def example_decompose(sub):
    bias_sq, variance = sub.decompose(P, Y)
    close(bias_sq, 0.08333333333333333, what="bias squared")
    close(variance, 0.6666666666666666, what="variance")


@check("examples", "expected test error of two prediction rows", "The test error is the mean squared error over every round and every test point, plus the noise variance.")
def example_error(sub):
    close(sub.expected_test_error(P, Y, 0.5), 1.0, what="the test error")


@check("examples", "a small sweep with 5 rounds", "Round b trains on generate_data(n_train, noise_std, seed=seed + b) and predicts on X_TEST.")
def example_sweep(sub):
    result = sub.sweep_degrees([1, 3], n_rounds=5, n_train=20)
    equal(sorted(result.keys()), [1, 3], what="the degrees in the result")
    close(result[1]["bias_sq"], 0.3909230138895905, what="bias squared at degree 1")
    close(result[3]["variance"], 0.052499400227697696, what="variance at degree 3")
    close(result[3]["test_error"], 0.3642964495494713, what="the test error at degree 3")


@check("properties", "error equals bias squared plus variance plus noise", "With ddof 0, the mean squared error splits exactly into bias squared and variance. The noise variance adds on top.")
def identity(sub):
    rng = np.random.default_rng(11)
    preds = rng.normal(size=(7, 9))
    y_true = rng.normal(size=9)
    bias_sq, variance = sub.decompose(preds, y_true)
    close(sub.expected_test_error(preds, y_true, 0.3), bias_sq + variance + 0.09, rtol=1e-10, what="the test error")


@check("properties", "answers has every key and only numbers", "The checks read one finite number for each question.")
def answer_keys(sub):
    result = run_answers(sub)
    equal(sorted(result.keys()), sorted(KEYS), what="the keys of answers()")
    for key in KEYS:
        true(isinstance(result[key], (int, float)) and np.isfinite(result[key]), f"{key} must be a finite number", "a number", result[key])


@check("properties", "bias falls and variance grows with the degree", "A degree 1 line underfits the curve, so its bias is large. A degree 12 polynomial follows the noise, so its variance is large.")
def trend(sub):
    result = sub.sweep_degrees([1, 5, 12], n_rounds=40)
    true(result[5]["bias_sq"] < result[1]["bias_sq"], "bias squared must fall from degree 1 to degree 5", "smaller at degree 5", result)
    true(result[12]["variance"] > result[5]["variance"] > 0, "variance must be above 0 and grow from degree 5 to degree 12", "larger at degree 12", result)


@check("properties", "the inputs are not changed", "A helper that writes into the predictions changes the data for the next degree.")
def inputs_unchanged(sub):
    preds = P.copy()
    y_true = Y.copy()
    sub.decompose(preds, y_true)
    sub.expected_test_error(preds, y_true, 0.5)
    close(preds, P, atol=0, rtol=0, what="the predictions after the calls")
    close(y_true, Y, atol=0, rtol=0, what="the targets after the calls")


@check("edge", "one round has zero variance", "With one training set there is no spread, so variance is 0 and bias squared is the mean squared error.")
def one_round(sub):
    preds = np.array([[0.0, 1.0, 4.0]])
    y_true = np.array([1.0, 1.0, 1.0])
    bias_sq, variance = sub.decompose(preds, y_true)
    close(variance, 0.0, what="variance")
    close(bias_sq, 10.0 / 3.0, what="bias squared")


@check("edge", "equal test errors pick the lower degree", "When two degrees tie, the simpler model wins.")
def best_tie(sub):
    results = {2: {"bias_sq": 0.1, "variance": 0.1, "test_error": 0.5}, 4: {"bias_sq": 0.0, "variance": 0.2, "test_error": 0.5}, 6: {"bias_sq": 0.0, "variance": 0.5, "test_error": 0.8}}
    equal(sub.best_degree(results), 2, what="best_degree")


@check("edge", "the crossover counts an equal bias and variance", "The crossover is the first degree whose variance is at least its bias squared.")
def crossover_tie(sub):
    results = {1: {"bias_sq": 0.4, "variance": 0.1, "test_error": 0.75}, 2: {"bias_sq": 0.2, "variance": 0.2, "test_error": 0.65}, 3: {"bias_sq": 0.1, "variance": 0.3, "test_error": 0.65}}
    equal(sub.crossover_degree(results), 2, what="crossover_degree")


@check("edge", "no crossover gives None", "If bias squared stays above variance at every degree, there is no crossover.")
def no_crossover(sub):
    results = {1: {"bias_sq": 0.4, "variance": 0.1, "test_error": 0.75}, 2: {"bias_sq": 0.3, "variance": 0.2, "test_error": 0.75}}
    equal(sub.crossover_degree(results), None, what="crossover_degree")


@fixture("predictions")
def predictions(ref):
    rng = np.random.default_rng(3)
    for b, t in [(1, 4), (3, 5), (10, 8)]:
        preds = rng.normal(size=(b, t)) * 2.0 + 1.0
        y_true = rng.normal(size=t)
        yield {"preds": preds, "y_true": y_true}, {"decompose": ref.decompose(preds, y_true), "error": ref.expected_test_error(preds, y_true, 0.25)}


@fixture("sweeps")
def sweeps(ref):
    for seed, n_train in [(100, 15), (200, 40)]:
        yield {"seed": seed, "n_train": n_train}, ref.sweep_degrees([1, 2, 4, 7], n_rounds=8, n_train=n_train, seed=seed)


@fixture("answers")
def answer_fixture(ref):
    yield {}, ref.answers()


@check("reference", "decompose and the error match the reference", "Your bias squared, variance and test error match the reference on random predictions.")
def reference_decompose(sub):
    for case, expected in fixtures("predictions"):
        bias_sq, variance = sub.decompose(case["preds"], case["y_true"])
        close(bias_sq, expected["decompose"][0], rtol=1e-9, what=f"bias squared for shape {case['preds'].shape}")
        close(variance, expected["decompose"][1], rtol=1e-9, what=f"variance for shape {case['preds'].shape}")
        close(sub.expected_test_error(case["preds"], case["y_true"], 0.25), expected["error"], rtol=1e-9, what=f"the test error for shape {case['preds'].shape}")


@check("reference", "sweeps with other seeds match the reference", "Your sweep gives the same bias squared, variance and test error as the reference for two other seeds.")
def reference_sweeps(sub):
    for case, expected in fixtures("sweeps"):
        result = sub.sweep_degrees([1, 2, 4, 7], n_rounds=8, n_train=case["n_train"], seed=case["seed"])
        for degree in [1, 2, 4, 7]:
            for key in ["bias_sq", "variance", "test_error"]:
                close(result[degree][key], expected[degree][key], rtol=1e-7, what=f"{key} at degree {degree} with seed {case['seed']}")


@check("reference", "every answer matches the reference run", "Each answer must be within a relative difference of 1e-6 of the reference run.")
def reference_answers(sub):
    result = run_answers(sub)
    for case, expected in fixtures("answers"):
        for key in KEYS:
            close(result.get(key), expected[key], rtol=1e-6, what=key)
