# Lesson: Regularization (phase 03 / lesson 07)
# Julia port of code/main.py. Julia standard library only.
# Source: phases/03-deep-learning-core/07-regularization/docs/en.md
# Run: julia code/main.jl

using Random
using Printf

uniform(lo, hi) = lo + (hi - lo) * rand()
gauss(mu, sigma) = mu + sigma * randn()

fmt2(v) = @sprintf("%.2f", v)
fmt1(v) = @sprintf("%.1f", v)
fmt3(v) = @sprintf("%.3f", v)
fmt4(v) = @sprintf("%.4f", v)
strlist(xs, f) = "[" * join(("'" * f(x) * "'" for x in xs), ", ") * "]"

mutable struct Dropout
    p::Float64
    training::Bool
    mask::Union{Nothing,Vector{Int}}
end
Dropout(; p=0.5) = Dropout(p, true, nothing)

function forward!(d::Dropout, x)
    d.training || return collect(x)
    d.mask = Int[]
    output = Float64[]
    for val in x
        if rand() < d.p
            push!(d.mask, 0)
            push!(output, 0.0)
        else
            push!(d.mask, 1)
            push!(output, val / (1 - d.p))
        end
    end
    return output
end

backward(d::Dropout, grad_output) = [m == 0 ? 0.0 : g / (1 - d.p) for (g, m) in zip(grad_output, d.mask)]

l2_regularization(weights, lambda_reg) = lambda_reg * 0.5 * sum(w * w for w in weights)
l2_gradient(weights, lambda_reg) = [lambda_reg * w for w in weights]

mutable struct BatchNorm
    gamma::Vector{Float64}
    beta::Vector{Float64}
    eps::Float64
    momentum::Float64
    running_mean::Vector{Float64}
    running_var::Vector{Float64}
    training::Bool
    num_features::Int
    x_hat::Vector{Vector{Float64}}
end
BatchNorm(n; momentum=0.1, eps=1e-5) = BatchNorm(ones(n), zeros(n), eps, momentum, zeros(n), ones(n), true, n, [])

function forward!(bn::BatchNorm, batch)
    batch_size = length(batch)
    n = bn.num_features
    if bn.training
        mean = [sum(s[j] for s in batch) / batch_size for j in 1:n]
        var = [sum((s[j] - mean[j])^2 for s in batch) / batch_size for j in 1:n]
        for j in 1:n
            bn.running_mean[j] = (1 - bn.momentum) * bn.running_mean[j] + bn.momentum * mean[j]
            bn.running_var[j] = (1 - bn.momentum) * bn.running_var[j] + bn.momentum * var[j]
        end
    else
        mean = copy(bn.running_mean)
        var = copy(bn.running_var)
    end
    bn.x_hat = []
    output = Vector{Float64}[]
    for s in batch
        normalized = [(s[j] - mean[j]) / sqrt(var[j] + bn.eps) for j in 1:n]
        push!(bn.x_hat, normalized)
        push!(output, [bn.gamma[j] * normalized[j] + bn.beta[j] for j in 1:n])
    end
    return output
end

struct LayerNorm
    gamma::Vector{Float64}
    beta::Vector{Float64}
    eps::Float64
end
LayerNorm(n; eps=1e-5) = LayerNorm(ones(n), zeros(n), eps)

function forward(ln::LayerNorm, x)
    mean = sum(x) / length(x)
    var = sum((xi - mean)^2 for xi in x) / length(x)
    return [ln.gamma[j] * (x[j] - mean) / sqrt(var + ln.eps) + ln.beta[j] for j in eachindex(x)]
end

struct RMSNorm
    gamma::Vector{Float64}
    eps::Float64
end
RMSNorm(n; eps=1e-6) = RMSNorm(ones(n), eps)

function forward(rn::RMSNorm, x)
    rms = sqrt(sum(xi * xi for xi in x) / length(x) + rn.eps)
    return [rn.gamma[j] * x[j] / rms for j in eachindex(x)]
end

sigmoid(x) = 1.0 / (1.0 + exp(-clamp(x, -500, 500)))

function make_circle_data(; n=200, seed=42)
    Random.seed!(seed)
    data = Tuple{Vector{Float64},Float64}[]
    for _ in 1:n
        x = uniform(-2, 2)
        y = uniform(-2, 2)
        push!(data, ([x, y], x * x + y * y < 1.5 ? 1.0 : 0.0))
    end
    return data
end

