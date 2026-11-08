import numpy as np

from practice_check import check, close, fixture, fixtures, numeric_grad, shape, true

X = np.array([[0.0, 1.0], [1.0, 0.0]])
Y = np.array([[1.0], [0.0]])
NAMES = ("W1", "b1", "W2", "b2")


def example_params():
    return {
        "W1": np.array([[0.5, -0.5, 1.0], [0.25, 0.75, -1.0]]),
        "b1": np.array([0.0, 0.1, -0.1]),
        "W2": np.array([[1.0], [-1.0], [0.5]]),
        "b2": np.array([0.2]),
    }


def random_params(rng, n_in, n_hidden, n_out, scale=1.0):
    return {
        "W1": rng.normal(size=(n_in, n_hidden)) * scale,
        "b1": rng.normal(size=n_hidden) * scale,
        "W2": rng.normal(size=(n_hidden, n_out)) * scale,
        "b2": rng.normal(size=n_out) * scale,
    }


def grads_of(sub, x, params, target):
    _, cache = sub.mlp_forward(x, params)
    return sub.mlp_backward(params, cache, target)


def loss_of(sub, x, params, target):
    predicted, _ = sub.mlp_forward(x, params)
    return sub.mse_loss(predicted, target)


def check_against_finite_differences(sub, x, params, target):
    grads = grads_of(sub, x, params, target)
    for name in NAMES:
        def f(value, name=name):
            changed = dict(params)
            changed[name] = value
            return loss_of(sub, x, changed, target)
        numeric = numeric_grad(f, params[name])
        close(grads[name], numeric, atol=1e-7, rtol=1e-4, what=f"the gradient of {name}")


@check("examples", "forward pass of the two-example batch", "The output is sigmoid(sigmoid(x W1 + b1) W2 + b2), one row for each example.")
def example_forward(sub):
    predicted, _ = sub.mlp_forward(X, example_params())
    close(predicted, [[0.5464852], [0.68495157]], rtol=1e-6, what="the network output")


@check("examples", "loss of the two-example batch", "The loss is the mean of the squared differences over every entry of the output.")
def example_loss(sub):
    predicted, _ = sub.mlp_forward(X, example_params())
    close(sub.mse_loss(predicted, Y), 0.33741716, rtol=1e-6, what="the loss")


@check("examples", "gradients of the two-example batch", "Each gradient has the shape of its parameter. The values follow from the chain rule.")
def example_backward(sub):
    grads = grads_of(sub, X, example_params(), Y)
    close(grads["W2"], [[0.02881637], [-0.01942579], [0.07701337]], rtol=1e-6, what="the gradient of W2")
    close(grads["b2"], [0.03540898], rtol=1e-6, what="the gradient of b2")
    close(grads["W1"], [[0.03473536, -0.03551239, 0.01518726], [-0.02766515, 0.0235782, -0.01053007]], rtol=1e-6, what="the gradient of W1")
    close(grads["b1"], [0.0070702, -0.01193419, 0.0046572], rtol=1e-6, what="the gradient of b1")


@check("properties", "every gradient matches finite differences", "A gradient is correct when a small change in one parameter changes the loss by the gradient times that change.")
def finite_differences(sub):
    rng = np.random.default_rng(3)
    x = rng.normal(size=(5, 3))
    target = rng.random(size=(5, 2))
    check_against_finite_differences(sub, x, random_params(rng, 3, 4, 2), target)


@check("properties", "each gradient has the shape of its parameter", "The gradient of W1 has shape (n_in, n_hidden). The gradient of b1 has shape (n_hidden,). W2 and b2 follow the same rule.")
def gradient_shapes(sub):
    rng = np.random.default_rng(4)
    params = random_params(rng, 3, 5, 2)
    grads = grads_of(sub, rng.normal(size=(7, 3)), params, rng.random(size=(7, 2)))
    for name in NAMES:
        true(name in grads, f"the gradient dict has no key {name!r}", list(NAMES), sorted(grads))
        shape(grads[name], params[name].shape, what=f"the gradient of {name}")


@check("properties", "outputs are between 0 and 1", "The output layer is a sigmoid, so every output is in the open interval from 0 to 1.")
def output_range(sub):
    rng = np.random.default_rng(5)
    predicted, _ = sub.mlp_forward(rng.normal(size=(6, 3)) * 3, random_params(rng, 3, 4, 2))
    shape(predicted, (6, 2), what="the network output")
    true(np.all((predicted > 0) & (predicted < 1)), "an output is outside the interval from 0 to 1", "values in (0, 1)", predicted)


