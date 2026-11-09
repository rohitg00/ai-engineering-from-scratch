# Lesson: Stochastic Processes (phase 01 / lesson 22)
# Julia port of code/stochastic.py. Julia standard library only.
# Source: phases/01-math-foundations/22-stochastic-processes/docs/en.md
# Run: julia code/stochastic.jl

using LinearAlgebra
using Printf
using Random
using Statistics

pstd(x) = std(x; corrected=false)
pvar(x) = var(x; corrected=false)

function random_walk_1d(n_steps, seed)
    rng = MersenneTwister(seed)
    steps = rand(rng, (-1, 1), n_steps)
    return vcat(0, cumsum(steps))
end

function random_walk_2d(n_steps, seed)
    rng = MersenneTwister(seed)
    directions = rand(rng, 0:3, n_steps)
    dx = [d == 0 ? 1.0 : d == 1 ? -1.0 : 0.0 for d in directions]
    dy = [d == 2 ? 1.0 : d == 3 ? -1.0 : 0.0 for d in directions]
    return vcat(0.0, cumsum(dx)), vcat(0.0, cumsum(dy))
end

struct MarkovChain
    P::Matrix{Float64}
    n_states::Int
    state_names::Vector{String}
end

MarkovChain(P::Matrix{Float64}, names) = MarkovChain(P, size(P, 1), names)

function step(mc::MarkovChain, current_state::Int, rng)
    u = rand(rng)
    acc = 0.0
    for j in 1:mc.n_states
        acc += mc.P[current_state, j]
        u < acc && return j
    end
    return mc.n_states
end

function simulate(mc::MarkovChain, start_state::Int, n_steps::Int, seed)
    rng = MersenneTwister(seed)
    states = [start_state]
    current = start_state
    for _ in 1:n_steps
        current = step(mc, current, rng)
        push!(states, current)
    end
    return states
end

