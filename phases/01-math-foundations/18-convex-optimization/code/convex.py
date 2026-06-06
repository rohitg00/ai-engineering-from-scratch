import math
import random


def check_convexity(f, dim, bounds=(-5, 5), samples=2000, label=""):
    violations = 0
    worst_violation = 0.0
    for _ in range(samples):
        x = [random.uniform(*bounds) for _ in range(dim)]
        y = [random.uniform(*bounds) for _ in range(dim)]
        t = random.uniform(0, 1)
        mid = [t * xi + (1 - t) * yi for xi, yi in zip(x, y)]
        lhs = f(mid)
        rhs = t * f(x) + (1 - t) * f(y)
        gap = lhs - rhs
        if gap > 1e-10:
            violations += 1
            worst_violation = max(worst_violation, gap)
    is_convex = violations == 0
    status = "CONVEX" if is_convex else "NOT CONVEX"
    if label:
        print(f"  {label:30s}  {status:10s}  violations: {violations}/{samples}"
              + (f"  worst: {worst_violation:.6f}" if violations > 0 else ""))
    return is_convex, violations


def hessian_eigenvalues_2d(H):
    a, b = H[0][0], H[0][1]
    c, d = H[1][0], H[1][1]
    trace = a + d
    det = a * d - b * c
    discriminant = trace ** 2 - 4 * det
    if discriminant < 0:
        return None, None
    sqrt_disc = math.sqrt(discriminant)
    e1 = (trace + sqrt_disc) / 2
    e2 = (trace - sqrt_disc) / 2
    return e1, e2


def is_positive_semidefinite_2d(H):
    e1, e2 = hessian_eigenvalues_2d(H)
    if e1 is None:
        return False
    return e1 >= -1e-10 and e2 >= -1e-10


def invert_2x2(H):
    det = H[0][0] * H[1][1] - H[0][1] * H[1][0]
    if abs(det) < 1e-15:
        return None
    return [
        [H[1][1] / det, -H[0][1] / det],
        [-H[1][0] / det, H[0][0] / det],
    ]


def mat_vec_2d(M, v):
    return [
        M[0][0] * v[0] + M[0][1] * v[1],
        M[1][0] * v[0] + M[1][1] * v[1],
    ]


class GradientDescent:
    def __init__(self, lr=0.001):
        self.lr = lr

    def step(self, params, grads):
        return [p - self.lr * g for p, g in zip(params, grads)]


def optimize_gd(grad_f, x0, lr=0.01, steps=1000, tol=1e-12):
    x = list(x0)
    history = [x[:]]
    for _ in range(steps):
        g = grad_f(x)
        if sum(gi ** 2 for gi in g) < tol:
            break
        x = [xi - lr * gi for xi, gi in zip(x, g)]
        if any(math.isnan(xi) or math.isinf(xi) for xi in x):
            break
        history.append(x[:])
    return history


def newtons_method(grad_f, hessian_f, x0, steps=100, tol=1e-12):
    x = list(x0)
    history = [x[:]]
    for _ in range(steps):
        g = grad_f(x)
        if sum(gi ** 2 for gi in g) < tol:
            break
        H = hessian_f(x)
        H_inv = invert_2x2(H)
        if H_inv is None:
            break
        dx = mat_vec_2d(H_inv, g)
        x = [x[0] - dx[0], x[1] - dx[1]]
        if any(math.isnan(xi) or math.isinf(xi) for xi in x):
            break
        history.append(x[:])
    return history


def lagrange_solve(f_grad, g_val, g_grad, x0, lr=0.01,
                   lr_lambda=0.01, steps=5000):
    x = list(x0)
    lam = 0.0
    history = []
    for _ in range(steps):
        fg = f_grad(x)
        gv = g_val(x)
        gg = g_grad(x)
        x = [
            xi - lr * (fgi + lam * ggi)
            for xi, fgi, ggi in zip(x, fg, gg)
        ]
        lam = lam + lr_lambda * gv
        if any(math.isnan(xi) or math.isinf(xi) for xi in x):
            break
        history.append((x[:], lam, gv))
    return history


