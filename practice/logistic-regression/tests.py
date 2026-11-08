import numpy as np

from practice_check import check, close, equal, fixture, fixtures, numeric_grad, shape, true

X_EX = np.array([[1.0, 2.0], [2.0, 1.0], [3.0, 4.0], [4.0, 3.0]])
Y_EX = np.array([0.0, 0.0, 1.0, 1.0])
W_EX = np.array([0.5, -0.25])
B_EX = 0.1


@check("examples", "sigmoid of five values", "sigmoid(z) is 1 / (1 + exp(-z)). It gives 0.5 at z = 0 and goes to 0 and 1 at the two ends.")
def example_sigmoid(sub):
    close(sub.sigmoid(np.array([-2.0, 0.0, 2.0, 1000.0, -1000.0])), [0.11920292, 0.5, 0.88079708, 1.0, 0.0], rtol=1e-6, atol=1e-12, what="the sigmoid values")


@check("examples", "loss and gradients of the small example", "The loss is the mean binary cross-entropy. The gradient of the weights is X^T (p - y) / n and the gradient of the bias is the mean of p - y.")
def example_loss_grad(sub):
    close(sub.compute_loss(X_EX, Y_EX, W_EX, B_EX), 0.6545645625913818, rtol=1e-9, what="the loss")
    dw, db = sub.compute_gradients(X_EX, Y_EX, W_EX, B_EX)
    close(dw, [0.00990023, -0.07111509], rtol=1e-6, what="the weight gradient")
    close(db, 0.1663330660944403, rtol=1e-9, what="the bias gradient")


@check("examples", "three epochs of training", "fit starts from zero weights and bias. Each epoch does one gradient step and then records the loss.")
def example_fit(sub):
    w, b, history = sub.fit(X_EX, Y_EX, 0.1, 3)
    close(w, [0.10335357, 0.10335357], rtol=1e-6, what="the weights")
    close(b, -0.016102386795294854, rtol=1e-9, what="the bias")
    close(history, [0.6521696016041545, 0.6346023820290841, 0.6258174296603579], rtol=1e-9, what="the loss history")


@check("properties", "sigmoid is symmetric and stays in [0, 1]", "sigmoid(-z) equals 1 - sigmoid(z), and every value is from 0 to 1.")
def sigmoid_symmetry(sub):
    z = np.linspace(-30.0, 30.0, 41)
    s = sub.sigmoid(z)
    shape(s, z.shape, what="the sigmoid output")
    close(sub.sigmoid(-z), 1.0 - s, atol=1e-12, what="sigmoid(-z)")
    true(np.all((s >= 0) & (s <= 1)), "a sigmoid value is outside [0, 1]", "values from 0 to 1", s)


@check("properties", "gradients match finite differences", "A gradient is correct when a small change in one weight changes the loss by gradient times that change.")
def finite_differences(sub):
    rng = np.random.default_rng(0)
    X = rng.normal(size=(7, 3))
    y = (rng.random(7) < 0.5).astype(float)
    w = rng.normal(size=3)
    b = 0.3
    dw, db = sub.compute_gradients(X, y, w, b)
    close(dw, numeric_grad(lambda v: sub.compute_loss(X, y, v, b), w), atol=1e-7, rtol=1e-5, what="the weight gradient")
    numeric_b = numeric_grad(lambda v: sub.compute_loss(X, y, w, float(v[0])), np.array([b]))[0]
    close(db, numeric_b, atol=1e-7, rtol=1e-5, what="the bias gradient")


@check("properties", "the loss goes down at every epoch", "The loss is convex. With a small learning rate, each gradient step lowers it.")
def loss_decreases(sub):
    rng = np.random.default_rng(1)
    X = np.vstack([rng.normal(2.0, 1.0, size=(20, 2)), rng.normal(5.0, 1.0, size=(20, 2))])
    y = np.array([0.0] * 20 + [1.0] * 20)
    _, _, history = sub.fit(X, y, 0.05, 30)
    equal(len(history), 30, what="the length of the loss history")
    true(np.all(np.diff(history) < 0), "the loss went up in an epoch", "a falling loss history", np.array(history))
    true(history[0] < np.log(2.0), "the first recorded loss is not below log(2), the loss of the zero model", float(np.log(2.0)), history[0])


