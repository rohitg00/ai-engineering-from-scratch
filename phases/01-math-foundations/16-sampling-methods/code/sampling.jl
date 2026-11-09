# Lesson: Sampling Methods (phase 01 / lesson 16)
# Julia port of code/sampling.py. Julia standard library only.
# Source: phases/01-math-foundations/16-sampling-methods/docs/en.md
# Run: julia code/sampling.jl

using Printf
using Random

const RNG = MersenneTwister(42)

urand() = rand(RNG)
uniform(a, b) = a + (b - a) * urand()
gauss(mu, sigma) = mu + sigma * randn(RNG)
pylist(xs) = "[" * join(string.(xs), ", ") * "]"
pystrs(xs) = "[" * join(["'" * s * "'" for s in xs], ", ") * "]"
fmt4(xs) = "[" * join([@sprintf("%.4f", x) for x in xs], ", ") * "]"
mean(xs) = sum(xs) / length(xs)
pstd(xs) = (m = mean(xs); sqrt(sum((x - m)^2 for x in xs) / length(xs)))

sample_uniform(a, b) = uniform(a, b)
sample_exponential_inverse_cdf(lam) = -log(urand()) / lam

function verify_inverse_cdf(lam; n=10000)
    samples = [sample_exponential_inverse_cdf(lam) for _ in 1:n]
    @printf("  Exponential(lambda=%s): empirical mean=%.4f, theoretical=%.4f\n", lam, mean(samples), 1.0 / lam)
    return samples
end

normal_pdf(x, mu, sigma) = 1.0 / (sigma * sqrt(2pi)) * exp(-0.5 * ((x - mu) / sigma)^2)

function sample_normal_box_muller(mu=0.0, sigma=1.0)
    u1, u2 = urand(), urand()
    return mu + sigma * sqrt(-2 * log(u1)) * cos(2pi * u2)
end

function rejection_sample(target_pdf, proposal_sample, proposal_pdf, M)
    attempts = 0
    while true
        x = proposal_sample()
        u = urand()
        attempts += 1
        u < target_pdf(x) / (M * proposal_pdf(x)) && return x, attempts
    end
end

function rejection_sample_batch(target_pdf, proposal_sample, proposal_pdf, M, n)
    samples = Float64[]
    total = 0
    for _ in 1:n
        x, a = rejection_sample(target_pdf, proposal_sample, proposal_pdf, M)
        push!(samples, x)
        total += a
    end
    return samples, n / total
end

function truncated_normal_demo(mu, sigma, a, b; n=5000)
    peak = min(max(mu, a), b)
    M_val = normal_pdf(peak, mu, sigma) / (1.0 / (b - a))
    target(x) = a <= x <= b ? normal_pdf(x, mu, sigma) : 0.0
    proposal() = sample_uniform(a, b)
    proposal_pdf(x) = a <= x <= b ? 1.0 / (b - a) : 0.0
    return rejection_sample_batch(target, proposal, proposal_pdf, M_val, n)
end

function importance_sampling_estimate(f, target_pdf, proposal_pdf, proposal_sample, n)
    weighted_sum = 0.0
    weight_sum = 0.0
    for _ in 1:n
        x = proposal_sample()
        w = target_pdf(x) / proposal_pdf(x)
        weighted_sum += f(x) * w
        weight_sum += w
    end
    return weighted_sum / n, weighted_sum / weight_sum
end

function importance_sampling_demo()
    mu, sigma = 2.0, 1.0
    a, b = -3.0, 7.0
    unnorm, selfnorm = importance_sampling_estimate(x -> x^2, x -> normal_pdf(x, mu, sigma), x -> a <= x <= b ? 1.0 / (b - a) : 0.0, () -> sample_uniform(a, b), 50000)
    println("  E[X^2] under N($mu,$sigma):")
    @printf("    Unnormalized IS: %.4f\n", unnorm)
    @printf("    Self-normalized IS: %.4f\n", selfnorm)
    @printf("    Theoretical: %.4f\n", mu^2 + sigma^2)
end

function monte_carlo_pi(n)
    inside = 0
    for _ in 1:n
        x = uniform(-1, 1)
        y = uniform(-1, 1)
        x * x + y * y <= 1 && (inside += 1)
    end
    return 4 * inside / n
end

monte_carlo_integral(f, a, b, n) = (b - a) * sum(f(sample_uniform(a, b)) for _ in 1:n) / n

