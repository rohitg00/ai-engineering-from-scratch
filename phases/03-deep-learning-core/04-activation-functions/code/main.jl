# Activation functions in Julia. Sigmoid, tanh, ReLU, leaky ReLU,
# GELU, Swish — each with hand-derived analytical gradients.
# Plus dead-neuron detection on ReLU and a vanishing-gradient demo.
# Trains a tiny 2-h-1 MLP with each activation on circle data.
# Stdlib only. Sources:
#   https://docs.julialang.org/en/v1/base/math/  (tanh, erf, sqrt)
#   https://arxiv.org/abs/1606.08415  (GELU: Hendrycks & Gimpel)

using Random
using Printf


# Hand-rolled erf via Abramowitz & Stegun 7.1.26 (max error ~1.5e-7).
# Stdlib only — Julia 1.x Base does not ship erf.
function erf_approx(x::Float64)::Float64
    sign_x = x < 0 ? -1.0 : 1.0
    ax = abs(x)
    a1, a2, a3, a4, a5 = 0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429
    p = 0.3275911
    t = 1.0 / (1.0 + p * ax)
    y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * exp(-ax * ax)
    return sign_x * y
end


sigmoid(x::Float64)::Float64 = 1.0 / (1.0 + exp(-clamp(x, -500.0, 500.0)))
sigmoid_d(x::Float64)::Float64 = (s = sigmoid(x); s * (1 - s))

tanh_act(x::Float64)::Float64 = tanh(x)
tanh_d(x::Float64)::Float64 = (t = tanh(x); 1 - t * t)

relu(x::Float64)::Float64 = max(0.0, x)
relu_d(x::Float64)::Float64 = x > 0 ? 1.0 : 0.0

leaky_relu(x::Float64; alpha::Float64=0.01)::Float64 = x > 0 ? x : alpha * x
leaky_relu_d(x::Float64; alpha::Float64=0.01)::Float64 = x > 0 ? 1.0 : alpha


function gelu(x::Float64)::Float64
    # Exact form x * Phi(x); keeps gelu and gelu_d consistent for backprop.
    return 0.5 * x * (1 + erf_approx(x / sqrt(2.0)))
end

function gelu_d(x::Float64)::Float64
    phi = 0.5 * (1 + erf_approx(x / sqrt(2.0)))
    pdf = exp(-0.5 * x * x) / sqrt(2pi)
    return phi + x * pdf
end


swish(x::Float64)::Float64 = x * sigmoid(x)
function swish_d(x::Float64)::Float64
    s = sigmoid(x)
    return s + x * s * (1 - s)
end


function softmax(xs::Vector{Float64})::Vector{Float64}
    m = maximum(xs)
    exps = exp.(xs .- m)
    return exps ./ sum(exps)
end


function gradient_scan(name::String, deriv; start::Float64=-5.0, stop::Float64=5.0, n::Int=100)
    step = (stop - start) / n
    near_zero = 0
    healthy = 0
    for i in 0:(n - 1)
        x = start + i * step
        g = deriv(x)
        if abs(g) < 0.01
            near_zero += 1
        else
            healthy += 1
        end
    end
    pct_dead = near_zero / n * 100
    @printf("%-15s: %3d healthy, %3d near-zero (%.0f%% dead zone)\n",
            name, healthy, near_zero, pct_dead)
end


function vanishing_gradient_experiment(act, act_d, name::String; n_layers::Int=10, n_inputs::Int=5)
    rng = MersenneTwister(42)
    values = randn(rng, n_inputs)
    # Track the running product of |f'(z)| across layers — this is the
    # quantity that actually vanishes during backprop, not the signal.
    chain_grad = 1.0
    println("\n$name through $n_layers layers:")
    for layer in 1:n_layers
        weights = randn(rng, n_inputs)
        z = sum(weights .* values)
        activated = act(z)
        chain_grad *= abs(act_d(z))
        bar_len = isfinite(chain_grad) ? clamp(Int(round(chain_grad * 20)), 0, 60) : 0
        bar = "#" ^ bar_len
        @printf("  Layer %2d: |grad chain| = %.6f %s\n", layer, chain_grad, bar)
        values = fill(activated, n_inputs)
    end
end


function dead_neuron_detector(; n_inputs::Int=5, hidden_size::Int=20, n_samples::Int=1000)
    rng = MersenneTwister(0)
    weights = randn(rng, hidden_size, n_inputs)
    biases = randn(rng, hidden_size)
    fire_counts = zeros(Int, hidden_size)

    for _ in 1:n_samples
        inputs = randn(rng, n_inputs)
        for n_idx in 1:hidden_size
            z = sum(weights[n_idx, :] .* inputs) + biases[n_idx]
            if relu(z) > 0
                fire_counts[n_idx] += 1
            end
        end
    end

    dead = count(==(0), fire_counts)
    rarely = count(c -> 0 < c < n_samples * 0.05, fire_counts)
    healthy = hidden_size - dead - rarely
    println("\nDead Neuron Report ($hidden_size neurons, $n_samples samples):")
    println("  Dead (never fired):     $dead")
    println("  Barely alive (<5%):     $rarely")
    println("  Healthy:                $healthy")
    @printf("  Dead neuron rate:       %.1f%%\n", dead / hidden_size * 100)
    for (i, c) in enumerate(fire_counts)
        status = c == 0 ? "DEAD" : (c < n_samples * 0.05 ? "WEAK" : "OK")
        bar = "#" ^ (c * 40 ÷ n_samples)
        @printf("  Neuron %2d: %4d/%d fires [%-4s] %s\n", i - 1, c, n_samples, status, bar)
    end
end


