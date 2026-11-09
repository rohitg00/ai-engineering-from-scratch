# Lesson: Build Your Own Mini Framework (phase 03 / lesson 10)
# Julia port of code/main.py. Julia standard library only.
# Source: phases/03-deep-learning-core/10-mini-framework/docs/en.md
# Run: julia code/main.jl

using Random
using Printf

gauss(mu, sigma) = mu + sigma * randn()
uniform(lo, hi) = lo + (hi - lo) * rand()

struct Param
    values::Array{Float64}
    grads::Array{Float64}
    index::Int
end

abstract type Module end

parameters(::Module) = Param[]
train!(m::Module) = (m.training = true)
eval!(m::Module) = (m.training = false)

mutable struct Linear <: Module
    training::Bool
    weights::Matrix{Float64}
    biases::Vector{Float64}
    weight_grads::Matrix{Float64}
    bias_grads::Vector{Float64}
    input::Vector{Float64}
end

function Linear(fan_in::Int, fan_out::Int)
    std = sqrt(2.0 / fan_in)
    w = permutedims([gauss(0, std) for _ in 1:fan_in, _ in 1:fan_out])
    return Linear(true, w, zeros(fan_out), zeros(fan_out, fan_in), zeros(fan_out), Float64[])
end

function forward!(m::Linear, x)
    m.input = x
    return m.biases .+ m.weights * x
end

function backward!(m::Linear, grad)
    m.bias_grads .+= grad
    m.weight_grads .+= grad * permutedims(m.input)
    return permutedims(m.weights) * grad
end

function parameters(m::Linear)
    fan_out, fan_in = size(m.weights)
    params = Param[]
    for i in 1:fan_out
        for j in 1:fan_in
            push!(params, Param(m.weights, m.weight_grads, LinearIndices(m.weights)[i, j]))
        end
        push!(params, Param(m.biases, m.bias_grads, i))
    end
    return params
end

mutable struct ReLU <: Module
    training::Bool
    mask::Vector{Float64}
end
ReLU() = ReLU(true, Float64[])

function forward!(m::ReLU, x)
    m.mask = [v > 0 ? 1.0 : 0.0 for v in x]
    return max.(0.0, x)
end
backward!(m::ReLU, grad) = grad .* m.mask

mutable struct Sigmoid <: Module
    training::Bool
    output::Vector{Float64}
end
Sigmoid() = Sigmoid(true, Float64[])

forward!(m::Sigmoid, x) = (m.output = [1.0 / (1.0 + exp(-clamp(v, -500, 500))) for v in x])
backward!(m::Sigmoid, grad) = grad .* m.output .* (1 .- m.output)

mutable struct Tanh <: Module
    training::Bool
    output::Vector{Float64}
end
Tanh() = Tanh(true, Float64[])

forward!(m::Tanh, x) = (m.output = tanh.(x))
backward!(m::Tanh, grad) = grad .* (1 .- m.output .^ 2)

mutable struct Dropout <: Module
    training::Bool
    p::Float64
    mask::Union{Nothing,Vector{Float64}}
end
Dropout(p=0.5) = Dropout(true, p, nothing)

function forward!(m::Dropout, x)
    m.training || return x
    m.mask = [rand() < m.p ? 0.0 : 1.0 / (1 - m.p) for _ in x]
    return x .* m.mask
end
backward!(m::Dropout, grad) = m.mask === nothing ? grad : grad .* m.mask

mutable struct BatchNorm <: Module
    training::Bool
    size::Int
    gamma::Vector{Float64}
    beta::Vector{Float64}
    gamma_grads::Vector{Float64}
    beta_grads::Vector{Float64}
    running_mean::Vector{Float64}
    running_var::Vector{Float64}
    momentum::Float64
    eps::Float64
    x_norm::Union{Nothing,Vector{Float64},Vector{Vector{Float64}}}
    std_inv::Vector{Float64}
end
BatchNorm(size; momentum=0.1, eps=1e-5) =
    BatchNorm(true, size, ones(size), zeros(size), zeros(size), zeros(size), zeros(size), ones(size),
        momentum, eps, nothing, Float64[])

