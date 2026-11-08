import numpy as np

from practice_check import check, close, fixture, fixtures, numeric_grad, shape, true

OLD = np.log(np.array([0.5, 0.5, 0.5, 0.5]))
NEW = np.log(np.array([0.7, 0.55, 0.3, 0.45]))
ADV = np.array([1.0, 2.0, -1.0, -0.5])


def away_from_kinks(rng, n, eps):
    logp_old = rng.normal(size=n) - 1.0
    deltas = rng.uniform(-0.5, 0.5, size=n)
    ratio = np.exp(deltas)
    near = (np.abs(ratio - (1 + eps)) < 0.02) | (np.abs(ratio - (1 - eps)) < 0.02)
    deltas[near] += 0.05
    advantages = rng.normal(size=n)
    advantages[np.abs(advantages) < 0.05] = 0.5
    return logp_old + deltas, logp_old, advantages


@check("examples", "loss of the four-sample batch", "The ratio is exp(logp_new minus logp_old). Each sample gives min(r A, clip(r, 1 - eps, 1 + eps) A). The loss is minus the mean of these values.")
def example_loss(sub):
    close(sub.ppo_clip_loss(NEW, OLD, ADV), -0.5375000000000001, rtol=1e-9, what="the loss")


@check("examples", "clip fraction of the four-sample batch", "A sample is clipped when A > 0 and r > 1 + eps, or when A < 0 and r < 1 - eps. Samples 0 and 2 are clipped, so the fraction is 0.5.")
def example_fraction(sub):
    close(sub.clip_fraction(NEW, OLD, ADV), 0.5, what="the clip fraction")


@check("examples", "gradient of the four-sample batch", "A clipped sample has a gradient of 0. Any other sample has a gradient of minus r A / N with respect to its new log probability.")
def example_grad(sub):
    close(sub.ppo_clip_grad(NEW, OLD, ADV), [0.0, -0.55, 0.0, 0.1125], rtol=1e-9, atol=1e-12, what="the gradient")


@check("properties", "the gradient matches finite differences", "Away from the clip edges the loss is smooth. A small change in one new log probability changes the loss by the gradient times that change.")
def finite_differences(sub):
    rng = np.random.default_rng(0)
    for n, eps in [(6, 0.2), (9, 0.1), (5, 0.3)]:
        logp_new, logp_old, advantages = away_from_kinks(rng, n, eps)
        numeric = numeric_grad(lambda z: sub.ppo_clip_loss(z, logp_old, advantages, eps), logp_new)
        grad = sub.ppo_clip_grad(logp_new, logp_old, advantages, eps)
        shape(grad, (n,), what="the gradient")
        close(grad, numeric, rtol=1e-5, atol=1e-8, what=f"the gradient for N = {n} and eps = {eps}")


@check("properties", "no change in the policy gives the plain policy gradient", "When logp_new equals logp_old, every ratio is 1. Then the loss is minus the mean advantage, the gradient is minus A / N and no sample is clipped.")
def same_policy(sub):
    rng = np.random.default_rng(1)
    logp = rng.normal(size=8) - 2.0
    advantages = rng.normal(size=8)
    close(sub.ppo_clip_loss(logp, logp, advantages), -np.mean(advantages), atol=1e-12, what="the loss when the policy does not change")
    close(sub.ppo_clip_grad(logp, logp, advantages), -advantages / 8, atol=1e-12, what="the gradient when the policy does not change")
    close(sub.clip_fraction(logp, logp, advantages), 0.0, what="the clip fraction when the policy does not change")


@check("properties", "the clipped objective is a lower bound", "The min takes the smaller of the two terms. So minus the loss is never larger than the mean of r A, and it is never larger than the mean of clip(r) A.")
def pessimistic_bound(sub):
    rng = np.random.default_rng(2)
    logp_old = rng.normal(size=20) - 1.0
    logp_new = logp_old + rng.normal(scale=0.4, size=20)
    advantages = rng.normal(size=20)
    ratio = np.exp(logp_new - logp_old)
    objective = -sub.ppo_clip_loss(logp_new, logp_old, advantages)
    true(objective <= np.mean(ratio * advantages) + 1e-12, "Minus the loss is larger than the mean of r A. Use np.minimum, not np.maximum.", float(np.mean(ratio * advantages)), objective)
    true(objective <= np.mean(np.clip(ratio, 0.8, 1.2) * advantages) + 1e-12, "Minus the loss is larger than the mean of clip(r) A", float(np.mean(np.clip(ratio, 0.8, 1.2) * advantages)), objective)


@check("properties", "the clip acts on one side only", "For A > 0 a small ratio is not clipped, because the min picks r A. For A < 0 a large ratio is not clipped. These samples keep their gradient.")
def one_sided_clip(sub):
    logp_old = np.log(np.array([0.5, 0.5]))
    logp_new = np.log(np.array([0.2, 0.9]))
    advantages = np.array([1.0, -1.0])
    close(sub.clip_fraction(logp_new, logp_old, advantages), 0.0, what="the clip fraction")
    ratio = np.exp(logp_new - logp_old)
    close(sub.ppo_clip_grad(logp_new, logp_old, advantages), -ratio * advantages / 2, rtol=1e-9, what="the gradient")
    close(sub.ppo_clip_loss(logp_new, logp_old, advantages), -np.mean(ratio * advantages), rtol=1e-9, what="the loss")


