ORG_GAZETTEER = {"Apple", "Google", "Microsoft", "OpenAI", "Meta", "Amazon", "Netflix", "Anthropic"}
GPE_GAZETTEER = {"US", "USA", "UK", "India", "Germany", "France", "Japan"}
PRODUCT_GAZETTEER = {"iPhone", "Android", "Windows", "ChatGPT", "Claude", "Gemini"}


def word_shape(word):
    out = []
    for c in word:
        if c.isupper():
            out.append("X")
        elif c.islower():
            out.append("x")
        elif c.isdigit():
            out.append("d")
        else:
            out.append(c)
    return "".join(out)


def rule_based_ner(tokens):
    labels = []
    for token in tokens:
        if token in ORG_GAZETTEER:
            labels.append("B-ORG")
        elif token in GPE_GAZETTEER:
            labels.append("B-GPE")
        elif token in PRODUCT_GAZETTEER:
            labels.append("B-PRODUCT")
        else:
            labels.append("O")
    return labels


def spans_to_bio(tokens, spans):
    labels = ["O"] * len(tokens)
    for start, end, label in spans:
        labels[start] = f"B-{label}"
        for i in range(start + 1, end):
            labels[i] = f"I-{label}"
    return labels


def bio_to_spans(tokens, labels):
    spans = []
    current = None
    for i, label in enumerate(labels):
        if label.startswith("B-"):
            if current:
                spans.append(current)
            current = (i, i + 1, label[2:])
        elif label.startswith("I-") and current and current[2] == label[2:]:
            current = (current[0], i + 1, current[2])
        else:
            if current:
                spans.append(current)
                current = None
    if current:
        spans.append(current)
    return spans


def token_features(token, prev_token, next_token):
    return {
        "lower": token.lower(),
        "is_upper": token.isupper(),
        "is_title": token.istitle(),
        "has_digit": any(c.isdigit() for c in token),
        "suffix_3": token[-3:].lower(),
        "shape": word_shape(token),
        "prev_lower": prev_token.lower() if prev_token else "<BOS>",
        "next_lower": next_token.lower() if next_token else "<EOS>",
    }


def main():
    sentence = "Apple sued Google over iPhone sales in the US .".split()
    labels = rule_based_ner(sentence)
    spans = bio_to_spans(sentence, labels)

    print("tokens  :", sentence)
    print("labels  :", labels)
    print("spans   :")
    for start, end, kind in spans:
        entity = " ".join(sentence[start:end])
        print(f"  [{start}:{end}] {kind:8s} {entity!r}")

    print()
    print("word shapes (useful CRF features):")
    for tok in ["Apple", "iPhone", "IBM", "USA-2024", "apple"]:
        print(f"  {tok:12s} -> shape {word_shape(tok)}")

    print()
    print("round-trip (spans -> BIO -> spans):")
    tokens = "The New York City mayor visited OpenAI .".split()
    gold_spans = [(1, 4, "GPE"), (6, 7, "ORG")]
    bio = spans_to_bio(tokens, gold_spans)
    recovered = bio_to_spans(tokens, bio)
    print(f"  tokens   : {tokens}")
    print(f"  bio      : {bio}")
    print(f"  gold     : {gold_spans}")
    print(f"  recovered: {recovered}")
    print(f"  match    : {gold_spans == recovered}")


if __name__ == "__main__":
    main()
