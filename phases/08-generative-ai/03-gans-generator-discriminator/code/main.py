import math
import random


def sigmoid(x):
    if x >= 0:
        z = math.exp(-x)
        return 1 / (1 + z)
    z = math.exp(x)
    return z / (1 + z)


def leaky_relu(x, a=0.2):
    return x if x > 0 else a * x


def leaky_grad(x, a=0.2):
    return 1.0 if x > 0 else a


def randn_matrix(rows, cols, rng, scale=0.3):
    return [[rng.gauss(0, scale) for _ in range(cols)] for _ in range(rows)]


def matmul(W, x):
    return [sum(w * xi for w, xi in zip(row, x)) for row in W]


def add(a, b):
    return [x + y for x, y in zip(a, b)]


def init_mlp(in_dim, hidden, out_dim, rng):
    return {
        "W1": randn_matrix(hidden, in_dim, rng),
        "b1": [0.0] * hidden,
        "W2": randn_matrix(out_dim, hidden, rng),
        "b2": [0.0] * out_dim,
    }


def forward_g(z, G):
    pre1 = add(matmul(G["W1"], z), G["b1"])
    h = [leaky_relu(v) for v in pre1]
    pre2 = add(matmul(G["W2"], h), G["b2"])
    return pre2, h, pre1


def forward_d(x, D):
    pre1 = add(matmul(D["W1"], x), D["b1"])
    h = [leaky_relu(v) for v in pre1]
    pre2 = add(matmul(D["W2"], h), D["b2"])
    return sigmoid(pre2[0]), h, pre1, pre2[0]


def sample_real(n, rng):
    out = []
    for _ in range(n):
        if rng.random() < 0.5:
            out.append([rng.gauss(-2.0, 0.4)])
        else:
            out.append([rng.gauss(2.0, 0.4)])
    return out


def sample_noise(n, z_dim, rng):
    return [[rng.gauss(0, 1) for _ in range(z_dim)] for _ in range(n)]


def update_d(reals, fakes, D, lr):
    """Gradient step on D to maximize log D(x) + log(1 - D(G(z)))."""
    grads = {k: None for k in D}
    for part in D:
        if isinstance(D[part][0], list):
            grads[part] = [[0.0] * len(D[part][0]) for _ in D[part]]
        else:
            grads[part] = [0.0] * len(D[part])

    def accumulate(x, target):
        p, h, pre1, pre2 = forward_d(x, D)
        dL_dpre2 = p - target
        grads["b2"][0] += dL_dpre2
        for j in range(len(h)):
            grads["W2"][0][j] += dL_dpre2 * h[j]
        dh = [D["W2"][0][j] * dL_dpre2 for j in range(len(h))]
        dpre1 = [dh[j] * leaky_grad(pre1[j]) for j in range(len(h))]
        for j in range(len(h)):
            grads["b1"][j] += dpre1[j]
            for k in range(len(x)):
                grads["W1"][j][k] += dpre1[j] * x[k]

    for x in reals:
        accumulate(x, 1.0)
    for x in fakes:
        accumulate(x, 0.0)

    n = len(reals) + len(fakes)
    for part in D:
        if isinstance(D[part][0], list):
            for i in range(len(D[part])):
                for j in range(len(D[part][i])):
                    D[part][i][j] -= lr * grads[part][i][j] / n
        else:
            for i in range(len(D[part])):
                D[part][i] -= lr * grads[part][i] / n


def update_g(noise_batch, G, D, lr):
    """Non-saturating G loss: maximize log D(G(z)). Gradient flows through both."""
    grads = {k: None for k in G}
    for part in G:
        if isinstance(G[part][0], list):
            grads[part] = [[0.0] * len(G[part][0]) for _ in G[part]]
        else:
            grads[part] = [0.0] * len(G[part])

    for z in noise_batch:
        x_hat, g_h, g_pre1 = forward_g(z, G)
        p, d_h, d_pre1, d_pre2 = forward_d(x_hat, D)
        # dL/dpre2_D where L = -log(p) is -(1/p) * p*(1-p) = p - 1
        dL_dpre2 = p - 1.0
        # back through D to get dL / d x_hat
        dh_D = [D["W2"][0][j] * dL_dpre2 for j in range(len(d_h))]
        dpre1_D = [dh_D[j] * leaky_grad(d_pre1[j]) for j in range(len(d_h))]
        dL_dxhat = [0.0] * len(x_hat)
        for j in range(len(d_h)):
            for k in range(len(x_hat)):
                dL_dxhat[k] += D["W1"][j][k] * dpre1_D[j]
        # now back through G
        grads["b2"] = [grads["b2"][i] + dL_dxhat[i] for i in range(len(x_hat))]
        for i in range(len(x_hat)):
            for j in range(len(g_h)):
                grads["W2"][i][j] += dL_dxhat[i] * g_h[j]
        dh_G = [sum(G["W2"][i][j] * dL_dxhat[i] for i in range(len(x_hat)))
                for j in range(len(g_h))]
        dpre1_G = [dh_G[j] * leaky_grad(g_pre1[j]) for j in range(len(g_h))]
        for j in range(len(g_h)):
            grads["b1"][j] += dpre1_G[j]
            for k in range(len(z)):
                grads["W1"][j][k] += dpre1_G[j] * z[k]

    n = len(noise_batch)
    for part in G:
        if isinstance(G[part][0], list):
            for i in range(len(G[part])):
                for j in range(len(G[part][i])):
                    G[part][i][j] -= lr * grads[part][i][j] / n
        else:
            for i in range(len(G[part])):
                G[part][i] -= lr * grads[part][i] / n


def mean(xs):
    return sum(xs) / max(len(xs), 1)


def main():
    rng = random.Random(1)
    z_dim, hidden = 4, 16
    G = init_mlp(z_dim, hidden, 1, rng)
    D = init_mlp(1, hidden, 1, rng)

    batch, g_lr, d_lr = 32, 0.02, 0.01
    print("=== training 1-D GAN on two-mode Gaussian mixture ===")
    for step in range(1, 801):
        reals = sample_real(batch, rng)
        noise = sample_noise(batch, z_dim, rng)
        fakes = [forward_g(z, G)[0] for z in noise]
        update_d(reals, fakes, D, d_lr)

        noise = sample_noise(batch, z_dim, rng)
        update_g(noise, G, D, g_lr)

        if step % 100 == 0:
            probe_fakes = [forward_g(z, G)[0][0] for z in sample_noise(400, z_dim, rng)]
            mode_a = sum(1 for v in probe_fakes if v < 0)
            mode_b = 400 - mode_a
            d_real = mean([forward_d(x, D)[0] for x in sample_real(100, rng)])
            d_fake = mean([forward_d([v], D)[0] for v in probe_fakes])
            warn = "  [!] mode collapse" if min(mode_a, mode_b) < 50 else ""
            print(f"step {step:4d}: D(real)={d_real:.2f}  D(fake)={d_fake:.2f}  "
                  f"modeA={mode_a:3d}  modeB={mode_b:3d}{warn}")

    print()
    print("=== final 10 generator samples ===")
    for z in sample_noise(10, z_dim, rng):
        print(f"  G(z) = {forward_g(z, G)[0][0]:+.2f}")


if __name__ == "__main__":
    main()
