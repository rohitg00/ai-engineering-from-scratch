using LinearAlgebra
using Random


function svd_from_scratch(A; k=nothing, max_iters=300, tol=1e-10)
    m, n = size(A)
    if k === nothing
        k = min(m, n)
    end

    sigmas = Float64[]
    us = Vector{Float64}[]
    vs = Vector{Float64}[]

    A_residual = copy(Float64.(A))

    for _ in 1:k
        AtA = A_residual' * A_residual

        v = randn(n)
        v = v / norm(v)

        for _ in 1:max_iters
            Mv = AtA * v
            nrm = norm(Mv)
            if nrm < tol
                break
            end
            v_new = Mv / nrm
            if abs(dot(v_new, v)) > 1 - tol
                v = v_new
                break
            end
            v = v_new
        end

        eigenvalue = dot(v, AtA * v)
        if eigenvalue < tol
            break
        end

        sigma = sqrt(max(eigenvalue, 0))
        u = A_residual * v / sigma
        u = u / norm(u)

        push!(sigmas, sigma)
        push!(us, u)
        push!(vs, v)

        A_residual = A_residual - sigma * u * v'
    end

    U = hcat(us...)
    S = sigmas
    V = hcat(vs...)

    return U, S, V
end


function demo_svd_basics()
    println("=" ^ 70)
    println("SVD FROM SCRATCH vs JULIA BUILT-IN")
    println("=" ^ 70)

    Random.seed!(42)
    A = randn(6, 4)

    println("\nMatrix A (6x4):")
    display(round.(A, digits=4))
    println()

    U_ours, S_ours, V_ours = svd_from_scratch(A)
    F = svd(A)

    println("Our singular values:   $(round.(S_ours, digits=4))")
    println("Julia singular values: $(round.(F.S, digits=4))")

    A_ours = U_ours * Diagonal(S_ours) * V_ours'
    A_jl = F.U * Diagonal(F.S) * F.Vt

    err_ours = norm(A - A_ours)
    err_jl = norm(A - A_jl)
    println("\nReconstruction error (ours):  $err_ours")
    println("Reconstruction error (Julia): $err_jl")

    println("\nVerifying A * v_i = sigma_i * u_i:")
    for i in 1:min(4, length(F.S))
        v_i = F.Vt[i, :]
        u_i = F.U[:, i]
        lhs = A * v_i
        rhs = F.S[i] * u_i
        match = isapprox(lhs, rhs, atol=1e-10) || isapprox(lhs, -rhs, atol=1e-10)
        println("  i=$i: sigma=$(round(F.S[i], digits=4)), match=$match")
    end

    println()
end


