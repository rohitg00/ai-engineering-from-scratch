import numpy as np

from practice_check import check, close, fixture, fixtures, numeric_grad, shape, true

BATCH = np.array([[2.0, 1.0, 0.1], [0.5, 2.5, 0.3]])
BATCH_TARGETS = np.array([0, 1])


@check("examples", "softmax of [1, 2, 3]", "Each probability is exp of its logit divided by the sum of exp over the row.")
def example_softmax(sub):
    close(sub.softmax(np.array([[1.0, 2.0, 3.0]])), [[0.09003057, 0.24472847, 0.66524096]], rtol=1e-6)


@check("examples", "loss of the two-example batch", "The loss is the mean over the batch of minus the log probability of the correct class.")
def example_loss(sub):
    close(sub.cross_entropy(BATCH, BATCH_TARGETS), 0.31853977, rtol=1e-6, what="the loss")


@check("examples", "gradient rows sum to zero", "The gradient of each row is softmax minus a one-hot vector, so each row sums to 0.")
def example_grad(sub):
    grad = sub.cross_entropy_grad(BATCH, BATCH_TARGETS)
    shape(grad, (2, 3), what="the gradient")
    close(np.sum(grad, axis=1), [0.0, 0.0], atol=1e-9, what="the row sums of the gradient")


@check("properties", "every softmax row sums to 1", "Softmax gives a probability distribution, so each row must add up to 1.")
def rows_sum_to_one(sub):
    rng = np.random.default_rng(0)
    logits = rng.normal(size=(6, 9)) * 3
    probs = sub.softmax(logits)
    shape(probs, logits.shape, what="the probabilities")
    close(np.sum(probs, axis=1), np.ones(6), atol=1e-9, what="the row sums")
    true(np.all(probs >= 0), "softmax gave a negative probability", "values from 0 to 1", probs)


@check("properties", "adding a constant to a row does not change softmax", "Softmax only depends on the differences between logits in a row.")
def shift_invariance(sub):
    rng = np.random.default_rng(1)
    logits = rng.normal(size=(4, 5))
    close(sub.softmax(logits + 7.5), sub.softmax(logits), atol=1e-9, what="softmax of the shifted logits")


@check("properties", "gradient matches finite differences", "A gradient is correct when a small change in one logit changes the loss by gradient times that change.")
def finite_differences(sub):
    rng = np.random.default_rng(2)
    logits = rng.normal(size=(3, 4))
    targets = np.array([1, 3, 0])
    numeric = numeric_grad(lambda z: sub.cross_entropy(z, targets), logits)
    close(sub.cross_entropy_grad(logits, targets), numeric, atol=1e-6, rtol=1e-4, what="the analytic gradient")


@check("properties", "the inputs are not changed", "A function that writes into its input array breaks the code that calls it.")
def inputs_unchanged(sub):
    logits = np.array([[0.3, -1.2, 2.0], [1.0, 1.0, 1.0]])
    saved = logits.copy()
    sub.softmax(logits)
    sub.cross_entropy(logits, np.array([2, 0]))
    sub.cross_entropy_grad(logits, np.array([2, 0]))
    close(logits, saved, atol=0, rtol=0, what="the logits after the calls")


@check("edge", "large logits do not overflow", "exp(1000) is infinite in float64. Subtract the row maximum before exp so that the largest exponent is 0.")
def large_logits(sub):
    logits = np.array([[1000.0, 1001.0, 1002.0]])
    close(sub.softmax(logits), [[0.09003057, 0.24472847, 0.66524096]], rtol=1e-6, what="softmax of large logits")


@check("edge", "loss stays finite for a confident wrong answer", "When the correct class has a very small probability, compute log-softmax directly. log(0) is minus infinity.")
def confident_wrong(sub):
    logits = np.array([[800.0, 0.0, -800.0]])
    close(sub.cross_entropy(logits, np.array([2])), 1600.0, rtol=1e-9, what="the loss")


@check("edge", "one example and two classes", "The functions must work for the smallest batch: N = 1 and C = 2.")
def smallest_batch(sub):
    logits = np.array([[0.0, 0.0]])
    close(sub.softmax(logits), [[0.5, 0.5]], what="softmax")
    close(sub.cross_entropy(logits, np.array([1])), np.log(2.0), what="the loss")
    close(sub.cross_entropy_grad(logits, np.array([1])), [[0.5, -0.5]], what="the gradient")


@check("edge", "the loss is a mean, not a sum", "The batch loss divides by N. Without the division, the learning rate depends on the batch size.")
def loss_is_mean(sub):
    logits = np.tile(np.array([[1.0, 2.0, 0.5]]), (8, 1))
    targets = np.zeros(8, dtype=int)
    single = sub.cross_entropy(logits[:1], targets[:1])
    close(sub.cross_entropy(logits, targets), single, rtol=1e-9, what="the loss of 8 equal examples")


@fixture("batches")
def batches(ref):
    rng = np.random.default_rng(42)
    for n, c, scale in [(1, 3, 1.0), (5, 4, 2.0), (16, 10, 5.0), (7, 2, 30.0), (12, 20, 1.0), (3, 6, 400.0)]:
        logits = rng.normal(size=(n, c)) * scale
        targets = rng.integers(0, c, size=n)
        yield {"logits": logits, "targets": targets}, {
            "softmax": ref.softmax(logits),
            "loss": ref.cross_entropy(logits, targets),
            "grad": ref.cross_entropy_grad(logits, targets),
        }


@check("reference", "softmax matches the reference on 6 random batches", "Your softmax gives the same probabilities as the reference solution on batches of many shapes and scales.")
def reference_softmax(sub):
    for case, expected in fixtures("batches"):
        close(sub.softmax(case["logits"]), expected["softmax"], rtol=1e-7, atol=1e-12, what=f"softmax for a batch of shape {case['logits'].shape}")


@check("reference", "loss and gradient match the reference", "Your loss and gradient agree with the reference solution on the same random batches.")
def reference_loss(sub):
    for case, expected in fixtures("batches"):
        close(sub.cross_entropy(case["logits"], case["targets"]), expected["loss"], rtol=1e-7, what=f"the loss for a batch of shape {case['logits'].shape}")
        close(sub.cross_entropy_grad(case["logits"], case["targets"]), expected["grad"], rtol=1e-7, atol=1e-12, what=f"the gradient for a batch of shape {case['logits'].shape}")
