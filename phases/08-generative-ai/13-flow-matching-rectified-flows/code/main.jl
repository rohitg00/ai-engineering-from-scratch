# Lesson: Flow Matching & Rectified Flows (phase 08 / lesson 13)
# Julia port of code/main.py. Julia standard library only.
# Source: phases/08-generative-ai/13-flow-matching-rectified-flows/docs/en.md
# Run: julia code/main.jl

using Printf
using Random

tanh_grad(h) = 1 .- h .^ 2

randn_matrix(rows, cols, rng; scale=0.3) = scale .* randn(rng, rows, cols)

function init_net(in_dim, hidden, out_dim, rng)
    return Dict(
        "W1" => randn_matrix(hidden, in_dim, rng),
        "b1" => zeros(hidden),
        "W2" => randn_matrix(hidden, hidden, rng),
        "b2" => zeros(hidden),
        "W3" => randn_matrix(out_dim, hidden, rng),
        "b3" => zeros(out_dim),
    )
end

function forward(x, t, net)
    inp = [x, t, t * t, sin(2pi * t), cos(2pi * t)]
    h1 = tanh.(net["W1"] * inp .+ net["b1"])
    h2 = tanh.(net["W2"] * h1 .+ net["b2"])
    out = net["W3"] * h2 .+ net["b3"]
    return out[1], (inp=inp, h1=h1, h2=h2)
end

function backward(target, out, cache, net)
    d_out = 2 * (out - target)
    grads = Dict{String,Array{Float64}}()
    grads["b3"] = [d_out]
    grads["W3"] = reshape(d_out .* cache.h2, 1, :)
    d_pre2 = net["W3"][1, :] .* d_out .* tanh_grad(cache.h2)
    grads["b2"] = d_pre2
    grads["W2"] = d_pre2 * cache.h1'
    d_pre1 = (net["W2"]' * d_pre2) .* tanh_grad(cache.h1)
    grads["b1"] = d_pre1
    grads["W1"] = d_pre1 * cache.inp'
    return grads
end

function apply!(net, grads, lr)
    for (k, v) in net
        v .-= lr .* grads[k]
    end
end

sample_data(rng) = rand(rng) < 0.5 ? -2.0 + 0.3 * randn(rng) : 2.0 + 0.3 * randn(rng)

function train!(net, steps, lr, rng)
    for _ in 1:steps
        x0 = sample_data(rng)
        x1 = randn(rng)
        t = rand(rng)
        x_t = t * x1 + (1 - t) * x0
        target = x1 - x0
        pred, cache = forward(x_t, t, net)
        apply!(net, backward(target, pred, cache, net), lr)
    end
end

function sample(net, num_steps, rng)
    x = randn(rng)
    dt = 1.0 / num_steps
    for i in 0:num_steps-1
        t = 1.0 - i * dt
        v, _ = forward(x, t, net)
        x -= dt * v
    end
    return x
end

function histogram(samples; lo=-5.0, hi=5.0, bins=30)
    width = (hi - lo) / bins
    counts = zeros(Int, bins)
    for s in samples
        if lo <= s < hi
            counts[floor(Int, (s - lo) / width)+1] += 1
        end
    end
    peak = max(maximum(counts), 1)
    height = 6
    rows = String[]
    for r in height:-1:1
        thr = peak * r / height
        push!(rows, join(c >= thr ? "#" : " " for c in counts))
    end
    push!(rows, "-"^bins)
    return join(rows, "\n")
end

function main()
    rng = Xoshiro(31)
    net = init_net(5, 24, 1, rng)

    println("=== training flow matching on two-mode mixture ===")
    train!(net, 6000, 0.01, rng)

    println()
    for num_steps in [1, 2, 4, 8, 20]
        samples = [sample(net, num_steps, rng) for _ in 1:500]
        m = sum(samples) / length(samples)
        pos = count(>(0), samples)
        println("=== $num_steps-step Euler integration ===")
        println(histogram(samples))
        @printf("mean %+.2f, left mode = %d, right mode = %d\n", m, 500 - pos, pos)
        println()
    end

    println("takeaway: straight-line flow matching lets Euler work at 4-8 steps.")
    println("          DDPM needs 20+ for similar quality in this toy.")
end

main()