def demo_convexity_checker():
    print("=" * 65)
    print("  CONVEXITY CHECKER")
    print("=" * 65)
    print()

    random.seed(42)

    check_convexity(lambda x: x[0] ** 2, 1, label="f(x) = x^2")
    check_convexity(lambda x: abs(x[0]), 1, label="f(x) = |x|")
    check_convexity(lambda x: math.exp(x[0]), 1, label="f(x) = e^x")
    check_convexity(lambda x: x[0] ** 2 + x[1] ** 2, 2, label="f(x,y) = x^2 + y^2")
    check_convexity(lambda x: max(x[0], 0), 1, label="f(x) = max(0, x) [ReLU]")

    check_convexity(lambda x: math.sin(x[0]), 1, label="f(x) = sin(x)")
    check_convexity(lambda x: x[0] ** 3, 1, label="f(x) = x^3")
    check_convexity(lambda x: -x[0] ** 2, 1, label="f(x) = -x^2")
    check_convexity(
        lambda x: math.sin(x[0]) * math.cos(x[1]),
        2,
        label="f(x,y) = sin(x)*cos(y)"
    )
    check_convexity(
        lambda x: x[0] ** 2 - x[1] ** 2,
        2,
        label="f(x,y) = x^2 - y^2 [saddle]"
    )

    print()
    print("  Top group: expected convex. Bottom group: expected non-convex.")


def demo_hessian_analysis():
    print()
    print()
    print("=" * 65)
    print("  HESSIAN ANALYSIS AND CURVATURE")
    print("=" * 65)

    print()
    print("  f(x,y) = 5x^2 + y^2 (elongated bowl)")
    H1 = [[10, 0], [0, 2]]
    e1, e2 = hessian_eigenvalues_2d(H1)
    psd = is_positive_semidefinite_2d(H1)
    print(f"  Hessian: [[{H1[0][0]}, {H1[0][1]}], [{H1[1][0]}, {H1[1][1]}]]")
    print(f"  Eigenvalues: {e1:.1f}, {e2:.1f}")
    print(f"  Condition number: {e1 / e2:.1f}")
    print(f"  Positive semidefinite: {psd}")
    print(f"  Convex: {psd}")

    print()
    print("  f(x,y) = x^2 - y^2 (saddle)")
    H2 = [[2, 0], [0, -2]]
    e1, e2 = hessian_eigenvalues_2d(H2)
    psd = is_positive_semidefinite_2d(H2)
    print(f"  Hessian: [[{H2[0][0]}, {H2[0][1]}], [{H2[1][0]}, {H2[1][1]}]]")
    print(f"  Eigenvalues: {e1:.1f}, {e2:.1f}")
    print(f"  Positive semidefinite: {psd}")
    print(f"  Saddle point: mixed signs confirm saddle")

    print()
    print("  f(x,y) = x^2 + 3xy + y^2")
    H3 = [[2, 3], [3, 2]]
    e1, e2 = hessian_eigenvalues_2d(H3)
    psd = is_positive_semidefinite_2d(H3)
    print(f"  Hessian: [[{H3[0][0]}, {H3[0][1]}], [{H3[1][0]}, {H3[1][1]}]]")
    print(f"  Eigenvalues: {e1:.1f}, {e2:.1f}")
    print(f"  Positive semidefinite: {psd}")
    print(f"  Convex: {psd} (negative eigenvalue means indefinite)")

    print()
    print("  Rosenbrock at minimum (1, 1)")
    Hmin = [[802, -400], [-400, 200]]
    e1, e2 = hessian_eigenvalues_2d(Hmin)
    psd = is_positive_semidefinite_2d(Hmin)
    print(f"  Hessian: [[{Hmin[0][0]}, {Hmin[0][1]}], [{Hmin[1][0]}, {Hmin[1][1]}]]")
    print(f"  Eigenvalues: {e1:.2f}, {e2:.2f}")
    print(f"  Condition number: {e1 / e2:.1f}")
    print(f"  Positive semidefinite at (1,1): {psd}")


