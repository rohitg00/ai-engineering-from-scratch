import numpy as np

from practice_check import check, close, equal, fixture, fixtures, true

P = np.array([0.5, 0.3, 0.2, 0.0])
Q = np.array([0.25, 0.25, 0.25, 0.25])
TARGET = np.array([[0.5, 0.3, 0.2, 0.0], [0.1, 0.6, 0.2, 0.1], [0.25, 0.25, 0.25, 0.25]])
DRAFT = np.array([[0.25, 0.25, 0.25, 0.25], [0.4, 0.2, 0.2, 0.2]])


def random_dist(rng, v, zeros=0):
    x = rng.random(v) + 0.05
    if zeros:
        x[rng.choice(v, size=zeros, replace=False)] = 0.0
    return x / np.sum(x)


def first_token_counts(sub, target, draft, n, seed):
    rng = np.random.default_rng(seed)
    counts = np.zeros(target.size)
    for _ in range(n):
        token = int(rng.choice(draft.size, p=draft))
        counts[sub.speculative_step(np.array([target, target]), np.array([draft]), [token], rng)[0]] += 1
    return counts / n


@check("examples", "acceptance rate and residual of the example pair", "The acceptance rate is the sum over the vocabulary of min(p, q). The residual is max(0, p - q) divided by its sum.")
def example_rate_residual(sub):
    close(sub.acceptance_rate(P, Q), 0.7, rtol=1e-12, what="the acceptance rate")
    close(sub.residual_distribution(P, Q), [0.83333333, 0.16666667, 0.0, 0.0], rtol=1e-7, atol=1e-12, what="the residual distribution")


@check("examples", "three speculative steps with fixed seeds", "Draw one rng.random() for each draft token, left to right. Accept when it is below min(1, p / q). After a rejection, draw one token from the residual and stop. After full acceptance, draw one bonus token from the last target row.")
def example_steps(sub):
    equal(list(sub.speculative_step(TARGET, DRAFT, [0, 1], np.random.default_rng(0))), [0, 1, 0], what="the tokens for draft [0, 1] and seed 0")
    equal(list(sub.speculative_step(TARGET, DRAFT, [3, 0], np.random.default_rng(0))), [0], what="the tokens for draft [3, 0] and seed 0")
    equal(list(sub.speculative_step(TARGET, DRAFT, [0, 0], np.random.default_rng(3))), [0, 0, 3], what="the tokens for draft [0, 0] and seed 3")


@check("examples", "expected tokens for each target call", "With acceptance rate alpha and gamma draft tokens, the expected number of tokens is (1 - alpha^(gamma + 1)) / (1 - alpha). For alpha = 1 it is gamma + 1.")
def example_expected(sub):
    close(sub.expected_tokens(0.8, 4), 3.3616, rtol=1e-12, what="expected_tokens(0.8, 4)")
    close(sub.expected_tokens(1.0, 4), 5.0, rtol=1e-12, what="expected_tokens(1.0, 4)")
    close(sub.expected_tokens(0.0, 4), 1.0, rtol=1e-12, what="expected_tokens(0.0, 4)")


@check("properties", "the exact output distribution equals the target", "A token comes out when the draft proposes it and it is accepted, or after a rejection from the residual. So P(x) = q(x) min(1, p(x) / q(x)) + (1 - alpha) residual(x), and this sum must equal p(x).")
def exact_distribution(sub):
    rng = np.random.default_rng(0)
    for v, zp, zq in [(4, 0, 0), (6, 2, 0), (6, 0, 2), (10, 3, 3)]:
        p = random_dist(rng, v, zp)
        q = random_dist(rng, v, zq)
        alpha = sub.acceptance_rate(p, q)
        accepted = np.where(q > 0, q * np.minimum(1.0, np.divide(p, q, out=np.ones_like(p), where=q > 0)), 0.0)
        close(accepted + (1.0 - alpha) * np.asarray(sub.residual_distribution(p, q)), p, atol=1e-12, what=f"the induced distribution for a vocabulary of {v}")


@check("properties", "sampled first tokens follow the target", "Run 10000 seeded steps with one draft token from q. The frequency of each first output token must be within 0.02 of p. On a rejection, sample from the residual, not from p.")
def sampled_distribution(sub):
    p = np.array([0.1, 0.2, 0.3, 0.4])
    q = np.array([0.4, 0.3, 0.2, 0.1])
    freq = first_token_counts(sub, p, q, 10000, 7)
    true(np.max(np.abs(freq - p)) < 0.02, "The output tokens do not follow the target distribution", p, freq)


@check("properties", "the acceptance rate is symmetric and at most 1", "alpha = sum of min(p, q) does not change when p and q swap. It is 1 when p equals q and 1 minus half the L1 distance in general.")
def alpha_properties(sub):
    rng = np.random.default_rng(1)
    p = random_dist(rng, 8)
    q = random_dist(rng, 8)
    close(sub.acceptance_rate(p, q), sub.acceptance_rate(q, p), rtol=1e-12, what="alpha after the swap")
    close(sub.acceptance_rate(p, q), 1.0 - 0.5 * np.sum(np.abs(p - q)), rtol=1e-12, what="alpha")
    close(sub.acceptance_rate(p, p), 1.0, rtol=1e-12, what="alpha when p equals q")


