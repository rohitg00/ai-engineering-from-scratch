# Lesson: Differential Privacy for LLMs (phase 18 / lesson 22)
# Julia port of code/main.py. Julia standard library only.
# Source: phases/18-ethics-safety-alignment/22-differential-privacy-for-llms/docs/en.md
# Run: julia code/main.jl

using LinearAlgebra
using Printf
using Random

const RNG = Xoshiro(59)

sigmoid(z::Float64) = 1.0 / (1.0 + exp(-z))

gauss(mu::Float64, sigma::Float64) = mu + sigma * randn(RNG)

function gen(n::Int)
    data = Tuple{Vector{Float64},Int}[]
    for _ in 1:n
        x = [gauss(0.0, 1.0), gauss(0.0, 1.0)]
        y = 0.6 * x[1] - 0.4 * x[2] > 0 ? 1 : 0
        push!(data, (x, y))
    end
    return data
end

function clip(g::Vector{Float64}, C::Float64)
    n = norm(g)
    return n <= C ? g : g .* (C / n)
end

function dp_sgd(data, epochs::Int, lr::Float64, sigma::Float64, C::Float64)
    w = [0.0, 0.0]
    b = 0.0
    for _ in 1:epochs
        shuffle!(RNG, data)
        for (x, y) in data
            z = b + dot(w, x)
            err = sigmoid(z) - y
            grad_w = clip(err .* x, C)
            grad_b = clamp(err, -C, C)
            noise_w = [gauss(0.0, sigma * C) for _ in 1:2]
            noise_b = gauss(0.0, sigma * C)
            w = w .- lr .* (grad_w .+ noise_w)
            b -= lr * (grad_b + noise_b)
        end
    end
    return vcat(w, b)
end

function accuracy(model::Vector{Float64}, data)
    w, b = model[1:2], model[3]
    correct = count(((x, y),) -> (b + dot(w, x) > 0 ? 1 : 0) == y, data)
    return correct / length(data)
end

function analytical_epsilon(sigma::Float64, steps::Int; delta::Float64=1e-5)
    return sqrt(2 * log(1.25 / delta)) * sqrt(steps) / sigma
end

function main()
    println("="^70)
    println("DP-SGD TOY (Phase 18, Lesson 22)")
    println("="^70)

    train_data = gen(500)
    test_data = gen(200)
    epochs = 10
    C = 1.0
    delta = 1e-5

    for sigma in (0.0, 0.5, 1.0, 2.0, 4.0)
        model = dp_sgd(train_data, epochs, 0.05, sigma, C)
        acc = accuracy(model, test_data)
        eps_text = sigma > 0 ? @sprintf("%7.2f", analytical_epsilon(sigma, epochs; delta=delta)) : lpad("inf", 7)
        @printf("  sigma=%4.1f  approx-epsilon=%s  test-accuracy=%.3f\n", sigma, eps_text, acc)
    end

    println("\n", "="^70)
    println("TAKEAWAY: sigma=0 is standard SGD with no privacy (infinite epsilon).")
    println("increasing sigma adds noise, shrinks epsilon, and costs accuracy.")
    println("real deployments target epsilon in [1, 10] via accountants like")
    println("Moments Accountant. Nasr et al. 2025 shows extraction-based threats")
    println("persist under moderate epsilon -- DP is necessary but not sufficient.")
    println("="^70)
end

main()
