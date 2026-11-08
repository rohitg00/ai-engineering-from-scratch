# Evidence: cheatsheets/word-embeddings.md

Abbreviations: P05 = phases/05-nlp-foundations-to-advanced. B = P05/02-bag-of-words-tfidf, W = P05/03-word-embeddings-word2vec, G = P05/04-glove-fasttext-subword. d = docs/en.md, c = code/main.py.

## Skip-gram with negative sampling (architecture, 5 nodes, 4 edges)
- one-hot(center) input over the vocabulary: W/d:29, 32
- W center table, the embedding you keep: W/d:29, 32-34, 71
- hidden d-dim, no nonlinearity: W/d:29, 32
- W' context table: W/d:32, 71
- sigmoid scores for 1 positive and k negatives: W/d:37, 88, 100-101
- dot product W[center] · W'[context]: W/d:88

## One training step: train_pair (flow, 6 steps)
1. skipgram_pairs over the window: W/c:22-29
2. k_neg negatives, center and context ids dropped: W/c:70-71
3. sigmoid(v_c @ u_pos) near 1, sigmoid(u_negs @ v_c) near 0: W/c:48-49, W/d:114
4. pos_err = sigmoid(...) - 1.0, neg_errs: W/c:48-49
5. W_prime rows updated with lr * err * v_c: W/c:52-54
6. W[c_idx] -= lr * grad_center: W/c:51, 55

## Tasks in code (task-table, 8 rows)
- bag_of_words(docs, vocab): B/c:21
- l2_normalize(tfidf(bow)): B/c:76
- train(docs, dim=16, window=2, k_neg=5, epochs=100, lr=0.05, seed=0): W/d:119
- analogy(vocab, W, "man", "king", "woman"): W/d:160-162, 168
- build_cooccurrence(docs, window=5): G/d:43
- glove_train(vocab, pair_counts, dim=16, epochs=100, lr=0.05, x_max=100, alpha=0.75, seed=0): G/d:60
- char_ngrams(word, n_min=3, n_max=6): G/d:89
- learn_bpe(corpus, k_merges=10), apply_bpe("lowest", merges): G/d:170-172

## Libraries in production (annotated-code, 9 lines)
- TfidfVectorizer fit_transform, IDF weighting and L2 normalization: B/d:158-159, 163
- Word2Vec(sentences, vector_size=100, window=5, min_count=1, sg=1, negative=5, workers=4, epochs=30): W/d:186-195
- model.wv.most_similar("cat", topn=3): W/d:198
- fasttext.util.download_model("en", if_exists="ignore"), fasttext.load_model("cc.en.300.bin"): G/d:185-186
- ft.get_word_vector("zoomerapproved"): G/d:188
- AutoTokenizer.from_pretrained("gpt2"), tok.tokenize("unbelievably tokenized"): G/d:196-197
- Ġ marks word boundaries: G/d:204

## Formulas (concepts, 8 bullets)
- TF-IDF = count/|d| · log(N/df): B/d:26-31
- smoothed IDF log((n+1)/(d+1)) + 1, every-doc word keeps IDF 1: B/c:40, B/d:98, 101
- cosine = dot product of L2-normalized vectors, 1 identical, 0 orthogonal: B/d:142, 260
- GloVe v_i · v_j + b_i + b_j ≈ log(X[i][j]): G/d:24
- weight (x/x_max)^alpha below x_max, else 1.0: G/d:70, 84
- W + W_tilde sum beats one table: G/d:81, 84
- FastText vector = sum of n-gram vectors: G/d:26, 103
- BPE vocabulary of k + 256 tokens: G/d:28

## Vectorizer knobs (command-table, 6 rows)
- ngram_range=(1, 2): B/d:169
- min_df=2: B/d:170
- max_df=0.95: B/d:171
- stop_words="english", not for sentiment: B/d:172
- sublinear_tf=True, 1 + log(tf): B/d:173
- get_feature_names_out: B/d:155, 242

## Tips (tips, 5 bullets)
- under 500 labeled examples, TF-IDF baseline first: B/d:234
- TF-IDF weighted embeddings below about 50k labeled examples: B/d:195, 214
- analogy accuracy alone is not enough: W/d:243
- download pretrained vectors: W/d:201, G/d:181
- 30k-100k merges in GPT / BERT / T5 tokenizers: G/d:177

## Defaults and numbers (defaults, 8 rows)
- vector_size 100, typical 100-300: W/d:188, 256
- gensim window 5, from-scratch window 2: W/d:189, W/c:22
- negative 5, k_neg=5: W/d:192, W/c:58
- sg 1 skip-gram, better on rare words: W/d:191, 27
- init rng.normal(0, 0.1, size=(vocab_size, dim)): W/d:79
- x_max 100, weight 1.0 at or above: G/d:60, 70
- alpha 0.75, downweights frequent pairs: G/d:60, 84
- n-grams 3 to 6 characters with < and > wrap: G/d:90, 103

## Troubleshooting (troubleshooting, 8 rows)
- "not good at all" vs "excellent", semantic blindness: B/d:184-189; bigrams: B/d:169
- Zoomer-approved OOV, subword embeddings: B/d:191, W/d:220, G/d:16
- bank polysemy, contextual embeddings: W/d:216-218
- long documents dominate without normalization: B/d:142
- stopwords carry negations in sentiment: B/d:172, 234
- norm below 0.01 or above 100 is a training bug: W/d:241
- tokenizer-model mismatch, never swap: G/d:212, 235
- stay sparse for 100k documents: B/d:163

## Abbreviations (glossary, 8 bullets)
- BoW counts, throws away order: B/d:22, 255
- TF and DF: B/d:256-257
- IDF downweights words that appear everywhere: B/d:258
- CBOW predict center from context: W/d:25
- Skip-gram predict context, became the default: W/d:24, 27
- GloVe Global Vectors, co-occurrence factorization: G/d:24, W/d:203
- OOV, Word2Vec/GloVe fail: G/d:253, W/d:261
- BPE merge most frequent adjacent pair: G/d:28, 252

## Questions (qa, 5 bullets)
- TF-IDF wins: spam, topic, logs, low data, latency, explainability: B/d:177-180
- softmax over 100k words too expensive, binary task: W/d:37
- king - man captures "royal": W/d:172
- FastText for misspellings / neologisms / rich morphology: G/d:211
- no custom tokenizer when fine-tuning a pretrained LLM: G/d:237
