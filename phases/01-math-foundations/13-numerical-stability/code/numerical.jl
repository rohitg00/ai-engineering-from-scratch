# Lesson: Numerical Stability (phase 01 / lesson 13)
# Julia port of code/numerical.py. Julia standard library only.
# Source: phases/01-math-foundations/13-numerical-stability/docs/en.md
# Run: julia code/numerical.jl

using Printf
using Random

struct Overflow <: Exception end

function psum(xs)
    s = 0.0
    c = 0.0
    for x in xs
        t = s + x
        c += abs(s) >= abs(x) ? (s - t) + x : (x - t) + s
        s = t
    end
    return s + c
end

function pyexp(x)
    r = exp(x)
    isinf(r) && throw(Overflow())
    return r
end

function pyfloat(x::Real)
    x = Float64(x)
    isnan(x) && return "nan"
    isinf(x) && return x > 0 ? "inf" : "-inf"
    x == 0 && return signbit(x) ? "-0.0" : "0.0"
    s = string(abs(x))
    m, exp10 = occursin('e', s) ? (split(s, 'e')[1], parse(Int, split(s, 'e')[2])) : (s, 0)
    ip, fp = occursin('.', m) ? split(m, '.') : (m, "")
    digits = string(ip, fp)
    pointpos = length(ip) + exp10
    stripped = lstrip(digits, '0')
    pointpos -= length(digits) - length(stripped)
    digits = rstrip(stripped, '0')
    sciexp = pointpos - 1
    sign = x < 0 ? "-" : ""
    if -4 <= sciexp < 16
        pointpos <= 0 && return sign * "0." * "0"^(-pointpos) * digits
        pointpos >= length(digits) && return sign * digits * "0"^(pointpos - length(digits)) * ".0"
        return sign * digits[1:pointpos] * "." * digits[pointpos+1:end]
    end
    mant = length(digits) == 1 ? digits : digits[1:1] * "." * digits[2:end]
    return sign * mant * "e" * (sciexp < 0 ? "-" : "+") * lpad(string(abs(sciexp)), 2, '0')
end

pyval(x::Integer) = string(x)
pyval(x::AbstractFloat) = pyfloat(x)
pylist(xs) = "[" * join(pyval.(xs), ", ") * "]"
pystrs(xs) = "[" * join(["'" * s * "'" for s in xs], ", ") * "]"
pybool(b) = b ? "True" : "False"
isclose(a, b) = abs(a - b) <= max(1e-9 * max(abs(a), abs(b)), 0.0)

function softmax_naive(logits)
    exps = [pyexp(z) for z in logits]
    total = psum(exps)
    return exps ./ total
end

function softmax_stable(logits)
    m = maximum(logits)
    exps = [exp(z - m) for z in logits]
    return exps ./ psum(exps)
end

logsumexp_naive(values) = log(psum(pyexp(v) for v in values))

function logsumexp_stable(values)
    c = maximum(values)
    return c + log(psum(exp(v - c) for v in values))
end

function log_softmax_stable(logits)
    c = maximum(logits)
    lse = c + log(psum(exp(z - c) for z in logits))
    return [z - lse for z in logits]
end

function cross_entropy_naive(true_class, logits)
    p = softmax_naive(logits)[true_class+1]
    p <= 0 && throw(DomainError(p))
    return -log(p)
end

cross_entropy_stable(true_class, logits) = -log_softmax_stable(logits)[true_class+1]

sigmoid_naive(x) = 1.0 / (1.0 + pyexp(-x))

function sigmoid_stable(x)
    if x >= 0
        return 1.0 / (1.0 + exp(-x))
    end
    z = exp(x)
    return z / (1.0 + z)
end

function numerical_gradient(f, x; h=1e-5)
    grad = Float64[]
    for i in eachindex(x)
        xp = copy(x)
        xm = copy(x)
        xp[i] += h
        xm[i] -= h
        push!(grad, (f(xp) - f(xm)) / (2 * h))
    end
    return grad
end

