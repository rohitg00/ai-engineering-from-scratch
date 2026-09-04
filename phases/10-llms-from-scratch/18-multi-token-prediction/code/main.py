"""DeepSeek-V3 Multi-Token Prediction (MTP) module — stdlib Python.

Implements:
  - shared embedding table (used by main model and every MTP module)
  - per-depth MTP module: projection + 1-block transformer + shared head
  - joint MTP loss across depths
  - parameter-count accounting (per module, shared, total)
  - a toy sequential evaluation that matches DeepSeek-V3's Section 2.2 equations

Pedagogical: single-head linear-projection attention, element-wise SwiGLU.
The goal is to show the structure of the MTP module, not to train a real LLM.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import List


def rand_matrix(rows: int, cols: int, rng: random.Random,
                scale: float = 0.1) -> List[List[float]]:
    return [[rng.gauss(0, scale) for _ in range(cols)] for _ in range(rows)]


def matvec(M: List[List[float]], v: List[float]) -> List[float]:
    out = [0.0] * len(M)
    for i, row in enumerate(M):
        out[i] = sum(row[j] * v[j] for j in range(len(v)))
    return out


def add(a: List[float], b: List[float]) -> List[float]:
    return [ai + bi for ai, bi in zip(a, b)]


def rms_norm(v: List[float], eps: float = 1e-6) -> List[float]:
    ms = sum(x * x for x in v) / len(v)
    r = 1.0 / math.sqrt(ms + eps)
    return [x * r for x in v]


def silu(x: float) -> float:
    return x / (1.0 + math.exp(-x))


def swiglu(v: List[float], W_gate: List[List[float]], W_up: List[List[float]],
           W_down: List[List[float]]) -> List[float]:
    gate = [silu(x) for x in matvec(W_gate, v)]
    up = matvec(W_up, v)
    inner = [g * u for g, u in zip(gate, up)]
    return matvec(W_down, inner)


def softmax(row: List[float]) -> List[float]:
    m = max(row)
    exps = [math.exp(x - m) for x in row]
    s = sum(exps)
    return [e / s for e in exps]


@dataclass
class MTPModule:
    """A single depth-k MTP module."""
    hidden: int
    ff: int
    # Projection M_k: input is concat of 2 RMSNorm'd vectors of size h. We
    # approximate the concat as addition to keep the toy manageable while
    # preserving the projection structure.
    M_k: List[List[float]]
    # Transformer block: attention q/k/v/out + SwiGLU MLP
    Wq: List[List[float]]
    Wk: List[List[float]]
    Wv: List[List[float]]
    Wo: List[List[float]]
    W_gate: List[List[float]]
    W_up: List[List[float]]
    W_down: List[List[float]]


def make_mtp_module(hidden: int, ff: int, rng: random.Random) -> MTPModule:
    return MTPModule(
        hidden=hidden, ff=ff,
        M_k=rand_matrix(hidden, hidden, rng),
        Wq=rand_matrix(hidden, hidden, rng),
        Wk=rand_matrix(hidden, hidden, rng),
        Wv=rand_matrix(hidden, hidden, rng),
        Wo=rand_matrix(hidden, hidden, rng),
        W_gate=rand_matrix(ff, hidden, rng),
        W_up=rand_matrix(ff, hidden, rng),
        W_down=rand_matrix(hidden, ff, rng),
    )


def attention_single(v_in: List[float], Wq: List[List[float]], Wk: List[List[float]],
                     Wv: List[List[float]], Wo: List[List[float]]) -> List[float]:
    """One-token self-attention stand-in. For a full sequence you would
    attend over K_cache; here the toy uses a degenerate q=k=self to keep
    the structure visible. A full implementation is a drop-in replacement."""
    q = matvec(Wq, v_in)
    k = matvec(Wk, v_in)
    v = matvec(Wv, v_in)
    score = sum(q[i] * k[i] for i in range(len(q))) / math.sqrt(len(q))
    weight = 1.0
    attended = [weight * vi for vi in v]
    return matvec(Wo, attended)


def mtp_forward(prev_hidden: List[float], next_embed: List[float],
                module: MTPModule) -> List[float]:
    """Equation from DeepSeek-V3 Section 2.2:
        h^(k) = T_k( M_k * [RMSNorm(h^(k-1)); RMSNorm(E(t_{i+k}))] )
    We use addition as a toy stand-in for concat + linear."""
    a = rms_norm(prev_hidden)
    b = rms_norm(next_embed)
    folded = add(a, b)
    projected = matvec(module.M_k, folded)
    post_attn = add(projected, attention_single(projected, module.Wq, module.Wk,
                                                  module.Wv, module.Wo))
    post_mlp = add(post_attn, swiglu(rms_norm(post_attn), module.W_gate,
                                       module.W_up, module.W_down))
    return post_mlp


def shared_head_logits(hidden: List[float], E: List[List[float]]) -> List[float]:
    """Tied LM head: reuse the embedding table transposed. logits[v] = E_v . hidden."""
    return [sum(E[v][i] * hidden[i] for i in range(len(hidden)))
            for v in range(len(E))]


def cross_entropy(logits: List[float], target: int) -> float:
    probs = softmax(logits)
    return -math.log(max(probs[target], 1e-12))


def mtp_loss(backbone_hidden: List[List[float]], tokens: List[int],
             modules: List[MTPModule], E: List[List[float]],
             lam: float) -> tuple[float, List[float]]:
    """Compute joint MTP loss over D depths.

    backbone_hidden[i] is h_i^(0), the main-model output at position i.
    modules[k-1] is the depth-k MTP module.
    tokens[i] is t_i. We want to predict t_{i+1}, t_{i+2}, ..., t_{i+D} for
    each i such that i + D is in range.
    """
    D = len(modules)
    per_depth = [0.0] * D
    n_valid = 0
    for i in range(len(backbone_hidden) - D):
        h_prev = backbone_hidden[i]
        for k in range(1, D + 1):
            logits = shared_head_logits(h_prev, E)
            tgt = tokens[i + k]
            per_depth[k - 1] += cross_entropy(logits, tgt)
            next_embed = E[tokens[i + k]]
            h_prev = mtp_forward(h_prev, next_embed, modules[k - 1])
        n_valid += 1
    per_depth = [loss / n_valid for loss in per_depth]
    total = (lam / D) * sum(per_depth)
    return total, per_depth


@dataclass
class ParamReport:
    embedding: int
    head_shared: bool
    per_mtp: int
    main_attention_per_layer: int
    main_mlp_per_layer: int
    main_total: int
    mtp_total: int
    total: int


def count_parameters(vocab: int, hidden: int, ff: int, n_layers: int,
                     D: int) -> ParamReport:
    emb = vocab * hidden
    attn = 4 * hidden * hidden
    mlp = 3 * hidden * ff
    main = emb + n_layers * (attn + mlp) + hidden
    per_mtp = hidden * hidden + attn + mlp
    mtp_total = D * per_mtp
    return ParamReport(
        embedding=emb, head_shared=True,
        per_mtp=per_mtp,
        main_attention_per_layer=attn, main_mlp_per_layer=mlp,
        main_total=main, mtp_total=mtp_total, total=main + mtp_total,
    )


def fmt(n: int) -> str:
    if n >= 1_000_000_000:
        return f"{n / 1e9:.1f}B"
    if n >= 1_000_000:
        return f"{n / 1e6:.1f}M"
    if n >= 1_000:
        return f"{n / 1e3:.1f}K"
    return f"{n}"


def main() -> None:
    rng = random.Random(23)
    print("=" * 70)
    print("MULTI-TOKEN PREDICTION — DeepSeek-V3 sequential MTP (Phase 10, Lesson 18)")
    print("=" * 70)
    print()

    vocab = 32
    hidden = 8
    ff = 16
    seq = 12
    D = 2
    lam = 0.3

    print("-" * 70)
    print(f"Step 1: toy setup  vocab={vocab}, hidden={hidden}, ff={ff}, seq={seq}, D={D}")
    print("-" * 70)

    E = rand_matrix(vocab, hidden, rng, scale=0.2)
    tokens = [rng.randrange(vocab) for _ in range(seq)]

    backbone_hidden = [rms_norm(add(E[tokens[i]],
                                    [rng.gauss(0, 0.1) for _ in range(hidden)]))
                       for i in range(seq)]

    modules = [make_mtp_module(hidden, ff, rng) for _ in range(D)]

    total, per_depth = mtp_loss(backbone_hidden, tokens, modules, E, lam=lam)
    print(f"  per-depth losses   : "
          + ", ".join(f"L_{k+1}={loss:.3f}" for k, loss in enumerate(per_depth)))
    print(f"  joint L_MTP (lam={lam})  : {total:.4f}")
    print(f"  (uniform random-guess reference: {math.log(vocab):.3f} per depth)")
    print()

    print("-" * 70)
    print("Step 2: parameter accounting")
    print("-" * 70)
    for name, h, ff_h, L, D_h in [
        ("toy",       hidden, ff, 2, D),
        ("mini GPT",  768, 3072, 12, 1),
        ("7B dense",  4096, 14336, 32, 1),
        ("70B dense", 8192, 28672, 80, 1),
        ("DeepSeek-V3-shape", 7168, 18432, 61, 1),
    ]:
        r = count_parameters(vocab=128000 if name != "toy" else vocab,
                             hidden=h, ff=ff_h, n_layers=L, D=D_h)
        print(f"  {name:<22} main={fmt(r.main_total):>7}  "
              f"+ {D_h} MTP module(s) = {fmt(r.mtp_total):>6}  "
              f"({100.0 * r.mtp_total / r.main_total:.1f}% overhead)")
    print()

    print("-" * 70)
    print("Step 3: per-depth loss vs training progress (synthetic)")
    print("-" * 70)
    print("  simulate a training step: reduce noise in backbone hidden states")
    print("  and watch L_1 and L_2 both drop.")
    print()
    print(f"  {'noise':>7}  {'L_1':>6}  {'L_2':>6}  {'L_MTP':>7}")
    for noise_scale in (0.50, 0.30, 0.15, 0.05):
        local_rng = random.Random(42)
        bh = [rms_norm(add(E[tokens[i]],
                           [local_rng.gauss(0, noise_scale) for _ in range(hidden)]))
              for i in range(seq)]
        total, per_depth = mtp_loss(bh, tokens, modules, E, lam=lam)
        l1 = per_depth[0]
        l2 = per_depth[1] if len(per_depth) > 1 else float("nan")
        print(f"  {noise_scale:>7.2f}  {l1:>6.3f}  {l2:>6.3f}  {total:>7.4f}")
    print()

    print("takeaway: DeepSeek-V3 MTP adds ~1-2% parameters for a dense model and")
    print("          ~14B out of 671B for the MoE model. Denser training signal +")
    print("          free speculative-decoding draft at inference (80%+ accept)")
    print("          with reported 1.8x throughput speedup.")


if __name__ == "__main__":
    main()