@check("properties", "the output length is the accepted count plus one", "Each step returns the accepted draft tokens and then one more token. The accepted tokens are the first draft tokens, in order.")
def output_length(sub):
    rng = np.random.default_rng(2)
    target = np.array([random_dist(rng, 5) for _ in range(4)])
    draft = np.array([random_dist(rng, 5) for _ in range(3)])
    tokens = [int(rng.choice(5, p=d)) for d in draft]
    for seed in range(20):
        out = list(sub.speculative_step(target, draft, tokens, np.random.default_rng(seed)))
        true(1 <= len(out) <= 4, "The step must return from 1 to gamma + 1 tokens", "1 to 4 tokens", out)
        equal(out[:-1], tokens[:len(out) - 1], what=f"the accepted tokens for seed {seed}")


@check("properties", "the inputs are not changed", "A function that writes into the target or draft probabilities breaks the decoder that calls it.")
def inputs_unchanged(sub):
    target = TARGET.copy()
    draft = DRAFT.copy()
    tokens = [3, 0]
    sub.acceptance_rate(target[0], draft[0])
    sub.residual_distribution(target[0], draft[0])
    sub.speculative_step(target, draft, tokens, np.random.default_rng(0))
    true(np.array_equal(target, TARGET), "The function changed the target probabilities", TARGET, target)
    true(np.array_equal(draft, DRAFT), "The function changed the draft probabilities", DRAFT, draft)
    equal(tokens, [3, 0], what="the draft tokens")


@check("edge", "equal distributions accept every draft token", "When p equals q, min(1, p / q) is 1, so every draft token is accepted. The residual max(0, p - q) is all 0. Then return a copy of p.")
def equal_distributions(sub):
    p = np.array([0.2, 0.5, 0.3])
    close(sub.residual_distribution(p, p), p, what="the residual when p equals q")
    for seed in range(10):
        out = list(sub.speculative_step(np.array([p, p, p]), np.array([p, p]), [1, 2], np.random.default_rng(seed)))
        equal(out[:2], [1, 2], what=f"the accepted tokens for seed {seed}")
        true(len(out) == 3, "Full acceptance must add one bonus token", 3, len(out))


@check("edge", "a token with target probability 0 is always rejected", "When p(x) is 0, the acceptance probability is 0. The residual then never gives x, because max(0, p(x) - q(x)) is 0.")
def zero_target(sub):
    for seed in range(20):
        out = list(sub.speculative_step(TARGET, DRAFT, [3, 0], np.random.default_rng(seed)))
        true(len(out) == 1 and out[0] != 3, "A draft token with p = 0 was accepted or came out of the residual", "one token that is not 3", out)


@check("edge", "no draft tokens", "With gamma = 0, the step samples one token from the only target row.")
def no_drafts(sub):
    target = np.array([[0.0, 1.0, 0.0]])
    equal(list(sub.speculative_step(target, np.zeros((0, 3)), [], np.random.default_rng(0))), [1], what="the tokens")
    close(sub.expected_tokens(0.5, 0), 1.0, rtol=1e-12, what="expected_tokens(0.5, 0)")


@fixture("cases")
def cases(ref):
    rng = np.random.default_rng(42)
    for v, gamma, seed in [(4, 1, 0), (5, 2, 1), (6, 3, 2), (8, 4, 3), (3, 2, 4)]:
        target = np.array([random_dist(rng, v, 1) for _ in range(gamma + 1)])
        draft = np.array([random_dist(rng, v) for _ in range(gamma)])
        tokens = [int(rng.choice(v, p=d)) for d in draft]
        alpha = ref.acceptance_rate(target[0], draft[0])
        yield {"target": target, "draft": draft, "tokens": tokens, "seed": seed}, {"out": ref.speculative_step(target, draft, tokens, np.random.default_rng(seed)), "alpha": alpha, "residual": ref.residual_distribution(target[0], draft[0]), "expected": ref.expected_tokens(alpha, gamma)}


@check("reference", "steps, rates and residuals match the reference", "With the same seed and the same order of random draws, your step returns the same tokens as the reference solution.")
def reference_cases(sub):
    for case, expected in fixtures("cases"):
        label = f"a vocabulary of {case['target'].shape[1]}, gamma = {len(case['tokens'])} and seed {case['seed']}"
        close(sub.acceptance_rate(case["target"][0], case["draft"][0]), expected["alpha"], rtol=1e-12, what=f"alpha for {label}")
        close(sub.residual_distribution(case["target"][0], case["draft"][0]), expected["residual"], rtol=1e-10, atol=1e-14, what=f"the residual for {label}")
        close(sub.expected_tokens(expected["alpha"], len(case["tokens"])), expected["expected"], rtol=1e-12, what=f"the expected tokens for {label}")
        equal(list(sub.speculative_step(case["target"], case["draft"], case["tokens"], np.random.default_rng(case["seed"]))), expected["out"], what=f"the tokens for {label}")
