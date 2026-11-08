import numpy as np

from practice_check import check, close, fixture, fixtures, numeric_grad, shape, true

X = np.array([[1.0, 2.0], [3.0, 6.0], [5.0, 10.0]])
GAMMA = np.array([1.0, 0.5])
BETA = np.array([0.0, 1.0])
GRAD = np.array([[1.0, 0.0], [0.0, 1.0], [1.0, 1.0]])


def train(sub, x, gamma, beta, momentum=0.1, eps=1e-5):
    d = x.shape[1]
    return sub.batchnorm_forward(x, gamma, beta, np.zeros(d), np.ones(d), momentum=momentum, eps=eps, training=True)


@check("examples", "training forward of the three-example batch", "Each feature is normalized with the mean and the biased variance of its column, then scaled by gamma and shifted by beta.")
def example_forward(sub):
    out, _, _, _ = train(sub, X, GAMMA, BETA)
    close(out, [[-1.22474258, 0.38762785], [0.0, 1.0], [1.22474258, 1.61237215]], rtol=1e-6, what="the output")


@check("examples", "running statistics after one step", "The new running value is (1 - momentum) times the old value plus momentum times the batch value.")
def example_running(sub):
    _, _, new_mean, new_var = train(sub, X, GAMMA, BETA)
    close(new_mean, [0.3, 0.6], rtol=1e-6, what="the new running mean")
    close(new_var, [1.16666667, 1.96666667], rtol=1e-6, what="the new running variance")


@check("examples", "backward of the three-example batch", "dbeta is the column sum of the upstream gradient. dgamma is the column sum of the upstream gradient times x_hat.")
def example_backward(sub):
    _, cache, _, _ = train(sub, X, GAMMA, BETA)
    dx, dgamma, dbeta = sub.batchnorm_backward(GRAD, cache)
    close(dx, [[0.20412376, -0.02551558], [-0.40824753, 0.05103101], [0.20412376, -0.02551543]], rtol=1e-6, atol=1e-9, what="dx")
    close(dgamma, [0.0, 1.2247443], rtol=1e-6, atol=1e-9, what="dgamma")
    close(dbeta, [2.0, 2.0], rtol=1e-6, what="dbeta")


@check("examples", "inference forward uses the running statistics", "In inference mode the layer uses the running mean and the running variance, not the statistics of the batch.")
def example_inference(sub):
    out, _, mean, var = sub.batchnorm_forward(np.array([[2.0, 4.0]]), GAMMA, BETA, np.array([0.3, 0.6]), np.array([1.16666667, 1.96666667]), training=False)
    close(out, [[1.57388742, 2.21222277]], rtol=1e-6, what="the inference output")
    close(mean, [0.3, 0.6], rtol=0, atol=0, what="the running mean returned in inference mode")
    close(var, [1.16666667, 1.96666667], rtol=0, atol=0, what="the running variance returned in inference mode")


@check("properties", "training output has mean beta in each column", "x_hat has mean 0 in each column. After the scale and the shift, the mean of each column is beta.")
def column_mean(sub):
    rng = np.random.default_rng(1)
    x = rng.normal(size=(16, 5)) * 4 + 3
    gamma = rng.normal(size=5)
    beta = rng.normal(size=5)
    out, _, _, _ = train(sub, x, gamma, beta)
    shape(out, x.shape, what="the output")
    close(np.mean(out, axis=0), beta, atol=1e-9, what="the column means of the output")


@check("properties", "x_hat has variance close to 1", "With gamma = 1 and beta = 0, each column of the output has variance var / (var + eps), which is close to 1.")
def column_variance(sub):
    rng = np.random.default_rng(2)
    x = rng.normal(size=(32, 4)) * 2
    out, _, _, _ = train(sub, x, np.ones(4), np.zeros(4))
    var = np.var(x, axis=0)
    close(np.var(out, axis=0), var / (var + 1e-5), rtol=1e-9, what="the column variances of the output")


