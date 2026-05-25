# Loss functions in Julia. MSE, MAE, binary cross-entropy,
# categorical cross-entropy + softmax, and focal loss for imbalanced
# classification — each with its analytical gradient.
# Stdlib only. Sources:
#   https://arxiv.org/abs/1708.02002  (Focal loss: Lin et al.)
#   https://docs.julialang.org/en/v1/base/math/

using Random
using Statistics
using Printf


function mse(preds::Vector{Float64}, targets::Vector{Float64})::Float64
    @assert length(preds) == length(targets)
    return sum((preds .- targets) .^ 2) / length(preds)
end


function mse_grad(preds::Vector{Float64}, targets::Vector{Float64})::Vector{Float64}
    @assert length(preds) == length(targets)
    n = length(preds)
    return 2.0 .* (preds .- targets) ./ n
end


function mae(preds::Vector{Float64}, targets::Vector{Float64})::Float64
    @assert length(preds) == length(targets)
    return sum(abs.(preds .- targets)) / length(preds)
end


function mae_grad(preds::Vector{Float64}, targets::Vector{Float64})::Vector{Float64}
    @assert length(preds) == length(targets)
    n = length(preds)
    return sign.(preds .- targets) ./ n
end


function binary_cross_entropy(preds::Vector{Float64}, targets::Vector{Float64};
                              eps::Float64=1e-15)::Float64
    @assert length(preds) == length(targets)
    n = length(preds)
    total = 0.0
    for i in 1:n
        p = clamp(preds[i], eps, 1 - eps)
        t = targets[i]
        total += -(t * log(p) + (1 - t) * log(1 - p))
    end
    return total / n
end


function bce_grad(preds::Vector{Float64}, targets::Vector{Float64};
                  eps::Float64=1e-15)::Vector{Float64}
    n = length(preds)
    grads = zeros(Float64, n)
    for i in 1:n
        p = clamp(preds[i], eps, 1 - eps)
        t = targets[i]
        grads[i] = (-(t / p) + (1 - t) / (1 - p)) / n
    end
    return grads
end


function softmax(logits::Vector{Float64})::Vector{Float64}
    m = maximum(logits)
    exps = exp.(logits .- m)
    return exps ./ sum(exps)
end


# target_index is 0-indexed to mirror the Python lesson.
function categorical_cross_entropy(logits::Vector{Float64}, target_index::Int;
                                   eps::Float64=1e-15)::Float64
    probs = softmax(logits)
    p = max(eps, probs[target_index + 1])
    return -log(p)
end


function cce_grad(logits::Vector{Float64}, target_index::Int)::Vector{Float64}
    probs = softmax(logits)
    grads = copy(probs)
    grads[target_index + 1] -= 1.0
    return grads
end


# Focal loss for binary classification (sigmoid outputs).
# Down-weights easy examples by (1 - p_t)^gamma so the model
# focuses on hard ones; useful for class imbalance.
function focal_loss(preds::Vector{Float64}, targets::Vector{Float64};
                    gamma::Float64=2.0, alpha::Float64=0.25,
                    eps::Float64=1e-15)::Float64
    @assert length(preds) == length(targets)
    n = length(preds)
    total = 0.0
    for i in 1:n
        p = clamp(preds[i], eps, 1 - eps)
        t = targets[i]
        pt = t * p + (1 - t) * (1 - p)
        at = t * alpha + (1 - t) * (1 - alpha)
        total += -at * (1 - pt) ^ gamma * log(pt)
    end
    return total / n
end


function focal_grad(preds::Vector{Float64}, targets::Vector{Float64};
                    gamma::Float64=2.0, alpha::Float64=0.25,
                    eps::Float64=1e-15)::Vector{Float64}
    n = length(preds)
    grads = zeros(Float64, n)
    for i in 1:n
        p = clamp(preds[i], eps, 1 - eps)
        t = targets[i]
        pt = t * p + (1 - t) * (1 - p)
        at = t * alpha + (1 - t) * (1 - alpha)
        # d(pt)/d(p) = 2t - 1 (1 if t==1, -1 if t==0).
        dpt_dp = 2 * t - 1
        # d/dp [-(1-pt)^gamma * log(pt)] applied via chain rule.
        base = (1 - pt) ^ (gamma - 1)
        term = base * (gamma * log(pt) - (1 - pt) / pt)
        grads[i] = at * term * dpt_dp / n
    end
    return grads
