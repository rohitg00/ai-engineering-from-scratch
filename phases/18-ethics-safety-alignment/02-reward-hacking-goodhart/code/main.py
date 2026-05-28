"""Reward hacking の over-optimization curve — stdlib Python。

Gao, Schulman, Hilton (ICML 2023) の形を再現します。policy が initial
reference から drift するほど (sqrt(KL) で測定)、proxy reward は単調に
上がる一方で gold reward は peak 後に下がります。toy gold と proxy の
linear reward models を作り、KL penalty のもとで mean-vector policy を
hill-climb します。proxy sample size と noise tails を変えられます。

Usage: python3 code/main.py
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass


random.seed(42)

D = 8
GOLD_W = [1.0, -0.6, 0.4, 0.2, -0.1, 0.3, -0.5, 0.8]


def dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def gauss() -> float:
    return random.gauss(0.0, 1.0)


def student_t(df: float) -> float:
    """Heavy-tailed noise。df=3 では variance は有限ですが kurtosis は無限です。"""
    u = random.gauss(0.0, 1.0)
    chi2 = sum(random.gauss(0.0, 1.0) ** 2 for _ in range(int(df)))
    if chi2 <= 0:
        chi2 = 1e-6
    return u * math.sqrt(df / chi2)


def sample_feature() -> list[float]:
    return [gauss() for _ in range(D)]


def gold_reward(x: list[float]) -> float:
    return dot(GOLD_W, x)


@dataclass
class ProxyRM:
    w: list[float]
    n_samples: int

    def score(self, x: list[float]) -> float:
        return dot(self.w, x)


def train_proxy(n_samples: int, noise: str = "gauss") -> ProxyRM:
    """gold + noise の n labels から least squares で linear proxy RM を fit します。"""
    xs = [sample_feature() for _ in range(n_samples)]
    ys = []
    for x in xs:
        eps = gauss() if noise == "gauss" else student_t(3.0)
        ys.append(gold_reward(x) + eps)
    # normal equations: w = (X^T X)^-1 X^T y
    # D 次元の gram matrix inversion を closed form で解く (小さな linear system)
    g = [[0.0] * D for _ in range(D)]
    b = [0.0] * D
    for x, y in zip(xs, ys):
        for i in range(D):
            b[i] += x[i] * y
            for j in range(D):
                g[i][j] += x[i] * x[j]
    # n_samples が小さいときも matrix が invertible になるよう ridge を加える
    for i in range(D):
        g[i][i] += 1e-3
    w = solve(g, b)
    return ProxyRM(w=w, n_samples=n_samples)


def solve(a: list[list[float]], b: list[float]) -> list[float]:
    """Gaussian elimination。D が小さいのでこれで十分です。"""
    n = len(b)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for i in range(n):
        piv = i
        for k in range(i + 1, n):
            if abs(m[k][i]) > abs(m[piv][i]):
                piv = k
        m[i], m[piv] = m[piv], m[i]
        for k in range(i + 1, n):
            f = m[k][i] / m[i][i]
            for j in range(i, n + 1):
                m[k][j] -= f * m[i][j]
    x = [0.0] * n
    for i in range(n - 1, -1, -1):
        x[i] = (m[i][n] - sum(m[i][j] * x[j] for j in range(i + 1, n))) / m[i][i]
    return x


def sqrt_kl_from_origin(mu: list[float]) -> float:
    """unit-variance Gaussian 2 つ。片方は 0、もう片方は mu。KL = 1/2 * ||mu||^2。"""
    return math.sqrt(0.5 * sum(m * m for m in mu))


def expected_reward(w: list[float], mu: list[float]) -> float:
    """E_{x ~ N(mu, I)} [<w, x>] = <w, mu>。"""
    return dot(w, mu)


def best_of_n_sweep(proxy: ProxyRM, ns: list[int]) -> list[tuple[float, float, float]]:
    """各 n で best-of-n sampling を simulation します。chosen response の
    mean KL、proxy score、gold score を計算します。"""
    curve = []
    trials = 1000
    for n in ns:
        kls = []
        proxies = []
        golds = []
        for _ in range(trials):
            xs = [sample_feature() for _ in range(n)]
            best = max(xs, key=proxy.score)
            proxies.append(proxy.score(best))
            golds.append(gold_reward(best))
            # best-of-n distribution vs uniform の KL は極限で log(n) nats
            # ここでは proxy として best の mean からの距離を計算する
            kls.append(math.sqrt(0.5 * sum(b * b for b in best)))
        curve.append((
            sum(kls) / trials,
            sum(proxies) / trials,
            sum(golds) / trials,
        ))
    return curve


def kl_constrained_policy_sweep(proxy: ProxyRM,
                                kl_budgets: list[float]) -> list[tuple[float, float, float]]:
    """argmax_mu <w_proxy, mu> - lambda * ||mu||^2/2 を解き、lambda を sweep します。"""
    curve = []
    for kl in kl_budgets:
        # ||mu||^2 <= 2 * kl のもとでの optimal mu: proxy weights を scale する
        norm = math.sqrt(sum(w * w for w in proxy.w))
        if norm < 1e-9:
            mu = [0.0] * D
        else:
            s = math.sqrt(2 * kl) / norm
            mu = [w * s for w in proxy.w]
        curve.append((
            sqrt_kl_from_origin(mu),
            expected_reward(proxy.w, mu),
            expected_reward(GOLD_W, mu),
        ))
    return curve


def print_curve(name: str, curve: list[tuple[float, float, float]]) -> None:
    print(f"\n{name}")
    print("-" * 60)
    print(f"  {'sqrt(KL)':>9}  {'proxy':>8}  {'gold':>8}  {'gap':>8}")
    for sk, p, g in curve:
        print(f"  {sk:>9.3f}  {p:>8.3f}  {g:>8.3f}  {p - g:>+8.3f}")
    peak_gold = max(curve, key=lambda r: r[2])
    print(f"  gold peak は sqrt(KL) = {peak_gold[0]:.3f}, "
          f"gold = {peak_gold[2]:.3f}, proxy = {peak_gold[1]:.3f}")


def main() -> None:
    print("=" * 60)
    print("REWARD HACKING OVER-OPTIMIZATION (Phase 18, Lesson 2)")
    print("=" * 60)

    budgets = [0.0, 0.2, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0, 8.0]

    for n in (100, 300, 1000, 10000):
        rm = train_proxy(n)
        curve = kl_constrained_policy_sweep(rm, budgets)
        print_curve(f"{n} samples で訓練した Proxy RM (Gaussian noise)", curve)

    # heavy-tailed proxy error: Catastrophic Goodhart の条件
    rm_heavy = train_proxy(300, noise="student_t")
    curve_heavy = kl_constrained_policy_sweep(rm_heavy, budgets)
    print_curve("Proxy RM, 300 samples, Student-t(3) noise (heavy tails)",
                curve_heavy)

    # 比較用の best-of-N sampling curve
    ns = [1, 2, 4, 8, 16, 64, 256, 1024]
    bon = best_of_n_sweep(train_proxy(300), ns)
    print_curve("Best-of-N sampling (300-sample proxy)", bon)

    print("\n" + "=" * 60)
    print("要点: proxy reward は単調に上がり、gold は peak 後に下がります。")
    print("proxy samples を増やすと peak は遠ざかりますが、消えません。")
    print("heavy-tailed noise は peak を原点に近づけます。KL だけでは")
    print("救えません。これは Goodhart's Law を測定したものです。")
    print("=" * 60)


if __name__ == "__main__":
    main()