function check_gradient(analytical, numerical; tolerance=1e-5)
    all_ok = true
    for (i, (a, n)) in enumerate(zip(analytical, numerical))
        rel_error = abs(a - n) / max(abs(a), abs(n), 1e-8)
        status = rel_error < tolerance ? "OK" : "FAIL"
        status == "FAIL" && (all_ok = false)
        @printf("  param %d: analytical=%.8f numerical=%.8f rel_error=%.2e [%s]\n", i - 1, a, n, rel_error, status)
    end
    return all_ok
end

clip_by_value(gradients, max_val) = [max(-max_val, min(max_val, g)) for g in gradients]

function clip_by_norm(gradients, max_norm)
    total_norm = sqrt(psum(g^2 for g in gradients))
    total_norm > max_norm && return gradients .* (max_norm / total_norm)
    return copy(gradients)
end

function check_tensor(name, values)
    n_nan = count(isnan, values)
    n_inf = count(isinf, values)
    if n_nan > 0 || n_inf > 0
        println("  WARNING $name: $n_nan NaN, $n_inf Inf out of $(length(values)) values")
        return false
    end
    println("  OK $name: all $(length(values)) values finite")
    return true
end

simulate_bfloat16(x) = Float64(reinterpret(Float32, reinterpret(UInt32, Float32(x)) & 0xFFFF0000))
simulate_float16(x) = Float64(Float16(x))

function kahan_sum(values)
    total = 0.0
    c = 0.0
    for v in values
        y = v - c
        t = total + y
        c = (t - total) - y
        total = t
    end
    return total
end

function welford_variance(values)
    n = 0
    mean = 0.0
    m2 = 0.0
    for x in values
        n += 1
        delta = x - mean
        mean += delta / n
        m2 += delta * (x - mean)
    end
    return n < 2 ? 0.0 : m2 / n
end

function variance_naive(values)
    n = length(values)
    return psum(v^2 for v in values) / n - (psum(values) / n)^2
end

function layer_norm(values; epsilon=1e-5, gamma=1.0, beta=0.0)
    n = length(values)
    mean = psum(values) / n
    var = psum((v - mean)^2 for v in values) / n
    s = sqrt(var + epsilon)
    return [(v - mean) / s * gamma + beta for v in values]
end

function banner(title)
    println("="^60)
    println(title)
    println("="^60)
end

function demo_float_precision()
    banner("DEMO 1: Floating Point Precision Limits")
    println("\n  0.1 + 0.2 = ", pyfloat(0.1 + 0.2))
    println("  0.1 + 0.2 == 0.3? ", pybool(0.1 + 0.2 == 0.3))
    @printf("  Difference from 0.3: %.2e\n", (0.1 + 0.2) - 0.3)
    println("  isclose(0.1 + 0.2, 0.3): ", pybool(isclose(0.1 + 0.2, 0.3)))
    @printf("\n  Float32 max: ~%.2e\n", 3.4028235e+38)
    @printf("  Float32 min positive (normal): ~%.2e\n", 1.175e-38)
    @printf("  Float32 epsilon: ~%.2e\n", 1.1920929e-07)
    println("\n  1.0 + 1e-7 == 1.0?  ", pybool(1.0 + 1e-7 == 1.0))
    println("  1.0 + 1e-8 == 1.0?  ", pybool(1.0 + 1e-8 == 1.0))
    println("  (These are Float64 in Julia. In Float32, epsilon is ~1.19e-7)")

    total_naive = 0.0
    for _ in 1:1_000_000
        total_naive += 1e-7
    end
    total_kahan = kahan_sum(fill(1e-7, 1_000_000))
    true_value = 1e-7 * 1_000_000
    println("\n  Summing 1e-7 one million times:")
    println("  True value:  ", pyfloat(true_value))
    @printf("  Naive sum:   %.10f  (error: %.2e)\n", total_naive, abs(total_naive - true_value))
    @printf("  Kahan sum:   %.10f  (error: %.2e)\n", total_kahan, abs(total_kahan - true_value))
    println()
