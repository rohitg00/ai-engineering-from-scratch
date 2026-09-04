# Backpropagation in Julia. Derives the chain rule for a 2-layer MLP
# step by step on paper, then trains it on XOR + circle classification.
# All gradients computed manually — no autodiff library.
# Stdlib only. Sources:
#   https://en.wikipedia.org/wiki/Backpropagation
#   https://docs.julialang.org/en/v1/manual/arrays/#Broadcasting

using Random
using Printf


sigmoid(x::Float64)::Float64 = 1.0 / (1.0 + exp(-clamp(x, -500.0, 500.0)))
sigmoid_d(s::Float64)::Float64 = s * (1 - s)


mutable struct MLP
    # First (hidden) layer: w1[i, j] = weight from input j to hidden unit i.
    w1::Matrix{Float64}
    b1::Vector{Float64}
    # Output layer.
    w2::Matrix{Float64}
    b2::Vector{Float64}
    lr::Float64
    # Caches for backprop.
    last_x::Vector{Float64}
    z1::Vector{Float64}
    a1::Vector{Float64}
    z2::Vector{Float64}
    a2::Vector{Float64}
end


function MLP(sizes::Vector{Int}; lr::Float64=1.0, seed::Int=42)
    @assert length(sizes) == 3 "this MLP is fixed to 1 hidden layer"
    rng = MersenneTwister(seed)
    n_in, n_hid, n_out = sizes
    # He-like init scaled for sigmoid.
    scale_w1 = sqrt(2.0 / n_in)
    scale_w2 = sqrt(2.0 / n_hid)
    return MLP(
        randn(rng, n_hid, n_in) .* scale_w1,
        zeros(Float64, n_hid),
        randn(rng, n_out, n_hid) .* scale_w2,
        zeros(Float64, n_out),
        lr,
        Float64[], zeros(Float64, n_hid), zeros(Float64, n_hid),
        zeros(Float64, n_out), zeros(Float64, n_out),
    )
end


function forward!(m::MLP, x::Vector{Float64})::Vector{Float64}
    m.last_x = x
    m.z1 = m.w1 * x .+ m.b1
    m.a1 = sigmoid.(m.z1)
    m.z2 = m.w2 * m.a1 .+ m.b2
    m.a2 = sigmoid.(m.z2)
    return m.a2
end


