# Lesson: Weight Initialization (phase 03 / lesson 08)
# Julia port of code/main.py. Julia standard library only.
# Source: phases/03-deep-learning-core/08-weight-initialization/docs/en.md
# Run: julia code/main.jl

using Random
using Printf

gauss(mu, sigma) = mu + sigma * randn()
uniform(lo, hi) = lo + (hi - lo) * rand()

gauss_matrix(fan_in, fan_out, std) = permutedims([gauss(0, std) for _ in 1:fan_in, _ in 1:fan_out])

zero_init(fan_in, fan_out) = zeros(fan_out, fan_in)
random_init(fan_in, fan_out, scale=1.0) = gauss_matrix(fan_in, fan_out, scale)
xavier_init(fan_in, fan_out) = gauss_matrix(fan_in, fan_out, sqrt(2.0 / (fan_in + fan_out)))
kaiming_init(fan_in, fan_out) = gauss_matrix(fan_in, fan_out, sqrt(2.0 / fan_in))

sigmoid(x) = 1.0 / (1.0 + exp(-clamp(x, -500, 500)))
tanh_act(x) = tanh(x)
relu(x) = max(0.0, x)

function forward_deep(init_fn, activation_fn; n_layers=50, width=64, n_samples=100)
    Random.seed!(42)
    layer_magnitudes = Float64[]
    inputs = permutedims([gauss(0, 1) for _ in 1:width, _ in 1:n_samples])
    for _ in 1:n_layers
        weights = init_fn(width, width)
        biases = zeros(width)
        inputs = activation_fn.(inputs * permutedims(weights) .+ permutedims(biases))
        magnitudes = vec(sum(abs.(inputs); dims=2)) ./ width
        push!(layer_magnitudes, sum(magnitudes) / length(magnitudes))
    end
    return layer_magnitudes
end

function magnitude_report(name, magnitudes)
    println("\n$name:")
    for (i, mag) in enumerate(magnitudes)
        if (i - 1) % 5 == 0 || i == length(magnitudes)
            if mag > 1e6
                bar = "X"^50 * " EXPLODED"
            elseif mag < 1e-6
                bar = ". VANISHED"
            else
                bar = "#"^min(50, max(1, trunc(Int, mag * 10)))
            end
            @printf("  Layer %3d: %s (%.6f)\n", i, bar, mag)
        end
    end
end

function symmetry_demo()
    weights = zero_init(2, 4)
    biases = zeros(4)
    inputs = [0.5, -0.3]
    outputs = sigmoid.(weights * inputs .+ biases)
    println("Symmetry Demo (4 neurons, zero init):")
    for (i, out) in enumerate(outputs)
        @printf("  Neuron %d: output = %.6f\n", i - 1, out)
    end
    all_same = all(abs(o - outputs[1]) < 1e-10 for o in outputs)
    println("  All identical: ", all_same ? "True" : "False")
    println("  Effective parameters: 1 (not $(length(weights)))")
end

function variance_analysis()
    fan_in = 64
    n_trials = 10000
    configs = [
        ("Random N(0,1)", 1.0),
        ("Random N(0,0.01)", 0.01),
        ("Xavier std", sqrt(2.0 / (fan_in + fan_in))),
        ("Kaiming std", sqrt(2.0 / fan_in)),
    ]
    println("\nVariance Analysis (fan_in=64, single layer):")
    @printf("  %-25s %12s %12s %10s\n", "Strategy", "Weight Var", "Output Var", "Ratio")
    println("  ", "-"^60)
    for (name, std) in configs
        Random.seed!(42)
        output_vars = Float64[]
        for _ in 1:n_trials
            inputs = [gauss(0, 1) for _ in 1:fan_in]
            weights = [gauss(0, std) for _ in 1:fan_in]
            z = sum(weights .* inputs)
            push!(output_vars, z * z)
        end
        mean_output_var = sum(output_vars) / length(output_vars)
        @printf("  %-25s %12.6f %12.4f %10.4f\n", name, std * std, mean_output_var, mean_output_var)
    end
end