function forward_batch!(m::BatchNorm, batch)
    n = length(batch)
    if m.training
        mean = sum(batch) ./ n
        var = sum([(s .- mean) .^ 2 for s in batch]) ./ n
        m.std_inv = 1.0 ./ sqrt.(var .+ m.eps)
        m.x_norm = [(s .- mean) .* m.std_inv for s in batch]
        output = [m.gamma .* xn .+ m.beta for xn in m.x_norm]
        m.running_mean .= (1 - m.momentum) .* m.running_mean .+ m.momentum .* mean
        m.running_var .= (1 - m.momentum) .* m.running_var .+ m.momentum .* var
        return output
    end
    std_inv = 1.0 ./ sqrt.(m.running_var .+ m.eps)
    return [m.gamma .* ((s .- m.running_mean) .* std_inv) .+ m.beta for s in batch]
end

function forward!(m::BatchNorm, x)
    if m.training
        for j in 1:m.size
            delta = x[j] - m.running_mean[j]
            m.running_mean[j] += m.momentum * delta
            m.running_var[j] = (1 - m.momentum) * (m.running_var[j] + m.momentum * delta * delta)
        end
        m.std_inv = 1.0 ./ sqrt.(m.running_var .+ m.eps)
        m.x_norm = (x .- m.running_mean) .* m.std_inv
        return m.gamma .* m.x_norm .+ m.beta
    end
    std_inv = 1.0 ./ sqrt.(m.running_var .+ m.eps)
    return m.gamma .* ((x .- m.running_mean) .* std_inv) .+ m.beta
end

function backward!(m::BatchNorm, grad)
    m.x_norm === nothing && return grad
    x_norm = m.x_norm isa Vector{Vector{Float64}} ? m.x_norm[1] : m.x_norm
    m.gamma_grads .+= x_norm .* grad
    m.beta_grads .+= grad
    return grad .* m.gamma .* m.std_inv
end

function parameters(m::BatchNorm)
    params = Param[]
    for j in 1:m.size
        push!(params, Param(m.gamma, m.gamma_grads, j))
        push!(params, Param(m.beta, m.beta_grads, j))
    end
    return params
end

mutable struct Sequential <: Module
    training::Bool
    modules::Vector{Module}
end
Sequential(modules...) = Sequential(true, collect(Module, modules))

function forward!(s::Sequential, x)
    for m in s.modules
        x = forward!(m, x)
    end
    return x
end

function backward!(s::Sequential, grad)
    for m in reverse(s.modules)
        grad = backward!(m, grad)
    end
    return grad
end

parameters(s::Sequential) = reduce(vcat, (parameters(m) for m in s.modules); init=Param[])
train!(s::Sequential) = (s.training = true; foreach(train!, s.modules))
eval!(s::Sequential) = (s.training = false; foreach(eval!, s.modules))
count_parameters(s::Sequential) = length(parameters(s))

mutable struct MSELoss
    predicted::Vector{Float64}
    target::Vector{Float64}
    loss::Float64
end
MSELoss() = MSELoss(Float64[], Float64[], 0.0)

function (l::MSELoss)(predicted, target)
    l.predicted, l.target = predicted, target
    l.loss = sum((predicted .- target) .^ 2) / length(predicted)
end
backward(l::MSELoss) = 2 .* (l.predicted .- l.target) ./ length(l.predicted)

mutable struct BCELoss
    predicted::Vector{Float64}
    target::Vector{Float64}
    loss::Float64
end
BCELoss() = BCELoss(Float64[], Float64[], 0.0)

function (l::BCELoss)(predicted, target)
    l.predicted, l.target = predicted, target
    eps = 1e-7
    total = 0.0
    for (p, t) in zip(predicted, target)
        p = clamp(p, eps, 1 - eps)
        total += -(t * log(p) + (1 - t) * log(1 - p))
    end
    l.loss = total / length(predicted)
end

function backward(l::BCELoss)
    eps = 1e-7
    n = length(l.predicted)
    return [(p = clamp(p, eps, 1 - eps); (-t / p + (1 - t) / (1 - p)) / n) for (p, t) in zip(l.predicted, l.target)]
end

abstract type Optimizer end

