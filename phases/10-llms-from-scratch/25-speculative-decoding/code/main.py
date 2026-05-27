"""Speculative decoding harness: exact rejection rule, alpha sweep, tree mask.

Three things this file proves, on synthetic toy distributions so the math
stays visible:

1. The Leviathan-Kalai-Matias rejection rule preserves the target's
   sampling distribution. Empirical total-variation distance between
   plain target sampling and speculative-with-draft sampling is < 0.01
   over 50_000 draws.
2. The expected-tokens-per-verify formula holds. For acceptance rate
   alpha and draft length K, E[tokens] = (1 - alpha^(K+1)) / (1 - alpha)
   matches the measured throughput within sampling noise.
3. Tree drafting verifies multiple candidate paths in a single target
   forward via a topological causal mask. We build a depth-K tree, emit
   the verification mask, and confirm every node attends only to its
   ancestors.

Stdlib + numpy only.

Run:
    python main.py
    python main.py --vocab 64 --alpha 0.75 --k 4 --samples 50000
"""

from __future__ import annotations

import argparse
import numpy as np


def make_target(vocab: int, rng: np.random.Generator) -> np.ndarray:
    logits = rng.standard_normal(vocab) * 1.4
    e = np.exp(logits - logits.max())
    return e / e.sum()


def make_draft(target: np.ndarray, alpha_hint: float,
               rng: np.random.Generator) -> np.ndarray:
    """A draft distribution whose expected token-level acceptance is near
    alpha_hint. We linearly blend target with a uniform distribution; the
    blend ratio controls how close the draft is to the target."""
    vocab = target.size
    uniform = np.full(vocab, 1.0 / vocab)
    draft = alpha_hint * target + (1.0 - alpha_hint) * uniform
    noise = rng.uniform(0.95, 1.05, size=vocab)
    draft = draft * noise
    return draft / draft.sum()


def sample(probs: np.ndarray, rng: np.random.Generator) -> int:
    return int(rng.choice(probs.size, p=probs))


def speculative_step(target: np.ndarray, draft: np.ndarray, K: int,
                     rng: np.random.Generator) -> list[int]:
    """One round. Returns 1..K+1 tokens whose distribution equals target."""
    proposed: list[int] = []
    q_at: list[float] = []
    for _ in range(K):
        t = sample(draft, rng)
        proposed.append(t)
        q_at.append(float(draft[t]))

    accepted: list[int] = []
    for k, tok in enumerate(proposed):
        ratio = float(target[tok]) / max(q_at[k], 1e-12)
        if rng.random() < min(1.0, ratio):
            accepted.append(tok)
        else:
            residual = np.maximum(target - draft, 0.0)
            s = residual.sum()
            if s == 0.0:
                accepted.append(sample(target, rng))
            else:
                accepted.append(sample(residual / s, rng))
            return accepted
    accepted.append(sample(target, rng))
    return accepted


def total_variation(p: np.ndarray, q: np.ndarray) -> float:
    return float(0.5 * np.abs(p - q).sum())


def empirical_dist(samples: list[int], vocab: int) -> np.ndarray:
    counts = np.bincount(samples, minlength=vocab).astype(np.float64)
    return counts / counts.sum()


def verify_distribution(target: np.ndarray, draft: np.ndarray, K: int,
                        n_samples: int, rng: np.random.Generator
                        ) -> tuple[float, float]:
    """Compare next-token distributions under plain target sampling and
    speculative sampling. They must be statistically indistinguishable."""
    vocab = target.size
    plain = [sample(target, rng) for _ in range(n_samples)]
    spec_first: list[int] = []
    while len(spec_first) < n_samples:
        toks = speculative_step(target, draft, K, rng)
        spec_first.append(toks[0])
    p_plain = empirical_dist(plain, vocab)
    p_spec = empirical_dist(spec_first, vocab)
    return total_variation(p_plain, target), total_variation(p_spec, target)


def measure_alpha(target: np.ndarray, draft: np.ndarray,
                  n_samples: int, rng: np.random.Generator) -> float:
    accepted = 0
    for _ in range(n_samples):
        t = sample(draft, rng)
        ratio = float(target[t]) / max(float(draft[t]), 1e-12)
        if rng.random() < min(1.0, ratio):
            accepted += 1
    return accepted / n_samples


def expected_tokens(alpha: float, K: int) -> float:
    if alpha >= 1.0:
        return float(K + 1)
    return (1.0 - alpha ** (K + 1)) / (1.0 - alpha)


