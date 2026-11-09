# Lesson: Convex Optimization (phase 01 / lesson 18)
# Julia port of code/convex.py. Julia standard library only.
# Source: phases/01-math-foundations/18-convex-optimization/docs/en.md
# Run: julia code/convex.jl

using Printf
using Random

const RNG = MersenneTwister(42)

pybool(b) = b ? "True" : "False"
uniform(lo, hi) = lo + (hi - lo) * rand(RNG)

function check_convexity(f, dim; bounds=(-5.0, 5.0), samples=2000, label="")
    violations = 0
    worst_violation = 0.0
    for _ in 1:samples
        x = [uniform(bounds...) for _ in 1:dim]
        y = [uniform(bounds...) for _ in 1:dim]
        t = uniform(0.0, 1.0)
        mid = t .* x .+ (1 - t) .* y
        gap = f(mid) - (t * f(x) + (1 - t) * f(y))
        if gap > 1e-10
            violations += 1
            worst_violation = max(worst_violation, gap)
        end
    end
    is_convex = violations == 0
    status = is_convex ? "CONVEX" : "NOT CONVEX"
    if !isempty(label)
        extra = violations > 0 ? @sprintf("  worst: %.6f", worst_violation) : ""
        @printf("  %-30s  %-10s  violations: %d/%d%s\n", label, status, violations, samples, extra)
    end
    return is_convex, violations
end

function hessian_eigenvalues_2d(H)
    a, b, c, d = H[1][1], H[1][2], H[2][1], H[2][2]
    trace = a + d
    det = a * d - b * c
    disc = trace^2 - 4 * det
    disc < 0 && return nothing, nothing
    s = sqrt(disc)
    return (trace + s) / 2, (trace - s) / 2
end

function is_positive_semidefinite_2d(H)
    e1, e2 = hessian_eigenvalues_2d(H)
    e1 === nothing && return false
    return e1 >= -1e-10 && e2 >= -1e-10
end

function invert_2x2(H)
    det = H[1][1] * H[2][2] - H[1][2] * H[2][1]
    abs(det) < 1e-15 && return nothing
    return [[H[2][2] / det, -H[1][2] / det], [-H[2][1] / det, H[1][1] / det]]
end

mat_vec_2d(M, v) = [M[1][1] * v[1] + M[1][2] * v[2], M[2][1] * v[1] + M[2][2] * v[2]]

bad(x) = any(xi -> isnan(xi) || isinf(xi), x)

function optimize_gd(grad_f, x0; lr=0.01, steps=1000, tol=1e-12)
    x = Float64.(x0)
    history = [copy(x)]
    for _ in 1:steps
        g = grad_f(x)
        sum(g .^ 2) < tol && break
        x = x .- lr .* g
        bad(x) && break
        push!(history, copy(x))
    end
    return history
end

function newtons_method(grad_f, hessian_f, x0; steps=100, tol=1e-12)
    x = Float64.(x0)
    history = [copy(x)]
    for _ in 1:steps
        g = grad_f(x)
        sum(g .^ 2) < tol && break
        H_inv = invert_2x2(hessian_f(x))
        H_inv === nothing && break
        x = x .- mat_vec_2d(H_inv, g)
        bad(x) && break
        push!(history, copy(x))
    end
    return history
end

function lagrange_solve(f_grad, g_val, g_grad, x0; lr=0.01, lr_lambda=0.01, steps=5000)
    x = Float64.(x0)
    lam = 0.0
    history = Tuple{Vector{Float64},Float64,Float64}[]
    for _ in 1:steps
        fg, gv, gg = f_grad(x), g_val(x), g_grad(x)
        x = x .- lr .* (fg .+ lam .* gg)
        lam += lr_lambda * gv
        bad(x) && break
        push!(history, (copy(x), lam, g_val(x)))
    end
    return history
end

function banner(title)
    println("="^65)
    println("  ", title)
    println("="^65)
end

