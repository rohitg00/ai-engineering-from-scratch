"""Multi-head attention from scratch in pure stdlib.

No numpy, no torch. A tiny Matrix class carries the ops we need.
Demonstrates: split heads, per-head scaled dot-product attention,
combine heads, output projection, and a Grouped-Query variant.
"""

import math
import random
from typing import List


class Matrix:
    """Row-major 2D matrix of floats. Just enough ops for attention."""

    __slots__ = ("rows", "cols", "data")

    def __init__(self, rows: int, cols: int, fill: float = 0.0, data=None):
        self.rows = rows
        self.cols = cols
        if data is not None:
            self.data = data
        else:
            self.data = [fill] * (rows * cols)

    def get(self, i: int, j: int) -> float:
        return self.data[i * self.cols + j]

    def set(self, i: int, j: int, v: float) -> None:
        self.data[i * self.cols + j] = v

    def row(self, i: int) -> List[float]:
        return self.data[i * self.cols:(i + 1) * self.cols]


def randn_matrix(rows, cols, rng, scale=None):
    if scale is None:
        scale = math.sqrt(2.0 / (rows + cols))
    m = Matrix(rows, cols)
    for i in range(rows * cols):
        m.data[i] = rng.gauss(0.0, scale)
    return m


def matmul(A: Matrix, B: Matrix) -> Matrix:
    assert A.cols == B.rows, f"{A.cols} vs {B.rows}"
    out = Matrix(A.rows, B.cols)
    for i in range(A.rows):
        for k in range(A.cols):
            aik = A.get(i, k)
            if aik == 0.0:
                continue
            base_i = i * B.cols
            base_k = k * B.cols
            for j in range(B.cols):
                out.data[base_i + j] += aik * B.data[base_k + j]
    return out


def transpose(A: Matrix) -> Matrix:
    out = Matrix(A.cols, A.rows)
    for i in range(A.rows):
        for j in range(A.cols):
            out.set(j, i, A.get(i, j))
    return out


def softmax_rows(A: Matrix) -> Matrix:
    out = Matrix(A.rows, A.cols)
    for i in range(A.rows):
        row = A.row(i)
        m = max(row)
        exps = [math.exp(x - m) for x in row]
        s = sum(exps)
        for j, e in enumerate(exps):
            out.set(i, j, e / s)
    return out


def scaled_dot_product_attention(Q: Matrix, K: Matrix, V: Matrix):
    dk = Q.cols
    scale = 1.0 / math.sqrt(dk)
    scores = matmul(Q, transpose(K))
    for i in range(scores.rows * scores.cols):
        scores.data[i] *= scale
    weights = softmax_rows(scores)
    out = matmul(weights, V)
    return out, weights


def split_heads(X: Matrix, n_heads: int) -> List[Matrix]:
    assert X.cols % n_heads == 0, "d_model not divisible by n_heads"
    d_head = X.cols // n_heads
    heads = []
    for h in range(n_heads):
        H = Matrix(X.rows, d_head)
        for i in range(X.rows):
            for j in range(d_head):
                H.set(i, j, X.get(i, h * d_head + j))
        heads.append(H)
    return heads


def combine_heads(heads: List[Matrix]) -> Matrix:
    n = heads[0].rows
    d_head = heads[0].cols
    d_model = d_head * len(heads)
    out = Matrix(n, d_model)
    for h, H in enumerate(heads):
        for i in range(n):
            for j in range(d_head):
                out.set(i, h * d_head + j, H.get(i, j))
    return out


def multi_head_attention(X: Matrix, Wq, Wk, Wv, Wo, n_heads: int):
    Q = matmul(X, Wq)
    K = matmul(X, Wk)
    V = matmul(X, Wv)
    Qh = split_heads(Q, n_heads)
    Kh = split_heads(K, n_heads)
    Vh = split_heads(V, n_heads)
    head_outs = []
    per_head_weights = []
    for q, k, v in zip(Qh, Kh, Vh):
        o, w = scaled_dot_product_attention(q, k, v)
        head_outs.append(o)
        per_head_weights.append(w)
    concat = combine_heads(head_outs)
    return matmul(concat, Wo), per_head_weights


