import numpy as np

from practice_check import check, close, fixture, fixtures, shape, true

Q2 = np.array([[1.0, 0.0], [0.0, 1.0]])
K3 = np.array([[1.0, 0.0], [0.0, 1.0], [1.0, 1.0]])
V3 = np.array([[1.0, 2.0], [3.0, 4.0], [5.0, 6.0]])


def standard_attention(Q, K, V, causal=False):
    scores = Q @ K.T / np.sqrt(Q.shape[1])
    if causal:
        scores = np.where(np.arange(K.shape[0])[None, :] > np.arange(Q.shape[0])[:, None], -np.inf, scores)
    top = np.max(scores, axis=1, keepdims=True)
    weights = np.exp(scores - top)
    total = np.sum(weights, axis=1, keepdims=True)
    return weights @ V / total, top[:, 0] + np.log(total[:, 0])


@check("examples", "the same output for block sizes 1, 2 and 3", "Tiled attention is exact. The output and the log-sum-exp do not depend on the block size.")
def example_blocks(sub):
    for block_size in [1, 2, 3]:
        output, lse = sub.flash_attention(Q2, K3, V3, block_size)
        close(output, [[3.0, 4.0], [3.40667256, 4.40667256]], rtol=1e-7, what=f"the output with block_size = {block_size}")
        close(lse, [1.62062114, 1.62062114], rtol=1e-7, what=f"the log-sum-exp with block_size = {block_size}")


@check("examples", "causal attention of three tokens", "With causal = True, query i ignores every key j with j > i.")
def example_causal(sub):
    output, lse = sub.flash_attention(K3, K3, V3, 2, causal=True)
    close(output, [[1.0, 2.0], [2.3395231, 3.3395231], [3.51046953, 4.51046953]], rtol=1e-7, what="the output")
    close(lse, [0.70710678, 1.10794031, 2.1004053], rtol=1e-7, what="the log-sum-exp")


@check("examples", "one online softmax step", "The new max is the larger of the old max and the block max. The old sum and the old accumulator are scaled by exp(old max minus new max).")
def example_step(sub):
    m = np.array([1.0, -np.inf])
    l = np.array([2.0, 0.0])
    acc = np.array([[1.0, 1.0], [0.0, 0.0]])
    scores = np.array([[3.0, 0.0], [-np.inf, 0.5]])
    v_block = np.array([[1.0, 0.0], [0.0, 1.0]])
    m_new, l_new, acc_new = sub.online_softmax_step(m, l, acc, scores, v_block)
    close(m_new, [3.0, 0.5], rtol=1e-12, what="the new running max")
    close(l_new, [1.32045763, 1.0], rtol=1e-7, what="the new running sum")
    close(acc_new, [[1.13533528, 0.18512235], [0.0, 1.0]], rtol=1e-7, what="the new accumulator")


@check("properties", "equal to standard attention for every block size", "The running max and the running sum make the result exact. Every block size from 1 to Tk + 2 must give the output of standard attention.")
def all_block_sizes(sub):
    rng = np.random.default_rng(0)
    Q = rng.normal(size=(5, 4))
    K = rng.normal(size=(7, 4))
    V = rng.normal(size=(7, 3))
    expected, expected_lse = standard_attention(Q, K, V)
    for block_size in range(1, 10):
        output, lse = sub.flash_attention(Q, K, V, block_size)
        shape(output, (5, 3), what=f"the output with block_size = {block_size}")
        close(output, expected, rtol=1e-9, atol=1e-12, what=f"the output with block_size = {block_size}")
        close(lse, expected_lse, rtol=1e-9, atol=1e-12, what=f"the log-sum-exp with block_size = {block_size}")


@check("properties", "causal tiles equal causal standard attention", "Mask the scores inside each tile with the global key index. A key at global index j is blocked for query i when j > i.")
def causal_all_blocks(sub):
    rng = np.random.default_rng(1)
    X = rng.normal(size=(6, 3))
    V = rng.normal(size=(6, 2))
    expected, expected_lse = standard_attention(X, X, V, causal=True)
    for block_size in [1, 2, 4, 6]:
        output, lse = sub.flash_attention(X, X, V, block_size, causal=True)
        close(output, expected, rtol=1e-9, atol=1e-12, what=f"the causal output with block_size = {block_size}")
        close(lse, expected_lse, rtol=1e-9, atol=1e-12, what=f"the causal log-sum-exp with block_size = {block_size}")


@check("properties", "two steps equal one step on the joined block", "The online update is associative. Two steps on two halves of the keys give the same state as one step on all keys.")
def step_associative(sub):
    rng = np.random.default_rng(2)
    scores = rng.normal(size=(3, 6)) * 4
    V = rng.normal(size=(6, 2))
    start = (np.full(3, -np.inf), np.zeros(3), np.zeros((3, 2)))
    one = sub.online_softmax_step(*start, scores, V)
    half = sub.online_softmax_step(*start, scores[:, :2], V[:2])
    two = sub.online_softmax_step(*half, scores[:, 2:], V[2:])
    for name, a, b in zip(["running max", "running sum", "accumulator"], two, one):
        close(a, b, rtol=1e-10, atol=1e-12, what=f"the {name} after two steps")