function metropolis_hastings(target_log_pdf, x0, n_samples, burn_in; proposal_std=1.0)
    samples = Float64[]
    x = x0
    accepted = 0
    for i in 0:n_samples+burn_in-1
        x_new = x + gauss(0, proposal_std)
        if log(urand() + 1e-300) < target_log_pdf(x_new) - target_log_pdf(x)
            x = x_new
            i >= burn_in && (accepted += 1)
        end
        i >= burn_in && push!(samples, x)
    end
    return samples, accepted / n_samples
end

function metropolis_hastings_2d(target_log_pdf, x0, y0, n_samples, burn_in; proposal_std=0.5)
    samples = Tuple{Float64,Float64}[]
    x, y = x0, y0
    accepted = 0
    for i in 0:n_samples+burn_in-1
        x_new = x + gauss(0, proposal_std)
        y_new = y + gauss(0, proposal_std)
        if log(urand() + 1e-300) < target_log_pdf(x_new, y_new) - target_log_pdf(x, y)
            x, y = x_new, y_new
            i >= burn_in && (accepted += 1)
        end
        i >= burn_in && push!(samples, (x, y))
    end
    return samples, accepted / n_samples
end

bimodal_log_pdf(x) = log(0.4 * normal_pdf(x, -3, 1) + 0.6 * normal_pdf(x, 3, 1) + 1e-300)

function gibbs_sampling_2d(rho, n_samples, burn_in)
    x, y = 0.0, 0.0
    samples = Tuple{Float64,Float64}[]
    for i in 0:n_samples+burn_in-1
        x = gauss(rho * y, sqrt(1 - rho^2))
        y = gauss(rho * x, sqrt(1 - rho^2))
        i >= burn_in && push!(samples, (x, y))
    end
    return samples
end

function softmax(logits)
    m = maximum(logits)
    exps = [exp(z - m) for z in logits]
    return exps ./ sum(exps)
end

function sample_from_probs(probs)
    r = urand()
    c = 0.0
    for (i, p) in enumerate(probs)
        c += p
        r <= c && return i
    end
    return length(probs)
end

function temperature_sample(logits, temperature)
    temperature <= 0 && return argmax(logits)
    return sample_from_probs(softmax(logits ./ temperature))
end

function temperature_distribution(logits, temperature)
    if temperature <= 0
        result = zeros(length(logits))
        result[argmax(logits)] = 1.0
        return result
    end
    return softmax(logits ./ temperature)
end

function top_k_sample(logits, k)
    top = sortperm(logits; rev=true)[1:k]
    return top[sample_from_probs(softmax(logits[top]))]
end

function top_k_distribution(logits, k)
    probs = softmax(logits)
    top = sortperm(probs; rev=true)[1:k]
    result = zeros(length(logits))
    total = sum(probs[top])
    for i in top
        result[i] = probs[i] / total
    end
    return result
end

function nucleus(probs, p)
    selected = Int[]
    c = 0.0
    for i in sortperm(probs; rev=true)
        c += probs[i]
        push!(selected, i)
        c >= p && break
    end
    return selected
end

function top_p_sample(logits, p)
    probs = softmax(logits)
    selected = nucleus(probs, p)
    sel = probs[selected]
    return selected[sample_from_probs(sel ./ sum(sel))]
end

function top_p_distribution(logits, p)
    probs = softmax(logits)
    selected = nucleus(probs, p)
    result = zeros(length(logits))
    total = sum(probs[selected])
    for i in selected
        result[i] = probs[i] / total
    end
    return result
end

function reparam_sample(mu, sigma)
    epsilon = gauss(0, 1)
    return mu + sigma * epsilon, epsilon
end

reparam_gradient(epsilon) = (1.0, epsilon)

function vae_forward_demo(mu, log_var)
    sigma = exp(0.5 * log_var)
    z, epsilon = reparam_sample(mu, sigma)
    return z, epsilon, 1.0, epsilon * (0.5 * sigma)
end

function gumbel_sample()
    u = urand()
    while u == 0
        u = urand()
    end
    return -log(-log(u))
end

gumbel_max_sample(log_probs) = argmax([lp + gumbel_sample() for lp in log_probs])
gumbel_softmax_sample(log_probs, temperature) = softmax([lp + gumbel_sample() for lp in log_probs] ./ temperature)

function gumbel_softmax_straight_through(log_probs, temperature)
    soft = gumbel_softmax_sample(log_probs, temperature)
    hard = zeros(length(log_probs))
    hard[argmax(soft)] = 1.0
    return hard, soft
end

stratified_sample_1d(n) = [(i + urand()) / n for i in 0:n-1]

