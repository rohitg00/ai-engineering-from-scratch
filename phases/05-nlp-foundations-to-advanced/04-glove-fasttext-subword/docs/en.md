# GloVe, FastText, and Subword Embeddings

> Word2Vec trained one embedding per word. GloVe factorized the co-occurrence matrix. FastText embedded the pieces. BPE bridged to transformers.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 03 (Word2Vec from Scratch)
**Time:** ~45 minutes

## The Problem

Word2Vec left two open questions.

First, there was a parallel line of research that factorized the co-occurrence matrix directly (LSA, HAL) rather than doing online skip-gram updates. Was Word2Vec's iterative approach fundamentally better, or was the difference an artifact of how the two methods handled counts? **GloVe** answered that: matrix factorization with a thoughtfully chosen loss matches or beats Word2Vec, and costs less to train.

Second, neither method had a story for words it had never seen. `Zoomer-approved`, `dogecoin`, any proper noun coined last week, every inflected form of a rare root. **FastText** fixed this by embedding character n-grams: a word is the sum of its parts, including morphemes, so even out-of-vocabulary words get a sensible vector.

Third, once transformers arrived, the question shifted again. Word-level vocabularies cap out around a million entries; real language is more open than that. **Byte-pair encoding (BPE)** and its relatives solved this by learning a vocabulary of frequent subword units that covers everything. Every modern tokenizer for every modern LLM is a subword tokenizer.

This lesson walks all three, then explains which to reach for when.

## The Concept

![Three embedding approaches: GloVe co-occurrence, FastText subwords, BPE merges](./assets/embeddings.svg)

**GloVe (Global Vectors).** Build the word-word co-occurrence matrix `X` where `X[i][j]` is how often word `j` appears in the context of word `i`. Train vectors such that `v_i · v_j + b_i + b_j ≈ log(X[i][j])`. Weight the loss so frequent pairs do not dominate. Done.

**FastText.** A word is the sum of its character n-grams plus the word itself. `where` becomes `<wh, whe, her, ere, re>, <where>`. The word vector is the sum of those component vectors. Train as Word2Vec. Benefit: unseen words (`whereupon`) compose from known n-grams.

**BPE (Byte-Pair Encoding).** Start with a vocabulary of individual bytes (or characters). Count every adjacent pair in the corpus. Merge the most frequent pair into a new token. Repeat for `k` iterations. Result: a vocabulary of `k + 256` tokens where frequent sequences (`ing`, `tion`, `the`) are single tokens and rare words are broken into familiar pieces. Every sentence tokenizes into something.

## Build It

### GloVe: factorize the co-occurrence matrix

```python
import numpy as np
from collections import Counter


def build_cooccurrence(docs, window=5):
    pair_counts = Counter()
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    for doc in docs:
        indexed = [vocab[t] for t in doc]
        for i, center in enumerate(indexed):
            for j in range(max(0, i - window), min(len(indexed), i + window + 1)):
                if i != j:
                    distance = abs(i - j)
                    pair_counts[(center, indexed[j])] += 1.0 / distance
    return vocab, pair_counts


def glove_train(vocab, pair_counts, dim=16, epochs=100, lr=0.05, x_max=100, alpha=0.75, seed=0):
    n = len(vocab)
    rng = np.random.default_rng(seed)
    W = rng.normal(0, 0.1, size=(n, dim))
    W_tilde = rng.normal(0, 0.1, size=(n, dim))
    b = np.zeros(n)
    b_tilde = np.zeros(n)

    for epoch in range(epochs):
        for (i, j), x_ij in pair_counts.items():
            weight = (x_ij / x_max) ** alpha if x_ij < x_max else 1.0
            diff = W[i] @ W_tilde[j] + b[i] + b_tilde[j] - np.log(x_ij)
            coef = weight * diff

            grad_W_i = coef * W_tilde[j]
            grad_W_tilde_j = coef * W[i]
            W[i] -= lr * grad_W_i
            W_tilde[j] -= lr * grad_W_tilde_j
            b[i] -= lr * coef
            b_tilde[j] -= lr * coef

    return W + W_tilde
```

Two moving pieces worth naming. The weighting function `f(x) = (x/x_max)^alpha` downweights very frequent pairs (like `(the, and)`) so they do not dominate the loss. The final embedding is the sum of `W` (center) and `W_tilde` (context) tables. Summing both is a published trick that tends to outperform using just one.

### FastText: subword-aware embeddings

```python
def char_ngrams(word, n_min=3, n_max=6):
    wrapped = f"<{word}>"
    grams = {wrapped}
    for n in range(n_min, n_max + 1):
        for i in range(len(wrapped) - n + 1):
            grams.add(wrapped[i:i + n])
    return grams
```

```python
>>> char_ngrams("where")
{'<where>', '<wh', 'whe', 'her', 'ere', 're>', '<whe', 'wher', 'here', 'ere>', '<wher', 'where', 'here>'}
```

Each word is represented by its set of n-grams (typically 3 to 6 characters). The word embedding is the sum of its n-gram embeddings. For skip-gram training, plug this in where Word2Vec used a single vector.

