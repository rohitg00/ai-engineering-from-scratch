import numpy as np

from practice_check import check, close, fixture, fixtures, numeric_grad, shape, true

X = np.array([2.0, -1.0, 0.5, -3.0])
Y = np.array([1.0, 1.0, 0.0, 0.0])
L = np.array([[2.0, 1.0, 0.1], [0.5, 2.5, 0.3]])
T = np.array([0, 1])


def bce(logits, targets):
    return float(np.mean(np.logaddexp(0.0, logits) - targets * logits))


def cross_entropy(logits, targets):
    shifted = logits - np.max(logits, axis=1, keepdims=True)
    log_probs = shifted - np.log(np.sum(np.exp(shifted), axis=1, keepdims=True))
    return float(-np.mean(log_probs[np.arange(len(targets)), targets]))


@check("examples", "binary focal loss with gamma 0 and gamma 2", "p_t is sigmoid(x) for a positive target and 1 - sigmoid(x) for a negative target. The loss is the mean of -(1 - p_t)^gamma log(p_t).")
def example_binary(sub):
    close(sub.binary_focal_loss(X, Y, 0.0), 0.6157135085787611, rtol=1e-9, what="the loss with gamma = 0")
    close(sub.binary_focal_loss(X, Y, 2.0), 0.270298187607633, rtol=1e-9, what="the loss with gamma = 2")


@check("examples", "binary focal loss and gradient with alpha 0.25", "alpha_t is alpha for a positive target and 1 - alpha for a negative target.")
def example_alpha(sub):
    close(sub.binary_focal_loss(X, Y, 2.0, 0.25), 0.1147646574248966, rtol=1e-9, what="the loss")
    close(sub.binary_focal_grad(X, Y, 2.0, 0.25), [-3.04433762e-04, -4.80146702e-02, 9.86534666e-02, 5.90384712e-05], rtol=1e-6, what="the gradient")


@check("examples", "multi-class focal loss", "p_t is the softmax probability of the target class. A per-class alpha multiplies the loss of each example by alpha[target].")
def example_multiclass(sub):
    close(sub.focal_loss(L, T, 0.0), 0.31853976964918573, rtol=1e-9, what="the loss with gamma = 0")
    close(sub.focal_loss(L, T, 2.0), 0.02853873533647399, rtol=1e-9, what="the loss with gamma = 2")
    close(sub.focal_loss(L, T, 2.0, np.array([0.5, 1.0, 2.0])), 0.016415649484550623, rtol=1e-9, what="the loss with a per-class alpha")


@check("properties", "gamma 0 and no alpha give cross-entropy", "With gamma = 0 the factor (1 - p_t)^gamma is 1. Without alpha, focal loss is the ordinary cross-entropy.")
def equals_cross_entropy(sub):
    rng = np.random.default_rng(0)
    x = rng.normal(size=9) * 3
    y = (rng.random(9) < 0.5).astype(float)
    close(sub.binary_focal_loss(x, y, 0.0), bce(x, y), rtol=1e-12, what="the binary loss")
    logits = rng.normal(size=(6, 5)) * 2
    targets = rng.integers(0, 5, size=6)
    close(sub.focal_loss(logits, targets, 0.0), cross_entropy(logits, targets), rtol=1e-12, what="the multi-class loss")


@check("properties", "focal loss is at most cross-entropy and falls with gamma", "(1 - p_t)^gamma is at most 1 and gets smaller as gamma grows. So a larger gamma gives a smaller loss.")
def below_cross_entropy(sub):
    rng = np.random.default_rng(1)
    logits = rng.normal(size=(8, 4)) * 2
    targets = rng.integers(0, 4, size=8)
    losses = [sub.focal_loss(logits, targets, g) for g in [0.0, 0.5, 1.0, 2.0, 5.0]]
    true(all(a > b for a, b in zip(losses, losses[1:])), "The loss does not fall when gamma grows", "a decreasing list", losses)


@check("properties", "an easy example gets a small weight", "For one example with p_t = 0.9 and gamma = 2, the focal loss is (0.1)^2 = 0.01 times the cross-entropy. For p_t = 0.1 the factor is 0.81.")
def easy_down_weighted(sub):
    for pt, factor in [(0.9, 0.01), (0.1, 0.81)]:
        x = np.array([np.log(pt / (1.0 - pt))])
        y = np.array([1.0])
        close(sub.binary_focal_loss(x, y, 2.0), factor * -np.log(pt), rtol=1e-9, what=f"the loss for p_t = {pt}")


@check("properties", "two classes match the binary loss", "Softmax over the logits [0, x] gives sigmoid(x) for class 1. So the multi-class loss with these logits equals the binary loss with logit x.")
def two_class_matches_binary(sub):
    rng = np.random.default_rng(2)
    x = rng.normal(size=7) * 2
    y = rng.integers(0, 2, size=7)
    logits = np.stack([np.zeros(7), x], axis=1)
    close(sub.focal_loss(logits, y, 2.0, np.array([0.75, 0.25])), sub.binary_focal_loss(x, y.astype(float), 2.0, 0.25), rtol=1e-12, what="the multi-class loss")


