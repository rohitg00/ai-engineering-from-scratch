import numpy as np

from practice_check import check, close, equal, fixture, fixtures, numeric_grad, shape, true

X = np.array([[1.0, 2.0, 3.0, 4.0], [5.0, 6.0, 7.0, 8.0]])


@check("examples", "training forward with p = 0.5 and seed 0", "Keep an entry when rng.random(x.shape) is at least p. Divide the kept entries by 1 - p. Set the others to 0.")
def example_forward(sub):
    out, mask = sub.dropout_forward(X, 0.5, np.random.default_rng(0))
    close(out, [[2.0, 0.0, 0.0, 0.0], [10.0, 12.0, 14.0, 16.0]], what="the output")
    equal(np.asarray(mask, dtype=bool), np.array([[True, False, False, False], [True, True, True, True]]), what="the mask")


@check("examples", "backward with the same mask", "The gradient flows only through the kept entries, and it gets the same scale 1 / (1 - p).")
def example_backward(sub):
    _, mask = sub.dropout_forward(X, 0.5, np.random.default_rng(0))
    close(sub.dropout_backward(np.ones((2, 4)), mask, 0.5), [[2.0, 0.0, 0.0, 0.0], [2.0, 2.0, 2.0, 2.0]], what="the input gradient")


@check("examples", "inference mode returns the input", "In inference mode dropout does nothing. The output equals x and the mask keeps every entry.")
def example_eval(sub):
    out, mask = sub.dropout_forward(X, 0.5, np.random.default_rng(0), training=False)
    close(out, X, atol=0, rtol=0, what="the inference output")
    equal(np.asarray(mask, dtype=bool), np.ones((2, 4), dtype=bool), what="the inference mask")


@check("properties", "the mask and the output agree", "Each output entry is 0 where the mask is False and x / (1 - p) where the mask is True. The mask is a bool array with the shape of x.")
def mask_matches_output(sub):
    rng = np.random.default_rng(1)
    x = rng.normal(size=(6, 7)) + 5.0
    p = 0.3
    out, mask = sub.dropout_forward(x, p, np.random.default_rng(11))
    shape(out, x.shape, what="the output")
    shape(mask, x.shape, what="the mask")
    true(np.asarray(mask).dtype == bool, "the mask is not a bool array", "bool", str(np.asarray(mask).dtype))
    close(out, np.where(mask, x / (1 - p), 0.0), rtol=1e-12, what="the output compared with the mask")


@check("properties", "the mask uses one call of rng.random with the shape of x", "The mask must be rng.random(x.shape) >= p. Any other draw from the generator gives a different mask.")
def mask_convention(sub):
    x = np.ones((5, 8))
    p = 0.4
    _, mask = sub.dropout_forward(x, p, np.random.default_rng(12))
    expected = np.random.default_rng(12).random((5, 8)) >= p
    equal(np.asarray(mask, dtype=bool), expected, what="the mask for seed 12 and p = 0.4")


@check("properties", "the expected output equals the input", "Inverted dropout keeps the mean. Over many entries, the mean of the output is close to the mean of x.")
def keeps_mean(sub):
    x = np.full((200, 200), 3.0)
    out, _ = sub.dropout_forward(x, 0.25, np.random.default_rng(13))
    close(np.mean(out), 3.0, rtol=0.02, what="the mean of the output")


@check("properties", "backward matches finite differences", "With a fixed mask, dropout is linear in x. A small change in x changes the loss by the gradient times that change.")
def finite_differences(sub):
    rng = np.random.default_rng(2)
    x = rng.normal(size=(3, 4))
    upstream = rng.normal(size=(3, 4))
    p = 0.35
    def loss(v):
        return float(np.sum(sub.dropout_forward(v, p, np.random.default_rng(21))[0] * upstream))
    _, mask = sub.dropout_forward(x, p, np.random.default_rng(21))
    close(sub.dropout_backward(upstream, mask, p), numeric_grad(loss, x), atol=1e-7, rtol=1e-5, what="the input gradient")


