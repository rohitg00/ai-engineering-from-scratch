import math
import re
from collections import Counter


def tokenize(text):
    return re.findall(r"[a-z0-9]+", text.lower())


class BM25:
    def __init__(self, corpus, k1=1.5, b=0.75):
        if not corpus:
            raise ValueError("BM25 corpus must not be empty")
        self.corpus = [tokenize(d) for d in corpus]
        self.k1 = k1
        self.b = b
        self.n_docs = len(self.corpus)
        self.avg_dl = sum(len(d) for d in self.corpus) / self.n_docs
        self.df = Counter()
        for doc in self.corpus:
            for term in set(doc):
                self.df[term] += 1

    def idf(self, term):
        n = self.df.get(term, 0)
        return math.log(1 + (self.n_docs - n + 0.5) / (n + 0.5))

    def score(self, query, doc_idx):
        q_tokens = tokenize(query)
        doc = self.corpus[doc_idx]
        dl = len(doc)
        freq = Counter(doc)
        total = 0.0
        for term in q_tokens:
            f = freq.get(term, 0)
            if f == 0:
                continue
            num = f * (self.k1 + 1)
            den = f + self.k1 * (1 - self.b + self.b * dl / self.avg_dl)
            total += self.idf(term) * num / den
        return total

    def rank(self, query, top_k=10):
        scored = [(self.score(query, i), i) for i in range(self.n_docs)]
        scored.sort(reverse=True)
        return scored[:top_k]


def reciprocal_rank_fusion(rankings, k=60):
    scores = {}
    for ranking in rankings:
        for rank, (_, doc_idx) in enumerate(ranking):
            scores[doc_idx] = scores.get(doc_idx, 0.0) + 1.0 / (k + rank + 1)
    fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [(score, doc_idx) for doc_idx, score in fused]


def fake_dense_rank(query, corpus, top_k=5):
    q_tokens = set(tokenize(query))
    scored = []
    for i, d in enumerate(corpus):
        d_tokens = set(tokenize(d))
        if not d_tokens or not q_tokens:
            scored.append((0.0, i))
            continue
        jaccard = len(q_tokens & d_tokens) / len(q_tokens | d_tokens)
        expansion = 0.0
        for qt in q_tokens:
            for dt in d_tokens:
                if qt != dt and min(len(qt), len(dt)) >= 4 and (qt in dt or dt in qt):
                    expansion += 0.15
        scored.append((jaccard + expansion, i))
    scored.sort(reverse=True)
    return scored[:top_k]


def main():
    corpus = [
        "Apple Inc. released the first iPhone on June 29, 2007.",
        "Macworld 2007 featured the iPhone announcement by Steve Jobs.",
        "Android launched in 2008 as Google's mobile smartphone operating system.",
        "The first iPod was released by Apple in 2001.",
        "Section 420 of the Indian Penal Code covers cheating and dishonest inducement.",
        "Fraud refers to wrongful or criminal deception intended to result in financial gain.",
        "Cheating someone to obtain money is a criminal offence in most jurisdictions.",
    ]

    bm25 = BM25(corpus)

    query = "what happens if someone lies to get money"
    print(f"query: {query}\n")

    sparse = bm25.rank(query, top_k=5)
    print("BM25 (sparse):")
    for score, idx in sparse:
        print(f"  {score:.3f}  {corpus[idx]}")
    print()

    dense = fake_dense_rank(query, corpus, top_k=5)
    print("fake-dense (shape demonstration):")
    for score, idx in dense:
        print(f"  {score:.3f}  {corpus[idx]}")
    print()

    fused = reciprocal_rank_fusion([sparse, dense])[:5]
    print("RRF fused:")
    for score, idx in fused:
        print(f"  {score:.4f}  {corpus[idx]}")

    print()
    print("note: this code uses a toy 'fake-dense' ranker for teaching.")
    print("real dense retrieval needs a sentence-transformer encoder; see docs/en.md.")


if __name__ == "__main__":
    main()
