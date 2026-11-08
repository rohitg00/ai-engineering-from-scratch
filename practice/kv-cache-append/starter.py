import numpy as np


class KVCache:
    def __init__(self, max_len, d_k, d_v):
        raise NotImplementedError

    def append(self, k, v):
        raise NotImplementedError

    def keys(self):
        raise NotImplementedError

    def values(self):
        raise NotImplementedError

    def __len__(self):
        raise NotImplementedError


def decode_step(q, cache):
    raise NotImplementedError
