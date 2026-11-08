import numpy as np

from practice_check import check, close, equal, fixture, fixtures, raises, shape, true

K2 = np.array([[1.0, 0.0], [0.0, 1.0]])
V2 = np.array([[1.0, 2.0], [3.0, 4.0]])


def causal_attention(Q, K, V):
    T = Q.shape[0]
    scores = Q @ K.T / np.sqrt(Q.shape[-1])
    scores = np.where(np.triu(np.ones((T, T), dtype=bool), k=1), -np.inf, scores)
    scores = scores - np.max(scores, axis=-1, keepdims=True)
    weights = np.exp(scores)
    weights = weights / np.sum(weights, axis=-1, keepdims=True)
    return weights @ V


def example_cache(sub):
    cache = sub.KVCache(4, 2, 2)
    cache.append(K2, V2)
    cache.append(np.array([1.0, 1.0]), np.array([5.0, 6.0]))
    return cache


@check("examples", "append two steps, then one step", "append writes the new rows after the rows that are already in the cache. len(cache) counts the stored steps. A 1D k or v is one step.")
def example_append(sub):
    cache = sub.KVCache(4, 2, 2)
    cache.append(K2, V2)
    equal(len(cache), 2, what="len(cache) after two steps")
    close(cache.keys(), K2, what="keys() after two steps")
    cache.append(np.array([1.0, 1.0]), np.array([5.0, 6.0]))
    equal(len(cache), 3, what="len(cache) after three steps")
    close(cache.values(), [[1.0, 2.0], [3.0, 4.0], [5.0, 6.0]], what="values() after three steps")


@check("examples", "one decode step over three cached steps", "The scores are the cached keys times q, divided by sqrt(d_k). The weights are their softmax. The output is the weights times the cached values.")
def example_decode(sub):
    output, weights = sub.decode_step(np.array([1.0, 0.0]), example_cache(sub))
    close(weights, [0.40111209, 0.19777581, 0.40111209], rtol=1e-6, what="the weights")
    close(output, [3.0, 4.0], rtol=1e-6, what="the output")


@check("examples", "a full cache raises ValueError", "A cache with max_len 4 and 3 stored steps has room for 1 step. An append of 2 steps must raise ValueError and keep the cache as it was.")
def example_overflow(sub):
    cache = example_cache(sub)
    raises(ValueError, cache.append, np.zeros((2, 2)), np.zeros((2, 2)))
    equal(len(cache), 3, what="len(cache) after the failed append")


@check("properties", "incremental decode equals full causal attention", "With a cache, step t attends to the keys and values of steps 0 to t. This is row t of causal attention over the whole sequence.")
def incremental_equals_full(sub):
    rng = np.random.default_rng(0)
    T, dk, dv = 7, 4, 3
    Q = rng.normal(size=(T, dk))
    K = rng.normal(size=(T, dk))
    V = rng.normal(size=(T, dv))
    full = causal_attention(Q, K, V)
    cache = sub.KVCache(T, dk, dv)
    for t in range(T):
        cache.append(K[t], V[t])
        output, weights = sub.decode_step(Q[t], cache)
        shape(weights, (t + 1,), what=f"the weights at step {t}")
        close(output, full[t], atol=1e-10, what=f"the output at step {t}")


@check("properties", "a prompt in one append, then one step at a time", "An append of P steps at once gives the same cache as P appends of one step. The decode steps after the prompt still match causal attention.")
def prefill_then_decode(sub):
    rng = np.random.default_rng(1)
    T, P, dk, dv = 8, 5, 3, 2
    Q = rng.normal(size=(T, dk))
    K = rng.normal(size=(T, dk))
    V = rng.normal(size=(T, dv))
    full = causal_attention(Q, K, V)
    cache = sub.KVCache(T, dk, dv)
    cache.append(K[:P], V[:P])
    equal(len(cache), P, what="len(cache) after the prompt")
    close(cache.keys(), K[:P], what="keys() after the prompt")
    for t in range(P, T):
        cache.append(K[t:t + 1], V[t:t + 1])
        output, _ = sub.decode_step(Q[t], cache)
        close(output, full[t], atol=1e-10, what=f"the output at step {t}")
    close(cache.values(), V, what="values() at the end")


@check("properties", "weights sum to 1 and the inputs are not changed", "Each decode step gives a probability distribution over the cached steps. The cache stores a copy of k and v, so a later change to the caller's arrays does not change the cache.")
def weights_and_copies(sub):
    rng = np.random.default_rng(2)
    k = rng.normal(size=(3, 4))
    v = rng.normal(size=(3, 5))
    q = rng.normal(size=4)
    saved = [k.copy(), v.copy(), q.copy()]
    cache = sub.KVCache(6, 4, 5)
    cache.append(k, v)
    output, weights = sub.decode_step(q, cache)
    for name, before, after in zip(["k", "v", "q"], saved, [k, v, q]):
        true(np.array_equal(before, after), f"The code changed {name}", before, after)
    close(np.sum(weights), 1.0, atol=1e-12, what="the sum of the weights")
    shape(output, (5,), what="the output")
    k[:] = 0.0
    v[:] = 0.0
    close(cache.keys(), saved[0], what="keys() after the caller changed k")
    close(cache.values(), saved[1], what="values() after the caller changed v")