function demo_convexity_checker()
    banner("CONVEXITY CHECKER")
    println()
    check_convexity(x -> x[1]^2, 1; label="f(x) = x^2")
    check_convexity(x -> abs(x[1]), 1; label="f(x) = |x|")
    check_convexity(x -> exp(x[1]), 1; label="f(x) = e^x")
    check_convexity(x -> x[1]^2 + x[2]^2, 2; label="f(x,y) = x^2 + y^2")
    check_convexity(x -> max(x[1], 0), 1; label="f(x) = max(0, x) [ReLU]")
    check_convexity(x -> sin(x[1]), 1; label="f(x) = sin(x)")
    check_convexity(x -> x[1]^3, 1; label="f(x) = x^3")
    check_convexity(x -> -x[1]^2, 1; label="f(x) = -x^2")
    check_convexity(x -> sin(x[1]) * cos(x[2]), 2; label="f(x,y) = sin(x)*cos(y)")
    check_convexity(x -> x[1]^2 - x[2]^2, 2; label="f(x,y) = x^2 - y^2 [saddle]")
    println()
    println("  Top group: expected convex. Bottom group: expected non-convex.")
end

hstr(H) = "[[$(H[1][1]), $(H[1][2])], [$(H[2][1]), $(H[2][2])]]"

function demo_hessian_analysis()
    println("\n")
    banner("HESSIAN ANALYSIS AND CURVATURE")
    println("\n  f(x,y) = 5x^2 + y^2 (elongated bowl)")
    H1 = [[10, 0], [0, 2]]
    e1, e2 = hessian_eigenvalues_2d(H1)
    psd = is_positive_semidefinite_2d(H1)
    println("  Hessian: ", hstr(H1))
    @printf("  Eigenvalues: %.1f, %.1f\n", e1, e2)
    @printf("  Condition number: %.1f\n", e1 / e2)
    println("  Positive semidefinite: ", pybool(psd))
    println("  Convex: ", pybool(psd))

    println("\n  f(x,y) = x^2 - y^2 (saddle)")
    H2 = [[2, 0], [0, -2]]
    e1, e2 = hessian_eigenvalues_2d(H2)
    println("  Hessian: ", hstr(H2))
    @printf("  Eigenvalues: %.1f, %.1f\n", e1, e2)
    println("  Positive semidefinite: ", pybool(is_positive_semidefinite_2d(H2)))
    println("  Saddle point: mixed signs confirm saddle")

    println("\n  f(x,y) = x^2 + 3xy + y^2")
    H3 = [[2, 3], [3, 2]]
    e1, e2 = hessian_eigenvalues_2d(H3)
    psd = is_positive_semidefinite_2d(H3)
    println("  Hessian: ", hstr(H3))
    @printf("  Eigenvalues: %.1f, %.1f\n", e1, e2)
    println("  Positive semidefinite: ", pybool(psd))
    println("  Convex: ", pybool(psd), " (negative eigenvalue means indefinite)")

    println("\n  Rosenbrock at minimum (1, 1)")
    Hmin = [[802, -400], [-400, 200]]
    e1, e2 = hessian_eigenvalues_2d(Hmin)
    println("  Hessian: ", hstr(Hmin))
    @printf("  Eigenvalues: %.2f, %.2f\n", e1, e2)
    @printf("  Condition number: %.1f\n", e1 / e2)
    println("  Positive semidefinite at (1,1): ", pybool(is_positive_semidefinite_2d(Hmin)))
end

function demo_newtons_method()
    println("\n")
    banner("NEWTON'S METHOD vs GRADIENT DESCENT")
    f(x) = 50 * x[1]^2 + x[2]^2
    grad_f(x) = [100 * x[1], 2 * x[2]]
    hessian_f(x) = [[100.0, 0.0], [0.0, 2.0]]
    start = [10.0, 10.0]
    println("\n  Function: f(x,y) = 50x^2 + y^2")
    println("  Minimum at: (0, 0), f = 0")
    @printf("  Starting point: (%s, %s), f = %.1f\n", start[1], start[2], f(start))
    println("  Condition number: 50 (elongated valley)")

    newton_hist = newtons_method(grad_f, hessian_f, start; steps=50)
    gd_hist = optimize_gd(grad_f, start; lr=0.015, steps=500)

    println("\n  Newton's method: $(length(newton_hist) - 1) steps to converge")
    @printf("  %6s  %12s  %12s  %14s\n", "Step", "x", "y", "f(x,y)")
    println("  ", "-"^48)
    for (i, p) in enumerate(newton_hist)
        @printf("  %6d  %12.8f  %12.8f  %14.8f\n", i - 1, p[1], p[2], f(p))
    end

    println()
    gd_converged = length(gd_hist) - 1
    for (i, p) in enumerate(gd_hist)
        if f(p) < 1e-10
            gd_converged = i - 1
            break
        end
    end
    println("  Gradient descent (lr=0.015): $(length(gd_hist) - 1) steps taken")
    @printf("  %6s  %12s  %12s  %14s\n", "Step", "x", "y", "f(x,y)")
    println("  ", "-"^48)
    for i in filter(s -> s < length(gd_hist), [0, 1, 5, 10, 25, 50, 100, 200, 300, 400, 499])
        p = gd_hist[i+1]
        @printf("  %6d  %12.8f  %12.8f  %14.8f\n", i, p[1], p[2], f(p))
    end
    println("\n  Newton converged in $(length(newton_hist) - 1) step(s)")
    println("  GD reached f < 1e-10 at step $gd_converged", gd_converged == length(gd_hist) - 1 ? " (did not converge)" : "")
    println("\n  Newton's method is exact for quadratic functions.")
    println("  GD struggles with high condition number (elongated valleys).")