@check("properties", "the inputs are not changed", "A function that writes into Q, K, V or into the running state of its caller breaks the loop that calls it.")
def inputs_unchanged(sub):
    rng = np.random.default_rng(3)
    Q = rng.normal(size=(3, 2))
    K = rng.normal(size=(5, 2))
    V = rng.normal(size=(5, 2))
    saved = [Q.copy(), K.copy(), V.copy()]
    sub.flash_attention(Q, K, V, 2, causal=True)
    for name, before, after in zip(["Q", "K", "V"], saved, [Q, K, V]):
        true(np.array_equal(before, after), f"The function changed {name}", before, after)
    m = np.array([0.5, 1.0])
    l = np.array([1.0, 2.0])
    acc = np.array([[1.0, 0.0], [0.0, 1.0]])
    state = [m.copy(), l.copy(), acc.copy()]
    sub.online_softmax_step(m, l, acc, np.array([[2.0], [0.0]]), np.array([[1.0, 1.0]]))
    for name, before, after in zip(["m", "l", "acc"], state, [m, l, acc]):
        true(np.array_equal(before, after), f"online_softmax_step changed its input {name}", before, after)


@check("edge", "a fully masked block before any key", "When the running max and every score are minus infinity, the state must stay at m = minus infinity, l = 0 and acc = 0. Use 0 in place of a max of minus infinity, so that you never compute minus infinity minus minus infinity.")
def fully_masked_first_block(sub):
    m_new, l_new, acc_new = sub.online_softmax_step(np.full(2, -np.inf), np.zeros(2), np.zeros((2, 3)), np.full((2, 2), -np.inf), np.ones((2, 3)))
    true(np.all(np.isneginf(np.asarray(m_new))), "The running max is not minus infinity", "[-inf, -inf]", m_new)
    close(l_new, [0.0, 0.0], what="the running sum")
    close(acc_new, np.zeros((2, 3)), what="the accumulator")


@check("edge", "large scores in separate blocks do not overflow", "The scores are near 1414 in one block and near -1414 in the next. Keep the running max over all blocks so far. A max of the current block only gives exp(2828), which is infinite.")
def large_scores(sub):
    Q = np.array([[2000.0, 0.0]])
    K = np.array([[1.0, 0.0], [0.999, 0.0], [-1.0, 0.0], [0.0, 1.0]])
    V = np.array([[1.0, 0.0], [0.0, 1.0], [5.0, 5.0], [7.0, 7.0]])
    expected, expected_lse = standard_attention(Q, K, V)
    for block_size in [1, 2, 3]:
        output, lse = sub.flash_attention(Q, K, V, block_size)
        close(output, expected, rtol=1e-8, atol=1e-12, what=f"the output with block_size = {block_size}")
        close(lse, expected_lse, rtol=1e-12, what=f"the log-sum-exp with block_size = {block_size}")


@check("edge", "one key and a block larger than the keys", "With one key, the weight is 1 and the output is that value row. A block size larger than Tk gives one block.")
def one_key(sub):
    V = np.array([[2.5, -1.0, 4.0]])
    output, lse = sub.flash_attention(np.array([[0.3, 0.7], [1.0, -2.0]]), np.array([[-1.0, 2.0]]), V, 8)
    close(output, np.vstack([V, V]), what="the output")
    close(lse, np.array([1.1, -5.0]) / np.sqrt(2.0), rtol=1e-12, what="the log-sum-exp")


@fixture("cases")
def cases(ref):
    rng = np.random.default_rng(42)
    for tq, tk, d, dv, block_size, causal in [(3, 5, 4, 2, 2, False), (4, 7, 8, 3, 3, False), (6, 6, 4, 4, 4, True), (5, 9, 2, 2, 1, True), (2, 4, 16, 5, 7, False)]:
        Q = rng.normal(size=(tq, d))
        K = rng.normal(size=(tk, d))
        V = rng.normal(size=(tk, dv))
        output, lse = ref.flash_attention(Q, K, V, block_size, causal=causal)
        yield {"Q": Q, "K": K, "V": V, "block_size": block_size, "causal": causal}, {"output": output, "lse": lse}


@check("reference", "tiled attention matches the reference on 5 random cases", "Your output and log-sum-exp agree with the reference solution for several shapes, block sizes and causal settings.")
def reference_cases(sub):
    for case, expected in fixtures("cases"):
        label = f"Q of shape {case['Q'].shape}, K of shape {case['K'].shape}, block_size = {case['block_size']}, causal = {case['causal']}"
        output, lse = sub.flash_attention(case["Q"], case["K"], case["V"], case["block_size"], causal=case["causal"])
        close(output, expected["output"], rtol=1e-9, atol=1e-12, what=f"the output for {label}")
        close(lse, expected["lse"], rtol=1e-9, atol=1e-12, what=f"the log-sum-exp for {label}")