@check("properties", "every gradient matches finite differences", "The loss here is sum(out * G) for a fixed G. A correct dx also includes the effect of x on the batch mean and the batch variance.")
def finite_differences(sub):
    rng = np.random.default_rng(3)
    x = rng.normal(size=(5, 3))
    gamma = rng.normal(size=3)
    beta = rng.normal(size=3)
    upstream = rng.normal(size=(5, 3))
    _, cache, _, _ = train(sub, x, gamma, beta)
    dx, dgamma, dbeta = sub.batchnorm_backward(upstream, cache)
    def loss(x_, g_, b_):
        return float(np.sum(train(sub, x_, g_, b_)[0] * upstream))
    close(dx, numeric_grad(lambda v: loss(v, gamma, beta), x), atol=1e-6, rtol=1e-4, what="dx")
    close(dgamma, numeric_grad(lambda v: loss(x, v, beta), gamma), atol=1e-6, rtol=1e-4, what="dgamma")
    close(dbeta, numeric_grad(lambda v: loss(x, gamma, v), beta), atol=1e-6, rtol=1e-4, what="dbeta")


@check("properties", "each column of dx sums to 0", "Adding a constant to a column of x does not change the output, so the gradient along that direction is 0.")
def dx_sums_to_zero(sub):
    rng = np.random.default_rng(4)
    x = rng.normal(size=(8, 3))
    _, cache, _, _ = train(sub, x, rng.normal(size=3), rng.normal(size=3))
    dx, _, _ = sub.batchnorm_backward(rng.normal(size=(8, 3)), cache)
    close(np.sum(dx, axis=0), np.zeros(3), atol=1e-12, what="the column sums of dx")


@check("properties", "the inputs are not changed", "Return new running statistics. Do not write into x, gamma, beta or the running arrays that the caller passes.")
def inputs_unchanged(sub):
    rng = np.random.default_rng(5)
    x = rng.normal(size=(4, 3))
    gamma, beta = rng.normal(size=3), rng.normal(size=3)
    running_mean, running_var = rng.normal(size=3), rng.random(size=3) + 0.5
    upstream = rng.normal(size=(4, 3))
    saved = [a.copy() for a in (x, gamma, beta, running_mean, running_var, upstream)]
    _, cache, _, _ = sub.batchnorm_forward(x, gamma, beta, running_mean, running_var, training=True)
    sub.batchnorm_backward(upstream, cache)
    sub.batchnorm_forward(x, gamma, beta, running_mean, running_var, training=False)
    for name, before, after in zip(("x", "gamma", "beta", "running_mean", "running_var", "grad_output"), saved, (x, gamma, beta, running_mean, running_var, upstream)):
        close(after, before, atol=0, rtol=0, what=f"{name} after the calls")


@check("edge", "small variance uses eps inside the square root", "The denominator is sqrt(var + eps). With a variance near eps, sqrt(var) + eps gives a very different result.")
def small_variance(sub):
    x = np.array([[0.0, 1.0], [0.002, 1.0], [0.004, 1.0005]])
    out, _, _, _ = train(sub, x, np.ones(2), np.zeros(2))
    var = np.var(x, axis=0)
    expected = (x - np.mean(x, axis=0)) / np.sqrt(var + 1e-5)
    close(out, expected, rtol=1e-9, atol=1e-12, what="the output for features with a small variance")


@check("edge", "a constant column gives beta", "When every value in a column is the same, the variance is 0 and x_hat is 0. The output of that column is beta.")
def constant_column(sub):
    x = np.array([[2.0, 1.0], [2.0, 3.0], [2.0, 5.0]])
    out, cache, _, _ = train(sub, x, np.array([3.0, 1.0]), np.array([0.5, 0.0]))
    close(out[:, 0], [0.5, 0.5, 0.5], atol=1e-12, what="the output of the constant column")
    dx, _, _ = sub.batchnorm_backward(np.ones((3, 2)), cache)
    true(np.all(np.isfinite(dx)), "dx has NaN or infinite values", "finite values", dx)


@check("edge", "momentum 1 and momentum 0", "With momentum 1 the running statistics become the batch statistics. With momentum 0 they do not change.")
def momentum_limits(sub):
    x = np.array([[1.0, -2.0], [3.0, 0.0], [8.0, 5.0]])
    old_mean, old_var = np.array([0.5, -0.5]), np.array([2.0, 3.0])
    _, _, mean1, var1 = sub.batchnorm_forward(x, np.ones(2), np.zeros(2), old_mean, old_var, momentum=1.0, training=True)
    close(mean1, np.mean(x, axis=0), rtol=1e-12, what="the running mean with momentum 1")
    close(var1, np.var(x, axis=0), rtol=1e-12, what="the running variance with momentum 1")
    _, _, mean0, var0 = sub.batchnorm_forward(x, np.ones(2), np.zeros(2), old_mean, old_var, momentum=0.0, training=True)
    close(mean0, old_mean, rtol=1e-12, what="the running mean with momentum 0")
    close(var0, old_var, rtol=1e-12, what="the running variance with momentum 0")


