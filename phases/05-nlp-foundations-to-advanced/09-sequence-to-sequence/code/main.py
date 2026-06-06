import math
import random


def simulate_copy_accuracy(seq_len, context_dim=8, epochs=200, n_train=300, seed=0):
    rng = random.Random(seed)
    vocab = list("abcdefghij")
    vocab_size = len(vocab)

    embed = [[rng.gauss(0, 0.3) for _ in range(context_dim)] for _ in range(vocab_size)]
    context = [0.0] * context_dim

    def encode(sequence):
        c = [0.0] * context_dim
        decay = 0.85
        for token in sequence:
            idx = vocab.index(token)
            for d in range(context_dim):
                c[d] = c[d] * decay + embed[idx][d]
        return c

    def decode_score(context, target):
        total = 0.0
        recovery = 1.0
        for token in target:
            idx = vocab.index(token)
            score = sum(context[d] * embed[idx][d] for d in range(context_dim))
            normed = math.tanh(score) * recovery
            total += max(0.0, normed)
            recovery *= 0.9
        return total / max(1, len(target))

    hits = 0
    trials = 100
    for _ in range(trials):
        seq = [rng.choice(vocab) for _ in range(seq_len)]
        c = encode(seq)
        target_score = decode_score(c, seq)

        noise_score = decode_score(c, [rng.choice(vocab) for _ in range(seq_len)])
        if target_score > noise_score:
            hits += 1
    return hits / trials


def main():
    print("toy simulation of encoder-decoder bottleneck")
    print("context vector has fixed size = 8 floats")
    print("encoder decays state at rate 0.85 per step (simulates forgetting)")
    print()
    print(f"{'seq_len':>8}  {'accuracy':>10}")
    for length in [5, 10, 20, 40, 80]:
        acc = simulate_copy_accuracy(length)
        print(f"{length:>8}  {acc:>9.0%}")
    print()
    print("real LSTMs decay more gracefully but hit the same ceiling.")
    print("attention (lesson 10) removes the fixed-size constraint.")


if __name__ == "__main__":
    main()
