import numpy as np

import practice_check
from practice_check import check, clear_progress, equal, fixture, fixtures, progress, shape, true
from support import make_xor

BUDGET = 2000
TARGET = 0.95
HELD_OUT_SEED = 80417
CORNERS = np.array([[0.0, 0.0], [0.0, 1.0], [1.0, 0.0], [1.0, 1.0]])
_runs = {}


def train_data():
    return make_xor(200, np.random.default_rng(0))


def held_out():
    return make_xor(2000, np.random.default_rng(HELD_OUT_SEED))


def fresh_run(sub, X, y, seed):
    saved = list(progress())
    clear_progress()
    try:
        model = sub.train(X, y, np.random.default_rng(seed))
        points = list(progress())
    finally:
        clear_progress()
        practice_check._progress.extend(saved)
    return model, points


def main_run(sub):
    key = id(sub)
    if key not in _runs:
        X, y = train_data()
        X_in, y_in = X.copy(), y.copy()
        clear_progress()
        model = sub.train(X_in, y_in, np.random.default_rng(1))
        _runs[key] = {"model": model, "points": list(progress()), "X": X, "y": y, "X_in": X_in, "y_in": y_in}
    return _runs[key]


def accuracy(sub, model, X, y):
    labels = np.asarray(sub.predict(model, X))
    shape(labels, y.shape, what="the labels from predict")
    return float(np.mean(labels == y))


@check("examples", "predict gives one label for each point", "predict returns an int array of shape (N,) with the value 0 or 1 for each row of X.")
def example_shape(sub):
    run = main_run(sub)
    labels = np.asarray(sub.predict(run["model"], run["X"]))
    shape(labels, (200,), what="the labels for the 200 training points")
    true(set(np.unique(labels).tolist()) <= {0, 1}, "predict returned a value that is not 0 or 1", "only 0 and 1", np.unique(labels))


@check("examples", "the model fits the training points", "After training, at least 95 percent of the training points must get the correct label.")
def example_train_accuracy(sub):
    run = main_run(sub)
    acc = accuracy(sub, run["model"], run["X"], run["y"])
    true(acc >= TARGET, f"training accuracy {acc:.3f} is below {TARGET}", f">= {TARGET}", acc)


@check("properties", "training stays inside the step budget", "Call report(step, loss) once for each update step, with step = 0, 1, 2 and so on. Use at most 2000 steps.")
def budget(sub):
    points = main_run(sub)["points"]
    true(len(points) >= 1, "train did not call report(step, loss)", "at least 1 call", 0)
    true(len(points) <= BUDGET, f"train used {len(points)} steps, the budget is {BUDGET}", f"<= {BUDGET}", len(points))
    steps = [point[0] for point in points]
    equal(steps, list(range(len(points))), what="the step numbers given to report")


@check("properties", "the reported loss goes down", "Gradient descent must lower the loss. The mean of the last 10 reported losses must be below the first loss.")
def loss_goes_down(sub):
    losses = np.array([point[1] for point in main_run(sub)["points"]])
    true(losses.size >= 1 and np.all(np.isfinite(losses)), "a reported loss is NaN or infinite", "finite losses", losses)
    true(np.mean(losses[-10:]) < losses[0], "the loss did not go down", f"below {losses[0]:.4f}", float(np.mean(losses[-10:])))


@check("properties", "the same seed gives the same model", "Take every random number from the rng argument. Then two runs with the same seed give the same predictions.")
def deterministic(sub):
    run = main_run(sub)
    X, y = train_data()
    model, points = fresh_run(sub, X, y, 1)
    X_test, _ = held_out()
    equal(np.asarray(sub.predict(model, X_test)), np.asarray(sub.predict(run["model"], X_test)), what="the predictions of the second run")
    equal([point[1] for point in points], [point[1] for point in run["points"]], what="the losses of the second run")


@check("properties", "the inputs are not changed", "Do not write into X or y. Make a new array when you change the data.")
def inputs_unchanged(sub):
    run = main_run(sub)
    equal(run["X_in"], run["X"], what="X after train")
    equal(run["y_in"], run["y"], what="y after train")


@check("edge", "the four clean corners", "The trained model gives XOR of the corner: 0 for (0, 0) and (1, 1), 1 for (0, 1) and (1, 0).")
def clean_corners(sub):
    labels = np.asarray(sub.predict(main_run(sub)["model"], CORNERS))
    equal(labels.tolist(), [0, 1, 1, 0], what="the labels of the four corners")


@check("edge", "predict on one point", "predict must work for a single row and return shape (1,).")
def one_point(sub):
    labels = np.asarray(sub.predict(main_run(sub)["model"], CORNERS[1:2]))
    shape(labels, (1,), what="the label of one point")


@check("edge", "a smaller data set and a new seed", "Training must not depend on one lucky seed. With 120 points and another seed, the model must also reach the target.")
def other_seed(sub):
    X, y = make_xor(120, np.random.default_rng(5))
    model, _ = fresh_run(sub, X, y, 7)
    X_test, y_test = held_out()
    acc = accuracy(sub, model, X_test, y_test)
    true(acc >= TARGET, f"held-out accuracy {acc:.3f} is below {TARGET}", f">= {TARGET}", acc)


@fixture("held_out")
def reference_score(ref):
    X, y = train_data()
    model = ref.train(X, y, np.random.default_rng(1))
    X_test, y_test = held_out()
    yield {"target": TARGET}, float(np.mean(ref.predict(model, X_test) == y_test))


@check("reference", "held-out accuracy reaches the target", "The checks measure your model on 2000 new points that train never sees. The accuracy must be at least 0.95.")
def held_out_accuracy(sub):
    (case, reference), = fixtures("held_out")
    run = main_run(sub)
    X_test, y_test = held_out()
    acc = accuracy(sub, run["model"], X_test, y_test)
    true(acc >= case["target"], f"held-out accuracy {acc:.3f} is below {case['target']}. The reference reaches {reference:.3f}", f">= {case['target']}", acc)