```python
def fasttext_vector(word, ngram_table):
    grams = char_ngrams(word)
    vecs = [ngram_table[g] for g in grams if g in ngram_table]
    if not vecs:
        return None
    return np.sum(vecs, axis=0)
```

For an unseen word, you still get a vector as long as some of its n-grams are known. `whereupon` shares `<wh`, `her`, `ere`, and `<where` with `where`, so the two land near each other.

### BPE: learned subword vocabulary

```python
def learn_bpe(corpus, k_merges):
    vocab = Counter()
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

        new_vocab = Counter()
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
```

```python
>>> corpus = Counter({"low": 5, "lower": 2, "newest": 6, "widest": 3})
>>> merges = learn_bpe(corpus, k_merges=10)
>>> apply_bpe("lowest", merges)
['low', 'est</w>']
```

First iteration merges the most common adjacent pair. After enough iterations, frequent substrings (`low`, `est`, `tion`) become single tokens and rare words break cleanly.

The real GPT / BERT / T5 tokenizers learn 30k-100k merges. Result: any text tokenizes into a bounded-length sequence of known IDs, no OOV ever.

## Use It

In practice, you rarely train any of these yourself. You load pre-trained checkpoints.

```python
import fasttext.util
fasttext.util.download_model("en", if_exists="ignore")
ft = fasttext.load_model("cc.en.300.bin")
print(ft.get_word_vector("whereupon").shape)
print(ft.get_word_vector("zoomerapproved").shape)
```

For BPE-style subword tokenization in the transformer era:

```python
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("gpt2")
print(tok.tokenize("unbelievably tokenized"))
```

```
['un', 'bel', 'iev', 'ably', 'Ġtoken', 'ized']
```

The `Ġ` prefix marks word boundaries (a GPT-2 convention). Every modern tokenizer is a BPE variant, WordPiece (BERT), or SentencePiece (T5, LLaMA).

### When to pick which

| Situation | Pick |
|-----------|------|
| Pretrained general-purpose word vectors, no OOV tolerance needed | GloVe 300d |
| Pretrained general-purpose word vectors, must handle misspellings / neologisms / morphologically rich languages | FastText |
| Anything going into a transformer (training or inference) | Whatever tokenizer the model shipped with. Never swap. |
| Training your own language model from scratch | Train a BPE or SentencePiece tokenizer on your corpus first |
| Production text classification with a linear model | Still TF-IDF. Lesson 02. |

## Ship It

Save as `outputs/skill-tokenizer-picker.md`:

```markdown
---
name: tokenizer-picker
description: Pick a tokenization approach for a new language model or text pipeline.
version: 1.0.0
phase: 5
lesson: 04
tags: [nlp, tokenization, embeddings]
---

Given a task and dataset description, you output:

1. Tokenization strategy (word-level, BPE, WordPiece, SentencePiece, byte-level). One-sentence reason.
2. Vocabulary size target (e.g., 32k for an English-only LM, 64k-100k for multilingual).
3. Library call with the exact training command. Name the library. Quote the arguments.
4. One reproducibility pitfall. Tokenizer-model mismatch is the single most common silent production bug; call out which pair must be used together.

Refuse to recommend training a custom tokenizer when the user is fine-tuning a pretrained LLM. Refuse to recommend word-level tokenization for any model targeting production inference. Flag non-English / multi-script corpora as needing SentencePiece with byte fallback.
```

## Exercises

1. **Easy.** Run `char_ngrams("playing")` and `char_ngrams("played")`. Compute the Jaccard overlap of the two n-gram sets. You should see substantial shared pieces (`pla`, `lay`, `play`), which is why FastText transfers well across morphological variants.
2. **Medium.** Extend `learn_bpe` to track vocabulary growth. Plot tokens-per-corpus-character as a function of number of merges. You should see rapid compression at first, asymptoting near ~2-3 chars per token.
3. **Hard.** Train a 1k-merge BPE on Shakespeare's complete works. Compare tokenization of common words vs. rare proper nouns. Measure average tokens per word before and after. Write up what surprised you.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Co-occurrence matrix | Word-word frequency table | `X[i][j]` = how often word `j` appears in a window around word `i`. |
| Subword | Piece of a word | A character n-gram (FastText) or learned token (BPE/WordPiece/SentencePiece). |
| BPE | Byte-pair encoding | Iterative merging of most-frequent adjacent pairs until vocabulary hits target size. |
| OOV | Out of vocabulary | Word the model has never seen. Word2Vec/GloVe fail. FastText and BPE handle it. |
| Byte-level BPE | BPE on raw bytes | GPT-2's scheme. Vocabulary starts with 256 bytes, so nothing is ever OOV. |

## Further Reading

- [Pennington, Socher, Manning (2014). GloVe: Global Vectors for Word Representation](https://nlp.stanford.edu/pubs/glove.pdf) — the GloVe paper, seven pages, still the best derivation of the loss.
- [Bojanowski et al. (2017). Enriching Word Vectors with Subword Information](https://arxiv.org/abs/1607.04606) — FastText.
- [Sennrich, Haddow, Birch (2016). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) — the paper that introduced BPE to modern NLP.
- [Hugging Face tokenizer summary](https://huggingface.co/docs/transformers/tokenizer_summary) — how BPE, WordPiece, and SentencePiece actually differ in practice.
