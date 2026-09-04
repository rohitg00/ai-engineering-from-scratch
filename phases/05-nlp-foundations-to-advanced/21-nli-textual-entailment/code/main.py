import re
from collections import Counter


NEGATIONS = {"not", "no", "never", "nobody", "nothing", "neither", "nor", "none", "without"}
STOP = {"a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
        "of", "in", "on", "at", "to", "for", "with", "by", "as", "and", "or", "but",
        "there", "this", "that", "these", "those", "it", "its", "i", "he", "she", "we", "they",
        "do", "does", "did", "has", "have", "had", "will", "would", "could", "should"}


def tokenize(text):
    return re.findall(r"[a-z0-9]+", text.lower())


def content_words(tokens):
    return [t for t in tokens if t not in STOP and t not in NEGATIONS]


def has_negation(tokens):
    return any(t in NEGATIONS for t in tokens)


def lexical_overlap(prem_tokens, hyp_tokens):
    p_content = content_words(prem_tokens)
    h_content = content_words(hyp_tokens)
    if not h_content:
        return 0.0
    p_set = set(p_content)
    covered = sum(1 for t in h_content if t in p_set)
    return covered / len(h_content)


def predict_nli(premise, hypothesis):
    p_tokens = tokenize(premise)
    h_tokens = tokenize(hypothesis)

    overlap = lexical_overlap(p_tokens, h_tokens)
    p_neg = has_negation(p_tokens)
    h_neg = has_negation(h_tokens)

    if overlap >= 0.5 and p_neg != h_neg:
        return "contradiction", overlap
    if overlap >= 0.5:
        return "entailment", overlap
    if overlap > 0 and p_neg != h_neg:
        return "contradiction", overlap
    return "neutral", overlap


def evaluate(examples):
    correct = 0
    confusion = Counter()
    for premise, hypothesis, gold in examples:
        pred, conf = predict_nli(premise, hypothesis)
        ok = pred == gold
        correct += int(ok)
        confusion[(gold, pred)] += 1
        tag = "  OK" if ok else "MISS"
        print(f"  [{tag}] gold={gold:<13} pred={pred:<13} conf={conf:.2f}")
        print(f"         p: {premise}")
        print(f"         h: {hypothesis}")
    return correct, len(examples), confusion


def main():
    examples = [
        ("A cat is sleeping on the couch.", "There is a cat in the room.", "entailment"),
        ("A cat is sleeping on the couch.", "There is no cat in the room.", "contradiction"),
        ("A cat is sleeping on the couch.", "The dog chased the ball.", "neutral"),
        ("John walked his dog in the park.", "John has a dog.", "entailment"),
        ("John walked his dog in the park.", "John has no dog.", "contradiction"),
        ("John walked his dog in the park.", "John lives in New York.", "neutral"),
        ("The stock market rallied today.", "Stocks went up today.", "entailment"),
        ("The stock market rallied today.", "Stocks did not move today.", "contradiction"),
        ("The chef served a tasty meal.", "The chef prepared food.", "entailment"),
        ("The chef served a tasty meal.", "The chef never cooked anything.", "contradiction"),
        ("She finished the marathon in three hours.", "She ran a marathon.", "entailment"),
        ("Birds were singing outside the window.", "The room was silent.", "neutral"),
    ]

    print("=== toy NLI classifier (lexical overlap + negation) ===")
    print()
    correct, total, confusion = evaluate(examples)
    print()
    print(f"accuracy: {correct}/{total} ({100 * correct / total:.1f}%)")
    print()
    print("confusion (gold -> pred):")
    for (gold, pred), count in sorted(confusion.items()):
        print(f"  {gold:<14} -> {pred:<14}  {count}")
    print()
    print("note: this classifier exploits two shallow features.")
    print("production NLI uses DeBERTa-v3-MNLI at ~91% on MNLI-matched.")
    print("the shape of the task — (premise, hypothesis) -> label — stays identical.")


if __name__ == "__main__":
    main()
