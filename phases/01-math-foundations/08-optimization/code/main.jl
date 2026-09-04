# Optimization in Julia. GradientDescent, SGD+Momentum, and Adam
# implemented as mutable structs with a common `step!` method.
# Driven on the Rosenbrock and saddle-point functions to show
# convergence, divergence, and saddle escape behavior.
# Stdlib only. Sources:
#   https://docs.julialang.org/en/v1/manual/types/#Composite-Types
#   https://arxiv.org/abs/1412.6980  (Adam: Kingma & Ba)

using Printf


abstract type Optimizer end


mutable struct GradientDescent <: Optimizer
    lr::Float64
end
GradientDescent(; lr::Float64=0.001) = GradientDescent(lr)

function step!(opt::GradientDescent, params::Vector{Float64}, grads::Vector{Float64})
    return params .- opt.lr .* grads
end


mutable struct SGDMomentum <: Optimizer
    lr::Float64
    momentum::Float64
    velocity::Vector{Float64}
end
SGDMomentum(; lr::Float64=0.001, momentum::Float64=0.9) =
    SGDMomentum(lr, momentum, Float64[])

function step!(opt::SGDMomentum, params::Vector{Float64}, grads::Vector{Float64})
    if isempty(opt.velocity)
        opt.velocity = zeros(length(params))
    end
    opt.velocity .= opt.momentum .* opt.velocity .+ grads
    return params .- opt.lr .* opt.velocity
end


mutable struct Adam <: Optimizer
    lr::Float64
    beta1::Float64
    beta2::Float64
    epsilon::Float64
    m::Vector{Float64}
    v::Vector{Float64}
    t::Int
end
Adam(; lr::Float64=0.001, beta1::Float64=0.9, beta2::Float64=0.999,
     epsilon::Float64=1e-8) =
    Adam(lr, beta1, beta2, epsilon, Float64[], Float64[], 0)

function step!(opt::Adam, params::Vector{Float64}, grads::Vector{Float64})
    if isempty(opt.m)
        opt.m = zeros(length(params))
        opt.v = zeros(length(params))
    end
    opt.t += 1
    opt.m .= opt.beta1 .* opt.m .+ (1 - opt.beta1) .* grads
    opt.v .= opt.beta2 .* opt.v .+ (1 - opt.beta2) .* grads .^ 2
    m_hat = opt.m ./ (1 - opt.beta1 ^ opt.t)
    v_hat = opt.v ./ (1 - opt.beta2 ^ opt.t)
    return params .- opt.lr .* m_hat ./ (sqrt.(v_hat) .+ opt.epsilon)
end


rosenbrock(p::Vector{Float64})::Float64 = (1 - p[1]) ^ 2 + 100 * (p[2] - p[1] ^ 2) ^ 2


function rosenbrock_grad(p::Vector{Float64})::Vector{Float64}
    x, y = p[1], p[2]
    df_dx = -2 * (1 - x) + 200 * (y - x ^ 2) * (-2 * x)
    df_dy = 200 * (y - x ^ 2)
    return Float64[df_dx, df_dy]
end


function optimize(opt::Optimizer, f, grad_f, start::Vector{Float64}; steps::Int=5000)
    params = copy(start)
    history = Vector{Vector{Float64}}()
    push!(history, copy(params))
    for _ in 1:steps
        grads = grad_f(params)
        if any(g -> !isfinite(g) || abs(g) > 1e15, grads)
            break
        end
        params = step!(opt, params, grads)
        if any(p -> !isfinite(p) || abs(p) > 1e15, params)
            break
        end
        push!(history, copy(params))
    end
    return history
end


function distance_to_minimum(p::Vector{Float64}, target::Tuple{Float64, Float64}=(1.0, 1.0))::Float64
    return sqrt((p[1] - target[1]) ^ 2 + (p[2] - target[2]) ^ 2)
end


