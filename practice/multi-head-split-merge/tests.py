import numpy as np

from practice_check import check, close, equal, fixture, fixtures, raises, shape, true

X3 = np.array([[[1.0, 0.0, 0.0, 1.0], [0.0, 2.0, 1.0, 0.0], [1.0, 1.0, 1.0, 1.0]]])


def projections(rng, d):
    return [rng.normal(size=(d, d)) / np.sqrt(d) for _ in range(4)]


def one_head(q, k, v):
    scores = q @ np.swapaxes(k, -1, -2) / np.sqrt(q.shape[-1])
    scores = scores - np.max(scores, axis=-1, keepdims=True)
    weights = np.exp(scores)
    weights = weights / np.sum(weights, axis=-1, keepdims=True)
    return weights @ v, weights


@check("examples", "split a (1, 2, 4) array into 2 heads", "Head h holds the columns h * d_head to (h + 1) * d_head - 1 of every token. The head axis comes before the token axis.")
def example_split(sub):
    x = np.arange(8.0).reshape(1, 2, 4)
    close(sub.split_heads(x, 2), [[[[0.0, 1.0], [4.0, 5.0]], [[2.0, 3.0], [6.0, 7.0]]]], what="split_heads(x, 2)")


@check("examples", "merge the two heads back", "merge_heads is the inverse of split_heads. It puts the columns of each head back in their block.")
def example_merge(sub):
    heads = np.array([[[[0.0, 1.0], [4.0, 5.0]], [[2.0, 3.0], [6.0, 7.0]]]])
    close(sub.merge_heads(heads), np.arange(8.0).reshape(1, 2, 4), what="merge_heads of the split example")


@check("examples", "multi-head attention with identity projections", "With identity projections, Q, K and V equal x. Each head runs softmax(Q K^T / sqrt(d_head)) V on its own two columns.")
def example_mha(sub):
    eye = np.eye(4)
    output, weights = sub.multi_head_attention(X3, eye, eye, eye, eye, 2)
    close(weights, [[[[0.40111209, 0.19777581, 0.40111209], [0.04538836, 0.76791794, 0.1866937], [0.19777581, 0.40111209, 0.40111209]], [[0.40111209, 0.19777581, 0.40111209], [0.19777581, 0.40111209, 0.40111209], [0.24825508, 0.24825508, 0.50348984]]]], rtol=1e-6, what="the weights")
    close(output, [[[0.80222419, 0.79666372, 0.59888791, 0.80222419], [0.23208206, 1.72252957, 0.80222419, 0.59888791], [0.59888791, 1.20333628, 0.75174492, 0.75174492]]], rtol=1e-6, what="the output")


