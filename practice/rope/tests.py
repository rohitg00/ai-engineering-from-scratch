import numpy as np

from practice_check import check, close, fixture, fixtures, shape, true

BASIS = np.array([[1.0, 0.0, 1.0, 0.0], [1.0, 0.0, 1.0, 0.0], [1.0, 0.0, 1.0, 0.0]])
Q1 = np.array([[1.0, 2.0, 3.0, 4.0]])
K1 = np.array([[0.5, -1.0, 2.0, 1.0]])


def rotated_dot(sub, q, k, m, n, base=10000.0):
    qm = np.asarray(sub.apply_rope(q[None, :], np.array([m]), base))[0]
    kn = np.asarray(sub.apply_rope(k[None, :], np.array([n]), base))[0]
    return float(qm @ kn)


@check("examples", "frequencies for d = 8", "theta_i is base to the power of minus 2i / d, for i from 0 to d // 2 minus 1.")
def example_frequencies(sub):
    close(sub.rope_frequencies(8), [1.0, 0.1, 0.01, 0.001], rtol=1e-9, what="rope_frequencies(8)")


@check("examples", "rotate the vector [1, 0, 1, 0] at positions 0, 1 and 2", "Pair (2i, 2i+1) turns by the angle pos times theta_i. The first element of a pair gets a cos(angle) minus b sin(angle). The second element gets a sin(angle) plus b cos(angle).")
def example_basis(sub):
    out = sub.apply_rope(BASIS, np.arange(3))
    close(out, [[1.0, 0.0, 1.0, 0.0], [0.54030231, 0.84147098, 0.99995, 0.00999983], [-0.41614684, 0.90929743, 0.99980001, 0.01999867]], rtol=1e-6, atol=1e-9, what="the rotated vectors")


@check("examples", "the score depends on the gap only", "q at position 2 and k at position 5 have a gap of 3. q at position 10 and k at position 13 have the same gap, so the dot products are equal.")
def example_gap(sub):
    first = rotated_dot(sub, Q1[0], K1[0], 2, 5)
    second = rotated_dot(sub, Q1[0], K1[0], 10, 13)
    close(first, 11.912706599522757, rtol=1e-8, what="the dot product for positions 2 and 5")
    close(second, 11.912706599522759, rtol=1e-8, what="the dot product for positions 10 and 13")


@check("properties", "the rotation keeps the norm of each pair", "A rotation does not change a length. Each pair (2i, 2i+1) keeps its norm, so the whole vector keeps its norm.")
def norm_preserved(sub):
    rng = np.random.default_rng(0)
    x = rng.normal(size=(2, 7, 12))
    out = np.asarray(sub.apply_rope(x, np.arange(7) * 3))
    shape(out, x.shape, what="the output")
    pairs_in = np.sqrt(x[..., 0::2] ** 2 + x[..., 1::2] ** 2)
    pairs_out = np.sqrt(out[..., 0::2] ** 2 + out[..., 1::2] ** 2)
    close(pairs_out, pairs_in, atol=1e-10, what="the norm of each pair (2i, 2i+1)")


@check("properties", "q dot k depends only on the position difference", "The rotation of q by m theta and of k by n theta leaves a factor of cos((m minus n) theta) in each pair. A shift of both positions by the same offset gives the same score.")
def relative_property(sub):
    rng = np.random.default_rng(1)
    q = rng.normal(size=16)
    k = rng.normal(size=16)
    for m, n in [(0, 4), (3, 1), (7, 7)]:
        base_score = rotated_dot(sub, q, k, m, n)
        for offset in [5, 100, 1000]:
            close(rotated_dot(sub, q, k, m + offset, n + offset), base_score, rtol=1e-8, atol=1e-9, what=f"the score at positions {m + offset} and {n + offset}")


@check("properties", "position 0 changes nothing and two rotations add", "At position 0 every angle is 0. A rotation by position m and then by position n is a rotation by position m plus n.")
def identity_and_composition(sub):
    rng = np.random.default_rng(2)
    x = rng.normal(size=(4, 6))
    close(sub.apply_rope(x, np.zeros(4)), x, atol=1e-12, what="the output at position 0")
    m = np.array([1, 2, 5, 9])
    n = np.array([3, 0, 4, 11])
    twice = sub.apply_rope(sub.apply_rope(x, m), n)
    close(twice, sub.apply_rope(x, m + n), atol=1e-10, what="two rotations compared with one rotation by m plus n")


