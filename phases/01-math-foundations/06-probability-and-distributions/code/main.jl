# Probability + distributions in Julia. Hand-written PMFs, PDFs,
# samplers (Bernoulli, Categorical, Uniform, Normal via Box-Muller),
# softmax + log-softmax + cross-entropy, marginals, central limit demo.
# Stdlib only. Sources:
#   https://docs.julialang.org/en/v1/stdlib/Random/
#   https://docs.julialang.org/en/v1/manual/missing/
#   https://en.wikipedia.org/wiki/Box-Muller_transform

using Random
using Statistics
using Printf


factorial_int(n::Int)::Int = n <= 1 ? 1 : prod(2:n)


function combinations(n::Int, k::Int)::Int
    return factorial_int(n) ÷ (factorial_int(k) * factorial_int(n - k))
end


function conditional_probability(p_a_and_b::Float64, p_b::Float64)
    if p_b == 0.0
        throw(ArgumentError("conditional_probability: P(B) is zero; cannot divide"))
    end
    return p_a_and_b / p_b
end


bernoulli_pmf(k::Int, p::Float64) = k == 1 ? p : (1 - p)


categorical_pmf(k::Int, probs::Vector{Float64}) = probs[k + 1]


function poisson_pmf(k::Int, lam::Float64)
    return (lam ^ k) * exp(-lam) / factorial_int(k)
end


function uniform_pdf(x::Float64, a::Float64, b::Float64)
    return a <= x <= b ? 1.0 / (b - a) : 0.0
end


function normal_pdf(x::Float64, mu::Float64, sigma::Float64)
    coeff = 1.0 / (sigma * sqrt(2pi))
    exponent = -0.5 * ((x - mu) / sigma) ^ 2
    return coeff * exp(exponent)
end


function expected_value(values::Vector{Float64}, probs::Vector{Float64})::Float64
    return sum(values .* probs)
end


function variance_of(values::Vector{Float64}, probs::Vector{Float64})::Float64
    mu = expected_value(values, probs)
    return sum(probs .* (values .- mu) .^ 2)
end


function sample_bernoulli(rng::AbstractRNG, p::Float64, n::Int)
    return [rand(rng) < p ? 1 : 0 for _ in 1:n]
end


function sample_categorical(rng::AbstractRNG, probs::Vector{Float64}, n::Int)
    cumulative = cumsum(probs)
    samples = Int[]
    for _ in 1:n
        r = rand(rng)
        idx = findfirst(c -> r <= c, cumulative)
        push!(samples, idx === nothing ? length(probs) - 1 : idx - 1)
    end
    return samples
end


function sample_uniform(rng::AbstractRNG, a::Float64, b::Float64, n::Int)
    return [a + (b - a) * rand(rng) for _ in 1:n]
end


function sample_normal_box_muller(rng::AbstractRNG, mu::Float64, sigma::Float64, n::Int)
    samples = Float64[]
    for _ in 1:n
        # rand(rng) is in [0, 1); guard against u1 == 0 so log(u1) stays finite.
        u1 = rand(rng)
        while u1 == 0.0
            u1 = rand(rng)
        end
        u2 = rand(rng)
        z = sqrt(-2 * log(u1)) * cos(2pi * u2)
        push!(samples, mu + sigma * z)
    end
    return samples
end


function softmax(logits::Vector{Float64})
    m = maximum(logits)
    exps = exp.(logits .- m)
    return exps ./ sum(exps)
end


function log_softmax(logits::Vector{Float64})
    m = maximum(logits)
    shifted = logits .- m
    log_sum_exp = m + log(sum(exp.(shifted)))
    return logits .- log_sum_exp
end


function cross_entropy_loss(logits::Vector{Float64}, target_index::Int)
    return -log_softmax(logits)[target_index + 1]
end


function joint_to_marginals(joint::Matrix{Float64})
    marginal_x = vec(sum(joint, dims=2))
    marginal_y = vec(sum(joint, dims=1))
    return marginal_x, marginal_y
end


function check_independence(joint::Matrix{Float64},
                            marginal_x::Vector{Float64},
                            marginal_y::Vector{Float64};
                            tol::Float64=1e-9)::Bool
    for i in eachindex(marginal_x), j in eachindex(marginal_y)
        if abs(joint[i, j] - marginal_x[i] * marginal_y[j]) > tol
            return false
        end
    end
    return true
end


function demonstrate_clt(rng::AbstractRNG, n_per_sample::Int, n_averages::Int)
    averages = Float64[]
    for _ in 1:n_averages
        samples = rand(rng, n_per_sample)
        push!(averages, mean(samples))
    end
    return averages
end