def demo_newtons_method():
    print()
    print()
    print("=" * 65)
    print("  NEWTON'S METHOD vs GRADIENT DESCENT")
    print("=" * 65)

    def f(x):
        return 50 * x[0] ** 2 + x[1] ** 2

    def grad_f(x):
        return [100 * x[0], 2 * x[1]]

    def hessian_f(x):
        return [[100, 0], [0, 2]]

    start = [10.0, 10.0]

    print()
    print(f"  Function: f(x,y) = 50x^2 + y^2")
    print(f"  Minimum at: (0, 0), f = 0")
    print(f"  Starting point: ({start[0]}, {start[1]}), f = {f(start):.1f}")
    print(f"  Condition number: {100 / 2:.0f} (elongated valley)")

    newton_hist = newtons_method(grad_f, hessian_f, start, steps=50)
    gd_hist = optimize_gd(grad_f, start, lr=0.015, steps=500)

    print()
    print(f"  Newton's method: {len(newton_hist) - 1} steps to converge")
    print(f"  {'Step':>6s}  {'x':>12s}  {'y':>12s}  {'f(x,y)':>14s}")
    print(f"  {'-' * 48}")
    for i, p in enumerate(newton_hist):
        print(f"  {i:6d}  {p[0]:12.8f}  {p[1]:12.8f}  {f(p):14.8f}")

    print()
    threshold = 1e-10
    gd_converged = len(gd_hist) - 1
    for i, p in enumerate(gd_hist):
        if f(p) < threshold:
            gd_converged = i
            break

    print(f"  Gradient descent (lr=0.015): {len(gd_hist) - 1} steps taken")
    steps_to_show = [0, 1, 5, 10, 25, 50, 100, 200, 300, 400, 499]
    steps_to_show = [s for s in steps_to_show if s < len(gd_hist)]
    print(f"  {'Step':>6s}  {'x':>12s}  {'y':>12s}  {'f(x,y)':>14s}")
    print(f"  {'-' * 48}")
    for i in steps_to_show:
        p = gd_hist[i]
        print(f"  {i:6d}  {p[0]:12.8f}  {p[1]:12.8f}  {f(p):14.8f}")

    print()
    print(f"  Newton converged in {len(newton_hist) - 1} step(s)")
    print(f"  GD reached f < {threshold} at step {gd_converged}"
          + (" (did not converge)" if gd_converged == len(gd_hist) - 1 else ""))
    print()
    print("  Newton's method is exact for quadratic functions.")
    print("  GD struggles with high condition number (elongated valleys).")


def demo_condition_number_effect():
    print()
    print()
    print("=" * 65)
    print("  CONDITION NUMBER EFFECT ON GRADIENT DESCENT")
    print("=" * 65)
    print()

    conditions = [1, 5, 10, 50, 100]

    print(f"  Minimizing f(x,y) = c*x^2 + y^2, start = (10, 10)")
    print(f"  Newton always converges in 1 step for any condition number.")
    print()
    print(f"  {'Cond #':>8s}  {'GD steps':>10s}  {'Newton steps':>14s}  {'GD final loss':>14s}")
    print(f"  {'-' * 50}")

    for c in conditions:
        def grad_f(x, c=c):
            return [2 * c * x[0], 2 * x[1]]

        def hess_f(x, c=c):
            return [[2 * c, 0], [0, 2]]

        def f_val(x, c=c):
            return c * x[0] ** 2 + x[1] ** 2

        start = [10.0, 10.0]
        lr = 0.9 / (2 * c)

        gd_hist = optimize_gd(grad_f, start, lr=lr, steps=2000)
        newton_hist = newtons_method(grad_f, hess_f, start, steps=50)

        gd_steps = len(gd_hist) - 1
        newton_steps = len(newton_hist) - 1
        gd_final = f_val(gd_hist[-1])

        print(f"  {c:8d}  {gd_steps:10d}  {newton_steps:14d}  {gd_final:14.2e}")


