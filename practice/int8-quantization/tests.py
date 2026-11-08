import numpy as np

from practice_check import check, close, equal, fixture, fixtures, shape, true

T = np.array([[0.5, -1.0, 0.25], [2.0, 0.1, -0.04]])


def int_values(q, what):
    array = np.asarray(q)
    true(array.dtype == np.int8, f"{what} is not an int8 array", "int8", str(array.dtype))
    return array


@check("examples", "per-tensor quantization of a 2 by 3 matrix", "The scale is max(|x|) / 127 over the whole tensor. Each value is round(x / scale), clipped to [-127, 127].")
def example_tensor(sub):
    q, scale = sub.quantize_symmetric(T)
    equal(int_values(q, "the quantized tensor"), np.array([[32, -64, 16], [127, 6, -3]], dtype=np.int8), what="the quantized tensor")
    close(scale, 0.015748031496062992, rtol=1e-12, what="the scale")
    close(sub.dequantize_symmetric(q, scale), [[0.50393701, -1.00787402, 0.2519685], [2.0, 0.09448819, -0.04724409]], rtol=1e-6, what="the dequantized tensor")


@check("examples", "per-row quantization of the same matrix", "Each row gets its own scale, max(|row|) / 127. The row with the smaller values keeps more precision.")
def example_rows(sub):
    q, scales = sub.quantize_per_channel(T)
    equal(int_values(q, "the quantized tensor"), np.array([[64, -127, 32], [127, 6, -3]], dtype=np.int8), what="the quantized tensor")
    close(scales, [0.00787402, 0.01574803], rtol=1e-6, what="the scales")
    close(sub.dequantize_per_channel(q, scales), [[0.50393701, -1.0, 0.2519685], [2.0, 0.09448819, -0.04724409]], rtol=1e-6, what="the dequantized tensor")


@check("examples", "a row of zeros gets scale 1", "When max(|row|) is 0, use the scale 1.0. The quantized row is all 0 and no division by 0 occurs.")
def example_zero_row(sub):
    q, scales = sub.quantize_per_channel(np.array([[0.0, 0.0], [1.0, -3.0]]))
    equal(int_values(q, "the quantized tensor"), np.array([[0, 0], [42, -127]], dtype=np.int8), what="the quantized tensor")
    close(scales, [1.0, 0.02362205], rtol=1e-6, what="the scales")


@check("properties", "the error is at most half a step", "Rounding to the nearest integer moves each value by at most 0.5. After dequantization the error of each entry is at most scale / 2.")
def error_bound(sub):
    rng = np.random.default_rng(1)
    x = rng.normal(size=(6, 9)) * 3
    q, scale = sub.quantize_symmetric(x)
    error = np.abs(sub.dequantize_symmetric(q, scale) - x)
    true(bool(np.all(error <= scale / 2 + 1e-12)), "an entry has an error larger than scale / 2 for the per-tensor scale", f"at most {scale / 2:.6g}", float(np.max(error)))
    q, scales = sub.quantize_per_channel(x)
    error = np.abs(sub.dequantize_per_channel(q, scales) - x)
    limit = np.asarray(scales).reshape(-1, 1) / 2 + 1e-12
    true(bool(np.all(error <= limit)), "an entry has an error larger than scale / 2 of its row", "at most half the row scale", float(np.max(error - limit + 1e-12)))


@check("properties", "the largest value maps to 127", "The value with the largest magnitude maps to 127 or to -127. The scale uses the full int8 range.")
def uses_full_range(sub):
    rng = np.random.default_rng(2)
    x = rng.normal(size=(5, 7))
    q, _ = sub.quantize_symmetric(x)
    q = int_values(q, "the quantized tensor")
    equal(int(np.max(np.abs(q.astype(int)))), 127, what="the largest magnitude of the per-tensor result")
    q, scales = sub.quantize_per_channel(x)
    q = int_values(q, "the quantized tensor")
    shape(scales, (5,), what="the scales")
    equal(np.max(np.abs(q.astype(int)), axis=1), np.full(5, 127), what="the largest magnitude in each row")


@check("properties", "scaling the input by a positive number scales only the scale", "x / scale does not change when x and scale grow by the same factor. The quantized values stay the same.")
def scale_equivariance(sub):
    rng = np.random.default_rng(3)
    x = rng.normal(size=(4, 6))
    q1, s1 = sub.quantize_per_channel(x)
    q2, s2 = sub.quantize_per_channel(x * 8.0)
    equal(np.asarray(q2), np.asarray(q1), what="the quantized values of 8 x")
    close(s2, np.asarray(s1) * 8.0, rtol=1e-12, what="the scales of 8 x")


@check("properties", "the inputs are not changed", "A function that writes into its input array breaks the code that calls it.")
def inputs_unchanged(sub):
    x = T.copy()
    q, scale = sub.quantize_symmetric(x)
    q_saved = np.array(q, copy=True)
    sub.dequantize_symmetric(q, scale)
    q2, scales = sub.quantize_per_channel(x)
    scales_saved = np.array(scales, copy=True)
    sub.dequantize_per_channel(q2, scales)
    close(x, T, atol=0, rtol=0, what="the tensor after the calls")
    equal(np.asarray(q), q_saved, what="the quantized tensor after dequantization")
    close(scales, scales_saved, atol=0, rtol=0, what="the scales after dequantization")