function stationary_distribution(mc::MarkovChain)
    F = eigen(Matrix(mc.P'))
    idx = argmin(abs.(F.values .- 1.0))
    stationary = real.(F.vectors[:, idx])
    if sum(stationary) < 0
        stationary = -stationary
    end
    stationary = max.(stationary, 0.0)
    total = sum(stationary)
    return total > 0 ? stationary ./ total : stationary
end

function empirical_distribution(mc::MarkovChain, states)
    counts = zeros(mc.n_states)
    for s in states
        counts[s] += 1
    end
    return counts ./ length(states)
end

function langevin_dynamics(grad_U, x0, dt, temperature, n_steps, seed)
    rng = MersenneTwister(seed)
    x = Float64.(x0)
    trajectory = [copy(x)]
    for _ in 1:n_steps
        noise = randn(rng, length(x))
        x = x .- dt .* grad_U(x) .+ sqrt(2 * temperature * dt) .* noise
        push!(trajectory, copy(x))
    end
    return reduce(vcat, permutedims.(trajectory))
end

function metropolis_hastings(target_log_prob, proposal_std, x0, n_samples, seed)
    n_samples < 1 && throw(ArgumentError("n_samples must be at least 1"))
    rng = MersenneTwister(seed)
    x = Float64.(x0)
    samples = [copy(x)]
    accepted = 0
    for _ in 1:n_samples-1
        x_proposed = x .+ randn(rng, length(x)) .* proposal_std
        log_ratio = target_log_prob(x_proposed) - target_log_prob(x)
        if log(rand(rng)) < log_ratio
            x = x_proposed
            accepted += 1
        end
        push!(samples, copy(x))
    end
    return reduce(vcat, permutedims.(samples)), accepted / (n_samples - 1)
end

function diffusion_forward(signal, n_steps; beta_start=0.0001, beta_end=0.02, seed=0)
    rng = MersenneTwister(seed)
    betas = collect(range(beta_start, beta_end; length=n_steps))
    trajectory = [copy(signal)]
    x = copy(signal)
    for t in 1:n_steps
        noise = randn(rng, length(x))
        x = sqrt(1 - betas[t]) .* x .+ sqrt(betas[t]) .* noise
        push!(trajectory, copy(x))
    end
    return trajectory, betas
end

function demo_random_walks()
    println("="^60)
    println("DEMO 1: 1D Random Walks")
    println("="^60)
    n_walks, n_steps = 5, 1000
    println("\n$n_walks random walks of $n_steps steps each:\n")
    for i in 0:n_walks-1
        walk = random_walk_1d(n_steps, i)
        @printf("  Walk %d: final position = %+4d, max = %+4d, min = %+4d\n", i + 1, walk[end], maximum(walk), minimum(walk))
    end
    @printf("\nTheory: E[position] = 0, std(position) = sqrt(%d) = %.1f\n", n_steps, sqrt(n_steps))
    n_many = 10000
    finals = [random_walk_1d(n_steps, i)[end] for i in 0:n_many-1]
    @printf("\n%d walks: mean = %.2f, std = %.2f (expected %.2f)\n", n_many, mean(finals), pstd(finals), sqrt(n_steps))
end

function demo_markov_chain()
    println("\n", "="^60)
    println("DEMO 2: Weather Markov Chain")
    println("="^60)
    P = [0.7 0.1 0.2; 0.3 0.4 0.3; 0.4 0.2 0.4]
    names = ["Sunny", "Rainy", "Cloudy"]
    mc = MarkovChain(P, names)
    pi_vec = stationary_distribution(mc)
    println("\nStationary distribution (analytical):")
    for (i, name) in enumerate(names)
        @printf("  %s: %.4f\n", name, pi_vec[i])
    end
    states = simulate(mc, 1, 100000, 42)
    empirical = empirical_distribution(mc, states)
    println("\nEmpirical distribution (100000 steps, start=Sunny):")
    for (i, name) in enumerate(names)
        @printf("  %s: %.4f\n", name, empirical[i])
    end
    println("\nConvergence check:")
    for len in (100, 1000, 10000, 100000)
        emp = empirical_distribution(mc, simulate(mc, 2, len, 42))
        @printf("  %7d steps: max error = %.4f\n", len, maximum(abs.(emp .- pi_vec)))
    end
    short = simulate(mc, 1, 20, 42)
    println("\nSample trajectory: ", join([names[s] for s in short[1:15]], " -> "), "...")
end

function demo_langevin()
    println("\n", "="^60)
    println("DEMO 3: Langevin Dynamics -- Sampling from a Gaussian")
    println("="^60)
    target_mean, target_var = 3.0, 2.0
    grad_U(x) = (x .- target_mean) ./ target_var
    trajectory = langevin_dynamics(grad_U, [0.0], 0.1, 1.0, 50000, 42)
    samples = trajectory[5001:end, 1]
    println("\nTarget: mean = $target_mean, variance = $target_var")
    println("Sampled ($(length(samples)) samples after 5000 burn-in):")
    @printf("  Mean:     %.4f (expected %s)\n", mean(samples), target_mean)
    @printf("  Variance: %.4f (expected %s)\n", pvar(samples), target_var)
    @printf("  Std:      %.4f (expected %.4f)\n", pstd(samples), sqrt(target_var))
end

logaddexp(a, b) = max(a, b) + log1p(exp(-abs(a - b)))

function demo_metropolis_hastings()
    println("\n", "="^60)
    println("DEMO 4: Metropolis-Hastings -- Bimodal Distribution")
    println("="^60)
    function bimodal_log_prob(x)
        v = x[1]
        return logaddexp(-0.5 * (v - 3)^2, -0.5 * (v + 3)^2) - log(2)
    end
    samples, acc_rate = metropolis_hastings(bimodal_log_prob, 2.0, [0.0], 100000, 42)
    flat = samples[10001:end, 1]
    println("\nBimodal target: mixture of N(-3,1) and N(+3,1)")
    @printf("Acceptance rate: %.2f%%\n", 100 * acc_rate)
    @printf("Sample mean: %.4f (expected ~0.0)\n", mean(flat))
    @printf("Sample std:  %.4f\n", pstd(flat))
    left = flat[flat .< 0]
    right = flat[flat .>= 0]
    @printf("\nLeft mode (x < 0):  mean = %.4f, count = %d\n", mean(left), length(left))
    @printf("Right mode (x >= 0): mean = %.4f, count = %d\n", mean(right), length(right))
    @printf("Fraction in each mode: %.2f%% / %.2f%% (expected ~50/50)\n", 100 * length(left) / length(flat), 100 * length(right) / length(flat))
    println("\nProposal std comparison:")
    for s in (0.1, 0.5, 2.0, 5.0, 20.0)
        _, rate = metropolis_hastings(bimodal_log_prob, s, [0.0], 10000, 42)
        @printf("  std = %5.1f: acceptance rate = %.2f%%\n", s, 100 * rate)
    end
end

function demo_diffusion()
    println("\n", "="^60)
    println("DEMO 5: Forward Diffusion Process")
    println("="^60)
    n_points = 200
    t = range(0, 2pi; length=n_points)
    signal = sin.(t) .+ 0.5 .* sin.(3 .* t)
    trajectory, betas = diffusion_forward(collect(signal), 100; beta_start=0.001, beta_end=0.05, seed=42)
    println("\nOriginal signal: sin(t) + 0.5*sin(3t), $n_points points")
    @printf("Noise schedule: beta from %.4f to %.4f\n", betas[1], betas[end])
    println("\nSignal degradation over diffusion steps:")
    @printf("%6s | %8s | %8s | %10s | %12s\n", "Step", "Mean", "Std", "SNR (dB)", "Correlation")
    println("-"^55)
    for s in (0, 10, 25, 50, 75, 100)
        x = trajectory[s+1]
        noise_power = mean((x .- signal) .^ 2)
        signal_power = mean(signal .^ 2)
        snr = noise_power > 0 ? 10 * log10(signal_power / noise_power) : Inf
        snr_s = isinf(snr) ? lpad("inf", 10) : @sprintf("%10.2f", snr)
        @printf("%6d | %8.4f | %8.4f | %s | %12.4f\n", s, mean(x), pstd(x), snr_s, cor(signal, x))
    end
    println("\nAt step 0: perfect signal (correlation = 1.0)")
    println("At step 100: nearly pure noise (correlation near 0)")
    println("This is the forward process of a diffusion model.")
end

if abspath(PROGRAM_FILE) == @__FILE__
    demo_random_walks()
    demo_markov_chain()
    demo_langevin()
    demo_metropolis_hastings()
    demo_diffusion()
end