function demo_geometry()
    println("=" ^ 70)
    println("SVD GEOMETRY: ROTATE, SCALE, ROTATE")
    println("=" ^ 70)

    A = [3.0 1.0; 1.0 3.0]
    F = svd(A)

    println("\nMatrix A:")
    display(A)
    println()

    println("U (left rotation):")
    display(round.(F.U, digits=4))
    println()

    println("Sigma (scaling): $(round.(F.S, digits=4))")

    println("V^T (right rotation):")
    display(round.(F.Vt, digits=4))
    println()

    println("Verify U is orthogonal (U^T U = I):")
    display(round.(F.U' * F.U, digits=6))
    println()

    theta = range(0, 2pi, length=9)[1:8]
    circle = hcat(cos.(theta), sin.(theta))

    println("Unit circle points through each SVD stage:")
    println("  Point        V^T(p)       Sig*V^T(p)   U*Sig*V^T(p)  Check")
    for i in 1:8
        p = circle[i, :]
        step1 = F.Vt * p
        step2 = F.S .* step1
        step3 = F.U * step2
        direct = A * p
        println("  ($(lpad(round(p[1], digits=2), 5)), $(lpad(round(p[2], digits=2), 5)))  " *
                "($(lpad(round(step1[1], digits=2), 5)), $(lpad(round(step1[2], digits=2), 5)))  " *
                "($(lpad(round(step2[1], digits=2), 6)), $(lpad(round(step2[2], digits=2), 6)))  " *
                "($(lpad(round(step3[1], digits=2), 6)), $(lpad(round(step3[2], digits=2), 6)))  " *
                "($(lpad(round(direct[1], digits=2), 6)), $(lpad(round(direct[2], digits=2), 6)))")
    end

    println()
end


function demo_low_rank()
    println("=" ^ 70)
    println("LOW-RANK APPROXIMATION (ECKART-YOUNG)")
    println("=" ^ 70)

    Random.seed!(42)
    m, n, true_rank = 100, 80, 5

    U_true = Matrix(qr(randn(m, true_rank)).Q)
    V_true = Matrix(qr(randn(n, true_rank)).Q)
    S_true = [50.0, 30.0, 15.0, 8.0, 3.0]
    A = U_true * Diagonal(S_true) * V_true'

    F = svd(A)
    println("\nMatrix shape: ($m, $n), true rank: $true_rank")
    println("Top 10 singular values: $(round.(F.S[1:min(10, length(F.S))], digits=4))")

    A_norm = norm(A)
    println("\n   k       Error    Rel Error     Ratio")
    println("-" ^ 45)
    for k in 1:7
        A_k = F.U[:, 1:k] * Diagonal(F.S[1:k]) * F.Vt[1:k, :]
        err = norm(A - A_k)
        rel = err / A_norm
        storage = k * (m + n + 1)
        ratio = storage / (m * n)
        println("  $(lpad(k, 2))  $(lpad(round(err, digits=4), 10))  $(lpad(round(rel, digits=6), 10))  $(lpad(round(ratio * 100, digits=1), 6))%")
    end

    println()
end


function demo_image_compression()
    println("=" ^ 70)
    println("IMAGE COMPRESSION WITH SVD")
    println("=" ^ 70)

    Random.seed!(42)
    rows, cols = 256, 256

    x = range(-3, 3, length=cols)
    y = range(-3, 3, length=rows)

    image = [sin(xi) * cos(yi) + 0.5 * sin(2xi + yi) for yi in y, xi in x]
    image = (image .- minimum(image)) ./ (maximum(image) - minimum(image)) .* 255

    println("\nSynthetic image: $(rows)x$(cols) = $(rows * cols) values")

    F = svd(image)

    println("\nSingular value spectrum:")
    println("  sigma_1   = $(round(F.S[1], digits=2))")
    println("  sigma_5   = $(round(F.S[5], digits=2))")
    println("  sigma_10  = $(round(F.S[10], digits=2))")
    println("  sigma_50  = $(round(F.S[50], digits=2))")
    println("  sigma_100 = $(round(F.S[100], digits=2))")
    println("  sigma_256 = $(round(F.S[256], digits=6))")

    total_energy = sum(F.S .^ 2)
    println("\nCompression results:")
    println("    k     Storage     Ratio      Energy       RMSE")
    println("-" ^ 55)

    for k in [1, 2, 5, 10, 20, 50, 100, 200]
        compressed = F.U[:, 1:k] * Diagonal(F.S[1:k]) * F.Vt[1:k, :]
        storage = k * (rows + cols + 1)
        ratio = storage / (rows * cols)
        energy = sum(F.S[1:k] .^ 2) / total_energy
        rmse = sqrt(mean((image .- compressed) .^ 2))
        println("  $(lpad(k, 3))  $(lpad(storage, 9))  $(lpad(round(ratio * 100, digits=1), 6))%  $(lpad(round(energy * 100, digits=2), 8))%  $(lpad(round(rmse, digits=4), 8))")
    end

    println()
end


function demo_noise_reduction()
    println("=" ^ 70)
    println("SVD FOR NOISE REDUCTION")
    println("=" ^ 70)

    Random.seed!(42)
    m, n = 100, 80

    t1 = range(0, 4pi, length=m)
    t2 = range(0, 2pi, length=n)
    clean = 5 .* sin.(t1) * cos.(t2)' .+ 3 .* cos.(2 .* t1) * sin.(t2)' .+ 2 .* ones(m) * sin.(3 .* t2)'

    println("\nClean signal: rank $(rank(clean)), shape ($m, $n)")
    clean_norm = norm(clean)

    for noise_std in [0.1, 0.5, 1.0, 2.0]
        noise = noise_std .* randn(m, n)
        noisy = clean .+ noise

        F = svd(noisy)
        noisy_err = norm(noisy - clean) / clean_norm

        println("\n  Noise level sigma=$noise_std:")
        println("    Noisy relative error: $(round(noisy_err, digits=4))")
        println("    Top 10 singular values: $(round.(F.S[1:10], digits=2))")

        best_k = 1
        best_err = Inf
        for k in 1:min(m, n)
            denoised = F.U[:, 1:k] * Diagonal(F.S[1:k]) * F.Vt[1:k, :]
            err = norm(denoised - clean) / clean_norm
            if err < best_err
                best_err = err
                best_k = k
            end
        end

        improvement = 1 - best_err / noisy_err

        println("    Best truncation rank: k=$best_k")
        println("    Denoised relative error: $(round(best_err, digits=4))")
        println("    Improvement: $(round(improvement * 100, digits=1))%")
    end

    println()
end


function demo_pseudoinverse()
    println("=" ^ 70)
    println("PSEUDOINVERSE VIA SVD")
    println("=" ^ 70)

    println("\n--- Overdetermined system (least squares) ---")
    A = Float64[1 1; 2 1; 3 1]
    b = Float64[3, 5, 6]

    println("A:")
    display(A)
    println()
    println("b: $b")

    F = svd(A)
    S_inv = Diagonal(1.0 ./ F.S)
    A_pinv = F.V * S_inv * F.U'

    x_svd = A_pinv * b
    x_backslash = A \ b
    x_pinv = pinv(A) * b

    println("SVD pseudoinverse solution:  $(round.(x_svd, digits=6))")
    println("Backslash solution:          $(round.(x_backslash, digits=6))")
    println("pinv() solution:             $(round.(x_pinv, digits=6))")

    residual = A * x_svd - b
    println("Residual norm: $(round(norm(residual), digits=6))")

    println("\n--- Underdetermined system (minimum norm) ---")
    A2 = Float64[1 2 3; 4 5 6]
    b2 = Float64[14, 32]

    A2_pinv = pinv(A2)
    x_min = A2_pinv * b2
    println("Minimum-norm solution: $(round.(x_min, digits=6))")
    println("Verify A x = b: $(round.(A2 * x_min, digits=6))")
    println("Solution norm: $(round(norm(x_min), digits=6))")

    println()
end


function demo_condition_number()
    println("=" ^ 70)
    println("CONDITION NUMBER AND NUMERICAL STABILITY")
    println("=" ^ 70)

    matrices = [
        ("Well-conditioned", Float64[2 1; 1 2]),
        ("Moderate", Float64[10 7; 7 5]),
        ("Ill-conditioned", Float64[1 1; 1 1.0001]),
        ("Nearly singular", Float64[1 2; 0.5 1.00001]),
    ]

    println("\n$(rpad("Name", 20))  $(lpad("sigma_max", 10))  $(lpad("sigma_min", 10))  $(lpad("Condition", 12))")
    println("-" ^ 58)

    for (name, A) in matrices
        F = svd(A)
        s_max = F.S[1]
        s_min = F.S[end]
        cond_num = s_min > 1e-15 ? s_max / s_min : Inf
        println("$(rpad(name, 20))  $(lpad(round(s_max, digits=4), 10))  $(lpad(round(s_min, digits=6), 10))  $(lpad(round(cond_num, digits=1), 12))")
    end

    println("\nComparing SVD vs eigendecomposition stability:")
    A = Float64[1 1; 1 1.0001]
    F = svd(A)
    AtA = A' * A
    eig_vals = eigvals(Symmetric(AtA))

    println("  A singular values:     $(F.S)")
    println("  A condition number:    $(round(F.S[1] / F.S[2], digits=1))")
    println("  A^T A eigenvalues:     $(eig_vals)")
    println("  A^T A condition number: $(round(eig_vals[end] / eig_vals[1], digits=1))")
    println("  (Squared! Direct SVD avoids this.)")

    println()
end


function demo_pca_is_svd()
    println("=" ^ 70)
    println("PCA IS SVD ON CENTERED DATA")
    println("=" ^ 70)

    Random.seed!(42)
    n_samples = 200
    n_features = 5

    mu = Float64[10, 20, 30, 40, 50]
    C = Float64[
        5.0 2.0 1.0 0.5 0.1;
        2.0 4.0 1.5 0.3 0.2;
        1.0 1.5 3.0 0.8 0.4;
        0.5 0.3 0.8 2.0 0.6;
        0.1 0.2 0.4 0.6 1.0
    ]

    L = cholesky(Symmetric(C)).L
    X = randn(n_samples, n_features) * L' .+ mu'

    X_centered = X .- mean(X, dims=1)

    cov_matrix = (X_centered' * X_centered) / (n_samples - 1)
    eig_result = eigen(Symmetric(cov_matrix))
    idx = sortperm(eig_result.values, rev=true)
    eig_vals = eig_result.values[idx]
    eig_vecs = eig_result.vectors[:, idx]

    F = svd(X_centered)
    svd_variance = F.S .^ 2 ./ (n_samples - 1)

    println("\nData: $n_samples samples, $n_features features")
    println("\nPCA via eigendecomposition of covariance matrix:")
    println("  Eigenvalues:  $(round.(eig_vals, digits=4))")
    println("  PC1 direction: $(round.(eig_vecs[:, 1], digits=4))")

    println("\nPCA via SVD of centered data:")
    println("  S^2/(n-1):    $(round.(svd_variance[1:n_features], digits=4))")
    println("  V1 direction:  $(round.(F.Vt[1, :], digits=4))")

    variance_match = isapprox(eig_vals, svd_variance[1:n_features], atol=1e-8)
    direction_match = all(
        isapprox(abs.(eig_vecs[:, i]), abs.(F.Vt[i, :]), atol=1e-8)
        for i in 1:n_features
    )

    println("\n  Variances match: $variance_match")
    println("  Directions match (up to sign): $direction_match")

    explained = svd_variance[1:n_features] ./ sum(svd_variance[1:n_features])
    cumulative = cumsum(explained)
    println("\n  Explained variance ratio: $(round.(explained, digits=4))")
    println("  Cumulative:               $(round.(cumulative, digits=4))")

    println()
end


function demo_matrix_properties()
    println("=" ^ 70)
    println("MATRIX PROPERTIES REVEALED BY SVD")
    println("=" ^ 70)

    A = Float64[1 2 3; 4 5 6; 7 8 9]
    F = svd(A)

    println("\nMatrix A:")
    display(A)
    println()
    println("Singular values: $(round.(F.S, digits=6))")

    println("\nRank (non-zero singular values): $(sum(F.S .> 1e-10))")
    println("  (3x3 matrix but only rank 2: rows are linearly dependent)")

    println("\nFrobenius norm: $(round(norm(A), digits=6))")
    println("  sqrt(sum(sigma_i^2)): $(round(sqrt(sum(F.S .^ 2)), digits=6))")

    println("\nSpectral norm (largest singular value): $(round(F.S[1], digits=6))")
    println("  opnorm(A): $(round(opnorm(A), digits=6))")

    println("\nNuclear norm (sum of singular values): $(round(sum(F.S), digits=6))")

    B = Float64[3 1; 1 3]
    F_b = svd(B)
    println("\nSquare matrix B:")
    display(B)
    println()
    println("Singular values: $(F_b.S)")
    println("det(B) = $(round(det(B), digits=4))")
    println("Product of singular values: $(round(prod(F_b.S), digits=4))")
    println("  (|det| = product of singular values for square matrices)")

    println()
end


function demo_recommendation()
    println("=" ^ 70)
    println("SVD FOR RECOMMENDATION SYSTEMS")
    println("=" ^ 70)

    Random.seed!(42)
    n_users = 8
    n_movies = 6
    n_factors = 2

    user_prefs = randn(n_users, n_factors)
    movie_attrs = randn(n_movies, n_factors)

    true_ratings = user_prefs * movie_attrs'
    true_ratings = (true_ratings .- minimum(true_ratings)) ./ (maximum(true_ratings) - minimum(true_ratings)) .* 4 .+ 1
    true_ratings = round.(true_ratings, digits=1)

    mask = rand(n_users, n_movies) .> 0.4
    observed = copy(true_ratings)
    observed[.!mask] .= NaN

    println("\nRatings matrix ($n_users users x $n_movies movies):")
    movie_names = ["Act1", "Com1", "Dra1", "Act2", "Com2", "Dra2"]
    header = "        " * join([lpad(m, 6) for m in movie_names])
    println(header)
    for i in 1:n_users
        row = "User $i  "
        for j in 1:n_movies
            if mask[i, j]
                row *= lpad(round(observed[i, j], digits=1), 6)
            else
                row *= lpad("?", 6)
            end
        end
        println(row)
    end

    filled = copy(observed)
    for i in 1:n_users
        row_vals = filter(!isnan, filled[i, :])
        row_mean = isempty(row_vals) ? 3.0 : mean(row_vals)
        for j in 1:n_movies
            if isnan(filled[i, j])
                filled[i, j] = row_mean
            end
        end
    end

    F = svd(filled)
    k = n_factors
    predicted = F.U[:, 1:k] * Diagonal(F.S[1:k]) * F.Vt[1:k, :]

    println("\nRank-$k SVD predictions for missing entries:")
    errors = Float64[]
    for i in 1:n_users
        for j in 1:n_movies
            if !mask[i, j]
                err = abs(predicted[i, j] - true_ratings[i, j])
                push!(errors, err)
                println("  User $i, Movie $(movie_names[j]): " *
                        "predicted=$(round(predicted[i, j], digits=2)), " *
                        "true=$(true_ratings[i, j]), " *
                        "error=$(round(err, digits=2))")
            end
        end
    end

    println("\nMean absolute error: $(round(mean(errors), digits=3))")
    energy = sum(F.S[1:k] .^ 2) / sum(F.S .^ 2)
    println("Energy captured by rank-$k: $(round(energy * 100, digits=1))%")

    println()
end


println("\n" * "=" ^ 70)
println("SINGULAR VALUE DECOMPOSITION IN JULIA")
println("=" ^ 70)
println()

demo_svd_basics()
demo_geometry()
demo_low_rank()
demo_image_compression()
demo_noise_reduction()
demo_pseudoinverse()
demo_condition_number()
demo_pca_is_svd()
demo_matrix_properties()
demo_recommendation()
