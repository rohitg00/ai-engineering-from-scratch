# Lesson: Topic Modeling: LDA and BERTopic (phase 05 / lesson 15)
# Julia port of code/main.py. Julia standard library only.
# Source: phases/05-nlp-foundations-to-advanced/15-topic-modeling/docs/en.md
# Run: julia code/main.jl

using Printf
using Random

const SHORT_ALLOWLIST = Set(["ai", "ml", "nn", "s", "p", "pr"])

function tokenize(text)
    tokens = [m.match for m in eachmatch(r"[a-z0-9]+", lowercase(text))]
    return [String(t) for t in tokens if length(t) > 2 || all(isdigit, t) || t in SHORT_ALLOWLIST]
end

function collapsed_gibbs_lda(docs, n_topics; n_iters=200, alpha=0.1, beta=0.01, seed=0)
    n_topics > 0 || error("n_topics must be a positive int, got $n_topics")
    (alpha > 0 && beta > 0) || error("alpha and beta must be positive, got alpha=$alpha, beta=$beta")
    isempty(docs) && error("docs must not be empty")

    rng = Xoshiro(seed)
    vocab = Dict{String,Int}()
    for doc in docs, w in doc
        haskey(vocab, w) || (vocab[w] = length(vocab) + 1)
    end
    V = length(vocab)
    D = length(docs)
    V == 0 && error("docs produced an empty vocabulary (no tokens found)")
    indexed = [[vocab[w] for w in doc] for doc in docs]

    z = [[rand(rng, 1:n_topics) for _ in doc] for doc in indexed]

    ndt = zeros(Int, D, n_topics)
    ntw = zeros(Int, n_topics, V)
    nt = zeros(Int, n_topics)

    for d in 1:D, (i, w) in enumerate(indexed[d])
        t = z[d][i]
        ndt[d, t] += 1
        ntw[t, w] += 1
        nt[t] += 1
    end

    probs = zeros(n_topics)
    for _ in 1:n_iters
        for d in 1:D, (i, w) in enumerate(indexed[d])
            t = z[d][i]
            ndt[d, t] -= 1
            ntw[t, w] -= 1
            nt[t] -= 1

            for k in 1:n_topics
                probs[k] = (ndt[d, k] + alpha) * (ntw[k, w] + beta) / (nt[k] + V * beta)
            end
            r = rand(rng) * sum(probs)
            acc = 0.0
            new_t = 1
            for (k, p) in enumerate(probs)
                acc += p
                if r <= acc
                    new_t = k
                    break
                end
            end

            z[d][i] = new_t
            ndt[d, new_t] += 1
            ntw[new_t, w] += 1
            nt[new_t] += 1
        end
    end

    inv_vocab = Dict(i => w for (w, i) in vocab)
    topics = [[inv_vocab[i] for i in sortperm(-ntw[k, :])[1:min(8, V)]] for k in 1:n_topics]
    doc_topic = Vector{Float64}[]
    for d in 1:D
        total = sum(ndt[d, :]) + n_topics * alpha
        push!(doc_topic, [(ndt[d, k] + alpha) / total for k in 1:n_topics])
    end
    return topics, doc_topic
end

function main()
    docs_raw = [
        "stocks rose after the fed cut interest rates",
        "bond yields fell as investors bought treasuries",
        "the s p 500 hit a new high on earnings reports",
        "chip makers reported strong demand for ai accelerators",
        "openai released a new model with multimodal reasoning",
        "deep learning researchers published a paper on efficient attention",
        "the senate passed a bill on healthcare spending",
        "the president signed new tariffs on steel imports",
        "congress debated a tax cut for small businesses",
    ]
    docs = tokenize.(docs_raw)
    topics, doc_topic = collapsed_gibbs_lda(docs, 3; n_iters=300, seed=42)

    println("=== LDA topics (collapsed Gibbs, 300 iters) ===")
    for (k, words) in enumerate(topics)
        println("  topic $(k - 1): $(join(words, ", "))")
    end
    println()
    println("=== document mixtures ===")
    for (doc_raw, mix) in zip(docs_raw, doc_topic)
        pretty = [@sprintf("%.2f", p) for p in mix]
        println("  [$(join(pretty, ", "))]  $(first(doc_raw, 50))")
    end
end

main()
