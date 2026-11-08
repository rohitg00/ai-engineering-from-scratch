import numpy as np

from practice_check import report
from support import TEXT, VOCAB, decode, encode

STEPS = 300
LEARNING_RATE = 50.0


def log_softmax(logits):
    shifted = logits - np.max(logits, axis=1, keepdims=True)
    return shifted - np.log(np.sum(np.exp(shifted), axis=1, keepdims=True))


def bigram_counts(ids, vocab_size):
    counts = np.zeros((vocab_size, vocab_size))
    np.add.at(counts, (ids[1:], ids[1:]), 1.0)
    return counts


def train(ids, vocab_size, rng):
    W = rng.normal(scale=0.01, size=(vocab_size, vocab_size))
    counts = bigram_counts(ids, vocab_size)
    row_totals = counts.sum(axis=1, keepdims=True)
    n = counts.sum()
    for step in range(STEPS):
        log_probs = log_softmax(W)
        loss = -np.sum(counts * log_probs) / n
        report(step, float(loss))
        grad_W = (row_totals * np.exp(log_probs) - counts) / n
        W -= LEARNING_RATE * grad_W
    return W


def next_log_probs(model, prev_ids):
    return log_softmax(model[np.asarray(prev_ids, dtype=int)])
