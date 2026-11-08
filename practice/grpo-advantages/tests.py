import numpy as np

from practice_check import check, close, fixture, fixtures, numeric_grad, shape, true

LOGP = np.array([[-1.0, -0.5, -2.0], [-0.3, -1.2, 0.0]])
OLD = np.array([[-1.1, -0.5, -1.0], [-0.6, -1.0, 0.0]])
REF = np.array([[-1.2, -0.4, -1.5], [-0.4, -1.1, 0.0]])
ADV = np.array([1.0, -1.0])
MASK = np.array([[True, True, True], [True, True, False]])


def away_from_clip(rng, n, length, clip_eps):
    old = rng.normal(size=(n, length)) - 1.0
    while True:
        delta = rng.uniform(-0.5, 0.5, size=(n, length))
        ratio = np.exp(delta)
        if np.all(np.abs(ratio - (1 + clip_eps)) > 1e-3) and np.all(np.abs(ratio - (1 - clip_eps)) > 1e-3):
            return old + delta, old


@check("examples", "advantages of two groups of four", "Subtract the group mean from each reward. Divide by the population standard deviation of the group plus eps.")
def example_adv(sub):
    adv = sub.group_advantages(np.array([[1.0, 0.0, 0.0, 1.0], [0.0, 0.0, 1.0, 0.0]]))
    close(adv, [[0.99999998, -0.99999998, -0.99999998, 0.99999998], [-0.57735026, -0.57735026, 1.73205077, -0.57735026]], rtol=1e-7, what="the advantages")


@check("examples", "the k3 estimator on three tokens", "k3 is the ratio pi_ref / pi_theta minus the log of that ratio minus 1. It is 0 when the two log probabilities are equal.")
def example_k3(sub):
    close(sub.kl_k3(np.array([-1.0, -2.0, -0.5]), np.array([-1.0, -1.5, -1.0])), [0.0, 0.14872127, 0.10653066], rtol=1e-7, atol=1e-12, what="the k3 values")


@check("examples", "the clipped objective of two sequences", "Take the minimum of the unclipped and the clipped surrogate, subtract beta times k3, average the valid tokens of each sequence, then average the sequences.")
def example_objective(sub):
    close(sub.grpo_objective(LOGP, OLD, REF, ADV, MASK), -0.13122323326245566, rtol=1e-10, what="the objective with beta = 0.04")
    close(sub.grpo_objective(LOGP, OLD, REF, ADV, MASK, clip_eps=0.2, beta=0.0), -0.1299723302889813, rtol=1e-10, what="the objective with beta = 0")


@check("properties", "each group has mean 0 and standard deviation 1", "After normalization the advantages of a group have mean 0. Their population standard deviation is 1, up to the small eps.")
def adv_normalized(sub):
    rng = np.random.default_rng(0)
    rewards = rng.normal(size=(5, 8)) * 3.0 + 2.0
    adv = np.asarray(sub.group_advantages(rewards))
    shape(adv, (5, 8), what="the advantages")
    close(adv.mean(axis=1), np.zeros(5), atol=1e-12, what="the group means")
    close(adv.std(axis=1), np.ones(5), rtol=1e-7, what="the group standard deviations")


@check("properties", "advantages do not change under a positive affine change of the rewards", "Each group has its own mean and scale. Adding a constant or multiplying by a positive number gives the same advantages, so groups of easy and hard prompts become comparable.")
def adv_affine(sub):
    rng = np.random.default_rng(1)
    rewards = rng.random(size=(3, 6))
    shifted = rewards * np.array([[2.0], [10.0], [0.5]]) + np.array([[1.0], [-4.0], [7.0]])
    close(sub.group_advantages(shifted), sub.group_advantages(rewards), rtol=1e-6, atol=1e-7, what="the advantages of the rescaled rewards")


@check("properties", "k3 is non-negative and unbiased for KL(pi_theta || pi_ref)", "k3 is never negative. When tokens come from pi_theta, its mean is the exact KL divergence. Check the direction of the ratio: it is pi_ref over pi_theta.")
def k3_unbiased(sub):
    rng = np.random.default_rng(2)
    z = rng.normal(size=6)
    w = rng.normal(size=6)
    logp = z - np.log(np.sum(np.exp(z)))
    logq = w - np.log(np.sum(np.exp(w)))
    k3 = np.asarray(sub.kl_k3(logp, logq))
    true(np.all(k3 >= 0), "A k3 value is negative", "values of 0 or more", k3)
    exact = float(np.sum(np.exp(logp) * (logp - logq)))
    close(np.sum(np.exp(logp) * k3), exact, rtol=1e-10, what="the expectation of k3 under pi_theta")


@check("properties", "at the start of an update the objective is the mean advantage", "When pi_theta equals pi_old and pi_ref, every ratio is 1 and every k3 is 0. Each sequence contributes its advantage, so the objective is the mean of the advantages.")
def objective_at_start(sub):
    rng = np.random.default_rng(3)
    logp = rng.normal(size=(4, 5)) - 1.0
    adv = np.array([0.5, -1.0, 2.0, 0.25])
    mask = np.ones((4, 5), dtype=bool)
    mask[1, 3:] = False
    mask[2, 1:] = False
    close(sub.grpo_objective(logp, logp, logp, adv, mask), float(np.mean(adv)), rtol=1e-12, what="the objective")


