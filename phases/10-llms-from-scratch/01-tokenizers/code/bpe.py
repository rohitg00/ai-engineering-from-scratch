from collections import Counter


class BPETokenizer:
    def __init__(self):
        self.merges = {}
        self.vocab = {}

    def _get_pairs(self, tokens):
        pairs = Counter()
        for i in range(len(tokens) - 1):
            pairs[(tokens[i], tokens[i + 1])] += 1
        return pairs

    def _merge_pair(self, tokens, pair, new_token):
        merged = []
        i = 0
        while i < len(tokens):
            if i < len(tokens) - 1 and tokens[i] == pair[0] and tokens[i + 1] == pair[1]:
                merged.append(new_token)
                i += 2
            else:
                merged.append(tokens[i])
                i += 1
        return merged

    def train(self, text, num_merges):
        tokens = list(text.encode("utf-8"))
        self.vocab = {i: bytes([i]) for i in range(256)}

        for i in range(num_merges):
            pairs = self._get_pairs(tokens)
            if not pairs:
                break
            best_pair = max(pairs, key=pairs.get)
            new_token = 256 + i
            tokens = self._merge_pair(tokens, best_pair, new_token)
            self.merges[best_pair] = new_token
            self.vocab[new_token] = self.vocab[best_pair[0]] + self.vocab[best_pair[1]]
            merged_str = self.vocab[new_token]
            print(f"Merge {i + 1}: {best_pair} -> {new_token} = {merged_str}")

        return self

    def encode(self, text):
        tokens = list(text.encode("utf-8"))
        for pair, new_token in self.merges.items():
            tokens = self._merge_pair(tokens, pair, new_token)
        return tokens

    def decode(self, tokens):
        byte_sequence = b"".join(self.vocab[t] for t in tokens)
        return byte_sequence.decode("utf-8", errors="replace")

    def vocab_size(self):
        return len(self.vocab)

    def get_token_str(self, token_id):
        return self.vocab.get(token_id, b"<?>")


def demo_bpe():
    corpus = (
        "The cat sat on the mat. The cat ate the rat. "
        "The dog sat on the log. The dog ate the frog. "
        "Natural language processing is the study of how computers "
        "understand and generate human language."
    )

    print("=" * 60)
    print("Training BPE tokenizer")
    print("=" * 60)

    tokenizer = BPETokenizer()
    tokenizer.train(corpus, num_merges=30)

    print(f"\nVocabulary size: {tokenizer.vocab_size()}")

    test_sentences = [
        "The cat sat on the mat.",
        "The frog sat on the log.",
        "language processing",
        "unhappiness",
    ]

    print("\n" + "=" * 60)
    print("Encoding test sentences")
    print("=" * 60)

    for sentence in test_sentences:
        encoded = tokenizer.encode(sentence)
        decoded = tokenizer.decode(encoded)
        raw_bytes = len(sentence.encode("utf-8"))
        print(f"\nOriginal:  {sentence}")
        print(f"Encoded:   {encoded}")
        print(f"Decoded:   {decoded}")
        print(f"Tokens:    {len(encoded)} (from {raw_bytes} bytes)")
        print(f"Ratio:     {len(encoded) / raw_bytes:.2f}")


def demo_tiktoken():
    try:
        import tiktoken
    except ImportError:
        print("\ntiktoken not installed. Run: pip install tiktoken")
        return

    print("\n" + "=" * 60)
    print("Comparing with tiktoken (GPT-4 tokenizer)")
    print("=" * 60)

    enc = tiktoken.get_encoding("cl100k_base")

    test_texts = [
        "The cat sat on the mat.",
        "unhappiness",
        "Hello, world!",
        "def fibonacci(n):",
        "3.14159265358979",
    ]

    for text in test_texts:
        tokens = enc.encode(text)
        decoded_pieces = [enc.decode([t]) for t in tokens]
        print(f"\n'{text}'")
        print(f"  Tokens:  {decoded_pieces}")
        print(f"  IDs:     {tokens}")
        print(f"  Count:   {len(tokens)}")


if __name__ == "__main__":
    demo_bpe()
    demo_tiktoken()
