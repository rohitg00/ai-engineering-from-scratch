import numpy as np

from practice_check import check, close, equal, fixture, fixtures, shape, true

Q2 = np.array([[1.0, 0.0], [0.0, 1.0]])
K3 = np.array([[1.0, 0.0], [0.0, 1.0], [1.0, 1.0]])
V3 = np.array([[1.0, 2.0], [3.0, 4.0], [5.0, 6.0]])


def reference_attention(Q, K, V, mask=None):
    scores = Q @ np.swapaxes(K, -1, -2) / np.sqrt(Q.shape[-1])
    if mask is not None:
        scores = np.where(mask, -np.inf, scores)
    scores = scores - np.max(scores, axis=-1, keepdims=True)
    weights = np.exp(scores)
    weights = weights / np.sum(weights, axis=-1, keepdims=True)
    return weights @ V, weights


def random_mask(rng, shape_):
    mask = rng.random(shape_) < 0.5
    mask[..., 0] = False
    return mask


@check("examples", "attention without a mask", "The scores are Q times K transposed, divided by sqrt(d_k). The weights are a softmax over each row. The output is the weights times V.")
def example_unmasked(sub):
    output, weights = sub.scaled_dot_product_attention(Q2, K3, V3)
    close(weights, [[0.40111209, 0.19777581, 0.40111209], [0.19777581, 0.40111209, 0.40111209]], rtol=1e-6, what="the weights")
    close(output, [[3.0, 4.0], [3.40667256, 4.40667256]], rtol=1e-6, what="the output")


@check("examples", "the causal mask for T = 3", "The causal mask is True above the diagonal, where the key comes after the query. The diagonal is False.")
def example_causal_mask(sub):
    mask = sub.causal_mask(3)
    shape(mask, (3, 3), what="the mask")
    true(np.asarray(mask).dtype == bool, "The mask must be a bool array", "dtype bool", np.asarray(mask).dtype)
    equal(np.asarray(mask), np.array([[False, True, True], [False, False, True], [False, False, False]]), what="the causal mask")


@check("examples", "causal attention of three tokens", "A True value in the mask blocks that key. Token i sees only tokens 0 to i, and its weights still sum to 1.")
def example_causal(sub):
    X = np.array([[1.0, 0.0], [0.0, 1.0], [1.0, 1.0]])
    output, weights = sub.scaled_dot_product_attention(X, X, V3, mask=sub.causal_mask(3))
    close(weights, [[1.0, 0.0, 0.0], [0.33023845, 0.66976155, 0.0], [0.24825508, 0.24825508, 0.50348984]], rtol=1e-6, atol=1e-9, what="the weights")
    close(output, [[1.0, 2.0], [2.3395231, 3.3395231], [3.51046953, 4.51046953]], rtol=1e-6, what="the output")


@check("properties", "batched shapes and rows that sum to 1", "The leading axes are batch axes. The weights have shape (..., Tq, Tk), the output has shape (..., Tq, d_v), and each row of weights sums to 1.")
def batched_shapes(sub):
    rng = np.random.default_rng(0)
    Q = rng.normal(size=(2, 3, 4, 5))
    K = rng.normal(size=(2, 3, 6, 5))
    V = rng.normal(size=(2, 3, 6, 7))
    output, weights = sub.scaled_dot_product_attention(Q, K, V)
    shape(weights, (2, 3, 4, 6), what="the weights")
    shape(output, (2, 3, 4, 7), what="the output")
    close(np.sum(weights, axis=-1), np.ones((2, 3, 4)), atol=1e-9, what="the row sums of the weights")
    true(np.all(np.asarray(weights) >= 0), "A weight is negative", "values from 0 to 1", weights)


@check("properties", "a batch gives the same result as one item at a time", "Each item in the batch is an independent attention. Transpose only the last two axes of K, for example with np.swapaxes(K, -1, -2).")
def batch_matches_loop(sub):
    rng = np.random.default_rng(1)
    Q = rng.normal(size=(3, 4, 2))
    K = rng.normal(size=(3, 5, 2))
    V = rng.normal(size=(3, 5, 3))
    output, weights = sub.scaled_dot_product_attention(Q, K, V)
    shape(output, (3, 4, 3), what="the batched output")
    for b in range(3):
        one_out, one_w = sub.scaled_dot_product_attention(Q[b], K[b], V[b])
        close(output[b], one_out, atol=1e-9, what=f"the output of batch item {b}")
        close(weights[b], one_w, atol=1e-9, what=f"the weights of batch item {b}")


@check("properties", "blocked weights are exactly 0 and rows still sum to 1", "Put minus infinity in the blocked scores before the softmax. Then a blocked weight is exactly 0 and the allowed weights sum to 1.")
def masked_weights_zero(sub):
    rng = np.random.default_rng(2)
    Q = rng.normal(size=(2, 5, 4))
    K = rng.normal(size=(2, 6, 4))
    V = rng.normal(size=(2, 6, 3))
    mask = random_mask(rng, (2, 5, 6))
    output, weights = sub.scaled_dot_product_attention(Q, K, V, mask=mask)
    weights = np.asarray(weights)
    shape(weights, (2, 5, 6), what="the weights")
    true(np.all(weights[mask] == 0.0), "A blocked position has a weight that is not 0", "0 at every True position of the mask", weights)
    close(np.sum(weights, axis=-1), np.ones((2, 5)), atol=1e-9, what="the row sums of the masked weights")