@check("edge", "fill the cache to exactly max_len", "An append that ends at max_len is allowed. Only an append past max_len raises ValueError.")
def fill_exactly(sub):
    cache = sub.KVCache(3, 2, 1)
    cache.append(np.ones((2, 2)), np.ones((2, 1)))
    cache.append(np.array([2.0, 2.0]), np.array([7.0]))
    equal(len(cache), 3, what="len(cache) when the cache is full")
    close(cache.values(), [[1.0], [1.0], [7.0]], what="values() when the cache is full")
    raises(ValueError, cache.append, np.ones(2), np.ones(1))


@check("edge", "a failed append keeps the cache unchanged", "Check the room in the cache before you write or count anything. After the ValueError, the length, keys and values must be the same as before.")
def failed_append_unchanged(sub):
    cache = sub.KVCache(4, 2, 2)
    cache.append(K2, V2)
    raises(ValueError, cache.append, np.ones((3, 2)), np.ones((3, 2)))
    equal(len(cache), 2, what="len(cache) after the failed append")
    close(cache.keys(), K2, what="keys() after the failed append")
    cache.append(np.array([1.0, 1.0]), np.array([5.0, 6.0]))
    equal(len(cache), 3, what="len(cache) after the next append")
    close(cache.values(), [[1.0, 2.0], [3.0, 4.0], [5.0, 6.0]], what="values() after the next append")


@check("edge", "k and v with different step counts raise ValueError", "Each step has one key and one value. An append with 2 keys and 1 value must raise ValueError.")
def mismatched_steps(sub):
    cache = sub.KVCache(4, 2, 2)
    raises(ValueError, cache.append, np.ones((2, 2)), np.ones((1, 2)))
    equal(len(cache), 0, what="len(cache) after the failed append")


@check("edge", "one cached step and large scores", "With one cached step the weight is 1 and the output is that value. Large scores must not overflow, so subtract the maximum score before np.exp.")
def one_step_and_large(sub):
    cache = sub.KVCache(2, 2, 2)
    cache.append(np.array([3.0, -1.0]), np.array([2.5, -4.0]))
    output, weights = sub.decode_step(np.array([0.2, 0.9]), cache)
    close(weights, [1.0], what="the weights with one step")
    close(output, [2.5, -4.0], what="the output with one step")
    cache.append(np.array([2999.0, 0.0]), np.array([1.0, 1.0]))
    output, weights = sub.decode_step(np.array([1.0, 0.0]), cache)
    true(np.all(np.isfinite(output)), "The output has NaN or infinite values", "finite values", output)
    close(weights, [0.0, 1.0], atol=1e-12, what="the weights with a large score")


@fixture("runs")
def runs(ref):
    rng = np.random.default_rng(42)
    for max_len, dk, dv, chunks in [(5, 2, 3, [2, 1, 1]), (8, 4, 4, [3, 2, 2, 1]), (6, 8, 2, [1, 1, 1, 1, 1, 1]), (10, 3, 5, [6, 1, 2])]:
        steps = []
        outputs = []
        weights = []
        cache = ref.KVCache(max_len, dk, dv)
        for n in chunks:
            k = rng.normal(size=(n, dk))
            v = rng.normal(size=(n, dv))
            q = rng.normal(size=dk)
            cache.append(k, v)
            out, w = ref.decode_step(q, cache)
            steps.append({"k": k, "v": v, "q": q})
            outputs.append(out)
            weights.append(w)
        yield {"max_len": max_len, "dk": dk, "dv": dv, "steps": steps}, {"outputs": outputs, "weights": weights}


@check("reference", "decode steps match the reference on 4 random runs", "Your cache and decode_step agree with the reference for appends of several sizes.")
def reference_runs(sub):
    for case, expected in fixtures("runs"):
        cache = sub.KVCache(case["max_len"], case["dk"], case["dv"])
        for index, step in enumerate(case["steps"]):
            cache.append(step["k"], step["v"])
            output, weights = sub.decode_step(step["q"], cache)
            label = f"step {index} of the run with max_len {case['max_len']}"
            close(weights, expected["weights"][index], rtol=1e-8, atol=1e-12, what=f"the weights at {label}")
            close(output, expected["outputs"][index], rtol=1e-8, atol=1e-12, what=f"the output at {label}")
