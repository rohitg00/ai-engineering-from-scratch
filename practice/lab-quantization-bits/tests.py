import numpy as np

from practice_check import check, close, equal, fixture, fixtures, shape, true
from support import BITS, make_weights

KEYS = ["smallest_bits_per_tensor", "smallest_bits_per_row", "error_4bit_per_tensor", "error_4bit_per_row", "per_row_gain_4bit"]
SMALL = np.array([[0.5, -1.0, 0.25], [0.0, 0.0, 0.0]])


@check("examples", "4 bit per tensor quantization of a small matrix", "The scale is the largest magnitude divided by 2^(b-1) - 1. Each value is rounded to the nearest integer and clipped.")
def example_symmetric(sub):
    quantized, scale = sub.quantize_symmetric(SMALL, 4)
    equal(np.asarray(quantized).tolist(), [[4, -7, 2], [0, 0, 0]], what="the quantized values")
    close(scale, 0.14285714285714285, what="the scale")


@check("examples", "relative error of a small vector", "The relative error is the norm of the difference divided by the norm of the original.")
def example_relative(sub):
    close(sub.relative_error(np.array([3.0, 4.0]), np.array([3.0, 3.0])), 0.2, what="the relative error")


@check("examples", "per tensor scales need 8 bits on the outlier matrix", "One outlier sets the scale for the whole matrix, so the small weights get only a few levels.")
def example_answer(sub):
    result = sub.answers()
    true(isinstance(result, dict), "answers() must return a dict", "dict", type(result).__name__)
    close(result.get("smallest_bits_per_tensor"), 8.0, what="smallest_bits_per_tensor")


@check("properties", "answers has every key and only numbers", "The checks read one finite number for each question.")
def answer_keys(sub):
    result = sub.answers()
    equal(sorted(result.keys()), sorted(KEYS), what="the keys of answers()")
    for key in KEYS:
        true(isinstance(result[key], (int, float)) and np.isfinite(result[key]), f"{key} must be a finite number", "a number", result[key])


@check("properties", "each value is within half a step of its original", "Rounding moves a value by at most half of the scale of its row.")
def half_step(sub):
    weights = make_weights(seed=5, rows=8, cols=16)
    for num_bits in [3, 6]:
        quantized, scales = sub.quantize_per_row(weights, num_bits)
        shape(scales, (8,), what="the per row scales")
        error = np.abs(weights - sub.dequantize(quantized, scales))
        true(np.all(error <= np.asarray(scales).reshape(-1, 1) / 2 + 1e-12), f"an error is larger than half a step at {num_bits} bits", "at most scale / 2", float(np.max(error)))


@check("properties", "the codes stay inside the signed range", "A b bit code is an integer from -2^(b-1) to 2^(b-1) - 1.")
def code_range(sub):
    weights = make_weights(seed=6, rows=10, cols=12)
    for num_bits in BITS:
        for quantized, _ in [sub.quantize_symmetric(weights, num_bits), sub.quantize_per_row(weights, num_bits)]:
            codes = np.asarray(quantized)
            true(np.all(codes == np.round(codes)), "the codes must be integers", "integers", codes)
            true(codes.min() >= -(2 ** (num_bits - 1)) and codes.max() <= 2 ** (num_bits - 1) - 1, f"a code is out of range at {num_bits} bits", f"from {-(2 ** (num_bits - 1))} to {2 ** (num_bits - 1) - 1}", codes)


@check("properties", "scaling the matrix scales the scale and keeps the codes", "Absmax quantization does not depend on the unit of the weights.")
def scale_equivariance(sub):
    weights = make_weights(seed=7, rows=6, cols=10)
    q1, s1 = sub.quantize_per_row(weights, 5)
    q2, s2 = sub.quantize_per_row(weights * 3.0, 5)
    equal(np.asarray(q2).tolist(), np.asarray(q1).tolist(), what="the codes of the scaled matrix")
    close(s2, np.asarray(s1) * 3.0, rtol=1e-12, what="the scales of the scaled matrix")


@check("properties", "per row scales are never worse on the outlier matrix", "A row scale is at most the tensor scale, so each row gets the same or a finer step.")
def per_row_better(sub):
    weights = make_weights(seed=0)
    tensor_errors = np.asarray(sub.bit_sweep(weights, BITS, per_row=False))
    row_errors = np.asarray(sub.bit_sweep(weights, BITS, per_row=True))
    shape(tensor_errors, (len(BITS),), what="the per tensor errors")
    true(np.all(row_errors <= tensor_errors), "per row error is above per tensor error at some bit width", "per row <= per tensor", {"per_row": row_errors.tolist(), "per_tensor": tensor_errors.tolist()})


