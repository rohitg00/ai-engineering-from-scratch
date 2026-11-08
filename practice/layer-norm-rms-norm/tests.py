import numpy as np

from practice_check import check, close, fixture, fixtures, shape, true

X = np.array([[1.0, 2.0, 3.0, 4.0], [2.0, -2.0, 0.0, 4.0]])
GAMMA = np.array([1.0, 1.0, 2.0, 0.5])
BETA = np.array([0.0, 0.5, 0.0, -1.0])


@check("examples", "LayerNorm of a 2 by 4 batch", "Each row is centered by its own mean and divided by sqrt(var + eps). Then each feature is scaled by gamma and shifted by beta.")
def example_layer_norm(sub):
    close(sub.layer_norm(X, GAMMA, BETA), [[-1.34163542, 0.05278819, 0.89442361, -0.32918229], [0.44721315, -0.84163944, -0.8944263, -0.32918028]], rtol=1e-6, what="the LayerNorm output")


@check("examples", "RMSNorm of the same batch", "Each row is divided by sqrt(mean(x^2) + eps), with no mean subtraction. Then each feature is scaled by weight.")
def example_rms_norm(sub):
    close(sub.rms_norm(X, GAMMA), [[0.36514835, 0.73029669, 2.19089008, 0.73029669], [0.81649651, -0.81649651, 0.0, 0.81649651]], rtol=1e-6, atol=1e-12, what="the RMSNorm output")


@check("properties", "LayerNorm rows have mean 0 and variance close to 1", "With gamma = 1 and beta = 0, each row of the output has mean 0 and variance var / (var + eps).")
def layer_norm_stats(sub):
    rng = np.random.default_rng(1)
    x = rng.normal(size=(7, 12)) * 3 + 2
    out = sub.layer_norm(x, np.ones(12), np.zeros(12))
    shape(out, x.shape, what="the LayerNorm output")
    close(np.mean(out, axis=-1), np.zeros(7), atol=1e-12, what="the row means")
    var = np.var(x, axis=-1)
    close(np.var(out, axis=-1), var / (var + 1e-5), rtol=1e-9, what="the row variances")


@check("properties", "RMSNorm rows have a root mean square close to 1", "With weight = 1, each output row has mean(out^2) = ms / (ms + eps), where ms is mean(x^2) of the input row.")
def rms_norm_stats(sub):
    rng = np.random.default_rng(2)
    x = rng.normal(size=(6, 10)) + 1.5
    out = sub.rms_norm(x, np.ones(10))
    shape(out, x.shape, what="the RMSNorm output")
    ms = np.mean(x * x, axis=-1)
    close(np.mean(out * out, axis=-1), ms / (ms + 1e-6), rtol=1e-9, what="the mean square of each output row")


@check("properties", "the norms normalize over the last axis only", "Each row is normalized on its own. The output of one row does not change when the other rows change.")
def row_independence(sub):
    rng = np.random.default_rng(3)
    x = rng.normal(size=(5, 6))
    gamma, beta = rng.normal(size=6), rng.normal(size=6)
    y = x.copy()
    y[1:] = rng.normal(size=(4, 6)) * 10
    close(sub.layer_norm(y, gamma, beta)[0], sub.layer_norm(x, gamma, beta)[0], rtol=1e-12, what="LayerNorm of row 0")
    close(sub.rms_norm(y, gamma)[0], sub.rms_norm(x, gamma)[0], rtol=1e-12, what="RMSNorm of row 0")


@check("properties", "LayerNorm ignores a shift of a row and RMSNorm ignores a scale", "LayerNorm subtracts the mean, so adding a constant to a row does nothing. Both norms divide by a size of the row, so a positive scale nearly does nothing.")
def invariances(sub):
    rng = np.random.default_rng(4)
    x = rng.normal(size=(4, 8)) * 2
    gamma, beta = rng.normal(size=8), rng.normal(size=8)
    close(sub.layer_norm(x + 5.0, gamma, beta), sub.layer_norm(x, gamma, beta), atol=1e-9, what="LayerNorm of x + 5")
    close(sub.rms_norm(x * 10.0, gamma), sub.rms_norm(x, gamma), atol=1e-5, what="RMSNorm of 10 x")


@check("properties", "works for any number of leading axes", "A transformer input has shape (batch, seq, d_model). The norms act on the last axis, and the output has the shape of the input.")
def leading_axes(sub):
    rng = np.random.default_rng(5)
    x = rng.normal(size=(2, 3, 4))
    gamma, beta = rng.normal(size=4), rng.normal(size=4)
    out = sub.layer_norm(x, gamma, beta)
    shape(out, (2, 3, 4), what="the LayerNorm output")
    close(out.reshape(6, 4), sub.layer_norm(x.reshape(6, 4), gamma, beta), rtol=1e-12, what="LayerNorm of the 3D input")
    out = sub.rms_norm(x, gamma)
    shape(out, (2, 3, 4), what="the RMSNorm output")
    close(out.reshape(6, 4), sub.rms_norm(x.reshape(6, 4), gamma), rtol=1e-12, what="RMSNorm of the 3D input")