def demo_lagrange_multipliers():
    print()
    print()
    print("=" * 65)
    print("  LAGRANGE MULTIPLIER SOLVER")
    print("=" * 65)

    print()
    print("  Problem: minimize f(x,y) = x^2 + y^2")
    print("  Subject to: g(x,y) = x + y - 1 = 0")
    print("  Analytical solution: x = 0.5, y = 0.5, lambda = -1")
    print()

    def f_grad(x):
        return [2 * x[0], 2 * x[1]]

    def g_val(x):
        return x[0] + x[1] - 1

    def g_grad(x):
        return [1.0, 1.0]

    history = lagrange_solve(f_grad, g_val, g_grad, [2.0, 2.0],
                             lr=0.01, lr_lambda=0.01, steps=5000)

    milestones = [0, 49, 499, 999, 2499, 4999]
    milestones = [m for m in milestones if m < len(history)]

    print(f"  {'Step':>6s}  {'x':>8s}  {'y':>8s}  {'lambda':>8s}  {'g(x,y)':>10s}  {'f(x,y)':>10s}")
    print(f"  {'-' * 56}")

    for i in milestones:
        x, lam, gv = history[i]
        fv = x[0] ** 2 + x[1] ** 2
        print(f"  {i + 1:6d}  {x[0]:8.4f}  {x[1]:8.4f}  {lam:8.4f}  {gv:10.6f}  {fv:10.6f}")

    final_x, final_lam, final_g = history[-1]
    print()
    print(f"  Final:   x = {final_x[0]:.6f}, y = {final_x[1]:.6f}")
    print(f"  lambda = {final_lam:.6f}")
    print(f"  Constraint violation: {abs(final_g):.2e}")
    print(f"  Objective value: {final_x[0] ** 2 + final_x[1] ** 2:.6f}")

    print()
    print()
    print("  Problem: minimize f(x,y) = (x-3)^2 + (y-3)^2")
    print("  Subject to: x + 2y = 4")
    print()

    def f_grad2(x):
        return [2 * (x[0] - 3), 2 * (x[1] - 3)]

    def g_val2(x):
        return x[0] + 2 * x[1] - 4

    def g_grad2(x):
        return [1.0, 2.0]

    history2 = lagrange_solve(f_grad2, g_val2, g_grad2, [0.0, 0.0],
                              lr=0.002, lr_lambda=0.002, steps=20000)

    final_x2, final_lam2, final_g2 = history2[-1]
    print(f"  Solution: x = {final_x2[0]:.6f}, y = {final_x2[1]:.6f}")
    print(f"  lambda = {final_lam2:.6f}")
    print(f"  Constraint x + 2y = {final_x2[0] + 2 * final_x2[1]:.6f} (target: 4)")
    print(f"  Objective: {(final_x2[0] - 3) ** 2 + (final_x2[1] - 3) ** 2:.6f}")

    x_exact = 2.0
    y_exact = 1.0
    print()
    print(f"  Analytical: x = 2, y = 1, lambda = 2")
    print(f"  Error: {math.sqrt((final_x2[0] - x_exact) ** 2 + (final_x2[1] - y_exact) ** 2):.2e}")


def demo_regularization_geometry():
    print()
    print()
    print("=" * 65)
    print("  REGULARIZATION AS CONSTRAINED OPTIMIZATION")
    print("=" * 65)
    print()

    def unconstrained_min():
        return [3.0, 2.0]

    print("  Unconstrained minimum of (x-3)^2 + (y-2)^2: (3, 2)")
    print()

    print("  L2 constraint: x^2 + y^2 <= 1 (unit circle)")
    x_l2 = [3.0 / math.sqrt(13), 2.0 / math.sqrt(13)]
    print(f"  Projected solution: ({x_l2[0]:.6f}, {x_l2[1]:.6f})")
    print(f"  ||w||^2 = {x_l2[0] ** 2 + x_l2[1] ** 2:.6f}")
    print(f"  Both weights nonzero: weights shrink but none eliminated")
    print()

    print("  L1 constraint: |x| + |y| <= 1 (unit diamond)")
    print("  Solution sits at a corner of the diamond.")

    best_val = float('inf')
    best_x = None

    for x_cand in [i * 0.001 for i in range(1001)]:
        y_cand = 1.0 - x_cand
        val = (x_cand - 3) ** 2 + (y_cand - 2) ** 2
        if val < best_val:
            best_val = val
            best_x = [x_cand, y_cand]

    for y_cand_raw in [i * 0.001 for i in range(1001)]:
        x_cand = 1.0 - y_cand_raw
        val = (x_cand - 3) ** 2 + (y_cand_raw - 2) ** 2
        if val < best_val:
            best_val = val
            best_x = [x_cand, y_cand_raw]

    corner_vals = [
        ([1.0, 0.0], (1 - 3) ** 2 + (0 - 2) ** 2),
        ([0.0, 1.0], (0 - 3) ** 2 + (1 - 2) ** 2),
        ([-1.0, 0.0], (-1 - 3) ** 2 + (0 - 2) ** 2),
        ([0.0, -1.0], (0 - 3) ** 2 + (-1 - 2) ** 2),
    ]

    print(f"  Scanning diamond boundary...")
    print(f"  Best on edges: ({best_x[0]:.4f}, {best_x[1]:.4f}), "
          f"objective = {best_val:.4f}")
    print()
    print(f"  Diamond corners:")
    for pt, val in corner_vals:
        marker = " <-- best corner" if val == min(v for _, v in corner_vals) else ""
        print(f"    ({pt[0]:5.1f}, {pt[1]:5.1f})  objective = {val:.1f}{marker}")

    print()
    print("  L1 pushes solution toward corners (axis-aligned).")
    print("  L2 pushes solution toward the nearest point on the circle.")
    print("  L1 produces sparsity. L2 produces small but nonzero weights.")


