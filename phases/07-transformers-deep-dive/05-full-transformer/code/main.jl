# Full transformer in Julia: encoder + decoder blocks (pre-norm), multi-head
# attention, SwiGLU FFN, LayerNorm and RMSNorm forward + backward gradient
# check against finite differences. Stdlib only. Sources:
#   https://arxiv.org/abs/1706.03762
#   https://arxiv.org/abs/1910.07467
#   https://docs.julialang.org/en/v1/stdlib/LinearAlgebra/

using Random
using LinearAlgebra
using Printf


function randn_matrix(rng::AbstractRNG, rows::Int, cols::Int;
                     scale::Union{Nothing, Float64}=nothing)::Matrix{Float64}
    s = scale === nothing ? sqrt(2.0 / (rows + cols)) : scale
    return s .* randn(rng, rows, cols)
end


function softmax_rows(M::Matrix{Float64};
                     mask::Union{Nothing, Matrix{Bool}}=nothing)::Matrix{Float64}
    out = similar(M)
    rows, cols = size(M)
    for i in 1:rows
        row = M[i, :]
        if mask !== nothing
            row = [mask[i, j] ? -Inf : row[j] for j in 1:cols]
        end
        finite = filter(isfinite, row)
        m = isempty(finite) ? 0.0 : maximum(finite)
        e = [isfinite(v) ? exp(v - m) : 0.0 for v in row]
        s = sum(e)
        out[i, :] = s > 0 ? e ./ s : zeros(cols)
    end
    return out
end


function layer_norm(X::Matrix{Float64}; eps::Float64=1e-5)::Matrix{Float64}
    out = similar(X)
    for i in 1:size(X, 1)
        row = X[i, :]
        mu = sum(row) / length(row)
        var = sum((row .- mu) .^ 2) / length(row)
        denom = sqrt(var + eps)
        out[i, :] = (row .- mu) ./ denom
    end
    return out
end


function rms_norm(X::Matrix{Float64}; eps::Float64=1e-6)::Matrix{Float64}
    out = similar(X)
    for i in 1:size(X, 1)
        row = X[i, :]
        rms = sqrt(sum(row .* row) / length(row) + eps)
        out[i, :] = row ./ rms
    end
    return out
end


function layer_norm_backward(X::Matrix{Float64}, dY::Matrix{Float64};
                            eps::Float64=1e-5)::Matrix{Float64}
    rows, d = size(X)
    dX = similar(X)
    for i in 1:rows
        x = X[i, :]
        dy = dY[i, :]
        mu = sum(x) / d
        xc = x .- mu
        var = sum(xc .* xc) / d
        denom = sqrt(var + eps)
        xhat = xc ./ denom
        dxhat = dy
        dvar = sum(dxhat .* xc) * -0.5 * (var + eps) ^ (-1.5)
        dmu = sum(dxhat .* (-1.0 ./ denom)) + dvar * sum(-2.0 .* xc) / d
        dX[i, :] = dxhat ./ denom .+ dvar .* 2.0 .* xc ./ d .+ dmu / d
    end
    return dX
end


function rms_norm_backward(X::Matrix{Float64}, dY::Matrix{Float64};
                          eps::Float64=1e-6)::Matrix{Float64}
    rows, d = size(X)
    dX = similar(X)
    for i in 1:rows
        x = X[i, :]
        dy = dY[i, :]
        ms = sum(x .* x) / d + eps
        rms = sqrt(ms)
        inv_rms = 1.0 / rms
        dot_dy_x = sum(dy .* x)
        dX[i, :] = dy .* inv_rms .- (x .* (dot_dy_x / (d * ms * rms)))
    end
    return dX
end


function silu(x::Float64)::Float64
    return x / (1.0 + exp(-x))
end


function ffn_swiglu(X::Matrix{Float64}, W1::Matrix{Float64},
                   W2::Matrix{Float64}, W3::Matrix{Float64})::Matrix{Float64}
    h1 = X * W1
    h3 = X * W3
    gated = silu.(h1) .* h3
    return gated * W2
end


function ffn_relu(X::Matrix{Float64}, W1::Matrix{Float64},
                 W2::Matrix{Float64})::Matrix{Float64}
    h = X * W1
    h = max.(h, 0.0)
    return h * W2
end


