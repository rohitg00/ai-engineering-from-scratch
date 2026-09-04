"""Q-Former cross-attention toy — stdlib Python.

Builds a minimal BLIP-2-style modality bridge:
  - 256 "patch tokens" from a fake ViT
  - 32 learnable query vectors
  - one cross-attention block (Q from queries, K/V from patches)
  - linear projection to an LLM hidden dim
  - prints attention weights so the reader can see which patch each query
    pulled from

Pure Python vectors and lists. No numpy, no torch. The arithmetic is slow
but exact; good for inspecting behaviour.
"""

from __future__ import annotations

import math
import random

NUM_PATCH = 64
PATCH_DIM = 16
NUM_QUERY = 8
QUERY_DIM = 16
LLM_DIM = 24

rng = random.Random(42)


def vec(n: int) -> list[float]:
    return [rng.gauss(0, 1) for _ in range(n)]


def mat(rows: int, cols: int) -> list[list[float]]:
    return [vec(cols) for _ in range(rows)]


def matmul_vec(M: list[list[float]], v: list[float]) -> list[float]:
    return [sum(r * x for r, x in zip(row, v)) for row in M]


def dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def softmax(xs: list[float]) -> list[float]:
    m = max(xs)
    exps = [math.exp(x - m) for x in xs]
    z = sum(exps)
    return [e / z for e in exps]


def make_patches() -> list[list[float]]:
    """Fake 64 'patch tokens' of dim 16 from a frozen ViT."""
    return [vec(PATCH_DIM) for _ in range(NUM_PATCH)]


def make_queries() -> list[list[float]]:
    """32 learnable query vectors, dim 16."""
    return [vec(QUERY_DIM) for _ in range(NUM_QUERY)]


def cross_attention(queries: list[list[float]],
                    patches: list[list[float]],
                    W_q: list[list[float]],
                    W_k: list[list[float]],
                    W_v: list[list[float]]) -> tuple[list[list[float]], list[list[float]]]:
    """Scaled dot-product cross-attention.
    queries: (Nq, Dq) -> Q = queries @ W_q^T shape (Nq, D)
    patches: (Np, Dp) -> K, V
    returns (attended, attn_weights)
    """
    Q = [matmul_vec(W_q, q) for q in queries]
    K = [matmul_vec(W_k, p) for p in patches]
    V = [matmul_vec(W_v, p) for p in patches]
    d = len(Q[0])
    scale = 1.0 / math.sqrt(d)

    attn_weights = []
    out = []
    for q in Q:
        logits = [dot(q, k) * scale for k in K]
        weights = softmax(logits)
        attn_weights.append(weights)
        mixed = [0.0] * d
        for i, w in enumerate(weights):
            for j in range(d):
                mixed[j] += w * V[i][j]
        out.append(mixed)
    return out, attn_weights


def linear_project(xs: list[list[float]],
                   W: list[list[float]]) -> list[list[float]]:
    return [matmul_vec(W, x) for x in xs]


def top_patches_per_query(attn: list[list[float]], k: int = 3) -> list[list[int]]:
    out = []
    for weights in attn:
        idxs = sorted(range(len(weights)), key=lambda i: -weights[i])[:k]
        out.append(idxs)
    return out


def summarize_attention(attn: list[list[float]]) -> None:
    print("\nattention-weight summary (softmax over 64 patches)")
    print("-" * 60)
    top = top_patches_per_query(attn, k=5)
    entropies = []
    for weights in attn:
        e = -sum(w * math.log(w + 1e-12) for w in weights)
        entropies.append(e)
    avg_e = sum(entropies) / len(entropies)
    max_e = math.log(NUM_PATCH)
    for i, (idxs, e) in enumerate(zip(top, entropies)):
        top_str = ", ".join(f"p{x:02d}({attn[i][x]:.3f})" for x in idxs[:5])
        print(f"  query {i}: entropy {e:.3f}/{max_e:.3f}, top-5 {top_str}")
    print(f"  mean entropy: {avg_e:.3f}  (uniform baseline: {max_e:.3f})")


def demo_untrained() -> None:
    print("\nDEMO: 8 queries attending over 64 patches")
    print("-" * 60)
    patches = make_patches()
    queries = make_queries()
    W_q = mat(QUERY_DIM, QUERY_DIM)
    W_k = mat(QUERY_DIM, PATCH_DIM)
    W_v = mat(QUERY_DIM, PATCH_DIM)
    attended, attn = cross_attention(queries, patches, W_q, W_k, W_v)
    summarize_attention(attn)
    W_out = mat(LLM_DIM, QUERY_DIM)
    projected = linear_project(attended, W_out)
    print(f"\noutput: {len(projected)} tokens of dim {LLM_DIM} -> ready for LLM")
    print(f"first token (trimmed): {[round(x, 2) for x in projected[0][:8]]}")


def demo_biased() -> None:
    """Show that if queries learn to align with specific patches, attention
    concentrates (lower entropy). Here we simulate by re-using a few patch
    vectors as the queries themselves."""
    print("\nDEMO: queries initialized from specific patches -> concentration")
    print("-" * 60)
    patches = make_patches()
    favored = [5, 17, 33, 48, 60, 2, 11, 27]
    queries = [list(patches[i]) for i in favored]
    W_q = [[1.0 if i == j else 0.0 for j in range(QUERY_DIM)]
           for i in range(QUERY_DIM)]
    W_k = [[1.0 if i == j else 0.0 for j in range(PATCH_DIM)]
           for i in range(QUERY_DIM)]
    W_v = [[1.0 if i == j else 0.0 for j in range(PATCH_DIM)]
           for i in range(QUERY_DIM)]
    _, attn = cross_attention(queries, patches, W_q, W_k, W_v)
    print("  query_i should attend highest to patch[favored[i]]:")
    for i, weights in enumerate(attn):
        top = max(range(len(weights)), key=lambda k: weights[k])
        hit = "YES" if top == favored[i] else "miss"
        print(f"    query {i}: top patch {top} (favored {favored[i]}) "
              f"weight {weights[top]:.3f} ({hit})")


def main() -> None:
    print("=" * 60)
    print("BLIP-2 Q-FORMER CROSS-ATTENTION TOY (Phase 12, Lesson 03)")
    print("=" * 60)
    demo_untrained()
    demo_biased()
    print("\n" + "=" * 60)
    print("TAKEAWAYS")
    print("-" * 60)
    print("  · queries are the fixed learnable parameters of the bridge")
    print("  · cross-attention maps (32 queries, 256 patches) -> 32 summaries")
    print("  · project to LLM hidden dim -> prepend to text input")
    print("  · BLIP-2 stage 1 trains bridge with ITC+ITM+ITG; no LLM")
    print("  · BLIP-2 stage 2 trains bridge + projector with LM loss")


if __name__ == "__main__":
    main()