# Compute gradients for one (x, y) pair under squared-error loss.
# Returns the gradients without applying them so the caller can
# accumulate over a batch then call apply_grads!.
function backward(m::MLP, target::Vector{Float64})
    err = m.a2 .- target
    # d_loss/d_z2 = err .* sigmoid'(a2)
    delta2 = err .* sigmoid_d.(m.a2)
    grad_w2 = delta2 * m.a1'
    grad_b2 = delta2
    # Backprop into hidden layer.
    delta1 = (m.w2' * delta2) .* sigmoid_d.(m.a1)
    grad_w1 = delta1 * m.last_x'
    grad_b1 = delta1
    return grad_w1, grad_b1, grad_w2, grad_b2
end


function apply_grads!(m::MLP, gw1, gb1, gw2, gb2)
    m.w1 .-= m.lr .* gw1
    m.b1 .-= m.lr .* gb1
    m.w2 .-= m.lr .* gw2
    m.b2 .-= m.lr .* gb2
end


mse_loss(pred::Vector{Float64}, target::Vector{Float64})::Float64 =
    0.5 * sum((pred .- target) .^ 2)


function train_xor!()
    println("=" ^ 50)
    println("Training on XOR")
    println("=" ^ 50)
    net = MLP(Int[2, 4, 1]; lr=1.0, seed=42)
    xor_data = Tuple{Vector{Float64}, Vector{Float64}}[
        (Float64[0, 0], Float64[0]),
        (Float64[0, 1], Float64[1]),
        (Float64[1, 0], Float64[1]),
        (Float64[1, 1], Float64[0]),
    ]
    for epoch in 0:999
        total_loss = 0.0
        # Batch gradient: sum gradients across the four examples.
        gw1 = zeros(size(net.w1))
        gb1 = zeros(size(net.b1))
        gw2 = zeros(size(net.w2))
        gb2 = zeros(size(net.b2))
        for (x, y) in xor_data
            pred = forward!(net, x)
            total_loss += mse_loss(pred, y)
            dw1, db1, dw2, db2 = backward(net, y)
            gw1 .+= dw1
            gb1 .+= db1
            gw2 .+= dw2
            gb2 .+= db2
        end
        apply_grads!(net, gw1, gb1, gw2, gb2)
        if epoch % 100 == 0
            @printf("Epoch %4d | Loss: %.6f\n", epoch, total_loss)
        end
    end
    println("\nXOR Results:")
    for (x, y) in xor_data
        pred = forward!(net, x)
        cls = pred[1] > 0.5 ? 1 : 0
        @printf("  %s -> %.4f (rounded: %d, expected %d)\n", x, pred[1], cls, Int(y[1]))
    end
end


function generate_circle_data(rng::AbstractRNG; n::Int=100)
    data = Tuple{Vector{Float64}, Vector{Float64}}[]
    for _ in 1:n
        x1 = rand(rng) * 3 - 1.5
        x2 = rand(rng) * 3 - 1.5
        label = x1 * x1 + x2 * x2 < 1.0 ? 1.0 : 0.0
        push!(data, (Float64[x1, x2], Float64[label]))
    end
    return data
end


function train_circle!()
    println("\n" * "=" ^ 50)
    println("Training on Circle Classification")
    println("=" ^ 50)
    rng = MersenneTwister(7)
    net = MLP(Int[2, 8, 1]; lr=0.5, seed=7)
    data = generate_circle_data(rng; n=80)

    for epoch in 0:1999
        # Shuffle each epoch for SGD.
        order = randperm(rng, length(data))
        total = 0.0
        for idx in order
            x, y = data[idx]
            pred = forward!(net, x)
            total += mse_loss(pred, y)
            dw1, db1, dw2, db2 = backward(net, y)
            apply_grads!(net, dw1, db1, dw2, db2)
        end
        if epoch % 200 == 0
            correct = 0
            for (x, y) in data
                pred = forward!(net, x)
                cls = pred[1] > 0.5 ? 1.0 : 0.0
                if cls == y[1]
                    correct += 1
                end
            end
            acc = correct / length(data) * 100
            @printf("Epoch %4d | Loss: %.4f | Accuracy: %.1f%%\n", epoch, total, acc)
        end
    end

    println("\nSample Circle Results:")
    test_points = [
        (Float64[0.0, 0.0], "inside"),
        (Float64[0.5, 0.5], "inside"),
        (Float64[1.2, 1.2], "outside"),
        (Float64[0.0, 1.2], "outside"),
        (Float64[-0.3, 0.3], "inside"),
    ]
    for (p, region) in test_points
        pred = forward!(net, p)
        cls = pred[1] > 0.5 ? "inside" : "outside"
        status = cls == region ? "OK" : "WRONG"
        @printf("  %s -> %.4f (%s, expected %s) %s\n", p, pred[1], cls, region, status)
    end
end


function gradient_check_demo()
    println("\n" * "=" ^ 50)
    println("Gradient check: backprop vs numerical")
    println("=" ^ 50)
    net = MLP(Int[2, 3, 1]; lr=0.1, seed=1)
    x = Float64[0.6, -0.4]
    y = Float64[1.0]
    forward!(net, x)
    dw1, db1, dw2, db2 = backward(net, y)

    # Pick a weight in w1 and compare backprop grad with finite-difference grad.
    h = 1e-5
    i, j = 1, 1
    saved = net.w1[i, j]
    net.w1[i, j] = saved + h
    forward!(net, x)
    loss_plus = mse_loss(net.a2, y)
    net.w1[i, j] = saved - h
    forward!(net, x)
    loss_minus = mse_loss(net.a2, y)
    net.w1[i, j] = saved
    numerical = (loss_plus - loss_minus) / (2h)
    analytical = dw1[i, j]  # mse_loss is 0.5*sum((a-y)^2); backward uses err=a-y, so dw1 matches directly.
    @printf("  w1[%d,%d]: analytical=%.6f  numerical=%.6f  diff=%.2e\n",
            i, j, analytical, numerical, abs(analytical - numerical))
    println("  (backward() uses err=a-y, matching the 0.5*sum((a-y)^2) convention; grads align directly.)")
end


function main()
    train_xor!()
    train_circle!()
    gradient_check_demo()
end


if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
