import math
import random


VOCAB = 16
NUM_STYLES = 2


def make_tokens(style, length, rng):
    """Synthetic 'audio token' sequences by style."""
    if style == 0:  # alternating, speech-like
        return [(i + rng.randint(0, 1)) % VOCAB for i in range(length)]
    return [(i * 3 + rng.randint(0, 1)) % VOCAB for i in range(length)]


def init_counts():
    return [[[1.0 for _ in range(VOCAB)] for _ in range(VOCAB)] for _ in range(NUM_STYLES)]


def update_counts(counts, sequence, style):
    for i in range(len(sequence) - 1):
        counts[style][sequence[i]][sequence[i + 1]] += 1.0


def probs(counts, style, prev_tok):
    row = counts[style][prev_tok]
    total = sum(row)
    return [x / total for x in row]


def entropy(p):
    return -sum(pi * math.log(max(pi, 1e-10)) for pi in p)


def sample_from(p, rng):
    r = rng.random()
    acc = 0.0
    for i, pi in enumerate(p):
        acc += pi
        if r <= acc:
            return i
    return len(p) - 1


def generate(counts, style, start, length, rng, temperature=1.0):
    out = [start]
    for _ in range(length - 1):
        p = probs(counts, style, out[-1])
        if temperature != 1.0:
            p = [pi ** (1 / temperature) for pi in p]
            total = sum(p)
            p = [x / total for x in p]
        out.append(sample_from(p, rng))
    return out


def main():
    rng = random.Random(42)
    counts = init_counts()

    print("=== training codec-token bigram per style on 500 sequences each ===")
    for _ in range(500):
        for style in range(NUM_STYLES):
            seq = make_tokens(style, length=20, rng=rng)
            update_counts(counts, seq, style)

    print()
    print("=== generate 20 tokens per style, start=0 ===")
    for style in range(NUM_STYLES):
        label = "speech-like (alternating)" if style == 0 else "music-like (ramp)"
        print(f"\nstyle {style}: {label}")
        for temp in [0.7, 1.0]:
            out = generate(counts, style, start=0, length=20, rng=rng, temperature=temp)
            print(f"  temp {temp:.1f}: {out}")

    print()
    print("=== entropy at each position for style 0 conditional on token 5 ===")
    p = probs(counts, 0, 5)
    top3 = sorted(range(VOCAB), key=lambda i: -p[i])[:3]
    print(f"  p(next | style=0, prev=5): H = {entropy(p):.3f}")
    print(f"  top-3: {[(i, round(p[i], 3)) for i in top3]}")

    print()
    print("=== VALL-E-style prompt continuation ===")
    prompt = make_tokens(0, length=5, rng=rng)[:5]
    print(f"  3-second voice prompt (tokens): {prompt}")
    continuation = list(prompt)
    for _ in range(15):
        p = probs(counts, 0, continuation[-1])
        continuation.append(sample_from(p, rng))
    print(f"  continuation: {continuation}")

    print()
    print("takeaway: tokens + transformer = entire TTS / music generation substrate.")
    print("          RVQ of Encodec / DAC makes real audio fit in the same loop.")


if __name__ == "__main__":
    main()