@check("properties", "the gradient matches the clipped surrogate of the paper", "Inside the clip range, or where the minimum picks the unclipped term, the gradient of a token is ratio times A. Where the clipped term is smaller, the gradient is 0. The KL term adds minus beta times (1 - pi_ref / pi_theta). Each token is scaled by 1 / (N |o_i|).")
def objective_gradient(sub):
    rng = np.random.default_rng(4)
    clip_eps, beta = 0.2, 0.1
    logp, old = away_from_clip(rng, 3, 4, clip_eps)
    ref = old + rng.normal(size=(3, 4)) * 0.3
    adv = np.array([1.5, -0.7, 0.4])
    mask = np.array([[True, True, True, True], [True, True, False, False], [True, False, False, False]])
    ratio = np.exp(logp - old)
    unclipped = ratio * adv[:, None]
    clipped = np.clip(ratio, 1 - clip_eps, 1 + clip_eps) * adv[:, None]
    surrogate = np.where(unclipped <= clipped, ratio * adv[:, None], 0.0)
    kl = -(1.0 - np.exp(ref - logp))
    expected = (surrogate + beta * kl) * mask / mask.sum(axis=1, keepdims=True) / 3
    grad = numeric_grad(lambda x: sub.grpo_objective(x, old, ref, adv, mask, clip_eps=clip_eps, beta=beta), logp, eps=1e-6)
    close(grad, expected, rtol=1e-5, atol=1e-8, what="the finite difference gradient of the objective")


@check("properties", "the inputs are not changed", "The functions must not write into the rewards, the log probabilities, the advantages or the mask.")
def inputs_unchanged(sub):
    rewards = np.array([[1.0, 0.0, 1.0]])
    arrays = [LOGP.copy(), OLD.copy(), REF.copy(), ADV.copy(), MASK.copy()]
    saved = [a.copy() for a in arrays] + [rewards.copy()]
    sub.group_advantages(rewards)
    sub.kl_k3(arrays[0], arrays[2])
    sub.grpo_objective(*arrays)
    for name, before, after in zip(["logp", "old_logp", "ref_logp", "advantages", "mask", "rewards"], saved, arrays + [rewards]):
        true(np.array_equal(before, after), f"The function changed {name}", before, after)


@check("edge", "a group with equal rewards has zero advantages", "When every reward of a group is the same, the standard deviation is 0. The eps keeps the division finite and every advantage is 0.")
def equal_rewards(sub):
    close(sub.group_advantages(np.array([[1.0, 1.0, 1.0], [0.0, 1.0, 0.0]])), [[0.0, 0.0, 0.0], [-0.70710677, 1.41421353, -0.70710677]], rtol=1e-7, atol=1e-12, what="the advantages")


@check("edge", "padding tokens do not change the objective", "Tokens with mask False are padding. Their log probabilities can be any value and the objective stays the same.")
def padding_ignored(sub):
    base = sub.grpo_objective(LOGP, OLD, REF, ADV, MASK)
    noisy = LOGP.copy()
    noisy[1, 2] = -50.0
    close(sub.grpo_objective(noisy, OLD, REF, ADV, MASK), base, rtol=1e-12, what="the objective with a changed padding token")


@check("edge", "the clip stops the gain for a large ratio", "For A > 0 and a ratio above 1 + eps, the minimum picks the clipped term. Then a larger log probability does not raise the surrogate.")
def clip_saturates(sub):
    old = np.array([[-2.0]])
    adv = np.array([1.0])
    mask = np.array([[True]])
    a = sub.grpo_objective(np.array([[-1.5]]), old, np.array([[-1.5]]), adv, mask, beta=0.0)
    b = sub.grpo_objective(np.array([[-0.5]]), old, np.array([[-0.5]]), adv, mask, beta=0.0)
    close(a, 1.2, rtol=1e-12, what="the objective at a ratio of exp(0.5)")
    close(b, 1.2, rtol=1e-12, what="the objective at a ratio of exp(1.5)")


@fixture("cases")
def cases(ref):
    rng = np.random.default_rng(42)
    for n, length, clip_eps, beta in [(2, 3, 0.2, 0.04), (4, 5, 0.1, 0.0), (6, 4, 0.3, 0.1), (8, 6, 0.2, 0.04)]:
        rewards = rng.integers(0, 2, size=(1, n)).astype(float)
        adv = ref.group_advantages(rewards)[0]
        old = rng.normal(size=(n, length)) - 1.0
        logp = old + rng.normal(size=(n, length)) * 0.3
        ref_logp = old + rng.normal(size=(n, length)) * 0.3
        lengths = rng.integers(1, length + 1, size=n)
        mask = np.arange(length)[None, :] < lengths[:, None]
        yield {"rewards": rewards, "logp": logp, "old_logp": old, "ref_logp": ref_logp, "mask": mask, "clip_eps": clip_eps, "beta": beta}, {"advantages": adv, "k3": ref.kl_k3(logp, ref_logp), "objective": ref.grpo_objective(logp, old, ref_logp, adv, mask, clip_eps=clip_eps, beta=beta)}


@check("reference", "advantages, k3 and objective match the reference on 4 groups", "Your advantages, k3 values and objective agree with the reference on random groups with padding.")
def reference_cases(sub):
    for case, expected in fixtures("cases"):
        label = f"a group of {case['logp'].shape[0]} with clip_eps {case['clip_eps']} and beta {case['beta']}"
        adv = np.asarray(sub.group_advantages(case["rewards"]))
        close(adv[0] if adv.ndim == 2 else adv, expected["advantages"], rtol=1e-9, atol=1e-12, what=f"the advantages for {label}")
        close(sub.kl_k3(case["logp"], case["ref_logp"]), expected["k3"], rtol=1e-10, atol=1e-14, what=f"the k3 values for {label}")
        close(sub.grpo_objective(case["logp"], case["old_logp"], case["ref_logp"], expected["advantages"], case["mask"], clip_eps=case["clip_eps"], beta=case["beta"]), expected["objective"], rtol=1e-10, what=f"the objective for {label}")
