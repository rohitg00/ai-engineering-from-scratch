# Positional encoding in Julia. Sinusoidal absolute positions, rotary
# positional embedding (RoPE), and ALiBi bias matrix. Verifies that
# RoPE dot products depend only on relative distance. Stdlib only. Sources:
#   https://arxiv.org/abs/2104.09864
#   https://arxiv.org/abs/2108.12409
#   https://docs.julialang.org/en/v1/manual/mathematical-operations/

using Random
using Printf


function sinusoidal_pe(n::Int, d::Int; base::Float64=10000.0)::Matrix{Float64}
    n > 0 || throw(ArgumentError("n must be > 0"))
    d > 0 || throw(ArgumentError("d must be > 0"))
    iseven(d) || throw(ArgumentError("d must be even for sinusoidal sin/cos pairs"))
    pe = zeros(n, d)
    for pos in 0:(n - 1)
        for i in 0:(d ÷ 2 - 1)
            theta = pos / (base ^ (2 * i / d))
            pe[pos + 1, 2 * i + 1] = sin(theta)
            pe[pos + 1, 2 * i + 2] = cos(theta)
        end
    end
    return pe
end


function apply_rope(x::Vector{Float64}, pos::Int; base::Float64=10000.0)::Vector{Float64}
    d = length(x)
    iseven(d) || throw(ArgumentError("RoPE requires an even embedding dimension"))
    out = copy(x)
    for i in 0:(d ÷ 2 - 1)
        theta = pos / (base ^ (2 * i / d))
        c = cos(theta)
        s = sin(theta)
        a = x[2 * i + 1]
        b = x[2 * i + 2]
        out[2 * i + 1] = a * c - b * s
        out[2 * i + 2] = a * s + b * c
    end
    return out
end


function dotprod(a::Vector{Float64}, b::Vector{Float64})::Float64
    return sum(a .* b)
end


function alibi_slopes(n_heads::Int)::Vector{Float64}
    n_heads > 0 || throw(ArgumentError("n_heads must be > 0"))
    return [2.0 ^ (-8.0 * (h) / n_heads) for h in 1:n_heads]
end


function alibi_bias(n_heads::Int, seq_len::Int; causal::Bool=true)
    slopes = alibi_slopes(n_heads)
    out = Vector{Matrix{Float64}}()
    for m in slopes
        bias = fill(0.0, seq_len, seq_len)
        for i in 1:seq_len
            for j in 1:seq_len
                if causal && j > i
                    bias[i, j] = -Inf
                else
                    bias[i, j] = -m * abs(i - j)
                end
            end
        end
        push!(out, bias)
    end
    return out
end


function demo_sinusoidal()
    println("=== sinusoidal positional encoding ===")
    pe = sinusoidal_pe(8, 8)
    println("first 4 positions, first 4 dims:")
    for pos in 1:4
        row_str = join([@sprintf("%+.3f", pe[pos, j]) for j in 1:4], "  ")
        @printf("  pos=%d: %s\n", pos - 1, row_str)
    end
    println()
end


function demo_rope_relative()
    println("=== RoPE: dot product depends only on relative distance ===")
    rng = MersenneTwister(0)
    d = 16
    q = randn(rng, d)
    k = randn(rng, d)
    pairs = [(3, 5), (7, 9), (100, 102), (1024, 1026)]
    @printf("%6s  %6s  %4s  %18s\n", "pos_q", "pos_k", "gap", "<q_rot, k_rot>")
    for (pq, pk) in pairs
        q_rot = apply_rope(q, pq)
        k_rot = apply_rope(k, pk)
        d_prod = dotprod(q_rot, k_rot)
        @printf("%6d  %6d  %4d  %18.6f\n", pq, pk, pk - pq, d_prod)
    end
    println("All rows with gap=2 should produce matching dot products.")
    println()
end


function demo_rope_base_scaling()
    println("=== RoPE base scaling (NTK-aware for long context) ===")
    rng = MersenneTwister(1)
    d = 8
    q = randn(rng, d)
    k = randn(rng, d)
    for base in (10000.0, 100000.0, 1_000_000.0)
        q_rot = apply_rope(q, 4096; base=base)
        k_rot = apply_rope(k, 4098; base=base)
        @printf("  base=%8d  score=%+.6f\n", Int(base), dotprod(q_rot, k_rot))
    end
    println("Larger base = slower rotation = longer context without phase wrap.")
    println()
end


function demo_alibi()
    println("=== ALiBi bias matrix ===")
    n_heads = 4
    slopes = alibi_slopes(n_heads)
    @printf("Slopes for %d heads: %s\n", n_heads,
            join([@sprintf("%.4f", s) for s in slopes], ", "))
    bias = alibi_bias(n_heads, 6; causal=false)
    println("Head 1 bias (closer tokens get smaller penalty):")
    for row in eachrow(bias[1])
        println("  " * join([@sprintf("%+6.2f", v) for v in row], "  "))
    end
    println()
end


function main()
    demo_sinusoidal()
    demo_rope_relative()
    demo_rope_base_scaling()
    demo_alibi()
    println("takeaway: RoPE encodes relative position inside the dot product;")
    println("ALiBi skips embeddings entirely. Sinusoidal is now a footnote.")
end


if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