@check("properties", "leading axes are batch axes", "The positions go with the second to last axis. Each batch item and each head gets the same rotation.")
def batch_axes(sub):
    rng = np.random.default_rng(3)
    x = rng.normal(size=(2, 3, 5, 8))
    pos = np.array([0, 2, 4, 6, 8])
    out = np.asarray(sub.apply_rope(x, pos))
    shape(out, x.shape, what="the batched output")
    for b in range(2):
        for h in range(3):
            close(out[b, h], sub.apply_rope(x[b, h], pos), atol=1e-12, what=f"batch item {b}, head {h}")


@check("properties", "the base changes the speed of rotation", "theta_i is base to the power of minus 2i / d. Use the base argument, not a fixed 10000.")
def base_argument(sub):
    close(sub.rope_frequencies(4, base=100.0), [1.0, 0.1], rtol=1e-9, what="rope_frequencies(4, base=100)")
    x = np.array([[0.0, 0.0, 1.0, 0.0]])
    close(sub.apply_rope(x, np.array([3]), base=100.0), [[0.0, 0.0, np.cos(0.3), np.sin(0.3)]], atol=1e-12, what="apply_rope with base=100")


@check("properties", "the input array is not changed", "apply_rope must return a new array. A write into x changes the queries or keys of the caller.")
def input_unchanged(sub):
    rng = np.random.default_rng(4)
    x = rng.normal(size=(3, 4))
    saved = x.copy()
    sub.apply_rope(x, np.arange(3))
    true(np.array_equal(x, saved), "apply_rope changed x", saved, x)


@check("edge", "odd d leaves the last element unchanged", "With an odd d there are d // 2 pairs. The last element has no partner, so it stays the same.")
def odd_dimension(sub):
    out = sub.apply_rope(np.array([[1.0, 2.0, 3.0]]), np.array([1]))
    close(out, [[-1.14263966, 1.9220756, 3.0]], rtol=1e-7, what="apply_rope of a 3 element vector at position 1")
    close(sub.rope_frequencies(5), [1.0, 10000.0 ** -0.4], rtol=1e-9, what="rope_frequencies(5)")


@check("edge", "very large positions stay finite", "At position 100000 the angles are large, but cos and sin stay in [-1, 1]. The output is finite and keeps its norm.")
def large_positions(sub):
    rng = np.random.default_rng(5)
    x = rng.normal(size=(2, 8))
    out = np.asarray(sub.apply_rope(x, np.array([100000, 250000])))
    true(np.all(np.isfinite(out)), "The output has NaN or infinite values", "finite values", out)
    close(np.linalg.norm(out, axis=-1), np.linalg.norm(x, axis=-1), rtol=1e-10, what="the norm of each vector")


@check("edge", "one pair and one token", "With d = 2 there is one pair with theta_0 = 1. The vector [1, 0] at position p becomes [cos p, sin p].")
def one_pair(sub):
    out = sub.apply_rope(np.array([[1.0, 0.0]]), np.array([2]))
    close(out, [[np.cos(2.0), np.sin(2.0)]], atol=1e-12, what="apply_rope([[1, 0]], [2])")


@fixture("cases")
def cases(ref):
    rng = np.random.default_rng(42)
    for lead, t, d, base in [((), 3, 4, 10000.0), ((2,), 5, 8, 10000.0), ((2, 2), 4, 6, 500.0), ((), 6, 7, 10000.0), ((3,), 2, 16, 1000000.0)]:
        x = rng.normal(size=lead + (t, d))
        positions = np.sort(rng.integers(0, 4096, size=t))
        yield {"x": x, "positions": positions, "base": base}, ref.apply_rope(x, positions, base)
    for d, base in [(2, 10000.0), (6, 10000.0), (9, 10000.0), (8, 50.0)]:
        yield {"d": d, "base": base}, ref.rope_frequencies(d, base)


@check("reference", "apply_rope matches the reference on 5 random cases", "Your rotation agrees with the reference for batched inputs, several bases and an odd d.")
def reference_rope(sub):
    for case, expected in fixtures("cases"):
        if "x" not in case:
            continue
        out = sub.apply_rope(case["x"], case["positions"], case["base"])
        close(out, expected, rtol=1e-8, atol=1e-10, what=f"apply_rope for x of shape {case['x'].shape} and base {case['base']}")


@check("reference", "rope_frequencies matches the reference", "Your frequencies agree with the reference for several sizes and bases.")
def reference_frequencies(sub):
    for case, expected in fixtures("cases"):
        if "d" not in case:
            continue
        close(sub.rope_frequencies(case["d"], case["base"]), expected, rtol=1e-9, what=f"rope_frequencies({case['d']}, base={case['base']})")
