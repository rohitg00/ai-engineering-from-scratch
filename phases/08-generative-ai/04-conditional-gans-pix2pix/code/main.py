import math
import random


def sigmoid(x):
    if x >= 0:
        z = math.exp(-x)
        return 1 / (1 + z)
    z = math.exp(x)
    return z / (1 + z)


def leaky(x, a=0.2):
    return x if x > 0 else a * x


def leaky_grad(x, a=0.2):
    return 1.0 if x > 0 else a


def randn_matrix(rows, cols, rng, scale=0.3):
    return [[rng.gauss(0, scale) for _ in range(cols)] for _ in range(rows)]


def matmul(W, x):
    return [sum(w * xi for w, xi in zip(row, x)) for row in W]


def add(a, b):
    return [x + y for x, y in zip(a, b)]


def one_hot(c, num):
    v = [0.0] * num
    v[c] = 1.0
    return v


def init_mlp(in_dim, hidden, out_dim, rng):
    return {
        "W1": randn_matrix(hidden, in_dim, rng),
        "b1": [0.0] * hidden,
        "W2": randn_matrix(out_dim, hidden, rng),
        "b2": [0.0] * out_dim,
    }


def g_forward(z, c, G, num_classes):
    inp = z + one_hot(c, num_classes)
    pre1 = add(matmul(G["W1"], inp), G["b1"])
    h = [leaky(v) for v in pre1]
    out = add(matmul(G["W2"], h), G["b2"])
    return out, h, pre1, inp


def d_forward(x, c, D, num_classes):
    inp = x + one_hot(c, num_classes)
    pre1 = add(matmul(D["W1"], inp), D["b1"])
    h = [leaky(v) for v in pre1]
    logit = add(matmul(D["W2"], h), D["b2"])[0]
    return sigmoid(logit), h, pre1, inp, logit


def sample_real_conditional(n, num_classes, rng):
    out = []
    for _ in range(n):
        c = rng.randrange(num_classes)
        if c == 0:
            x = rng.gauss(-2.0, 0.3)
        else:
            x = rng.gauss(2.0, 0.3)
        out.append(([x], c))
    return out


def update_d(reals, fakes, D, num_classes, lr):
    grads = init_grads(D)
    for (x, c) in reals:
        accumulate_d_grad(x, c, 1.0, D, num_classes, grads)
    for (x, c) in fakes:
        accumulate_d_grad(x, c, 0.0, D, num_classes, grads)
    n = len(reals) + len(fakes)
    apply_grads(D, grads, lr, n)


def accumulate_d_grad(x, c, target, D, num_classes, grads):
    p, h, pre1, inp, _ = d_forward(x, c, D, num_classes)
    dL_dpre2 = p - target
    grads["b2"][0] += dL_dpre2
    for j in range(len(h)):
        grads["W2"][0][j] += dL_dpre2 * h[j]
    dh = [D["W2"][0][j] * dL_dpre2 for j in range(len(h))]
    dpre1 = [dh[j] * leaky_grad(pre1[j]) for j in range(len(h))]
    for j in range(len(h)):
        grads["b1"][j] += dpre1[j]
        for k in range(len(inp)):
            grads["W1"][j][k] += dpre1[j] * inp[k]


