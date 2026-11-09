# Lesson: Linear Systems (phase 01 / lesson 17)
# Julia port of code/linear_systems.py. Julia standard library only.
# Source: phases/01-math-foundations/17-linear-systems/docs/en.md
# Run: julia code/linear_systems.jl

using LinearAlgebra
using Printf
using Random
using Statistics

function gaussian_elimination(A::Matrix{Float64}, b::Vector{Float64})
    n = length(b)
    Ab = hcat(copy(A), copy(b))
    for k in 1:n
        max_row = k - 1 + argmax(abs.(Ab[k:end, k]))
        Ab[[k, max_row], :] = Ab[[max_row, k], :]
        if abs(Ab[k, k]) < 1e-12
            error("Matrix is singular at pivot $(k - 1)")
        end
        for i in k+1:n
            m = Ab[i, k] / Ab[k, k]
            Ab[i, k:end] .-= m .* Ab[k, k:end]
        end
    end
    x = zeros(n)
    for i in n:-1:1
        x[i] = (Ab[i, end] - dot(Ab[i, i+1:n], x[i+1:n])) / Ab[i, i]
    end
    return x
end

function lu_decompose(A::Matrix{Float64})
    n = size(A, 1)
    L = Matrix{Float64}(I, n, n)
    U = copy(A)
    P = Matrix{Float64}(I, n, n)
    for k in 1:n
        max_row = k - 1 + argmax(abs.(U[k:end, k]))
        if max_row != k
            U[[k, max_row], :] = U[[max_row, k], :]
            P[[k, max_row], :] = P[[max_row, k], :]
            if k > 1
                L[[k, max_row], 1:k-1] = L[[max_row, k], 1:k-1]
            end
        end
        for i in k+1:n
            L[i, k] = U[i, k] / U[k, k]
            U[i, k:end] .-= L[i, k] .* U[k, k:end]
        end
    end
    return P, L, U
end

function lu_solve(P, L, U, b::Vector{Float64})
    n = length(b)
    Pb = P * b
    y = zeros(n)
    for i in 1:n
        y[i] = Pb[i] - dot(L[i, 1:i-1], y[1:i-1])
    end
    x = zeros(n)
    for i in n:-1:1
        x[i] = (y[i] - dot(U[i, i+1:end], x[i+1:end])) / U[i, i]
    end
    return x
end

function cholesky_lower(A::Matrix{Float64})
    n = size(A, 1)
    L = zeros(n, n)
    for i in 1:n
        for j in 1:i
            s = A[i, j] - dot(L[i, 1:j-1], L[j, 1:j-1])
            if i == j
                s <= 0 && error("Matrix is not positive definite")
                L[i, j] = sqrt(s)
            else
                L[i, j] = s / L[j, j]
            end
        end
    end
    return L
end