@check("properties", "the inputs are not changed", "A function that writes into its input array breaks the code that calls it.")
def inputs_unchanged(sub):
    X, y, w = X_EX.copy(), Y_EX.copy(), W_EX.copy()
    z = np.array([-3.0, 0.5, 4.0])
    saved = [X.copy(), y.copy(), w.copy(), z.copy()]
    sub.sigmoid(z)
    sub.compute_loss(X, y, w, B_EX)
    sub.compute_gradients(X, y, w, B_EX)
    sub.fit(X, y, 0.1, 2)
    for name, now, before in zip(["X", "y", "w", "z"], [X, y, w, z], saved):
        close(now, before, rtol=0, atol=0, what=f"{name} after the calls")


@check("edge", "sigmoid of very large values", "exp(1000) overflows. Use exp(-|z|), which is never larger than 1, and pick the formula by the sign of z.")
def sigmoid_large(sub):
    z = np.array([-800.0, -40.0, 40.0, 800.0])
    close(sub.sigmoid(z), [0.0, 4.248354255291589e-18, 1.0, 1.0], rtol=1e-9, atol=0, what="the sigmoid of large values")


@check("edge", "the loss of a confident wrong prediction is finite", "Do not take log(sigmoid(z)). For z = 800 and y = 0, 1 - sigmoid(z) is 0 and the log is minus infinity. Use log(1 + exp(z)) - y z with np.logaddexp.")
def confident_wrong(sub):
    close(sub.compute_loss(np.array([[1.0]]), np.array([0.0]), np.array([800.0]), 0.0), 800.0, rtol=1e-9, what="the loss for z = 800 and y = 0")
    close(sub.compute_loss(np.array([[1.0]]), np.array([1.0]), np.array([-60.0]), 0.0), 60.0, rtol=1e-9, what="the loss for z = -60 and y = 1")


@check("edge", "zero epochs and one example", "With 0 epochs, fit returns zero weights, a zero bias and an empty history. One example is a valid batch.")
def tiny_cases(sub):
    w, b, history = sub.fit(X_EX, Y_EX, 0.1, 0)
    close(w, [0.0, 0.0], what="the weights")
    close(b, 0.0, what="the bias")
    equal(len(history), 0, what="the length of the history")
    dw, db = sub.compute_gradients(np.array([[2.0, -1.0]]), np.array([1.0]), np.zeros(2), 0.0)
    close(dw, [-1.0, 0.5], what="the weight gradient for one example")
    close(db, -0.5, what="the bias gradient for one example")


@fixture("datasets")
def datasets(ref):
    rng = np.random.default_rng(42)
    for n, d, lr, epochs in [(5, 1, 0.5, 10), (12, 3, 0.1, 25), (30, 2, 1.0, 40), (8, 5, 0.01, 15), (20, 4, 0.3, 30)]:
        X = rng.normal(size=(n, d)) * 2.0
        y = (rng.random(n) < 0.5).astype(float)
        w = rng.normal(size=d)
        b = float(rng.normal())
        dw, db = ref.compute_gradients(X, y, w, b)
        fw, fb, history = ref.fit(X, y, lr, epochs)
        yield {"X": X, "y": y, "w": w, "b": b, "lr": lr, "epochs": epochs}, {
            "loss": ref.compute_loss(X, y, w, b),
            "dw": dw,
            "db": db,
            "fit_w": fw,
            "fit_b": fb,
            "history": np.array(history),
        }


@check("reference", "loss and gradients match the reference", "Your loss and gradients agree with the reference solution on random data sets.")
def reference_loss(sub):
    for case, expected in fixtures("datasets"):
        label = f"X of shape {case['X'].shape}"
        close(sub.compute_loss(case["X"], case["y"], case["w"], case["b"]), expected["loss"], rtol=1e-9, what=f"the loss for {label}")
        dw, db = sub.compute_gradients(case["X"], case["y"], case["w"], case["b"])
        close(dw, expected["dw"], rtol=1e-8, atol=1e-12, what=f"the weight gradient for {label}")
        close(db, expected["db"], rtol=1e-8, atol=1e-12, what=f"the bias gradient for {label}")


@check("reference", "training matches the reference", "Your fit gives the same weights, bias and loss history as the reference solution.")
def reference_fit(sub):
    for case, expected in fixtures("datasets"):
        label = f"X of shape {case['X'].shape}, {case['epochs']} epochs"
        w, b, history = sub.fit(case["X"], case["y"], case["lr"], case["epochs"])
        close(w, expected["fit_w"], rtol=1e-8, atol=1e-12, what=f"the weights for {label}")
        close(b, expected["fit_b"], rtol=1e-8, atol=1e-12, what=f"the bias for {label}")
        close(history, expected["history"], rtol=1e-8, what=f"the loss history for {label}")
