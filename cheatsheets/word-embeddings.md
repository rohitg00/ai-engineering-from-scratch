---
id: word-embeddings
title: Word2Vec, GloVe and FastText
code: WG
subtitle: Count words, weight them with TF-IDF, train dense vectors and split rare words into subwords. Python from the lessons.
hue: 25
sources: phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf, phases/05-nlp-foundations-to-advanced/03-word-embeddings-word2vec, phases/05-nlp-foundations-to-advanced/04-glove-fasttext-subword
source_hash: 0383ae27ed824c5a
---

## Skip-gram with negative sampling
type: architecture
from: phases/05-nlp-foundations-to-advanced/03-word-embeddings-word2vec/docs/en.md

```arch
node | in | 1,1 | one-hot(center) | vocab size | client
node | w | 2,1 | W | center table, kept | store
node | h | 3,1 | hidden | d-dim, no nonlinearity | process
node | wp | 2,2 | W' | context table | store
node | out | 4,1 | sigmoid scores | 1 positive, k negatives | model
edge | in | w |
edge | w | h | lookup
edge | h | out | dot product
edge | wp | out | u_pos, u_negs
```

## One training step: train_pair
type: flow
from: phases/05-nlp-foundations-to-advanced/03-word-embeddings-word2vec/code/main.py, phases/05-nlp-foundations-to-advanced/03-word-embeddings-word2vec/docs/en.md

1. **Pairs**: `skipgram_pairs` emits every (center, context) pair inside `window`.
2. **Negatives**: draw `k_neg` random ids. Drop the center and the context id.
3. **Scores**: `sigmoid(v_c @ u_pos)` should be near 1. `sigmoid(u_negs @ v_c)` near 0.
4. **Errors**: `pos_err` is the positive score minus 1.0. `neg_errs` are the negative scores.
5. **Update W'**: subtract `lr` times error times `v_c` for each context row.
6. **Update W**: subtract `lr * grad_center` from the center row.

## Tasks in code
type: task-table
span: 2
from: phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf/code/main.py, phases/05-nlp-foundations-to-advanced/03-word-embeddings-word2vec/docs/en.md, phases/05-nlp-foundations-to-advanced/04-glove-fasttext-subword/docs/en.md

| Task | Code |
|---|---|
| Count matrix | `bag_of_words(docs, vocab)` |
| Unit-length TF-IDF rows | `l2_normalize(tfidf(bow))` |
| Train skip-gram from scratch | `train(docs, dim=16, window=2, k_neg=5, epochs=100, lr=0.05, seed=0)` |
| Analogy query | `analogy(vocab, W, "man", "king", "woman")` |
| Co-occurrence counts | `build_cooccurrence(docs, window=5)` |
| Train GloVe | `glove_train(vocab, pair_counts, dim=16, epochs=100, lr=0.05, x_max=100, alpha=0.75, seed=0)` |
| FastText n-grams | `char_ngrams(word, n_min=3, n_max=6)` |
| Learn and apply BPE | `apply_bpe("lowest", learn_bpe(corpus, k_merges=10))` |

## Libraries in production
type: annotated-code
lang: python
from: phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf/docs/en.md, phases/05-nlp-foundations-to-advanced/03-word-embeddings-word2vec/docs/en.md, phases/05-nlp-foundations-to-advanced/04-glove-fasttext-subword/docs/en.md

```python
tfidf = TfidfVectorizer().fit_transform(docs)  # IDF weights plus L2 norm
model = Word2Vec(sentences, vector_size=100, window=5,
                 min_count=1, sg=1, negative=5, workers=4, epochs=30)
model.wv.most_similar("cat", topn=3)           # nearest neighbours
fasttext.util.download_model("en", if_exists="ignore")
ft = fasttext.load_model("cc.en.300.bin")
ft.get_word_vector("zoomerapproved")           # OOV word still gets a vector
tok = AutoTokenizer.from_pretrained("gpt2")
tok.tokenize("unbelievably tokenized")         # Ġ marks a word boundary
```

## Formulas
type: concepts
from: phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf/docs/en.md, phases/05-nlp-foundations-to-advanced/04-glove-fasttext-subword/docs/en.md

- **TF-IDF**: $\frac{\mathrm{count}(w \text{ in } d)}{|d|} \cdot \log\frac{N}{\mathrm{df}(w)}$
- **Smoothed IDF**: $\log\frac{n+1}{d+1} + 1$. A word in every doc keeps IDF 1.
- **Cosine**: dot product of L2-normalized rows. 1 is identical, 0 is orthogonal.
- **GloVe fit**: $v_i \cdot v_j + b_i + b_j \approx \log X_{ij}$
- **GloVe weight**: $f(x) = (x / x_{max})^{\alpha}$ below `x_max`, else 1.0.
- **GloVe output**: `W + W_tilde`. The sum beats one table alone.
- **FastText vector**: the sum of the vectors of the word's character n-grams.
- **BPE vocabulary**: `k + 256` tokens after `k` merges.

