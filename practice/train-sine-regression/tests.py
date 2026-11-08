import numpy as np

import practice_check
from practice_check import check, clear_progress, close, equal, fixture, fixtures, progress, shape, true
from support import make_sine

BUDGET = 1500
TARGET = 0.01
HELD_OUT_SEED = 70913
_runs = {}


def train_data():
    return make_sine(200, np.random.default_rng(0))


def held_out_x():
    return np.random.default_rng(HELD_OUT_SEED).uniform(-np.pi, np.pi, size=2000)


def fresh_run(sub, x, y, seed):
    saved = list(progress())
    clear_progress()
    try:
        model = sub.train(x, y, np.random.default_rng(seed))
        points = list(progress())
    finally:
        clear_progress()
        practice_check._progress.extend(saved)
    return model, points


def main_run(sub):
    key = id(sub)
    if key not in _runs:
        x, y = train_data()
        x_in, y_in = x.copy(), y.copy()
        clear_progress()
        model = sub.train(x_in, y_in, np.random.default_rng(1))
        _runs[key] = {"model": model, "points": list(progress()), "x": x, "y": y, "x_in": x_in, "y_in": y_in}
    return _runs[key]


def predictions(sub, model, x):
    out = np.asarray(sub.predict(model, x), dtype=float)
    shape(out, x.shape, what="the output of predict")
    return out


def curve_mse(sub, model, x):
    return float(np.mean((predictions(sub, model, x) - np.sin(x)) ** 2))


@check("examples", "predict gives one value for each input", "predict returns a float array of shape (M,) for an input of shape (M,).")
def example_shape(sub):
    run = main_run(sub)
    predictions(sub, run["model"], run["x"])


@check("examples", "the model fits the training points", "After training, the mean squared error against the noisy training targets must be at most 0.02. The noise alone gives about 0.01.")
def example_train_mse(sub):
    run = main_run(sub)
    mse = float(np.mean((predictions(sub, run["model"], run["x"]) - run["y"]) ** 2))
    true(mse <= 0.02, f"training mean squared error {mse:.5f} is above 0.02", "<= 0.02", mse)


@check("properties", "training stays inside the step budget", "Call report(step, loss) once for each update step, with step = 0, 1, 2 and so on. Use at most 1500 steps.")
def budget(sub):
    points = main_run(sub)["points"]
    true(len(points) >= 1, "train did not call report(step, loss)", "at least 1 call", 0)
    true(len(points) <= BUDGET, f"train used {len(points)} steps, the budget is {BUDGET}", f"<= {BUDGET}", len(points))
    equal([point[0] for point in points], list(range(len(points))), what="the step numbers given to report")


@check("properties", "the reported loss goes down", "Gradient descent must lower the loss. The mean of the last 10 reported losses must be below the first loss.")
def loss_goes_down(sub):
    losses = np.array([point[1] for point in main_run(sub)["points"]])
    true(losses.size >= 1 and np.all(np.isfinite(losses)), "a reported loss is NaN or infinite", "finite losses", losses)
    true(np.mean(losses[-10:]) < losses[0], "the loss did not go down", f"below {losses[0]:.4f}", float(np.mean(losses[-10:])))


@check("properties", "the same seed gives the same model", "Take every random number from the rng argument. Then two runs with the same seed give the same predictions.")
def deterministic(sub):
    run = main_run(sub)
    x, y = train_data()
    model, points = fresh_run(sub, x, y, 1)
    x_test = held_out_x()
    equal(predictions(sub, model, x_test), predictions(sub, run["model"], x_test), what="the predictions of the second run")
    equal([point[1] for point in points], [point[1] for point in run["points"]], what="the losses of the second run")


@check("properties", "the inputs are not changed", "Do not write into x or y and do not change their shape. Make a new array, for example with x.reshape(-1, 1).")
def inputs_unchanged(sub):
    run = main_run(sub)
    equal(run["x_in"], run["x"], what="x after train")
    equal(run["y_in"], run["y"], what="y after train")


@check("edge", "key points of the curve", "The fit must be close to sin(x) at 0, at plus and minus pi / 2 and at the ends of the range. Each error must be below 0.15.")
def key_points(sub):
    x = np.array([-np.pi, -np.pi / 2, 0.0, np.pi / 2, np.pi])
    close(predictions(sub, main_run(sub)["model"], x), np.sin(x), rtol=0, atol=0.15, what="the predictions at the key points")


@check("edge", "predict on one input", "predict must work for one value and return shape (1,).")
def one_input(sub):
    predictions(sub, main_run(sub)["model"], np.array([1.0]))


@check("edge", "a smaller data set and a new seed", "Training must not depend on one lucky seed. With 100 points and another seed, the held-out error must also be at most 0.01.")
def other_seed(sub):
    x, y = make_sine(100, np.random.default_rng(5))
    model, _ = fresh_run(sub, x, y, 7)
    mse = curve_mse(sub, model, held_out_x())
    true(mse <= TARGET, f"held-out mean squared error {mse:.5f} is above {TARGET}", f"<= {TARGET}", mse)


@fixture("held_out")
def reference_mse(ref):
    x, y = train_data()
    model = ref.train(x, y, np.random.default_rng(1))
    x_test = held_out_x()
    yield {"target": TARGET}, float(np.mean((ref.predict(model, x_test) - np.sin(x_test)) ** 2))


@check("reference", "held-out error reaches the target", "The checks measure your model at 2000 new values of x from minus pi to pi. The mean squared error against the true curve sin(x) must be at most 0.01.")
def held_out_mse(sub):
    (case, reference), = fixtures("held_out")
    mse = curve_mse(sub, main_run(sub)["model"], held_out_x())
    true(mse <= case["target"], f"held-out mean squared error {mse:.5f} is above {case['target']}. The reference reaches {reference:.5f}", f"<= {case['target']}", mse)
