import numpy as np

QMAX = 127


def quantize_symmetric(tensor):
    abs_max = float(np.max(np.abs(tensor)))
    scale = abs_max / QMAX if abs_max > 0 else 1.0
    quantized = np.clip(np.round(tensor / scale), -QMAX, QMAX).astype(np.int8)
    return quantized, scale


def dequantize_symmetric(quantized, scale):
    return quantized.astype(np.float64) * scale


def quantize_per_channel(tensor):
    abs_max = np.max(np.abs(tensor), axis=1, keepdims=True)
    scales = abs_max / QMAX
    quantized = np.clip(np.round(tensor / scales), -QMAX, QMAX).astype(np.int8)
    return quantized, scales.reshape(-1)


def dequantize_per_channel(quantized, scales):
    return quantized.astype(np.float64) * scales.reshape(-1, 1)
