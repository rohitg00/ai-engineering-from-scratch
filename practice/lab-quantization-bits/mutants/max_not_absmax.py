import numpy as np

from support import BITS, THRESHOLD, make_weights


def qrange(num_bits):
    return -(2 ** (num_bits - 1)), 2 ** (num_bits - 1) - 1


def quantize_symmetric(tensor, num_bits):
    qmin, qmax = qrange(num_bits)
    abs_max = float(np.max(tensor))
    scale = abs_max / qmax if abs_max > 0 else 1.0
    quantized = np.clip(np.round(tensor / scale), qmin, qmax).astype(np.int32)
    return quantized, scale


def quantize_per_row(tensor, num_bits):
    qmin, qmax = qrange(num_bits)
    abs_max = np.max(np.abs(tensor), axis=1, keepdims=True)
    scales = np.where(abs_max > 0, abs_max / qmax, 1.0)
    quantized = np.clip(np.round(tensor / scales), qmin, qmax).astype(np.int32)
    return quantized, scales.reshape(-1)


def dequantize(quantized, scale):
    scale = np.asarray(scale, dtype=np.float64)
    if scale.ndim == 1:
        scale = scale.reshape(-1, 1)
    return quantized.astype(np.float64) * scale


def relative_error(original, reconstructed):
    return float(np.linalg.norm(original - reconstructed) / np.linalg.norm(original))


def bit_sweep(tensor, bits, per_row):
    errors = []
    for num_bits in bits:
        if per_row:
            quantized, scale = quantize_per_row(tensor, num_bits)
        else:
            quantized, scale = quantize_symmetric(tensor, num_bits)
        errors.append(relative_error(tensor, dequantize(quantized, scale)))
    return np.array(errors)


def smallest_bits(bits, errors, threshold):
    passing = [b for b, e in zip(bits, errors) if e <= threshold]
    return min(passing) if passing else None


def answers():
    weights = make_weights(seed=0)
    tensor_errors = bit_sweep(weights, BITS, per_row=False)
    row_errors = bit_sweep(weights, BITS, per_row=True)
    four = BITS.index(4)
    return {
        "smallest_bits_per_tensor": float(smallest_bits(BITS, tensor_errors, THRESHOLD)),
        "smallest_bits_per_row": float(smallest_bits(BITS, row_errors, THRESHOLD)),
        "error_4bit_per_tensor": float(tensor_errors[four]),
        "error_4bit_per_row": float(row_errors[four]),
        "per_row_gain_4bit": float(tensor_errors[four] / row_errors[four]),
    }