mutable struct RegularizedNetwork
    hidden_size::Int
    lr::Float64
    weight_decay::Float64
    dropout::Union{Nothing,Dropout}
    w1::Vector{Vector{Float64}}
    b1::Vector{Float64}
    w2::Vector{Float64}
    b2::Float64
    x::Vector{Float64}
    z1::Vector{Float64}
    h::Vector{Float64}
    out::Float64
end

function RegularizedNetwork(; hidden_size=16, lr=0.05, dropout_p=0.0, weight_decay=0.0)
    Random.seed!(0)
    dropout = dropout_p > 0 ? Dropout(p=dropout_p) : nothing
    w1 = [[gauss(0, 0.5) for _ in 1:2] for _ in 1:hidden_size]
    w2 = [gauss(0, 0.5) for _ in 1:hidden_size]
    return RegularizedNetwork(hidden_size, lr, weight_decay, dropout, w1, zeros(hidden_size), w2, 0.0,
        Float64[], Float64[], Float64[], 0.0)
end

function forward!(net::RegularizedNetwork, x; training=true)
    net.x = x
    net.z1 = [net.w1[i][1] * x[1] + net.w1[i][2] * x[2] + net.b1[i] for i in 1:net.hidden_size]
    net.h = max.(0.0, net.z1)
    if net.dropout !== nothing
        net.dropout.training = training
        net.h = forward!(net.dropout, net.h)
    end
    z2 = sum(net.w2[i] * net.h[i] for i in 1:net.hidden_size) + net.b2
    net.out = sigmoid(z2)
    return net.out
end

function backward!(net::RegularizedNetwork, target)
    p = clamp(net.out, 1e-15, 1 - 1e-15)
    d_loss = -(target / p) + (1 - target) / (1 - p)
    d_out = d_loss * net.out * (1 - net.out)
    d_h_dropout = [d_out * net.w2[i] for i in 1:net.hidden_size]
    if net.dropout !== nothing && net.dropout.mask !== nothing
        d_h_dropout = [m != 0 ? g * m / (1 - net.dropout.p) : 0.0 for (g, m) in zip(d_h_dropout, net.dropout.mask)]
    end
    for i in 1:net.hidden_size
        d_h = d_h_dropout[i] * (net.z1[i] > 0 ? 1.0 : 0.0)
        net.w2[i] -= net.lr * (d_out * net.h[i] + net.weight_decay * net.w2[i])
        for j in 1:2
            net.w1[i][j] -= net.lr * (d_h * net.x[j] + net.weight_decay * net.w1[i][j])
        end
        net.b1[i] -= net.lr * d_h
    end
    net.b2 -= net.lr * d_out
end

bce(y, pred) = (p = clamp(pred, 1e-15, 1 - 1e-15); -(y * log(p) + (1 - y) * log(1 - p)))

function evaluate(net, data)
    correct = 0
    total_loss = 0.0
    for (x, y) in data
        pred = forward!(net, x; training=false)
        total_loss += bce(y, pred)
        (pred >= 0.5) == (y >= 0.5) && (correct += 1)
    end
    return total_loss / length(data), correct / length(data) * 100
end

function train_model!(net, train_data, test_data; epochs=300)
    history = NTuple{4,Float64}[]
    for epoch in 0:epochs-1
        total_loss = 0.0
        correct = 0
        for (x, y) in train_data
            pred = forward!(net, x; training=true)
            backward!(net, y)
            total_loss += bce(y, pred)
            (pred >= 0.5) == (y >= 0.5) && (correct += 1)
        end
        train_loss = total_loss / length(train_data)
        train_acc = correct / length(train_data) * 100
        test_loss, test_acc = evaluate(net, test_data)
        push!(history, (train_loss, train_acc, test_loss, test_acc))
        if epoch % 75 == 0 || epoch == epochs - 1
            @printf("    Epoch %3d: train_acc=%.1f%%, test_acc=%.1f%%, gap=%.1f%%\n", epoch, train_acc, test_acc, train_acc - test_acc)
        end
    end
    return history
end

banner(title) = (println("="^60); println(title); println("="^60))

