import numpy as np


def repeat_kv(kv, n_heads):
    raise NotImplementedError


def grouped_query_attention(x, w_q, w_k, w_v, w_o, n_heads, n_kv_heads):
    raise NotImplementedError


def mean_pool_kv_heads(w, n_heads, n_kv_heads):
    raise NotImplementedError