function find_convergence_step(history, f; threshold::Float64=1e-4)::Int
    for (i, params) in enumerate(history)
        if f(params) < threshold
            return i - 1
        end
    end
    return length(history)
end


function print_trajectory(name::String, history, f; steps_to_show::Int=10)
    total = length(history) - 1
    interval = max(1, total ÷ steps_to_show)
    println("\n" * "=" ^ 60)
    println("  $name")
    println("=" ^ 60)
    @printf("  %6s  %10s  %10s  %14s  %8s\n", "Step", "x", "y", "Loss", "Dist")
    println("  " * "-" ^ 52)
    for i in 0:interval:total
        p = history[i + 1]
        loss = f(p)
        dist = distance_to_minimum(p)
        @printf("  %6d  %10.6f  %10.6f  %14.8f  %8.4f\n", i, p[1], p[2], loss, dist)
    end
    if total % interval != 0
        p = history[end]
        loss = f(p)
        dist = distance_to_minimum(p)
        @printf("  %6d  %10.6f  %10.6f  %14.8f  %8.4f\n", total, p[1], p[2], loss, dist)
    end
end


function print_ascii_convergence(results, f; steps::Int=5000)
    println("\n" * "=" ^ 60)
    println("  CONVERGENCE COMPARISON (log10 loss over steps)")
    println("=" ^ 60)
    width = 50
    sample_points = 40
    interval = max(1, steps ÷ sample_points)
    for (name, history) in results
        losses = Float64[]
        i = 0
        while i <= min(length(history) - 1, steps)
            push!(losses, f(history[i + 1]))
            i += interval
        end
        isempty(losses) && continue
        max_log = 5.0
        min_log = -8.0
        log_range = max_log - min_log
        bars = Int[]
        for loss in losses
            ll = log10(loss + 1e-15)
            ll = clamp(ll, min_log, max_log)
            normalized = (ll - min_log) / log_range
            push!(bars, Int(round(normalized * (width - 1))))
        end
        println("\n  $name:")
        println("  loss 1e-8 " * "."^width * " 1e+5")
        for (idx, pos) in enumerate(bars)
            step_num = (idx - 1) * interval
            line = fill(' ', width)
            line[clamp(pos + 1, 1, width)] = '*'
            println("  " * lpad(string(step_num), 5) * " |" * String(line) * "|")
        end
        final_loss = f(history[end])
        conv_step = find_convergence_step(history, f)
        conv_msg = conv_step < length(history) ? "step $conv_step" : "did not converge"
        @printf("  final loss: %.2e, converged (< 1e-4): %s\n", final_loss, conv_msg)
    end
end


function demo_comparison()
    println("OPTIMIZATION METHODS COMPARISON")
    println("Minimizing the Rosenbrock function: f(x, y) = (1-x)^2 + 100(y-x^2)^2")
    println("Global minimum at (1, 1) where f = 0")
    @printf("Starting point: (-1.0, 1.0), f = %.1f\n", rosenbrock(Float64[-1.0, 1.0]))

    start = Float64[-1.0, 1.0]
    steps = 5000

    configs = [
        ("Gradient Descent", GradientDescent(lr=0.0005)),
        ("SGD + Momentum",   SGDMomentum(lr=0.0001, momentum=0.9)),
        ("Adam",             Adam(lr=0.01)),
    ]

    results = Tuple{String, Vector{Vector{Float64}}}[]
    for (name, opt) in configs
        history = optimize(opt, rosenbrock, rosenbrock_grad, start; steps=steps)
        push!(results, (name, history))
        print_trajectory(name, history, rosenbrock)
    end

    print_ascii_convergence(results, rosenbrock; steps=steps)

    println("\n" * "=" ^ 60)
    println("  FINAL RESULTS")
    println("=" ^ 60)
    @printf("  %-22s  %10s  %10s  %14s\n", "Method", "x", "y", "Loss")
    println("  " * "-" ^ 58)
    for (name, history) in results
        final = history[end]
        loss = rosenbrock(final)
        @printf("  %-22s  %10.6f  %10.6f  %14.8f\n", name, final[1], final[2], loss)
    end
    println("\n  Target: x=1.000000, y=1.000000, loss=0.00000000")
