import math
import random


def sample_mixture(n, rng):
    """Two-mode Gaussian mixture. Mode A at -2 (sigma 0.6), mode B at +2 (sigma 0.9)."""
    samples = []
    for _ in range(n):
        if rng.random() < 0.4:
            samples.append(rng.gauss(-2.0, 0.6))
        else:
            samples.append(rng.gauss(2.0, 0.9))
    return samples


def histogram_density(samples, x, bin_width=0.25):
    """Explicit density via histogram. Returns p(x) as (count in bin) / (n * bin_width)."""
    n = len(samples)
    lo, hi = x - bin_width / 2, x + bin_width / 2
    count = sum(1 for s in samples if lo <= s < hi)
    return count / (n * bin_width)


def kde_density(samples, x, bandwidth=0.3):
    """Approximate density via Gaussian kernel density estimate."""
    n = len(samples)
    total = 0.0
    for s in samples:
        u = (x - s) / bandwidth
        total += math.exp(-0.5 * u * u) / math.sqrt(2 * math.pi)
    return total / (n * bandwidth)


def implicit_generator(samples, k, rng):
    """Implicit generator: sample a training point and add tiny noise. No p(x)."""
    out = []
    for _ in range(k):
        base = rng.choice(samples)
        out.append(base + rng.gauss(0.0, 0.1))
    return out


def integrate_density(density_fn, samples, lo, hi, steps=200):
    """Trapezoid-rule integration of a density over [lo, hi]."""
    xs = [lo + (hi - lo) * i / steps for i in range(steps + 1)]
    total = 0.0
    for i in range(steps):
        a, b = xs[i], xs[i + 1]
        total += 0.5 * (density_fn(samples, a) + density_fn(samples, b)) * (b - a)
    return total


def ascii_histogram(samples, lo=-5.0, hi=5.0, bins=40, height=12):
    """Tiny text histogram so you can see the two modes without a plotting lib."""
    width = (hi - lo) / bins
    counts = [0] * bins
    for s in samples:
        if lo <= s < hi:
            counts[int((s - lo) / width)] += 1
    peak = max(counts) or 1
    rows = []
    for row in range(height, 0, -1):
        threshold = peak * row / height
        line = "".join("#" if c >= threshold else " " for c in counts)
        rows.append(line)
    rows.append("-" * bins)
    rows.append(f"{lo:<.1f}" + " " * (bins - 8) + f"{hi:>.1f}")
    return "\n".join(rows)


def main():
    rng = random.Random(42)
    samples = sample_mixture(2000, rng)

    print("=== 2000 samples from a two-mode Gaussian mixture ===")
    print(ascii_histogram(samples))
    print()

    query = 0.0
    print(f"evaluate p(x={query}) three ways:")
    print(f"  histogram density: {histogram_density(samples, query):.4f}")
    print(f"  kernel density:    {kde_density(samples, query):.4f}")
    print(f"  implicit generator: N/A (only samples, no density)")
    print()

    p_hist = integrate_density(histogram_density, samples, -0.5, 0.5)
    p_kde = integrate_density(kde_density, samples, -0.5, 0.5)
    print(f"integrate p(x in [-0.5, 0.5]):")
    print(f"  histogram: {p_hist:.3f}")
    print(f"  kde:       {p_kde:.3f}")
    print()

    new_samples = implicit_generator(samples, 10, rng)
    print("10 new samples from the implicit (GAN-ish) generator:")
    print("  " + ", ".join(f"{s:+.2f}" for s in new_samples))
    print()

    print("takeaway: explicit density (buckets 1-2 in the doc) lets you answer")
    print("'how likely is this point?'. implicit (bucket 3) does not.")


if __name__ == "__main__":
    main()