@check("properties", "the inputs are not changed", "The loss, the clip fraction and the gradient only read the arrays.")
def inputs_unchanged(sub):
    rng = np.random.default_rng(3)
    logp_new, logp_old, advantages = away_from_kinks(rng, 7, 0.2)
    saved = [logp_new.copy(), logp_old.copy(), advantages.copy()]
    sub.ppo_clip_loss(logp_new, logp_old, advantages)
    sub.clip_fraction(logp_new, logp_old, advantages)
    sub.ppo_clip_grad(logp_new, logp_old, advantages)
    for name, before, after in zip(["logp_new", "logp_old", "advantages"], saved, [logp_new, logp_old, advantages]):
        true(np.array_equal(before, after), f"The code changed {name}", before, after)


@check("edge", "every sample is clipped", "When every sample is clipped, the clip fraction is 1 and the gradient is 0 everywhere. The loss is minus the mean of (1 + eps) A or (1 - eps) A.")
def all_clipped(sub):
    logp_old = np.log(np.array([0.2, 0.4, 0.5]))
    logp_new = np.log(np.array([0.4, 0.1, 0.9]))
    advantages = np.array([2.0, -1.0, 0.5])
    close(sub.clip_fraction(logp_new, logp_old, advantages), 1.0, what="the clip fraction")
    close(sub.ppo_clip_grad(logp_new, logp_old, advantages), np.zeros(3), atol=1e-15, what="the gradient")
    close(sub.ppo_clip_loss(logp_new, logp_old, advantages), -0.7333333333333333, rtol=1e-9, what="the loss")


@check("edge", "very small probabilities", "With log probabilities near minus 800, exp of each log probability is 0. Compute the ratio as exp(logp_new minus logp_old).")
def tiny_probabilities(sub):
    logp_new = np.array([-800.0, -801.0])
    logp_old = np.array([-800.1, -800.9])
    advantages = np.array([1.0, -2.0])
    close(sub.ppo_clip_loss(logp_new, logp_old, advantages), 0.3522519589981026, rtol=1e-9, what="the loss")
    close(sub.ppo_clip_grad(logp_new, logp_old, advantages), [-0.55258546, 0.90483742], rtol=1e-7, what="the gradient")


@check("edge", "zero advantages and one sample", "A sample with A = 0 adds 0 to the loss and is not clipped. With one sample the mean is that sample.")
def zero_and_one(sub):
    logp_old = np.log(np.array([0.3, 0.6, 0.5]))
    logp_new = np.log(np.array([0.9, 0.1, 0.5]))
    advantages = np.zeros(3)
    close(sub.ppo_clip_loss(logp_new, logp_old, advantages), 0.0, atol=1e-15, what="the loss with zero advantages")
    close(sub.clip_fraction(logp_new, logp_old, advantages), 0.0, what="the clip fraction with zero advantages")
    close(sub.ppo_clip_grad(logp_new, logp_old, advantages), np.zeros(3), atol=1e-15, what="the gradient with zero advantages")
    close(sub.ppo_clip_loss(np.array([np.log(0.6)]), np.array([np.log(0.5)]), np.array([3.0])), -3.5999999999999996, rtol=1e-9, what="the loss for one sample with r = 1.2")


@fixture("batches")
def batches(ref):
    rng = np.random.default_rng(42)
    for n, eps, scale in [(5, 0.2, 0.3), (12, 0.1, 0.5), (20, 0.2, 0.2), (8, 0.3, 0.8)]:
        logp_old = rng.normal(size=n) - 1.5
        logp_new = logp_old + rng.normal(scale=scale, size=n)
        advantages = rng.normal(size=n)
        yield {"logp_new": logp_new, "logp_old": logp_old, "advantages": advantages, "eps": eps}, {
            "loss": ref.ppo_clip_loss(logp_new, logp_old, advantages, eps),
            "fraction": ref.clip_fraction(logp_new, logp_old, advantages, eps),
            "grad": ref.ppo_clip_grad(logp_new, logp_old, advantages, eps),
        }


@check("reference", "loss, clip fraction and gradient match the reference", "Your three functions agree with the reference on random batches with several values of eps.")
def reference_batches(sub):
    for case, expected in fixtures("batches"):
        args = (case["logp_new"], case["logp_old"], case["advantages"], case["eps"])
        label = f"N = {case['advantages'].size} and eps = {case['eps']}"
        close(sub.ppo_clip_loss(*args), expected["loss"], rtol=1e-9, atol=1e-12, what=f"the loss for {label}")
        close(sub.clip_fraction(*args), expected["fraction"], what=f"the clip fraction for {label}")
        close(sub.ppo_clip_grad(*args), expected["grad"], rtol=1e-9, atol=1e-12, what=f"the gradient for {label}")
