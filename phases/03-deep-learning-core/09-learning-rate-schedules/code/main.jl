# Lesson: Learning Rate Schedules (phase 03 / lesson 09)
# Julia port of code/main.py. Julia standard library only.
# Source: phases/03-deep-learning-core/09-learning-rate-schedules/docs/en.md
# Run: julia code/main.jl

using Random
using Printf

constant_schedule(step; lr=0.01, kwargs...) = lr

step_decay_schedule(step; lr=0.1, step_size=100, gamma=0.1, kwargs...) = lr * gamma^(step ÷ step_size)

function cosine_schedule(step; lr=0.01, total_steps=1000, lr_min=1e-5, kwargs...)
    step >= total_steps && return lr_min
    return lr_min + 0.5 * (lr - lr_min) * (1 + cos(pi * step / total_steps))
end

function warmup_cosine_schedule(step; lr=0.01, total_steps=1000, warmup_steps=100, lr_min=1e-5, kwargs...)
    total_steps <= warmup_steps && return lr * (step / max(warmup_steps, 1))
    step < warmup_steps && return lr * step / warmup_steps
    progress = (step - warmup_steps) / (total_steps - warmup_steps)
    return lr_min + 0.5 * (lr - lr_min) * (1 + cos(pi * progress))
end

function one_cycle_schedule(step; lr=0.01, total_steps=1000, kwargs...)
    mid = max(total_steps ÷ 2, 1)
    step < mid && return (lr / 25) + (lr - lr / 25) * step / mid
    progress = (step - mid) / max(total_steps - mid, 1)
    return lr * (1 - progress) + (lr / 10000) * progress
end

function visualize_schedule(name, schedule_fn; total_steps=500, kwargs...)
    steps = collect(0:(total_steps ÷ 20):total_steps-1)
    (total_steps - 1) in steps || push!(steps, total_steps - 1)
    lrs = [schedule_fn(s; total_steps=total_steps, kwargs...) for s in steps]
    max_lr = maximum(lrs) > 0 ? maximum(lrs) : 1.0
    println("\n$name:")
    for (s, lr_val) in zip(steps, lrs)
        @printf("  Step %4d: lr=%.6f %s\n", s, lr_val, "#"^trunc(Int, lr_val / max_lr * 40))
    end
end

sigmoid(x) = 1.0 / (1.0 + exp(-clamp(x, -500, 500)))
relu(x) = max(0.0, x)
relu_deriv(x) = x > 0 ? 1.0 : 0.0

uniform(lo, hi) = lo + (hi - lo) * rand()
gauss(mu, sigma) = mu + sigma * randn()

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

function train_with_schedule(schedule_fn, schedule_name, data; epochs=300, base_lr=0.05, kwargs...)
    Random.seed!(0)
    hidden_size = 8
    total_steps = epochs * length(data)
    std = sqrt(2.0 / 2)
    w1 = [[gauss(0, std) for _ in 1:2] for _ in 1:hidden_size]
    b1 = zeros(hidden_size)
    w2 = [gauss(0, std) for _ in 1:hidden_size]
    b2 = 0.0

    step = 0
    epoch_losses = Float64[]
    for _ in 1:epochs
        total_loss = 0.0
        for (x, target) in data
            lr = schedule_fn(step; lr=base_lr, total_steps=total_steps, kwargs...)
            z1 = [w1[i][1] * x[1] + w1[i][2] * x[2] + b1[i] for i in 1:hidden_size]
            h = relu.(z1)
            out = sigmoid(sum(w2 .* h) + b2)
            d_out = (out - target) * out * (1 - out)
            for i in 1:hidden_size
                d_h = d_out * w2[i] * relu_deriv(z1[i])
                w2[i] -= lr * d_out * h[i]
                for j in 1:2
                    w1[i][j] -= lr * d_h * x[j]
                end
                b1[i] -= lr * d_h
            end
            b2 -= lr * d_out
            total_loss += (out - target)^2
            step += 1
        end
        push!(epoch_losses, total_loss / length(data))
    end
    return epoch_losses
end

