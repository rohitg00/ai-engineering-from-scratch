import random
import re


SHORT_ALLOWLIST = {"ai", "ml", "nn", "s", "p", "pr"}


def tokenize(text):
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    return [t for t in tokens if len(t) > 2 or t.isdigit() or t in SHORT_ALLOWLIST]


def collapsed_gibbs_lda(docs, n_topics, n_iters=200, alpha=0.1, beta=0.01, seed=0):
    if not isinstance(n_topics, int) or n_topics <= 0:
        raise ValueError(f"n_topics must be a positive int, got {n_topics!r}")
    if alpha <= 0 or beta <= 0:
        raise ValueError(f"alpha and beta must be positive, got alpha={alpha}, beta={beta}")
    if not docs:
        raise ValueError("docs must not be empty")

    rng = random.Random(seed)
    vocab = {}
    for doc in docs:
        for w in doc:
            if w not in vocab:
                vocab[w] = len(vocab)
    V = len(vocab)
    D = len(docs)
    if V == 0:
        raise ValueError("docs produced an empty vocabulary (no tokens found)")
    indexed = [[vocab[w] for w in doc] for doc in docs]

    z = [[rng.randint(0, n_topics - 1) for _ in doc] for doc in indexed]

    ndt = [[0] * n_topics for _ in range(D)]
    ntw = [[0] * V for _ in range(n_topics)]
    nt = [0] * n_topics

    for d in range(D):
        for i, w in enumerate(indexed[d]):
            t = z[d][i]
            ndt[d][t] += 1
            ntw[t][w] += 1
            nt[t] += 1

    for _ in range(n_iters):
        for d in range(D):
            for i, w in enumerate(indexed[d]):
                t = z[d][i]
                ndt[d][t] -= 1
                ntw[t][w] -= 1
                nt[t] -= 1

                probs = []
                for k in range(n_topics):
                    p = (ndt[d][k] + alpha) * (ntw[k][w] + beta) / (nt[k] + V * beta)
                    probs.append(p)
                total = sum(probs)
                r = rng.random() * total
                acc = 0.0
                new_t = 0
                for k, p in enumerate(probs):
                    acc += p
                    if r <= acc:
                        new_t = k
                        break

                z[d][i] = new_t
                ndt[d][new_t] += 1
                ntw[new_t][w] += 1
                nt[new_t] += 1

    inv_vocab = {i: w for w, i in vocab.items()}
    topics = []
    for k in range(n_topics):
        top_ids = sorted(range(V), key=lambda i: -ntw[k][i])[:8]
        topics.append([inv_vocab[i] for i in top_ids])
    doc_topic = []
    for d in range(D):
        total = sum(ndt[d]) + n_topics * alpha
        doc_topic.append([(ndt[d][k] + alpha) / total for k in range(n_topics)])

    return topics, doc_topic


def main():
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
    docs = [tokenize(d) for d in docs_raw]
    topics, doc_topic = collapsed_gibbs_lda(docs, n_topics=3, n_iters=300, seed=42)

    print("=== LDA topics (collapsed Gibbs, 300 iters) ===")
    for k, words in enumerate(topics):
        print(f"  topic {k}: {', '.join(words)}")
    print()
    print("=== document mixtures ===")
    for doc_raw, mix in zip(docs_raw, doc_topic):
        pretty = [f"{p:.2f}" for p in mix]
        print(f"  [{', '.join(pretty)}]  {doc_raw[:50]}")


if __name__ == "__main__":
    main()