def demo_first_vs_second_order():
    print()
    print()
    print("=" * 65)
    print("  FIRST-ORDER vs SECOND-ORDER: CONVERGENCE SPEED")
    print("=" * 65)
    print()

    def rosenbrock(x):
        return (1 - x[0]) ** 2 + 100 * (x[1] - x[0] ** 2) ** 2

    def rosenbrock_grad(x):
        dx = -2 * (1 - x[0]) + 200 * (x[1] - x[0] ** 2) * (-2 * x[0])
        dy = 200 * (x[1] - x[0] ** 2)
        return [dx, dy]

    def rosenbrock_hessian(x):
        h00 = 2 - 400 * x[1] + 1200 * x[0] ** 2
        h01 = -400 * x[0]
        h10 = -400 * x[0]
        h11 = 200
        return [[h00, h01], [h10, h11]]

    start = [0.5, 0.5]

    print(f"  Rosenbrock function: f(x,y) = (1-x)^2 + 100(y-x^2)^2")
    print(f"  Minimum at (1, 1), f = 0")
    print(f"  Start: ({start[0]}, {start[1]}), f = {rosenbrock(start):.4f}")
    print()

    newton_hist = newtons_method(rosenbrock_grad, rosenbrock_hessian, start, steps=100)

    gd_hist = optimize_gd(rosenbrock_grad, start, lr=0.001, steps=10000)

    print(f"  Newton's method ({len(newton_hist) - 1} steps):")
    print(f"  {'Step':>6s}  {'x':>10s}  {'y':>10s}  {'f(x,y)':>14s}")
    print(f"  {'-' * 44}")
    for i, p in enumerate(newton_hist[:15]):
        print(f"  {i:6d}  {p[0]:10.6f}  {p[1]:10.6f}  {rosenbrock(p):14.8f}")
    if len(newton_hist) > 15:
        p = newton_hist[-1]
        print(f"  {len(newton_hist) - 1:6d}  {p[0]:10.6f}  {p[1]:10.6f}  {rosenbrock(p):14.8f}")

    print()

    gd_threshold = 1e-6
    gd_converge_step = len(gd_hist) - 1
    for i, p in enumerate(gd_hist):
        if rosenbrock(p) < gd_threshold:
            gd_converge_step = i
            break

    print(f"  Gradient descent (lr=0.001, {len(gd_hist) - 1} steps):")
    show_steps = [0, 10, 100, 500, 1000, 2000, 5000, 9999]
    show_steps = [s for s in show_steps if s < len(gd_hist)]
    print(f"  {'Step':>6s}  {'x':>10s}  {'y':>10s}  {'f(x,y)':>14s}")
    print(f"  {'-' * 44}")
    for i in show_steps:
        p = gd_hist[i]
        print(f"  {i:6d}  {p[0]:10.6f}  {p[1]:10.6f}  {rosenbrock(p):14.8f}")

    print()
    print(f"  Newton converged (f < 1e-12) in {len(newton_hist) - 1} steps")
    if gd_converge_step < len(gd_hist) - 1:
        print(f"  GD converged (f < {gd_threshold}) in {gd_converge_step} steps")
    else:
        final_gd = rosenbrock(gd_hist[-1])
        print(f"  GD did not reach f < {gd_threshold} in {len(gd_hist) - 1} steps "
              f"(final: {final_gd:.2e})")

    print()
    print("  Newton uses O(n^3) per step but converges quadratically.")
    print("  GD uses O(n) per step but converges linearly.")
    print("  For small problems, Newton wins. For millions of parameters, GD wins.")