## Vectorizer knobs
type: command-table
from: phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf/docs/en.md

| Command | What it does |
|---|---|
| `ngram_range=(1, 2)` | Adds bigrams. Usually helps classification |
| `min_df=2` | Drops words in fewer than 2 docs |
| `max_df=0.95` | Drops words in more than 95% of docs |
| `stop_words="english"` | Built-in stopword list. Not for sentiment |
| `sublinear_tf=True` | Uses `1 + log(tf)` for repeated terms |
| `get_feature_names_out` | Lists the vocabulary columns |

## Defaults and numbers
type: defaults
from: phases/05-nlp-foundations-to-advanced/03-word-embeddings-word2vec/docs/en.md, phases/05-nlp-foundations-to-advanced/04-glove-fasttext-subword/docs/en.md

| Setting | Default | Note |
|---|---|---|
| gensim `vector_size` | 100 | Dense vectors are typically 100-300 |
| gensim `window` | 5 | The from-scratch code uses 2 |
| `negative`, `k_neg` | 5 | Negatives for each positive pair |
| `sg` | 1 | Skip-gram. Better for rare words |
| Init std | 0.1 | `rng.normal(0, 0.1, size=(vocab_size, dim))` |
| GloVe `x_max` | 100 | Pairs at or above it get weight 1.0 |
| GloVe `alpha` | 0.75 | Downweights frequent pairs |
| FastText n-gram length | 3 to 6 | Characters, with `<` and `>` marks |

## Troubleshooting
type: troubleshooting
from: phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf/docs/en.md, phases/05-nlp-foundations-to-advanced/03-word-embeddings-word2vec/docs/en.md, phases/05-nlp-foundations-to-advanced/04-glove-fasttext-subword/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| "not good" and "excellent" look alike | BoW drops word order | Add bigrams or use embeddings |
| `Zoomer-approved` has no vector | OOV in BoW and Word2Vec | Use FastText or BPE |
| `bank` has one vector for two senses | Static embedding | Use contextual embeddings |
| Long docs dominate similarity | Rows not normalized | Apply `l2_normalize` |
| Negation signal lost | Stopword removal | Keep stopwords for sentiment |
| Norm below 0.01 or above 100 | Training bug | Flag the model |
| Silent bad production output | Tokenizer and model mismatch | Use the tokenizer the model shipped with |
| Dense 100k-doc matrix does not fit | Dense conversion too early | Stay sparse |

## Abbreviations
type: glossary
from: phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf/docs/en.md, phases/05-nlp-foundations-to-advanced/03-word-embeddings-word2vec/docs/en.md, phases/05-nlp-foundations-to-advanced/04-glove-fasttext-subword/docs/en.md

- **BoW**: Bag of Words. Counts of vocabulary words. Order is lost.
- **TF / DF**: term frequency in a doc, and the count of docs with the word.
- **IDF**: inverse document frequency. Downweights words that occur everywhere.
- **CBOW**: Continuous Bag of Words. Predict the center from its context.
- **Skip-gram**: predict the context from the center. The default.
- **GloVe**: Global Vectors. Factorizes the co-occurrence matrix.
- **OOV**: Out of vocabulary. Word2Vec and GloVe fail on it.
- **BPE**: Byte-Pair Encoding. Merge the most frequent adjacent pair, repeat.

## Questions
type: qa
from: phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf/docs/en.md, phases/05-nlp-foundations-to-advanced/03-word-embeddings-word2vec/docs/en.md, phases/05-nlp-foundations-to-advanced/04-glove-fasttext-subword/docs/en.md

- **When does TF-IDF still win?** Spam, topics, logs, low data, tight latency, explainable output.
- **Why negative sampling?** Softmax over 100k words is too slow. A binary task replaces it.
- **Why does an analogy work?** `(king - man)` holds a "royal" direction. Add it to `woman`.
- **GloVe or FastText?** FastText for misspellings, new words and rich morphology.
- **Train a tokenizer for fine-tuning?** No. Use the tokenizer of the pretrained model.

## Tips
type: tips
from: phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf/docs/en.md, phases/05-nlp-foundations-to-advanced/03-word-embeddings-word2vec/docs/en.md, phases/05-nlp-foundations-to-advanced/04-glove-fasttext-subword/docs/en.md

- Under 500 labeled examples, start with a TF-IDF baseline.
- Below about 50k labels, try TF-IDF weighted embeddings.
- Do not judge embeddings on analogy accuracy alone. Add a downstream test.
- Download pretrained vectors. You almost never train Word2Vec yourself.
- GPT, BERT and T5 tokenizers learn 30k-100k merges.
