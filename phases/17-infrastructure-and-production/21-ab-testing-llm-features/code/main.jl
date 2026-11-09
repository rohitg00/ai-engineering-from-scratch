# Lesson: A/B Testing LLM Features (phase 17 / lesson 21)
# Julia port of code/main.py. Julia standard library only.
# Source: phases/17-infrastructure-and-production/21-ab-testing-llm-features/docs/en.md
# Run: julia code/main.jl

using Printf
using Random

function z_statistic(success_a::Int, n_a::Int, success_b::Int, n_b::Int)
    p_a = n_a > 0 ? success_a / n_a : 0.0
    p_b = n_b > 0 ? success_b / n_b : 0.0
    p = (n_a + n_b) > 0 ? (success_a + success_b) / (n_a + n_b) : 0.0
    se = (n_a > 0 && n_b > 0) ? sqrt(p * (1 - p) * (1 / n_a + 1 / n_b)) : 1.0
    return se > 0 ? (p_b - p_a) / se : 0.0
end

function fixed_sample_size(p_baseline::Float64, lift::Float64; alpha::Float64=0.05, power::Float64=0.80)
    p_treat = p_baseline * (1 + lift)
    z_alpha = 1.96
    z_beta = 0.84
    p_bar = (p_baseline + p_treat) / 2
    num = (z_alpha * sqrt(2 * p_bar * (1 - p_bar)) +
           z_beta * sqrt(p_baseline * (1 - p_baseline) + p_treat * (1 - p_treat)))^2
    den = (p_treat - p_baseline)^2
    return trunc(Int, num / den)
end

function simulate(p_a::Float64, p_b::Float64; seed::Int=7, max_n::Int=300_000)
    rng = Xoshiro(seed)
    success_a = success_b = 0
    n_a = n_b = 0
    sequential_stopped_at = nothing
    for _ in 1:max_n
        group = rand(rng) < 0.5
        if group
            n_b += 1
            if rand(rng) < p_b
                success_b += 1
            end
        else
            n_a += 1
            if rand(rng) < p_a
                success_a += 1
            end
        end
        if n_a > 100 && n_b > 100 && sequential_stopped_at === nothing
            z = z_statistic(success_a, n_a, success_b, n_b)
            n_total = n_a + n_b
            threshold = sqrt(2 * log(1 / 0.05) + log(n_total))
            if abs(z) > threshold
                sequential_stopped_at = n_total
                break
            end
        end
    end

    return (
        n_a=n_a,
        n_b=n_b,
        p_a_observed=n_a > 0 ? success_a / n_a : 0.0,
        p_b_observed=n_b > 0 ? success_b / n_b : 0.0,
        sequential_stop_at=sequential_stopped_at,
    )
end

function print_result(result)
    println("  final n: A=$(result.n_a), B=$(result.n_b)")
    @printf("  observed: p_a=%.3f%%, p_b=%.3f%%\n", result.p_a_observed * 100, result.p_b_observed * 100)
    stop = result.sequential_stop_at === nothing ? "None" : string(result.sequential_stop_at)
    println("  sequential stop at n=$stop")
end

function main()
    println("="^80)
    println("SEQUENTIAL A/B: fixed vs always-valid, binary outcome")
    println("="^80)

    baseline = 0.03
    for lift in (0.02, 0.05, 0.10)
        required = fixed_sample_size(baseline, lift)
        adjusted = trunc(Int, required * 1.4)
        @printf("\nBaseline %.0f%%, lift +%.0f%%:\n", baseline * 100, lift * 100)
        println("  fixed sample size (traditional, 80% power, α=0.05): $required")
        println("  LLM-adjusted (×1.4 for non-determinism): $adjusted")
    end

    println("\nSimulation: actual lift 5% (p_a=0.03, p_b=0.0315):")
    print_result(simulate(0.03, 0.0315))

    println("\nSimulation: actual lift 10% (p_a=0.03, p_b=0.033):")
    print_result(simulate(0.03, 0.033))

    println("\nSimulation: actual lift 50% (p_a=0.03, p_b=0.045), strong signal:")
    print_result(simulate(0.03, 0.045))

    println("\nRead: on strong signals the sequential bound fires early (the 50% lift")
    println("case above), and the returned n_a/n_b reflect samples *up to* the stop")
    println("point, not the full horizon. For small or zero effects the bound is")
    println("deliberately conservative: that is the Type-I guarantee.")
end

main()