function scaled_dot_product_attention(Q::Matrix{Float64}, K::Matrix{Float64},
                                     V::Matrix{Float64}; causal::Bool=false)
    dk = size(Q, 2)
    scores = (Q * transpose(K)) ./ sqrt(dk)
    mask = nothing
    if causal
        n = size(scores, 1)
        mask = [j > i for i in 1:n, j in 1:size(scores, 2)]
    end
    weights = softmax_rows(scores; mask=mask)
    return weights * V
end


function multi_head_attention(X::Matrix{Float64},
                             Wq::Matrix{Float64}, Wk::Matrix{Float64},
                             Wv::Matrix{Float64}, Wo::Matrix{Float64};
                             n_heads::Int=1, causal::Bool=false,
                             kv_source::Union{Nothing, Matrix{Float64}}=nothing)
    @assert n_heads > 0 "n_heads must be > 0"
    Q = X * Wq
    kv_input = kv_source === nothing ? X : kv_source
    K = kv_input * Wk
    V = kv_input * Wv
    d_total = size(Q, 2)
    @assert d_total % n_heads == 0 "projected dimension must be divisible by n_heads"
    d_head = d_total ÷ n_heads
    head_outs = Matrix{Float64}[]
    for h in 1:n_heads
        cols = ((h - 1) * d_head + 1):(h * d_head)
        Qh = Q[:, cols]
        Kh = K[:, cols]
        Vh = V[:, cols]
        push!(head_outs, scaled_dot_product_attention(Qh, Kh, Vh; causal=causal))
    end
    concat = hcat(head_outs...)
    return concat * Wo
end


struct BlockParams
    d::Int
    n_heads::Int
    use_swiglu::Bool
    Wq::Matrix{Float64}
    Wk::Matrix{Float64}
    Wv::Matrix{Float64}
    Wo::Matrix{Float64}
    W1::Matrix{Float64}
    W2::Matrix{Float64}
    W3::Matrix{Float64}
    Wq_x::Matrix{Float64}
    Wk_x::Matrix{Float64}
    Wv_x::Matrix{Float64}
    Wo_x::Matrix{Float64}
end


function BlockParams(d::Int, n_heads::Int, ffn_expansion::Float64,
                    rng::AbstractRNG; use_swiglu::Bool=true)
    @assert n_heads > 0 "n_heads must be > 0"
    @assert d % n_heads == 0 "d must be divisible by n_heads"
    h = Int(round(d * ffn_expansion))
    Wq = randn_matrix(rng, d, d)
    Wk = randn_matrix(rng, d, d)
    Wv = randn_matrix(rng, d, d)
    Wo = randn_matrix(rng, d, d)
    W1 = randn_matrix(rng, d, h)
    W2 = randn_matrix(rng, h, d)
    W3 = use_swiglu ? randn_matrix(rng, d, h) : zeros(d, h)
    Wq_x = randn_matrix(rng, d, d)
    Wk_x = randn_matrix(rng, d, d)
    Wv_x = randn_matrix(rng, d, d)
    Wo_x = randn_matrix(rng, d, d)
    return BlockParams(d, n_heads, use_swiglu,
                      Wq, Wk, Wv, Wo, W1, W2, W3,
                      Wq_x, Wk_x, Wv_x, Wo_x)
end


function encoder_block(x::Matrix{Float64}, p::BlockParams)::Matrix{Float64}
    h = rms_norm(x)
    a = multi_head_attention(h, p.Wq, p.Wk, p.Wv, p.Wo; n_heads=p.n_heads)
    x = x .+ a
    h = rms_norm(x)
    f = p.use_swiglu ? ffn_swiglu(h, p.W1, p.W2, p.W3) : ffn_relu(h, p.W1, p.W2)
    return x .+ f
end


function decoder_block(x::Matrix{Float64}, enc_out::Matrix{Float64},
                      p::BlockParams)::Matrix{Float64}
    h = rms_norm(x)
    a = multi_head_attention(h, p.Wq, p.Wk, p.Wv, p.Wo;
                            n_heads=p.n_heads, causal=true)
    x = x .+ a
    h = rms_norm(x)
    a = multi_head_attention(h, p.Wq_x, p.Wk_x, p.Wv_x, p.Wo_x;
                            n_heads=p.n_heads, kv_source=enc_out)
    x = x .+ a
    h = rms_norm(x)
    f = p.use_swiglu ? ffn_swiglu(h, p.W1, p.W2, p.W3) : ffn_relu(h, p.W1, p.W2)
    return x .+ f
end


