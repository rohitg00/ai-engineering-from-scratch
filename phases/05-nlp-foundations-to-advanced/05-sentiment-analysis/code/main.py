import math
import re
from collections import Counter


TOKEN_RE = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?|[.!?,;]")

NEGATION_WORDS = {"not", "no", "never", "nor", "none", "nothing", "neither", "n't"}
NEGATION_TERMINATORS = {".", "!", "?", ",", ";"}


def tokenize(text):
    return [t.lower() for t in TOKEN_RE.findall(text)]


def apply_negation(tokens):
    out = []
    negate = False
    for token in tokens:
        if token in NEGATION_TERMINATORS:
            negate = False
            out.append(token)
            continue
        if token in NEGATION_WORDS:
            negate = True
            out.append(token)
            continue
        out.append(f"NOT_{token}" if negate else token)
    return out


def build_vocab(docs):
    vocab = set()
    for doc in docs:
        for t in doc:
            vocab.add(t)
    return vocab


def train_nb(docs_by_class, vocab, alpha=1.0):
    class_priors = {}
    class_word_probs = {}
    total_docs = sum(len(d) for d in docs_by_class.values())
    for cls, docs in docs_by_class.items():
        class_priors[cls] = len(docs) / total_docs
        counts = Counter()
        for doc in docs:
            for token in doc:
                counts[token] += 1
        total = sum(counts.values()) + alpha * len(vocab)
        class_word_probs[cls] = {w: (counts[w] + alpha) / total for w in vocab}
    return class_priors, class_word_probs


def predict_nb(doc, class_priors, class_word_probs):
    scores = {}
    for cls in class_priors:
        s = math.log(class_priors[cls])
        for token in doc:
            if token in class_word_probs[cls]:
                s += math.log(class_word_probs[cls][token])
        scores[cls] = s
    return max(scores, key=scores.get)


def evaluate(y_true, y_pred):
    tp = sum(1 for t, p in zip(y_true, y_pred) if t == "+" and p == "+")
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == "-" and p == "+")
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == "+" and p == "-")
    tn = sum(1 for t, p in zip(y_true, y_pred) if t == "-" and p == "-")
    precision = tp / (tp + fp) if tp + fp else 0
    recall = tp / (tp + fn) if tp + fn else 0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0
    return {"tp": tp, "fp": fp, "tn": tn, "fn": fn, "precision": round(precision, 3), "recall": round(recall, 3), "f1": round(f1, 3)}


def main():
    positive = [
        "absolutely loved this movie",
        "beautiful cinematography and a great story",
        "one of the best films of the year",
        "brilliant acting from the lead",
        "heartwarming and funny",
    ]
    negative = [
        "boring and far too long",
        "not worth your time",
        "the plot made no sense",
        "terrible acting, awful script",
        "i want my two hours back",
    ]

    train_pos = [apply_negation(tokenize(t)) for t in positive]
    train_neg = [apply_negation(tokenize(t)) for t in negative]

    vocab = build_vocab(train_pos + train_neg)
    priors, word_probs = train_nb({"+": train_pos, "-": train_neg}, vocab)

    test = [
        ("this movie was not good", "-"),
        ("loved every minute", "+"),
        ("terrible waste of time", "-"),
        ("beautiful and brilliant", "+"),
        ("i did not enjoy this at all", "-"),
    ]

    y_true = [label for _, label in test]
    y_pred = [predict_nb(apply_negation(tokenize(t)), priors, word_probs) for t, _ in test]
    for (text, actual), predicted in zip(test, y_pred):
        mark = "OK" if actual == predicted else "MISS"
        print(f"[{mark}] pred={predicted}  true={actual}  :: {text}")

    print()
    print("metrics:", evaluate(y_true, y_pred))


if __name__ == "__main__":
    main()
