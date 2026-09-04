import re
from collections import Counter


STOP = {"a", "an", "the", "is", "are", "was", "were", "of", "in", "on", "at",
        "to", "for", "with", "and", "or", "but", "this", "that", "by", "as"}


def tokenize(text):
    return [t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in STOP]


def split_sentences(text):
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]


def faithfulness(answer, context):
    context_set = set(tokenize(context))
    claims = split_sentences(answer)
    if not claims:
        return 0.0
    supported = 0
    for claim in claims:
        claim_tokens = tokenize(claim)
        if not claim_tokens:
            continue
        overlap = sum(1 for t in claim_tokens if t in context_set)
        if overlap / len(claim_tokens) >= 0.5:
            supported += 1
    return supported / len(claims)


def answer_relevance(question, answer):
    q_tokens = set(tokenize(question))
    a_tokens = set(tokenize(answer))
    if not q_tokens or not a_tokens:
        return 0.0
    return len(q_tokens & a_tokens) / len(q_tokens | a_tokens)


def context_precision(retrieved_chunks, relevant_chunks):
    if not retrieved_chunks:
        return 0.0
    hits = sum(1 for c in retrieved_chunks if c in relevant_chunks)
    return hits / len(retrieved_chunks)


def context_recall(retrieved_chunks, gold_answer_tokens):
    retrieved_text = " ".join(retrieved_chunks)
    retrieved_set = set(tokenize(retrieved_text))
    if not gold_answer_tokens:
        return 0.0
    covered = sum(1 for t in gold_answer_tokens if t in retrieved_set)
    return covered / len(gold_answer_tokens)


def g_eval_correctness(actual, expected, threshold=0.5):
    a_claims = split_sentences(actual)
    e_set = set(tokenize(expected))
    if not a_claims:
        return 0.0
    supported = 0
    for c in a_claims:
        c_tokens = tokenize(c)
        if not c_tokens:
            continue
        overlap = sum(1 for t in c_tokens if t in e_set) / len(c_tokens)
        if overlap >= threshold:
            supported += 1
    return supported / len(a_claims)


def main():
    cases = [
        {
            "question": "When was the first iPhone released?",
            "context": [
                "Apple released the first iPhone on June 29, 2007.",
                "Steve Jobs announced the iPhone at Macworld in January 2007.",
            ],
            "answer": "The first iPhone was released on June 29, 2007.",
            "expected": "June 29, 2007",
            "gold_relevant": ["Apple released the first iPhone on June 29, 2007."],
        },
        {
            "question": "When was the first iPhone released?",
            "context": [
                "Apple released the first iPhone on June 29, 2007.",
                "The moon landing was in 1969.",
            ],
            "answer": "The first iPhone launched on June 29, 2006, shortly after the moon landing.",
            "expected": "June 29, 2007",
            "gold_relevant": ["Apple released the first iPhone on June 29, 2007."],
        },
        {
            "question": "When was the first iPhone released?",
            "context": [
                "Apple released the first iPhone on June 29, 2007.",
                "Android launched in 2008.",
            ],
            "answer": "Apple is a technology company based in Cupertino.",
            "expected": "June 29, 2007",
            "gold_relevant": ["Apple released the first iPhone on June 29, 2007."],
        },
    ]

    print("=== toy RAG eval: faithfulness / relevance / context precision & recall / G-Eval ===")
    print()
    for i, case in enumerate(cases):
        ctx_joined = " ".join(case["context"])
        f = faithfulness(case["answer"], ctx_joined)
        r = answer_relevance(case["question"], case["answer"])
        cp = context_precision(case["context"], case["gold_relevant"])
        cr = context_recall(case["context"], tokenize(case["expected"]))
        ge = g_eval_correctness(case["answer"], case["expected"])
        print(f"case {i}: {case['question']}")
        print(f"  answer:   {case['answer']}")
        print(f"  expected: {case['expected']}")
        print(f"  faithfulness        = {f:.2f}")
        print(f"  answer-relevance    = {r:.2f}")
        print(f"  context-precision   = {cp:.2f}")
        print(f"  context-recall      = {cr:.2f}")
        print(f"  g-eval correctness  = {ge:.2f}")
        print()

    print("interpretation:")
    print("  case 0 = faithful + correct      -> all metrics high")
    print("  case 1 = hallucinated date        -> g-eval drops, faithfulness partial")
    print("  case 2 = off-topic answer         -> relevance + g-eval collapse")
    print()
    print("note: toy uses lexical overlap. production uses NLI + LLM-as-judge.")
    print("shape of the eval loop is identical.")


if __name__ == "__main__":
    main()