end

function demo_catastrophic_cancellation()
    banner("DEMO 2: Catastrophic Cancellation")
    data = [1_000_000.0, 1_000_001.0, 1_000_002.0]
    true_var = 2.0 / 3.0
    var_naive = variance_naive(data)
    var_welford = welford_variance(data)
    println("\n  Data: ", pylist(data))
    @printf("  True variance: %.10f\n", true_var)
    @printf("  Naive (E[x^2] - E[x]^2): %.10f\n", var_naive)
    @printf("  Welford (online):         %.10f\n", var_welford)
    @printf("  Naive error:   %.2e\n", abs(var_naive - true_var))
    @printf("  Welford error: %.2e\n", abs(var_welford - true_var))

    a = 1.0000001
    b = 1.0000000
    true_diff = 1e-7
    computed = a - b
    println("\n  Subtracting nearly equal numbers:")
    println("  a = ", pyfloat(a))
    println("  b = ", pyfloat(b))
    println("  True a - b = ", pyfloat(true_diff))
    println("  Computed:    ", pyfloat(computed))
    @printf("  Relative error: %.1f%%\n", abs(computed - true_diff) / true_diff * 100)
    println()
end

function demo_overflow_underflow()
    banner("DEMO 3: Overflow and Underflow in exp() and log()")
    println("\n  exp() overflow boundary (Float64):")
    for x in Any[700, 709, 709.78, 710]
        try
            @printf("  exp(%s) = %.4e\n", pyval(x), pyexp(x))
        catch e
            e isa Overflow || rethrow()
            println("  exp($(pyval(x))) = OVERFLOW")
        end
    end
    println("\n  exp() underflow (results become 0.0):")
    for x in (-700, -745, -746)
        println("  exp($x) = ", pyfloat(exp(x)))
    end
    println("\n  log() edge cases:")
    for x in (1.0, 1e-300, 1e-323, 0.0)
        if x == 0.0
            println("  log(0.0) = -inf  (mathematically)")
            @printf("  log(1e-323) = %.2f  (closest we can get)\n", log(1e-323))
        else
            @printf("  log(%s) = %.4f\n", pyfloat(x), log(x))
        end
    end
    println("\n  Float16 overflow boundary:")
    for v in (65000.0, 65504.0, 65520.0, 70000.0)
        println("  float16($(pyfloat(v))) = ", pyfloat(simulate_float16(v)))
    end
    println()
end

fmt6(xs) = pystrs([@sprintf("%.6f", p) for p in xs])

function demo_softmax_stability()
    banner("DEMO 4: Naive vs Stable Softmax")
    safe = [2.0, 1.0, 0.1]
    println("\n  Safe logits: ", pylist(safe))
    nr = softmax_naive(safe)
    sr = softmax_stable(safe)
    println("  Naive:  ", fmt6(nr))
    println("  Stable: ", fmt6(sr))
    println("  Match: ", pybool(all(abs.(nr .- sr) .< 1e-10)))

    moderate = [100.0, 101.0, 102.0]
    println("\n  Moderate logits: ", pylist(moderate))
    println("  Stable: ", fmt6(softmax_stable(moderate)))
    try
        println("  Naive:  ", fmt6(softmax_naive(moderate)))
    catch e
        e isa Overflow || rethrow()
        println("  Naive:  OVERFLOW (exp(100) too large)")
    end

    extreme = [1000.0, 1001.0, 1002.0]
    println("\n  Extreme logits: ", pylist(extreme))
    println("  Stable: ", fmt6(softmax_stable(extreme)))
    println("  Naive:  would be [nan, nan, nan] or OVERFLOW")

    negative = [-1000.0, -999.0, -998.0]
    println("\n  Very negative logits: ", pylist(negative))
    println("  Stable: ", fmt6(softmax_stable(negative)))
    println("  Naive:  would be [0/0 = nan] (all exp() underflow to 0)")
    println()
end