end

function demo_condition_number_effect()
    println("\n")
    banner("CONDITION NUMBER EFFECT ON GRADIENT DESCENT")
    println()
    println("  Minimizing f(x,y) = c*x^2 + y^2, start = (10, 10)")
    println("  Newton always converges in 1 step for any condition number.")
    println()
    @printf("  %8s  %10s  %14s  %14s\n", "Cond #", "GD steps", "Newton steps", "GD final loss")
    println("  ", "-"^50)
    for c in (1, 5, 10, 50, 100)
        grad_f(x) = [2 * c * x[1], 2 * x[2]]
        hess_f(x) = [[2.0 * c, 0.0], [0.0, 2.0]]
        f_val(x) = c * x[1]^2 + x[2]^2
        gd_hist = optimize_gd(grad_f, [10.0, 10.0]; lr=0.9 / (2 * c), steps=2000)
        newton_hist = newtons_method(grad_f, hess_f, [10.0, 10.0]; steps=50)
        @printf("  %8d  %10d  %14d  %14.2e\n", c, length(gd_hist) - 1, length(newton_hist) - 1, f_val(gd_hist[end]))
    end
end

function demo_lagrange_multipliers()
    println("\n")
    banner("LAGRANGE MULTIPLIER SOLVER")
    println("\n  Problem: minimize f(x,y) = x^2 + y^2")
    println("  Subject to: g(x,y) = x + y - 1 = 0")
    println("  Analytical solution: x = 0.5, y = 0.5, lambda = -1\n")
    history = lagrange_solve(x -> [2 * x[1], 2 * x[2]], x -> x[1] + x[2] - 1, x -> [1.0, 1.0], [2.0, 2.0]; lr=0.01, lr_lambda=0.01, steps=5000)
    @printf("  %6s  %8s  %8s  %8s  %10s  %10s\n", "Step", "x", "y", "lambda", "g(x,y)", "f(x,y)")
    println("  ", "-"^56)
    for i in filter(m -> m < length(history), [0, 49, 499, 999, 2499, 4999])
        x, lam, gv = history[i+1]
        @printf("  %6d  %8.4f  %8.4f  %8.4f  %10.6f  %10.6f\n", i + 1, x[1], x[2], lam, gv, x[1]^2 + x[2]^2)
    end
    fx, flam, fg = history[end]
    @printf("\n  Final:   x = %.6f, y = %.6f\n", fx[1], fx[2])
    @printf("  lambda = %.6f\n", flam)
    @printf("  Constraint violation: %.2e\n", abs(fg))
    @printf("  Objective value: %.6f\n", fx[1]^2 + fx[2]^2)

    println("\n\n  Problem: minimize f(x,y) = (x-3)^2 + (y-3)^2")
    println("  Subject to: x + 2y = 4\n")
    history2 = lagrange_solve(x -> [2 * (x[1] - 3), 2 * (x[2] - 3)], x -> x[1] + 2 * x[2] - 4, x -> [1.0, 2.0], [0.0, 0.0]; lr=0.002, lr_lambda=0.002, steps=20000)
    x2, lam2, _ = history2[end]
    @printf("  Solution: x = %.6f, y = %.6f\n", x2[1], x2[2])
    @printf("  lambda = %.6f\n", lam2)
    @printf("  Constraint x + 2y = %.6f (target: 4)\n", x2[1] + 2 * x2[2])
    @printf("  Objective: %.6f\n", (x2[1] - 3)^2 + (x2[2] - 3)^2)
    println("\n  Analytical: x = 2, y = 1, lambda = 2")
    @printf("  Error: %.2e\n", sqrt((x2[1] - 2.0)^2 + (x2[2] - 1.0)^2))