@check("properties", "the gradient matches finite differences", "Change one logit by a small amount. The loss must change by the gradient times that amount. The factor (1 - p_t)^gamma also depends on the logit.")
def finite_differences(sub):
    rng = np.random.default_rng(3)
    x = rng.normal(size=6) * 2
    y = (rng.random(6) < 0.5).astype(float)
    for gamma, alpha in [(0.0, None), (2.0, None), (1.5, 0.25)]:
        numeric = numeric_grad(lambda z: sub.binary_focal_loss(z, y, gamma, alpha), x)
        grad = sub.binary_focal_grad(x, y, gamma, alpha)
        shape(grad, (6,), what="the gradient")
        close(grad, numeric, rtol=1e-5, atol=1e-8, what=f"the gradient with gamma = {gamma} and alpha = {alpha}")


@check("properties", "the inputs are not changed", "A function that writes into the logits or the targets breaks the training loop that calls it.")
def inputs_unchanged(sub):
    x, y, logits, targets = X.copy(), Y.copy(), L.copy(), T.copy()
    sub.binary_focal_loss(x, y, 2.0, 0.25)
    sub.binary_focal_grad(x, y, 2.0, 0.25)
    sub.focal_loss(logits, targets, 2.0, np.array([1.0, 2.0, 3.0]))
    for name, before, after in [("the binary logits", X, x), ("the binary targets", Y, y), ("the logits", L, logits), ("the targets", T, targets)]:
        true(np.array_equal(before, after), f"The function changed {name}", before, after)


@check("edge", "very large logits stay finite", "For a logit of minus 1000 and a positive target, sigmoid rounds to 0 and log(0) is minus infinity. Compute log p_t as -log(1 + exp(-s)) with np.logaddexp. The loss of that example is 1000.")
def large_logits(sub):
    x = np.array([1000.0, -1000.0])
    y = np.array([1.0, 1.0])
    close(sub.binary_focal_loss(x, y, 2.0), 500.0, rtol=1e-12, what="the loss")
    close(sub.binary_focal_grad(x, y, 2.0), [0.0, -0.5], atol=1e-12, what="the gradient")
    close(sub.focal_loss(np.array([[1000.0, 0.0], [-1000.0, 0.0]]), np.array([0, 0]), 2.0), 500.0, rtol=1e-12, what="the multi-class loss")


@check("edge", "alpha 0.25 weights negatives by 0.75", "With gamma = 0, the loss of a negative example is (1 - alpha) times its cross-entropy, and a positive example is alpha times its cross-entropy.")
def alpha_negatives(sub):
    x = np.array([0.3])
    close(sub.binary_focal_loss(x, np.array([0.0]), 0.0, 0.25), 0.75 * bce(x, np.array([0.0])), rtol=1e-12, what="the loss of a negative example")
    close(sub.binary_focal_loss(x, np.array([1.0]), 0.0, 0.25), 0.25 * bce(x, np.array([1.0])), rtol=1e-12, what="the loss of a positive example")


@fixture("cases")
def cases(ref):
    rng = np.random.default_rng(42)
    for n, c, gamma, alpha in [(3, 2, 0.5, None), (5, 3, 2.0, 0.25), (8, 4, 1.0, 0.6), (4, 6, 3.0, None)]:
        x = rng.normal(size=n) * 3
        y = (rng.random(n) < 0.4).astype(float)
        logits = rng.normal(size=(n, c)) * 2
        targets = rng.integers(0, c, size=n)
        class_alpha = None if alpha is None else rng.random(c) + 0.1
        yield {"x": x, "y": y, "logits": logits, "targets": targets, "gamma": gamma, "alpha": alpha, "class_alpha": class_alpha}, {"binary": ref.binary_focal_loss(x, y, gamma, alpha), "grad": ref.binary_focal_grad(x, y, gamma, alpha), "multi": ref.focal_loss(logits, targets, gamma, class_alpha)}


@check("reference", "losses and gradients match the reference", "Your functions agree with the reference solution on random batches with several values of gamma and alpha.")
def reference_cases(sub):
    for case, expected in fixtures("cases"):
        label = f"N = {case['x'].size}, gamma = {case['gamma']} and alpha = {case['alpha']}"
        close(sub.binary_focal_loss(case["x"], case["y"], case["gamma"], case["alpha"]), expected["binary"], rtol=1e-9, what=f"the binary loss for {label}")
        close(sub.binary_focal_grad(case["x"], case["y"], case["gamma"], case["alpha"]), expected["grad"], rtol=1e-9, atol=1e-14, what=f"the gradient for {label}")
        close(sub.focal_loss(case["logits"], case["targets"], case["gamma"], case["class_alpha"]), expected["multi"], rtol=1e-9, what=f"the multi-class loss for {label}")
