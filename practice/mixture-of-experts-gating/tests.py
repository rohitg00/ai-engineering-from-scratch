import numpy as np

from practice_check import check, close, equal, fixture, fixtures, numeric_grad, shape, true

L3 = np.array([[2.0, 1.0, 0.5, -1.0], [0.0, 3.0, 3.0, 1.0], [1.0, 1.0, 1.0, 1.0]])


def full_softmax(x):
    e = np.exp(x - np.max(x, axis=-1, keepdims=True))
    return e / np.sum(e, axis=-1, keepdims=True)


def no_ties(rng, t, e):
    return rng.normal(size=(t, e)) + np.arange(e) * 1e-3


@check("examples", "route three tokens to the top 2 of 4 experts", "Pick the k largest logits of each row, largest first. On a tie the lower expert index comes first. The gates are a softmax over the k chosen logits only.")
def example_route(sub):
    top_idx, gates = sub.route(L3, 2)
    equal(np.asarray(top_idx), np.array([[0, 1], [1, 2], [0, 1]]), what="the chosen experts")
    close(gates, [[0.73105858, 0.26894142], [0.5, 0.5], [0.5, 0.5]], rtol=1e-7, what="the gates")


@check("examples", "the load-balancing loss of the same logits", "The loss is E times the sum over experts of f_i times P_i. f_i is the fraction of the T times k assignments that go to expert i. P_i is the mean full softmax probability of expert i.")
def example_loss(sub):
    close(sub.load_balancing_loss(L3, 2), 1.2008139315343698, rtol=1e-9, what="the loss with top_k = 2")
    close(sub.load_balancing_loss(L3, 1), 1.1983721362825372, rtol=1e-9, what="the loss with top_k = 1")


@check("examples", "equal logits give a loss of 1", "When every logit is equal, P_i is 1 / E for each expert. The f_i sum to 1, so the loss is E times 1 / E, which is 1.")
def example_equal(sub):
    close(sub.load_balancing_loss(np.zeros((5, 4)), 2), 1.0, rtol=1e-12, what="the loss for zero logits")


@check("properties", "gates are a renormalized softmax over the chosen experts", "Each gate row sums to 1. Each gate equals the full softmax probability of that expert divided by the sum of the full probabilities of the k chosen experts.")
def gates_renormalized(sub):
    rng = np.random.default_rng(0)
    logits = no_ties(rng, 6, 8)
    top_idx, gates = sub.route(logits, 3)
    shape(top_idx, (6, 3), what="top_idx")
    shape(gates, (6, 3), what="the gates")
    probs = np.take_along_axis(full_softmax(logits), np.asarray(top_idx), axis=-1)
    close(gates, probs / probs.sum(axis=-1, keepdims=True), atol=1e-12, what="the gates")
    close(np.sum(gates, axis=-1), np.ones(6), atol=1e-12, what="the gate row sums")


@check("properties", "the chosen experts are the k largest logits, in descending order", "top_idx holds k different expert indices. Their logits do not increase from left to right. No expert outside the chosen set has a larger logit than a chosen expert.")
def chosen_are_top(sub):
    rng = np.random.default_rng(1)
    logits = no_ties(rng, 10, 6)
    top_idx, gates = sub.route(logits, 2)
    top_idx = np.asarray(top_idx)
    true(np.issubdtype(top_idx.dtype, np.integer), "top_idx must hold integers", "an integer dtype", top_idx.dtype)
    for t in range(10):
        chosen = logits[t, top_idx[t]]
        rest = np.delete(logits[t], top_idx[t])
        true(len(set(top_idx[t].tolist())) == 2, f"Token {t} picks the same expert twice", "2 different experts", top_idx[t])
        true(np.all(np.diff(chosen) <= 0), f"The experts of token {t} are not in descending order of logit", "descending logits", chosen)
        true(chosen.min() >= rest.max(), f"Token {t} skips an expert with a larger logit", f"logits at least {rest.max()}", chosen)


@check("properties", "uniform dispatch gives a loss of exactly 1", "When each expert gets the same number of assignments, every f_i is 1 / E. The loss is then the sum of P_i, which is 1, for any probabilities.")
def uniform_dispatch(sub):
    rng = np.random.default_rng(2)
    logits = rng.normal(size=(4, 4)) * 0.3 + np.eye(4) * 5.0
    close(sub.load_balancing_loss(logits, 1), 1.0, rtol=1e-12, what="the loss for one token per expert")


