# Lesson: Optimizers (phase 03 / lesson 06)
# Julia port of code/main.py. Julia standard library only.
# Source: phases/03-deep-learning-core/06-optimizers/docs/en.md
# Run: julia code/main.jl

using Random
using Printf

abstract type Optimizer end

struct SGD <: Optimizer
    lr::Float64
end
SGD(; lr=0.01) = SGD(lr)

function step!(opt::SGD, params, grads)
    for i in eachindex(params)
        params[i] -= opt.lr * grads[i]
    end
end

mutable struct SGDMomentum <: Optimizer
    lr::Float64
    beta::Float64
    velocities::Union{Nothing,Vector{Float64}}
end
SGDMomentum(; lr=0.01, beta=0.9) = SGDMomentum(lr, beta, nothing)

function step!(opt::SGDMomentum, params, grads)
    opt.velocities === nothing && (opt.velocities = zeros(length(params)))
    for i in eachindex(params)
        opt.velocities[i] = opt.beta * opt.velocities[i] + grads[i]
        params[i] -= opt.lr * opt.velocities[i]
    end
end

mutable struct Adam <: Optimizer
    lr::Float64
    beta1::Float64
    beta2::Float64
    epsilon::Float64
    weight_decay::Float64
    decoupled::Bool
    m::Union{Nothing,Vector{Float64}}
    v::Union{Nothing,Vector{Float64}}
    t::Int
end
Adam(; lr=0.001, beta1=0.9, beta2=0.999, epsilon=1e-8) = Adam(lr, beta1, beta2, epsilon, 0.0, false, nothing, nothing, 0)
AdamW(; lr=0.001, beta1=0.9, beta2=0.999, epsilon=1e-8, weight_decay=0.01) =
    Adam(lr, beta1, beta2, epsilon, weight_decay, true, nothing, nothing, 0)

function step!(opt::Adam, params, grads)
    if opt.m === nothing
        opt.m = zeros(length(params))
        opt.v = zeros(length(params))
    end
    opt.t += 1
    for i in eachindex(params)
        opt.m[i] = opt.beta1 * opt.m[i] + (1 - opt.beta1) * grads[i]
        opt.v[i] = opt.beta2 * opt.v[i] + (1 - opt.beta2) * grads[i]^2
        m_hat = opt.m[i] / (1 - opt.beta1^opt.t)
        v_hat = opt.v[i] / (1 - opt.beta2^opt.t)
        if opt.decoupled
            params[i] = params[i] * (1 - opt.weight_decay * opt.lr)
        end
        params[i] -= opt.lr * m_hat / (sqrt(v_hat) + opt.epsilon)
    end
end

sigmoid(x) = 1.0 / (1.0 + exp(-clamp(x, -500, 500)))

uniform(lo, hi) = lo + (hi - lo) * rand()
gauss(mu, sigma) = mu + sigma * randn()

function make_circle_data(; n=200, seed=42)
    Random.seed!(seed)
    data = Tuple{Vector{Float64},Float64}[]
    for _ in 1:n
        x = uniform(-2, 2)
        y = uniform(-2, 2)
        label = x * x + y * y < 1.5 ? 1.0 : 0.0
        push!(data, ([x, y], label))
    end
    return data
end

mutable struct OptimizerTestNetwork
    hidden_size::Int
    optimizer::Optimizer
    w1::Matrix{Float64}
    b1::Vector{Float64}
    w2::Vector{Float64}
    b2::Float64
    x::Vector{Float64}
    z1::Vector{Float64}
    h::Vector{Float64}
    out::Float64
end

function OptimizerTestNetwork(optimizer; hidden_size=8)
    Random.seed!(0)
    w1 = zeros(hidden_size, 2)
    for i in 1:hidden_size, j in 1:2
        w1[i, j] = gauss(0, 0.5)
    end
    w2 = [gauss(0, 0.5) for _ in 1:hidden_size]
    return OptimizerTestNetwork(hidden_size, optimizer, w1, zeros(hidden_size), w2, 0.0,
        Float64[], Float64[], Float64[], 0.0)
end

get_params(net) = vcat(vec(permutedims(net.w1)), net.b1, net.w2, net.b2)

function set_params!(net, params)
    n = net.hidden_size
    net.w1 .= permutedims(reshape(params[1:2n], 2, n))
    net.b1 .= params[2n+1:3n]
    net.w2 .= params[3n+1:4n]
    net.b2 = params[4n+1]
end

function forward!(net, x)
    net.x = x
    net.z1 = [net.w1[i, 1] * x[1] + net.w1[i, 2] * x[2] + net.b1[i] for i in 1:net.hidden_size]
    net.h = max.(0.0, net.z1)
    z2 = sum(net.w2[i] * net.h[i] for i in 1:net.hidden_size) + net.b2
    net.out = sigmoid(z2)
    return net.out
end

