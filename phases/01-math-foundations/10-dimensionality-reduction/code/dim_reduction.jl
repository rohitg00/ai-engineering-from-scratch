# Lesson: Dimensionality Reduction (phase 01 / lesson 10)
# Julia port of code/dim_reduction.py. Julia standard library only.
# Source: phases/01-math-foundations/10-dimensionality-reduction/docs/en.md
# Run: julia code/dim_reduction.jl

using LinearAlgebra
using Printf
using Random
using Statistics

mutable struct PCA
    n_components::Int
    components::Matrix{Float64}
    mean::Vector{Float64}
    eigenvalues::Vector{Float64}
    explained_variance_ratio::Vector{Float64}
end

PCA(n_components::Int) = PCA(n_components, zeros(0, 0), Float64[], Float64[], Float64[])

function fit!(pca::PCA, X::Matrix{Float64})
    pca.mean = vec(mean(X, dims=1))
    X_centered = X .- pca.mean'
    cov_matrix = Symmetric(cov(X_centered, dims=1))
    eigenvalues, eigenvectors = eigen(cov_matrix)
    sorted_idx = sortperm(eigenvalues, rev=true)
    eigenvalues = eigenvalues[sorted_idx]
    eigenvectors = eigenvectors[:, sorted_idx]
    pca.components = Matrix(eigenvectors[:, 1:pca.n_components]')
    pca.eigenvalues = eigenvalues[1:pca.n_components]
    pca.explained_variance_ratio = pca.eigenvalues ./ sum(eigenvalues)
    return pca
end

transform(pca::PCA, X::Matrix{Float64}) = (X .- pca.mean') * pca.components'

function fit_transform!(pca::PCA, X::Matrix{Float64})
    fit!(pca, X)
    return transform(pca, X)
end

inverse_transform(pca::PCA, X_reduced::Matrix{Float64}) = X_reduced * pca.components .+ pca.mean'

fmt_vec(v) = "[" * join([@sprintf("%.8f", x) for x in v], " ") * "]"

function demo_synthetic(rng)
    println("="^60)
    println("PCA on synthetic 3D data")
    println("="^60)

    n_samples = 500
    t = rand(rng, n_samples) .* (2pi)
    x1 = 3 .* cos.(t) .+ 0.2 .* randn(rng, n_samples)
    x2 = 3 .* sin.(t) .+ 0.2 .* randn(rng, n_samples)
    x3 = 0.5 .* x1 .+ 0.3 .* x2 .+ 0.1 .* randn(rng, n_samples)
    X = hcat(x1, x2, x3)

    pca = PCA(2)
    X_reduced = fit_transform!(pca, X)

    println("Original shape: ", size(X))
    println("Reduced shape:  ", size(X_reduced))
    println("Explained variance ratios: ", fmt_vec(pca.explained_variance_ratio))
    @printf("Total variance captured: %.4f\n", sum(pca.explained_variance_ratio))

    X_reconstructed = inverse_transform(pca, X_reduced)
    mse = mean((X .- X_reconstructed) .^ 2)
    @printf("Reconstruction MSE: %.6f\n", mse)
    println()
end

function kernel_pca(X::Matrix{Float64}, n_components::Int; kernel::String="rbf", gamma::Float64=1.0)
    n = size(X, 1)
    if kernel == "rbf"
        sq = vec(sum(X .^ 2, dims=2))
        sq_dists = sq .+ sq' .- 2 .* (X * X')
        K = exp.(-gamma .* sq_dists)
    elseif kernel == "poly"
        K = (X * X' .+ 1) .^ gamma
    else
        K = X * X'
    end

    one_n = fill(1.0 / n, n, n)
    K_centered = K - one_n * K - K * one_n + one_n * K * one_n

    eigenvalues, eigenvectors = eigen(Symmetric(K_centered))
    sorted_idx = sortperm(eigenvalues, rev=true)
    eigenvalues = eigenvalues[sorted_idx]
    eigenvectors = eigenvectors[:, sorted_idx]

    top_vals = eigenvalues[1:n_components]
    top_vecs = eigenvectors[:, 1:n_components]

    for i in 1:n_components
        if top_vals[i] > 1e-10
            top_vecs[:, i] ./= sqrt(top_vals[i])
        end
    end

    return top_vecs .* top_vals'
end

reconstruction_error(X, X_reconstructed) = mean((X .- X_reconstructed) .^ 2)

function demo_kernel_pca(rng)
    println("="^60)
    println("KERNEL PCA: Concentric circles")
    println("="^60)

    n_per_ring = 200
    theta_inner = rand(rng, n_per_ring) .* (2pi)
    r_inner = 1.0 .+ 0.1 .* randn(rng, n_per_ring)
    inner = hcat(r_inner .* cos.(theta_inner), r_inner .* sin.(theta_inner))

    theta_outer = rand(rng, n_per_ring) .* (2pi)
    r_outer = 3.0 .+ 0.1 .* randn(rng, n_per_ring)
    outer = hcat(r_outer .* cos.(theta_outer), r_outer .* sin.(theta_outer))

    X_circles = vcat(inner, outer)
    labels = vcat(zeros(Int, n_per_ring), ones(Int, n_per_ring))

    pca_linear = PCA(1)
    X_linear = fit_transform!(pca_linear, X_circles)

    inner_lin = X_linear[labels .== 0, 1]
    outer_lin = X_linear[labels .== 1, 1]
    inner_range = (minimum(inner_lin), maximum(inner_lin))
    outer_range = (minimum(outer_lin), maximum(outer_lin))

    println("\n  Data: $n_per_ring points per ring, 2 concentric circles")
    println("\n  Linear PCA (1 component):")
    @printf("    Inner ring range: [%.2f, %.2f]\n", inner_range[1], inner_range[2])
    @printf("    Outer ring range: [%.2f, %.2f]\n", outer_range[1], outer_range[2])
    overlap = inner_range[2] > outer_range[1] && outer_range[2] > inner_range[1]
    println("    Overlapping: ", overlap ? "True" : "False", " (linear PCA cannot separate circles)")

    X_kpca = kernel_pca(X_circles, 2; kernel="rbf", gamma=0.5)
    inner_mean = mean(X_kpca[labels .== 0, 1])
    outer_mean = mean(X_kpca[labels .== 1, 1])
    separation = abs(outer_mean - inner_mean)

    println("\n  Kernel PCA (RBF, gamma=0.5, 2 components):")
    @printf("    Inner ring PC1 mean: %.4f\n", inner_mean)
    @printf("    Outer ring PC1 mean: %.4f\n", outer_mean)
    @printf("    Separation on PC1: %.4f\n", separation)
    println("    Kernel PCA separates the circles in the first component")

    for g in [0.1, 0.5, 1.0, 5.0]
        X_k = kernel_pca(X_circles, 2; kernel="rbf", gamma=g)
        inner_m = mean(X_k[labels .== 0, 1])
        outer_m = mean(X_k[labels .== 1, 1])
        sep = abs(outer_m - inner_m)
        @printf("    gamma=%-4s  separation=%.4f\n", string(g), sep)
    end
    println()
end

function demo_reconstruction_error(rng)
    println("="^60)
    println("RECONSTRUCTION ERROR vs NUMBER OF COMPONENTS")
    println("="^60)

    n_samples = 300
    n_features = 20
    n_informative = 5

    base = randn(rng, n_samples, n_informative)
    mixing = randn(rng, n_informative, n_features)
    noise = randn(rng, n_samples, n_features) .* 0.1
    X = base * mixing .+ noise

    println("\n  Data: $n_samples samples, $n_features features, $n_informative informative")
    @printf("\n  %4s  %12s  %14s  %11s\n", "k", "Recon MSE", "Explained Var", "Cumulative")
    @printf("  %s  %s  %s  %s\n", "-"^4, "-"^12, "-"^14, "-"^11)

    for k in [1, 2, 3, 5, 10, 15, 20]
        pca_k = PCA(k)
        X_reduced = fit_transform!(pca_k, X)
        X_reconstructed = inverse_transform(pca_k, X_reduced)
        mse = reconstruction_error(X, X_reconstructed)
        cumulative = sum(pca_k.explained_variance_ratio)
        ev = pca_k.explained_variance_ratio[end]
        @printf("  %4d  %12.4f  %14.6f  %11.4f\n", k, mse, ev, cumulative)
    end

    println("\n  The data is effectively $n_informative-dimensional.")
    println("  After k=$n_informative, reconstruction error drops to near-noise level.")
    println("  Additional components capture only noise variance.")
    println()
end

function main()
    demo_kernel_pca(MersenneTwister(42))
    demo_reconstruction_error(MersenneTwister(42))
    demo_synthetic(MersenneTwister(42))
    println("MNIST, t-SNE, UMAP and logistic-regression demos need sklearn and a download; run the Python file for them.")
end

if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
