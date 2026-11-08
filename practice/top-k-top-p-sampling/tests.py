import numpy as np

from practice_check import check, close, equal, fixture, fixtures, shape, true

LOGITS = np.array([2.0, 1.0, 0.5, 0.5, -1.0])


def plain_softmax(z):
    z = np.asarray(z, dtype=float)
    e = np.exp(z - np.max(z))
    return e / np.sum(e)


def inverse_cdf(probs, u):
    cum = np.cumsum(probs)
    for i in range(len(cum)):
        if u < cum[i]:
            return i
    return int(np.nonzero(probs)[0][-1])


def kept(filtered):
    return np.nonzero(np.isfinite(np.asarray(filtered, dtype=float)))[0].tolist()


@check("examples", "top-k with k = 3 and a tie", "Keep the k largest logits and set the rest to minus infinity. Indices 2 and 3 have the same logit, so the lower index 2 is kept.")
def example_top_k(sub):
    out = sub.top_k_filter(LOGITS, 3)
    shape(out, (5,), what="the filtered logits")
    equal(kept(out), [0, 1, 2], what="the kept indices")
    close(np.asarray(out)[[0, 1, 2]], [2.0, 1.0, 0.5], what="the kept logits")


@check("examples", "top-p with p = 0.8 keeps the token that crosses p", "The sorted cumulative probabilities are 0.5365, 0.7339 and 0.8536. The third token makes the sum reach 0.8, so it is kept.")
def example_top_p(sub):
    out = sub.top_p_filter(LOGITS, 0.8)
    shape(out, (5,), what="the filtered logits")
    equal(kept(out), [0, 1, 2], what="the kept indices")


@check("examples", "probabilities with temperature 0.5 and top-k 3", "Divide the logits by the temperature first. Then apply top-k. Then take the softmax over the kept logits.")
def example_probs(sub):
    close(sub.sampling_probs(LOGITS, temperature=0.5, top_k=3), [0.84379473, 0.1141952, 0.04201007, 0.0, 0.0], rtol=1e-6, atol=1e-12, what="the probabilities")


@check("examples", "one draw with seed 0", "The first rng.random() of seed 0 is 0.637. The smallest index whose cumulative probability is above 0.637 is 1.")
def example_sample(sub):
    equal(int(sub.sample(LOGITS, np.random.default_rng(0), top_k=3)), 1, what="the sampled index")


@check("properties", "probabilities sum to 1 and filtered tokens get exactly 0", "The final distribution is a softmax over the kept logits. A token that a filter removes has probability 0.")
def probs_valid(sub):
    rng = np.random.default_rng(1)
    for _ in range(5):
        z = rng.normal(size=12) * 2
        probs = np.asarray(sub.sampling_probs(z, temperature=0.8, top_k=6, top_p=0.7), dtype=float)
        shape(probs, (12,), what="the probabilities")
        close(np.sum(probs), 1.0, atol=1e-9, what="the sum of the probabilities")
        true(np.all(probs >= 0), "A probability is negative", "values from 0 to 1", probs)
        true(np.count_nonzero(probs) <= 6, "More than k tokens have a probability above 0", "at most 6 nonzero values", probs)


@check("properties", "top-k keeps exactly the k largest logits unchanged", "top_k_filter returns an array of the same shape. The k largest logits keep their values. Every other entry is minus infinity.")
def top_k_property(sub):
    rng = np.random.default_rng(2)
    for k in [1, 3, 7]:
        z = rng.normal(size=10)
        out = np.asarray(sub.top_k_filter(z, k), dtype=float)
        shape(out, (10,), what=f"the filtered logits for k = {k}")
        idx = kept(out)
        equal(sorted(idx), sorted(np.argsort(-z)[:k].tolist()), what=f"the kept indices for k = {k}")
        close(out[idx], z[idx], atol=0, rtol=0, what=f"the kept logits for k = {k}")
        true(np.all(np.isneginf(np.delete(out, idx))), "A removed entry is not minus infinity", "-inf", out)


