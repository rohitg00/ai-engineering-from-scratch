"""Why Transformers - demonstrate the serial-depth gap between RNN-style
recurrence and attention-style parallel reduction.

Runs in pure stdlib. No numpy, no torch.
"""

import math
import time


def rnn_style(xs, decay=0.9):
    """Sequential recurrence: h_t depends on h_{t-1}. Cannot parallelize."""
    h = 0.0
    for x in xs:
        h = decay * h + x
    return h


def attention_style(xs):
    """Order-independent reduction: every element is independent."""
    return sum(xs) / len(xs)


def serial_scan(xs):
    """Prefix sum computed serially. Depth O(N)."""
    out = []
    acc = 0.0
    for x in xs:
        acc += x
        out.append(acc)
    return out


def parallel_scan(xs):
    """Hillis-Steele parallel prefix sum. Depth O(log N).

    In pure Python each step is still serial, but the data-dependency
    graph has depth log2(N). On real hardware with N-wide SIMD this
    gets you a log-depth scan; on a CPU it's the same wall-clock but
    the graph shape is what matters for GPU kernels.
    """
    out = list(xs)
    step = 1
    n = len(out)
    while step < n:
        new = list(out)
        for i in range(step, n):
            new[i] = out[i] + out[i - step]
        out = new
        step *= 2
    return out


def benchmark(n, reps=3):
    xs = [0.001 * (i % 17) for i in range(n)]

    best_rnn = math.inf
    for _ in range(reps):
        t0 = time.perf_counter()
        _ = rnn_style(xs)
        best_rnn = min(best_rnn, time.perf_counter() - t0)

    best_attn = math.inf
    for _ in range(reps):
        t0 = time.perf_counter()
        _ = attention_style(xs)
        best_attn = min(best_attn, time.perf_counter() - t0)

    return best_rnn, best_attn


def depth(n):
    """Serial-depth count for RNN vs attention-style reductions."""
    rnn_depth = n
    attn_depth = max(1, math.ceil(math.log2(n)))
    return rnn_depth, attn_depth


def main():
    print("=== serial-depth comparison ===")
    print(f"{'N':>8}  {'rnn depth':>12}  {'attn depth':>12}  {'speedup (ops)':>16}")
    for n in [64, 512, 4096, 32768, 262144]:
        rd, ad = depth(n)
        print(f"{n:>8}  {rd:>12}  {ad:>12}  {rd / ad:>15.0f}x")

    print()
    print("=== wall-clock on this machine (pure Python) ===")
    print(f"{'N':>8}  {'rnn (ms)':>10}  {'attn (ms)':>10}  {'ratio':>8}")
    for n in [1_000, 10_000, 100_000, 1_000_000]:
        rnn_t, attn_t = benchmark(n)
        ratio = rnn_t / attn_t if attn_t > 0 else float("inf")
        print(f"{n:>8}  {rnn_t * 1000:>10.2f}  {attn_t * 1000:>10.2f}  {ratio:>7.1f}x")

    print()
    print("=== prefix-sum equivalence check ===")
    xs = [float(i) for i in range(16)]
    ser = serial_scan(xs)
    par = parallel_scan(xs)
    mismatches = sum(1 for a, b in zip(ser, par) if abs(a - b) > 1e-9)
    print(f"length: {len(xs)}, mismatches between serial and parallel scan: {mismatches}")
    print(f"last value (serial):   {ser[-1]}")
    print(f"last value (parallel): {par[-1]}")

    print()
    print("takeaway: attention wins on every dimension but memory.")
    print("memory cost is O(N^2) for full attention; Lesson 12 covers the fixes.")


if __name__ == "__main__":
    main()