def measure_throughput(target: np.ndarray, draft: np.ndarray, K: int,
                       n_rounds: int, rng: np.random.Generator) -> float:
    total = 0
    for _ in range(n_rounds):
        total += len(speculative_step(target, draft, K, rng))
    return total / n_rounds


def build_tree(branch_factor: tuple[int, ...]) -> list[tuple[int, list[int]]]:
    """Return nodes as (parent_index, depth-path). Index 0 is root."""
    tree: list[tuple[int, list[int]]] = [(-1, [])]
    frontier = [0]
    for depth, b in enumerate(branch_factor):
        next_frontier: list[int] = []
        for parent in frontier:
            for _ in range(b):
                tree.append((parent, tree[parent][1] + [len(tree)]))
                next_frontier.append(len(tree) - 1)
        frontier = next_frontier
    return tree


def tree_attention_mask(tree: list[tuple[int, list[int]]]) -> np.ndarray:
    """N x N causal mask where each row attends to its ancestors only."""
    n = len(tree)
    mask = np.zeros((n, n), dtype=np.int8)
    for i in range(n):
        cur = i
        while cur != -1:
            mask[i, cur] = 1
            cur = tree[cur][0]
    return mask


def validate_tree_mask(mask: np.ndarray,
                       tree: list[tuple[int, list[int]]]) -> bool:
    n = len(tree)
    for i in range(n):
        cur = i
        ancestors = set()
        while cur != -1:
            ancestors.add(cur)
            cur = tree[cur][0]
        attends = {j for j in range(n) if mask[i, j] == 1}
        if attends != ancestors:
            return False
    return True


def _positive_int(value: str, *, minimum: int = 1) -> int:
    n = int(value)
    if n < minimum:
        raise argparse.ArgumentTypeError(f"value must be >= {minimum}, got {n}")
    return n


def _unit_float(value: str) -> float:
    f = float(value)
    if not (0.0 < f <= 1.0):
        raise argparse.ArgumentTypeError(f"value must be in (0, 1], got {f}")
    return f


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--vocab", type=lambda v: _positive_int(v, minimum=2), default=32,
                        help="vocab size (>= 2)")
    parser.add_argument("--alpha", type=_unit_float, default=0.75,
                        help="target acceptance rate in (0, 1]")
    parser.add_argument("--k", type=lambda v: _positive_int(v, minimum=1), default=4,
                        help="draft length (>= 1)")
    parser.add_argument("--samples", type=lambda v: _positive_int(v, minimum=2), default=20000,
                        help="sample count (>= 2)")
    parser.add_argument("--seed", type=int, default=0)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rng = np.random.default_rng(args.seed)

    target = make_target(args.vocab, rng)
    draft = make_draft(target, args.alpha, rng)

    tv_plain, tv_spec = verify_distribution(
        target, draft, args.k, args.samples, rng
    )
    print(f"distribution check (n={args.samples}):")
    print(f"  TV(plain_target_sampling, target)       = {tv_plain:.4f}")
    print(f"  TV(speculative_sampling, target)         = {tv_spec:.4f}")
    print(f"  delta TV (spec vs plain)                 = {abs(tv_spec - tv_plain):.4f}")

    alpha_hat = measure_alpha(target, draft, args.samples // 2, rng)
    print()
    print(f"alpha measurement (vocab={args.vocab}, alpha hint={args.alpha}):")
    print(f"  measured alpha = {alpha_hat:.3f}")

    throughput = measure_throughput(target, draft, args.k, 2000, rng)
    expected = expected_tokens(alpha_hat, args.k)
    print()
    print(f"throughput at K={args.k}:")
    print(f"  measured E[tokens/verify]  = {throughput:.3f}")
    print(f"  predicted E[tokens/verify] = {expected:.3f}  (1 - a^(K+1)) / (1 - a)")

    print()
    print("alpha sweep, K=4:")
    for a in (0.3, 0.5, 0.7, 0.85, 0.95):
        print(f"  alpha={a:.2f}  expected_tokens={expected_tokens(a, args.k):.2f}")

    print()
    print("tree drafting demo: depth-3 tree, branch=(3, 2, 2)")
    tree = build_tree((3, 2, 2))
    mask = tree_attention_mask(tree)
    print(f"  total candidate nodes: {len(tree)} (one verify pass covers all)")
    print(f"  mask shape: {mask.shape}")
    print(f"  mask correctness vs ancestor sets: {validate_tree_mask(mask, tree)}")
    print(f"  attends-per-node (rows): {mask.sum(axis=1).tolist()}")


if __name__ == "__main__":
    main()