@check("properties", "a (Tq, Tk) mask broadcasts over the batch", "The mask can have fewer axes than the scores. numpy broadcasting applies the same mask to every batch item.")
def mask_broadcasts(sub):
    rng = np.random.default_rng(3)
    Q = rng.normal(size=(2, 4, 3))
    V = rng.normal(size=(2, 4, 2))
    mask = sub.causal_mask(4)
    output, weights = sub.scaled_dot_product_attention(Q, Q, V, mask=mask)
    expected_out, expected_w = reference_attention(Q, Q, V, np.triu(np.ones((4, 4), dtype=bool), k=1))
    close(weights, expected_w, atol=1e-9, what="the weights with a causal mask")
    close(output, expected_out, atol=1e-9, what="the output with a causal mask")


@check("properties", "the inputs are not changed", "A function that writes into Q, K, V or the mask breaks the code that calls it.")
def inputs_unchanged(sub):
    rng = np.random.default_rng(4)
    Q = rng.normal(size=(3, 2))
    K = rng.normal(size=(4, 2))
    V = rng.normal(size=(4, 2))
    mask = np.array([[False, True, False, True], [False, False, True, True], [True, True, True, False]])
    saved = [Q.copy(), K.copy(), V.copy(), mask.copy()]
    sub.scaled_dot_product_attention(Q, K, V, mask=mask)
    for name, before, after in zip(["Q", "K", "V", "mask"], saved, [Q, K, V, mask]):
        true(np.array_equal(before, after), f"The function changed {name}", before, after)


@check("edge", "only one key is allowed", "When the mask allows one key, that key gets a weight of 1 and the output row is exactly that value row.")
def one_key_allowed(sub):
    rng = np.random.default_rng(5)
    Q = rng.normal(size=(3, 4))
    K = rng.normal(size=(5, 4))
    V = rng.normal(size=(5, 2))
    mask = np.ones((3, 5), dtype=bool)
    mask[0, 2] = False
    mask[1, 0] = False
    mask[2, 4] = False
    output, weights = sub.scaled_dot_product_attention(Q, K, V, mask=mask)
    expected = np.zeros((3, 5))
    expected[0, 2] = expected[1, 0] = expected[2, 4] = 1.0
    close(weights, expected, atol=1e-12, what="the weights")
    close(output, V[[2, 0, 4]], atol=1e-12, what="the output")


@check("edge", "large scores do not overflow", "exp(1414) is infinite in float64. Subtract the row maximum before np.exp so that the largest exponent is 0.")
def large_scores(sub):
    Q = np.array([[2000.0, 0.0]])
    K = np.array([[1.0, 0.0], [0.999, 0.0], [0.0, 1.0]])
    V = np.array([[1.0, 0.0], [0.0, 1.0], [5.0, 5.0]])
    output, weights = sub.scaled_dot_product_attention(Q, K, V)
    close(weights, [[0.8044296825, 0.1955703175, 0.0]], rtol=1e-8, atol=1e-12, what="the weights")
    close(output, [[0.8044296825, 0.1955703175]], rtol=1e-8, atol=1e-12, what="the output")


@check("edge", "one token", "With one query and one key, the weight is 1 and the output is the value. causal_mask(1) has one False value.")
def one_token(sub):
    V = np.array([[2.5, -1.0, 4.0]])
    output, weights = sub.scaled_dot_product_attention(np.array([[0.3, 0.7]]), np.array([[-1.0, 2.0]]), V, mask=sub.causal_mask(1))
    close(weights, [[1.0]], what="the weights")
    close(output, V, what="the output")
    equal(np.asarray(sub.causal_mask(1)), np.array([[False]]), what="causal_mask(1)")


@fixture("cases")
def cases(ref):
    rng = np.random.default_rng(42)
    for lead, tq, tk, dk, dv, masked in [((), 3, 3, 4, 2, False), ((2,), 4, 4, 8, 3, True), ((2,), 3, 5, 2, 2, True), ((2, 2), 5, 5, 4, 4, True), ((3,), 1, 6, 16, 5, False)]:
        Q = rng.normal(size=lead + (tq, dk))
        K = rng.normal(size=lead + (tk, dk))
        V = rng.normal(size=lead + (tk, dv))
        mask = random_mask(rng, lead + (tq, tk)) if masked else None
        output, weights = ref.scaled_dot_product_attention(Q, K, V, mask=mask)
        yield {"Q": Q, "K": K, "V": V, "mask": mask}, {"output": output, "weights": weights}
    for t in [1, 2, 5, 8]:
        yield {"T": t}, {"causal": ref.causal_mask(t)}


@check("reference", "attention matches the reference on 5 random cases", "Your output and weights agree with the reference solution on batched inputs with and without masks.")
def reference_attention_cases(sub):
    for case, expected in fixtures("cases"):
        if "T" in case:
            continue
        output, weights = sub.scaled_dot_product_attention(case["Q"], case["K"], case["V"], mask=case["mask"])
        label = f"Q of shape {case['Q'].shape}" + (" with a mask" if case["mask"] is not None else "")
        close(weights, expected["weights"], rtol=1e-7, atol=1e-12, what=f"the weights for {label}")
        close(output, expected["output"], rtol=1e-7, atol=1e-12, what=f"the output for {label}")


@check("reference", "causal masks match the reference", "Your causal_mask gives the same bool array as the reference solution for several sizes.")
def reference_causal(sub):
    for case, expected in fixtures("cases"):
        if "T" not in case:
            continue
        equal(np.asarray(sub.causal_mask(case["T"])), expected["causal"], what=f"causal_mask({case['T']})")