function demo_logsumexp()
    banner("DEMO 5: Log-Sum-Exp Trick")
    safe = [1.0, 2.0, 3.0]
    println("\n  Safe values: ", pylist(safe))
    @printf("  Naive:  %.10f\n", logsumexp_naive(safe))
    @printf("  Stable: %.10f\n", logsumexp_stable(safe))

    large = [500.0, 501.0, 502.0]
    println("\n  Large values: ", pylist(large))
    @printf("  Stable: %.10f\n", logsumexp_stable(large))
    try
        println("  Naive:  ", pyfloat(logsumexp_naive(large)))
    catch e
        e isa Overflow || rethrow()
        println("  Naive:  OVERFLOW")
    end

    vneg = [-1000.0, -999.0, -998.0]
    println("\n  Very negative values: ", pylist(vneg))
    @printf("  Stable: %.10f\n", logsumexp_stable(vneg))

    equal = [5.0, 5.0, 5.0]
    println("\n  Equal values: ", pylist(equal))
    @printf("  Stable:   %.10f\n", logsumexp_stable(equal))
    @printf("  Expected: %.10f (= 5.0 + ln(3))\n", 5.0 + log(3.0))

    dom = [100.0, 1.0, 1.0]
    println("\n  One dominant value: ", pylist(dom))
    @printf("  Stable: %.10f\n", logsumexp_stable(dom))
    println("  ~100.0 (dominated by exp(100))")
    println()
end

function demo_cross_entropy()
    banner("DEMO 6: Stable Cross-Entropy Loss")
    logits = [2.0, 5.0, 1.0]
    println("\n  Logits: ", pylist(logits), ", true class: 1")
    cn = cross_entropy_naive(1, logits)
    cs = cross_entropy_stable(1, logits)
    @printf("  Naive:  %.10f\n", cn)
    @printf("  Stable: %.10f\n", cs)
    println("  Match:  ", pybool(abs(cn - cs) < 1e-10))

    large = [100.0, 105.0, 99.0]
    println("\n  Large logits: ", pylist(large), ", true class: 1")
    @printf("  Stable: %.10f\n", cross_entropy_stable(1, large))
    try
        @printf("  Naive:  %.10f\n", cross_entropy_naive(1, large))
    catch e
        (e isa Overflow || e isa DomainError) || rethrow()
        println("  Naive:  OVERFLOW or NaN")
    end

    conf = [0.0, 0.0, 50.0]
    println("\n  Very confident prediction:")
    println("  Logits: ", pylist(conf), ", true class: 2")
    @printf("  Loss: %.10f  (near zero, model is correct and confident)\n", cross_entropy_stable(2, conf))
    println("\n  Very wrong prediction:")
    println("  Logits: ", pylist(conf), ", true class: 0")
    @printf("  Loss: %.4f  (very large, model is confident but wrong)\n", cross_entropy_stable(0, conf))
    println()
end

function demo_sigmoid_stability()
    banner("DEMO 7: Stable Sigmoid")
    @printf("\n  %8s  %14s  %14s\n", "x", "naive", "stable")
    println("  ", "-"^8, "  ", "-"^14, "  ", "-"^14)
    for x in (0.0, 1.0, -1.0, 10.0, -10.0, 100.0, -100.0, 500.0, -500.0, 710.0, -710.0)
        naive_str = try
            @sprintf("%.10f", sigmoid_naive(x))
        catch e
            e isa Overflow || rethrow()
            "OVERFLOW"
        end
        @printf("  %8.1f  %14s  %.10f\n", x, naive_str, sigmoid_stable(x))
    end
    println()
end