@check("properties", "the inputs are not changed", "A function that writes into its input array breaks the code that calls it.")
def inputs_unchanged(sub):
    x, gamma, beta = X.copy(), GAMMA.copy(), BETA.copy()
    sub.layer_norm(x, gamma, beta)
    sub.rms_norm(x, gamma)
    for name, after, before in (("x", x, X), ("gamma", gamma, GAMMA), ("beta", beta, BETA)):
        close(after, before, atol=0, rtol=0, what=f"{name} after the calls")


@check("edge", "a constant row and a zero row", "LayerNorm of a constant row gives beta. RMSNorm of a row of zeros gives zeros. Neither can give NaN.")
def degenerate_rows(sub):
    gamma, beta = np.array([2.0, 3.0, 4.0]), np.array([0.1, 0.2, 0.3])
    out = sub.layer_norm(np.array([[5.0, 5.0, 5.0]]), gamma, beta)
    close(out, [[0.1, 0.2, 0.3]], atol=1e-12, what="LayerNorm of a constant row")
    out = sub.rms_norm(np.zeros((1, 3)), gamma)
    close(out, [[0.0, 0.0, 0.0]], atol=0, what="RMSNorm of a zero row")


@check("edge", "small values use eps inside the square root", "The denominators are sqrt(var + eps) and sqrt(mean(x^2) + eps). With values near sqrt(eps), sqrt(var) + eps gives a very different result.")
def small_values(sub):
    x = np.array([[0.001, -0.002, 0.003, 0.0]])
    ones, zeros = np.ones(4), np.zeros(4)
    mean = np.mean(x, axis=-1, keepdims=True)
    var = np.mean((x - mean) ** 2, axis=-1, keepdims=True)
    close(sub.layer_norm(x, ones, zeros), (x - mean) / np.sqrt(var + 1e-5), rtol=1e-9, what="LayerNorm of small values")
    ms = np.mean(x * x, axis=-1, keepdims=True)
    close(sub.rms_norm(x, ones), x / np.sqrt(ms + 1e-6), rtol=1e-9, what="RMSNorm of small values")


@check("edge", "a custom eps", "The eps argument changes the denominator. Use the eps that the caller passes.")
def custom_eps(sub):
    x = np.array([[0.0, 1.0]])
    close(sub.layer_norm(x, np.ones(2), np.zeros(2), eps=0.75), [[-0.5, 0.5]], rtol=1e-12, what="LayerNorm with eps = 0.75")
    close(sub.rms_norm(x, np.ones(2), eps=1.5), [[0.0, 0.70710678]], rtol=1e-6, what="RMSNorm with eps = 1.5")


@check("edge", "one feature", "With D = 1, the row minus its mean is 0, so LayerNorm gives beta. RMSNorm gives x / sqrt(x^2 + eps), which is close to the sign of x.")
def one_feature(sub):
    x = np.array([[3.0], [-2.0]])
    close(sub.layer_norm(x, np.array([5.0]), np.array([0.25])), [[0.25], [0.25]], atol=1e-12, what="LayerNorm with one feature")
    close(sub.rms_norm(x, np.array([1.0])), [[1.0], [-1.0]], atol=1e-6, what="RMSNorm with one feature")


@fixture("batches")
def batches(ref):
    rng = np.random.default_rng(42)
    for shape_, scale in [((1, 3), 1.0), ((4, 8), 5.0), ((2, 3, 6), 0.5), ((6, 16), 20.0)]:
        x = rng.normal(size=shape_) * scale + rng.normal()
        d = shape_[-1]
        gamma, beta = rng.normal(size=d), rng.normal(size=d)
        yield {"x": x, "gamma": gamma, "beta": beta}, {"layer": ref.layer_norm(x, gamma, beta), "rms": ref.rms_norm(x, gamma)}


@check("reference", "LayerNorm matches the reference", "Your LayerNorm agrees with the reference solution on random inputs of four shapes and scales.")
def reference_layer(sub):
    for case, expected in fixtures("batches"):
        close(sub.layer_norm(case["x"], case["gamma"], case["beta"]), expected["layer"], rtol=1e-7, atol=1e-12, what=f"LayerNorm for x of shape {case['x'].shape}")


@check("reference", "RMSNorm matches the reference", "Your RMSNorm agrees with the reference solution on the same inputs.")
def reference_rms(sub):
    for case, expected in fixtures("batches"):
        close(sub.rms_norm(case["x"], case["gamma"]), expected["rms"], rtol=1e-7, atol=1e-12, what=f"RMSNorm for x of shape {case['x'].shape}")