zero_grad!(opt::Optimizer) = foreach(p -> p.grads[p.index] = 0.0, opt.params)

struct SGD <: Optimizer
    params::Vector{Param}
    lr::Float64
end
SGD(params; lr=0.01) = SGD(params, lr)

step!(opt::SGD) = foreach(p -> p.values[p.index] -= opt.lr * p.grads[p.index], opt.params)

mutable struct Adam <: Optimizer
    params::Vector{Param}
    lr::Float64
    beta1::Float64
    beta2::Float64
    eps::Float64
    t::Int
    m::Vector{Float64}
    v::Vector{Float64}
end
Adam(params; lr=0.001, beta1=0.9, beta2=0.999, eps=1e-8) =
    Adam(params, lr, beta1, beta2, eps, 0, zeros(length(params)), zeros(length(params)))

function step!(opt::Adam)
    opt.t += 1
    for (idx, p) in enumerate(opt.params)
        g = p.grads[p.index]
        opt.m[idx] = opt.beta1 * opt.m[idx] + (1 - opt.beta1) * g
        opt.v[idx] = opt.beta2 * opt.v[idx] + (1 - opt.beta2) * g * g
        m_hat = opt.m[idx] / (1 - opt.beta1^opt.t)
        v_hat = opt.v[idx] / (1 - opt.beta2^opt.t)
        p.values[p.index] -= opt.lr * m_hat / (sqrt(v_hat) + opt.eps)
    end
end

struct DataLoader
    data::Vector{Tuple{Vector{Float64},Vector{Float64}}}
    batch_size::Int
    shuffle::Bool
end
DataLoader(data; batch_size=32, shuffle=true) = DataLoader(data, batch_size, shuffle)

function Base.iterate(dl::DataLoader, state=nothing)
    if state === nothing
        indices = collect(1:length(dl.data))
        dl.shuffle && shuffle!(indices)
        state = (indices, 1)
    end
    indices, start = state
    start > length(indices) && return nothing
    batch = [dl.data[i] for i in indices[start:min(start + dl.batch_size - 1, end)]]
    return (first.(batch), last.(batch)), (indices, start + dl.batch_size)
end

Base.length(dl::DataLoader) = cld(length(dl.data), dl.batch_size)

function make_circle_data(n=500; seed=42)
    Random.seed!(seed)
    data = Tuple{Vector{Float64},Vector{Float64}}[]
    for _ in 1:n
        x = uniform(-2, 2)
        y = uniform(-2, 2)
        push!(data, ([x, y], [x * x + y * y < 1.5 ? 1.0 : 0.0]))
    end
    return data
end

split_data(data) = (k = trunc(Int, length(data) * 0.8); (data[1:k], data[k+1:end]))

function test_accuracy(model, test_data)
    eval!(model)
    correct = count(((x, t),) -> (forward!(model, x)[1] >= 0.5 ? 1.0 : 0.0) == t[1], test_data)
    return correct, correct / length(test_data) * 100
end

deep_mlp() = Sequential(Linear(2, 16), ReLU(), Linear(16, 16), ReLU(), Linear(16, 8), ReLU(), Linear(8, 1), Sigmoid())

function train_framework()
    Random.seed!(42)
    model = deep_mlp()

    println("Model: 4 linear layers (2->16->16->8->1)")
    println("Total parameters: ", count_parameters(model))
    println("Optimizer: Adam (lr=0.01)")
    println("Loss: Binary Cross-Entropy")
    println("Data: 500 samples (80/20 train/test split)")
    println()

    criterion = BCELoss()
    optimizer = Adam(parameters(model); lr=0.01)
    train_data, test_data = split_data(make_circle_data(500))
    loader = DataLoader(train_data; batch_size=16, shuffle=true)

    train!(model)
    for epoch in 0:99
        total_loss = 0.0
        total_correct = 0
        total_samples = 0
        for (batch_inputs, batch_targets) in loader
            for (x, t) in zip(batch_inputs, batch_targets)
                pred = forward!(model, x)
                total_loss += criterion(pred, t)
                zero_grad!(optimizer)
                backward!(model, backward(criterion))
                step!(optimizer)
                (pred[1] >= 0.5 ? 1.0 : 0.0) == t[1] && (total_correct += 1)
                total_samples += 1
            end
        end
        if epoch % 10 == 0 || epoch == 99
            @printf("  Epoch %3d | Loss: %.6f | Train Accuracy: %.1f%%\n", epoch,
                total_loss / total_samples, total_correct / total_samples * 100)
        end
    end

    correct, acc = test_accuracy(model, test_data)
    @printf("\n  Test Accuracy: %.1f%% (%d/%d)\n", acc, correct, length(test_data))
    return model, acc
