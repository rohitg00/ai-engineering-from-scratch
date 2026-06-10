# Word Embeddings — Word2Vec from Scratch

> A word is the company it keeps. Train a shallow net on that idea and geometry falls out.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 3 · 03 (Backpropagation from Scratch)
**Time:** ~75 minutes

## The Problem

TF-IDF knows `dog` and `puppy` are different words. It does not know they mean nearly the same thing. A classifier trained on `dog` cannot generalize to a review about `puppy`. You can paper over this by listing synonyms, but that fails on rare terms, domain jargon, and every language you did not anticipate.

You want a representation where `dog` and `puppy` land close together in space. Where `king - man + woman` lands near `queen`. Where a model trained on `dog` transfers some signal to `puppy` for free.

Word2Vec gave us that space. Two layer neural network, trillion-token training runs, published in 2013. The architecture is almost embarrassingly simple. The results reshaped NLP for a decade.

## The Concept

**Distributional hypothesis** (Firth, 1957): "You shall know a word by the company it keeps." If two words appear in similar contexts, they probably mean similar things.

Word2Vec comes in two flavors, both exploiting that idea.

- **Skip-gram.** Given a center word, predict the surrounding words. `cat -> (the, sat, on)` with window size 2.
- **CBOW (continuous bag of words).** Given surrounding words, predict the center. `(the, sat, on) -> cat`.

Skip-gram is slower to train but handles rare words better. It became the default.

The network has one hidden layer with no nonlinearity. Input is a one-hot vector over the vocabulary. Output is a softmax over the vocabulary. After training, you throw away the output layer. The hidden layer weights are the embeddings.

```
one-hot(center) ── W ──▶ hidden (d-dim) ── W' ──▶ softmax(vocab)
                          ^
                          this is the embedding
```

The trick: softmax over 100k words is prohibitively expensive. Word2Vec uses **negative sampling** to turn it into a binary classification task. Predict "did this context word appear near this center word, yes or no". Sample a handful of negative (non-co-occurring) words per training pair instead of computing softmax over the whole vocabulary.

```figure
word-vector-arithmetic
```

## Build It

### Step 1: training pairs from a corpus

```python
def skipgram_pairs(docs, window=2):
    pairs = []
    for doc in docs:
        for i, center in enumerate(doc):
            for j in range(max(0, i - window), min(len(doc), i + window + 1)):
                if i == j:
                    continue
                pairs.append((center, doc[j]))
    return pairs
```

```python
>>> skipgram_pairs([["the", "cat", "sat", "on", "mat"]], window=2)
[('the', 'cat'), ('the', 'sat'),
 ('cat', 'the'), ('cat', 'sat'), ('cat', 'on'),
 ('sat', 'the'), ('sat', 'cat'), ('sat', 'on'), ('sat', 'mat'),
 ...]
```

Every (center, context) pair in a window is a positive training example.

### Step 2: embedding tables

Two matrices. `W` is the center-word embedding table (the one you keep). `W'` is the context-word table (often discarded, sometimes averaged with `W`).

```python
import numpy as np


def init_embeddings(vocab_size, dim, seed=0):
    rng = np.random.default_rng(seed)
    W = rng.normal(0, 0.1, size=(vocab_size, dim))
    W_prime = rng.normal(0, 0.1, size=(vocab_size, dim))
    return W, W_prime
```

Small random init. Vocab size 10k and dim 100 is realistic; for teaching, 50 vocab x 16 dim is enough to see the geometry.

### Step 3: negative sampling objective

For each positive pair `(center, context)`, sample `k` random words from the vocabulary as negatives. Train the model so the dot product `W[center] · W'[context]` is high for positives and low for negatives.