@check("properties", "top-p keeps the smallest set of most likely tokens that reaches p", "Sort the tokens by probability, highest first. Keep tokens until the sum reaches p. The kept mass is at least p, and without its least likely token it is below p.")
def top_p_property(sub):
    rng = np.random.default_rng(3)
    for p in [0.3, 0.6, 0.9, 0.95]:
        z = rng.normal(size=9) * 1.5
        probs = plain_softmax(z)
        idx = kept(sub.top_p_filter(z, p))
        true(len(idx) >= 1, "top_p_filter removed every token", "at least one kept token", idx)
        order = np.argsort(-probs, kind="stable")
        equal(sorted(idx), sorted(order[:len(idx)].tolist()), what=f"the kept indices for p = {p}")
        mass = float(np.sum(probs[idx]))
        smallest = float(np.min(probs[idx]))
        true(mass >= p - 1e-12, f"The kept mass {mass:.4f} is below p = {p}", f">= {p}", mass)
        true(mass - smallest < p, f"The kept set for p = {p} is not the smallest set", f"mass without the last token < {p}", mass - smallest)


@check("properties", "temperature scales the log ratio of two tokens", "With temperature t, log(p_i / p_j) equals (z_i - z_j) / t.")
def temperature_property(sub):
    z = np.array([1.5, -0.5, 0.25, 2.0])
    for t in [0.25, 1.0, 3.0]:
        probs = np.asarray(sub.sampling_probs(z, temperature=t), dtype=float)
        close(np.log(probs[3] / probs[1]), (z[3] - z[1]) / t, rtol=1e-9, what=f"log(p_3 / p_1) at t = {t}")


@check("properties", "sample uses one rng.random() and the inverse CDF", "Each call draws u = rng.random() once. It returns the smallest index i where u is below the cumulative probability at i, in vocabulary order.")
def sample_method(sub):
    rng_a = np.random.default_rng(11)
    rng_b = np.random.default_rng(11)
    z = np.array([0.2, 1.4, -0.3, 0.9, 0.9, -2.0, 0.1])
    probs = plain_softmax(np.where(np.isin(np.arange(7), [0, 1, 3, 4, 6]), z / 0.9, -np.inf))
    got = [int(sub.sample(z, rng_a, temperature=0.9, top_k=5)) for _ in range(40)]
    expected = [inverse_cdf(probs, rng_b.random()) for _ in range(40)]
    equal(got, expected, what="40 draws with seed 11")


@check("properties", "the inputs are not changed", "A filter that writes minus infinity into its input array breaks the code that calls it.")
def inputs_unchanged(sub):
    z = np.array([0.3, -1.2, 2.0, 0.7, 0.7])
    saved = z.copy()
    sub.top_k_filter(z, 2)
    sub.top_p_filter(z, 0.5)
    sub.sampling_probs(z, temperature=0.5, top_k=3, top_p=0.9)
    sub.sample(z, np.random.default_rng(0), temperature=2.0, top_k=4, top_p=0.8)
    close(z, saved, atol=0, rtol=0, what="the logits after the calls")


@check("edge", "ties in top-k keep the lower indices", "When logits are equal, sort with a stable sort so that the lower index comes first.")
def top_k_ties(sub):
    equal(kept(sub.top_k_filter(np.zeros(6), 2)), [0, 1], what="the kept indices of 6 equal logits")
    equal(kept(sub.top_k_filter(np.array([0.0, 1.0, 1.0, 1.0]), 2)), [1, 2], what="the kept indices of [0, 1, 1, 1]")


@check("edge", "top-p keeps a token that makes the sum exactly p", "The rule is cumulative sum >= p. Two equal tokens have 0.5 each, so p = 0.5 keeps only the first one.")
def top_p_exact(sub):
    equal(kept(sub.top_p_filter(np.array([0.0, 0.0]), 0.5)), [0], what="the kept indices")


@check("edge", "a very small p keeps only the most likely token", "The first sorted token always stays, so top-p never removes every token.")
def top_p_small(sub):
    equal(kept(sub.top_p_filter(np.array([0.1, 3.0, 3.0, -1.0]), 1e-9)), [1], what="the kept indices")