function demo_gradient_checking()
    banner("DEMO 8: Gradient Checking")
    println("\n  Test 1: f(x,y) = x^2 + 3xy + y^3")
    f1(p) = p[1]^2 + 3 * p[1] * p[2] + p[2]^3
    f1_grad(p) = [2 * p[1] + 3 * p[2], 3 * p[1] + 3 * p[2]^2]
    point = [2.0, 1.0]
    println("  Point: ", pylist(point))
    check_gradient(f1_grad(point), numerical_gradient(f1, point))

    println("\n  Test 2: f(x) = softmax cross-entropy")
    logits = [2.0, 1.0, 0.5]
    probs = softmax_stable(logits)
    analytical = [probs[i] - (i == 1 ? 1.0 : 0.0) for i in eachindex(logits)]
    println("  Logits: ", pylist(logits))
    check_gradient(analytical, numerical_gradient(l -> cross_entropy_stable(0, l), logits))

    println("\n  Test 3: Deliberately wrong gradient (should FAIL)")
    wrong = [1.0, 1.0]
    num3 = numerical_gradient(p -> p[1]^2 + p[2]^2, [3.0, 4.0])
    println("  Wrong analytical: ", pylist(wrong))
    println("  Correct numerical: ", pystrs([@sprintf("%.4f", g) for g in num3]))
    check_gradient(wrong, num3)
    println()
end

function demo_nan_inf()
    banner("DEMO 9: NaN and Inf Detection and Propagation")
    println("\n  How inf appears:")
    println("  1.0 / 0.0    = ", pyfloat(1.0 / 0.0))
    println("  exp(710)     = overflow -> inf")
    println("  1e308 * 10   = ", pyfloat(1e308 * 10))
    println("\n  How nan appears:")
    println("  0.0 / 0.0        = ", pyfloat(0.0 / 0.0))
    println("  inf - inf        = ", pyfloat(Inf - Inf))
    println("  inf * 0          = ", pyfloat(Inf * 0))
    println("  nan + 1          = ", pyfloat(NaN + 1))
    println("  nan == nan       = ", pybool(NaN == NaN))
    println("  nan < 0          = ", pybool(NaN < 0))
    println("  nan > 0          = ", pybool(NaN > 0))
    println("\n  NaN propagation (one nan ruins everything):")
    values = [1.0, 2.0, NaN, 4.0, 5.0]
    println("  values = ", pylist(values))
    println("  sum    = ", pyfloat(psum(values)))
    println("  max    = nan (comparison with nan is always False)")
    println("  mean   = ", pyfloat(psum(values) / length(values)))
    println("\n  Tensor health checks:")
    check_tensor("weights", [0.1, -0.3, 0.5, 0.2])
    check_tensor("logits_bad", [1.0, Inf, -2.0])
    check_tensor("grads_bad", [0.01, NaN, -0.03])
    check_tensor("activations", [0.0, 0.5, 1.0, 0.3])
    println()
end

function demo_gradient_clipping()
    banner("DEMO 10: Gradient Clipping")
    grads = [10.0, 20.0, 30.0]
    println("\n  Gradients: ", pylist(grads))
    @printf("  Norm: %.4f\n", sqrt(psum(grads .^ 2)))
    cv = clip_by_value(grads, 15.0)
    cn = clip_by_norm(grads, 5.0)
    println("\n  Clip by value (max=15.0): ", pylist(cv))
    println("  Clip by value changes direction: ", pylist(grads ./ grads[1]), " vs ", pylist(cv ./ cv[1]))
    println("\n  Clip by norm (max=5.0): ", pystrs([@sprintf("%.4f", g) for g in cn]))
    @printf("  Clipped norm: %.4f\n", sqrt(psum(cn .^ 2)))
    println("  Direction preserved: ", pylist(round.(grads ./ grads[1]; digits=4)), " == ", pylist(round.(cn ./ cn[1]; digits=4)))
    println("\n  Gradient explosion simulation:")
    grad_val = 1.0
    for step in 0:7
        grad_val *= 3.5
        @printf("  Step %d: raw_grad=%12.2f  clipped=%8.4f\n", step, grad_val, clip_by_norm([grad_val], 1.0)[1])
    end
    println()
end

