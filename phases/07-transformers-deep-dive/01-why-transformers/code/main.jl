# Why transformers in Julia. Contrasts RNN-style serial recurrence with
# attention-style parallel reduction, and verifies that Hillis-Steele
# parallel prefix scan matches the serial scan. Stdlib only. Sources:
#   https://docs.julialang.org/en/v1/manual/control-flow/
#   https://docs.julialang.org/en/v1/stdlib/Base/
#   https://en.wikipedia.org/wiki/Prefix_sum

using Printf


function rnn_style(xs::Vector{Float64}; decay::Float64=0.9)::Float64
    h = 0.0
    for x in xs
        h = decay * h + x
    end
    return h
end


function attention_style(xs::Vector{Float64})::Float64
    isempty(xs) && throw(ArgumentError("xs must be non-empty"))
    return sum(xs) / length(xs)
end


function serial_scan(xs::Vector{Float64})::Vector{Float64}
    out = similar(xs)
    acc = 0.0
    @inbounds for i in 1:length(xs)
        acc += xs[i]
        out[i] = acc
    end
    return out
end


function parallel_scan(xs::Vector{Float64})::Vector{Float64}
    out = copy(xs)
    n = length(out)
    step = 1
    while step < n
        new_out = copy(out)
        for i in (step + 1):n
            new_out[i] = out[i] + out[i - step]
        end
        out = new_out
        step *= 2
    end
    return out
end


function benchmark_pair(n::Int; reps::Int=3)
    n > 0 || throw(ArgumentError("n must be > 0"))
    xs = [0.001 * mod(i, 17) for i in 0:(n - 1)]
    best_rnn = Inf
    for _ in 1:reps
        t0 = time_ns()
        rnn_style(xs)
        best_rnn = min(best_rnn, (time_ns() - t0) / 1e9)
    end
    best_attn = Inf
    for _ in 1:reps
        t0 = time_ns()
        attention_style(xs)
        best_attn = min(best_attn, (time_ns() - t0) / 1e9)
    end
    return best_rnn, best_attn
end


function depth_counts(n::Int)
    n > 0 || throw(ArgumentError("n must be > 0"))
    rnn_depth = n
    attn_depth = max(1, Int(ceil(log2(n))))
    return rnn_depth, attn_depth
end


function demo_depth_table()
    println("=== serial-depth comparison ===")
    @printf("%8s  %12s  %12s  %16s\n", "N", "rnn depth", "attn depth", "speedup (ops)")
    for n in (64, 512, 4096, 32768, 262144)
        rd, ad = depth_counts(n)
        @printf("%8d  %12d  %12d  %15.0fx\n", n, rd, ad, rd / ad)
    end
    println()
end


function demo_wallclock()
    println("=== wall-clock on this machine (pure Julia) ===")
    @printf("%8s  %10s  %10s  %8s\n", "N", "rnn (ms)", "attn (ms)", "ratio")
    for n in (1_000, 10_000, 100_000, 1_000_000)
        rnn_t, attn_t = benchmark_pair(n)
        ratio = attn_t > 0 ? rnn_t / attn_t : Inf
        @printf("%8d  %10.2f  %10.2f  %7.1fx\n",
                n, rnn_t * 1000, attn_t * 1000, ratio)
    end
    println()
end


function demo_scan_equivalence()
    println("=== prefix-sum equivalence check ===")
    xs = Float64.(0:15)
    ser = serial_scan(xs)
    par = parallel_scan(xs)
    mismatches = sum(1 for i in 1:length(xs) if abs(ser[i] - par[i]) > 1e-9)
    @printf("length: %d  mismatches between serial and parallel scan: %d\n",
            length(xs), mismatches)
    @printf("last value (serial):   %.4f\n", ser[end])
    @printf("last value (parallel): %.4f\n", par[end])
    println()
end


function main()
    demo_depth_table()
    demo_wallclock()
    demo_scan_equivalence()
    println("takeaway: attention parallelizes the reduction; depth O(log N) on a")
    println("real GPU kernel. Memory cost is O(N^2) for full attention; that")
    println("trade-off is what later lessons unpack.")
end


if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
