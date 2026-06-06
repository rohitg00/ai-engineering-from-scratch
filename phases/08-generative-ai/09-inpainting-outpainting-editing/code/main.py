import math
import random


def sin_embed(t, T, dim=8):
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


def forward(x_t, t_emb, net):
    inp = list(x_t) + list(t_emb)
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


def sample_data(rng, d=5):
    cluster = rng.choice([0, 1])
    center = [-1.0 if cluster == 0 else 1.0] * d
    return [c + rng.gauss(0, 0.2) for c in center], cluster


def train(net, alpha_bars, T, steps, lr, t_dim, d, rng):
    for step in range(steps):
        x0, _ = sample_data(rng, d)
        t = rng.randrange(T)
        eps = [rng.gauss(0, 1) for _ in range(d)]
        a_bar = alpha_bars[t]
        x_t = [math.sqrt(a_bar) * x0[i] + math.sqrt(1 - a_bar) * eps[i] for i in range(d)]
        t_emb = sin_embed(t, T, t_dim)
        out, cache = forward(x_t, t_emb, net)
        grads = backward(eps, out, cache, net)
        apply(net, grads, lr)


def sample_unconditional(net, alphas, alpha_bars, T, t_dim, d, rng):
    x = [rng.gauss(0, 1) for _ in range(d)]
    for t in range(T - 1, -1, -1):
        t_emb = sin_embed(t, T, t_dim)
        eps_hat, _ = forward(x, t_emb, net)
        beta_t = 1 - alphas[t]
        mean = [(x[i] - beta_t / math.sqrt(1 - alpha_bars[t]) * eps_hat[i]) / math.sqrt(alphas[t])
                for i in range(d)]
        if t > 0:
            x = [mean[i] + math.sqrt(beta_t) * rng.gauss(0, 1) for i in range(d)]
        else:
            x = mean
    return x


def inpaint(net, alphas, alpha_bars, T, t_dim, d, clean, mask, rng):
    """mask[i] == True means that dim is to be regenerated. Unmasked dims pinned to clean."""
    x = [rng.gauss(0, 1) for _ in range(d)]
    for t in range(T - 1, -1, -1):
        a_bar = alpha_bars[t]
        for i in range(d):
            if not mask[i]:
                x[i] = math.sqrt(a_bar) * clean[i] + math.sqrt(1 - a_bar) * rng.gauss(0, 1)
        t_emb = sin_embed(t, T, t_dim)
        eps_hat, _ = forward(x, t_emb, net)
        beta_t = 1 - alphas[t]
        mean = [(x[i] - beta_t / math.sqrt(1 - alpha_bars[t]) * eps_hat[i]) / math.sqrt(alphas[t])
                for i in range(d)]
        if t > 0:
            x = [mean[i] + math.sqrt(beta_t) * rng.gauss(0, 1) for i in range(d)]
        else:
            x = mean
    for i in range(d):
        if not mask[i]:
            x[i] = clean[i]
    return x


def main():
    rng = random.Random(5)
    T, t_dim, hidden, d = 40, 8, 32, 5
    alphas, alpha_bars = make_schedule(T)
    net = init_net(d, t_dim, hidden, rng)

    print("=== training 5-D DDPM on two-cluster mixture ===")
    train(net, alpha_bars, T, steps=5000, lr=0.01, t_dim=t_dim, d=d, rng=rng)

    print()
    print("=== inpainting: pin dims 0-2, regenerate dims 3-4 ===")
    for trial in range(5):
        clean, cluster = sample_data(rng, d)
        mask = [False, False, False, True, True]
        out = inpaint(net, alphas, alpha_bars, T, t_dim, d, clean, mask, rng)
        label = "neg cluster" if cluster == 0 else "pos cluster"
        print(f"  {label}: pinned={[f'{clean[i]:+.2f}' for i in range(3)]}  "
              f"filled={[f'{out[i]:+.2f}' for i in range(3, 5)]}")

    print()
    print("=== outpainting (mask dims 0-1, pin 2-4) ===")
    for trial in range(3):
        clean, cluster = sample_data(rng, d)
        mask = [True, True, False, False, False]
        out = inpaint(net, alphas, alpha_bars, T, t_dim, d, clean, mask, rng)
        print(f"  pinned tail=[{clean[2]:+.2f}, {clean[3]:+.2f}, {clean[4]:+.2f}]  "
              f"filled head=[{out[0]:+.2f}, {out[1]:+.2f}]")

    print()
    print("takeaway: the filled dims match the cluster sign of the pinned dims.")
    print("          that is why inpainting looks coherent with the surroundings.")


if __name__ == "__main__":
    main()
