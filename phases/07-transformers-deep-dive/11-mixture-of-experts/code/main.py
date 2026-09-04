"""Mixture of Experts (MoE) in pure stdlib.

Implements:
- top-k router with softmax gating
- auxiliary-loss-free bias update (DeepSeek-V3)
- expert-usage tracking over many tokens
"""

import math
import random


def silu(x):
    return x / (1.0 + math.exp(-x))


def make_expert(d_in, d_hidden, rng):
    """Tiny 'expert': input -> silu -> output. Linear for illustration."""
    scale = math.sqrt(2.0 / (d_in + d_hidden))
    W = [[rng.gauss(0, scale) for _ in range(d_hidden)] for _ in range(d_in)]
    return W


def apply_expert(x, W):
    d_hidden = len(W[0])
    out = [0.0] * d_hidden
    for i, xi in enumerate(x):
        if xi == 0.0:
            continue
        for j in range(d_hidden):
            out[j] += xi * W[i][j]
    return [silu(v) for v in out]


def route(hidden, W_router, top_k, bias):
    """Return (top-k expert indices, gate weights over those experts).

    Bias affects selection (argmax) but NOT gate weights — the
    auxiliary-loss-free trick from DeepSeek-V3.
    """
    E = len(W_router)
    scores = [sum(h * w for h, w in zip(hidden, W_router[e])) for e in range(E)]
    biased = [s + b for s, b in zip(scores, bias)]
    top_idx = sorted(range(E), key=lambda i: -biased[i])[:top_k]
    chosen = [scores[i] for i in top_idx]
    m = max(chosen)
    exps = [math.exp(c - m) for c in chosen]
    s = sum(exps)
    gates = [e / s for e in exps]
    return top_idx, gates


def moe_layer_forward(x, experts, W_router, top_k, bias):
    """Compute MoE output for a single token `x`. Returns output vector."""
    top_idx, gates = route(x, W_router, top_k, bias)
    d_hidden = len(experts[0][0])
    out = [0.0] * d_hidden
    for e_idx, gate in zip(top_idx, gates):
        h = apply_expert(x, experts[e_idx])
        for j in range(d_hidden):
            out[j] += gate * h[j]
    return out, top_idx


def update_bias(bias, usage_counts, target, gamma):
    """Aux-loss-free balance: nudge bias up/down based on usage vs target."""
    for e in range(len(bias)):
        if usage_counts[e] > target:
            bias[e] -= gamma
        elif usage_counts[e] < target:
            bias[e] += gamma
    return bias


def run_epoch(tokens, experts, W_router, top_k, bias):
    usage = [0] * len(experts)
    for x in tokens:
        _, top_idx = moe_layer_forward(x, experts, W_router, top_k, bias)
        for e in top_idx:
            usage[e] += 1
    return usage


def entropy(counts):
    total = sum(counts)
    if total == 0:
        return 0.0
    ps = [c / total for c in counts if c > 0]
    return -sum(p * math.log(p) for p in ps)


def dense_active_params(n_experts, expert_params, top_k, d_model):
    """Total params, active params per token. d_model used for attention est."""
    total = n_experts * expert_params
    active = top_k * expert_params
    return total, active


def main():
    rng = random.Random(42)
    d_model = 16
    d_hidden = 32
    n_experts = 8
    top_k = 2
    n_tokens = 1000

    experts = [make_expert(d_model, d_hidden, rng) for _ in range(n_experts)]
    W_router = [[rng.gauss(0, 0.3) for _ in range(d_model)] for _ in range(n_experts)]

    # Synthetic tokens with some structure so routing isn't uniform to start.
    tokens = [[rng.gauss(0, 1) for _ in range(d_model)] for _ in range(n_tokens)]

    bias = [0.0] * n_experts
    target = n_tokens * top_k / n_experts

    print("=== MoE routing: auxiliary-loss-free balance ===")
    print(f"config: {n_experts} experts, top-{top_k}, {n_tokens} tokens, target usage = {target:.0f} per expert")
    print()
    usage = run_epoch(tokens, experts, W_router, top_k, bias)
    print(f"iteration  0  usage: " + " ".join(f"{u:>4}" for u in usage) + f"  entropy={entropy(usage):.3f}")

    for it in range(1, 11):
        bias = update_bias(bias, usage, target, gamma=0.15)
        usage = run_epoch(tokens, experts, W_router, top_k, bias)
        print(f"iteration {it:>2}  usage: " + " ".join(f"{u:>4}" for u in usage) + f"  entropy={entropy(usage):.3f}")
    print(f"max entropy (uniform) = ln({n_experts}) = {math.log(n_experts):.3f}")
    print()

    print("=== parameter counts (FFN portion, per layer) ===")
    ffn_params = d_model * d_hidden * 3  # SwiGLU-like: W1, W2, W3
    print(f"  toy MoE       : total={n_experts * ffn_params:>10}  active={top_k * ffn_params:>10}")

    # DeepSeek-V3 shape (per-layer FFN; real model has 61 layers)
    d = 7168
    shared = 1
    routed = 256
    active = 8
    layers = 61
    ffn_full = 3 * d * int(d * 2.67)
    fine_expert = ffn_full // 8
    total_moe_per_layer = (shared + routed) * fine_expert
    active_moe_per_layer = (shared + active) * fine_expert
    print(f"  deepseek-v3-ish per layer:  total={total_moe_per_layer / 1e9:.1f}B  active={active_moe_per_layer / 1e9:.1f}B")
    print(f"  deepseek-v3 FFN total (×{layers} layers): ~{total_moe_per_layer * layers / 1e9:.0f}B total,  ~{active_moe_per_layer * layers / 1e9:.0f}B active")
    print(f"  llama-3-70b FFN total: ~{32 * ffn_full / 1e9:.0f}B  (all active every token)")
    print()
    print("takeaway: same active FLOPs, vastly larger parameter footprint.")


if __name__ == "__main__":
    main()
