import numpy as np

from practice_check import check, close, equal, fixture, fixtures, raises, shape, true

X1 = np.array([[[1.0, 0.0, 0.0, 1.0], [0.0, 1.0, 1.0, 0.0], [1.0, 1.0, 0.0, 0.0]]])
WQ1 = np.eye(4)
WK1 = np.array([[1.0, 0.0], [0.0, 1.0], [0.0, 0.0], [0.0, 0.0]])
WV1 = np.array([[1.0, 0.0], [0.0, 2.0], [0.0, 0.0], [1.0, 0.0]])
WO1 = np.eye(4)


def heads(x, n):
    B, T, D = x.shape
    return x.reshape(B, T, n, D // n).transpose(0, 2, 1, 3)


def attend(q, k, v):
    scores = q @ np.swapaxes(k, -1, -2) / np.sqrt(q.shape[-1])
    scores = scores - np.max(scores, axis=-1, keepdims=True)
    weights = np.exp(scores)
    weights = weights / np.sum(weights, axis=-1, keepdims=True)
    return weights @ v, weights


def mha(x, w_q, w_k, w_v, w_o, n_heads):
    out, weights = attend(heads(x @ w_q, n_heads), heads(x @ w_k, n_heads), heads(x @ w_v, n_heads))
    B, H, T, d = out.shape
    return out.transpose(0, 2, 1, 3).reshape(B, T, H * d) @ w_o, weights


def mqa(x, w_q, w_k, w_v, w_o, n_heads):
    q = heads(x @ w_q, n_heads)
    out, weights = attend(q, (x @ w_k)[:, None], (x @ w_v)[:, None])
    B, H, T, d = out.shape
    return out.transpose(0, 2, 1, 3).reshape(B, T, H * d) @ w_o, weights


def random_weights(rng, D, H, G):
    d_head = D // H
    return rng.normal(size=(D, D)) / np.sqrt(D), rng.normal(size=(D, G * d_head)) / np.sqrt(D), rng.normal(size=(D, G * d_head)) / np.sqrt(D), rng.normal(size=(D, D)) / np.sqrt(D)


@check("examples", "repeat two groups to four heads", "Query head h uses group h // (H / G). So heads 0 and 1 get group 0, and heads 2 and 3 get group 1.")
def example_repeat(sub):
    kv = np.arange(8.0).reshape(1, 2, 2, 2)
    out = sub.repeat_kv(kv, 4)
    shape(out, (1, 4, 2, 2), what="the repeated array")
    close(out, [[[[0.0, 1.0], [2.0, 3.0]], [[0.0, 1.0], [2.0, 3.0]], [[4.0, 5.0], [6.0, 7.0]], [[4.0, 5.0], [6.0, 7.0]]]], what="the repeated array")


@check("examples", "two query heads that share one key and value head", "Both query heads use the same keys and values. The weights differ because the queries differ.")
def example_gqa(sub):
    output, weights = sub.grouped_query_attention(X1, WQ1, WK1, WV1, WO1, 2, 1)
    close(weights, [[[[0.40111209, 0.19777581, 0.40111209], [0.19777581, 0.40111209, 0.40111209], [0.24825508, 0.24825508, 0.50348984]], [[0.19777581, 0.40111209, 0.40111209], [0.40111209, 0.19777581, 0.40111209], [0.33333333, 0.33333333, 0.33333333]]]], rtol=1e-7, what="the weights")
    close(output, [[[1.20333628, 1.19777581, 0.79666372, 1.60444837], [0.79666372, 1.60444837, 1.20333628, 1.19777581], [1.0, 1.50348984, 1.0, 1.33333333]]], rtol=1e-7, what="the output")


@check("examples", "mean-pool four heads into two groups", "Group g is the mean of the heads g * r to g * r + r - 1, with r = H / G. Each head is a block of d_head columns.")
def example_pool(sub):
    close(sub.mean_pool_kv_heads(np.arange(16.0).reshape(2, 8), 4, 2), [[1.0, 2.0, 5.0, 6.0], [9.0, 10.0, 13.0, 14.0]], what="the pooled projection")


@check("properties", "G = H gives multi-head attention", "With one key and value head for each query head, nothing is shared. The result must equal standard multi-head attention.")
def g_equals_h(sub):
    rng = np.random.default_rng(0)
    x = rng.normal(size=(2, 5, 8))
    w_q, w_k, w_v, w_o = random_weights(rng, 8, 4, 4)
    output, weights = sub.grouped_query_attention(x, w_q, w_k, w_v, w_o, 4, 4)
    expected, expected_w = mha(x, w_q, w_k, w_v, w_o, 4)
    close(weights, expected_w, atol=1e-10, what="the weights")
    close(output, expected, atol=1e-10, what="the output")


@check("properties", "G = 1 gives multi-query attention", "With one group, every query head uses the same single key head and value head.")
def g_equals_one(sub):
    rng = np.random.default_rng(1)
    x = rng.normal(size=(1, 6, 8))
    w_q, w_k, w_v, w_o = random_weights(rng, 8, 4, 1)
    output, weights = sub.grouped_query_attention(x, w_q, w_k, w_v, w_o, 4, 1)
    expected, expected_w = mqa(x, w_q, w_k, w_v, w_o, 4)
    close(weights, expected_w, atol=1e-10, what="the weights")
    close(output, expected, atol=1e-10, what="the output")


@check("properties", "heads in a group read the same keys", "Give two query heads the same query weights. When they are in the same group, their attention weights are equal. In different groups, they are not.")
def same_group_same_keys(sub):
    rng = np.random.default_rng(2)
    D, H, G = 8, 4, 2
    x = rng.normal(size=(1, 5, D))
    w_q, w_k, w_v, w_o = random_weights(rng, D, H, G)
    w_q[:, 2:4] = w_q[:, 0:2]
    w_q[:, 4:6] = w_q[:, 0:2]
    _, weights = sub.grouped_query_attention(x, w_q, w_k, w_v, w_o, H, G)
    weights = np.asarray(weights)
    shape(weights, (1, H, 5, 5), what="the weights")
    close(weights[0, 1], weights[0, 0], atol=1e-12, what="the weights of head 1, which is in group 0 with head 0")
    true(not np.allclose(weights[0, 2], weights[0, 0]), "Head 2 has the weights of head 0, but head 2 is in group 1", "different weights", weights[0, 2])


@check("properties", "pooled identical heads give back the same attention", "When the heads in each group already have equal key and value weights, mean pooling changes nothing. GQA with the pooled weights then equals multi-head attention.")
def pool_identity(sub):
    rng = np.random.default_rng(3)
    D, H, G = 8, 4, 2
    x = rng.normal(size=(1, 4, D))
    w_q, small_k, small_v, w_o = random_weights(rng, D, H, G)
    full_k = np.repeat(small_k.reshape(D, G, 1, 2), 2, axis=2).reshape(D, H * 2)
    full_v = np.repeat(small_v.reshape(D, G, 1, 2), 2, axis=2).reshape(D, H * 2)
    pooled_k = sub.mean_pool_kv_heads(full_k, H, G)
    pooled_v = sub.mean_pool_kv_heads(full_v, H, G)
    close(pooled_k, small_k, atol=1e-12, what="the pooled key projection")
    output, _ = sub.grouped_query_attention(x, w_q, pooled_k, pooled_v, w_o, H, G)
    expected, _ = mha(x, w_q, full_k, full_v, w_o, H)
    close(output, expected, atol=1e-10, what="the output with the pooled weights")


@check("properties", "the inputs are not changed", "A function that writes into x or into a weight matrix breaks the model that calls it.")
def inputs_unchanged(sub):
    rng = np.random.default_rng(4)
    x = rng.normal(size=(1, 3, 4))
    ws = list(random_weights(rng, 4, 2, 1))
    saved = [x.copy()] + [w.copy() for w in ws]
    sub.grouped_query_attention(x, *ws, 2, 1)
    big = rng.normal(size=(4, 8))
    big_saved = big.copy()
    sub.mean_pool_kv_heads(big, 4, 2)
    kv = rng.normal(size=(1, 2, 3, 2))
    kv_saved = kv.copy()
    sub.repeat_kv(kv, 4)
    for name, before, after in zip(["x", "w_q", "w_k", "w_v", "w_o", "the pooled matrix", "kv"], saved + [big_saved, kv_saved], [x] + ws + [big, kv]):
        true(np.array_equal(before, after), f"The function changed {name}", before, after)


@check("edge", "H not a multiple of G raises ValueError", "Each group must hold the same number of query heads. Raise ValueError when n_heads is not a multiple of n_kv_heads.")
def bad_groups(sub):
    rng = np.random.default_rng(5)
    x = rng.normal(size=(1, 2, 6))
    raises(ValueError, sub.grouped_query_attention, x, np.eye(6), rng.normal(size=(6, 4)), rng.normal(size=(6, 4)), np.eye(6), 3, 2)
    raises(ValueError, sub.repeat_kv, rng.normal(size=(1, 2, 2, 2)), 3)
    raises(ValueError, sub.mean_pool_kv_heads, rng.normal(size=(6, 6)), 3, 2)


@check("edge", "one token and one head", "With one token, the weight is 1 and the output is the value times W_o. With H = G = 1, GQA is single head attention.")
def one_token(sub):
    x = np.array([[[0.5, -1.0, 2.0]]])
    w_v = np.array([[1.0, 0.0, 0.0], [0.0, 2.0, 0.0], [0.0, 0.0, 3.0]])
    w_o = np.array([[0.0, 1.0, 0.0], [1.0, 0.0, 0.0], [0.0, 0.0, 1.0]])
    output, weights = sub.grouped_query_attention(x, np.eye(3), np.eye(3), w_v, w_o, 1, 1)
    close(weights, [[[[1.0]]]], what="the weights")
    close(output, [[[-2.0, 0.5, 6.0]]], what="the output")


@check("edge", "the scale uses d_head, not D", "Divide the scores by the square root of the size of one head, d_head = D / H.")
def scale_by_head(sub):
    rng = np.random.default_rng(6)
    x = rng.normal(size=(1, 4, 12)) * 2
    w_q, w_k, w_v, w_o = random_weights(rng, 12, 6, 3)
    _, weights = sub.grouped_query_attention(x, w_q, w_k, w_v, w_o, 6, 3)
    q = heads(x @ w_q, 6)
    k = np.repeat(heads(x @ w_k, 3), 2, axis=1)
    _, expected = attend(q, k, k)
    close(weights, expected, atol=1e-10, what="the weights")


@fixture("cases")
def cases(ref):
    rng = np.random.default_rng(42)
    for B, T, D, H, G in [(1, 3, 4, 2, 1), (2, 4, 8, 4, 2), (1, 5, 12, 6, 3), (2, 3, 8, 8, 4), (1, 6, 6, 3, 3)]:
        x = rng.normal(size=(B, T, D))
        w_q, w_k, w_v, w_o = random_weights(rng, D, H, G)
        output, weights = ref.grouped_query_attention(x, w_q, w_k, w_v, w_o, H, G)
        full = rng.normal(size=(D, D))
        yield {"x": x, "w_q": w_q, "w_k": w_k, "w_v": w_v, "w_o": w_o, "H": H, "G": G, "full": full}, {"output": output, "weights": weights, "pooled": ref.mean_pool_kv_heads(full, H, G)}


@check("reference", "GQA and pooling match the reference on 5 random cases", "Your output, weights and pooled projections agree with the reference solution for several head and group counts.")
def reference_cases(sub):
    for case, expected in fixtures("cases"):
        label = f"x of shape {case['x'].shape}, H = {case['H']}, G = {case['G']}"
        output, weights = sub.grouped_query_attention(case["x"], case["w_q"], case["w_k"], case["w_v"], case["w_o"], case["H"], case["G"])
        close(weights, expected["weights"], rtol=1e-8, atol=1e-12, what=f"the weights for {label}")
        close(output, expected["output"], rtol=1e-8, atol=1e-12, what=f"the output for {label}")
        close(sub.mean_pool_kv_heads(case["full"], case["H"], case["G"]), expected["pooled"], rtol=1e-10, atol=1e-12, what=f"the pooled projection for {label}")
