from collections import Counter


def char_ngrams(word, n_min=3, n_max=6):
    wrapped = f"<{word}>"
    grams = {wrapped}
    for n in range(n_min, n_max + 1):
        for i in range(len(wrapped) - n + 1):
            grams.add(wrapped[i:i + n])
    return grams


def learn_bpe(corpus, k_merges):
    vocab = {}
    for word, freq in corpus.items():
        tokens = tuple(word) + ("</w>",)
        vocab[tokens] = freq

    merges = []
    for _ in range(k_merges):
        pair_freq = Counter()
        for tokens, freq in vocab.items():
            for a, b in zip(tokens, tokens[1:]):
                pair_freq[(a, b)] += freq
        if not pair_freq:
            break
        best = pair_freq.most_common(1)[0][0]
        merges.append(best)

        new_vocab = {}
        for tokens, freq in vocab.items():
            new_tokens = []
            i = 0
            while i < len(tokens):
                if i + 1 < len(tokens) and (tokens[i], tokens[i + 1]) == best:
                    new_tokens.append(tokens[i] + tokens[i + 1])
                    i += 2
                else:
                    new_tokens.append(tokens[i])
                    i += 1
            new_vocab[tuple(new_tokens)] = freq
        vocab = new_vocab
    return merges


def apply_bpe(word, merges):
    tokens = list(word) + ["</w>"]
    for a, b in merges:
        new_tokens = []
        i = 0
        while i < len(tokens):
            if i + 1 < len(tokens) and tokens[i] == a and tokens[i + 1] == b:
                new_tokens.append(a + b)
                i += 2
            else:
                new_tokens.append(tokens[i])
                i += 1
        tokens = new_tokens
    return tokens


def main():
    print("=== FastText n-grams ===")
    for word in ["where", "whereupon"]:
        grams = sorted(char_ngrams(word))
        print(f"{word:12s} {len(grams)} grams, e.g., {grams[:5]}")
    shared = char_ngrams("where") & char_ngrams("whereupon")
    print(f"shared n-grams between where / whereupon: {len(shared)}")
    print()

    print("=== BPE on toy corpus ===")
    corpus = Counter({
        "low": 5, "lower": 2, "newest": 6, "widest": 3,
        "lowest": 4, "newer": 2,
    })
    merges = learn_bpe(corpus, k_merges=10)
    print(f"learned {len(merges)} merges:")
    for a, b in merges:
        print(f"  {a!r} + {b!r} -> {a + b!r}")
    print()

    for test in ["lowest", "slowest", "lower", "newish"]:
        tokens = apply_bpe(test, merges)
        print(f"{test:10s} -> {tokens}")


if __name__ == "__main__":
    main()