@check("properties", "the inputs are not changed", "A function that writes into its input array breaks the code that calls it.")
def inputs_unchanged(sub):
    x = X.copy()
    upstream = np.arange(8.0).reshape(2, 4)
    saved_upstream = upstream.copy()
    _, mask = sub.dropout_forward(x, 0.5, np.random.default_rng(0))
    saved_mask = np.array(mask, copy=True)
    sub.dropout_backward(upstream, mask, 0.5)
    sub.dropout_forward(x, 0.5, np.random.default_rng(0), training=False)
    close(x, X, atol=0, rtol=0, what="x after the calls")
    close(upstream, saved_upstream, atol=0, rtol=0, what="grad_output after the calls")
    equal(np.asarray(mask), saved_mask, what="the mask after the backward call")


@check("edge", "p = 0 keeps every entry", "With p = 0, every entry is kept and the scale is 1. The output equals x.")
def p_zero(sub):
    rng = np.random.default_rng(3)
    x = rng.normal(size=(4, 5))
    out, mask = sub.dropout_forward(x, 0.0, np.random.default_rng(4))
    close(out, x, rtol=1e-15, atol=0, what="the output for p = 0")
    true(bool(np.all(mask)), "the mask drops an entry for p = 0", "every entry True", mask)


@check("edge", "inference mode does not use the generator", "In inference mode, do not draw from rng. The next number from rng must be the same as from a new generator with the same seed.")
def eval_no_draw(sub):
    rng = np.random.default_rng(5)
    sub.dropout_forward(X, 0.5, rng, training=False)
    close(rng.random(), np.random.default_rng(5).random(), atol=0, rtol=0, what="the next number from rng after an inference call")


@check("edge", "inference mode returns a new array", "The inference output must be a copy. A caller that changes the output must not change x.")
def eval_copy(sub):
    x = X.copy()
    out, _ = sub.dropout_forward(x, 0.5, np.random.default_rng(0), training=False)
    true(not np.shares_memory(out, x), "the inference output shares memory with x", "a new array", "the same array as x")
    close(out, X, atol=0, rtol=0, what="the inference output")


@check("edge", "works for any number of axes", "Dropout acts on each entry. It must work for 1D and 3D inputs, with a mask of the same shape.")
def any_shape(sub):
    x1 = np.arange(1.0, 7.0)
    out1, mask1 = sub.dropout_forward(x1, 0.5, np.random.default_rng(6))
    close(out1, np.where(np.random.default_rng(6).random(6) >= 0.5, x1 * 2.0, 0.0), what="the output for a 1D input")
    x3 = np.ones((2, 3, 4))
    out3, mask3 = sub.dropout_forward(x3, 0.2, np.random.default_rng(7))
    shape(out3, (2, 3, 4), what="the output for a 3D input")
    shape(mask3, (2, 3, 4), what="the mask for a 3D input")


@fixture("draws")
def draws(ref):
    rng = np.random.default_rng(42)
    for shape_, p, seed in [((3,), 0.5, 1), ((4, 5), 0.1, 2), ((6, 6), 0.5, 3), ((2, 3, 4), 0.8, 4)]:
        x = rng.normal(size=shape_)
        upstream = rng.normal(size=shape_)
        out, mask = ref.dropout_forward(x, p, np.random.default_rng(seed))
        yield {"x": x, "p": p, "seed": seed, "upstream": upstream}, {"out": out, "mask": mask, "grad": ref.dropout_backward(upstream, mask, p)}


@check("reference", "forward matches the reference", "Your output and mask agree with the reference solution for four shapes, values of p and seeds.")
def reference_forward(sub):
    for case, expected in fixtures("draws"):
        out, mask = sub.dropout_forward(case["x"], case["p"], np.random.default_rng(case["seed"]))
        label = f"x of shape {case['x'].shape} with p = {case['p']}"
        equal(np.asarray(mask, dtype=bool), expected["mask"], what=f"the mask for {label}")
        close(out, expected["out"], rtol=1e-12, atol=1e-15, what=f"the output for {label}")


@check("reference", "backward matches the reference", "Your input gradient agrees with the reference solution for the same cases.")
def reference_backward(sub):
    for case, expected in fixtures("draws"):
        close(sub.dropout_backward(case["upstream"], expected["mask"], case["p"]), expected["grad"], rtol=1e-12, atol=1e-15, what=f"the gradient for x of shape {case['x'].shape} with p = {case['p']}")