@check("properties", "a perfect prediction has zero gradient", "When the target equals the output, the loss is 0 and every gradient is 0.")
def zero_at_target(sub):
    rng = np.random.default_rng(6)
    x = rng.normal(size=(4, 3))
    params = random_params(rng, 3, 4, 2)
    predicted, _ = sub.mlp_forward(x, params)
    target = np.array(predicted, dtype=float)
    close(sub.mse_loss(predicted, target), 0.0, atol=1e-15, what="the loss")
    grads = grads_of(sub, x, params, target)
    for name in NAMES:
        close(grads[name], np.zeros(params[name].shape), atol=1e-15, what=f"the gradient of {name}")


@check("properties", "the inputs are not changed", "A function that writes into its input arrays breaks the code that calls it.")
def inputs_unchanged(sub):
    rng = np.random.default_rng(7)
    x = rng.normal(size=(3, 2))
    target = rng.random(size=(3, 1))
    params = random_params(rng, 2, 3, 1)
    saved = {name: params[name].copy() for name in NAMES}
    saved_x, saved_target = x.copy(), target.copy()
    grads_of(sub, x, params, target)
    close(x, saved_x, atol=0, rtol=0, what="x after the calls")
    close(target, saved_target, atol=0, rtol=0, what="the target after the calls")
    for name in NAMES:
        close(params[name], saved[name], atol=0, rtol=0, what=f"{name} after the calls")


@check("edge", "one example, one output", "The functions must work for the smallest batch: N = 1 and n_out = 1.")
def smallest_batch(sub):
    rng = np.random.default_rng(8)
    x = rng.normal(size=(1, 2))
    check_against_finite_differences(sub, x, random_params(rng, 2, 3, 1), np.array([[0.3]]))


@check("edge", "the loss divides by every output entry", "The mean runs over N times n_out entries. Dividing by N only gives a gradient that is n_out times too large.")
def many_outputs(sub):
    rng = np.random.default_rng(9)
    x = rng.normal(size=(2, 2))
    check_against_finite_differences(sub, x, random_params(rng, 2, 2, 4), rng.random(size=(2, 4)))


@check("edge", "large pre-activations stay finite", "A saturated sigmoid gives outputs near 0 or 1 and gradients near 0. No value can be NaN or infinite.")
def saturated(sub):
    x = np.array([[1.0, -1.0]])
    params = {"W1": np.array([[900.0, -900.0], [-900.0, 900.0]]), "b1": np.zeros(2), "W2": np.array([[800.0], [-800.0]]), "b2": np.zeros(1)}
    predicted, cache = sub.mlp_forward(x, params)
    close(predicted, [[1.0]], atol=1e-12, what="the network output")
    grads = sub.mlp_backward(params, cache, np.array([[0.0]]))
    for name in NAMES:
        close(grads[name], np.zeros(params[name].shape), atol=1e-12, what=f"the gradient of {name}")


@fixture("networks")
def networks(ref):
    rng = np.random.default_rng(42)
    for n, n_in, n_hidden, n_out in [(1, 2, 2, 1), (4, 3, 5, 2), (8, 4, 6, 3), (16, 2, 8, 1)]:
        x = rng.normal(size=(n, n_in))
        target = rng.random(size=(n, n_out))
        params = random_params(rng, n_in, n_hidden, n_out)
        predicted, cache = ref.mlp_forward(x, params)
        yield {"x": x, "target": target, "params": params}, {
            "output": predicted,
            "loss": ref.mse_loss(predicted, target),
            "grads": ref.mlp_backward(params, cache, target),
        }


@check("reference", "forward pass and loss match the reference", "Your output and loss agree with the reference solution on random networks of four sizes.")
def reference_forward(sub):
    for case, expected in fixtures("networks"):
        predicted, _ = sub.mlp_forward(case["x"], case["params"])
        size = case["x"].shape
        close(predicted, expected["output"], rtol=1e-7, atol=1e-12, what=f"the output for x of shape {size}")
        close(sub.mse_loss(predicted, case["target"]), expected["loss"], rtol=1e-7, what=f"the loss for x of shape {size}")


@check("reference", "gradients match the reference", "Your four gradients agree with the reference solution on the same random networks.")
def reference_backward(sub):
    for case, expected in fixtures("networks"):
        grads = grads_of(sub, case["x"], case["params"], case["target"])
        for name in NAMES:
            close(grads[name], expected["grads"][name], rtol=1e-7, atol=1e-12, what=f"the gradient of {name} for x of shape {case['x'].shape}")
