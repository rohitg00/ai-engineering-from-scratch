import hashlib
import math
import re
from collections import Counter


def tokenize(text):
    return re.findall(r"[a-z0-9]+", text.lower())


def hash_token(token, dim, seed=0):
    h = hashlib.md5(f"{seed}:{token}".encode()).digest()
    return int.from_bytes(h[:4], "big") % dim


def hash_embed(text, dim=256):
    vec = [0.0] * dim
    for tok in tokenize(text):
        idx = hash_token(tok, dim)
        sign = 1.0 if hash_token(tok, 2, seed=1) == 1 else -1.0
        vec[idx] += sign
    norm = math.sqrt(sum(v * v for v in vec))
    if norm == 0:
        return vec
    return [v / norm for v in vec]


def cosine(a, b):
    if len(a) != len(b):
        raise ValueError(f"cosine: dim mismatch {len(a)} vs {len(b)}")
    return sum(x * y for x, y in zip(a, b))


def truncate_matryoshka(vec, new_dim):
    out = vec[:new_dim]
    norm = math.sqrt(sum(v * v for v in out))
    if norm == 0:
        return out
    return [v / norm for v in out]


def rank(corpus_embs, query_emb):
    scored = [(cosine(e, query_emb), i) for i, e in enumerate(corpus_embs)]
    scored.sort(reverse=True)
    return scored


def sparse_embed(text):
    return Counter(tokenize(text))


def sparse_score(q_sparse, d_sparse):
    total = 0.0
    for tok, q_weight in q_sparse.items():
        total += q_weight * d_sparse.get(tok, 0)
    return total


def rrf_fuse(rankings, k=60):
    scores = {}
    for ranking in rankings:
        for rank, (_, idx) in enumerate(ranking):
            scores[idx] = scores.get(idx, 0.0) + 1.0 / (k + rank + 1)
    return sorted(scores.items(), key=lambda x: -x[1])


def main():
    corpus = [
        "Apple released the first iPhone on June 29, 2007.",
        "Macworld 2007 featured the iPhone announcement by Steve Jobs.",
        "Android launched in 2008 as Google's mobile operating system.",
        "The first iPod was released by Apple in 2001.",
        "Fraud refers to wrongful or criminal deception for financial gain.",
        "Section 420 of the Indian Penal Code covers cheating.",
    ]

    query = "When was the first iPhone released?"

    print("=== dense (hash-trick) retrieval ===")
    dense_corpus = [hash_embed(doc, dim=256) for doc in corpus]
    dense_query = hash_embed(query, dim=256)
    dense_ranked = rank(dense_corpus, dense_query)
    for score, idx in dense_ranked[:3]:
        print(f"  {score:.3f}  {corpus[idx]}")

    print()
    print("=== Matryoshka truncation: 256 -> 64 ===")
    matryoshka_corpus = [truncate_matryoshka(v, 64) for v in dense_corpus]
    matryoshka_query = truncate_matryoshka(dense_query, 64)
    matryoshka_ranked = rank(matryoshka_corpus, matryoshka_query)
    for score, idx in matryoshka_ranked[:3]:
        print(f"  {score:.3f}  {corpus[idx]}")

    print()
    print("=== sparse (lexical) retrieval ===")
    sparse_corpus = [sparse_embed(doc) for doc in corpus]
    sparse_query = sparse_embed(query)
    sparse_scores = [(sparse_score(sparse_query, d), i) for i, d in enumerate(sparse_corpus)]
    sparse_scores.sort(reverse=True)
    for score, idx in sparse_scores[:3]:
        print(f"  {score:.3f}  {corpus[idx]}")

    print()
    print("=== RRF fusion (dense + sparse) ===")
    fused = rrf_fuse([dense_ranked[:5], sparse_scores[:5]])[:3]
    for idx, score in fused:
        print(f"  {score:.4f}  {corpus[idx]}")

    print()
    print("note: the hash-trick embedder is for demonstration.")
    print("real dense embeddings come from transformers (BGE, Nomic, Voyage).")
    print("Matryoshka truncation, cosine ranking, and RRF fusion all stay identical.")


if __name__ == "__main__":
    main()
