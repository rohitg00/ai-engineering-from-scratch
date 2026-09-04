import numpy as np


def linear_forward(x, w, b):
    return x @ w + b


def relu(x):
    return np.maximum(x, 0.0)


def layer_forward(x, w1, b1, w2, b2):
    h = relu(linear_forward(x, w1, b1))
    return linear_forward(h, w2, b2)


def model_forward(x, params):
    activations = [x]
    h = x
    for w1, b1, w2, b2 in params:
        h = layer_forward(h, w1, b1, w2, b2)
        activations.append(h)
    return h, activations


def layer_backward(g, x_in, w1, b1, w2, b2):
    h_pre = linear_forward(x_in, w1, b1)
    h = relu(h_pre)
    gw2 = h.T @ g
    gb2 = g.sum(axis=0)
    gh = g @ w2.T
    g_pre = gh * (h_pre > 0)
    gw1 = x_in.T @ g_pre
    gb1 = g_pre.sum(axis=0)
    gx = g_pre @ w1.T
    return gx, (gw1, gb1, gw2, gb2)


def model_backward(grad_output, activations, params):
    grads = [None] * len(params)
    g = grad_output
    for i in range(len(params) - 1, -1, -1):
        w1, b1, w2, b2 = params[i]
        x_in = activations[i]
        g, grads[i] = layer_backward(g, x_in, w1, b1, w2, b2)
    return g, grads


def model_forward_checkpointed(x, params, k=4):
    saved_inputs = [x]
    h = x
    for i, (w1, b1, w2, b2) in enumerate(params):
        h = layer_forward(h, w1, b1, w2, b2)
        if (i + 1) % k == 0 and (i + 1) < len(params):
            saved_inputs.append(h)
    saved_inputs.append(h)
    return h, saved_inputs


def model_backward_checkpointed(grad_output, saved_inputs, params, k=4):
    grads = [None] * len(params)
    g = grad_output
    n_seg = (len(params) + k - 1) // k
    for seg_idx in range(n_seg - 1, -1, -1):
        start = seg_idx * k
        end = min(start + k, len(params))
        x_in = saved_inputs[seg_idx]
        _, seg_acts = model_forward(x_in, params[start:end])
        g, seg_grads = model_backward(g, seg_acts, params[start:end])
        for j, gr in enumerate(seg_grads):
            grads[start + j] = gr
    return g, grads


def checkpoint_cost(n_layers, segment_size=1, flops_per_layer=1.0,
                    attention_fraction=0.15, selective=False):
    fwd = n_layers * flops_per_layer
    if selective:
        recompute = n_layers * attention_fraction * flops_per_layer
    else:
        recompute = n_layers * flops_per_layer * (
            (segment_size - 1) / max(segment_size, 1)
        )
    bwd = 2 * n_layers * flops_per_layer
    total = fwd + recompute + bwd
    baseline = fwd + bwd
    return {
        "fwd": fwd,
        "recompute": recompute,
        "bwd": bwd,
        "total": total,
        "overhead_vs_no_ckpt": total / baseline - 1.0,
    }


def activation_memory_mb(n_layers, hidden=8192, seq=8192, batch=1,
                         bytes_per_value=2):
    per_layer = 12 * batch * seq * hidden * bytes_per_value
    return n_layers * per_layer / 1e6


def memory_after_checkpoint(n_layers, segment_size, hidden=8192,
                            seq=8192, batch=1, bytes_per_value=2):
    n_seg = (n_layers + segment_size - 1) // segment_size
    saved = (n_seg + segment_size) * batch * seq * hidden * bytes_per_value
    return saved / 1e6


def optimal_segment(n_layers):
    return max(1, int(round(np.sqrt(n_layers))))


def should_recompute(layer_type, activation_bytes_mb, recompute_flops_ratio):
    if layer_type == "attention" and activation_bytes_mb > 100:
        return True
    if layer_type == "ffn" and activation_bytes_mb > 500:
        return recompute_flops_ratio < 0.1
    return False


def make_params(n_layers, hidden, inner, seed=0):
    rng = np.random.default_rng(seed)
    params = []
    for _ in range(n_layers):
        w1 = rng.standard_normal((hidden, inner)).astype(np.float32) * (1.0 / np.sqrt(hidden))
        b1 = np.zeros(inner, dtype=np.float32)
        w2 = rng.standard_normal((inner, hidden)).astype(np.float32) * (1.0 / np.sqrt(inner))
        b2 = np.zeros(hidden, dtype=np.float32)
        params.append((w1, b1, w2, b2))
    return params


def verify_equivalence(n_layers=6, hidden=16, inner=32, batch=4, k=2):
    rng = np.random.default_rng(1)
    x = rng.standard_normal((batch, hidden)).astype(np.float32)
    params = make_params(n_layers, hidden, inner)
    out_full, acts_full = model_forward(x, params)
    grad_out = rng.standard_normal(out_full.shape).astype(np.float32)
    _, grads_full = model_backward(grad_out, acts_full, params)
    out_ck, saved = model_forward_checkpointed(x, params, k=k)
    _, grads_ck = model_backward_checkpointed(grad_out, saved, params, k=k)
    max_diff = 0.0
    for gf, gc in zip(grads_full, grads_ck):
        for a, b in zip(gf, gc):
            max_diff = max(max_diff, float(np.max(np.abs(a - b))))
    return {
        "output_match": bool(np.allclose(out_full, out_ck, atol=1e-5)),
        "max_grad_diff": max_diff,
    }


if __name__ == "__main__":
    print("equivalence:", verify_equivalence())
    for seg in [1, 2, 4, 8, 16, 32, 64]:
        cost = checkpoint_cost(64, segment_size=seg)
        print(f"k={seg:3d}  overhead={cost['overhead_vs_no_ckpt']:.1%}")
    print("selective overhead:", f"{checkpoint_cost(64, selective=True)['overhead_vs_no_ckpt']:.1%}")
    print("optimal segment for L=64:", optimal_segment(64))
    print("activation memory (no ckpt), L=64, d=8192, seq=8192, batch=1:",
          f"{activation_memory_mb(64):.1f} MB")
    for seg in [1, 4, 8, 16, 32]:
        print(f"  checkpoint k={seg:3d}: {memory_after_checkpoint(64, seg):.1f} MB")
