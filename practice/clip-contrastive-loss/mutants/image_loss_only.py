import numpy as np


def normalize(x):
    return x / np.linalg.norm(x, axis=-1, keepdims=True)


def log_softmax(x):
    shifted = x - np.max(x, axis=-1, keepdims=True)
    return shifted - np.log(np.sum(np.exp(shifted), axis=-1, keepdims=True))


def similarity_logits(image_emb, text_emb, temperature):
    i = normalize(image_emb)
    t = normalize(text_emb)
    return i @ t.T / temperature


def symmetric_infonce(logits):
    n = logits.shape[0]
    rows = np.arange(n)
    l_i = -np.mean(log_softmax(logits)[rows, rows])
    l_t = -np.mean(log_softmax(logits.T)[rows, rows])
    return float(l_i)


def symmetric_infonce_grad(logits):
    n = logits.shape[0]
    eye = np.eye(n)
    p_rows = np.exp(log_softmax(logits))
    p_cols = np.exp(log_softmax(logits.T)).T
    return ((p_rows - eye) + (p_cols - eye)) / (2 * n)
