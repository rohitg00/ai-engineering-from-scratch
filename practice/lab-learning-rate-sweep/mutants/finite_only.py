import numpy as np

from support import LEARNING_RATES, STEPS, make_regression, train


def run_sweep(X, y, lrs, steps=STEPS):
    return np.array([train(X, y, lr, steps) for lr in lrs])


def is_diverged(losses):
    final = losses[-1]
    return bool(not np.isfinite(final))


def best_lr(lrs, curves):
    best = None
    for lr, losses in zip(lrs, curves):
        if is_diverged(losses):
            continue
        final = losses[-1]
        if best is None or final < best[1] or (final == best[1] and lr < best[0]):
            best = (lr, final)
    return None if best is None else best[0]


def smallest_diverging_lr(lrs, curves):
    diverged = [lr for lr, losses in zip(lrs, curves) if is_diverged(losses)]
    return min(diverged) if diverged else None


def stability_bound(X):
    n = X.shape[0]
    hessian = (2.0 / n) * (X.T @ X)
    return float(2.0 / np.max(np.linalg.eigvalsh(hessian)))


def answers():
    X, y = make_regression(seed=0)
    curves = run_sweep(X, y, LEARNING_RATES)
    best = best_lr(LEARNING_RATES, curves)
    return {
        "best_lr": float(best),
        "best_final_loss": float(curves[LEARNING_RATES.index(best)][-1]),
        "smallest_diverging_lr": float(smallest_diverging_lr(LEARNING_RATES, curves)),
        "stability_bound": stability_bound(X),
    }
