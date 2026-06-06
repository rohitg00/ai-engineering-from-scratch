import math
import random


def leaky(x, a=0.2):
    return x if x > 0 else a * x


def randn_matrix(rows, cols, rng, scale=0.3):
    return [[rng.gauss(0, scale) for _ in range(cols)] for _ in range(rows)]


def matmul(W, x):
    return [sum(w * xi for w, xi in zip(row, x)) for row in W]


def add(a, b):
    return [x + y for x, y in zip(a, b)]


def mean_std(xs):
    m = sum(xs) / len(xs)
    v = sum((x - m) ** 2 for x in xs) / len(xs)
    return m, math.sqrt(v + 1e-8)


def adain(features, scale, bias):
    m, s = mean_std(features)
    return [scale * (f - m) / s + bias for f in features]


def mapping(z, layers):
    h = z
    for W, b in layers:
        pre = add(matmul(W, h), b)
        h = [leaky(x) for x in pre]
    return h


def init_mapping(z_dim, w_dim, depth, rng):
    layers = []
    dims = [z_dim] + [w_dim] * depth
    for i in range(depth):
        layers.append((randn_matrix(dims[i + 1], dims[i], rng), [0.0] * dims[i + 1]))
    return layers


def stylegan_forward(w, const, synth, noise_sigma, rng, adain_on=True):
    """Very small 'synthesis' network: three resolution blocks on a 4-channel constant."""
    h = list(const)
    for i in range(3):
        W = synth[f"W{i}"]
        b = synth[f"b{i}"]
        pre = add(matmul(W, h), b)
        h = [leaky(x) for x in pre]
        if adain_on:
            scale = sum(synth[f"scale{i}"][j] * w[j] for j in range(len(w)))
            bias = sum(synth[f"bias{i}"][j] * w[j] for j in range(len(w)))
            h = adain(h, scale, bias)
        if noise_sigma > 0:
            h = [x + noise_sigma * rng.gauss(0, 1) for x in h]
    return h


def init_synth(hidden, w_dim, rng):
    synth = {}
    for i in range(3):
        synth[f"W{i}"] = randn_matrix(hidden, hidden, rng)
        synth[f"b{i}"] = [0.0] * hidden
        synth[f"scale{i}"] = [rng.gauss(0, 0.3) for _ in range(w_dim)]
        synth[f"bias{i}"] = [rng.gauss(0, 0.3) for _ in range(w_dim)]
    return synth


def main():
    rng = random.Random(3)
    z_dim, w_dim, hidden = 8, 8, 6

    mapping_net = init_mapping(z_dim, w_dim, depth=4, rng=rng)
    synth = init_synth(hidden, w_dim, rng)
    const = [rng.gauss(0, 0.3) for _ in range(hidden)]

    print("=== compare: style inputs via AdaIN vs no AdaIN ===")
    print("sample 5 random z, look at std of output under each mode")

    for mode in [True, False]:
        outs = []
        for _ in range(5):
            z = [rng.gauss(0, 1) for _ in range(z_dim)]
            w = mapping(z, mapping_net)
            h = stylegan_forward(w, const, synth, 0.0, rng, adain_on=mode)
            outs.append(h)
        flat = [v for row in outs for v in row]
        m, s = mean_std(flat)
        label = "with AdaIN" if mode else "no AdaIN  "
        print(f"  {label}: mean {m:+.3f}  std {s:.3f}")

    print()
    print("=== truncation trick: sample many w, take mean, interpolate ===")
    ws = []
    for _ in range(200):
        z = [rng.gauss(0, 1) for _ in range(z_dim)]
        ws.append(mapping(z, mapping_net))
    w_bar = [sum(w[i] for w in ws) / len(ws) for i in range(w_dim)]

    z_test = [rng.gauss(0, 1) for _ in range(z_dim)]
    w_test = mapping(z_test, mapping_net)

    for psi in [0.0, 0.5, 0.7, 1.0]:
        w_psi = [w_bar[i] + psi * (w_test[i] - w_bar[i]) for i in range(w_dim)]
        h = stylegan_forward(w_psi, const, synth, 0.0, rng, adain_on=True)
        print(f"  psi={psi:.1f}: output = {[f'{v:+.2f}' for v in h]}")

    print()
    print("=== per-layer noise injection (pose fixed, stochastic detail changes) ===")
    z_fixed = [rng.gauss(0, 1) for _ in range(z_dim)]
    w_fixed = mapping(z_fixed, mapping_net)
    for seed in range(3):
        rng_local = random.Random(seed)
        h = stylegan_forward(w_fixed, const, synth, 0.1, rng_local, adain_on=True)
        print(f"  seed {seed}: {[f'{v:+.2f}' for v in h]}")

    print()
    print("notice: with the same w, outputs vary slightly with noise seed.")
    print("         that is the stochastic-detail vs global-style split.")


if __name__ == "__main__":
    main()
