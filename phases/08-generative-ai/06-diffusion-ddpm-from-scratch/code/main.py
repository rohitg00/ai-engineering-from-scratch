import math
import random


def sin_embed(t, T, dim=8):
    """Sinusoidal timestep embedding."""
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


def init_net(x_dim, t_dim, hidden, rng):
    return {
        "W1": randn_matrix(hidden, x_dim + t_dim, rng),
        "b1": [0.0] * hidden,
        "W2": randn_matrix(hidden, hidden, rng),
        "b2": [0.0] * hidden,
        "W3": randn_matrix(x_dim, hidden, rng),
        "b3": [0.0] * x_dim,
    }


def forward(x_t, t_embed, net):
    inp = x_t + t_embed
    pre1 = add(matmul(net["W1"], inp), net["b1"])
    h1 = tanh(pre1)
    pre2 = add(matmul(net["W2"], h1), net["b2"])
    h2 = tanh(pre2)
    eps_hat = add(matmul(net["W3"], h2), net["b3"])
    return eps_hat, {"inp": inp, "h1": h1, "h2": h2, "pre1": pre1, "pre2": pre2}


def backward(target_eps, eps_hat, cache, net):
    grads = {k: None for k in net}
    for part in net:
        if isinstance(net[part][0], list):
            grads[part] = [[0.0] * len(net[part][0]) for _ in net[part]]
        else:
            grads[part] = [0.0] * len(net[part])

    d_out = [2 * (a - b) for a, b in zip(eps_hat, target_eps)]
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


def apply_update(net, grads, lr):
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
    alpha_bars, cum = [], 1.0
    for a in alphas:
        cum *= a
        alpha_bars.append(cum)
    return betas, alphas, alpha_bars


def sample_data(rng):
    return rng.gauss(-2.0, 0.4) if rng.random() < 0.5 else rng.gauss(2.0, 0.4)


def train(net, alpha_bars, T, steps, lr, t_dim, rng):
    for step in range(steps):
        x0 = sample_data(rng)
        t = rng.randrange(T)
        a_bar = alpha_bars[t]
        eps = rng.gauss(0, 1)
        x_t = math.sqrt(a_bar) * x0 + math.sqrt(1 - a_bar) * eps
        t_emb = sin_embed(t, T, t_dim)
        eps_hat, cache = forward([x_t], t_emb, net)
        grads = backward([eps], eps_hat, cache, net)
        apply_update(net, grads, lr)
        if (step + 1) % 500 == 0:
            loss = (eps_hat[0] - eps) ** 2
            print(f"step {step+1:5d}: loss {loss:.4f}")


def sample(net, alphas, alpha_bars, T, t_dim, rng):
    x = rng.gauss(0, 1)
    for t in range(T - 1, -1, -1):
        t_emb = sin_embed(t, T, t_dim)
        eps_hat, _ = forward([x], t_emb, net)
        beta_t = 1 - alphas[t]
        mean = (x - beta_t / math.sqrt(1 - alpha_bars[t]) * eps_hat[0]) / math.sqrt(alphas[t])
        if t > 0:
            x = mean + math.sqrt(beta_t) * rng.gauss(0, 1)
        else:
            x = mean
    return x


def histogram(samples, lo=-5.0, hi=5.0, bins=30):
    width = (hi - lo) / bins
    counts = [0] * bins
    for s in samples:
        if lo <= s < hi:
            counts[int((s - lo) / width)] += 1
    peak = max(counts) or 1
    height = 8
    rows = []
    for r in range(height, 0, -1):
        thr = peak * r / height
        rows.append("".join("#" if c >= thr else " " for c in counts))
    rows.append("-" * bins)
    return "\n".join(rows)


def main():
    rng = random.Random(13)
    T, t_dim, hidden = 40, 8, 24
    _, alphas, alpha_bars = make_schedule(T)
    net = init_net(1, t_dim, hidden, rng)

    print("=== training DDPM on two-mode 1-D mixture ===")
    train(net, alpha_bars, T, steps=4000, lr=0.01, t_dim=t_dim, rng=rng)

    print()
    print("=== sampling ===")
    samples = [sample(net, alphas, alpha_bars, T, t_dim, rng) for _ in range(500)]
    print(histogram(samples))
    m = sum(samples) / len(samples)
    pos = sum(1 for s in samples if s > 0)
    print(f"mean {m:+.3f}, modeA(<0)={500-pos}, modeB(>0)={pos}")

    print()
    print("takeaway: trained noise predictor + reverse chain reproduces both modes.")
    print("          same loss function that scales to images, video, 3D.")


if __name__ == "__main__":
    main()
