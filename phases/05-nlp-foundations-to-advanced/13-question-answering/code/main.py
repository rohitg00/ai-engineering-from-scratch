import re
from collections import Counter


def tokenize(text):
    return re.findall(r"[a-z0-9]+", text.lower())


def normalize(text):
    text = text.lower()
    text = re.sub(r"\b(a|an|the)\b", " ", text)
    text = re.sub(r"[^\w\s]", " ", text)
    return " ".join(text.split())


def exact_match(pred, gold):
    return 1.0 if normalize(pred) == normalize(gold) else 0.0


def token_f1(pred, gold):
    p_tokens = tokenize(normalize(pred))
    g_tokens = tokenize(normalize(gold))
    if not p_tokens or not g_tokens:
        return 0.0 if (p_tokens or g_tokens) else 1.0
    common = Counter(p_tokens) & Counter(g_tokens)
    overlap = sum(common.values())
    if overlap == 0:
        return 0.0
    precision = overlap / len(p_tokens)
    recall = overlap / len(g_tokens)
    return 2 * precision * recall / (precision + recall)


def refusal_from_score(top_retrieval_score, threshold=0.3):
    return top_retrieval_score < threshold


CORPUS = [
    "Apple Inc. released the first iPhone on June 29, 2007.",
    "Macworld 2007 featured the iPhone announcement by Steve Jobs.",
    "Android launched in 2008 as Google's mobile operating system.",
    "The first iPod was released in 2001.",
]


def toy_bm25_score(query, doc):
    q_tokens = set(tokenize(query))
    d_tokens = tokenize(doc)
    d_counts = Counter(d_tokens)
    score = 0.0
    for qt in q_tokens:
        if qt in d_counts:
            score += d_counts[qt] / (1 + len(d_tokens) / 10)
    return score


def toy_retrieve(question, top_k=2):
    scored = [(toy_bm25_score(question, d), d) for d in CORPUS]
    scored.sort(reverse=True)
    return scored[:top_k]


def main():
    print("=== extractive metrics ===")
    cases = [
        ("June 29, 2007", "June 29, 2007"),
        ("June 29th, 2007", "June 29, 2007"),
        ("29 June 2007", "June 29, 2007"),
        ("2007", "June 29, 2007"),
        ("2008", "June 29, 2007"),
    ]
    for pred, gold in cases:
        em = exact_match(pred, gold)
        f1 = token_f1(pred, gold)
        print(f"  pred={pred!r:20s} gold={gold!r:20s} EM={em:.0f}  F1={f1:.2f}")
    print()
    print("note: EM punishes paraphrase. F1 is partial credit. neither captures semantics.")
    print()

    print("=== toy retrieval ===")
    q = "When was the first iPhone released?"
    results = toy_retrieve(q)
    top_score = results[0][0]
    refuse = refusal_from_score(top_score)
    print(f"  query: {q}")
    print(f"  top score: {top_score:.3f}  refuse: {refuse}")
    for s, d in results:
        print(f"    {s:.3f}  {d}")


if __name__ == "__main__":
    main()
