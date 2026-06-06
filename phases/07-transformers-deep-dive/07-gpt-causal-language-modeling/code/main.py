"""GPT-style causal language modeling — causal mask, loss shift, sampling.

Pure stdlib. Tiny "GPT" with random weights demonstrates the mask,
next-token prediction, and four sampling strategies on a 20-token vocab.
"""

import math
import random


def softmax(logits, temperature=1.0):
    if temperature != 1.0:
        logits = [x / temperature for x in logits]
    m = max(logits)
    exps = [math.exp(x - m) for x in logits]
    s = sum(exps)
    return [e / s for e in exps]


def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]


def attention_scores_with_mask(raw_scores, mask):
    return [[s + m for s, m in zip(row, mrow)] for row, mrow in zip(raw_scores, mask)]


def apply_softmax_row(row):
    finite = [x for x in row if x != float("-inf")]
    if not finite:
        return [0.0] * len(row)
    m = max(finite)
    exps = [math.exp(x - m) if x != float("-inf") else 0.0 for x in row]
    s = sum(exps)
    return [e / s if s > 0 else 0.0 for e in exps]


def cross_entropy_shifted(logits_per_pos, target_ids):
    """Next-token CE: logit_i vs target_{i+1}."""
    total = 0.0
    count = 0
    for i in range(len(target_ids) - 1):
        probs = softmax(logits_per_pos[i])
        p = probs[target_ids[i + 1]]
        total += -math.log(max(p, 1e-12))
        count += 1
    return total / count


def sample_greedy(probs):
    return max(range(len(probs)), key=lambda i: probs[i])


def sample_temperature(logits, t, rng):
    probs = softmax(logits, temperature=t)
    return sample_from_distribution(probs, rng)


def sample_from_distribution(probs, rng):
    r = rng.random()
    cum = 0.0
    for i, p in enumerate(probs):
        cum += p
        if r <= cum:
            return i
    return len(probs) - 1


def sample_top_k(logits, k, rng, temperature=1.0):
    indexed = sorted(enumerate(logits), key=lambda x: -x[1])
    keep = indexed[:k]
    keep_ids = [i for i, _ in keep]
    keep_logits = [v for _, v in keep]
    probs = softmax(keep_logits, temperature=temperature)
    chosen = sample_from_distribution(probs, rng)
    return keep_ids[chosen]


def sample_top_p(logits, p, rng, temperature=1.0):
    probs = softmax(logits, temperature=temperature)
    indexed = sorted(enumerate(probs), key=lambda x: -x[1])
    cum = 0.0
    cutoff = len(indexed)
    for i, (_, pi) in enumerate(indexed):
        cum += pi
        if cum >= p:
            cutoff = i + 1
            break
    kept = indexed[:cutoff]
    total = sum(pi for _, pi in kept)
    renorm = [(idx, pi / total) for idx, pi in kept]
    r = rng.random()
    cum = 0.0
    for idx, pi in renorm:
        cum += pi
        if r <= cum:
            return idx
    return renorm[-1][0]


def sample_min_p(logits, min_p, rng, temperature=1.0):
    probs = softmax(logits, temperature=temperature)
    max_p = max(probs)
    threshold = min_p * max_p
    kept = [(i, pi) for i, pi in enumerate(probs) if pi >= threshold]
    total = sum(pi for _, pi in kept)
    renorm = [(i, pi / total) for i, pi in kept]
    r = rng.random()
    cum = 0.0
    for i, pi in renorm:
        cum += pi
        if r <= cum:
            return i
    return renorm[-1][0]


def demo_causal_mask():
    print("=== causal attention matrix (post-softmax) ===")
    n = 6
    rng = random.Random(42)
    raw = [[rng.gauss(0, 1) for _ in range(n)] for _ in range(n)]
    mask = causal_mask(n)
    masked = attention_scores_with_mask(raw, mask)
    attn = [apply_softmax_row(row) for row in masked]
    for i, row in enumerate(attn):
        print("  " + "  ".join(f"{v:.3f}" for v in row))
    print("  (every row is a valid probability distribution over positions 0..i)")
    print()


def demo_sampling():
    print("=== sampling strategies on a fake next-token distribution ===")
    vocab = ["the", "cat", "dog", "sat", "ran", "jumped", "on", "mat", "floor", "."]
    logits = [3.2, 1.1, 2.8, 0.4, 0.9, 1.5, -0.2, 2.1, 0.7, 0.1]
    probs = softmax(logits)
    print("token       logit   prob")
    for w, l, p in zip(vocab, logits, probs):
        print(f"  {w:<8}  {l:+.2f}   {p:.3f}")
    print()

    rng = random.Random(0)
    print("greedy:         " + vocab[sample_greedy(probs)])
    print("temp=0.7:       " + vocab[sample_temperature(logits, 0.7, rng)])
    print("temp=2.0:       " + vocab[sample_temperature(logits, 2.0, rng)])
    print("top-k=3:        " + vocab[sample_top_k(logits, 3, rng)])
    print("top-p=0.9:      " + vocab[sample_top_p(logits, 0.9, rng)])
    print("min-p=0.1:      " + vocab[sample_min_p(logits, 0.1, rng)])
    print()


def demo_ce_loss():
    print("=== cross-entropy next-token loss ===")
    vocab_size = 10
    seq = [3, 1, 7, 0, 4, 9]
    rng = random.Random(7)
    logits = [[rng.gauss(0, 1) for _ in range(vocab_size)] for _ in seq]
    # Boost correct next-token slightly to simulate a "slightly-trained" model
    for i in range(len(seq) - 1):
        logits[i][seq[i + 1]] += 2.0
    loss_trained = cross_entropy_shifted(logits, seq)
    # Unbiased random
    logits_rand = [[rng.gauss(0, 1) for _ in range(vocab_size)] for _ in seq]
    loss_rand = cross_entropy_shifted(logits_rand, seq)
    print(f"loss with biased logits (trained-ish):  {loss_trained:.3f}")
    print(f"loss with random logits:                {loss_rand:.3f}")
    print(f"random-baseline loss (ln V = ln {vocab_size}):      {math.log(vocab_size):.3f}")
    print()


def main():
    demo_causal_mask()
    demo_sampling()
    demo_ce_loss()
    print("takeaway: the mask is one line. the rest is the same transformer.")


if __name__ == "__main__":
    main()
