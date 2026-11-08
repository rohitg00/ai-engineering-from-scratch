import numpy as np


def fix_sign(v):
    k = int(np.argmax(np.abs(v)))
    return -v if v[k] < 0 else v.copy()


def power_iteration(M, v0, num_iters=200, tol=1e-10):
    v = v0 / np.linalg.norm(v0)
    iters = 0
    for _ in range(num_iters):
        iters += 1
        Mv = M @ v
        norm = np.linalg.norm(Mv)
        if norm < tol:
            return 0.0, fix_sign(v), iters
        v_new = Mv / norm
        if np.abs(np.dot(v_new, v)) > 1 - tol:
            v = v_new
            break
        v = v_new
    eigenvalue = float(np.linalg.norm(M @ v))
    return eigenvalue, fix_sign(v), iters