function numerical_grad(f, X::Matrix{Float64}; h::Float64=1e-5)::Matrix{Float64}
    out = similar(X)
    for i in 1:length(X)
        orig = X[i]
        X[i] = orig + h
        plus = f(X)
        X[i] = orig - h
        minus = f(X)
        X[i] = orig
        out[i] = (plus - minus) / (2h)
    end
    return out
end


function gradient_check_layer_norm()
    println("=" ^ 60)
    println("LAYER NORM: ANALYTIC vs NUMERICAL GRADIENT")
    println("=" ^ 60)
    rng = MersenneTwister(0)
    X = randn(rng, 4, 6)
    rng_v = MersenneTwister(1)
    v = randn(rng_v, 4, 6)

    loss_fn = Y -> sum(layer_norm(Y) .* v)
    analytic = layer_norm_backward(X, v)
    numeric = numerical_grad(loss_fn, copy(X))
    err = maximum(abs.(analytic .- numeric))
    @printf("\nMax abs error (LayerNorm): %.3e\n", err)
end


function gradient_check_rms_norm()
    println("\n" * "=" ^ 60)
    println("RMS NORM: ANALYTIC vs NUMERICAL GRADIENT")
    println("=" ^ 60)
    rng = MersenneTwister(2)
    X = randn(rng, 4, 6)
    rng_v = MersenneTwister(3)
    v = randn(rng_v, 4, 6)

    loss_fn = Y -> sum(rms_norm(Y) .* v)
    analytic = rms_norm_backward(X, v)
    numeric = numerical_grad(loss_fn, copy(X))
    err = maximum(abs.(analytic .- numeric))
    @printf("\nMax abs error (RMSNorm): %.3e\n", err)
end


function compare_norm_outputs()
    println("\n" * "=" ^ 60)
    println("LAYERNORM vs RMSNORM OUTPUTS")
    println("=" ^ 60)
    rng = MersenneTwister(7)
    X = randn(rng, 3, 6)
    Y_ln = layer_norm(X)
    Y_rms = rms_norm(X)
    println("\nLayerNorm row means (should be ~0):")
    for i in 1:3
        @printf("  row %d: mean=%+.6f  std=%.6f\n",
                i, sum(Y_ln[i, :]) / 6, sqrt(sum(Y_ln[i, :] .^ 2) / 6))
    end
    println("\nRMSNorm row RMS (should be ~1):")
    for i in 1:3
        @printf("  row %d: mean=%+.6f  rms=%.6f\n",
                i, sum(Y_rms[i, :]) / 6, sqrt(sum(Y_rms[i, :] .^ 2) / 6))
    end
    println("\nRMSNorm leaves the row mean intact; LayerNorm centers it.")
end


function demo_full_transformer()
    println("\n" * "=" ^ 60)
    println("FULL TRANSFORMER FORWARD PASS")
    println("=" ^ 60)
    rng = MersenneTwister(42)
    d = 8
    n_heads = 2
    ffn_exp = 2.0
    src_len = 6
    tgt_len = 5

    src = randn_matrix(rng, src_len, d; scale=0.5)
    tgt = randn_matrix(rng, tgt_len, d; scale=0.5)

    enc_params = [BlockParams(d, n_heads, ffn_exp, rng) for _ in 1:2]
    dec_params = [BlockParams(d, n_heads, ffn_exp, rng) for _ in 1:2]

    enc_out = src
    for p in enc_params
        enc_out = encoder_block(enc_out, p)
    end

    dec_out = tgt
    for p in dec_params
        dec_out = decoder_block(dec_out, enc_out, p)
    end

    @printf("\nsource shape:           (%d, %d)\n", size(src, 1), size(src, 2))
    @printf("encoder output shape:   (%d, %d)\n", size(enc_out, 1), size(enc_out, 2))
    @printf("target shape:           (%d, %d)\n", size(tgt, 1), size(tgt, 2))
    @printf("decoder output shape:   (%d, %d)\n", size(dec_out, 1), size(dec_out, 2))
    println("\nfirst 3 rows of encoder output:")
    for i in 1:3
        println("  " * join([@sprintf("%+.3f", enc_out[i, j]) for j in 1:4], "  "))
    end
    println("\nfirst 3 rows of decoder output:")
    for i in 1:3
        println("  " * join([@sprintf("%+.3f", dec_out[i, j]) for j in 1:4], "  "))
    end
    println("\nstack: 2-layer encoder + 2-layer decoder, pre-norm, RMSNorm, SwiGLU.")
end


function main()
    compare_norm_outputs()
    gradient_check_layer_norm()
    gradient_check_rms_norm()
    demo_full_transformer()
end


if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