function demo_mixed_precision()
    banner("DEMO 11: Mixed Precision and Loss Scaling")
    println("\n  bfloat16 vs float16 precision:")
    @printf("  %12s  %12s  %12s\n", "value", "float16", "bfloat16")
    println("  ", "-"^12, "  ", "-"^12, "  ", "-"^12)
    for v in (1.0, 0.1, 3.14159, 100.0, 65504.0, 65536.0, 100000.0)
        f16 = simulate_float16(v)
        bf16 = simulate_bfloat16(v)
        @printf("  %12.4f  %12s  %12s\n", v, isinf(f16) ? "inf" : @sprintf("%.4f", f16), isinf(bf16) ? "inf" : @sprintf("%.4f", bf16))
    end

    println("\n  Loss scaling simulation:")
    rng = MersenneTwister(42)
    n = 1000
    tiny = [1e-9 + (1e-5 - 1e-9) * rand(rng) for _ in 1:n]
    scale = 1024.0
    z0 = count(g -> simulate_float16(g) == 0.0, tiny)
    z1 = count(g -> simulate_float16(g * scale) == 0.0, tiny)
    z2 = count(g -> simulate_float16(g * scale) / scale == 0.0, tiny)
    println("  $n gradients in range [1e-9, 1e-5]")
    @printf("  Zeros without scaling: %d/%d (%.1f%%)\n", z0, n, z0 / n * 100)
    @printf("  Zeros with scaling (x%.0f): %d/%d (%.1f%%)\n", scale, z1, n, z1 / n * 100)
    @printf("  Zeros after scale+convert+unscale: %d/%d (%.1f%%)\n", z2, n, z2 / n * 100)

    println("\n  Dynamic loss scaling simulation:")
    scale_factor = 65536.0
    stable_steps = 0
    @printf("  %6s  %12s  %s\n", "step", "scale", "event")
    for step in 0:499
        scaled = randn(rng) * scale_factor
        if isinf(simulate_float16(scaled))
            scale_factor /= 2
            stable_steps = 0
            (step < 20 || step % 100 == 0) && @printf("  %6d  %12.0f  overflow -> halved\n", step, scale_factor)
        else
            stable_steps += 1
            if stable_steps >= 100
                scale_factor *= 2
                stable_steps = 0
                (step < 100 || step % 100 == 0) && @printf("  %6d  %12.0f  stable -> doubled\n", step, scale_factor)
            end
        end
    end
    @printf("  Final scale factor: %.0f\n", scale_factor)
    println()
end

function demo_layer_norm()
    banner("DEMO 12: Normalization as Numerical Stabilizer")
    println("\n  Without normalization (values grow through layers):")
    values = [1.0, 0.5, -0.3, 0.8, -0.1]
    for layer in 0:9
        values = [max(0.0, v * 2.5 + 0.1) for v in values]
        if layer % 2 == 0
            @printf("  Layer %2d: max=%12.2f  values=%s...\n", layer, maximum(abs.(values)), pystrs([@sprintf("%.2f", v) for v in values[1:3]]))
        end
    end
    println("\n  With layer normalization (values stay bounded):")
    values = [1.0, 0.5, -0.3, 0.8, -0.1]
    for layer in 0:9
        values = layer_norm([max(0.0, v * 2.5 + 0.1) for v in values])
        if layer % 2 == 0
            @printf("  Layer %2d: max=%6.4f  values=%s...\n", layer, maximum(abs.(values)), pystrs([@sprintf("%.4f", v) for v in values[1:3]]))
        end
    end
    println()
end

