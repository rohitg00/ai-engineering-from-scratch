import numpy as np

from practice_check import check, close, fixture, fixtures, shape, true


@check("examples", "the table for max_len = 3 and d_model = 4", "Column 2i holds sin(pos / base^(2i / d_model)). Column 2i+1 holds cos of the same angle.")
def example_even(sub):
    close(sub.sinusoidal_pe(3, 4), [[0.0, 1.0, 0.0, 1.0], [0.84147098, 0.54030231, 0.00999983, 0.99995], [0.90929743, -0.41614684, 0.01999867, 0.99980001]], rtol=1e-6, atol=1e-9, what="sinusoidal_pe(3, 4)")


@check("examples", "an odd d_model = 5", "With an odd d_model there are d_model // 2 pairs. The exponent still divides by d_model. The last column has no pair and stays 0.")
def example_odd(sub):
    close(sub.sinusoidal_pe(2, 5), [[0.0, 1.0, 0.0, 1.0, 0.0], [0.84147098, 0.54030231, 0.02511622, 0.99968454, 0.0]], rtol=1e-6, atol=1e-9, what="sinusoidal_pe(2, 5)")


@check("examples", "add the table to a batch of embeddings", "add_positional_encoding adds row t of the table to the vector of token t.")
def example_add(sub):
    close(sub.add_positional_encoding(np.ones((2, 2))), [[1.0, 2.0], [1.84147098, 1.54030231]], rtol=1e-6, what="add_positional_encoding of a 2 by 2 array of ones")


@check("properties", "each sin and cos pair has a norm of 1", "Columns 2i and 2i+1 hold the sin and the cos of the same angle, so the sum of their squares is 1 in every row.")
def pair_norm(sub):
    pe = np.asarray(sub.sinusoidal_pe(50, 16))
    shape(pe, (50, 16), what="the table")
    close(pe[:, 0::2] ** 2 + pe[:, 1::2] ** 2, np.ones((50, 8)), atol=1e-12, what="sin squared plus cos squared for each pair")
    true(np.all(np.abs(pe) <= 1.0), "A value is outside [-1, 1]", "values from -1 to 1", pe)


@check("properties", "position 0 and the first pair", "At position 0 every angle is 0, so the sin columns are 0 and the cos columns are 1. Pair 0 has a frequency of 1, so column 0 is sin(pos).")
def position_zero(sub):
    pe = np.asarray(sub.sinusoidal_pe(20, 6))
    close(pe[0], [0.0, 1.0, 0.0, 1.0, 0.0, 1.0], atol=1e-12, what="row 0")
    close(pe[:, 0], np.sin(np.arange(20.0)), atol=1e-12, what="column 0")


@check("properties", "a shift of position is a rotation of each pair", "sin(a + b) and cos(a + b) follow from sin(a), cos(a), sin(b) and cos(b). So row p + k is a fixed rotation of row p, for every p.")
def shift_is_rotation(sub):
    pe = np.asarray(sub.sinusoidal_pe(40, 8))
    k = 7
    s, c = pe[k, 0::2], pe[k, 1::2]
    sin_p, cos_p = pe[:-k, 0::2], pe[:-k, 1::2]
    close(sin_p * c + cos_p * s, pe[k:, 0::2], atol=1e-10, what="the sin columns of row p + 7")
    close(cos_p * c - sin_p * s, pe[k:, 1::2], atol=1e-10, what="the cos columns of row p + 7")


@check("properties", "a longer table starts with the shorter table", "Row p depends only on p, d_model and base. So sinusoidal_pe(30, d)[:10] equals sinusoidal_pe(10, d). The base argument changes the frequencies.")
def prefix_and_base(sub):
    close(np.asarray(sub.sinusoidal_pe(30, 10))[:10], sub.sinusoidal_pe(10, 10), atol=1e-12, what="the first 10 rows of sinusoidal_pe(30, 10)")
    pe = np.asarray(sub.sinusoidal_pe(4, 4, base=100.0))
    close(pe[:, 2], np.sin(np.arange(4.0) / 10.0), atol=1e-12, what="column 2 with base 100")


@check("properties", "batch axes and the input array", "add_positional_encoding adds the same table to every item of the batch. It returns a new array and does not change x.")
def add_batch(sub):
    rng = np.random.default_rng(0)
    x = rng.normal(size=(3, 5, 6))
    saved = x.copy()
    out = np.asarray(sub.add_positional_encoding(x))
    true(np.array_equal(x, saved), "add_positional_encoding changed x", saved, x)
    shape(out, (3, 5, 6), what="the output")
    for b in range(3):
        close(out[b] - x[b], sub.sinusoidal_pe(5, 6), atol=1e-12, what=f"the added table for batch item {b}")


@check("edge", "d_model = 1 and max_len = 1", "With d_model = 1 there is no pair, so the table is all zeros. With max_len = 1 the table is the row of position 0.")
def tiny(sub):
    close(sub.sinusoidal_pe(4, 1), np.zeros((4, 1)), what="sinusoidal_pe(4, 1)")
    close(sub.sinusoidal_pe(1, 4), [[0.0, 1.0, 0.0, 1.0]], what="sinusoidal_pe(1, 4)")


@check("edge", "long tables stay finite and exact", "At position 4095 the fast pair turns many times, but sin and cos stay in [-1, 1]. Row 4095 must use the position 4095, not 4096.")
def long_table(sub):
    pe = np.asarray(sub.sinusoidal_pe(4096, 8))
    true(np.all(np.isfinite(pe)), "The table has NaN or infinite values", "finite values", pe)
    close(pe[4095, 0:2], [np.sin(4095.0), np.cos(4095.0)], atol=1e-12, what="row 4095, columns 0 and 1")


@check("edge", "a large odd d_model", "For d_model = 7 the last pair is i = 2 with exponent 4 / 7. The last column stays 0.")
def odd_large(sub):
    pe = np.asarray(sub.sinusoidal_pe(6, 7))
    close(pe[:, 6], np.zeros(6), what="the last column")
    close(pe[:, 4], np.sin(np.arange(6.0) / 10000.0 ** (4 / 7)), atol=1e-12, what="column 4")


@fixture("tables")
def tables(ref):
    for max_len, d_model, base in [(6, 4, 10000.0), (9, 8, 10000.0), (5, 7, 10000.0), (8, 6, 100.0), (4, 16, 500000.0)]:
        yield {"max_len": max_len, "d_model": d_model, "base": base}, ref.sinusoidal_pe(max_len, d_model, base)


@fixture("adds")
def adds(ref):
    rng = np.random.default_rng(42)
    for shape_ in [(3, 4), (2, 5, 6), (2, 2, 3, 5)]:
        x = rng.normal(size=shape_)
        yield {"x": x}, ref.add_positional_encoding(x)


@check("reference", "sinusoidal_pe matches the reference", "Your table agrees with the reference for several sizes and bases, with even and odd d_model.")
def reference_tables(sub):
    for case, expected in fixtures("tables"):
        close(sub.sinusoidal_pe(case["max_len"], case["d_model"], case["base"]), expected, rtol=1e-9, atol=1e-12, what=f"sinusoidal_pe({case['max_len']}, {case['d_model']}, base={case['base']})")


@check("reference", "add_positional_encoding matches the reference", "Your sum agrees with the reference on random batches.")
def reference_adds(sub):
    for case, expected in fixtures("adds"):
        close(sub.add_positional_encoding(case["x"]), expected, rtol=1e-9, atol=1e-12, what=f"add_positional_encoding for x of shape {case['x'].shape}")
