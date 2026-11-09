# Lesson: Visual Autoregressive Modeling (VAR): Next-Scale Prediction (phase 08 / lesson 19)
# Julia port of code/main.py. Julia standard library only.
# Source: phases/08-generative-ai/19-visual-autoregressive-var/docs/en.md
# Run: julia code/main.jl

using Printf
using Random
using Statistics

const IMG = 8
const SCALES = (1, 2, 4, 8)
const CODEBOOK = 16

function make_patterns(rng, n)
    out = zeros(Float32, n, IMG, IMG)
    yy = Float32[i for i in 0:IMG-1, j in 0:IMG-1]
    xx = Float32[j for i in 0:IMG-1, j in 0:IMG-1]
    for i in 1:n
        kind = rand(rng, 0:4)
        if kind == 0
            out[i, :, :] .= 0.1f0 + 0.8f0 * rand(rng, Float32)
        elseif kind == 1
            out[i, :, :] .= (xx .+ yy) ./ (2 * (IMG - 1))
        elseif kind == 2
            cx = cy = IMG / 2 - 0.5f0
            r = sqrt.((xx .- cx) .^ 2 .+ (yy .- cy) .^ 2)
            out[i, :, :] .= clamp.(1.0f0 .- r ./ (IMG / 2), 0.0f0, 1.0f0)
        elseif kind == 3
            out[i, :, :] .= Float32.((Int.(xx) .+ Int.(yy)) .% 2)
        else
            mid = IMG ÷ 2
            cross = Float32.((xx .== mid) .| (yy .== mid))
            out[i, :, :] .= cross .* 0.9f0 .+ 0.05f0
        end
    end
    return out
end

function fit_codebook(samples, k; iters=30, seed=0)
    rng = Xoshiro(seed)
    flat = vec(samples)
    length(flat) < k && error("need >= $k samples for codebook init, got $(length(flat))")
    centers = Float32.(flat[randperm(rng, length(flat))[1:k]])
    for _ in 1:iters
        assign = [argmin((v .- centers) .^ 2) for v in flat]
        for j in 1:k
            mask = assign .== j
            any(mask) && (centers[j] = mean(flat[mask]))
        end
    end
    return sort(centers)
end

encode(values, codebook) = map(v -> argmin((v .- codebook) .^ 2), values)

function downsample(img, target)
    h = size(img, 1)
    target == h && return copy(img)
    f = h ÷ target
    return [mean(img[(i-1)*f+1:i*f, (j-1)*f+1:j*f]) for i in 1:target, j in 1:target]
end

function upsample(grid, target)
    h = size(grid, 1)
    target == h && return copy(grid)
    f = target ÷ h
    return repeat(grid; inner=(f, f))
end

function tokenize_multiscale(img, codebooks)
    residual = copy(img)
    tokens = Matrix{Int}[]
    for (scale, book) in zip(SCALES, codebooks)
        tok = encode(downsample(residual, scale), book)
        residual = residual .- upsample(book[tok], IMG)
        push!(tokens, tok)
    end
    return tokens
end

function detokenize_multiscale(tokens, codebooks)
    out = zeros(Float32, IMG, IMG)
    for (tok, book) in zip(tokens, codebooks)
        out = out .+ upsample(book[tok], IMG)
    end
    return out
end

function train_codebooks(images)
    residuals = [images[i, :, :] for i in axes(images, 1)]
    books = Vector{Float32}[]
    for scale in SCALES
        pooled = [downsample(r, scale) for r in residuals]
        book = fit_codebook(reduce(vcat, vec.(pooled)), CODEBOOK)
        push!(books, book)
        residuals = [r .- upsample(book[encode(p, book)], IMG) for (r, p) in zip(residuals, pooled)]
    end
    return books
end

context_key(prev_tokens) = Tuple(trunc(Int, mean(t .- 1) * 1000) for t in prev_tokens)

function fit_predictor(token_streams)
    predictors = [Dict{Tuple,Vector{Float64}}() for _ in SCALES]
    for stream in token_streams
        for k in eachindex(SCALES)
            ctx = context_key(stream[1:k-1])
            table = get!(() -> ones(CODEBOOK), predictors[k], ctx)
            for tok in stream[k]
                table[tok] += 1.0
            end
        end
    end
    for table in predictors
        for (key, counts) in table
            table[key] = counts ./ sum(counts)
        end
    end
    return predictors
end

function sample_categorical(probs, rng)
    r = rand(rng)
    acc = 0.0
    for (i, p) in enumerate(probs)
        acc += p
        r < acc && return i
    end
    return length(probs)
end

function generate(predictors, codebooks, rng)
    drawn = Matrix{Int}[]
    for (k, scale) in enumerate(SCALES)
        ctx = context_key(drawn[1:k-1])
        probs = get(predictors[k], ctx, fill(1.0 / CODEBOOK, CODEBOOK))
        flat = [sample_categorical(probs, rng) for _ in 1:scale*scale]
        push!(drawn, permutedims(reshape(flat, scale, scale)))
    end
    return detokenize_multiscale(drawn, codebooks), drawn
end

function reconstruction_mse(images, codebooks)
    errs = Float64[]
    for i in axes(images, 1)
        img = images[i, :, :]
        recon = detokenize_multiscale(tokenize_multiscale(img, codebooks), codebooks)
        push!(errs, mean((recon .- img) .^ 2))
    end
    return mean(errs)
end

function main()
    rng = Xoshiro(0)
    train_imgs = make_patterns(rng, 64)
    val_imgs = make_patterns(rng, 16)

    codebooks = train_codebooks(train_imgs)
    train_token_streams = [tokenize_multiscale(train_imgs[i, :, :], codebooks) for i in axes(train_imgs, 1)]
    predictors = fit_predictor(train_token_streams)

    println("image size: $(IMG)x$(IMG)")
    println("scales: $SCALES")
    println("codebook size per scale: $CODEBOOK")
    @printf("reconstruction MSE on train: %.5f\n", reconstruction_mse(train_imgs, codebooks))
    @printf("reconstruction MSE on val:   %.5f\n", reconstruction_mse(val_imgs, codebooks))

    println()
    println("generation: 4 transformer passes, all positions parallel within a scale")
    for trial in 0:2
        img, toks = generate(predictors, codebooks, rng)
        shapes = join(["($(size(t, 1)), $(size(t, 2)))" for t in toks], ", ")
        @printf("  trial %d: scales=[%s]  range=[%.2f, %.2f]\n", trial, shapes, minimum(img), maximum(img))
    end

    println()
    println("scale-ordered attention check: every scale k only sees scales 1..k-1")
    for (k, scale) in enumerate(SCALES)
        n_pos = scale * scale
        prior_seen = sum((s * s for s in SCALES[1:k-1]); init=0)
        println("  scale $(k - 1) (size $(scale)x$(scale), $n_pos tokens): attends to $prior_seen prior tokens")
    end
end

main()
