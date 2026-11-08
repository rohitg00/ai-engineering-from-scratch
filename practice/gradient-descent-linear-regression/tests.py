import numpy as np

from practice_check import check, close, equal, fixture, fixtures, numeric_grad, shape, true

LINE_X = np.array([[1.0], [2.0], [3.0], [4.0]])
LINE_Y = np.array([3.0, 5.0, 7.0, 9.0])


@check("examples", "cost of the zero model on the line y = 2x + 1", "The cost is the mean of the squared errors. With w = 0 and b = 0 every prediction is 0.")
def example_cost(sub):
    close(sub.compute_cost(LINE_X, LINE_Y, np.zeros(1), 0.0), 41.0, what="the cost")


@check("examples", "gradients of the zero model", "dw is 2/n times X transposed times the errors. db is 2/n times the sum of the errors. The error is the prediction minus the target.")
def example_gradients(sub):
    dw, db = sub.compute_gradients(LINE_X, LINE_Y, np.zeros(1), 0.0)
    close(dw, [-35.0], what="dw")
    close(db, -12.0, what="db")


@check("examples", "fit finds the line y = 2x + 1", "Start from w = 0 and b = 0. Each epoch computes both gradients first, then updates w and b with the same learning rate.")
def example_fit(sub):
    w, b, history = sub.fit(LINE_X, LINE_Y, 0.05, 500)
    shape(w, (1,), what="w")
    close(w, [2.00005173], rtol=1e-6, what="w")
    close(b, 0.9998479052895004, rtol=1e-6, what="b")
    equal(len(history), 500, what="the length of the cost history")


@check("properties", "predict gives X times w plus b", "The prediction of each row is the dot product of the row with w, plus b.")
def predict_matches(sub):
    rng = np.random.default_rng(3)
    X = rng.normal(size=(6, 3))
    w = rng.normal(size=3)
    out = sub.predict(X, w, 0.5)
    shape(out, (6,), what="the predictions")
    close(out, X @ w + 0.5, what="the predictions")


@check("properties", "gradients match finite differences", "A gradient is correct when a small change in one parameter changes the cost by the gradient times that change.")
def finite_differences(sub):
    rng = np.random.default_rng(4)
    X = rng.normal(size=(7, 3))
    y = rng.normal(size=7)
    w = rng.normal(size=3)
    b = 0.3
    dw, db = sub.compute_gradients(X, y, w, b)
    numeric_w = numeric_grad(lambda v: sub.compute_cost(X, y, v, b), w)
    numeric_b = numeric_grad(lambda v: sub.compute_cost(X, y, w, float(v[0])), np.array([b]))
    close(dw, numeric_w, rtol=1e-5, atol=1e-7, what="dw")
    close(db, numeric_b[0], rtol=1e-5, atol=1e-7, what="db")


@check("properties", "the gradient is zero at the least squares fit", "The least squares line is the minimum of the cost. At a minimum both gradients are 0.")
def zero_at_optimum(sub):
    rng = np.random.default_rng(5)
    X = rng.normal(size=(9, 2))
    y = rng.normal(size=9)
    design = np.hstack([X, np.ones((9, 1))])
    params = np.linalg.lstsq(design, y, rcond=None)[0]
    dw, db = sub.compute_gradients(X, y, params[:2], float(params[2]))
    close(dw, np.zeros(2), atol=1e-9, what="dw at the optimum")
    close(db, 0.0, atol=1e-9, what="db at the optimum")


@check("properties", "the history holds the cost after each update", "Append the cost after you update w and b. The last entry is then the cost of the returned w and b.")
def history_after_update(sub):
    rng = np.random.default_rng(6)
    X = rng.normal(size=(8, 2))
    y = X @ np.array([1.5, -0.5]) + 2.0
    w, b, history = sub.fit(X, y, 0.1, 25)
    equal(len(history), 25, what="the length of the history")
    close(history[-1], sub.compute_cost(X, y, w, b), rtol=1e-9, what="the last cost in the history")
    true(history[0] < sub.compute_cost(X, y, np.zeros(2), 0.0), "The first entry must be the cost after the first update. It must be lower than the cost of the zero model.", "a value below the cost of the zero model", history[0])
    true(all(later <= earlier + 1e-12 for earlier, later in zip(history, history[1:])), "With a small learning rate the cost must not go up.", "a cost that never goes up", history)