```python
def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -20, 20)))


def train_pair(W, W_prime, center_idx, context_idx, negative_indices, lr):
    v_c = W[center_idx]
    u_pos = W_prime[context_idx]
    u_negs = W_prime[negative_indices]

    pos_score = sigmoid(v_c @ u_pos)
    neg_scores = sigmoid(u_negs @ v_c)

    grad_center = (pos_score - 1) * u_pos
    for i, u in enumerate(u_negs):
        grad_center += neg_scores[i] * u

    W[context_idx] = W[context_idx]
    W_prime[context_idx] -= lr * (pos_score - 1) * v_c
    for i, neg_idx in enumerate(negative_indices):
        W_prime[neg_idx] -= lr * neg_scores[i] * v_c
    W[center_idx] -= lr * grad_center
```

The magic formula: logistic loss on positive pair (want sigmoid near 1) plus logistic loss on negative pairs (want sigmoid near 0). Gradients flow to both tables. Full derivation is in the original paper; walk through it once with pencil and paper if you want it to stick.

### Step 4: train on a toy corpus

```python
def train(docs, dim=16, window=2, k_neg=5, epochs=100, lr=0.05, seed=0):
    vocab = build_vocab(docs)
    vocab_size = len(vocab)
    rng = np.random.default_rng(seed)
    W, W_prime = init_embeddings(vocab_size, dim, seed=seed)
    pairs = skipgram_pairs(docs, window=window)

    for epoch in range(epochs):
        rng.shuffle(pairs)
        for center, context in pairs:
            c_idx = vocab[center]
            ctx_idx = vocab[context]
            negs = rng.integers(0, vocab_size, size=k_neg)
            negs = [n for n in negs if n != ctx_idx and n != c_idx]
            train_pair(W, W_prime, c_idx, ctx_idx, negs, lr)
    return vocab, W
```

After enough epochs on a large corpus, words that share contexts have similar center embeddings. On a toy corpus, you see the effect faintly. On billions of tokens, you see it dramatically.

### Step 5: the analogy trick

```python
def nearest(vocab, W, target_vec, topk=5, exclude=None):
    exclude = exclude or set()
    inv_vocab = {i: w for w, i in vocab.items()}
    norms = np.linalg.norm(W, axis=1, keepdims=True) + 1e-9
    W_norm = W / norms
    target = target_vec / (np.linalg.norm(target_vec) + 1e-9)
    sims = W_norm @ target
    order = np.argsort(-sims)
    out = []
    for i in order:
        if i in exclude:
            continue
        out.append((inv_vocab[i], float(sims[i])))
        if len(out) == topk:
            break
    return out


def analogy(vocab, W, a, b, c, topk=5):
    v = W[vocab[b]] - W[vocab[a]] + W[vocab[c]]
    return nearest(vocab, W, v, topk=topk, exclude={vocab[a], vocab[b], vocab[c]})
```

On pre-trained 300d Google News vectors:

```python
>>> analogy(vocab, W, "man", "king", "woman")
[('queen', 0.71), ('monarch', 0.62), ('princess', 0.59), ...]
```

`king - man + woman = queen`. Not because the model knows what royalty is. Because the vector `(king - man)` captures something like "royal", and adding it to `woman` lands near the royal-female region.

## Use It

Writing Word2Vec from scratch is teaching. Production NLP uses `gensim`.

```python
from gensim.models import Word2Vec

sentences = [
    ["the", "cat", "sat", "on", "the", "mat"],
    ["the", "dog", "ran", "across", "the", "room"],
]

model = Word2Vec(
    sentences,
    vector_size=100,
    window=5,
    min_count=1,
    sg=1,
    negative=5,
    workers=4,
    epochs=30,
)

print(model.wv["cat"])
print(model.wv.most_similar("cat", topn=3))
```

For real work, you almost never train Word2Vec yourself. You download pre-trained vectors.

- **GloVe** — Stanford's co-occurrence-matrix factorization approach. 50d, 100d, 200d, 300d checkpoints. Good general coverage. Lesson 04 covers GloVe specifically.
- **fastText** — Facebook's Word2Vec extension that embeds character n-grams. Handles out-of-vocabulary words by composing subwords. Lesson 04.
- **Pretrained Word2Vec on Google News** — 300d, 3M word vocabulary, published 2013. Still downloaded daily.