end


function sigmoid(x::Float64)::Float64
    return 1.0 / (1.0 + exp(-clamp(x, -500.0, 500.0)))
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


mutable struct LossNetwork
    loss_type::Symbol  # :mse or :bce
    lr::Float64
    hidden_size::Int
    w1::Matrix{Float64}
    b1::Vector{Float64}
    w2::Vector{Float64}
    b2::Float64
    x::Vector{Float64}
    z1::Vector{Float64}
    h::Vector{Float64}
    out::Float64
end

function LossNetwork(loss_type::Symbol; hidden_size::Int=8, lr::Float64=0.1, seed::Int=0)
    loss_type in (:mse, :bce) ||
        throw(ArgumentError("LossNetwork: loss_type must be :mse or :bce, got :$loss_type"))
    rng = MersenneTwister(seed)
    return LossNetwork(
        loss_type, lr, hidden_size,
        randn(rng, hidden_size, 2) .* 0.5,
        zeros(Float64, hidden_size),
        randn(rng, hidden_size) .* 0.5,
        0.0,
        Float64[], zeros(Float64, hidden_size), zeros(Float64, hidden_size), 0.0,
    )
end


function forward!(net::LossNetwork, x::Vector{Float64})::Float64
    net.x = x
    for i in 1:net.hidden_size
        z = net.w1[i, 1] * x[1] + net.w1[i, 2] * x[2] + net.b1[i]
        net.z1[i] = z
        net.h[i] = max(0.0, z)
    end
    z2 = sum(net.w2 .* net.h) + net.b2
    net.out = sigmoid(z2)
    return net.out
end


function backward!(net::LossNetwork, target::Float64)
    eps = 1e-15
    p = clamp(net.out, eps, 1 - eps)
    d_loss = net.loss_type == :mse ? 2.0 * (net.out - target) :
                                     -(target / p) + (1 - target) / (1 - p)
    d_sig = net.out * (1 - net.out)
    d_out = d_loss * d_sig
    for i in 1:net.hidden_size
        d_relu = net.z1[i] > 0 ? 1.0 : 0.0
        d_h = d_out * net.w2[i] * d_relu
        net.w2[i] -= net.lr * d_out * net.h[i]
        net.w1[i, 1] -= net.lr * d_h * net.x[1]
        net.w1[i, 2] -= net.lr * d_h * net.x[2]
        net.b1[i] -= net.lr * d_h
    end
    net.b2 -= net.lr * d_out
end


function compute_loss(net::LossNetwork, pred::Float64, target::Float64)::Float64
    eps = 1e-15
    p = clamp(pred, eps, 1 - eps)
    return net.loss_type == :mse ? (pred - target) ^ 2 :
           -(target * log(p) + (1 - target) * log(1 - p))
end


function train!(net::LossNetwork, data::Vector{Tuple{Vector{Float64}, Float64}};
                epochs::Int=200)
    history = Tuple{Float64, Float64}[]
    for epoch in 0:(epochs - 1)
        total = 0.0
        correct = 0
        for (x, y) in data
            pred = forward!(net, x)
            backward!(net, y)
            total += compute_loss(net, pred, y)
            if (pred >= 0.5) == (y >= 0.5)
                correct += 1
            end
        end
        avg = total / length(data)
        acc = correct / length(data) * 100
        push!(history, (avg, acc))
        if epoch % 50 == 0 || epoch == epochs - 1
            @printf("    Epoch %3d: loss=%.4f, accuracy=%.1f%%\n", epoch, avg, acc)
        end
    end
    return history
end