@check("edge", "ties round half to even", "np.round sends 2.5 to 2 and -0.5 to 0. Use np.round, not floor of x + 0.5.")
def ties(sub):
    q, scale = sub.quantize_symmetric(np.array([127.0, 2.5, -0.5, 1.5, -3.5]))
    close(scale, 1.0, rtol=1e-12, what="the scale")
    equal(np.asarray(q), np.array([127, 2, 0, 2, -4], dtype=np.int8), what="the quantized values")


@check("edge", "a negative value with the largest magnitude", "The scale uses the absolute value. When the most negative value has the largest magnitude, it maps to -127.")
def negative_max(sub):
    x = np.array([[-4.0, 1.0, 2.0], [0.5, -0.25, 0.125]])
    q, scale = sub.quantize_symmetric(x)
    close(scale, 4.0 / 127, rtol=1e-12, what="the scale")
    equal(int(np.asarray(q)[0, 0]), -127, what="the quantized value of -4.0")
    q, scales = sub.quantize_per_channel(x)
    close(scales, [4.0 / 127, 0.5 / 127], rtol=1e-12, what="the scales")


@check("edge", "an all-zero tensor", "When every value is 0, every scale is 1.0 and every quantized value is 0. A division by a scale of 0 gives NaN.")
def zero_tensor(sub):
    q, scale = sub.quantize_symmetric(np.zeros((2, 3)))
    close(scale, 1.0, rtol=0, atol=0, what="the scale")
    equal(np.asarray(q), np.zeros((2, 3), dtype=np.int8), what="the quantized tensor")
    close(sub.dequantize_symmetric(q, scale), np.zeros((2, 3)), atol=0, what="the dequantized tensor")
    q, scales = sub.quantize_per_channel(np.array([[0.0, 0.0, 0.0], [0.0, 0.5, 0.0], [0.0, 0.0, 0.0]]))
    close(scales, [1.0, 0.5 / 127, 1.0], rtol=1e-12, what="the per-row scales")
    equal(np.asarray(q), np.array([[0, 0, 0], [0, 127, 0], [0, 0, 0]], dtype=np.int8), what="the per-row quantized tensor")


@check("edge", "one row and a non-square matrix", "Per-row quantization gives one scale for each row, so the scales have shape (rows,) also for 1 row.")
def shapes(sub):
    x = np.array([[0.3, -0.6, 0.9, 0.0, 1.2]])
    q, scales = sub.quantize_per_channel(x)
    shape(q, (1, 5), what="the quantized tensor")
    shape(scales, (1,), what="the scales")
    x = np.arange(12.0).reshape(3, 4) - 5.0
    q, scales = sub.quantize_per_channel(x)
    shape(scales, (3,), what="the scales for a 3 by 4 matrix")
    close(sub.dequantize_per_channel(q, scales), x, atol=0.03, what="the dequantized 3 by 4 matrix")


@fixture("tensors")
def tensors(ref):
    rng = np.random.default_rng(42)
    for rows, cols, spread in [(1, 4, 1.0), (3, 5, 0.1), (6, 8, 10.0), (8, 3, 1.0)]:
        x = rng.normal(size=(rows, cols)) * spread * rng.random(size=(rows, 1)) * 4
        q, scale = ref.quantize_symmetric(x)
        qc, scales = ref.quantize_per_channel(x)
        yield {"x": x}, {"q": q, "scale": scale, "deq": ref.dequantize_symmetric(q, scale), "qc": qc, "scales": scales, "deqc": ref.dequantize_per_channel(qc, scales)}


@check("reference", "per-tensor results match the reference", "Your quantized values, scale and dequantized tensor agree with the reference solution on random matrices.")
def reference_tensor(sub):
    for case, expected in fixtures("tensors"):
        size = case["x"].shape
        q, scale = sub.quantize_symmetric(case["x"])
        equal(np.asarray(q), expected["q"], what=f"the per-tensor result for shape {size}")
        close(scale, expected["scale"], rtol=1e-12, what=f"the scale for shape {size}")
        close(sub.dequantize_symmetric(expected["q"], expected["scale"]), expected["deq"], rtol=1e-12, what=f"the dequantized tensor for shape {size}")


@check("reference", "per-row results match the reference", "Your per-row quantized values, scales and dequantized tensor agree with the reference solution.")
def reference_rows(sub):
    for case, expected in fixtures("tensors"):
        size = case["x"].shape
        q, scales = sub.quantize_per_channel(case["x"])
        equal(np.asarray(q), expected["qc"], what=f"the per-row result for shape {size}")
        close(scales, expected["scales"], rtol=1e-12, what=f"the scales for shape {size}")
        close(sub.dequantize_per_channel(expected["qc"], expected["scales"]), expected["deqc"], rtol=1e-12, what=f"the dequantized tensor for shape {size}")
