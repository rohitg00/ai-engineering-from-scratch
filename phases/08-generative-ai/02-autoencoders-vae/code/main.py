import math
import random


def matmul(W, x):
    return [sum(w * xi for w, xi in zip(row, x)) for row in W]


def add(a, b):
    return [x + y for x, y in zip(a, b)]


def tanh(v):
    return [math.tanh(x) for x in v]


def tanh_grad(h):
    return [1 - x * x for x in h]


def randn_matrix(rows, cols, rng, scale=0.2):
    return [[rng.gauss(0, scale) for _ in range(cols)] for _ in range(rows)]


def init_vae(in_dim, hidden, z_dim, rng):
    return {
        "enc": {
            "W1": randn_matrix(hidden, in_dim, rng),
            "b1": [0.0] * hidden,
            "W_mu": randn_matrix(z_dim, hidden, rng),
            "b_mu": [0.0] * z_dim,
            "W_sig": randn_matrix(z_dim, hidden, rng),
            "b_sig": [0.0] * z_dim,
        },
        "dec": {
            "W1": randn_matrix(hidden, z_dim, rng),
            "b1": [0.0] * hidden,
            "W_out": randn_matrix(in_dim, hidden, rng),
            "b_out": [0.0] * in_dim,
        },
    }


def clamp(v, lo, hi):
    return [max(lo, min(hi, x)) for x in v]


def forward(x, params, eps):
    """Forward pass with a fixed epsilon for the reparameterization."""
    enc, dec = params["enc"], params["dec"]
    h_enc = tanh(add(matmul(enc["W1"], x), enc["b1"]))
    mu = add(matmul(enc["W_mu"], h_enc), enc["b_mu"])
    log_sigma2 = clamp(add(matmul(enc["W_sig"], h_enc), enc["b_sig"]), -6, 6)
    sigma = [math.exp(0.5 * lv) for lv in log_sigma2]
    z = [m + s * e for m, s, e in zip(mu, sigma, eps)]
    h_dec = tanh(add(matmul(dec["W1"], z), dec["b1"]))
    x_hat = add(matmul(dec["W_out"], h_dec), dec["b_out"])
    return {
        "h_enc": h_enc, "mu": mu, "log_sigma2": log_sigma2,
        "sigma": sigma, "z": z, "h_dec": h_dec, "x_hat": x_hat,
    }


def loss_value(x, fwd, beta):
    recon = sum((a - b) ** 2 for a, b in zip(x, fwd["x_hat"]))
    kl = 0.5 * sum(math.exp(lv) + m * m - lv - 1
                   for m, lv in zip(fwd["mu"], fwd["log_sigma2"]))
    return recon + beta * kl, recon, kl


def backward(x, fwd, params, beta):
    """Hand-written backprop. Returns gradient dict matching params shape."""
    enc, dec = params["enc"], params["dec"]
    mu, log_sigma2, sigma = fwd["mu"], fwd["log_sigma2"], fwd["sigma"]
    z, h_dec, h_enc = fwd["z"], fwd["h_dec"], fwd["h_enc"]
    x_hat = fwd["x_hat"]

    grads = {"enc": {}, "dec": {}}

    # d recon / d x_hat = 2(x_hat - x)
    d_x_hat = [2 * (a - b) for a, b in zip(x_hat, x)]

    # decoder: x_hat = W_out @ h_dec + b_out
    grads["dec"]["b_out"] = d_x_hat[:]
    grads["dec"]["W_out"] = [[d * h for h in h_dec] for d in d_x_hat]

    # d loss / d h_dec = W_out^T @ d_x_hat
    d_h_dec = [sum(dec["W_out"][i][j] * d_x_hat[i] for i in range(len(d_x_hat)))
               for j in range(len(h_dec))]
    # through tanh
    d_pre_dec = [dg * g for dg, g in zip(d_h_dec, tanh_grad(h_dec))]
    grads["dec"]["b1"] = d_pre_dec[:]
    grads["dec"]["W1"] = [[d * zi for zi in z] for d in d_pre_dec]

    # d loss / d z = W1_dec^T @ d_pre_dec
    d_z = [sum(dec["W1"][i][j] * d_pre_dec[i] for i in range(len(d_pre_dec)))
           for j in range(len(z))]

    # reparameterization: z = mu + sigma * eps, sigma = exp(0.5 * log_sigma2)
    # d z / d mu = 1, d z / d log_sigma2 = 0.5 * sigma * eps
    d_mu_recon = d_z[:]
    eps_used = [(z[i] - mu[i]) / max(sigma[i], 1e-8) for i in range(len(z))]
    d_lv_recon = [0.5 * d_z[i] * sigma[i] * eps_used[i] for i in range(len(z))]

    # KL term: 0.5 * sum(exp(lv) + mu^2 - lv - 1)
    # d KL / d mu = mu ; d KL / d lv = 0.5 * (exp(lv) - 1)
    d_mu = [d_mu_recon[i] + beta * mu[i] for i in range(len(mu))]
    d_lv = [d_lv_recon[i] + beta * 0.5 * (math.exp(log_sigma2[i]) - 1)
            for i in range(len(mu))]

    grads["enc"]["b_mu"] = d_mu[:]
    grads["enc"]["W_mu"] = [[d * h for h in h_enc] for d in d_mu]
    grads["enc"]["b_sig"] = d_lv[:]
    grads["enc"]["W_sig"] = [[d * h for h in h_enc] for d in d_lv]

    # d loss / d h_enc from both mu and log_sigma2 paths
    d_h_enc = [0.0] * len(h_enc)
    for j in range(len(h_enc)):
        for i in range(len(d_mu)):
            d_h_enc[j] += enc["W_mu"][i][j] * d_mu[i]
            d_h_enc[j] += enc["W_sig"][i][j] * d_lv[i]
    d_pre_enc = [dg * g for dg, g in zip(d_h_enc, tanh_grad(h_enc))]
    grads["enc"]["b1"] = d_pre_enc[:]
    grads["enc"]["W1"] = [[d * xi for xi in x] for d in d_pre_enc]
    return grads