function main()
    banner("STEP 1: Dropout Demonstration")
    drop = Dropout(p=0.5)
    test_input = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0]
    Random.seed!(42)

    drop.training = true
    println("  Input:          ", test_input)
    for trial in 1:3
        output = forward!(drop, test_input)
        active = count(>(0), output)
        println("  Train pass $trial:   $(strlist(output, fmt1))  ($active/$(length(test_input)) active)")
    end

    drop.training = false
    output = forward!(drop, test_input)
    println("  Eval pass:      ", strlist(output, fmt1))
    @printf("  Train mean: ~%.1f (scaled by 1/(1-p))\n", sum(test_input) / length(test_input))
    @printf("  Eval mean:   %.1f (no scaling needed)\n", sum(output) / length(output))

    println()
    banner("STEP 2: L2 Regularization")
    weights = [0.5, -1.2, 3.0, 0.1, -2.5]
    lambda_val = 0.01
    penalty = l2_regularization(weights, lambda_val)
    grads = l2_gradient(weights, lambda_val)
    println("  Weights: ", weights)
    println("  Lambda:  ", lambda_val)
    @printf("  L2 penalty: %.6f\n", penalty)
    println("  L2 grads:   ", strlist(grads, fmt4))
    @printf("  Largest weight (3.0) gets largest gradient (%.4f)\n", grads[3])

    println()
    banner("STEP 3: BatchNorm vs LayerNorm vs RMSNorm")
    Random.seed!(42)
    batch = [[gauss(5, 2) for _ in 1:4] for _ in 1:8]
    sample = batch[1]

    bn_out = forward!(BatchNorm(4), batch)
    ln_out = forward(LayerNorm(4), sample)
    rn_out = forward(RMSNorm(4), sample)

    println("  Raw sample: ", strlist(sample, fmt2))
    println("  BatchNorm:  ", strlist(bn_out[1], fmt2))
    println("  LayerNorm:  ", strlist(ln_out, fmt2))
    println("  RMSNorm:    ", strlist(rn_out, fmt2))

    ln_mean = sum(ln_out) / length(ln_out)
    ln_std = sqrt(sum((v - ln_mean)^2 for v in ln_out) / length(ln_out))
    rn_mean = sum(rn_out) / length(rn_out)
    rn_rms = sqrt(sum(v * v for v in rn_out) / length(rn_out))
    @printf("\n  LayerNorm output: mean=%.4f, std=%.4f\n", ln_mean, ln_std)
    @printf("  RMSNorm output:   mean=%.4f, rms=%.4f\n", rn_mean, rn_rms)
    println("  LayerNorm centers to mean=0. RMSNorm normalizes scale only.")

    println()
    banner("STEP 4: BatchNorm Training vs Eval Mode")
    bn2 = BatchNorm(4)
    bn2.training = true
    for step in 0:9
        forward!(bn2, [[gauss(3 + step * 0.1, 1) for _ in 1:4] for _ in 1:16])
    end
    println("  Running mean after 10 batches: ", strlist(bn2.running_mean, fmt3))
    println("  Running var  after 10 batches: ", strlist(bn2.running_var, fmt3))

    bn2.training = false
    eval_out = forward!(bn2, [[5.0, 5.0, 5.0, 5.0]])
    println("  Eval mode uses running stats, not batch stats")
    println("  Input [5,5,5,5] -> ", strlist(eval_out[1], fmt3))

    println()
    banner("STEP 5: Training With vs Without Regularization")
    all_data = make_circle_data(n=300, seed=42)
    train_data = all_data[1:150]
    test_data = all_data[151:end]

    configs = [
        ("No regularization", 0.0, 0.0),
        ("Dropout p=0.3", 0.3, 0.0),
        ("Weight decay 0.01", 0.0, 0.01),
        ("Dropout + weight decay", 0.3, 0.01),
    ]

    results = Tuple{String,Vector{NTuple{4,Float64}}}[]
    for (name, drop_p, wd) in configs
        println("\n--- $name ---")
        net = RegularizedNetwork(hidden_size=16, lr=0.05, dropout_p=drop_p, weight_decay=wd)
        push!(results, (name, train_model!(net, train_data, test_data; epochs=300)))
    end

    println()
    banner("FINAL COMPARISON")
    @printf("  %-30s %10s %10s %8s\n", "Config", "Train Acc", "Test Acc", "Gap")
    println("  ", "-"^60)
    for (name, history) in results
        _, train_acc, _, test_acc = history[end]
        @printf("  %-30s %9.1f%% %9.1f%% %7.1f%%\n", name, train_acc, test_acc, train_acc - test_acc)
    end

    println("\n  Key insight: regularization reduces the train-test gap.")
    println("  Too much regularization also lowers test accuracy.")
    println("  Compare the gap and the test accuracy, not only one of them.")
end

if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
