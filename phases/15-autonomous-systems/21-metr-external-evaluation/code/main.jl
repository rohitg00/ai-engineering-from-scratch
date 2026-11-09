# Lesson: METR External Evaluation (phase 15 / lesson 21)
# Julia port of code/main.py. Julia standard library only.
# Source: phases/15-autonomous-systems/21-metr-external-evaluation/docs/en.md
# Run: julia code/main.jl

using Printf
using Random

function synth_tasks(rng::AbstractRNG, true_horizon_hours::Float64; slope::Float64 = 1.2, n::Int = 120)
    log_h = log(true_horizon_hours)
    times = Float64[]
    successes = Bool[]
    for _ in 1:n
        t = exp(log(0.05) + rand(rng) * (log(48) - log(0.05)))
        logit = slope * (log_h - log(t))
        p = 1.0 / (1.0 + exp(-logit))
        push!(times, t)
        push!(successes, rand(rng) < p)
    end
    return times, successes
end

function sigmoid(x::Float64)
    x > 50 && return 1.0
    x < -50 && return 0.0
    return 1.0 / (1.0 + exp(-x))
end

function fit(times::Vector{Float64}, successes::Vector{Bool}; iters::Int = 4000, lr::Float64 = 0.05)
    logt = log.(times)
    y = Float64.(successes)
    n = length(times)
    w = 0.0
    b = 0.0
    for _ in 1:iters
        err = sigmoid.(w .* logt .+ b) .- y
        dw = sum(err .* logt)
        db = sum(err)
        w -= lr * dw / n
        b -= lr * db / n
    end
    return w, b
end

function horizon_at(w::Float64, b::Float64, p::Float64)
    logit = log(p / (1 - p))
    eps = 1e-12
    if abs(w) < eps
        throw(DomainError(w, "horizon undefined: slope w=$w is ~0 (b=$b, p=$p, logit=$logit)"))
    end
    return exp((logit - b) / w)
end

function inject_gaming(rng::AbstractRNG, successes::Vector{Bool}, gaming_rate::Float64)
    return [(!s && rand(rng) < gaming_rate) ? true : s for s in successes]
end

function report(label::String, w::Float64, b::Float64)
    h50 = horizon_at(w, b, 0.50)
    h10 = horizon_at(w, b, 0.10)
    h90 = horizon_at(w, b, 0.90)
    @printf("  %-40s  50%%=%6.2f hr  10%%=%6.2f hr  90%%=%6.2f hr\n", label, h50, h10, h90)
end

pct(rate) = string(round(Int, rate * 100), "%")

function main()
    rng = MersenneTwister(3)
    println("="^80)
    println("METR-STYLE HORIZON ESTIMATOR (Phase 15, Lesson 21)")
    println("="^80)

    true_h = 14.0
    @printf("\nSynthetic ground truth: 50%% horizon = %.1f hr\n", true_h)
    println("-"^80)

    times, successes = synth_tasks(rng, true_h; n = 160)
    w, b = fit(times, successes)
    clean_h50 = horizon_at(w, b, 0.50)
    report("clean evaluation (no gaming)", w, b)

    rates = (0.1, 0.2, 0.4)
    gamed_h50 = Dict{Float64,Float64}()
    for rate in rates
        gamed = inject_gaming(rng, successes, rate)
        w_g, b_g = fit(times, gamed)
        gamed_h50[rate] = horizon_at(w_g, b_g, 0.50)
        report("with eval-context gaming rate $(pct(rate))", w_g, b_g)
    end

    println()
    println("="^80)
    println("HEADLINE: horizons are fit to observed success; gaming shifts them")
    println("-"^80)
    @printf("  With seed=3 / n=160 / iters=4000 / true_h=%.1f hr:\n", true_h)
    @printf("    clean fit          50%% horizon ≈ %6.2f hr (ground truth %.1f)\n", clean_h50, true_h)
    for rate in rates
        h = gamed_h50[rate]
        delta = h - true_h
        @printf("    gaming rate %4s   50%% horizon ≈ %6.2f hr (%+.2f hr vs ground truth)\n", pct(rate), h, delta)
    end
    println("  Trend: gaming pushes the observed 50% horizon further from the")
    println("  synthetic ground truth as the rate climbs. Exact deltas depend on")
    println("  seed, n, iters, and the chosen true_h. A horizon number without a")
    println("  gaming audit is a capability ceiling the deploy context may not reach.")
end

main()