function compare_schedules(data)
    configs = [
        ("Constant", constant_schedule, (;)),
        ("Step Decay", step_decay_schedule, (step_size=15000, gamma=0.1)),
        ("Cosine", cosine_schedule, (lr_min=1e-5,)),
        ("Warmup+Cosine", warmup_cosine_schedule, (warmup_steps=3000, lr_min=1e-5)),
        ("1cycle", one_cycle_schedule, (;)),
    ]
    @printf("\n%-20s %12s %12s %12s %12s\n", "Schedule", "Start Loss", "Mid Loss", "End Loss", "Best Loss")
    println("-"^70)
    for (name, fn, extra) in configs
        losses = train_with_schedule(fn, name, data; epochs=300, base_lr=0.05, extra...)
        mid_idx = length(losses) ÷ 2 + 1
        @printf("%-20s %12.6f %12.6f %12.6f %12.6f\n", name, losses[1], losses[mid_idx], losses[end], minimum(losses))
    end
end

function lr_sensitivity(data)
    @printf("\n%10s %12s %12s %15s\n", "LR", "Start Loss", "End Loss", "Status")
    println("-"^52)
    for lr in [1.0, 0.1, 0.05, 0.01, 0.001, 0.0001]
        losses = train_with_schedule(constant_schedule, "lr=$lr", data; epochs=100, base_lr=lr)
        start, finish = losses[1], losses[end]
        status = if isnan(finish) || finish > 1.0
            "DIVERGED"
        elseif finish > start * 0.9
            "BARELY MOVED"
        elseif finish < 0.15
            "CONVERGED"
        else
            "LEARNING"
        end
        end_str = isnan(finish) ? "NaN" : @sprintf("%.6f", finish)
        @printf("%10.4f %12.6f %12s %15s\n", lr, start, end_str, status)
    end
end

function warmup_impact(data)
    total_steps = 300 * length(data)
    @printf("\n%10s %14s %12s %12s\n", "Warmup %", "Warmup Steps", "End Loss", "Best Loss")
    println("-"^52)
    for frac in [0.0, 0.01, 0.05, 0.10, 0.20]
        warmup_steps = trunc(Int, total_steps * frac)
        losses = train_with_schedule(warmup_cosine_schedule, "warmup=$frac", data;
            epochs=300, base_lr=0.05, warmup_steps=warmup_steps, lr_min=1e-5)
        @printf("%9.0f%% %14d %12.6f %12.6f\n", frac * 100, warmup_steps, losses[end], minimum(losses))
    end
end

function schedule_trajectory(data)
    total_steps = 100 * length(data)
    schedules = [
        ("Constant", constant_schedule, (lr=0.05,)),
        ("Cosine", cosine_schedule, (lr=0.05, lr_min=1e-5)),
        ("Warmup+Cosine", warmup_cosine_schedule, (lr=0.05, warmup_steps=trunc(Int, total_steps * 0.05), lr_min=1e-5)),
        ("1cycle", one_cycle_schedule, (lr=0.05,)),
    ]
    println("\nLR at key training points:")
    @printf("  %-20s %10s %10s %10s %10s %10s\n", "Schedule", "Step 0", "Step T/4", "Step T/2", "Step 3T/4", "Step T")
    println("  ", "-"^60)
    for (name, fn, kw) in schedules
        points = [0, total_steps ÷ 4, total_steps ÷ 2, 3 * total_steps ÷ 4, total_steps - 1]
        v = [fn(s; total_steps=total_steps, kw...) for s in points]
        @printf("  %-20s %10.6f %10.6f %10.6f %10.6f %10.6f\n", name, v[1], v[2], v[3], v[4], v[5])
    end
end

banner(title) = (println("="^70); println(title); println("="^70))

function main()
    banner("STEP 1: Schedule Shapes")
    visualize_schedule("Constant", constant_schedule; lr=0.05)
    visualize_schedule("Step Decay", step_decay_schedule; lr=0.05, step_size=125, gamma=0.5)
    visualize_schedule("Cosine Annealing", cosine_schedule; lr=0.05, lr_min=1e-5)
    visualize_schedule("Warmup + Cosine", warmup_cosine_schedule; lr=0.05, warmup_steps=50, lr_min=1e-5)
    visualize_schedule("1cycle", one_cycle_schedule; lr=0.05)

    data = make_circle_data()

    println()
    banner("STEP 2: LR Sensitivity")
    lr_sensitivity(data)

    println()
    banner("STEP 3: Schedule Comparison")
    compare_schedules(data)

    println()
    banner("STEP 4: Warmup Impact")
    warmup_impact(data)

    println()
    banner("STEP 5: Schedule Trajectory")
    schedule_trajectory(data)
end

if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