def apply_update(params, grads, lr):
    for part in ("enc", "dec"):
        for name, tensor in params[part].items():
            g = grads[part][name]
            if isinstance(tensor[0], list):
                for i, row in enumerate(tensor):
                    for j in range(len(row)):
                        row[j] -= lr * g[i][j]
            else:
                for i in range(len(tensor)):
                    tensor[i] -= lr * g[i]


def sample_mixture(n, d, rng):
    data = []
    for _ in range(n):
        if rng.random() < 0.5:
            center = [1.0] * (d // 2) + [-1.0] * (d - d // 2)
        else:
            center = [-1.0] * (d // 2) + [1.0] * (d - d // 2)
        data.append([c + rng.gauss(0, 0.2) for c in center])
    return data


def mean(xs):
    return sum(xs) / max(len(xs), 1)


def main():
    rng = random.Random(7)
    in_dim, hidden, z_dim = 8, 10, 2
    params = init_vae(in_dim, hidden, z_dim, rng)
    data = sample_mixture(60, in_dim, rng)

    beta = 0.2
    lr = 0.01
    print(f"=== training tiny VAE: {in_dim}-D input, {z_dim}-D latent, beta={beta} ===")
    for epoch in range(40):
        losses, recons, kls = [], [], []
        for x in data:
            eps = [rng.gauss(0, 1) for _ in range(z_dim)]
            fwd = forward(x, params, eps)
            total, recon, kl = loss_value(x, fwd, beta)
            grads = backward(x, fwd, params, beta)
            apply_update(params, grads, lr)
            losses.append(total); recons.append(recon); kls.append(kl)
        if (epoch + 1) % 5 == 0:
            print(f"epoch {epoch+1:2d}: loss {mean(losses):.3f}  recon {mean(recons):.3f}  KL {mean(kls):.3f}")

    print()
    print("=== reconstruction on held-out sample ===")
    x_test = sample_mixture(1, in_dim, rng)[0]
    eps = [0.0] * z_dim
    fwd = forward(x_test, params, eps)
    mse = sum((a - b) ** 2 for a, b in zip(x_test, fwd["x_hat"]))
    print("  x     =", [f"{v:+.2f}" for v in x_test])
    print("  x_hat =", [f"{v:+.2f}" for v in fwd["x_hat"]])
    print(f"  mse = {mse:.3f}")

    print()
    print("=== samples from N(0, I) through decoder ===")
    for _ in range(4):
        z = [rng.gauss(0, 1) for _ in range(z_dim)]
        h = tanh(add(matmul(params["dec"]["W1"], z), params["dec"]["b1"]))
        x_hat = add(matmul(params["dec"]["W_out"], h), params["dec"]["b_out"])
        print(f"  z={[f'{zi:+.2f}' for zi in z]}  ->  x_hat={[f'{v:+.2f}' for v in x_hat]}")

    print()
    print("takeaway: decoder turns N(0, I) samples into structured 8-D vectors")
    print("          that resemble the two-cluster training data.")


if __name__ == "__main__":
    main()
