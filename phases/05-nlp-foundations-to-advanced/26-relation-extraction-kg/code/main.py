import re
from collections import defaultdict


PATTERNS = [
    (re.compile(r"([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)?) was born in ([A-Z][A-Za-z]+)"), "P19"),
    (re.compile(r"([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)?) founded ([A-Z][A-Za-z]+(?: Inc)?)"), "P112"),
    (re.compile(r"([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)?) (?:became|is|was) CEO of ([A-Z][A-Za-z]+(?: Inc)?)"), "P169"),
    (re.compile(r"([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)?) works? (?:at|for) ([A-Z][A-Za-z]+(?: Inc)?)"), "P108"),
    (re.compile(r"([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)?) (?:studied|graduated) (?:at|from) ([A-Z][A-Za-z]+(?: University)?)"), "P69"),
    (re.compile(r"([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)?) (?:acquired|bought) ([A-Z][A-Za-z]+(?: Inc)?)"), "P1830"),
]


RELATION_LABELS = {
    "P19":   "place of birth",
    "P112":  "founded",
    "P169":  "CEO of",
    "P108":  "employer",
    "P69":   "educated at",
    "P1830": "acquired",
}


def extract(text):
    triples = []
    for pattern, rel in PATTERNS:
        for m in pattern.finditer(text):
            subj = m.group(1)
            obj = m.group(2)
            span = (m.start(), m.end())
            triples.append({"subject": subj, "relation": rel, "object": obj, "span": span, "evidence": m.group(0)})
    return triples


def verify(triples, text):
    verified = []
    for t in triples:
        s, e = t["span"]
        if text[s:e] != t["evidence"]:
            continue
        if t["subject"] not in text or t["object"] not in text:
            continue
        verified.append(t)
    return verified


def build_graph(triples):
    graph = defaultdict(list)
    for t in triples:
        graph[t["subject"]].append((t["relation"], t["object"], t["evidence"]))
    return graph


def print_graph(graph):
    for subj in sorted(graph):
        for rel, obj, ev in graph[subj]:
            label = RELATION_LABELS.get(rel, rel)
            print(f"  ({subj}) --[{label}]--> ({obj})")
            print(f"      evidence: \"{ev}\"")


def main():
    doc = (
        "Tim Cook became CEO of Apple in 2011. "
        "Steve Jobs founded Apple in 1976. "
        "Larry Page founded Google with Sergey Brin. "
        "Sundar Pichai is CEO of Google. "
        "Satya Nadella was born in Hyderabad. "
        "Elon Musk acquired Twitter in 2022. "
        "Dario Amodei studied at Princeton University. "
        "Yann LeCun works at Meta."
    )

    print("=== rule-based relation extraction (with provenance) ===")
    print(f"document: {doc}")
    print()

    triples = extract(doc)
    verified = verify(triples, doc)

    print(f"extracted: {len(triples)}  verified: {len(verified)}")
    print()
    graph = build_graph(verified)
    print_graph(graph)

    print()
    print("=== query: Tim Cook's employer ===")
    for rel, obj, ev in graph.get("Tim Cook", []):
        if rel == "P169":
            print(f"  Tim Cook is CEO of {obj}")
            print(f"  source: \"{ev}\"")

    print()
    print("note: rule-based RE = high precision, low recall.")
    print("production stacks mix patterns + REBEL + LLM with AEVS verification.")


if __name__ == "__main__":
    main()
