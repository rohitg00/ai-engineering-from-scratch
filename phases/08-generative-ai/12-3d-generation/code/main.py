import math
import random


SIZE = 12  # small image grid for speed


def make_target(size):
    """Target: a smooth bright blob in the upper-left, dimmer one in the lower-right."""
    target = [[0.0] * size for _ in range(size)]
    for y in range(size):
        for x in range(size):
            d1 = ((x - 3) ** 2 + (y - 3) ** 2) / 6.0
            d2 = ((x - 8) ** 2 + (y - 8) ** 2) / 8.0
            target[y][x] = math.exp(-d1) + 0.5 * math.exp(-d2)
    return target


def init_gaussians(n, rng):
    return [{
        "pos": [rng.uniform(2, SIZE - 2), rng.uniform(2, SIZE - 2)],
        "sigma": rng.uniform(0.8, 2.5),
        "color": rng.uniform(0.2, 0.8),
    } for _ in range(n)]


def gaussian_value(x, y, g):
    dx = x - g["pos"][0]
    dy = y - g["pos"][1]
    d2 = dx * dx + dy * dy
    return g["color"] * math.exp(-d2 / (2 * g["sigma"] ** 2))


def render(gaussians):
    img = [[0.0] * SIZE for _ in range(SIZE)]
    for y in range(SIZE):
        for x in range(SIZE):
            for g in gaussians:
                img[y][x] += gaussian_value(x, y, g)
    return img


def mse(a, b):
    total = 0.0
    for y in range(SIZE):
        for x in range(SIZE):
            total += (a[y][x] - b[y][x]) ** 2
    return total / (SIZE * SIZE)


def finite_diff_step(gaussians, target, lr, eps=0.1):
    base = render(gaussians)
    base_loss = mse(base, target)
    for g in gaussians:
        for key in ("pos", "sigma", "color"):
            if isinstance(g[key], list):
                for i in range(len(g[key])):
                    g[key][i] += eps
                    up = mse(render(gaussians), target)
                    g[key][i] -= eps
                    grad = (up - base_loss) / eps
                    g[key][i] -= lr * grad
            else:
                g[key] += eps
                up = mse(render(gaussians), target)
                g[key] -= eps
                grad = (up - base_loss) / eps
                g[key] -= lr * grad
    return base_loss


def ascii_img(img, chars=" .:;+*#@"):
    peak = max(max(row) for row in img) or 1.0
    lines = []
    for row in img:
        line = "".join(chars[min(len(chars) - 1, int(v / peak * (len(chars) - 1)))]
                       for v in row)
        lines.append(line)
    return "\n".join(lines)


def main():
    rng = random.Random(23)
    target = make_target(SIZE)

    print("=== target image ===")
    print(ascii_img(target))
    print()

    for n in [2, 4, 8]:
        rng_local = random.Random(7 + n)
        gaussians = init_gaussians(n, rng_local)
        print(f"=== fit {n} Gaussians ===")
        for step in range(30):
            loss = finite_diff_step(gaussians, target, lr=0.5, eps=0.2)
        print(f"final loss (MSE): {loss:.4f}")
        print(ascii_img(render(gaussians)))
        print()

    print("takeaway: a few differentiable Gaussians can approximate smooth targets.")
    print("          scale to 1M splats in 3D, render via alpha compositing = 3D-GS.")


if __name__ == "__main__":
    main()
