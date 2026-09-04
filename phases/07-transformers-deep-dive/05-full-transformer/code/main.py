"""The full transformer: encoder + decoder blocks in pure stdlib.

Demonstrates:
- LayerNorm vs RMSNorm
- ReLU-FFN vs SwiGLU FFN
- encoder block (bidirectional) vs decoder block (causal + cross-attn)
- pre-norm wiring (2026 default)
"""

import math
import random
from typing import List


class Matrix:
    __slots__ = ("rows", "cols", "data")

    def __init__(self, rows, cols, fill=0.0, data=None):
        self.rows = rows
        self.cols = cols
        self.data = data if data is not None else [fill] * (rows * cols)

    def get(self, i, j):
        return self.data[i * self.cols + j]

    def set(self, i, j, v):
        self.data[i * self.cols + j] = v

    def row(self, i):
        return self.data[i * self.cols:(i + 1) * self.cols]

    def copy(self):
        return Matrix(self.rows, self.cols, data=list(self.data))


def randn(rows, cols, rng, scale=None):
    if scale is None:
        scale = math.sqrt(2.0 / (rows + cols))
    m = Matrix(rows, cols)
    for i in range(rows * cols):
        m.data[i] = rng.gauss(0.0, scale)
    return m


def matmul(A, B):
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


def transpose(A):
    out = Matrix(A.cols, A.rows)
    for i in range(A.rows):
        for j in range(A.cols):
            out.set(j, i, A.get(i, j))
    return out


def add(A, B):
    assert (A.rows, A.cols) == (B.rows, B.cols)
    return Matrix(A.rows, A.cols, data=[a + b for a, b in zip(A.data, B.data)])


def softmax_rows(A, mask=None):
    out = Matrix(A.rows, A.cols)
    for i in range(A.rows):
        row = A.row(i)
        if mask is not None:
            row = [row[j] if not mask[i][j] else float("-inf") for j in range(A.cols)]
        m = max(v for v in row if v != float("-inf"))
        exps = [math.exp(v - m) if v != float("-inf") else 0.0 for v in row]
        s = sum(exps)
        for j, e in enumerate(exps):
            out.set(i, j, e / s if s > 0 else 0.0)
    return out


def layer_norm(X, eps=1e-5):
    out = Matrix(X.rows, X.cols)
    for i in range(X.rows):
        row = X.row(i)
        mean = sum(row) / len(row)
        var = sum((v - mean) ** 2 for v in row) / len(row)
        denom = math.sqrt(var + eps)
        for j in range(X.cols):
            out.set(i, j, (row[j] - mean) / denom)
    return out


def rms_norm(X, eps=1e-6):
    out = Matrix(X.rows, X.cols)
    for i in range(X.rows):
        row = X.row(i)
        rms = math.sqrt(sum(v * v for v in row) / len(row) + eps)
        for j in range(X.cols):
            out.set(i, j, row[j] / rms)
    return out


def silu(x):
    return x / (1.0 + math.exp(-x))


def ffn_swiglu(X, W1, W2, W3):
    h1 = matmul(X, W1)
    h3 = matmul(X, W3)
    gated = Matrix(h1.rows, h1.cols)
    for i in range(len(h1.data)):
        gated.data[i] = silu(h1.data[i]) * h3.data[i]
    return matmul(gated, W2)


def ffn_relu(X, W1, W2):
    h = matmul(X, W1)
    for i in range(len(h.data)):
        if h.data[i] < 0:
            h.data[i] = 0.0
    return matmul(h, W2)


def scaled_dot_product_attention(Q, K, V, causal=False):
    dk = Q.cols
    scores = matmul(Q, transpose(K))
    inv = 1.0 / math.sqrt(dk)
    for i in range(len(scores.data)):
        scores.data[i] *= inv
    mask = None
    if causal:
        mask = [[j > i for j in range(scores.cols)] for i in range(scores.rows)]
    w = softmax_rows(scores, mask=mask)
    return matmul(w, V)