function main()
    println("=" ^ 60)
    println("STEP 1: MSE Loss")
    println("=" ^ 60)
    preds = Float64[0.9, 0.1, 0.7, 0.4]
    targets = Float64[1.0, 0.0, 1.0, 0.0]
    println("  Predictions: $preds")
    println("  Targets:     $targets")
    @printf("  MSE Loss:    %.6f\n", mse(preds, targets))
    println("  MSE Grads:   $(round.(mse_grad(preds, targets), digits=4))")

    println("\n" * "=" ^ 60)
    println("STEP 2: MAE Loss")
    println("=" ^ 60)
    @printf("  MAE Loss:    %.6f\n", mae(preds, targets))
    println("  MAE Grads:   $(round.(mae_grad(preds, targets), digits=4))")

    println("\n" * "=" ^ 60)
    println("STEP 3: Binary Cross-Entropy")
    println("=" ^ 60)
    @printf("  BCE Loss:    %.6f\n", binary_cross_entropy(preds, targets))
    println("  BCE Grads:   $(round.(bce_grad(preds, targets), digits=4))")

    println("\n  CE loss at different confidence levels (true label = 1):")
    for conf in [0.01, 0.1, 0.5, 0.9, 0.99]
        ce = -log(max(1e-15, conf))
        ms = (conf - 1.0) ^ 2
        @printf("    p=%.2f: CE=%.4f, MSE=%.4f, ratio=%.1fx\n", conf, ce, ms, ce / max(0.0001, ms))
    end

    println("\n" * "=" ^ 60)
    println("STEP 4: Categorical Cross-Entropy + Softmax")
    println("=" ^ 60)
    logits = Float64[2.0, 1.0, 0.1, -1.0, 3.0]
    target_idx = 4   # 0-indexed; 5th class
    probs = softmax(logits)
    println("  Logits:  $logits")
    println("  Softmax: $(round.(probs, digits=4))")
    println("  Target class: $target_idx")
    @printf("  CCE Loss: %.6f\n", categorical_cross_entropy(logits, target_idx))
    println("  Gradient: $(round.(cce_grad(logits, target_idx), digits=4))")

    println("\n" * "=" ^ 60)
    println("STEP 5: Focal Loss (handles class imbalance)")
    println("=" ^ 60)
    # Show focal loss down-weighting easy correct examples vs hard ones.
    println("  Effect of focal modulator (1 - pt)^gamma for true label = 1:")
    for p in [0.05, 0.5, 0.95]
        pt = p
        modulator = (1 - pt) ^ 2.0
        ce = -log(max(1e-15, pt))
        focal = modulator * ce
        @printf("    p=%.2f  CE=%.4f  modulator=(1-pt)^2=%.4f  Focal=%.4f\n", p, ce, modulator, focal)
    end

    # Mixed batch: half-correct preds, gamma=2, alpha=0.25.
    @printf("\n  Batch focal loss (gamma=2, alpha=0.25): %.6f\n",
            focal_loss(preds, targets))
    println("  Batch focal grads: $(round.(focal_grad(preds, targets), digits=4))")
    @printf("\n  Batch BCE for comparison: %.6f\n", binary_cross_entropy(preds, targets))

    println("\n" * "=" ^ 60)
    println("STEP 6: MSE vs BCE on Classification")
    println("=" ^ 60)
    data = make_circle_data()
    for loss_type in [:mse, :bce]
        println("\n--- Training with $(uppercase(string(loss_type))) ---")
        net = LossNetwork(loss_type; hidden_size=8, lr=0.1)
        history = train!(net, data; epochs=200)
        final_loss, final_acc = history[end]
        @printf("  Final: loss=%.4f, accuracy=%.1f%%\n", final_loss, final_acc)
    end

    println("\n=== Key Takeaway ===")
    println("  Cross-entropy converges faster on classification because its")
    println("  gradient stays strong when predictions are wrong. MSE flattens")
    println("  near 0 and 1 due to sigmoid saturation. Focal loss adds a")
    println("  modulator that further focuses on hard examples.")
end


if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
