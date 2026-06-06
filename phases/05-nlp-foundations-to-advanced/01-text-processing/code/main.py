import re


WORD_RE = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+|[^\sA-Za-z0-9]")


def tokenize(text):
    return WORD_RE.findall(text)


def stem_step_1a(word):
    if word.endswith("sses"):
        return word[:-2]
    if word.endswith("ies"):
        return word[:-2]
    if word.endswith("ss"):
        return word
    if word.endswith("s") and len(word) > 1:
        return word[:-1]
    return word


LEMMA_TABLE = {
    ("running", "VERB"): "run",
    ("ran", "VERB"): "run",
    ("runs", "VERB"): "run",
    ("better", "ADJ"): "good",
    ("best", "ADJ"): "good",
    ("cats", "NOUN"): "cat",
    ("cat", "NOUN"): "cat",
    ("were", "VERB"): "be",
    ("was", "VERB"): "be",
    ("is", "VERB"): "be",
}


def lemmatize(word, pos):
    key = (word.lower(), pos)
    if key in LEMMA_TABLE:
        return LEMMA_TABLE[key]
    if pos == "VERB" and word.endswith("ing"):
        return word[:-3]
    if pos == "NOUN" and word.endswith("s"):
        return word[:-1]
    return word.lower()


def preprocess(text, pos_tagger=None):
    tokens = tokenize(text)
    stems = [stem_step_1a(t.lower()) for t in tokens]
    tags = pos_tagger(tokens) if pos_tagger else [(t, "NOUN") for t in tokens]
    lemmas = [lemmatize(word, pos) for word, pos in tags]
    return {"tokens": tokens, "stems": stems, "lemmas": lemmas}


def demo_pos_tagger(tokens):
    verbs = {"running", "ran", "runs", "were", "was", "is", "watched"}
    adjs = {"better", "best"}
    out = []
    for t in tokens:
        low = t.lower()
        if low in verbs:
            out.append((t, "VERB"))
        elif low in adjs:
            out.append((t, "ADJ"))
        else:
            out.append((t, "NOUN"))
    return out


def main():
    text = "The cats were running at 3pm."
    result = preprocess(text, pos_tagger=demo_pos_tagger)
    print(f"input:  {text}")
    print(f"tokens: {result['tokens']}")
    print(f"stems:  {result['stems']}")
    print(f"lemmas: {result['lemmas']}")


if __name__ == "__main__":
    main()