function run_experiment()
    configs = [
        ("Zero + Sigmoid", zero_init, sigmoid),
        ("Random N(0,1) + ReLU", (fi, fo) -> random_init(fi, fo, 1.0), relu),
        ("Random N(0,0.01) + ReLU", (fi, fo) -> random_init(fi, fo, 0.01), relu),
        ("Xavier + Sigmoid", xavier_init, sigmoid),
        ("Xavier + Tanh", xavier_init, tanh_act),
        ("Kaiming + ReLU", kaiming_init, relu),
    ]
    @printf("\n%-30s %10s %10s %10s %10s %10s\n", "Strategy", "L1", "L5", "L10", "L25", "L50")
    println("-"^80)
    all_results = Tuple{String,Vector{Float64}}[]
    for (name, init_fn, act_fn) in configs
        mags = forward_deep(init_fn, act_fn)
        push!(all_results, (name, mags))
        row = @sprintf("%-30s", name)
        for idx in (1, 5, 10, 25, 50)
            val = mags[idx]
            if val > 1e6
                row *= @sprintf(" %10s", "EXPLODED")
            elseif val < 1e-6
                row *= @sprintf(" %10s", "VANISHED")
            else
                row *= @sprintf(" %10.4f", val)
            end
        end
        println(row)
    end
    return all_results
end

function train_with_init(data, init_name, init_scale, activation_fn, activation_deriv)
    Random.seed!(0)
    hidden_size = 8
    lr = 0.1
    if init_name == "xavier"
        std_w1 = sqrt(2.0 / (2 + hidden_size))
        std_w2 = sqrt(2.0 / (hidden_size + 1))
    elseif init_name == "kaiming"
        std_w1 = sqrt(2.0 / 2)
        std_w2 = sqrt(2.0 / hidden_size)
    else
        std_w1 = init_scale
        std_w2 = init_scale
    end
    w1 = [[gauss(0, std_w1) for _ in 1:2] for _ in 1:hidden_size]
    b1 = zeros(hidden_size)
    w2 = [gauss(0, std_w2) for _ in 1:hidden_size]
    b2 = 0.0

    losses = Float64[]
    for _ in 1:300
        total_loss = 0.0
        for (x, target) in data
            z1 = [w1[i][1] * x[1] + w1[i][2] * x[2] + b1[i] for i in 1:hidden_size]
            h = activation_fn.(z1)
            out = sigmoid(sum(w2 .* h) + b2)
            d_out = (out - target) * out * (1 - out)
            for i in 1:hidden_size
                d_h = d_out * w2[i] * activation_deriv(z1[i])
                w2[i] -= lr * d_out * h[i]
                for j in 1:2
                    w1[i][j] -= lr * d_h * x[j]
                end
                b1[i] -= lr * d_h
            end
            b2 -= lr * d_out
            total_loss += (out - target)^2
        end
        push!(losses, total_loss / length(data))
    end
    return losses
end

function training_comparison()
    Random.seed!(42)
    data = Tuple{Vector{Float64},Float64}[]
    for _ in 1:200
        x = uniform(-2, 2)
        y = uniform(-2, 2)
        push!(data, ([x, y], x * x + y * y < 1.5 ? 1.0 : 0.0))
    end

    sigmoid_d(x) = (s = sigmoid(x); s * (1 - s))
    relu_d(x) = x > 0 ? 1.0 : 0.0

    configs = [
        ("Random(0.01) + Sigmoid", "random", 0.01, sigmoid, sigmoid_d),
        ("Random(1.0) + Sigmoid", "random", 1.0, sigmoid, sigmoid_d),
        ("Xavier + Sigmoid", "xavier", 0.0, sigmoid, sigmoid_d),
        ("Random(0.01) + ReLU", "random", 0.01, relu, relu_d),
        ("Random(1.0) + ReLU", "random", 1.0, relu, relu_d),
        ("Kaiming + ReLU", "kaiming", 0.0, relu, relu_d),
    ]

    println("\nTraining Comparison (300 epochs, circle dataset):")
    @printf("  %-30s %12s %12s %12s\n", "Config", "Start Loss", "End Loss", "Improvement")
    println("  ", "-"^66)
    for (name, init_name, scale, act_fn, act_d_fn) in configs
        losses = train_with_init(data, init_name, scale, act_fn, act_d_fn)
        start, finish = losses[1], losses[end]
        improvement = start > 0 ? (1 - finish / start) * 100 : 0.0
        @printf("  %-30s %12.6f %12.6f %11.1f%%\n", name, start, finish, improvement)
    end
end

banner(title) = (println("="^70); println(title); println("="^70))

function main()
    banner("STEP 1: Symmetry Problem -- Zero Init")
    symmetry_demo()

    println()
    banner("STEP 2: Variance Analysis")
    variance_analysis()

    println()
    banner("STEP 3: 50-Layer Forward Pass Experiment")
    all_results = run_experiment()

    println()
    banner("STEP 4: Layer-by-Layer Magnitude Reports")
    for (name, mags) in all_results
        magnitude_report(name, mags)
    end

    println()
    banner("STEP 5: Training Comparison")
    training_comparison()
end

if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
