import math
import random


def sin_embed(t, dim=8):
    out = []
    half = dim // 2
    for i in range(half):
        freq = 1.0 / (10000 ** (i / max(half - 1, 1)))
        out.append(math.sin(t * freq))
        out.append(math.cos(t * freq))
    return out[:dim]


def tanh(v):
    return [math.tanh(x) for x in v]


def tanh_grad(h):
    return [1 - x * x for x in h]


def matmul(W, x):
    return [sum(w * xi for w, xi in zip(row, x)) for row in W]


def add(a, b):
    return [x + y for x, y in zip(a, b)]


def randn_matrix(rows, cols, rng, scale=0.3):
    return [[rng.gauss(0, scale) for _ in range(cols)] for _ in range(rows)]


T_FRAMES = 6
POS_DIM = 4


def make_video(rng):
    """1-D 'video': smooth trajectory of T_FRAMES values."""
    base = rng.gauss(0, 1)
    slope = rng.gauss(0, 0.3)
    return [base + slope * t + rng.gauss(0, 0.05) for t in range(T_FRAMES)]


def patchify_with_pos(video):
    """Each 'patch' here is one frame value + its time position embedding."""
    out = []
    for t in range(T_FRAMES):
        pe = sin_embed(t, POS_DIM)
        out.append([video[t]] + pe)
    return out  # list of (1 + POS_DIM) vectors


def flatten(patches):
    return [v for patch in patches for v in patch]


def init_net(in_dim, hidden, out_dim, rng):
    return {
        "W1": randn_matrix(hidden, in_dim, rng),
        "b1": [0.0] * hidden,
        "W2": randn_matrix(hidden, hidden, rng),
        "b2": [0.0] * hidden,
        "W3": randn_matrix(out_dim, hidden, rng),
        "b3": [0.0] * out_dim,
    }


def forward(x, t_emb, net):
    inp = list(x) + list(t_emb)
    pre1 = add(matmul(net["W1"], inp), net["b1"])
    h1 = tanh(pre1)
    pre2 = add(matmul(net["W2"], h1), net["b2"])
    h2 = tanh(pre2)
    out = add(matmul(net["W3"], h2), net["b3"])
    return out, {"inp": inp, "h1": h1, "h2": h2}


def backward(target, out, cache, net):
    grads = {k: None for k in net}
    for p in net:
        if isinstance(net[p][0], list):
            grads[p] = [[0.0] * len(net[p][0]) for _ in net[p]]
        else:
            grads[p] = [0.0] * len(net[p])
    d_out = [2 * (a - b) for a, b in zip(out, target)]
    for i in range(len(d_out)):
        grads["b3"][i] += d_out[i]
        for j in range(len(cache["h2"])):
            grads["W3"][i][j] += d_out[i] * cache["h2"][j]
    d_h2 = [sum(net["W3"][i][j] * d_out[i] for i in range(len(d_out)))
            for j in range(len(cache["h2"]))]
    d_pre2 = [d_h2[j] * tanh_grad(cache["h2"])[j] for j in range(len(cache["h2"]))]
    for j in range(len(cache["h2"])):
        grads["b2"][j] += d_pre2[j]
        for k in range(len(cache["h1"])):
            grads["W2"][j][k] += d_pre2[j] * cache["h1"][k]
    d_h1 = [sum(net["W2"][j][k] * d_pre2[j] for j in range(len(cache["h2"])))
            for k in range(len(cache["h1"]))]
    d_pre1 = [d_h1[j] * tanh_grad(cache["h1"])[j] for j in range(len(cache["h1"]))]
    for j in range(len(cache["h1"])):
        grads["b1"][j] += d_pre1[j]
        for k in range(len(cache["inp"])):
            grads["W1"][j][k] += d_pre1[j] * cache["inp"][k]
    return grads