@check("properties", "the inputs are not changed", "A function that writes into its input arrays breaks the code that calls it.")
def inputs_unchanged(sub):
    X = np.array([[1.0, 2.0], [3.0, -1.0], [0.5, 0.5]])
    y = np.array([1.0, 2.0, 3.0])
    w = np.array([0.2, -0.1])
    saved = (X.copy(), y.copy(), w.copy())
    sub.compute_cost(X, y, w, 0.1)
    sub.compute_gradients(X, y, w, 0.1)
    sub.fit(X, y, 0.05, 5)
    for name, now, before in zip(("X", "y", "w"), (X, y, w), saved):
        close(now, before, rtol=0, atol=0, what=f"{name} after the calls")


@check("edge", "zero epochs return the starting point", "With zero epochs the loop does not run. Return w = 0, b = 0 and an empty history.")
def zero_epochs(sub):
    w, b, history = sub.fit(LINE_X, LINE_Y, 0.05, 0)
    close(w, [0.0], what="w")
    close(b, 0.0, what="b")
    equal(len(history), 0, what="the length of the history")


@check("edge", "the bias alone fits a constant target", "When every feature is 0, only the bias can reduce the cost. The bias must move to the mean of y.")
def bias_only(sub):
    X = np.zeros((3, 2))
    y = np.array([5.0, 5.0, 5.0])
    w, b, history = sub.fit(X, y, 0.1, 200)
    close(w, [0.0, 0.0], what="w")
    close(b, 5.0, rtol=1e-9, what="b")


@check("edge", "one sample and one feature", "The functions must work when n = 1. The mean over one sample is that sample.")
def single_sample(sub):
    X = np.array([[2.0]])
    y = np.array([4.0])
    close(sub.compute_cost(X, y, np.array([1.0]), 1.0), 1.0, what="the cost")
    dw, db = sub.compute_gradients(X, y, np.array([1.0]), 1.0)
    close(dw, [-4.0], what="dw")
    close(db, -2.0, what="db")


@fixture("models")
def models(ref):
    rng = np.random.default_rng(42)
    for n, d, lr, epochs in [(5, 1, 0.05, 10), (12, 3, 0.02, 30), (20, 4, 0.1, 15), (8, 2, 0.3, 20)]:
        X = rng.normal(size=(n, d))
        y = X @ rng.normal(size=d) + rng.normal() + 0.1 * rng.normal(size=n)
        w = rng.normal(size=d)
        b = float(rng.normal())
        dw, db = ref.compute_gradients(X, y, w, b)
        fit_w, fit_b, history = ref.fit(X, y, lr, epochs)
        yield {"X": X, "y": y, "w": w, "b": b, "lr": lr, "epochs": epochs}, {
            "cost": ref.compute_cost(X, y, w, b),
            "dw": dw,
            "db": db,
            "fit_w": fit_w,
            "fit_b": fit_b,
            "history": np.array(history),
        }


@check("reference", "cost and gradients match the reference", "Your cost and gradients agree with the reference solution on random data.")
def reference_gradients(sub):
    for case, expected in fixtures("models"):
        size = case["X"].shape
        close(sub.compute_cost(case["X"], case["y"], case["w"], case["b"]), expected["cost"], rtol=1e-9, what=f"the cost for X of shape {size}")
        dw, db = sub.compute_gradients(case["X"], case["y"], case["w"], case["b"])
        close(dw, expected["dw"], rtol=1e-9, atol=1e-12, what=f"dw for X of shape {size}")
        close(db, expected["db"], rtol=1e-9, atol=1e-12, what=f"db for X of shape {size}")


@check("reference", "fit matches the reference", "Your training loop gives the same weights, bias and cost history as the reference solution.")
def reference_fit(sub):
    for case, expected in fixtures("models"):
        size = case["X"].shape
        w, b, history = sub.fit(case["X"], case["y"], case["lr"], case["epochs"])
        close(w, expected["fit_w"], rtol=1e-9, atol=1e-12, what=f"w for X of shape {size}")
        close(b, expected["fit_b"], rtol=1e-9, atol=1e-12, what=f"b for X of shape {size}")
        close(np.asarray(history, dtype=float), expected["history"], rtol=1e-9, atol=1e-12, what=f"the cost history for X of shape {size}")
