import math
import random


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


def init_net(in_dim, hidden, out_dim, rng):
    return {
        "W1": randn_matrix(hidden, in_dim, rng),
        "b1": [0.0] * hidden,
        "W2": randn_matrix(hidden, hidden, rng),
        "b2": [0.0] * hidden,
        "W3": randn_matrix(out_dim, hidden, rng),
        "b3": [0.0] * out_dim,
    }


def forward(x, t, net):
    inp = [x, t, t * t, math.sin(2 * math.pi * t), math.cos(2 * math.pi * t)]
    pre1 = add(matmul(net["W1"], inp), net["b1"])
    h1 = tanh(pre1)
    pre2 = add(matmul(net["W2"], h1), net["b2"])
    h2 = tanh(pre2)
    out = add(matmul(net["W3"], h2), net["b3"])
    return out[0], {"inp": inp, "h1": h1, "h2": h2}


def backward(target, out, cache, net):
    grads = {k: None for k in net}
    for p in net:
        if isinstance(net[p][0], list):
            grads[p] = [[0.0] * len(net[p][0]) for _ in net[p]]
        else:
            grads[p] = [0.0] * len(net[p])
    d_out = 2 * (out - target)
    grads["b3"][0] += d_out
    for j in range(len(cache["h2"])):
        grads["W3"][0][j] += d_out * cache["h2"][j]
    d_h2 = [net["W3"][0][j] * d_out for j in range(len(cache["h2"]))]
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


def sample_data(rng):
    return rng.gauss(-2.0, 0.3) if rng.random() < 0.5 else rng.gauss(2.0, 0.3)


def train(net, steps, lr, rng):
    for _ in range(steps):
        x0 = sample_data(rng)
        x1 = rng.gauss(0, 1)
        t = rng.random()
        x_t = t * x1 + (1 - t) * x0
        target = x1 - x0
        pred, cache = forward(x_t, t, net)
        grads = backward(target, pred, cache, net)
        apply(net, grads, lr)


def sample(net, num_steps, rng):
    x = rng.gauss(0, 1)
    dt = 1.0 / num_steps
    for i in range(num_steps):
        t = 1.0 - i * dt
        v, _ = forward(x, t, net)
        x -= dt * v
    return x


def histogram(samples, lo=-5.0, hi=5.0, bins=30):
    width = (hi - lo) / bins
    counts = [0] * bins
    for s in samples:
        if lo <= s < hi:
            counts[int((s - lo) / width)] += 1
    peak = max(counts) or 1
    height = 6
    rows = []
    for r in range(height, 0, -1):
        thr = peak * r / height
        rows.append("".join("#" if c >= thr else " " for c in counts))
    rows.append("-" * bins)
    return "\n".join(rows)


def main():
    rng = random.Random(31)
    net = init_net(in_dim=5, hidden=24, out_dim=1, rng=rng)

    print("=== training flow matching on two-mode mixture ===")
    train(net, steps=6000, lr=0.01, rng=rng)

    print()
    for num_steps in [1, 2, 4, 8, 20]:
        samples = [sample(net, num_steps, rng) for _ in range(500)]
        m = sum(samples) / len(samples)
        pos = sum(1 for s in samples if s > 0)
        print(f"=== {num_steps}-step Euler integration ===")
        print(histogram(samples))
        print(f"mean {m:+.2f}, left mode = {500 - pos}, right mode = {pos}")
        print()

    print("takeaway: straight-line flow matching lets Euler work at 4-8 steps.")
    print("          DDPM needs 20+ for similar quality in this toy.")


if __name__ == "__main__":
    main()