def multi_head_attention(X, Wq, Wk, Wv, Wo, n_heads, causal=False, kv_source=None):
    Q = matmul(X, Wq)
    kv_input = kv_source if kv_source is not None else X
    K = matmul(kv_input, Wk)
    V = matmul(kv_input, Wv)
    d_head = Q.cols // n_heads
    head_outs = []
    for h in range(n_heads):
        Qh = Matrix(Q.rows, d_head, data=[Q.get(i, h * d_head + j) for i in range(Q.rows) for j in range(d_head)])
        Kh = Matrix(K.rows, d_head, data=[K.get(i, h * d_head + j) for i in range(K.rows) for j in range(d_head)])
        Vh = Matrix(V.rows, d_head, data=[V.get(i, h * d_head + j) for i in range(V.rows) for j in range(d_head)])
        head_outs.append(scaled_dot_product_attention(Qh, Kh, Vh, causal=causal))
    concat = Matrix(X.rows, Q.cols)
    for h, H in enumerate(head_outs):
        for i in range(H.rows):
            for j in range(d_head):
                concat.set(i, h * d_head + j, H.get(i, j))
    return matmul(concat, Wo)


class BlockParams:
    """All weights for one encoder or decoder block."""
    def __init__(self, d, n_heads, ffn_expansion, rng, use_swiglu=True):
        self.d = d
        self.n_heads = n_heads
        self.use_swiglu = use_swiglu
        self.Wq = randn(d, d, rng)
        self.Wk = randn(d, d, rng)
        self.Wv = randn(d, d, rng)
        self.Wo = randn(d, d, rng)
        h = int(d * ffn_expansion)
        if use_swiglu:
            self.W1 = randn(d, h, rng)
            self.W2 = randn(h, d, rng)
            self.W3 = randn(d, h, rng)
        else:
            self.W1 = randn(d, h, rng)
            self.W2 = randn(h, d, rng)
        # cross-attention (decoder)
        self.Wq_x = randn(d, d, rng)
        self.Wk_x = randn(d, d, rng)
        self.Wv_x = randn(d, d, rng)
        self.Wo_x = randn(d, d, rng)


def encoder_block(x, p):
    # pre-norm self-attention + residual
    h = rms_norm(x)
    a = multi_head_attention(h, p.Wq, p.Wk, p.Wv, p.Wo, p.n_heads)
    x = add(x, a)
    # pre-norm FFN + residual
    h = rms_norm(x)
    f = ffn_swiglu(h, p.W1, p.W2, p.W3) if p.use_swiglu else ffn_relu(h, p.W1, p.W2)
    return add(x, f)


def decoder_block(x, enc_out, p):
    # 1) masked self-attention
    h = rms_norm(x)
    a = multi_head_attention(h, p.Wq, p.Wk, p.Wv, p.Wo, p.n_heads, causal=True)
    x = add(x, a)
    # 2) cross-attention to encoder output
    h = rms_norm(x)
    a = multi_head_attention(h, p.Wq_x, p.Wk_x, p.Wv_x, p.Wo_x, p.n_heads, kv_source=enc_out)
    x = add(x, a)
    # 3) FFN
    h = rms_norm(x)
    f = ffn_swiglu(h, p.W1, p.W2, p.W3) if p.use_swiglu else ffn_relu(h, p.W1, p.W2)
    return add(x, f)


def main():
    rng = random.Random(42)
    d = 8
    n_heads = 2
    ffn_expansion = 2.0
    src_len = 6
    tgt_len = 5

    src = randn(src_len, d, rng, scale=0.5)
    tgt = randn(tgt_len, d, rng, scale=0.5)

    enc_params = [BlockParams(d, n_heads, ffn_expansion, rng) for _ in range(2)]
    dec_params = [BlockParams(d, n_heads, ffn_expansion, rng) for _ in range(2)]

    enc_out = src
    for p in enc_params:
        enc_out = encoder_block(enc_out, p)

    dec_out = tgt
    for p in dec_params:
        dec_out = decoder_block(dec_out, enc_out, p)

    print("=== full transformer forward pass ===")
    print(f"source shape:           ({src.rows}, {src.cols})")
    print(f"encoder output shape:   ({enc_out.rows}, {enc_out.cols})")
    print(f"target shape:           ({tgt.rows}, {tgt.cols})")
    print(f"decoder output shape:   ({dec_out.rows}, {dec_out.cols})")
    print()
    print("first 3 cells of encoder output:")
    for i in range(3):
        print("  " + "  ".join(f"{v:+.3f}" for v in enc_out.row(i)[:4]))
    print()
    print("first 3 cells of decoder output:")
    for i in range(3):
        print("  " + "  ".join(f"{v:+.3f}" for v in dec_out.row(i)[:4]))
    print()
    print("stack: 2-layer encoder + 2-layer decoder, pre-norm, RMSNorm, SwiGLU.")
    print("this is the 2026 block skeleton (minus RoPE).")


if __name__ == "__main__":
    main()
