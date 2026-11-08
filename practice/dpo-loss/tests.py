import numpy as np

from practice_check import check, close, fixture, fixtures, numeric_grad, shape, true

PW = np.array([-12.0, -20.0, -8.0])
PL = np.array([-15.0, -18.0, -9.0])
RW = np.array([-13.0, -19.0, -8.5])
RL = np.array([-14.0, -19.0, -8.5])


def random_batch(rng, n):
    ref_w = rng.normal(-20.0, 5.0, size=n)
    ref_l = rng.normal(-20.0, 5.0, size=n)
    return ref_w + rng.normal(size=n), ref_l + rng.normal(size=n), ref_w, ref_l


@check("examples", "implicit rewards of the example batch", "The implicit reward is beta times the policy log probability minus the reference log probability.")
def example_rewards(sub):
    close(sub.implicit_reward(PW, RW, 0.1), [0.1, -0.1, 0.05], rtol=1e-9, what="the rewards of the preferred responses")
    close(sub.implicit_reward(PL, RL, 0.1), [-0.1, 0.1, -0.05], rtol=1e-9, what="the rewards of the rejected responses")


@check("examples", "loss of the example batch", "The loss is the mean over the batch of minus log sigmoid of the reward margin.")
def example_loss(sub):
    close(sub.dpo_loss(PW, PL, RW, RL, 0.1), 0.6802247996122515, rtol=1e-7, what="the loss")


@check("examples", "gradient of the example batch", "The gradient for the preferred log probability is minus beta times sigmoid of minus the margin, divided by N. The rejected gradient is the same value with a plus sign.")
def example_grad(sub):
    grad_w, grad_l = sub.dpo_grad(PW, PL, RW, RL, 0.1)
    close(grad_w, [-0.01500553, -0.0183278, -0.01583403], rtol=1e-6, what="the gradient for the preferred log probabilities")
    close(grad_l, [0.01500553, 0.0183278, 0.01583403], rtol=1e-6, what="the gradient for the rejected log probabilities")


@check("properties", "the loss is log 2 when the policy equals the reference", "When the policy and the reference give the same log probabilities, both rewards are 0. The margin is 0 and minus log sigmoid(0) is log 2, for every beta.")
def log_two_at_reference(sub):
    rng = np.random.default_rng(0)
    _, _, ref_w, ref_l = random_batch(rng, 7)
    for beta in [0.01, 0.1, 1.0, 5.0]:
        close(sub.dpo_loss(ref_w, ref_l, ref_w, ref_l, beta), np.log(2.0), rtol=1e-12, what=f"the loss with beta = {beta}")


@check("properties", "the gradient has the right sign", "Gradient descent must raise the log probability of the preferred response and lower the rejected one. So the preferred gradient is negative and the rejected gradient is positive.")
def gradient_sign(sub):
    rng = np.random.default_rng(1)
    pw, pl, rw, rl = random_batch(rng, 9)
    grad_w, grad_l = sub.dpo_grad(pw, pl, rw, rl, 0.3)
    shape(grad_w, (9,), what="the preferred gradient")
    shape(grad_l, (9,), what="the rejected gradient")
    true(np.all(np.asarray(grad_w) < 0), "A preferred gradient is not negative", "every value below 0", grad_w)
    true(np.all(np.asarray(grad_l) > 0), "A rejected gradient is not positive", "every value above 0", grad_l)
    close(np.asarray(grad_w) + np.asarray(grad_l), np.zeros(9), atol=1e-15, what="the sum of the two gradients")


@check("properties", "the gradient matches finite differences", "Change one policy log probability by a small amount. The loss must change by the gradient times that amount.")
def finite_differences(sub):
    rng = np.random.default_rng(2)
    pw, pl, rw, rl = random_batch(rng, 4)
    beta = 0.7
    num_w = numeric_grad(lambda x: sub.dpo_loss(x, pl, rw, rl, beta), pw)
    num_l = numeric_grad(lambda x: sub.dpo_loss(pw, x, rw, rl, beta), pl)
    grad_w, grad_l = sub.dpo_grad(pw, pl, rw, rl, beta)
    close(grad_w, num_w, rtol=1e-5, atol=1e-8, what="the preferred gradient")
    close(grad_l, num_l, rtol=1e-5, atol=1e-8, what="the rejected gradient")


@check("properties", "the loss falls as the margin grows", "The loss depends only on the margin beta times (preferred ratio minus rejected ratio). A larger margin gives a smaller loss.")
def loss_monotone(sub):
    ref = np.array([-10.0])
    losses = [sub.dpo_loss(ref + d, ref, ref, ref, 0.5) for d in [-4.0, -1.0, 0.0, 1.0, 4.0]]
    true(all(a > b for a, b in zip(losses, losses[1:])), "The loss does not fall when the preferred log probability rises", "a decreasing list", losses)