function demo_common_bugs()
    banner("DEMO 13: Common ML Numerical Bugs")
    println("\n  Bug 1: log(0) from confident wrong prediction")
    logits = [500.0, -500.0, -500.0]
    probs = softmax_stable(logits)
    println("  Softmax: ", pystrs([@sprintf("%.2e", p) for p in probs]))
    @printf("  If true class is 1: log(%.2e) = ", probs[2])
    if probs[2] == 0.0
        println("log(0) = -inf (CRASH)")
    else
        @printf("%.2f\n", log(probs[2]))
    end
    @printf("  Stable cross-entropy handles this: %.4f\n", cross_entropy_stable(1, logits))

    println("\n  Bug 2: exp() overflow in naive softmax")
    logits = [800.0, 801.0, 802.0]
    try
        println("  Naive softmax: ", pylist(softmax_naive(logits)))
    catch e
        e isa Overflow || rethrow()
        println("  Naive softmax: OverflowError (exp(800) is too large)")
    end
    println("  Stable softmax: ", fmt6(softmax_stable(logits)))

    println("\n  Bug 3: Variance underflow with large-mean data")
    data = [1e8 + 1, 1e8 + 2, 1e8 + 3, 1e8 + 4, 1e8 + 5]
    vn = variance_naive(data)
    vw = welford_variance(data)
    @printf("  Data: [%.0f, ..., %.0f]\n", data[1], data[end])
    println("  True variance: 2.0")
    @printf("  Naive:   %.6f  (error: %.2e)\n", vn, abs(vn - 2.0))
    @printf("  Welford: %.6f  (error: %.2e)\n", vw, abs(vw - 2.0))

    println("\n  Bug 4: Float comparison in training loop")
    loss = 0.0
    for _ in 1:10
        loss += 0.1
    end
    println("  After 10 steps of loss += 0.1: loss = ", pyfloat(loss))
    println("  loss == 1.0? ", pybool(loss == 1.0), " (WRONG)")
    println("  isclose(loss, 1.0)? ", pybool(isclose(loss, 1.0)), " (CORRECT)")

    println("\n  Bug 5: NaN from 0/0 in normalization")
    values = [5.0, 5.0, 5.0, 5.0]
    mean = psum(values) / length(values)
    var = psum((v - mean)^2 for v in values) / length(values)
    println("  Constant input: ", pylist(values))
    println("  Variance: ", pyfloat(var))
    println("  1/sqrt(var) = 1/sqrt(0) = ", pyfloat(1.0 / sqrt(var)), " (Julia returns Inf instead of raising)")
    @printf("  1/sqrt(var + 1e-5) = %.2f (safe with epsilon)\n", 1.0 / sqrt(var + 1e-5))
    println()
end

function demo_format_comparison()
    banner("DEMO 14: Float Format Comparison Summary")
    print("""

  Format     Bits  Exp  Mantissa  ~Digits  Max Value       Best For
  -------    ----  ---  --------  -------  ----------      --------
  float64    64    11   52        15-16    1.8e308         CPU training, accumulation
  float32    32    8    23        7-8      3.4e38          Default training
  float16    16    5    10        3-4      65,504          Inference
  bfloat16   16    8    7         2-3      3.4e38          GPU/TPU training
  float8     8     4    3         1-2      240             Forward pass only (H100+)

""")
    println("  Precision test (representing pi):")
    p = Float64(pi)
    f16 = simulate_float16(p)
    bf16 = simulate_bfloat16(p)
    println("  float64:  ", pyfloat(p))
    @printf("  float16:  %s  (error: %.6f)\n", pyfloat(f16), abs(f16 - p))
    @printf("  bfloat16: %s  (error: %.6f)\n", pyfloat(bf16), abs(bf16 - p))
    println("\n  Range test (large values):")
    for v in (100.0, 1000.0, 10000.0, 65504.0, 100000.0)
        @printf("  %10.0f  float16=%4s  bfloat16=%4s\n", v, isinf(simulate_float16(v)) ? "INF" : "ok", isinf(simulate_bfloat16(v)) ? "INF" : "ok")
    end
    println()
end

if abspath(PROGRAM_FILE) == @__FILE__
    demo_float_precision()
    demo_catastrophic_cancellation()
    demo_overflow_underflow()
    demo_softmax_stability()
    demo_logsumexp()
    demo_cross_entropy()
    demo_sigmoid_stability()
    demo_gradient_checking()
    demo_nan_inf()
    demo_gradient_clipping()
    demo_mixed_precision()
    demo_layer_norm()
    demo_common_bugs()
    demo_format_comparison()
    println("All demos complete.")
end