@check("properties", "merge_heads(split_heads(x)) gives x", "The split and the merge only move numbers. A round trip must give the input back exactly, for every number of heads.")
def round_trip(sub):
    rng = np.random.default_rng(0)
    x = rng.normal(size=(2, 5, 12))
    for h in [1, 2, 3, 4, 6, 12]:
        heads = sub.split_heads(x, h)
        shape(heads, (2, h, 5, 12 // h), what=f"split_heads with {h} heads")
        close(sub.merge_heads(heads), x, rtol=0, atol=0, what=f"the round trip with {h} heads")


@check("properties", "head h uses the block of columns h * d_head to (h + 1) * d_head", "split_heads(x, H)[:, h] must equal x[:, :, h * d_head:(h + 1) * d_head]. A strided layout passes the round trip but gives each head the wrong columns.")
def head_columns(sub):
    rng = np.random.default_rng(1)
    x = rng.normal(size=(3, 4, 12))
    heads = np.asarray(sub.split_heads(x, 3))
    shape(heads, (3, 3, 4, 4), what="split_heads with 3 heads")
    for h in range(3):
        close(heads[:, h], x[:, :, h * 4:(h + 1) * 4], rtol=0, atol=0, what=f"head {h}")


@check("properties", "shapes and weight rows that sum to 1", "The output has the shape of x. The weights have shape (B, H, T, T) and each row is a softmax over the keys.")
def mha_shapes(sub):
    rng = np.random.default_rng(2)
    x = rng.normal(size=(2, 5, 8))
    output, weights = sub.multi_head_attention(x, *projections(rng, 8), 4)
    shape(output, (2, 5, 8), what="the output")
    shape(weights, (2, 4, 5, 5), what="the weights")
    close(np.sum(weights, axis=-1), np.ones((2, 4, 5)), atol=1e-9, what="the row sums of the weights")


@check("properties", "each head is a separate attention over its own columns", "Head h attends with the columns h * d_head to (h + 1) * d_head of Q, K and V, and scales by sqrt(d_head).")
def heads_independent(sub):
    rng = np.random.default_rng(3)
    x = rng.normal(size=(1, 4, 6))
    w_q, w_k, w_v, w_o = projections(rng, 6)
    _, weights = sub.multi_head_attention(x, w_q, w_k, w_v, w_o, 3)
    q, k, v = x[0] @ w_q, x[0] @ w_k, x[0] @ w_v
    for h in range(3):
        cols = slice(2 * h, 2 * h + 2)
        _, expected = one_head(q[:, cols], k[:, cols], v[:, cols])
        close(np.asarray(weights)[0, h], expected, atol=1e-9, what=f"the weights of head {h}")


@check("properties", "the inputs are not changed", "A function that writes into x or into a weight matrix breaks the code that calls it.")
def inputs_unchanged(sub):
    rng = np.random.default_rng(4)
    x = rng.normal(size=(2, 3, 4))
    mats = projections(rng, 4)
    saved = [x.copy()] + [m.copy() for m in mats]
    sub.split_heads(x, 2)
    sub.multi_head_attention(x, *mats, 2)
    for name, before, after in zip(["x", "w_q", "w_k", "w_v", "w_o"], saved, [x] + mats):
        true(np.array_equal(before, after), f"The function changed {name}", before, after)


@check("edge", "D not divisible by n_heads raises ValueError", "Each head needs the same number of columns. When D % n_heads is not 0, raise ValueError.")
def not_divisible(sub):
    raises(ValueError, sub.split_heads, np.zeros((1, 2, 6)), 4)


@check("edge", "one head and one column per head", "With 1 head, multi-head attention is single-head attention scaled by sqrt(D). With D heads, each head has one column.")
def extreme_head_counts(sub):
    rng = np.random.default_rng(5)
    x = rng.normal(size=(2, 3, 4))
    w_q, w_k, w_v, w_o = projections(rng, 4)
    output, weights = sub.multi_head_attention(x, w_q, w_k, w_v, w_o, 1)
    expected_out, expected_w = one_head(x @ w_q, x @ w_k, x @ w_v)
    close(np.asarray(weights)[:, 0], expected_w, atol=1e-9, what="the weights with 1 head")
    close(output, expected_out @ w_o, atol=1e-9, what="the output with 1 head")
    heads = sub.split_heads(x, 4)
    shape(heads, (2, 4, 3, 1), what="split_heads with 4 heads of 1 column")
    close(np.asarray(heads)[:, :, :, 0], np.transpose(x, (0, 2, 1)), rtol=0, atol=0, what="the heads with 1 column")


@check("edge", "large activations do not overflow", "Scores larger than 709 overflow np.exp. Subtract the maximum of each row before np.exp.")
def large_activations(sub):
    x = np.array([[[40.0, -30.0, 25.0, 35.0], [-35.0, 40.0, 30.0, -20.0], [30.0, 30.0, -40.0, 40.0]]])
    eye = np.eye(4)
    output, weights = sub.multi_head_attention(x, eye, eye, eye, eye, 2)
    true(np.all(np.isfinite(np.asarray(output, dtype=float))), "The output has NaN or infinite values", "finite values", output)
    close(np.sum(weights, axis=-1), np.ones((1, 2, 3)), atol=1e-9, what="the row sums of the weights")


@fixture("cases")
def cases(ref):
    rng = np.random.default_rng(42)
    for b, t, d, h in [(1, 3, 4, 2), (2, 4, 6, 3), (2, 5, 8, 4), (1, 6, 8, 1), (3, 2, 12, 6)]:
        x = rng.normal(size=(b, t, d))
        mats = projections(rng, d)
        output, weights = ref.multi_head_attention(x, *mats, h)
        yield {"x": x, "w_q": mats[0], "w_k": mats[1], "w_v": mats[2], "w_o": mats[3], "n_heads": h}, {"split": ref.split_heads(x, h), "output": output, "weights": weights}


@check("reference", "split_heads matches the reference", "Your split gives the same heads as the reference solution on random inputs.")
def reference_split(sub):
    for case, expected in fixtures("cases"):
        close(sub.split_heads(case["x"], case["n_heads"]), expected["split"], rtol=0, atol=0, what=f"split_heads for x of shape {case['x'].shape} and {case['n_heads']} heads")


@check("reference", "multi-head attention matches the reference", "Your output and weights agree with the reference solution on 5 random cases.")
def reference_mha(sub):
    for case, expected in fixtures("cases"):
        output, weights = sub.multi_head_attention(case["x"], case["w_q"], case["w_k"], case["w_v"], case["w_o"], case["n_heads"])
        label = f"x of shape {case['x'].shape} and {case['n_heads']} heads"
        close(weights, expected["weights"], rtol=1e-7, atol=1e-12, what=f"the weights for {label}")
        close(output, expected["output"], rtol=1e-7, atol=1e-12, what=f"the output for {label}")
