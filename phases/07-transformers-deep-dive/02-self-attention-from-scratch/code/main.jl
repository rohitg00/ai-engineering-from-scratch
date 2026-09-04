# Self-attention from scratch in Julia. Scaled dot-product attention,
# numerically-stable row-wise softmax, single-head and multi-head
# self-attention. Stdlib only. Sources:
#   https://arxiv.org/abs/1706.03762
#   https://docs.julialang.org/en/v1/stdlib/LinearAlgebra/
#   https://docs.julialang.org/en/v1/stdlib/Random/

using Random
using LinearAlgebra
using Printf


function softmax_rows(M::Matrix{Float64})::Matrix{Float64}
    out = similar(M)
    for i in 1:size(M, 1)
        row = M[i, :]
        m = maximum(row)
        e = exp.(row .- m)
        s = sum(e)
        out[i, :] = e ./ s
    end
    return out
end


function scaled_dot_product_attention(Q::Matrix{Float64}, K::Matrix{Float64},
                                      V::Matrix{Float64})
    dk = size(Q, 2)
    scores = (Q * transpose(K)) ./ sqrt(dk)
    weights = softmax_rows(scores)
    output = weights * V
    return output, weights
end


struct SelfAttention
    Wq::Matrix{Float64}
    Wk::Matrix{Float64}
    Wv::Matrix{Float64}
    dk::Int
end


function SelfAttention(d_model::Int, dk::Int, dv::Int; seed::Int=42)
    rng = MersenneTwister(seed)
    scale_qk = sqrt(2.0 / (d_model + dk))
    scale_v = sqrt(2.0 / (d_model + dv))
    Wq = scale_qk .* randn(rng, d_model, dk)
    Wk = scale_qk .* randn(rng, d_model, dk)
    Wv = scale_v .* randn(rng, d_model, dv)
    return SelfAttention(Wq, Wk, Wv, dk)
end


function forward(attn::SelfAttention, X::Matrix{Float64})
    Q = X * attn.Wq
    K = X * attn.Wk
    V = X * attn.Wv
    return scaled_dot_product_attention(Q, K, V)
end


struct MultiHeadSelfAttention
    heads::Vector{SelfAttention}
    Wo::Matrix{Float64}
    n_heads::Int
end


function MultiHeadSelfAttention(d_model::Int, n_heads::Int; seed::Int=42)
    @assert n_heads > 0 "n_heads must be > 0"
    @assert d_model > 0 "d_model must be > 0"
    @assert d_model % n_heads == 0 "d_model must be divisible by n_heads"
    dk = d_model ÷ n_heads
    dv = d_model ÷ n_heads
    heads = [SelfAttention(d_model, dk, dv; seed=seed + i) for i in 1:n_heads]
    rng = MersenneTwister(seed + n_heads + 1)
    scale = sqrt(2.0 / (d_model + d_model))
    Wo = scale .* randn(rng, n_heads * dv, d_model)
    return MultiHeadSelfAttention(heads, Wo, n_heads)
end


function forward(mha::MultiHeadSelfAttention, X::Matrix{Float64})
    head_outputs = Matrix{Float64}[]
    weights_per_head = Matrix{Float64}[]
    for head in mha.heads
        out, w = forward(head, X)
        push!(head_outputs, out)
        push!(weights_per_head, w)
    end
    concat = hcat(head_outputs...)
    return concat * mha.Wo, weights_per_head
end


function print_attention_matrix(weights::Matrix{Float64}, tokens::Vector{String})
    print("\n      ")
    for token in tokens
        @printf("%6s", token)
    end
    println()
    for i in 1:length(tokens)
        @printf("%6s", tokens[i])
        for j in 1:length(tokens)
            @printf("%6.3f", weights[i, j])
        end
        println()
    end
end


function ascii_heatmap(weights::Matrix{Float64}, tokens::Vector{String};
                       chars::String=" .:-=+*#%@")
    print("\n      ")
    for t in tokens
        @printf("%6s", t)
    end
    println()
    w_max = maximum(weights)
    for i in 1:length(tokens)
        @printf("%6s", tokens[i])
        for j in 1:length(tokens)
            level = Int(floor(weights[i, j] * (length(chars) - 1) / w_max))
            level = min(level, length(chars) - 1)
            ch = chars[level + 1]
            @printf("    %s ", ch)
        end
        println()
    end
end


function demo_softmax_stability()
    println("\n" * "=" ^ 60)
    println("SOFTMAX NUMERIC STABILITY")
    println("=" ^ 60)
    logits = reshape([2.0, 1.0, 0.1], 1, 3)
    probs = softmax_rows(logits)
    @printf("\nLogits:  [%s]\n", join([@sprintf("%.4f", v) for v in logits], ", "))
    @printf("Softmax: [%s]\n", join([@sprintf("%.4f", v) for v in probs], ", "))
    @printf("Sum:     %.4f\n", sum(probs))

    big_logits = reshape([100.0, 200.0, 300.0], 1, 3)
    big_probs = softmax_rows(big_logits)
    @printf("\nLarge logits:  [%s]\n",
            join([@sprintf("%.1f", v) for v in big_logits], ", "))
    @printf("Softmax:       [%s]\n",
            join([@sprintf("%.4f", v) for v in big_probs], ", "))
    @printf("Sum:           %.4f\n", sum(big_probs))
    println("(no overflow because we subtract the row maximum before exp)")
end


function demo_self_attention()
    println("=" ^ 60)
    println("SELF-ATTENTION FROM SCRATCH")
    println("=" ^ 60)

    tokens = ["The", "cat", "sat", "on", "the", "mat"]
    n_tokens = length(tokens)
    d_model = 16
    dk = 8
    dv = 8

    rng = MersenneTwister(42)
    X = randn(rng, n_tokens, d_model)

    @printf("\nSentence: %s\n", join(tokens, " "))
    @printf("Tokens: %d  d_model: %d  dk: %d  dv: %d\n", n_tokens, d_model, dk, dv)
    @printf("Input shape: (%d, %d)\n", size(X, 1), size(X, 2))

    attn = SelfAttention(d_model, dk, dv; seed=42)
    output, weights = forward(attn, X)
    @printf("\nOutput shape: (%d, %d)\n", size(output, 1), size(output, 2))
    println("\nAttention weights:")
    print_attention_matrix(weights, tokens)
    println("\nASCII heatmap (denser char = higher attention):")
    ascii_heatmap(weights, tokens)
    return tokens, X, d_model
end


function demo_multi_head(tokens::Vector{String}, X::Matrix{Float64}, d_model::Int)
    println("\n" * "=" ^ 60)
    println("MULTI-HEAD SELF-ATTENTION")
    println("=" ^ 60)
    n_heads = 2
    mha = MultiHeadSelfAttention(d_model, n_heads; seed=42)
    out, head_weights = forward(mha, X)
    @printf("\nHeads: %d  Output shape: (%d, %d)\n",
            n_heads, size(out, 1), size(out, 2))
    for (h, w) in enumerate(head_weights)
        @printf("\nHead %d attention weights:\n", h)
        print_attention_matrix(w, tokens)
    end
end


function main()
    tokens, X, d_model = demo_self_attention()
    demo_multi_head(tokens, X, d_model)
    demo_softmax_stability()
end


if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