@check("properties", "the inputs are not changed", "A quantizer that writes into the weights corrupts the model.")
def inputs_unchanged(sub):
    weights = make_weights(seed=8, rows=8, cols=6)
    saved = weights.copy()
    sub.quantize_symmetric(weights, 4)
    sub.quantize_per_row(weights, 4)
    sub.bit_sweep(weights, [2, 4], per_row=True)
    close(weights, saved, atol=0, rtol=0, what="the weights after the calls")


@check("edge", "a zero row gets the scale 1 and no NaN", "When a row is all zeros, use the scale 1.0. 0 divided by 0 gives NaN.")
def zero_row(sub):
    quantized, scales = sub.quantize_per_row(SMALL, 4)
    close(scales, [0.14285714285714285, 1.0], what="the per row scales")
    close(sub.dequantize(quantized, scales)[1], [0.0, 0.0, 0.0], what="the reconstructed zero row")
    _, scale = sub.quantize_symmetric(np.zeros((2, 2)), 4)
    close(scale, 1.0, what="the scale of an all zero tensor")


@check("edge", "halfway values round to the even integer", "np.round sends 0.5 to 0 and 2.5 to 2. The 2 bit row [0.5, -1.0, 0.25] has the scale 1, so 0.5 becomes 0.")
def round_half_even(sub):
    quantized, scales = sub.quantize_per_row(SMALL, 2)
    equal(np.asarray(quantized).tolist(), [[0, -1, 0], [0, 0, 0]], what="the 2 bit codes")


@check("edge", "an error equal to the threshold passes", "The rule is error less than or equal to the threshold.")
def threshold_inclusive(sub):
    equal(sub.smallest_bits([2, 4, 8], [0.3, 0.05, 0.01], 0.05), 4, what="smallest_bits")


@check("edge", "no bit width under the threshold gives None", "If every error is above the threshold, no bit width is good enough.")
def none_pass(sub):
    equal(sub.smallest_bits([2, 4], [0.5, 0.2], 0.05), None, what="smallest_bits")


@fixture("matrices")
def matrices(ref):
    rng = np.random.default_rng(21)
    for rows, cols, num_bits in [(3, 5, 2), (6, 4, 4), (5, 9, 7)]:
        weights = rng.normal(size=(rows, cols)) * rng.uniform(0.1, 3.0, size=(rows, 1))
        q_t, s_t = ref.quantize_symmetric(weights, num_bits)
        q_r, s_r = ref.quantize_per_row(weights, num_bits)
        yield {"weights": weights, "bits": num_bits}, {"q_tensor": q_t, "s_tensor": s_t, "q_row": q_r, "s_row": s_r, "sweep": ref.bit_sweep(weights, BITS, per_row=True)}


@fixture("answers")
def answer_fixture(ref):
    yield {}, ref.answers()


@check("reference", "quantizers match the reference on random matrices", "Your codes, scales and errors match the reference on three random matrices.")
def reference_quantizers(sub):
    for case, expected in fixtures("matrices"):
        weights, num_bits = case["weights"], case["bits"]
        q_t, s_t = sub.quantize_symmetric(weights, num_bits)
        q_r, s_r = sub.quantize_per_row(weights, num_bits)
        close(q_t, expected["q_tensor"], atol=0, rtol=0, what=f"the per tensor codes for shape {weights.shape}")
        close(s_t, expected["s_tensor"], rtol=1e-12, what=f"the per tensor scale for shape {weights.shape}")
        close(q_r, expected["q_row"], atol=0, rtol=0, what=f"the per row codes for shape {weights.shape}")
        close(s_r, expected["s_row"], rtol=1e-12, what=f"the per row scales for shape {weights.shape}")
        close(sub.bit_sweep(weights, BITS, per_row=True), expected["sweep"], rtol=1e-9, what=f"the per row sweep for shape {weights.shape}")


@check("reference", "every answer matches the reference run", "Each answer must be within a relative difference of 1e-6 of the reference run.")
def reference_answers(sub):
    result = sub.answers()
    for case, expected in fixtures("answers"):
        for key in KEYS:
            close(result.get(key), expected[key], rtol=1e-6, what=key)