@check("edge", "inference does not depend on the batch", "In inference mode each row uses only the running statistics. The output of a row is the same alone or in a batch.")
def inference_rows(sub):
    rng = np.random.default_rng(6)
    x = rng.normal(size=(5, 3))
    args = (rng.normal(size=3), rng.normal(size=3), rng.normal(size=3), rng.random(size=3) + 0.5)
    full, _, _, _ = sub.batchnorm_forward(x, *args, training=False)
    single, _, _, _ = sub.batchnorm_forward(x[2:3], *args, training=False)
    close(single, full[2:3], rtol=1e-12, what="the inference output of row 2 alone")


@fixture("batches")
def batches(ref):
    rng = np.random.default_rng(42)
    for n, d, momentum in [(2, 1, 0.1), (4, 3, 0.1), (8, 5, 0.2), (16, 4, 0.05)]:
        x = rng.normal(size=(n, d)) * 3 + 1
        gamma = rng.normal(size=d)
        beta = rng.normal(size=d)
        running_mean = rng.normal(size=d)
        running_var = rng.random(size=d) + 0.5
        upstream = rng.normal(size=(n, d))
        out, cache, new_mean, new_var = ref.batchnorm_forward(x, gamma, beta, running_mean, running_var, momentum=momentum, training=True)
        dx, dgamma, dbeta = ref.batchnorm_backward(upstream, cache)
        infer, _, _, _ = ref.batchnorm_forward(x, gamma, beta, new_mean, new_var, momentum=momentum, training=False)
        yield {"x": x, "gamma": gamma, "beta": beta, "running_mean": running_mean, "running_var": running_var, "momentum": momentum, "upstream": upstream}, {
            "out": out, "mean": new_mean, "var": new_var, "dx": dx, "dgamma": dgamma, "dbeta": dbeta, "infer": infer,
        }


@check("reference", "forward and running statistics match the reference", "Your training output, running statistics and inference output agree with the reference solution on random batches.")
def reference_forward(sub):
    for case, expected in fixtures("batches"):
        out, _, mean, var = sub.batchnorm_forward(case["x"], case["gamma"], case["beta"], case["running_mean"], case["running_var"], momentum=case["momentum"], training=True)
        size = case["x"].shape
        close(out, expected["out"], rtol=1e-7, atol=1e-12, what=f"the training output for x of shape {size}")
        close(mean, expected["mean"], rtol=1e-7, atol=1e-12, what=f"the running mean for x of shape {size}")
        close(var, expected["var"], rtol=1e-7, atol=1e-12, what=f"the running variance for x of shape {size}")
        infer, _, _, _ = sub.batchnorm_forward(case["x"], case["gamma"], case["beta"], expected["mean"], expected["var"], momentum=case["momentum"], training=False)
        close(infer, expected["infer"], rtol=1e-7, atol=1e-12, what=f"the inference output for x of shape {size}")


@check("reference", "gradients match the reference", "Your dx, dgamma and dbeta agree with the reference solution on the same random batches.")
def reference_backward(sub):
    for case, expected in fixtures("batches"):
        _, cache, _, _ = sub.batchnorm_forward(case["x"], case["gamma"], case["beta"], case["running_mean"], case["running_var"], momentum=case["momentum"], training=True)
        dx, dgamma, dbeta = sub.batchnorm_backward(case["upstream"], cache)
        size = case["x"].shape
        close(dx, expected["dx"], rtol=1e-7, atol=1e-12, what=f"dx for x of shape {size}")
        close(dgamma, expected["dgamma"], rtol=1e-7, atol=1e-12, what=f"dgamma for x of shape {size}")
        close(dbeta, expected["dbeta"], rtol=1e-7, atol=1e-12, what=f"dbeta for x of shape {size}")