function main()
    rng = MersenneTwister(42)

    println("=" ^ 60)
    println("PROBABILITY AND DISTRIBUTIONS")
    println("=" ^ 60)

    println("\n--- Conditional Probability ---")
    p_king_given_face = conditional_probability(4 / 52, 12 / 52)
    @printf("P(King | Face card) = %.4f\n", p_king_given_face)

    println("\n--- PMF: Bernoulli (p=0.7) ---")
    for k in 0:1
        @printf("  P(X=%d) = %.4f\n", k, bernoulli_pmf(k, 0.7))
    end

    println("\n--- PMF: Categorical ---")
    cat_probs = Float64[0.1, 0.3, 0.4, 0.2]
    for k in 0:(length(cat_probs) - 1)
        @printf("  P(X=%d) = %.4f\n", k, categorical_pmf(k, cat_probs))
    end

    println("\n--- PMF: Poisson (lambda=3) ---")
    for k in 0:9
        @printf("  P(X=%d) = %.4f\n", k, poisson_pmf(k, 3.0))
    end

    println("\n--- PDF: Normal (mu=0, sigma=1) ---")
    for x in -3.0:1.0:3.0
        @printf("  f(%+.0f) = %.4f\n", x, normal_pdf(x, 0.0, 1.0))
    end

    println("\n--- Expected Value & Variance ---")
    die_values = Float64[1, 2, 3, 4, 5, 6]
    die_probs = fill(1 / 6, 6)
    mu = expected_value(die_values, die_probs)
    var = variance_of(die_values, die_probs)
    @printf("  Fair die: E[X] = %.4f, Var(X) = %.4f, SD = %.4f\n", mu, var, sqrt(var))

    println("\n--- Sampling: Bernoulli (p=0.3, n=20) ---")
    bern = sample_bernoulli(rng, 0.3, 20)
    println("  Samples: $bern")
    @printf("  Empirical mean: %.4f (expected 0.3)\n", mean(bern))

    println("\n--- Sampling: Categorical ---")
    cat_samples = sample_categorical(rng, Float64[0.1, 0.3, 0.4, 0.2], 1000)
    counts = [count(==(i), cat_samples) for i in 0:3]
    println("  Counts from 1000 samples: $counts")
    println("  Empirical: $(round.(counts ./ 1000, digits=4))")
    println("  Expected:  [0.1, 0.3, 0.4, 0.2]")

    println("\n--- Sampling: Normal (Box-Muller) ---")
    norm = sample_normal_box_muller(rng, 0.0, 1.0, 10000)
    sample_mean = mean(norm)
    sample_var = var_of_samples(norm)
    println("  10000 samples from N(0, 1):")
    @printf("  Sample mean: %.4f (expected 0)\n", sample_mean)
    @printf("  Sample var:  %.4f (expected 1)\n", sample_var)

    println("\n--- Softmax ---")
    logits = Float64[2.0, 1.0, 0.1]
    probs = softmax(logits)
    println("  Logits:  $logits")
    println("  Softmax: $(round.(probs, digits=4))")
    @printf("  Sum:     %.4f\n", sum(probs))

    println("\n--- Softmax with large logits (stability test) ---")
    large_logits = Float64[100, 101, 102]
    probs_large = softmax(large_logits)
    println("  Logits:  $large_logits")
    println("  Softmax: $(round.(probs_large, digits=4))")
    println("  (No overflow because we subtract max before exp)")

    println("\n--- Log Probabilities ---")
    lp = log_softmax(logits)
    println("  Logits:      $logits")
    println("  Log-softmax: $(round.(lp, digits=4))")
    println("  Verify exp:  $(round.(exp.(lp), digits=4))")

    println("\n--- Cross-Entropy Loss ---")
    ce = cross_entropy_loss(Float64[2.0, 1.0, 0.1], 0)
    println("  Logits: [2.0, 1.0, 0.1], target: 0")
    @printf("  Cross-entropy loss: %.4f\n", ce)

    println("\n--- Why log probabilities matter ---")
    word_prob = 0.01
    n_words = 50
    raw_product = word_prob ^ n_words
    log_sum = n_words * log(word_prob)
    @printf("  P(word)^%d = %.2e\n", n_words, raw_product)
    @printf("  Log sum: %.4f (stable)\n", log_sum)
    @printf("  Recovered: %.2e\n", exp(log_sum))

    println("\n--- Joint & Marginal Distributions ---")
    joint = Float64[0.40 0.10; 0.05 0.45]
    mx, my = joint_to_marginals(joint)
    println("  Joint (weather x umbrella):")
    @printf("    Sun, no umbrella: %.2f\n", joint[1, 1])
    @printf("    Sun, umbrella:    %.2f\n", joint[1, 2])
    @printf("    Rain, no umbrella: %.2f\n", joint[2, 1])
    @printf("    Rain, umbrella:    %.2f\n", joint[2, 2])
    println("  Marginal X (weather):  $mx")
    println("  Marginal Y (umbrella): $my")
    println("  Independent? $(check_independence(joint, mx, my))")

    println("\n--- Central Limit Theorem ---")
    println("  Averaging uniform [0, 1) samples:")
    for n in [1, 2, 5, 30]
        avgs = demonstrate_clt(rng, n, 10000)
        @printf("    n=%2d: mean=%.4f, std=%.4f\n", n, mean(avgs), std_of_samples(avgs))
    end
    println("  As n grows, std shrinks and distribution approaches normal.")

    println("\n" * "=" ^ 60)
    println("All probability computations complete.")
    println("=" ^ 60)
end


function var_of_samples(xs::Vector{Float64})::Float64
    m = mean(xs)
    return sum((xs .- m) .^ 2) / length(xs)
end


function std_of_samples(xs::Vector{Float64})::Float64
    return sqrt(var_of_samples(xs))
end


if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