end

function demo_regularization_geometry()
    println("\n")
    banner("REGULARIZATION AS CONSTRAINED OPTIMIZATION")
    println()
    println("  Unconstrained minimum of (x-3)^2 + (y-2)^2: (3, 2)\n")
    println("  L2 constraint: x^2 + y^2 <= 1 (unit circle)")
    x_l2 = [3.0 / sqrt(13), 2.0 / sqrt(13)]
    @printf("  Projected solution: (%.6f, %.6f)\n", x_l2[1], x_l2[2])
    @printf("  ||w||^2 = %.6f\n", x_l2[1]^2 + x_l2[2]^2)
    println("  Both weights nonzero: weights shrink but none eliminated\n")
    println("  L1 constraint: |x| + |y| <= 1 (unit diamond)")
    println("  Solution sits at a corner of the diamond.")

    best_val = Inf
    best_x = Float64[]
    for i in 0:1000
        xc = i * 0.001
        yc = 1.0 - xc
        val = (xc - 3)^2 + (yc - 2)^2
        if val < best_val
            best_val, best_x = val, [xc, yc]
        end
    end
    for i in 0:1000
        yc = i * 0.001
        xc = 1.0 - yc
        val = (xc - 3)^2 + (yc - 2)^2
        if val < best_val
            best_val, best_x = val, [xc, yc]
        end
    end
    corners = [([1.0, 0.0], 8.0), ([0.0, 1.0], 10.0), ([-1.0, 0.0], 20.0), ([0.0, -1.0], 18.0)]
    println("  Scanning diamond boundary...")
    @printf("  Best on edges: (%.4f, %.4f), objective = %.4f\n\n", best_x[1], best_x[2], best_val)
    println("  Diamond corners:")
    lowest = minimum(last.(corners))
    for (pt, val) in corners
        @printf("    (%5.1f, %5.1f)  objective = %.1f%s\n", pt[1], pt[2], val, val == lowest ? " <-- best corner" : "")
    end
    println("\n  L1 pushes solution toward corners (axis-aligned).")
    println("  L2 pushes solution toward the nearest point on the circle.")
    println("  L1 produces sparsity. L2 produces small but nonzero weights.")
end

function demo_first_vs_second_order()
    println("\n")
    banner("FIRST-ORDER vs SECOND-ORDER: CONVERGENCE SPEED")
    println()
    rosen(x) = (1 - x[1])^2 + 100 * (x[2] - x[1]^2)^2
    rosen_grad(x) = [-2 * (1 - x[1]) + 200 * (x[2] - x[1]^2) * (-2 * x[1]), 200 * (x[2] - x[1]^2)]
    rosen_hess(x) = [[2 - 400 * x[2] + 1200 * x[1]^2, -400 * x[1]], [-400 * x[1], 200.0]]
    start = [0.5, 0.5]
    println("  Rosenbrock function: f(x,y) = (1-x)^2 + 100(y-x^2)^2")
    println("  Minimum at (1, 1), f = 0")
    @printf("  Start: (%s, %s), f = %.4f\n\n", start[1], start[2], rosen(start))

    newton_hist = newtons_method(rosen_grad, rosen_hess, start; steps=100)
    gd_hist = optimize_gd(rosen_grad, start; lr=0.001, steps=10000)

    println("  Newton's method ($(length(newton_hist) - 1) steps):")
    @printf("  %6s  %10s  %10s  %14s\n", "Step", "x", "y", "f(x,y)")
    println("  ", "-"^44)
    for (i, p) in enumerate(newton_hist[1:min(15, end)])
        @printf("  %6d  %10.6f  %10.6f  %14.8f\n", i - 1, p[1], p[2], rosen(p))
    end
    if length(newton_hist) > 15
        p = newton_hist[end]
        @printf("  %6d  %10.6f  %10.6f  %14.8f\n", length(newton_hist) - 1, p[1], p[2], rosen(p))
    end
    println()

    gd_converge_step = length(gd_hist) - 1
    for (i, p) in enumerate(gd_hist)
        if rosen(p) < 1e-6
            gd_converge_step = i - 1
            break
        end
    end
    println("  Gradient descent (lr=0.001, $(length(gd_hist) - 1) steps):")
    @printf("  %6s  %10s  %10s  %14s\n", "Step", "x", "y", "f(x,y)")
    println("  ", "-"^44)
    for i in filter(s -> s < length(gd_hist), [0, 10, 100, 500, 1000, 2000, 5000, 9999])
        p = gd_hist[i+1]
        @printf("  %6d  %10.6f  %10.6f  %14.8f\n", i, p[1], p[2], rosen(p))
    end
    println("\n  Newton converged (f < 1e-12) in $(length(newton_hist) - 1) steps")
    if gd_converge_step < length(gd_hist) - 1
        println("  GD converged (f < 1e-06) in $gd_converge_step steps")
    else
        @printf("  GD did not reach f < 1e-06 in %d steps (final: %.2e)\n", length(gd_hist) - 1, rosen(gd_hist[end]))
    end
    println("\n  Newton uses O(n^3) per step but converges quadratically.")
    println("  GD uses O(n) per step but converges linearly.")
    println("  For small problems, Newton wins. For millions of parameters, GD wins.")