def grouped_query_attention(X: Matrix, Wq, Wk, Wv, Wo, n_heads: int, n_kv_heads: int):
    """Same as MHA but K and V have fewer heads, repeated to match Q."""
    Q = matmul(X, Wq)
    K = matmul(X, Wk)
    V = matmul(X, Wv)
    Qh = split_heads(Q, n_heads)
    Kh_small = split_heads(K, n_kv_heads)
    Vh_small = split_heads(V, n_kv_heads)
    repeat = n_heads // n_kv_heads
    Kh = [Kh_small[i // repeat] for i in range(n_heads)]
    Vh = [Vh_small[i // repeat] for i in range(n_heads)]
    head_outs = []
    for q, k, v in zip(Qh, Kh, Vh):
        o, _ = scaled_dot_product_attention(q, k, v)
        head_outs.append(o)
    concat = combine_heads(head_outs)
    return matmul(concat, Wo)


def print_matrix(name, M: Matrix, width=6, prec=3):
    print(f"-- {name} ({M.rows}x{M.cols}) --")
    for i in range(M.rows):
        row = M.row(i)
        print("  " + "  ".join(f"{v:>{width}.{prec}f}" for v in row))


def main():
    rng = random.Random(42)
    tokens = ["the", "cat", "sat", "on", "the", "mat"]
    n = len(tokens)
    d_model = 8
    n_heads = 2

    X = randn_matrix(n, d_model, rng, scale=1.0)
    Wq = randn_matrix(d_model, d_model, rng)
    Wk = randn_matrix(d_model, d_model, rng)
    Wv = randn_matrix(d_model, d_model, rng)
    Wo = randn_matrix(d_model, d_model, rng)

    out, weights = multi_head_attention(X, Wq, Wk, Wv, Wo, n_heads=n_heads)

    print(f"=== multi-head attention: {n_heads} heads, d_model={d_model}, d_head={d_model // n_heads} ===")
    print(f"input  shape: ({X.rows}, {X.cols})")
    print(f"output shape: ({out.rows}, {out.cols})")
    print()
    for h, W in enumerate(weights):
        print(f"-- head {h} attention weights --")
        print(f"{'':>6}", end="")
        for t in tokens:
            print(f"{t:>7}", end="")
        print()
        for i in range(n):
            print(f"{tokens[i]:>6}", end="")
            for j in range(n):
                print(f"{W.get(i, j):>7.3f}", end="")
            print()
        print()

    # GQA demo: 4 Q heads, 2 KV heads
    d_model = 8
    n_heads = 4
    n_kv = 2
    Wq = randn_matrix(d_model, d_model, rng)
    Wk = randn_matrix(d_model, (d_model // n_heads) * n_kv, rng)
    Wv = randn_matrix(d_model, (d_model // n_heads) * n_kv, rng)
    Wo = randn_matrix(d_model, d_model, rng)
    out_gqa = grouped_query_attention(X, Wq, Wk, Wv, Wo, n_heads=n_heads, n_kv_heads=n_kv)
    print(f"=== GQA: {n_heads} Q heads, {n_kv} KV heads ===")
    print(f"output shape: ({out_gqa.rows}, {out_gqa.cols})")
    kv_cache_full = n_heads * n * (d_model // n_heads) * 2
    kv_cache_gqa = n_kv * n * (d_model // n_heads) * 2
    print(f"KV cache elements (MHA):  {kv_cache_full}")
    print(f"KV cache elements (GQA):  {kv_cache_gqa}  ({kv_cache_full // kv_cache_gqa}x smaller)")


if __name__ == "__main__":
    main()
