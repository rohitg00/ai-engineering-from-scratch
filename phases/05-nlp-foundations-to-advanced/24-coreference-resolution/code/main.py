import re


PRONOUNS = {
    "he":    {"gender": "m", "number": "sg", "type": "prp"},
    "him":   {"gender": "m", "number": "sg", "type": "prp"},
    "his":   {"gender": "m", "number": "sg", "type": "prp"},
    "she":   {"gender": "f", "number": "sg", "type": "prp"},
    "her":   {"gender": "f", "number": "sg", "type": "prp"},
    "hers":  {"gender": "f", "number": "sg", "type": "prp"},
    "it":    {"gender": "n", "number": "sg", "type": "prp"},
    "its":   {"gender": "n", "number": "sg", "type": "prp"},
    "they":  {"gender": "u", "number": "pl", "type": "prp"},
    "them":  {"gender": "u", "number": "pl", "type": "prp"},
    "their": {"gender": "u", "number": "pl", "type": "prp"},
}

FEMALE_FIRST = {"mary", "alice", "sarah", "sophia", "emma", "olivia", "ava", "isabella", "maya", "jane"}
MALE_FIRST = {"john", "james", "david", "tim", "steve", "michael", "bob", "adam", "peter", "carl"}
NEUTER_HEADS = {"company", "firm", "corporation", "product", "device", "phone", "laptop", "computer",
                "organization", "team", "group", "agency", "bank"}


DETERMINERS = {"the", "a", "an"}


def extract_mentions(text):
    mentions = []
    for sent_idx, sent in enumerate(re.split(r"(?<=[.!?])\s+", text)):
        tokens = re.findall(r"[A-Za-z]+|[^\s]", sent)
        i = 0
        while i < len(tokens):
            tok = tokens[i]
            low = tok.lower()
            if low in PRONOUNS:
                mentions.append({"text": tok, "span": (sent_idx, i),
                                 "type": "pronoun", "features": PRONOUNS[low]})
                i += 1
                continue
            if low in DETERMINERS and i + 1 < len(tokens):
                head = tokens[i + 1].lower()
                if head in NEUTER_HEADS:
                    mentions.append({"text": f"{tok} {tokens[i + 1]}", "span": (sent_idx, i),
                                     "type": "nominal",
                                     "features": {"gender": "n", "number": "sg", "head": head}})
                    i += 2
                    continue
            if tok[0].isupper() and tok.isalpha() and low not in DETERMINERS:
                j = i + 1
                while j < len(tokens) and tokens[j][0].isupper() and tokens[j].isalpha():
                    j += 1
                name = " ".join(tokens[i:j])
                gender = infer_gender(name)
                mentions.append({"text": name, "span": (sent_idx, i),
                                 "type": "ne", "features": {"gender": gender, "number": "sg"}})
                i = j
                continue
            i += 1
    return mentions


def infer_gender(name):
    first = name.split()[0].lower()
    if first in FEMALE_FIRST:
        return "f"
    if first in MALE_FIRST:
        return "m"
    return "u"


def agreement_score(mention, candidate):
    score = 0.0
    mf = mention["features"]
    cf = candidate["features"]
    if mf["number"] == cf["number"]:
        score += 1.0
    if mf["gender"] == "u" or cf["gender"] == "u" or mf["gender"] == cf["gender"]:
        score += 1.0
    else:
        score -= 2.0
    return score


def recency_score(mention, candidate):
    delta = (mention["span"][0] - candidate["span"][0]) * 2 + max(0, mention["span"][1] - candidate["span"][1]) * 0.01
    return -delta


def resolve(mentions):
    links = []
    for i, m in enumerate(mentions):
        if m["type"] != "pronoun":
            continue
        candidates = [c for c in mentions[:i] if c["type"] in ("ne", "nominal")]
        if not candidates:
            links.append((m, None))
            continue
        best = max(candidates, key=lambda c: agreement_score(m, c) + recency_score(m, c))
        links.append((m, best))
    return links


def clusters(mentions, links):
    parent = {id(m): id(m) for m in mentions}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        parent[find(a)] = find(b)

    for m, ant in links:
        if ant is not None:
            union(id(m), id(ant))
    groups = {}
    for m in mentions:
        root = find(id(m))
        groups.setdefault(root, []).append(m["text"])
    return list(groups.values())


def main():
    doc = (
        "Tim Cook walked onto the stage. "
        "He announced the new iPhone. "
        "The company also showed a laptop. "
        "It will ship in June. "
        "Mary Chen joined Apple last year. "
        "She leads the AI team. "
        "Her team built the voice assistant. "
        "The device impressed the audience."
    )

    print("=== toy rule-based coreference ===")
    print(f"document: {doc}")
    print()

    mentions = extract_mentions(doc)
    print(f"extracted {len(mentions)} mentions:")
    for m in mentions:
        print(f"  [{m['type']:<7}] {m['text']:<22} feats={m['features']}")

    print()
    links = resolve(mentions)
    print("pronoun links:")
    for pronoun, antecedent in links:
        ant_text = antecedent["text"] if antecedent else "<none>"
        print(f"  {pronoun['text']:<8} -> {ant_text}")

    print()
    print("clusters:")
    for i, cluster in enumerate(clusters(mentions, links)):
        if len(cluster) > 1:
            print(f"  cluster {i}: {cluster}")

    print()
    print("note: rules handle easy pronouns; production models are span-based neural.")
    print("note: neuter pronoun 'it' / 'its' prefers neuter-head nominals like 'the company'.")


if __name__ == "__main__":
    main()