end


function demo_learning_rate_effect()
    println("\n\n" * "=" ^ 60)
    println("  LEARNING RATE EFFECT ON GRADIENT DESCENT")
    println("=" ^ 60)
    start = Float64[-1.0, 1.0]
    rates = [0.0001, 0.0005, 0.001, 0.005]
    @printf("\n  %8s  %10s  %10s  %14s  %s\n", "LR", "Final x", "Final y", "Loss", "Status")
    println("  " * "-" ^ 60)
    for lr in rates
        gd = GradientDescent(lr=lr)
        history = optimize(gd, rosenbrock, rosenbrock_grad, start; steps=5000)
        final = history[end]
        loss = rosenbrock(final)
        diverged = !isfinite(loss) || loss > 1e10
        status = diverged ? "DIVERGED" : (loss < 0.01 ? "converged" : "slow")
        if diverged
            @printf("  %8.4f  %10s  %10s  %14s  %s\n", lr, "nan", "nan", "inf", status)
        else
            @printf("  %8.4f  %10.6f  %10.6f  %14.8f  %s\n", lr, final[1], final[2], loss, status)
        end
    end
end


function demo_momentum_effect()
    println("\n\n" * "=" ^ 60)
    println("  MOMENTUM EFFECT ON SGD")
    println("=" ^ 60)
    start = Float64[-1.0, 1.0]
    betas = [0.0, 0.5, 0.9, 0.99]
    @printf("\n  %6s  %10s  %10s  %14s\n", "Beta", "Final x", "Final y", "Loss")
    println("  " * "-" ^ 46)
    for beta in betas
        sgd = SGDMomentum(lr=0.0001, momentum=beta)
        history = optimize(sgd, rosenbrock, rosenbrock_grad, start; steps=5000)
        final = history[end]
        loss = rosenbrock(final)
        if !isfinite(loss)
            @printf("  %6.2f  %10s  %10s  %14s\n", beta, "nan", "nan", "inf")
        else
            @printf("  %6.2f  %10.6f  %10.6f  %14.8f\n", beta, final[1], final[2], loss)
        end
    end
end


function demo_saddle_point()
    println("\n\n" * "=" ^ 60)
    println("  SADDLE POINT ESCAPE: f(x, y) = x^2 - y^2")
    println("=" ^ 60)

    saddle(p::Vector{Float64}) = p[1] ^ 2 - p[2] ^ 2
    saddle_grad(p::Vector{Float64}) = Float64[2 * p[1], -2 * p[2]]

    start = Float64[0.01, 0.01]
    steps = 200

    configs = [
        ("Gradient Descent", GradientDescent(lr=0.01)),
        ("SGD + Momentum",   SGDMomentum(lr=0.01, momentum=0.9)),
        ("Adam",             Adam(lr=0.01)),
    ]

    println("\n  Start: x=0.01, y=0.01 (near saddle at origin)")
    @printf("\n  %-22s  %10s  %10s  %12s  %s\n", "Method", "x", "y", "f(x, y)", "Escaped?")
    println("  " * "-" ^ 62)
    for (name, opt) in configs
        history = optimize(opt, saddle, saddle_grad, start; steps=steps)
        final = history[end]
        val = saddle(final)
        escaped = abs(final[2]) > 1.0 ? "yes" : "no"
        @printf("  %-22s  %10.6f  %10.6f  %12.6f  %s\n", name, final[1], final[2], val, escaped)
    end
end


function main()
    demo_comparison()
    demo_learning_rate_effect()
    demo_momentum_effect()
    demo_saddle_point()
end


if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