def apply(net, grads, lr):
    for k, v in net.items():
        if isinstance(v[0], list):
            for i in range(len(v)):
                for j in range(len(v[i])):
                    v[i][j] -= lr * grads[k][i][j]
        else:
            for i in range(len(v)):
                v[i] -= lr * grads[k][i]


def make_schedule(T):
    betas = [1e-4 + (0.02 - 1e-4) * t / (T - 1) for t in range(T)]
    alphas = [1 - b for b in betas]
    bars, cum = [], 1.0
    for a in alphas:
        cum *= a
        bars.append(cum)
    return alphas, bars


def train_joint(net, alpha_bars, T, t_dim, steps, lr, rng):
    """Joint sampling: denoiser sees all frames + their time positions simultaneously."""
    for step in range(steps):
        video = make_video(rng)
        t = rng.randrange(T)
        eps = [rng.gauss(0, 1) for _ in range(T_FRAMES)]
        a_bar = alpha_bars[t]
        noisy = [math.sqrt(a_bar) * video[i] + math.sqrt(1 - a_bar) * eps[i]
                 for i in range(T_FRAMES)]
        patches = patchify_with_pos(noisy)
        x_flat = flatten(patches)
        t_emb = sin_embed(t, t_dim)
        out, cache = forward(x_flat, t_emb, net)
        grads = backward(eps, out, cache, net)
        apply(net, grads, lr)


def sample_joint(net, alphas, alpha_bars, T, t_dim, rng):
    x = [rng.gauss(0, 1) for _ in range(T_FRAMES)]
    for t in range(T - 1, -1, -1):
        patches = patchify_with_pos(x)
        x_flat = flatten(patches)
        t_emb = sin_embed(t, t_dim)
        eps_hat, _ = forward(x_flat, t_emb, net)
        beta_t = 1 - alphas[t]
        new_x = [(x[i] - beta_t / math.sqrt(1 - alpha_bars[t]) * eps_hat[i]) / math.sqrt(alphas[t])
                 for i in range(T_FRAMES)]
        if t > 0:
            x = [new_x[i] + math.sqrt(beta_t) * rng.gauss(0, 1) for i in range(T_FRAMES)]
        else:
            x = new_x
    return x


def independent_per_frame(T_frames, rng):
    """Baseline: sample each frame independently from a random walk."""
    return [rng.gauss(0, 1) + 0.3 * t for t in range(T_frames)]


def frame_deltas(video):
    return [abs(video[i + 1] - video[i]) for i in range(len(video) - 1)]


def main():
    rng = random.Random(21)
    T, t_dim, hidden = 40, 8, 48
    alphas, alpha_bars = make_schedule(T)
    net = init_net(T_FRAMES * (1 + POS_DIM) + t_dim, hidden, T_FRAMES, rng)

    print(f"=== training joint video DDPM: {T_FRAMES} frames per clip ===")
    train_joint(net, alpha_bars, T, t_dim, steps=3000, lr=0.01, rng=rng)

    print()
    print("=== 5 clips, joint sampling (coherent) ===")
    joint_deltas = []
    for i in range(5):
        clip = sample_joint(net, alphas, alpha_bars, T, t_dim, rng)
        deltas = frame_deltas(clip)
        joint_deltas.extend(deltas)
        print(f"  clip {i}: " + " ".join(f"{v:+.2f}" for v in clip))

    print()
    print("=== 5 clips, independent per-frame (flicker baseline) ===")
    indep_deltas = []
    for i in range(5):
        clip = independent_per_frame(T_FRAMES, rng)
        deltas = frame_deltas(clip)
        indep_deltas.extend(deltas)
        print(f"  clip {i}: " + " ".join(f"{v:+.2f}" for v in clip))

    avg_joint = sum(joint_deltas) / len(joint_deltas)
    avg_indep = sum(indep_deltas) / len(indep_deltas)
    print()
    print(f"avg frame-to-frame delta: joint={avg_joint:.2f}  independent={avg_indep:.2f}")
    print("joint sampling produces smoother motion (smaller deltas).")


if __name__ == "__main__":
    main()