function compare_sampling_variance(f, n; n_trials=200)
    standard = Float64[]
    stratified = Float64[]
    for _ in 1:n_trials
        push!(standard, sum(f(x) for x in [urand() for _ in 1:n]) / n)
        push!(stratified, sum(f(x) for x in stratified_sample_1d(n)) / n)
    end
    sm, tm = mean(standard), mean(stratified)
    return sum((e - sm)^2 for e in standard) / n_trials, sum((e - tm)^2 for e in stratified) / n_trials
end

function text_generation_demo(vocab, logits, len, method; temperature=1.0, k=5, p=0.9)
    tokens = String[]
    for _ in 1:len
        idx = if method == "greedy"
            argmax(logits)
        elseif method == "temperature"
            temperature_sample(logits, temperature)
        elseif method == "top_k"
            top_k_sample(logits, k)
        elseif method == "top_p"
            top_p_sample(logits, p)
        else
            sample_from_probs(softmax(logits))
        end
        push!(tokens, vocab[idx])
    end
    return join(tokens, " ")
end

function main()
    println("="^65)
    println("SAMPLING METHODS")
    println("="^65)

    println("\n--- 1. Inverse CDF Sampling (Exponential) ---")
    for lam in (0.5, 1.0, 2.0)
        verify_inverse_cdf(lam)
    end

    println("\n--- 2. Rejection Sampling (Truncated Normal) ---")
    trunc, acc = truncated_normal_demo(0, 1, -1, 2; n=5000)
    @printf("  Truncated N(0,1) on [-1, 2]: mean=%.4f, acceptance rate=%.4f\n", mean(trunc), acc)

    println("\n--- 3. Importance Sampling ---")
    importance_sampling_demo()

    println("\n--- 4. Monte Carlo Estimation ---")
    println("  Estimating pi:")
    for n in (1000, 10000, 100000)
        est = monte_carlo_pi(n)
        @printf("    N=%7d: pi ~ %.6f, error=%.6f\n", n, est, abs(est - pi))
    end
    println("  Estimating integral of sin(x) from 0 to pi (true = 2.0):")
    for n in (1000, 10000, 100000)
        est = monte_carlo_integral(sin, 0, pi, n)
        @printf("    N=%7d: estimate=%.6f, error=%.6f\n", n, est, abs(est - 2.0))
    end

    println("\n--- 5. Metropolis-Hastings MCMC ---")
    println("  Sampling from bimodal distribution (mixture of Gaussians):")
    for s in (0.5, 1.0, 3.0)
        smp, rate = metropolis_hastings(bimodal_log_pdf, 0.0, 10000, 2000; proposal_std=s)
        @printf("    proposal_std=%s: mean=%.4f, std=%.4f, acceptance=%.4f\n", s, mean(smp), pstd(smp), rate)
    end
    println("\n  Sampling from 2D Gaussian:")
    s2d, acc2d = metropolis_hastings_2d((x, y) -> -0.5 * (x^2 + y^2), 5.0, 5.0, 10000, 2000; proposal_std=1.0)
    @printf("    mean_x=%.4f, mean_y=%.4f, acceptance=%.4f\n", mean(first.(s2d)), mean(last.(s2d)), acc2d)

    println("\n--- 6. Gibbs Sampling (Correlated 2D Gaussian) ---")
    for rho in (0.0, 0.5, 0.9)
        g = gibbs_sampling_2d(rho, 10000, 1000)
        corr = sum(a * b for (a, b) in g) / length(g) - mean(first.(g)) * mean(last.(g))
        @printf("  rho=%s: empirical correlation=%.4f\n", rho, corr)
    end

    println("\n--- 7. Temperature Sampling ---")
    token_logits = [3.0, 2.0, 1.5, 0.5, -1.0, -2.0]
    vocab = ["the", "a", "this", "one", "that", "some"]
    println("  Logits: ", pylist(token_logits))
    println("  Vocab: ", pystrs(vocab))
    for temp in (0.1, 0.5, 1.0, 1.5, 3.0)
        @printf("  T=%.1f: %s\n", temp, fmt4(temperature_distribution(token_logits, temp)))
    end
    println("\n  Generation samples at different temperatures:")
    for temp in (0.1, 0.7, 1.0, 2.0)
        out = [vocab[temperature_sample(token_logits, temp)] for _ in 1:10]
        println("    T=$temp: ", join(out, " "))
    end

    println("\n--- 8. Top-k Sampling ---")
    println("  Logits: ", pylist(token_logits))
    for k in (1, 2, 3, 6)
        println("  k=$k: ", fmt4(top_k_distribution(token_logits, k)))
    end

    println("\n--- 9. Top-p (Nucleus) Sampling ---")
    println("  Logits: ", pylist(token_logits))
    for p in (0.5, 0.8, 0.9, 0.95, 1.0)
        d = top_p_distribution(token_logits, p)
        @printf("  p=%.2f: %s (%d tokens)\n", p, fmt4(d), count(>(0), d))
    end

    println("\n--- 10. Reparameterization Trick ---")
    mu_val, log_var_val = 2.0, 0.5
    println("  VAE encoder output: mu=$mu_val, log_var=$log_var_val")
    zs = Float64[]
    for trial in 1:5
        z, e, dmu, dlv = vae_forward_demo(mu_val, log_var_val)
        push!(zs, z)
        @printf("    Trial %d: z=%.4f, eps=%.4f, dz/dmu=%.4f, dz/dlog_var=%.4f\n", trial, z, e, dmu, dlv)
    end
    @printf("  Mean of z samples: %.4f (expected ~%s)\n", mean(zs), mu_val)
    println("  Gradients exist because z = mu + sigma * epsilon is differentiable.")
    println("\n  Verifying reparameterization matches direct sampling:")
    sigma_val = exp(0.5 * log_var_val)
    direct = [sample_normal_box_muller(mu_val, sigma_val) for _ in 1:10000]
    reparam = [reparam_sample(mu_val, sigma_val)[1] for _ in 1:10000]
    @printf("    Direct:  mean=%.4f, std=%.4f\n", mean(direct), pstd(direct))
    @printf("    Reparam: mean=%.4f, std=%.4f\n", mean(reparam), pstd(reparam))

    println("\n--- 11. Gumbel-Softmax ---")
    probs = [0.5, 0.3, 0.15, 0.05]
    log_probs = log.(probs)
    labels = ["cat", "dog", "bird", "fish"]
    println("  True probs: ", pylist(probs))
    println("\n  Gumbel-Max (exact categorical) verification:")
    counts = zeros(Int, length(probs))
    for _ in 1:10000
        counts[gumbel_max_sample(log_probs)] += 1
    end
    println("    Empirical: ", fmt4(counts ./ 10000))
    println("    True:      ", fmt4(probs))
    println("\n  Gumbel-Softmax at different temperatures:")
    for tau in (0.1, 0.5, 1.0, 5.0)
        soft = gumbel_softmax_sample(log_probs, tau)
        @printf("    tau=%.1f: %s -> %s\n", tau, fmt4(soft), labels[argmax(soft)])
    end
    println("\n  Straight-through estimator:")
    hard, soft = gumbel_softmax_straight_through(log_probs, 0.5)
    println("    Hard (forward): ", pylist(hard))
    println("    Soft (backward): ", fmt4(soft))

    println("\n--- 12. Stratified Sampling ---")
    println("  Comparing standard vs stratified Monte Carlo:")
    @printf("  Function: sin(pi*x) on [0,1], true integral = 2/pi = %.6f\n", 2 / pi)
    for n in (10, 50, 100)
        sv, tv = compare_sampling_variance(x -> sin(pi * x), n)
        ratio = tv > 0 ? sv / tv : Inf
        @printf("    N=%3d: standard_var=%.8f, stratified_var=%.8f, ratio=%.2fx\n", n, sv, tv, ratio)
    end

    println("\n--- 13. Text Generation Demo ---")
    gen_vocab = ["the", "cat", "sat", "on", "mat", "a", "dog", "ran", "big", "red"]
    gen_logits = [3.0, 2.5, 2.0, 1.8, 1.5, 1.0, 0.5, 0.0, -0.5, -1.0]
    println("  Vocab: ", pystrs(gen_vocab))
    println("  Logits: ", pylist(gen_logits))
    println()
    methods = [
        ("greedy", "greedy", (;)),
        ("temperature(temperature=0.5)", "temperature", (temperature=0.5,)),
        ("temperature(temperature=1.0)", "temperature", (temperature=1.0,)),
        ("temperature(temperature=2.0)", "temperature", (temperature=2.0,)),
        ("top_k(k=3)", "top_k", (k=3,)),
        ("top_p(p=0.8)", "top_p", (p=0.8,)),
    ]
    for (label, name, params) in methods
        seqs = [text_generation_demo(gen_vocab, gen_logits, 8, name; params...) for _ in 1:3]
        println("  $label:")
        for (i, s) in enumerate(seqs)
            println("    Run $i: $s")
        end
        println("    Unique sequences: $(length(unique(seqs)))/3")
        println()
    end

    println("\n--- 14. Visualizations ---")
    println("  Plotting needs a package outside the standard library, skipping visualization.")

    println("\n", "="^65)
    println("All sampling methods complete.")
    println("="^65)
end

if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