def demo_convex_vs_nonconvex_landscape():
    print()
    print()
    print("=" * 65)
    print("  CONVEX vs NON-CONVEX: ASCII LANDSCAPE")
    print("=" * 65)
    print()
    print("  Convex: f(x) = x^2")
    print()

    for y_level in range(10, -1, -1):
        threshold = y_level * 2.5
        line = "  "
        for x_step in range(-20, 21):
            x = x_step * 0.25
            val = x ** 2
            if abs(val - threshold) < 1.3:
                line += "*"
            elif val < threshold:
                line += " "
            else:
                line += " "
        print(line)

    print("  " + "-" * 41)
    print("  " + " " * 18 + "x=0")
    print("  One valley. Gradient descent always finds the bottom.")

    print()
    print("  Non-convex: f(x) = sin(3x) + 0.1*x^2")
    print()

    for y_level in range(10, -1, -1):
        threshold = -1.0 + y_level * 0.4
        line = "  "
        for x_step in range(-25, 26):
            x = x_step * 0.2
            val = math.sin(3 * x) + 0.1 * x ** 2
            if abs(val - threshold) < 0.25:
                line += "*"
            else:
                line += " "
        print(line)

    print("  " + "-" * 51)
    print("  Multiple valleys. Gradient descent may get stuck.")


def demo_duality_intuition():
    print()
    print()
    print("=" * 65)
    print("  DUALITY: PRIMAL vs DUAL")
    print("=" * 65)
    print()
    print("  Primal: minimize x^2 + y^2 subject to x + y >= 1")
    print("  Rewrite constraint as: -(x + y - 1) <= 0")
    print()
    print("  Lagrangian: L = x^2 + y^2 + lambda * (1 - x - y)")
    print("  dL/dx = 2x - lambda = 0  =>  x = lambda/2")
    print("  dL/dy = 2y - lambda = 0  =>  y = lambda/2")
    print()
    print("  Dual function:")
    print("    d(lambda) = min_x,y [x^2 + y^2 + lambda(1 - x - y)]")
    print("              = (lambda/2)^2 + (lambda/2)^2 + lambda(1 - lambda)")
    print("              = lambda^2/2 + lambda - lambda^2")
    print("              = lambda - lambda^2/2")
    print()
    print("  Dual problem: maximize lambda - lambda^2/2 s.t. lambda >= 0")
    print("  d'(lambda) = 1 - lambda = 0  =>  lambda* = 1")
    print()

    lam_star = 1.0
    x_star = lam_star / 2
    y_star = lam_star / 2
    primal_val = x_star ** 2 + y_star ** 2
    dual_val = lam_star - lam_star ** 2 / 2

    print(f"  Primal solution: x = {x_star}, y = {y_star}")
    print(f"  Primal objective: {primal_val}")
    print(f"  Dual objective:   {dual_val}")
    print(f"  Strong duality:   primal = dual = {primal_val}")
    print(f"  Constraint: x + y = {x_star + y_star} >= 1  (active)")
    print(f"  Complementary slackness: lambda * (1 - x - y) = {lam_star * (1 - x_star - y_star)}")


def print_summary():
    print()
    print()
    print("=" * 65)
    print("  SUMMARY")
    print("=" * 65)
    print()
    print("  1. Convex functions have one valley. Every local min is global.")
    print("  2. The Hessian encodes curvature. PSD Hessian = convex.")
    print("  3. Newton's method uses curvature for faster convergence.")
    print("  4. Lagrange multipliers handle equality constraints.")
    print("  5. KKT conditions handle inequality constraints.")
    print("  6. L1 regularization = diamond constraint = sparsity.")
    print("  7. L2 regularization = circle constraint = weight shrinkage.")
    print("  8. Duality converts hard primal problems into sometimes-easier duals.")
    print("  9. Neural networks are non-convex, but overparameterization and")
    print("     stochastic noise make gradient descent work anyway.")
    print()


if __name__ == "__main__":
    demo_convexity_checker()
    demo_hessian_analysis()
    demo_newtons_method()
    demo_condition_number_effect()
    demo_lagrange_multipliers()
    demo_regularization_geometry()
    demo_first_vs_second_order()
    demo_convex_vs_nonconvex_landscape()
    demo_duality_intuition()
    print_summary()
