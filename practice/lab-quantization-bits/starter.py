import numpy as np

from support import BITS, THRESHOLD, make_weights


def qrange(num_bits):
    return -(2 ** (num_bits - 1)), 2 ** (num_bits - 1) - 1


def quantize_symmetric(tensor, num_bits):
    raise NotImplementedError


def quantize_per_row(tensor, num_bits):
    raise NotImplementedError


def dequantize(quantized, scale):
    raise NotImplementedError


def relative_error(original, reconstructed):
    raise NotImplementedError


def bit_sweep(tensor, bits, per_row):
    raise NotImplementedError


def smallest_bits(bits, errors, threshold):
    raise NotImplementedError


def answers():
    raise NotImplementedError