@check("properties", "the reference cancels a shared shift", "Add the same constant to the policy and the reference log probability of one response. The log ratio does not change, so the loss does not change.")
def shift_invariance(sub):
    rng = np.random.default_rng(3)
    pw, pl, rw, rl = random_batch(rng, 5)
    base = sub.dpo_loss(pw, pl, rw, rl, 0.2)
    close(sub.dpo_loss(pw + 3.0, pl - 7.0, rw + 3.0, rl - 7.0, 0.2), base, rtol=1e-12, what="the loss after the shift")


@check("properties", "the inputs are not changed", "A function that writes into its input arrays breaks the training loop that calls it.")
def inputs_unchanged(sub):
    arrays = [PW.copy(), PL.copy(), RW.copy(), RL.copy()]
    saved = [a.copy() for a in arrays]
    sub.implicit_reward(arrays[0], arrays[2], 0.1)
    sub.dpo_loss(*arrays, 0.1)
    sub.dpo_grad(*arrays, 0.1)
    for name, before, after in zip(["policy preferred", "policy rejected", "ref preferred", "ref rejected"], saved, arrays):
        true(np.array_equal(before, after), f"The function changed the {name} log probabilities", before, after)


@check("edge", "a very large margin gives a loss near 0", "When the margin is 4000, sigmoid of the margin rounds to 1. The loss must be 0, and a small constant inside the log gives a wrong value.")
def large_positive_margin(sub):
    close(sub.dpo_loss(np.array([0.0]), np.array([-2000.0]), np.array([-2000.0]), np.array([0.0]), 1.0), 0.0, atol=1e-12, what="the loss")


@check("edge", "a very large negative margin stays finite", "When the margin is minus 4000, sigmoid of the margin rounds to 0 and log(0) is minus infinity. Compute minus log sigmoid(z) as log(1 + exp(-z)) with np.logaddexp. The loss is 4000.")
def large_negative_margin(sub):
    close(sub.dpo_loss(np.array([-2000.0]), np.array([0.0]), np.array([0.0]), np.array([-2000.0]), 1.0), 4000.0, rtol=1e-12, what="the loss")
    grad_w, grad_l = sub.dpo_grad(np.array([-2000.0]), np.array([0.0]), np.array([0.0]), np.array([-2000.0]), 1.0)
    close(grad_w, [-1.0], rtol=1e-12, what="the preferred gradient")
    close(grad_l, [1.0], rtol=1e-12, what="the rejected gradient")


@check("edge", "one pair", "The functions must work for a batch of one pair. Then the mean is the loss of that pair.")
def one_pair(sub):
    loss = sub.dpo_loss(np.array([-3.0]), np.array([-3.0]), np.array([-3.0]), np.array([-4.0]), 2.0)
    close(loss, np.logaddexp(0.0, 2.0), rtol=1e-12, what="the loss")


@fixture("batches")
def batches(ref):
    rng = np.random.default_rng(42)
    for n, beta in [(1, 0.1), (4, 0.05), (6, 0.5), (10, 2.0)]:
        pw, pl, rw, rl = random_batch(rng, n)
        args = {"pw": pw, "pl": pl, "rw": rw, "rl": rl, "beta": beta}
        grad_w, grad_l = ref.dpo_grad(pw, pl, rw, rl, beta)
        yield args, {"loss": ref.dpo_loss(pw, pl, rw, rl, beta), "reward_w": ref.implicit_reward(pw, rw, beta), "grad_w": grad_w, "grad_l": grad_l}


@check("reference", "loss, rewards and gradients match the reference", "Your functions agree with the reference solution on random batches with several values of beta.")
def reference_batches(sub):
    for case, expected in fixtures("batches"):
        label = f"N = {case['pw'].size} and beta = {case['beta']}"
        args = (case["pw"], case["pl"], case["rw"], case["rl"], case["beta"])
        close(sub.dpo_loss(*args), expected["loss"], rtol=1e-9, what=f"the loss for {label}")
        close(sub.implicit_reward(case["pw"], case["rw"], case["beta"]), expected["reward_w"], rtol=1e-9, what=f"the preferred rewards for {label}")
        grad_w, grad_l = sub.dpo_grad(*args)
        close(grad_w, expected["grad_w"], rtol=1e-9, what=f"the preferred gradient for {label}")
        close(grad_l, expected["grad_l"], rtol=1e-9, what=f"the rejected gradient for {label}")