function make_circle_data(; n::Int=200, seed::Int=42)
    rng = MersenneTwister(seed)
    data = Tuple{Vector{Float64}, Float64}[]
    for _ in 1:n
        x = rand(rng) * 4 - 2
        y = rand(rng) * 4 - 2
        label = x * x + y * y < 1.5 ? 1.0 : 0.0
        push!(data, (Float64[x, y], label))
    end
    return data
end


mutable struct ActivationNetwork
    act::Function
    act_d::Function
    lr::Float64
    hidden_size::Int
    w1::Matrix{Float64}
    b1::Vector{Float64}
    w2::Vector{Float64}
    b2::Float64
    # caches
    x::Vector{Float64}
    z1::Vector{Float64}
    h::Vector{Float64}
    z2::Float64
    out::Float64
end

function ActivationNetwork(act, act_d; hidden_size::Int=8, lr::Float64=0.1, seed::Int=0)
    rng = MersenneTwister(seed)
    return ActivationNetwork(
        act, act_d, lr, hidden_size,
        randn(rng, hidden_size, 2) .* 0.5,
        zeros(Float64, hidden_size),
        randn(rng, hidden_size) .* 0.5,
        0.0,
        Float64[], zeros(Float64, hidden_size), zeros(Float64, hidden_size),
        0.0, 0.0,
    )
end


function forward!(net::ActivationNetwork, x::Vector{Float64})::Float64
    net.x = x
    for i in 1:net.hidden_size
        z = net.w1[i, 1] * x[1] + net.w1[i, 2] * x[2] + net.b1[i]
        net.z1[i] = z
        net.h[i] = net.act(z)
    end
    net.z2 = sum(net.w2 .* net.h) + net.b2
    net.out = sigmoid(net.z2)
    return net.out
end


function backward!(net::ActivationNetwork, target::Float64)
    err = net.out - target
    d_out = err * net.out * (1 - net.out)
    for i in 1:net.hidden_size
        d_h = d_out * net.w2[i] * net.act_d(net.z1[i])
        net.w2[i] -= net.lr * d_out * net.h[i]
        net.w1[i, 1] -= net.lr * d_h * net.x[1]
        net.w1[i, 2] -= net.lr * d_h * net.x[2]
        net.b1[i] -= net.lr * d_h
    end
    net.b2 -= net.lr * d_out
end


function train!(net::ActivationNetwork, data::Vector{Tuple{Vector{Float64}, Float64}};
                epochs::Int=200)
    losses = Float64[]
    for epoch in 0:(epochs - 1)
        total = 0.0
        correct = 0
        for (x, y) in data
            pred = forward!(net, x)
            backward!(net, y)
            total += (pred - y) ^ 2
            if (pred >= 0.5) == (y >= 0.5)
                correct += 1
            end
        end
        avg = total / length(data)
        acc = correct / length(data) * 100
        push!(losses, avg)
        if epoch % 50 == 0 || epoch == epochs - 1
            @printf("    Epoch %3d: loss=%.4f, accuracy=%.1f%%\n", epoch, avg, acc)
        end
    end
    return losses
end


function main()
    println("=" ^ 60)
    println("STEP 1: Activation Function Values")
    println("=" ^ 60)
    for x in [-2.0, -1.0, -0.5, 0.0, 0.5, 1.0, 2.0]
        @printf("  x=%5.1f  sigmoid=%.4f  tanh=%.4f  relu=%.4f  gelu=%.4f  swish=%.4f\n",
                x, sigmoid(x), tanh_act(x), relu(x), gelu(x), swish(x))
    end

    println("\n  softmax([2.0, 1.0, 0.1]) = $(round.(softmax(Float64[2.0, 1.0, 0.1]), digits=6))")
    println("  softmax([10, 10, 10])    = $(round.(softmax(Float64[10, 10, 10]), digits=6))")

    println("\n" * "=" ^ 60)
    println("STEP 2: Gradient Dead Zones")
    println("=" ^ 60)
    gradient_scan("Sigmoid", sigmoid_d)
    gradient_scan("Tanh", tanh_d)
    gradient_scan("ReLU", relu_d)
    gradient_scan("Leaky ReLU", leaky_relu_d)
    gradient_scan("GELU", gelu_d)
    gradient_scan("Swish", swish_d)

    println("\n" * "=" ^ 60)
    println("STEP 3: Vanishing Gradient Experiment")
    println("=" ^ 60)
    vanishing_gradient_experiment(sigmoid, sigmoid_d, "Sigmoid")
    vanishing_gradient_experiment(relu, relu_d, "ReLU")
    vanishing_gradient_experiment(gelu, gelu_d, "GELU")

    println("\n" * "=" ^ 60)
    println("STEP 4: Dead Neuron Detection")
    println("=" ^ 60)
    dead_neuron_detector()

    println("\n" * "=" ^ 60)
    println("STEP 5: Training Comparison (Circle Dataset)")
    println("=" ^ 60)
    data = make_circle_data()
    configs = [
        ("Sigmoid", sigmoid, sigmoid_d),
        ("ReLU", relu, relu_d),
        ("GELU", gelu, gelu_d),
    ]
    results = Dict{String, Vector{Float64}}()
    for (name, act, act_d) in configs
        println("\n--- Training with $name ---")
        net = ActivationNetwork(act, act_d; hidden_size=8, lr=0.1)
        losses = train!(net, data; epochs=200)
        results[name] = losses
    end

    println("\n=== Final Loss Comparison ===")
    for (name, _, _) in configs
        losses = results[name]
        improvement = losses[1] > 0 ? (1 - losses[end] / losses[1]) * 100 : 0.0
        @printf("  %-10s: start=%.4f -> end=%.4f (improvement: %.1f%%)\n",
                name, losses[1], losses[end], improvement)
    end
end


if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
