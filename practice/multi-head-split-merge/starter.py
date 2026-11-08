import numpy as np


def split_heads(x, n_heads):
    raise NotImplementedError


def merge_heads(x):
    raise NotImplementedError


def multi_head_attention(x, w_q, w_k, w_v, w_o, n_heads):
    raise NotImplementedError
