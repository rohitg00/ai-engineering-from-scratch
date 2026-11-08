import numpy as np

from practice_check import check, close, equal, fixture, fixtures, shape, true
from support import LEARNING_RATES, make_regression, train

KEYS = ["best_lr", "best_final_loss", "smallest_diverging_lr", "stability_bound"]


@check("examples", "a falling curve has not diverged and a rising curve has", "A run diverges when its final loss is not finite or is larger than its first loss.")
def example_diverged(sub):
    equal(bool(sub.is_diverged(np.array([2.0, 1.0, 0.5]))), False, what="is_diverged for a falling curve")
    equal(bool(sub.is_diverged(np.array([1.0, 2.0, 3.0]))), True, what="is_diverged for a rising curve")


@check("examples", "best_lr skips a diverged run", "The best rate is the one with the lowest final loss among the runs that did not diverge.")
def example_best(sub):
    curves = np.array([[1.0, 0.5], [1.0, 0.2], [1.0, np.inf]])
    close(sub.best_lr([0.1, 0.2, 0.3], curves), 0.2, what="best_lr")


@check("examples", "stability bound of a diagonal matrix", "The bound is 2 divided by the largest eigenvalue of the Hessian (2 / n) X^T X.")
def example_bound(sub):
    close(sub.stability_bound(np.array([[1.0, 0.0], [0.0, 2.0]])), 0.5, what="stability_bound")


@check("properties", "run_sweep gives one curve for each rate", "Row i of the sweep is the loss curve of train with the rate lrs[i]. Each curve has steps + 1 values.")
def sweep_shape(sub):
    X, y = make_regression(seed=3, n=16)
    curves = sub.run_sweep(X, y, [0.01, 0.1], steps=5)
    shape(curves, (2, 6), what="the sweep")
    close(curves[1], train(X, y, 0.1, 5), what="the curve for lr 0.1")


@check("properties", "answers has every key and only numbers", "The checks read one finite number for each question.")
def answer_keys(sub):
    result = sub.answers()
    equal(sorted(result.keys()), sorted(KEYS), what="the keys of answers()")
    for key in KEYS:
        true(isinstance(result[key], (int, float)) and np.isfinite(result[key]), f"{key} must be a finite number", "a number", result[key])


@check("properties", "the best rate is below the bound and the first diverged rate is above it", "Gradient descent on a quadratic is stable only for rates below 2 divided by the largest Hessian eigenvalue.")
def bound_between(sub):
    result = sub.answers()
    true(result["best_lr"] < result["stability_bound"] < result["smallest_diverging_lr"], "the bound must lie between the best rate and the first diverged rate", "best_lr < stability_bound < smallest_diverging_lr", result)


@check("properties", "the bound halves when X is scaled by the square root of 2", "The Hessian grows with the square of the scale of X, so the stable rate shrinks by the same factor.")
def bound_scaling(sub):
    X, _ = make_regression(seed=4, n=20)
    close(sub.stability_bound(X * np.sqrt(2.0)), sub.stability_bound(X) / 2.0, rtol=1e-9, what="the bound for the scaled X")


@check("properties", "the inputs are not changed", "A helper that writes into a curve changes the data for the next question.")
def inputs_unchanged(sub):
    curves = np.array([[1.0, 0.5], [1.0, 0.2]])
    saved = curves.copy()
    X = np.array([[1.0, 2.0], [3.0, 4.0]])
    saved_x = X.copy()
    sub.is_diverged(curves[0])
    sub.best_lr([0.1, 0.2], curves)
    sub.smallest_diverging_lr([0.1, 0.2], curves)
    sub.stability_bound(X)
    close(curves, saved, atol=0, rtol=0, what="the curves after the calls")
    close(X, saved_x, atol=0, rtol=0, what="X after the call")


@check("edge", "a finite curve that ends above its start has diverged", "A loss that grows but stays finite is also a divergence.")
def finite_growth(sub):
    equal(bool(sub.is_diverged(np.array([1.0, 0.4, 1.5]))), True, what="is_diverged")


@check("edge", "a NaN curve is never the best", "np.argmin treats NaN as the smallest value. Remove the diverged runs before you pick the best rate.")
def nan_curve(sub):
    curves = np.array([[1.0, np.nan], [1.0, 0.3], [1.0, 0.6]])
    close(sub.best_lr([0.5, 0.1, 0.05], curves), 0.1, what="best_lr")
    close(sub.smallest_diverging_lr([0.5, 0.1, 0.05], curves), 0.5, what="smallest_diverging_lr")


@check("edge", "rates in any order", "Return the smallest diverged rate by value, not the first one in the list.")
def unsorted_rates(sub):
    curves = np.array([[1.0, np.inf], [1.0, 0.3], [1.0, np.inf]])
    close(sub.smallest_diverging_lr([0.8, 0.1, 0.4], curves), 0.4, what="smallest_diverging_lr")


@check("edge", "equal final losses pick the smaller rate", "When two runs end at the same loss, the smaller rate is the safer choice.")
def ties(sub):
    curves = np.array([[1.0, 0.2], [1.0, 0.2]])
    close(sub.best_lr([0.3, 0.1], curves), 0.1, what="best_lr")


@check("edge", "no diverged run and no stable run give None", "When no run diverged, smallest_diverging_lr is None. When every run diverged, best_lr is None.")
def none_cases(sub):
    calm = np.array([[1.0, 0.5], [1.0, 0.4]])
    wild = np.array([[1.0, np.inf], [1.0, 2.0]])
    equal(sub.smallest_diverging_lr([0.1, 0.2], calm), None, what="smallest_diverging_lr with no divergence")
    equal(sub.best_lr([0.1, 0.2], wild), None, what="best_lr when every run diverged")


@fixture("problems")
def problems(ref):
    for seed, n in [(1, 12), (2, 30), (5, 48)]:
        X, y = make_regression(seed=seed, n=n)
        curves = ref.run_sweep(X, y, LEARNING_RATES, steps=40)
        yield {"seed": seed, "n": n}, {
            "best": ref.best_lr(LEARNING_RATES, curves),
            "diverged": ref.smallest_diverging_lr(LEARNING_RATES, curves),
            "bound": ref.stability_bound(X),
        }


@fixture("answers")
def answer_fixture(ref):
    yield {}, ref.answers()


@check("reference", "sweeps on three other problems match the reference", "Your sweep helpers give the same best rate, diverged rate and bound as the reference on three other seeds.")
def reference_sweeps(sub):
    for case, expected in fixtures("problems"):
        X, y = make_regression(seed=case["seed"], n=case["n"])
        curves = sub.run_sweep(X, y, LEARNING_RATES, steps=40)
        close(sub.best_lr(LEARNING_RATES, curves), expected["best"], what=f"best_lr for seed {case['seed']}")
        close(sub.smallest_diverging_lr(LEARNING_RATES, curves), expected["diverged"], what=f"smallest_diverging_lr for seed {case['seed']}")
        close(sub.stability_bound(X), expected["bound"], rtol=1e-9, what=f"stability_bound for seed {case['seed']}")


@check("reference", "every answer matches the reference run", "Each answer must be within a relative difference of 1e-6 of the reference run.")
def reference_answers(sub):
    result = sub.answers()
    for case, expected in fixtures("answers"):
        for key in KEYS:
            close(result.get(key), expected[key], rtol=1e-6, what=key)