def update_g(noise, cs, G, D, num_classes, lr, l1_w=0.0, targets=None):
    """Non-saturating G loss + optional conditional L1 toward a target."""
    grads = init_grads(G)
    for i, z in enumerate(noise):
        c = cs[i]
        x_hat, g_h, g_pre1, g_inp = g_forward(z, c, G, num_classes)
        p, d_h, d_pre1, d_inp, d_logit = d_forward(x_hat, c, D, num_classes)
        dL_dpre2 = p - 1.0
        dh_D = [D["W2"][0][j] * dL_dpre2 for j in range(len(d_h))]
        dpre1_D = [dh_D[j] * leaky_grad(d_pre1[j]) for j in range(len(d_h))]
        dL_dxhat = [0.0] * len(x_hat)
        for j in range(len(d_h)):
            for k in range(len(x_hat)):
                dL_dxhat[k] += D["W1"][j][k] * dpre1_D[j]
        if l1_w > 0 and targets is not None:
            for k in range(len(x_hat)):
                dL_dxhat[k] += l1_w * (1.0 if x_hat[k] > targets[i][k] else -1.0)
        grads["b2"] = [grads["b2"][i] + dL_dxhat[i] for i in range(len(x_hat))]
        for a in range(len(x_hat)):
            for b in range(len(g_h)):
                grads["W2"][a][b] += dL_dxhat[a] * g_h[b]
        dh_G = [sum(G["W2"][a][b] * dL_dxhat[a] for a in range(len(x_hat)))
                for b in range(len(g_h))]
        dpre1_G = [dh_G[j] * leaky_grad(g_pre1[j]) for j in range(len(g_h))]
        for j in range(len(g_h)):
            grads["b1"][j] += dpre1_G[j]
            for k in range(len(g_inp)):
                grads["W1"][j][k] += dpre1_G[j] * g_inp[k]
    apply_grads(G, grads, lr, len(noise))


def init_grads(net):
    grads = {}
    for k, v in net.items():
        if isinstance(v[0], list):
            grads[k] = [[0.0] * len(v[0]) for _ in v]
        else:
            grads[k] = [0.0] * len(v)
    return grads


def apply_grads(net, grads, lr, n):
    for k, v in net.items():
        if isinstance(v[0], list):
            for i in range(len(v)):
                for j in range(len(v[i])):
                    v[i][j] -= lr * grads[k][i][j] / n
        else:
            for i in range(len(v)):
                v[i] -= lr * grads[k][i] / n


def mean(xs):
    return sum(xs) / max(len(xs), 1)


def main():
    rng = random.Random(5)
    num_classes, z_dim, hidden = 2, 4, 16
    G = init_mlp(z_dim + num_classes, hidden, 1, rng)
    D = init_mlp(1 + num_classes, hidden, 1, rng)

    batch, g_lr, d_lr = 32, 0.02, 0.01
    print("=== conditional GAN on two-mode mixture (class 0 -> -2, class 1 -> +2) ===")
    for step in range(1, 601):
        reals = sample_real_conditional(batch, num_classes, rng)
        cs = [c for _, c in reals]
        noise = [[rng.gauss(0, 1) for _ in range(z_dim)] for _ in range(batch)]
        fakes = [(g_forward(noise[i], cs[i], G, num_classes)[0], cs[i]) for i in range(batch)]
        update_d(reals, fakes, D, num_classes, d_lr)

        noise = [[rng.gauss(0, 1) for _ in range(z_dim)] for _ in range(batch)]
        cs = [rng.randrange(num_classes) for _ in range(batch)]
        update_g(noise, cs, G, D, num_classes, g_lr)

        if step % 150 == 0:
            probes = {c: [] for c in range(num_classes)}
            for _ in range(300):
                c = rng.randrange(num_classes)
                z = [rng.gauss(0, 1) for _ in range(z_dim)]
                probes[c].append(g_forward(z, c, G, num_classes)[0][0])
            line = f"step {step:4d}:"
            for c in range(num_classes):
                line += f"  class {c}: mean {mean(probes[c]):+.2f}  (n={len(probes[c])})"
            print(line)

    print()
    print("=== sampling per class ===")
    for c in range(num_classes):
        z_batch = [[rng.gauss(0, 1) for _ in range(z_dim)] for _ in range(6)]
        outs = [g_forward(z, c, G, num_classes)[0][0] for z in z_batch]
        print(f"  class {c}: " + " ".join(f"{v:+.2f}" for v in outs))

    print()
    print("takeaway: G(z, c) learns a class-specific sampler.")
    print("          same architecture, one extra input, totally different samples.")


if __name__ == "__main__":
    main()