### When Word2Vec still wins in 2026

- Lightweight domain-specific retrieval. Train on medical abstracts in an hour on a laptop, get specialized vectors no general model captures.
- Analogy-style feature engineering. `gender_vector = mean(man - woman pairs)`. Subtract it from other words to get a gender-neutral axis. Still used in fairness research.
- Interpretability. 100d is small enough to plot via PCA or t-SNE and actually see clusters form.
- Anywhere inference has to run on-device with no GPU. Word2Vec lookup is a single row fetch.

### Where Word2Vec fails

The polysemy wall. `bank` has one vector. `river bank` and `financial bank` share it. `table` (spreadsheet vs. furniture) shares it. A classifier downstream cannot distinguish the senses from the vector.

Contextual embeddings (ELMo, BERT, every transformer since) solved this by producing a different vector for each occurrence of the word based on surrounding context. That is the jump from Word2Vec to BERT: from static to contextual. Phase 7 covers the transformer half.

The out-of-vocabulary problem is the other failure. Word2Vec has never seen `Zoomer-approved` if it was not in training data. No fallback. fastText fixes this with subword composition (lesson 04).

## Ship It

Save as `outputs/skill-embedding-probe.md`:

```markdown
---
name: embedding-probe
description: Inspect a word2vec model. Run analogies, find neighbors, diagnose quality.
version: 1.0.0
phase: 5
lesson: 03
tags: [nlp, embeddings, debugging]
---

You probe trained word embeddings to verify they are working. Given a `gensim.models.KeyedVectors` object and a vocabulary, you run:

1. Three canonical analogy tests. `king : man :: queen : woman`. `paris : france :: tokyo : japan`. `walking : walked :: swimming : ?`. Report the top-1 result and its cosine.
2. Five nearest-neighbor tests on domain-specific words the user supplies. Print top-5 neighbors with cosines.
3. One symmetry check. `similarity(a, b) == similarity(b, a)` to within float precision.
4. One degenerate check. If any embedding has a norm below 0.01 or above 100, the model has a training bug. Flag it.

Refuse to declare a model good on analogy accuracy alone. Analogy benchmarks are gameable and do not transfer to downstream tasks. Recommend intrinsic + downstream evaluation together.
```

## Exercises

1. **Easy.** Run the training loop on a tiny corpus (20 sentences about cats and dogs). After 200 epochs, verify `nearest(vocab, W, W[vocab["cat"]])` returns `dog` in its top 3. If not, increase epochs or vocabulary.
2. **Medium.** Add subsampling of frequent words. Words with frequency above `10^-5` are dropped from training pairs with probability proportional to their frequency. Measure the effect on rare-word similarity.
3. **Hard.** Train a model on the 20 Newsgroups corpus. Compute two bias axes: `he - she` and `doctor - nurse`. Project occupation words onto both axes. Report which occupations have the largest bias gap. This is the kind of probe fairness researchers use.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Word embedding | Word as a vector | A dense, low-dim (typically 100-300) representation learned from context. |
| Skip-gram | Word2Vec trick | Predict context words from center word. Slower than CBOW, better for rare words. |
| Negative sampling | Training shortcut | Replace softmax over full vocab with binary classification against `k` random words. |
| Static embedding | One vector per word | Same vector regardless of context. Fails on polysemy. |
| Contextual embedding | Context-sensitive vector | Different vector for each occurrence based on surrounding words. What transformers produce. |
| OOV | Out of vocabulary | Word not seen in training. Word2Vec cannot produce a vector for these. |

## Further Reading

- [Mikolov et al. (2013). Distributed Representations of Words and Phrases and their Compositionality](https://arxiv.org/abs/1310.4546) — the negative-sampling paper. Short and readable.
- [Rong, X. (2014). word2vec Parameter Learning Explained](https://arxiv.org/abs/1411.2738) — the clearest derivation of the gradients, if the original paper's math feels dense.
- [gensim Word2Vec tutorial](https://radimrehurek.com/gensim/models/word2vec.html) — production training settings that actually work.
