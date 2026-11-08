import numpy as np

import practice_check
from practice_check import check, clear_progress, close, equal, fixture, fixtures, progress, shape, true
from support import CENTERS, make_blobs

BUDGET = 500
TARGET_ACCURACY = 0.95
TARGET_LOG_LOSS = 0.11
HELD_OUT_SEED = 61021
_runs = {}


def train_data():
    return make_blobs(400, np.random.default_rng(0))


def held_out():
    return make_blobs(4000, np.random.default_rng(HELD_OUT_SEED))


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


def probabilities(sub, model, X):
    probs = np.asarray(sub.predict_proba(model, X), dtype=float)
    shape(probs, (X.shape[0], len(CENTERS)), what="the probabilities from predict_proba")
    return probs


def scores(sub, model, X, y):
    probs = probabilities(sub, model, X)
    accuracy = float(np.mean(np.argmax(probs, axis=1) == y))
    log_loss = float(-np.mean(np.log(np.maximum(probs[np.arange(y.size), y], 1e-15))))
    return accuracy, log_loss


@check("examples", "one probability for each class", "predict_proba returns an array of shape (N, 4). Row i holds the probability of each class for point i.")
def example_shape(sub):
    run = main_run(sub)
    probabilities(sub, run["model"], run["X"])


@check("examples", "the model fits the training points", "After training, the training accuracy must be at least 0.95 and the training log loss at most 0.11.")
def example_train_scores(sub):
    run = main_run(sub)
    accuracy, log_loss = scores(sub, run["model"], run["X"], run["y"])
    true(accuracy >= TARGET_ACCURACY, f"training accuracy {accuracy:.3f} is below {TARGET_ACCURACY}", f">= {TARGET_ACCURACY}", accuracy)
    true(log_loss <= TARGET_LOG_LOSS, f"training log loss {log_loss:.4f} is above {TARGET_LOG_LOSS}", f"<= {TARGET_LOG_LOSS}", log_loss)


@check("properties", "each row of probabilities sums to 1", "Softmax gives a probability distribution over the 4 classes, so each row is from 0 to 1 and adds up to 1.")
def rows_sum_to_one(sub):
    run = main_run(sub)
    probs = probabilities(sub, run["model"], run["X"])
    close(probs.sum(axis=1), np.ones(probs.shape[0]), atol=1e-9, what="the row sums")
    true(np.all(probs >= 0) and np.all(probs <= 1), "a probability is outside 0 to 1", "values from 0 to 1", probs)


@check("properties", "training stays inside the step budget", "Call report(step, loss) once for each update step, with step = 0, 1, 2 and so on. Use at most 500 steps.")
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


@check("properties", "the same seed gives the same model", "Take every random number from the rng argument. Then two runs with the same seed give the same probabilities.")
def deterministic(sub):
    run = main_run(sub)
    X, y = train_data()
    model, points = fresh_run(sub, X, y, 1)
    X_test, _ = held_out()
    equal(probabilities(sub, model, X_test), probabilities(sub, run["model"], X_test), what="the probabilities of the second run")
    equal([point[1] for point in points], [point[1] for point in run["points"]], what="the losses of the second run")


@check("properties", "the inputs are not changed", "Do not write into X or y. Make a new array when you scale the data.")
def inputs_unchanged(sub):
    run = main_run(sub)
    equal(run["X_in"], run["X"], what="X after train")
    equal(run["y_in"], run["y"], what="y after train")


@check("edge", "each blob center gets its own class", "The point at the center of blob k must get the highest probability for class k.")
def centers(sub):
    probs = probabilities(sub, main_run(sub)["model"], CENTERS)
    equal(np.argmax(probs, axis=1).tolist(), [0, 1, 2, 3], what="the most likely class at each center")


