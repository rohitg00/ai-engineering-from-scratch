import numpy as np


class KVCache:
    def __init__(self, max_len, d_k, d_v):
        self.max_len = max_len
        self.K = np.zeros((max_len, d_k))
        self.V = np.zeros((max_len, d_v))
        self.length = 0

    def append(self, k, v):
        k = np.atleast_2d(np.asarray(k, dtype=float))
        v = np.atleast_2d(np.asarray(v, dtype=float))
        n = k.shape[0]
        if v.shape[0] != n:
            raise ValueError("k and v must have the same number of steps")
        if self.length + n > self.max_len:
            raise ValueError("the cache is full")
        self.K[self.length:self.length + n] = k
        self.V[self.length:self.length + n] = v
        self.length += n

    def keys(self):
        return self.K[:self.length]

    def values(self):
        return self.V[:self.length]

    def __len__(self):
        return self.length


def softmax(x):
    shifted = x - np.max(x, axis=-1, keepdims=True)
    exp_x = np.exp(shifted)
    return exp_x / np.sum(exp_x, axis=-1, keepdims=True)


def decode_step(q, cache):
    q = np.asarray(q, dtype=float)
    scores = cache.keys() @ q / np.sqrt(q.shape[-1])
    weights = softmax(scores)
    return weights @ cache.values(), weights