@check("properties", "the gradient of the loss matches the paper", "f_i is a count, so it has no gradient. The gradient flows only through P_i. For token t and expert j it is E / T times p_tj times (f_j minus the sum over i of f_i p_ti).")
def loss_gradient(sub):
    rng = np.random.default_rng(3)
    logits = no_ties(rng, 5, 4) * 2.0
    T, E = logits.shape
    p = full_softmax(logits)
    counts = np.zeros(E)
    for row in logits:
        counts[np.argsort(-row, kind="stable")[:2]] += 1
    f = counts / (T * 2)
    expected = E / T * p * (f[None, :] - (p @ f)[:, None])
    grad = numeric_grad(lambda z: sub.load_balancing_loss(z, 2), logits, eps=1e-6)
    close(grad, expected, rtol=1e-5, atol=1e-8, what="the finite difference gradient of the loss")


@check("properties", "the inputs are not changed", "route and load_balancing_loss must not write into the logits array.")
def inputs_unchanged(sub):
    rng = np.random.default_rng(4)
    logits = rng.normal(size=(5, 6))
    saved = logits.copy()
    sub.route(logits, 2)
    sub.load_balancing_loss(logits, 2)
    true(np.array_equal(saved, logits), "The function changed the logits", saved, logits)


@check("edge", "ties go to the lower expert index", "Three experts share the largest logit. The two with the lowest indices win, and they get equal gates.")
def ties(sub):
    top_idx, gates = sub.route(np.array([[0.0, 5.0, 5.0, 5.0]]), 2)
    equal(np.asarray(top_idx), np.array([[1, 2]]), what="the chosen experts")
    close(gates, [[0.5, 0.5]], what="the gates")


@check("edge", "large logits do not overflow", "exp(1000) is infinite in float64. Subtract the row maximum of the chosen logits before np.exp.")
def large_logits(sub):
    logits = np.array([[1000.0, 999.0, -1000.0]])
    top_idx, gates = sub.route(logits, 2)
    equal(np.asarray(top_idx), np.array([[0, 1]]), what="the chosen experts")
    close(gates, [[0.73105858, 0.26894142]], rtol=1e-7, what="the gates")
    close(sub.load_balancing_loss(logits, 2), 1.5, rtol=1e-9, what="the loss")


@check("edge", "top_k equal to the number of experts", "With k = E every expert is chosen, so the gates are the full softmax in descending order and every f_i is 1 / E.")
def k_equals_e(sub):
    logits = np.array([[0.5, 2.0, -1.0]])
    top_idx, gates = sub.route(logits, 3)
    equal(np.asarray(top_idx), np.array([[1, 0, 2]]), what="the chosen experts")
    close(gates, full_softmax(logits)[:, [1, 0, 2]], rtol=1e-12, what="the gates")
    close(sub.load_balancing_loss(logits, 3), 1.0, rtol=1e-12, what="the loss")


@check("edge", "every token picks the same expert", "When all tokens go to expert 0 with high probability, f_0 is 1 and P_0 is near 1. The loss is near its maximum E.")
def collapse(sub):
    logits = np.array([[8.0, 0.0, 0.0], [7.0, 0.0, 1.0], [9.0, 2.0, 0.0], [6.0, 0.0, 0.0]])
    close(sub.load_balancing_loss(logits, 1), 2.9924873086504276, rtol=1e-9, what="the loss")
    top_idx, gates = sub.route(logits[:1], 1)
    close(gates, [[1.0]], what="the gate of one chosen expert")


@fixture("cases")
def cases(ref):
    rng = np.random.default_rng(42)
    for t, e, k in [(1, 4, 1), (6, 4, 2), (8, 8, 2), (5, 6, 3), (12, 16, 4)]:
        logits = rng.normal(size=(t, e)) * 2.0
        top_idx, gates = ref.route(logits, k)
        yield {"logits": logits, "top_k": k}, {"top_idx": top_idx, "gates": gates, "loss": ref.load_balancing_loss(logits, k)}


@check("reference", "routing and loss match the reference on 5 random cases", "Your chosen experts, gates and loss agree with the reference solution.")
def reference_cases(sub):
    for case, expected in fixtures("cases"):
        label = f"logits of shape {case['logits'].shape} and top_k {case['top_k']}"
        top_idx, gates = sub.route(case["logits"], case["top_k"])
        equal(np.asarray(top_idx), expected["top_idx"], what=f"the chosen experts for {label}")
        close(gates, expected["gates"], rtol=1e-9, what=f"the gates for {label}")
        close(sub.load_balancing_loss(case["logits"], case["top_k"]), expected["loss"], rtol=1e-9, what=f"the loss for {label}")