@check("edge", "points far from the data stay finite", "Points far away give very large scores. Subtract the row maximum before np.exp, or the probabilities become NaN.")
def far_points(sub):
    far = np.array([[1000.0, 1000.0], [-800.0, 50.0], [3.0, -900.0]])
    probs = probabilities(sub, main_run(sub)["model"], far)
    true(np.all(np.isfinite(probs)), "a probability is NaN or infinite", "finite values", probs)
    close(probs.sum(axis=1), np.ones(3), atol=1e-9, what="the row sums for far points")


@check("edge", "one class is much more common", "When 85 percent of the points are class 0, the biases must learn the class frequencies. Update the biases as well as the weights.")
def imbalanced(sub):
    weights = [0.85, 0.05, 0.05, 0.05]
    X, y = make_blobs(400, np.random.default_rng(11), weights=weights)
    model, _ = fresh_run(sub, X, y, 3)
    X_test, y_test = make_blobs(4000, np.random.default_rng(HELD_OUT_SEED + 1), weights=weights)
    accuracy, log_loss = scores(sub, model, X_test, y_test)
    true(accuracy >= TARGET_ACCURACY, f"held-out accuracy {accuracy:.3f} is below {TARGET_ACCURACY}", f">= {TARGET_ACCURACY}", accuracy)
    true(log_loss <= TARGET_LOG_LOSS, f"held-out log loss {log_loss:.4f} is above {TARGET_LOG_LOSS}", f"<= {TARGET_LOG_LOSS}", log_loss)


@check("edge", "predict_proba on one point", "predict_proba must work for a single row and return shape (1, 4).")
def one_point(sub):
    probabilities(sub, main_run(sub)["model"], CENTERS[2:3])


@check("edge", "a smaller data set and a new seed", "With 200 points and another seed, the model must also reach both targets on the held-out set.")
def other_seed(sub):
    X, y = make_blobs(200, np.random.default_rng(5))
    model, _ = fresh_run(sub, X, y, 7)
    X_test, y_test = held_out()
    accuracy, log_loss = scores(sub, model, X_test, y_test)
    true(accuracy >= TARGET_ACCURACY, f"held-out accuracy {accuracy:.3f} is below {TARGET_ACCURACY}", f">= {TARGET_ACCURACY}", accuracy)
    true(log_loss <= TARGET_LOG_LOSS, f"held-out log loss {log_loss:.4f} is above {TARGET_LOG_LOSS}", f"<= {TARGET_LOG_LOSS}", log_loss)


@fixture("held_out")
def reference_scores(ref):
    X, y = train_data()
    model = ref.train(X, y, np.random.default_rng(1))
    X_test, y_test = held_out()
    probs = ref.predict_proba(model, X_test)
    accuracy = float(np.mean(np.argmax(probs, axis=1) == y_test))
    log_loss = float(-np.mean(np.log(probs[np.arange(y_test.size), y_test])))
    yield {"accuracy": TARGET_ACCURACY, "log_loss": TARGET_LOG_LOSS}, {"accuracy": accuracy, "log_loss": log_loss}


@check("reference", "held-out accuracy reaches the target", "The checks measure your model on 4000 new points that train never sees. The accuracy must be at least 0.95.")
def held_out_accuracy(sub):
    (target, reference), = fixtures("held_out")
    X_test, y_test = held_out()
    accuracy, _ = scores(sub, main_run(sub)["model"], X_test, y_test)
    true(accuracy >= target["accuracy"], f"held-out accuracy {accuracy:.3f} is below {target['accuracy']}. The reference reaches {reference['accuracy']:.3f}", f">= {target['accuracy']}", accuracy)


@check("reference", "held-out log loss reaches the target", "The log loss is the mean of minus log p of the correct class on the 4000 new points. It must be at most 0.11. A model that is right but not sure gets a high log loss.")
def held_out_log_loss(sub):
    (target, reference), = fixtures("held_out")
    X_test, y_test = held_out()
    _, log_loss = scores(sub, main_run(sub)["model"], X_test, y_test)
    true(log_loss <= target["log_loss"], f"held-out log loss {log_loss:.4f} is above {target['log_loss']}. The reference reaches {reference['log_loss']:.4f}", f"<= {target['log_loss']}", log_loss)
