import re
from collections import Counter


def word_counts(text):
    words = re.findall(r"[a-zA-Z]+", text.lower())
    return Counter(words)


def init_vocab(counts):
    return {tuple(word) + ("</w>",): freq for word, freq in counts.items()}


def pair_counts(vocab):
    pairs = Counter()
    for symbols, freq in vocab.items():
        for a, b in zip(symbols, symbols[1:]):
            pairs[(a, b)] += freq
    return pairs


def merge_pair(vocab, pair):
    a, b = pair
    merged_symbol = a + b
    new_vocab = {}
    for symbols, freq in vocab.items():
        new_symbols = []
        i = 0
        while i < len(symbols):
            if i < len(symbols) - 1 and symbols[i] == a and symbols[i + 1] == b:
                new_symbols.append(merged_symbol)
                i += 2
            else:
                new_symbols.append(symbols[i])
                i += 1
        new_vocab[tuple(new_symbols)] = freq
    return new_vocab


def train_bpe(text, num_merges):
    counts = word_counts(text)
    if not counts:
        raise ValueError("word_counts: corpus produced no words")
    vocab = init_vocab(counts)
    merges = []
    for _ in range(num_merges):
        pairs = pair_counts(vocab)
        if not pairs:
            break
        best = pairs.most_common(1)[0][0]
        merges.append(best)
        vocab = merge_pair(vocab, best)
    final_tokens = set()
    for symbols in vocab:
        final_tokens.update(symbols)
    return merges, sorted(final_tokens)


def encode_bpe(word, merges):
    symbols = list(word) + ["</w>"]
    for a, b in merges:
        merged = a + b
        i = 0
        while i < len(symbols) - 1:
            if symbols[i] == a and symbols[i + 1] == b:
                symbols = symbols[:i] + [merged] + symbols[i + 2:]
            else:
                i += 1
    return symbols


def main():
    corpus = """
    the quick brown fox jumps over the lazy dog
    a stitch in time saves nine
    language models learn from statistical patterns in text
    tokenization splits text into smaller units called tokens
    subword tokenization lets rare words decompose into known pieces
    byte pair encoding is the dominant tokenization algorithm today
    the lazy dog slept while the fox jumped again and again
    patterns of letters in words are learnable and reusable
    """

    merges_small, tokens_small = train_bpe(corpus, num_merges=30)
    merges_big, tokens_big = train_bpe(corpus, num_merges=150)

    print(f"=== BPE, 30 merges ===")
    print(f"vocab size: {len(tokens_small)}")
    print("first 10 merges:")
    for i, m in enumerate(merges_small[:10]):
        print(f"  {i}: {m[0]!r} + {m[1]!r} -> {m[0] + m[1]!r}")

    print()
    print(f"=== BPE, 150 merges ===")
    print(f"vocab size: {len(tokens_big)}")

    print()
    held_out = ["tokenizable", "unlearnable", "foxhound", "languages"]
    print("=== encoding held-out words (150-merge model) ===")
    for word in held_out:
        pieces = encode_bpe(word, merges_big)
        tag = "OK" if len(pieces) == 1 else f"split({len(pieces)})"
        print(f"  {word:<14} -> {' | '.join(pieces)}  [{tag}]")

    print()
    print("note: with a tiny toy corpus, most held-out words will split.")
    print("production vocabularies train on billions of tokens.")


if __name__ == "__main__":
    main()