function compute_grads(net, target)
    eps = 1e-15
    p = clamp(net.out, eps, 1 - eps)
    d_loss = -(target / p) + (1 - target) / (1 - p)
    d_out = d_loss * net.out * (1 - net.out)
    n = net.hidden_size
    grads = zeros(4n + 1)
    idx = 1
    for i in 1:n
        d_h = d_out * net.w2[i] * (net.z1[i] > 0 ? 1.0 : 0.0)
        grads[idx] = d_h * net.x[1]
        grads[idx+1] = d_h * net.x[2]
        idx += 2
    end
    for i in 1:n
        grads[idx] = d_out * net.w2[i] * (net.z1[i] > 0 ? 1.0 : 0.0)
        idx += 1
    end
    for i in 1:n
        grads[idx] = d_out * net.h[i]
        idx += 1
    end
    grads[idx] = d_out
    return grads
end

function train!(net, data; epochs=300)
    losses = Tuple{Float64,Float64}[]
    for epoch in 0:epochs-1
        total_loss = 0.0
        correct = 0
        for (x, y) in data
            pred = forward!(net, x)
            grads = compute_grads(net, y)
            params = get_params(net)
            step!(net.optimizer, params, grads)
            set_params!(net, params)
            p = clamp(pred, 1e-15, 1 - 1e-15)
            total_loss += -(y * log(p) + (1 - y) * log(1 - p))
            (pred >= 0.5) == (y >= 0.5) && (correct += 1)
        end
        avg_loss = total_loss / length(data)
        accuracy = correct / length(data) * 100
        push!(losses, (avg_loss, accuracy))
        if epoch % 75 == 0 || epoch == epochs - 1
            @printf("    Epoch %3d: loss=%.4f, accuracy=%.1f%%\n", epoch, avg_loss, accuracy)
        end
    end
    return losses
end

function bias_correction_demo()
    beta1, beta2, gradient = 0.9, 0.999, 1.0
    println("  Step | m_raw  | m_corrected | v_raw    | v_corrected")
    println("  ", "-"^55)
    m = 0.0
    v = 0.0
    for t in 1:10
        m = beta1 * m + (1 - beta1) * gradient
        v = beta2 * v + (1 - beta2) * gradient^2
        m_hat = m / (1 - beta1^t)
        v_hat = v / (1 - beta2^t)
        @printf("  %4d | %.4f | %.4f      | %.6f | %.6f\n", t, m, m_hat, v, v_hat)
    end
end

banner(title) = (println("="^60); println(title); println("="^60))

function main()
    banner("STEP 1: SGD on a Simple Function")
    println("  Minimizing f(x) = (x - 3)^2, starting at x = 10")
    x = [10.0]
    sgd = SGD(lr=0.1)
    for step in 0:19
        step!(sgd, x, [2.0 * (x[1] - 3.0)])
        loss = (x[1] - 3.0)^2
        if step % 5 == 0 || step == 19
            @printf("    Step %2d: x=%.6f, loss=%.6f\n", step, x[1], loss)
        end
    end

    println()
    banner("STEP 2: Bias Correction in Adam")
    println("  Showing how raw moments are biased toward zero initially")
    bias_correction_demo()

    println()
    banner("STEP 3: Optimizer Comparison on Circle Dataset")
    data = make_circle_data()

    configs = [
        ("SGD (lr=0.05)", SGD(lr=0.05)),
        ("SGD+Momentum (lr=0.05, beta=0.9)", SGDMomentum(lr=0.05, beta=0.9)),
        ("Adam (lr=0.001)", Adam(lr=0.001)),
        ("AdamW (lr=0.001, wd=0.01)", AdamW(lr=0.001, weight_decay=0.01)),
    ]

    results = Tuple{String,Vector{Tuple{Float64,Float64}}}[]
    for (name, opt) in configs
        println("\n--- $name ---")
        net = OptimizerTestNetwork(opt; hidden_size=8)
        push!(results, (name, train!(net, data; epochs=300)))
    end

    println()
    banner("FINAL COMPARISON")
    for (name, history) in results
        final_loss, final_acc = history[end]
        first = findfirst(h -> h[2] >= 85.0, history)
        reached = first === nothing ? "never" : "epoch $(first - 1)"
        @printf("  %-40s: acc=%.1f%%, loss=%.4f, reached 85%%: %s\n", name, final_acc, final_loss, reached)
    end

    println()
    banner("STEP 4: Weight Decay Effect")
    Random.seed!(42)
    large_weights = [uniform(-5, 5) for _ in 1:10]
    weights_adam = copy(large_weights)
    weights_adamw = copy(large_weights)

    opt_adam = Adam(lr=0.001)
    opt_adamw = AdamW(lr=0.001, weight_decay=0.1)

    @printf("  Initial weight L2 norm: %.4f\n", sqrt(sum(w * w for w in large_weights)))

    for _ in 1:100
        grads = [gauss(0, 0.1) for _ in 1:10]
        step!(opt_adam, weights_adam, copy(grads))
        step!(opt_adamw, weights_adamw, copy(grads))
    end

    norm_adam = sqrt(sum(w * w for w in weights_adam))
    norm_adamw = sqrt(sum(w * w for w in weights_adamw))
    println("  After 100 steps:")
    @printf("    Adam  weight L2 norm: %.4f\n", norm_adam)
    @printf("    AdamW weight L2 norm: %.4f\n", norm_adamw)
    @printf("    AdamW shrinks weights %.1fx more\n", norm_adam / max(0.001, norm_adamw))
end

if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