@check("edge", "k at least the vocabulary size and p = 1 keep every token", "top_k_filter with k >= V and top_p_filter with p = 1.0 change nothing. A cumulative sum can round to just below 1, so keep every token when no prefix reaches p.")
def keep_all(sub):
    rng = np.random.default_rng(4)
    z = rng.normal(size=8)
    close(sub.top_k_filter(z, 8), z, atol=0, rtol=0, what="top-k with k = 8")
    close(sub.top_k_filter(z, 20), z, atol=0, rtol=0, what="top-k with k = 20")
    close(sub.top_p_filter(z, 1.0), z, atol=0, rtol=0, what="top-p with p = 1.0")


@check("edge", "large logits do not overflow", "exp(1000) is infinite in float64. Subtract the maximum before np.exp.")
def large_logits(sub):
    close(sub.sampling_probs(np.array([1000.0, 1001.0, 1002.0])), [0.09003057, 0.24472847, 0.66524096], rtol=1e-6, what="the probabilities")
    close(sub.sampling_probs(np.array([1000.0, 1001.0, 1002.0]), top_p=0.5), [0.0, 0.0, 1.0], atol=1e-12, what="the probabilities with p = 0.5")


@check("edge", "top-k = 1 makes sampling greedy", "With one kept token, every draw returns the index of the largest logit.")
def greedy(sub):
    rng = np.random.default_rng(5)
    z = np.array([0.5, 2.5, 2.5, 1.0])
    equal({int(sub.sample(z, rng, top_k=1)) for _ in range(20)}, {1}, what="the set of 20 sampled indices")


@fixture("cases")
def cases(ref):
    rng = np.random.default_rng(42)
    settings = [(1.0, None, None), (0.7, None, None), (1.0, 4, None), (1.0, None, 0.9), (0.5, 5, 0.8), (1.5, 8, 0.6), (2.0, None, 0.5), (0.8, 3, 0.99)]
    for t, k, p in settings:
        z = rng.normal(size=10) * 2
        seed = int(rng.integers(0, 1000))
        draws_rng = np.random.default_rng(seed)
        draws = [int(ref.sample(z, draws_rng, temperature=t, top_k=k, top_p=p)) for _ in range(15)]
        filtered_k = kept(ref.top_k_filter(z, k)) if k is not None else None
        filtered_p = kept(ref.top_p_filter(z, p)) if p is not None else None
        yield {"logits": z, "temperature": t, "top_k": k, "top_p": p, "seed": seed}, {
            "probs": ref.sampling_probs(z, temperature=t, top_k=k, top_p=p),
            "draws": draws,
            "top_k": filtered_k,
            "top_p": filtered_p,
        }


@check("reference", "filters match the reference on 8 random cases", "Your top_k_filter and top_p_filter keep the same tokens as the reference solution.")
def reference_filters(sub):
    for case, expected in fixtures("cases"):
        if case["top_k"] is not None:
            out = sub.top_k_filter(case["logits"], case["top_k"])
            equal(kept(out), expected["top_k"], what=f"the indices that top_k_filter keeps with k = {case['top_k']}")
            close(np.asarray(out)[expected["top_k"]], case["logits"][expected["top_k"]], atol=0, rtol=0, what=f"the kept logits with k = {case['top_k']}")
        if case["top_p"] is not None:
            out = sub.top_p_filter(case["logits"], case["top_p"])
            equal(kept(out), expected["top_p"], what=f"the indices that top_p_filter keeps with p = {case['top_p']}")
            close(np.asarray(out)[expected["top_p"]], case["logits"][expected["top_p"]], atol=0, rtol=0, what=f"the kept logits with p = {case['top_p']}")


@check("reference", "probabilities and draws match the reference", "Your sampling_probs and sample agree with the reference solution for the same settings and seeds.")
def reference_probs(sub):
    for case, expected in fixtures("cases"):
        label = f"t = {case['temperature']}, k = {case['top_k']}, p = {case['top_p']}"
        close(sub.sampling_probs(case["logits"], temperature=case["temperature"], top_k=case["top_k"], top_p=case["top_p"]), expected["probs"], rtol=1e-7, atol=1e-12, what=f"the probabilities for {label}")
        rng = np.random.default_rng(case["seed"])
        draws = [int(sub.sample(case["logits"], rng, temperature=case["temperature"], top_k=case["top_k"], top_p=case["top_p"])) for _ in range(15)]
        equal(draws, expected["draws"], what=f"15 draws for {label}")