end

function demo_convex_vs_nonconvex_landscape()
    println("\n")
    banner("CONVEX vs NON-CONVEX: ASCII LANDSCAPE")
    println("\n  Convex: f(x) = x^2\n")
    for y_level in 10:-1:0
        threshold = y_level * 2.5
        line = "  " * join([abs((x_step * 0.25)^2 - threshold) < 1.3 ? "*" : " " for x_step in -20:20])
        println(line)
    end
    println("  ", "-"^41)
    println("  ", " "^18, "x=0")
    println("  One valley. Gradient descent always finds the bottom.")
    println("\n  Non-convex: f(x) = sin(3x) + 0.1*x^2\n")
    for y_level in 10:-1:0
        threshold = -1.0 + y_level * 0.4
        line = "  " * join([abs(sin(3 * (s * 0.2)) + 0.1 * (s * 0.2)^2 - threshold) < 0.25 ? "*" : " " for s in -25:25])
        println(line)
    end
    println("  ", "-"^51)
    println("  Multiple valleys. Gradient descent may get stuck.")
end

function demo_duality_intuition()
    println("\n")
    banner("DUALITY: PRIMAL vs DUAL")
    println()
    println("  Primal: minimize x^2 + y^2 subject to x + y >= 1")
    println("  Rewrite constraint as: -(x + y - 1) <= 0\n")
    println("  Lagrangian: L = x^2 + y^2 + lambda * (1 - x - y)")
    println("  dL/dx = 2x - lambda = 0  =>  x = lambda/2")
    println("  dL/dy = 2y - lambda = 0  =>  y = lambda/2\n")
    println("  Dual function:")
    println("    d(lambda) = min_x,y [x^2 + y^2 + lambda(1 - x - y)]")
    println("              = (lambda/2)^2 + (lambda/2)^2 + lambda(1 - lambda)")
    println("              = lambda^2/2 + lambda - lambda^2")
    println("              = lambda - lambda^2/2\n")
    println("  Dual problem: maximize lambda - lambda^2/2 s.t. lambda >= 0")
    println("  d'(lambda) = 1 - lambda = 0  =>  lambda* = 1\n")
    lam_star = 1.0
    x_star = y_star = lam_star / 2
    primal_val = x_star^2 + y_star^2
    dual_val = lam_star - lam_star^2 / 2
    println("  Primal solution: x = $x_star, y = $y_star")
    println("  Primal objective: $primal_val")
    println("  Dual objective:   $dual_val")
    println("  Strong duality:   primal = dual = $primal_val")
    println("  Constraint: x + y = $(x_star + y_star) >= 1  (active)")
    println("  Complementary slackness: lambda * (1 - x - y) = $(lam_star * (1 - x_star - y_star))")
end

function print_summary()
    println("\n")
    banner("SUMMARY")
    println()
    println("  1. Convex functions have one valley. Every local min is global.")
    println("  2. The Hessian encodes curvature. PSD Hessian = convex.")
    println("  3. Newton's method uses curvature for faster convergence.")
    println("  4. Lagrange multipliers handle equality constraints.")
    println("  5. KKT conditions handle inequality constraints.")
    println("  6. L1 regularization = diamond constraint = sparsity.")
    println("  7. L2 regularization = circle constraint = weight shrinkage.")
    println("  8. Duality converts hard primal problems into sometimes-easier duals.")
    println("  9. Neural networks are non-convex, but overparameterization and")
    println("     stochastic noise make gradient descent work anyway.")
    println()
end

if abspath(PROGRAM_FILE) == @__FILE__
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
end
