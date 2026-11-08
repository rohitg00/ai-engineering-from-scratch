import numpy as np


def online_softmax_step(m, l, acc, scores, v_block):
    block_max = np.max(scores, axis=-1)
    m_new = np.maximum(m, block_max)
    safe_max = np.where(np.isneginf(m_new), 0.0, m_new)
    exp_old = np.exp(m - safe_max)
    exp_new = np.exp(scores - safe_max[:, None])
    l_new = exp_old * l + np.sum(exp_new, axis=-1)
    acc_new = exp_old[:, None] * acc + exp_new @ v_block
    return m_new, l_new, acc_new


def flash_attention(Q, K, V, block_size, causal=False):
    Tq, d = Q.shape
    Tk = K.shape[0]
    scale = 1.0 / np.sqrt(d)
    m = np.full(Tq, -np.inf)
    l = np.zeros(Tq)
    acc = np.zeros((Tq, V.shape[1]))
    rows = np.arange(Tq)[:, None]
    for start in range(0, Tk, block_size):
        stop = min(start + block_size, Tk)
        scores = Q @ K[start:stop].T * scale
        if causal:
            cols = np.arange(start, stop)[None, :]
            scores = np.where(cols > rows, -np.inf, scores)
        m, l, acc = online_softmax_step(m, l, acc, scores, V[start:stop])
    return acc / l[:, None], m + np.log(l)