end

function train_quiet(model, optimizer_fn)
    criterion = BCELoss()
    optimizer = optimizer_fn(parameters(model))
    train_data, test_data = split_data(make_circle_data(500))
    loader = DataLoader(train_data; batch_size=16, shuffle=true)
    train!(model)
    for _ in 1:100
        for (batch_inputs, batch_targets) in loader
            for (x, t) in zip(batch_inputs, batch_targets)
                pred = forward!(model, x)
                criterion(pred, t)
                zero_grad!(optimizer)
                backward!(model, backward(criterion))
                step!(optimizer)
            end
        end
    end
    return test_accuracy(model, test_data)[2]
end

function train_with_sgd()
    Random.seed!(42)
    return train_quiet(deep_mlp(), p -> SGD(p; lr=0.1))
end

function train_with_dropout()
    Random.seed!(42)
    model = Sequential(Linear(2, 16), ReLU(), Dropout(0.3), Linear(16, 16), ReLU(), Dropout(0.3),
        Linear(16, 8), ReLU(), Linear(8, 1), Sigmoid())
    return train_quiet(model, p -> Adam(p; lr=0.01))
end

function sample_predictions(model)
    test_points = [
        ([0.0, 0.0], "inside"),
        ([0.5, 0.5], "inside"),
        ([1.0, 0.0], "inside"),
        ([-0.3, 0.3], "inside"),
        ([1.5, 1.5], "outside"),
        ([0.0, 1.8], "outside"),
        ([-1.5, -1.0], "outside"),
        ([2.0, 0.0], "outside"),
    ]
    println("\n  Sample Predictions:")
    for (point, expected) in test_points
        pred = forward!(model, point)
        region = pred[1] >= 0.5 ? "inside" : "outside"
        status = region == expected ? "OK" : "WRONG"
        @printf("    (%5.1f, %5.1f) -> %.4f (%-7s, expected %-7s) %s\n", point[1], point[2], pred[1], region, expected, status)
    end
end

function main()
    println("="^70)
    println("MINI FRAMEWORK -- Phase 3 Capstone")
    println("="^70)
    println()

    println("-"^70)
    println("EXPERIMENT 1: Adam Optimizer (4-layer network)")
    println("-"^70)
    model, adam_acc = train_framework()
    sample_predictions(model)

    println("\n", "-"^70)
    println("EXPERIMENT 2: SGD Optimizer (same architecture)")
    println("-"^70)
    sgd_acc = train_with_sgd()
    @printf("  SGD Test Accuracy: %.1f%%\n", sgd_acc)

    println("\n", "-"^70)
    println("EXPERIMENT 3: With Dropout (p=0.3)")
    println("-"^70)
    dropout_acc = train_with_dropout()
    @printf("  Dropout Test Accuracy: %.1f%%\n", dropout_acc)

    println("\n", "="^70)
    println("COMPARISON")
    println("="^70)
    @printf("  Adam (no dropout):     %.1f%%\n", adam_acc)
    @printf("  SGD (no dropout):      %.1f%%\n", sgd_acc)
    @printf("  Adam + Dropout(0.3):   %.1f%%\n", dropout_acc)

    println("\n", "="^70)
    println("FRAMEWORK COMPONENTS")
    println("="^70)
    println("  Modules:    Linear, ReLU, Sigmoid, Tanh, Dropout, BatchNorm")
    println("  Containers: Sequential")
    println("  Losses:     MSELoss, BCELoss")
    println("  Optimizers: SGD, Adam")
    println("  Data:       DataLoader (batching + shuffle)")
    println("  Total:      ~450 lines of pure Julia")
end

if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
