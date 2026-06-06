import math
import re
from collections import Counter


def sentence_split(text):
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s.strip()]


def similarity(s1, s2):
    w1 = Counter(s1.lower().split())
    w2 = Counter(s2.lower().split())
    intersection = sum((w1 & w2).values())
    denom = math.log(len(w1) + 1) + math.log(len(w2) + 1)
    if denom == 0:
        return 0.0
    return intersection / denom


def textrank(text, top_k=3, damping=0.85, iterations=50, epsilon=1e-4):
    sentences = sentence_split(text)
    n = len(sentences)
    if n <= top_k:
        return sentences

    sim = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                sim[i][j] = similarity(sentences[i], sentences[j])

    scores = [1.0] * n
    for _ in range(iterations):
        new_scores = [1 - damping] * n
        for i in range(n):
            total_out = sum(sim[i]) or 1e-9
            for j in range(n):
                if sim[i][j] > 0:
                    new_scores[j] += damping * sim[i][j] / total_out * scores[i]
        if max(abs(s - ns) for s, ns in zip(scores, new_scores)) < epsilon:
            scores = new_scores
            break
        scores = new_scores

    ranked = sorted(range(n), key=lambda k: scores[k], reverse=True)[:top_k]
    ranked.sort()
    return [sentences[i] for i in ranked]


def rouge_n(hyp, ref, n=1):
    def ngrams(tokens, k):
        return Counter(tuple(tokens[i:i + k]) for i in range(len(tokens) - k + 1))

    hyp_tokens = hyp.lower().split()
    ref_tokens = ref.lower().split()
    hyp_ngrams = ngrams(hyp_tokens, n)
    ref_ngrams = ngrams(ref_tokens, n)
    if not ref_ngrams:
        return 0.0
    overlap = sum((hyp_ngrams & ref_ngrams).values())
    total = sum(ref_ngrams.values())
    return overlap / total


def main():
    article = (
        "Researchers at a Canadian university published a paper on efficient transformers. "
        "The paper introduces a new attention variant that runs in linear time. "
        "The authors trained models up to 1 billion parameters on public data. "
        "Benchmarks show the new attention matches standard attention on most tasks. "
        "The authors released training code and weights on GitHub. "
        "Several research labs have already replicated the main results. "
        "The paper has been accepted at NeurIPS."
    )
    reference = (
        "Researchers introduced a linear-time attention variant, trained up to 1B parameters, "
        "matched standard attention on benchmarks, and released code and weights."
    )

    summary = textrank(article, top_k=3)
    joined = " ".join(summary)
    print("=== TextRank summary ===")
    for s in summary:
        print(f"  - {s}")
    print()

    print("=== ROUGE against reference ===")
    for n in [1, 2]:
        score = rouge_n(joined, reference, n=n)
        print(f"  ROUGE-{n}: {score:.3f}")
    print()
    print("For production, use the `rouge-score` package with stemming for a proper F-measure.")


if __name__ == "__main__":
    main()
