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


def one_hot(c, num):
    v = [0.0] * num
    v[c] = 1.0
    return v


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


NULL_CLASS = 2


def init_net(x_dim, t_dim, c_dim, hidden, rng):
    return {
        "W1": randn_matrix(hidden, x_dim + t_dim + c_dim, rng),
        "b1": [0.0] * hidden,
        "W2": randn_matrix(hidden, hidden, rng),
        "b2": [0.0] * hidden,
        "W3": randn_matrix(x_dim, hidden, rng),
        "b3": [0.0] * x_dim,
    }


def forward(x_t, t_emb, c_emb, net):
    inp = x_t + t_emb + c_emb
    pre1 = add(matmul(net["W1"], inp), net["b1"])
    h1 = tanh(pre1)
    pre2 = add(matmul(net["W2"], h1), net["b2"])
    h2 = tanh(pre2)
    out = add(matmul(net["W3"], h2), net["b3"])
    return out, {"inp": inp, "h1": h1, "h2": h2}


def backward(target, out, cache, net):
    grads = {k: None for k in net}
    for part in net:
        if isinstance(net[part][0], list):
            grads[part] = [[0.0] * len(net[part][0]) for _ in net[part]]
        else:
            grads[part] = [0.0] * len(net[part])
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


def encode(x):
    return x * 0.5


def decode(z):
    return z * 2.0


def sample_data(rng):
    c = rng.randrange(2)
    x = rng.gauss(-2.0 if c == 0 else 2.0, 0.4)
    return x, c


def main():
    rng = random.Random(11)
    T, t_dim, hidden = 40, 8, 32
    num_classes_inc_null = 3
    alphas, alpha_bars = make_schedule(T)
    net = init_net(1, t_dim, num_classes_inc_null, hidden, rng)

    print("=== training class-conditional latent diffusion with CFG dropout ===")
    for step in range(4000):
        x0, c = sample_data(rng)
        z0 = encode(x0)
        t = rng.randrange(T)
        eps = rng.gauss(0, 1)
        z_t = math.sqrt(alpha_bars[t]) * z0 + math.sqrt(1 - alpha_bars[t]) * eps
        use_c = NULL_CLASS if rng.random() < 0.1 else c
        c_emb = one_hot(use_c, num_classes_inc_null)
        t_emb = sin_embed(t, T, t_dim)
        out, cache = forward([z_t], t_emb, c_emb, net)
        grads = backward([eps], out, cache, net)
        apply(net, grads, 0.01)
        if (step + 1) % 1000 == 0:
            print(f"  step {step+1:5d}")

    def sample(c_target, w):
        z = rng.gauss(0, 1)
        for t in range(T - 1, -1, -1):
            t_emb = sin_embed(t, T, t_dim)
            eps_c, _ = forward([z], t_emb, one_hot(c_target, num_classes_inc_null), net)
            eps_u, _ = forward([z], t_emb, one_hot(NULL_CLASS, num_classes_inc_null), net)
            eps_cfg = (1 + w) * eps_c[0] - w * eps_u[0]
            beta_t = 1 - alphas[t]
            mean = (z - beta_t / math.sqrt(1 - alpha_bars[t]) * eps_cfg) / math.sqrt(alphas[t])
            if t > 0:
                z = mean + math.sqrt(beta_t) * rng.gauss(0, 1)
            else:
                z = mean
        return decode(z)

    print()
    print("=== CFG sweep: per-class mean over 200 samples ===")
    for w in [0.0, 1.0, 3.0, 7.0]:
        samples = {0: [], 1: []}
        for _ in range(200):
            c = rng.randrange(2)
            samples[c].append(sample(c, w))
        m0 = sum(samples[0]) / len(samples[0])
        m1 = sum(samples[1]) / len(samples[1])
        print(f"  w={w:.1f}: class 0 mean {m0:+.2f}  class 1 mean {m1:+.2f}")

    print()
    print("takeaway: same DDPM loss, just running on encoded z.")
    print("          CFG scales conditioning strength without retraining.")


if __name__ == "__main__":
    main()
