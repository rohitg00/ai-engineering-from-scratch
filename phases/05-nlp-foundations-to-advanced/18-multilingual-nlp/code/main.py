LANGUAGE_FEATURES = {
    "english":  {"word_order": "SVO", "script": "Latin",   "family": "Germanic"},
    "german":   {"word_order": "SVO", "script": "Latin",   "family": "Germanic"},
    "french":   {"word_order": "SVO", "script": "Latin",   "family": "Romance"},
    "spanish":  {"word_order": "SVO", "script": "Latin",   "family": "Romance"},
    "italian":  {"word_order": "SVO", "script": "Latin",   "family": "Romance"},
    "hindi":    {"word_order": "SOV", "script": "Devanagari", "family": "Indic"},
    "marathi":  {"word_order": "SOV", "script": "Devanagari", "family": "Indic"},
    "bengali":  {"word_order": "SOV", "script": "Bengali",    "family": "Indic"},
    "urdu":     {"word_order": "SOV", "script": "Arabic",     "family": "Indic"},
    "arabic":   {"word_order": "VSO", "script": "Arabic",     "family": "Semitic"},
    "japanese": {"word_order": "SOV", "script": "Kanji",      "family": "Japonic"},
}


def similarity(a, b):
    fa = LANGUAGE_FEATURES[a]
    fb = LANGUAGE_FEATURES[b]
    matches = sum(1 for k in fa if fa[k] == fb[k])
    return matches / len(fa)


def rank_source_languages(target, candidates):
    scored = [(cand, similarity(target, cand)) for cand in candidates if cand != target]
    scored.sort(key=lambda x: -x[1])
    return scored


def simulate_transfer_accuracy(target, source):
    sim = similarity(target, source)
    base_accuracy = 0.45
    max_boost = 0.45
    return min(0.95, base_accuracy + sim * max_boost)


def main():
    candidates = list(LANGUAGE_FEATURES)
    targets = ["marathi", "urdu", "arabic", "japanese"]

    print("=== source language selection (qWALS-style similarity) ===")
    for target in targets:
        ranking = rank_source_languages(target, candidates)[:4]
        print(f"\n  target: {target}")
        for source, sim in ranking:
            expected = simulate_transfer_accuracy(target, source)
            print(f"    source={source:10s}  sim={sim:.2f}  simulated_acc={expected:.0%}")

    print()
    print("note: real similarity comes from qWALS / lang2vec, not a 3-feature toy.")
    print("key insight: for Marathi, Hindi is a better source than English.")


if __name__ == "__main__":
    main()
