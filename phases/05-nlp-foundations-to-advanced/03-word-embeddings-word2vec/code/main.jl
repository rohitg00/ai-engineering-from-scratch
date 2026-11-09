# Lesson: Word Embeddings: Word2Vec from Scratch (phase 05 / lesson 03)
# Julia port of code/main.py. Julia standard library only.
# Source: phases/05-nlp-foundations-to-advanced/03-word-embeddings-word2vec/docs/en.md
# Run: julia code/main.jl

using LinearAlgebra
using Printf
using Random

const TOKEN_RE = r"[A-Za-z]+(?:'[A-Za-z]+)?"

tokenize(text) = [lowercase(m.match) for m in eachmatch(TOKEN_RE, text)]

function build_vocab(docs)
    vocab = Dict{String,Int}()
    for doc in docs, token in doc
        haskey(vocab, token) || (vocab[token] = length(vocab) + 1)
    end
    return vocab
end

function skipgram_pairs(docs; window=2)
    pairs = Tuple{String,String}[]
    for doc in docs
        for (i, center) in enumerate(doc)
            for j in max(1, i - window):min(length(doc), i + window)
                i != j && push!(pairs, (center, doc[j]))
            end
        end
    end
    return pairs
end

sigmoid(x) = 1.0 ./ (1.0 .+ exp.(-clamp.(x, -20, 20)))

function init_embeddings(vocab_size, dim, seed)
    rng = Xoshiro(seed)
    W = 0.1 .* randn(rng, dim, vocab_size)
    W_prime = 0.1 .* randn(rng, dim, vocab_size)
    return W, W_prime
end

function train_pair!(W, W_prime, c_idx, ctx_idx, neg_indices, lr)
    v_c = W[:, c_idx]
    u_pos = W_prime[:, ctx_idx]
    u_negs = W_prime[:, neg_indices]

    pos_err = sigmoid(dot(v_c, u_pos)) - 1.0
    neg_errs = sigmoid(u_negs' * v_c)

    grad_center = pos_err .* u_pos .+ u_negs * neg_errs
    W_prime[:, ctx_idx] .-= lr * pos_err .* v_c
    for (i, neg_idx) in enumerate(neg_indices)
        W_prime[:, neg_idx] .-= lr * neg_errs[i] .* v_c
    end
    W[:, c_idx] .-= lr .* grad_center
end

function train(docs; dim=16, window=2, k_neg=5, epochs=200, lr=0.05, seed=0)
    vocab = build_vocab(docs)
    vocab_size = length(vocab)
    W, W_prime = init_embeddings(vocab_size, dim, seed)
    pairs = skipgram_pairs(docs; window=window)
    rng = Xoshiro(seed)

    for _ in 1:epochs
        shuffle!(rng, pairs)
        for (center, context) in pairs
            c_idx = vocab[center]
            ctx_idx = vocab[context]
            neg_candidates = rand(rng, 1:vocab_size, k_neg * 2)
            negs = filter(n -> n != ctx_idx && n != c_idx, neg_candidates)
            negs = negs[1:min(k_neg, length(negs))]
            train_pair!(W, W_prime, c_idx, ctx_idx, negs, lr)
        end
    end
    return vocab, W
end

function nearest(vocab, W, target_vec; topk=5, exclude=Set{Int}())
    inv_vocab = Dict(i => w for (w, i) in vocab)
    norms = sqrt.(sum(W .^ 2; dims=1)) .+ 1e-9
    W_norm = W ./ norms
    target = target_vec ./ (norm(target_vec) + 1e-9)
    sims = W_norm' * target
    out = Tuple{String,Float64}[]
    for i in sortperm(-sims)
        i in exclude && continue
        push!(out, (inv_vocab[i], sims[i]))
        length(out) == topk && break
    end
    return out
end

function main()
    corpus = repeat([
        "the cat sat on the mat",
        "the dog sat on the rug",
        "a cat chased a mouse",
        "a dog chased a cat",
        "the kitten slept on the mat",
        "the puppy slept on the rug",
        "cats and dogs are pets",
        "kittens and puppies are young",
        "cats chase mice",
        "dogs chase squirrels",
    ], 20)

    docs = tokenize.(corpus)
    vocab, W = train(docs; dim=16, window=2, k_neg=5, epochs=120, lr=0.05, seed=42)

    for word in ["cat", "dog", "sat", "chased"]
        idx = vocab[word]
        top = nearest(vocab, W, W[:, idx]; topk=4, exclude=Set([idx]))
        println("nearest to $word:")
        for (w, s) in top
            @printf("  %-12s %.3f\n", w, s)
        end
        println()
    end
end

main()