function cholesky_solve(L::Matrix{Float64}, b::Vector{Float64})
    n = length(b)
    y = zeros(n)
    for i in 1:n
        y[i] = (b[i] - dot(L[i, 1:i-1], y[1:i-1])) / L[i, i]
    end
    x = zeros(n)
    Lt = Matrix(L')
    for i in n:-1:1
        x[i] = (y[i] - dot(Lt[i, i+1:end], x[i+1:end])) / Lt[i, i]
    end
    return x
end

least_squares_normal(A, b) = gaussian_elimination(Matrix(A' * A), A' * b)

function ridge_regression(A, b, lam)
    n = size(A, 2)
    AtA = A' * A + lam * I(n)
    return cholesky_solve(cholesky_lower(Matrix(AtA)), A' * b)
end

function condition_number(A)
    S = svdvals(A)
    if S[end] == 0 || S[end] <= S[1] * eps(Float64)^2
        return Inf
    end
    return S[1] / S[end]
end

function conjugate_gradient(A, b; tol=1e-10, max_iter=nothing)
    n = length(b)
    max_iter = max_iter === nothing ? n : max_iter
    x = zeros(n)
    r = b - A * x
    p = copy(r)
    rs_old = dot(r, r)
    sqrt(rs_old) < tol && return x, 0
    for k in 1:max_iter
        Ap = A * p
        alpha = rs_old / dot(p, Ap)
        x = x + alpha * p
        r = r - alpha * Ap
        rs_new = dot(r, r)
        sqrt(rs_new) < tol && return x, k
        p = r + (rs_new / rs_old) * p
        rs_old = rs_new
    end
    return x, max_iter
end

fnum(x) = x == round(x) && abs(x) < 1e15 ? string(round(x; digits=1)) : string(x)
fvec(v) = "[" * join(fnum.(v), " ") * "]"
fvec(v, d) = fvec(round.(v; digits=d) .+ 0.0)
fmat(M) = "[" * join([fvec(M[i, :]) for i in 1:size(M, 1)], "\n ") * "]"
fmat(M, d) = fmat(round.(M; digits=d) .+ 0.0)
sci(x) = @sprintf("%.2e", x)
maxabs(a) = maximum(abs.(a))

function header(title)
    println("="^60)
    println(title)
    println("="^60)
end

function demo_gaussian_elimination()
    header("Gaussian Elimination with Partial Pivoting")
    A = [2.0 1 1; 4 3 3; 2 3 1]
    b = [8.0, 20, 12]
    x_ours = gaussian_elimination(A, b)
    x_lib = A \ b
    println("A =\n", fmat(A))
    println("b = ", fvec(b))
    println("Solution (ours):  ", fvec(x_ours))
    println("Solution (stdlib): ", fvec(x_lib))
    println("Max difference: ", sci(maxabs(x_ours - x_lib)))
    println("Residual ||Ax - b||: ", sci(norm(A * x_ours - b)))
    println()
end

function demo_lu()
    header("LU Decomposition")
    A = [2.0 1 1; 4 3 3; 2 3 1]
    b = [8.0, 20, 12]
    P, L, U = lu_decompose(A)
    println("P =\n", fmat(P))
    println("L =\n", fmat(L))
    println("U =\n", fmat(U))
    println("PA = LU reconstruction error: ", sci(maxabs(A - P' * L * U)))
    println("Solution: ", fvec(lu_solve(P, L, U, b)))
    println("\nSolving 3 different right-hand sides with the same LU:")
    for b_i in ([1.0, 0, 0], [0.0, 1, 0], [0.0, 0, 1])
        println("  b = ", fvec(b_i), " -> x = ", fvec(lu_solve(P, L, U, b_i), 4))
    end
    println()
end

function demo_cholesky()
    header("Cholesky Decomposition")
    A = [4.0 2 1; 2 5 3; 1 3 6]
    L = cholesky_lower(A)
    println("A =\n", fmat(A))
    println("L =\n", fmat(L, 4))
    println("L @ L^T =\n", fmat(L * L', 4))
    println("Reconstruction error: ", sci(maxabs(A - L * L')))
    println("Max diff from stdlib cholesky: ", sci(maxabs(L - cholesky(A).L)))
    b = [7.0, 10, 10]
    println("\nSolve Ax = b:")
    println("  x (ours):   ", fvec(cholesky_solve(L, b), 4))
    println("  x (stdlib): ", fvec(A \ b, 4))
    println("\nLog determinant via Cholesky:")
    @printf("  2 * sum(log(diag(L))) = %.6f\n", 2 * sum(log.(diag(L))))
    @printf("  log(det(A))           = %.6f\n", log(det(A)))
    println()
end

function regression_data(rng)
    n_samples, n_features = 100, 3
    w_true = [2.0, -1.0, 0.5]
    X_raw = randn(rng, n_samples, n_features)
    noise = randn(rng, n_samples) .* 0.1
    y = X_raw * w_true + noise
    return hcat(ones(n_samples), X_raw), y
end

function demo_least_squares()
    header("Least Squares = Linear Regression")
    X, y = regression_data(MersenneTwister(42))
    w_ols = least_squares_normal(X, y)
    w_lib = X \ y
    println("True weights:          ", fvec([0.0, 2.0, -1.0, 0.5]))
    println("OLS weights (ours):    ", fvec(w_ols, 4))
    println("OLS weights (stdlib):  ", fvec(w_lib, 4))
    println("Max difference: ", sci(maxabs(w_ols - w_lib)))
    @printf("Residual norm: %.4f\n", norm(X * w_ols - y))
    println()
end

function demo_ridge()
    header("Ridge Regression (Regularized Least Squares)")
    X, y = regression_data(MersenneTwister(42))
    for lam in (0.0, 0.1, 1.0, 10.0)
        w = lam == 0.0 ? least_squares_normal(X, y) : ridge_regression(X, y, lam)
        @printf("lambda=%5.1f  w=%s  ||w||=%.3f  ||Xw-y||=%.3f\n", lam, fvec(w, 3), norm(w), norm(X * w - y))
    end
    println("\nCompare with the closed form (X^T X + lambda I) \\ X^T y:")
    for lam in (0.1, 1.0, 10.0)
        w_ours = ridge_regression(X, y, lam)
        w_ref = (X' * X + lam * I) \ (X' * y)
        @printf("  lambda=%5.1f  max diff from closed form: %s\n", lam, sci(maxabs(w_ours - w_ref)))
    end
    println()
end

function demo_condition_number()
    header("Condition Number")
    @printf("Well-conditioned: kappa = %.1f\n", condition_number([2.0 0; 0 1]))
    @printf("Ill-conditioned:  kappa = %s\n", sci(condition_number([1.0 1; 1 1+1e-10])))
    rng = MersenneTwister(42)
    X = randn(rng, 100, 5)
    println("\nRandom 100x5 matrix:")
    @printf("  kappa(X)     = %.2f\n", condition_number(X))
    @printf("  kappa(X^T X) = %.2f\n", condition_number(X' * X))
    X_collinear = copy(X)
    X_collinear[:, 5] = X_collinear[:, 1] + 1e-8 * randn(rng, 100)
    println("\nWith near-collinear feature:")
    @printf("  kappa(X)     = %s\n", sci(condition_number(X_collinear)))
    @printf("  kappa(X^T X) = %s\n", sci(condition_number(X_collinear' * X_collinear)))
    lam = 0.01
    XtX_reg = X_collinear' * X_collinear + lam * I
    println("\nAfter regularization (lambda=$lam):")
    @printf("  kappa(X^T X + lambda I) = %.2f\n", condition_number(XtX_reg))
    println()
end

function demo_conjugate_gradient()
    header("Conjugate Gradient")
    rng = MersenneTwister(42)
    n = 50
    M = randn(rng, n, n)
    A = M' * M + 0.1 * I
    b = randn(rng, n)
    x_cg, iters = conjugate_gradient(A, b; tol=1e-10)
    x_direct = A \ b
    println("System size: $n")
    println("CG iterations: $iters (max possible: $n)")
    println("Max diff from direct solve: ", sci(maxabs(x_cg - x_direct)))
    println("Residual norm: ", sci(norm(A * x_cg - b)))
    @printf("Condition number: %.2f\n", condition_number(A))
    A_well = I + 0.1 * M' * M / n
    b_well = randn(rng, n)
    _, iters2 = conjugate_gradient(A_well, b_well; tol=1e-10)
    println("\nBetter-conditioned system:")
    @printf("  kappa = %.2f\n", condition_number(A_well))
    println("  CG iterations: $iters2")
    println()
end

function demo_equivalence()
    header("All Methods Agree: Gaussian, LU, Cholesky, Normal Eq, stdlib")
    rng = MersenneTwister(42)
    n = 5
    M = randn(rng, n, n)
    A = Matrix(M' * M + I)
    b = randn(rng, n)
    x_gauss = gaussian_elimination(A, b)
    P, L, U = lu_decompose(A)
    x_lu = lu_solve(P, L, U, b)
    x_chol = cholesky_solve(cholesky_lower(A), b)
    x_lib = A \ b
    x_cg, _ = conjugate_gradient(A, b; tol=1e-12)
    println("Gaussian:  ", fvec(x_gauss, 6))
    println("LU:        ", fvec(x_lu, 6))
    println("Cholesky:  ", fvec(x_chol, 6))
    println("stdlib:    ", fvec(x_lib, 6))
    println("CG:        ", fvec(x_cg, 6))
    println("\nAll within tolerance:")
    for (name, x) in (("LU", x_lu), ("Cholesky", x_chol), ("stdlib", x_lib), ("CG", x_cg))
        @printf("  Gaussian vs %10s: %s\n", name, sci(maxabs(x_gauss - x)))
    end
    println()
end

function demo_linear_regression_full()
    header("Full Pipeline: Linear Regression from Scratch")
    rng = MersenneTwister(0)
    n_samples = 200
    x1 = rand(rng, n_samples) .* 10
    x2 = rand(rng, n_samples) .* 5
    noise = randn(rng, n_samples) .* 0.5
    y = 3.0 .* x1 .- 2.0 .* x2 .+ 7.0 .+ noise
    X = hcat(ones(n_samples), x1, x2)
    println("Data: $n_samples samples, $(size(X, 2)) features (with intercept)")
    println("True weights: [7.0, 3.0, -2.0]")
    @printf("Condition number of X^T X: %.2f\n", condition_number(X' * X))
    w_normal = least_squares_normal(X, y)
    println("\nNormal equations:     ", fvec(w_normal, 4))
    w_chol = cholesky_solve(cholesky_lower(Matrix(X' * X)), X' * y)
    println("Cholesky:             ", fvec(w_chol, 4))
    println("stdlib X \\ y:         ", fvec(X \ y, 4))
    y_pred = X * w_normal
    mse = mean((y - y_pred) .^ 2)
    r2 = 1 - sum((y - y_pred) .^ 2) / sum((y .- mean(y)) .^ 2)
    @printf("\nMSE:  %.4f\n", mse)
    @printf("R^2:  %.4f\n", r2)
    println()
end

if abspath(PROGRAM_FILE) == @__FILE__
    demo_gaussian_elimination()
    demo_lu()
    demo_cholesky()
    demo_least_squares()
    demo_ridge()
    demo_condition_number()
    demo_conjugate_gradient()
    demo_equivalence()
    demo_linear_regression_full()
end
