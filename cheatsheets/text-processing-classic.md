---
id: text-processing-classic
title: Classic Text Processing and TF-IDF
code: CT
subtitle: Tokenize, stem, lemmatize, count, weight with TF-IDF, classify sentiment and find topics with LDA or BERTopic.
hue: 30
sources: phases/05-nlp-foundations-to-advanced/01-text-processing, phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf, phases/05-nlp-foundations-to-advanced/05-sentiment-analysis, phases/05-nlp-foundations-to-advanced/15-topic-modeling
source_hash: 8993666a55a0debd
---

## Classic text pipeline
type: flow
from: phases/05-nlp-foundations-to-advanced/01-text-processing/docs/en.md, phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf/docs/en.md, phases/05-nlp-foundations-to-advanced/05-sentiment-analysis/docs/en.md

1. **Tokenize**: split the string into word tokens. Keep punctuation as its own tokens.
2. **Stem or lemmatize**: stem for speed. Lemmatize with a POS tag when meaning matters.
3. **Negation scope**: prefix tokens after a negation word with `NOT_` up to punctuation.
4. **Count**: bag of words. One row per document, one column per vocabulary word.
5. **Weight**: TF-IDF scales down common words. L2 rows make cosine a dot product.
6. **Classify**: Naive Bayes for a baseline, logistic regression for production.
7. **Evaluate**: per-class precision and recall, macro-F1, confusion matrix.

## Tasks in code
type: task-table
span: 2
from: phases/05-nlp-foundations-to-advanced/01-text-processing/code/main.py, phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf/code/main.py, phases/05-nlp-foundations-to-advanced/05-sentiment-analysis/docs/en.md, phases/05-nlp-foundations-to-advanced/15-topic-modeling/code/main.py

| Task | Code |
|---|---|
| Tokenize, stem and lemmatize | `preprocess(text, pos_tagger=demo_pos_tagger)` |
| Porter step 1a | `stem_step_1a(word)` |
| Table lemmatizer with fallback | `lemmatize(word, pos)` |
| Count matrix | `bag_of_words(docs, build_vocab(docs))` |
| TF-IDF rows on the unit sphere | `l2_normalize(tfidf(bow))` |
| Scope negation | `apply_negation(tokens)` |
| Naive Bayes baseline | `train_nb(docs_by_class, vocab, alpha=1.0)` |
| LDA by collapsed Gibbs sampling | `collapsed_gibbs_lda(docs, n_topics=3, n_iters=300, seed=42)` |

## NLTK: tokens, stems, lemmas
type: annotated-code
lang: python
from: phases/05-nlp-foundations-to-advanced/01-text-processing/docs/en.md

```python
nltk.download("punkt_tab")
nltk.download("wordnet")
nltk.download("averaged_perceptron_tagger_eng")
tokens = word_tokenize(text)                      # contractions, Unicode
stems = [PorterStemmer().stem(t) for t in tokens] # all five phases
tagged = pos_tag(tokens)                          # Penn Treebank tags
lemmatizer = WordNetLemmatizer()
lemmas = [lemmatizer.lemmatize(t, nltk_pos_to_wordnet(tag)) for t, tag in tagged]  # V>v J>a R>r else n
```

## Sentiment baseline in scikit-learn
type: annotated-code
lang: python
from: phases/05-nlp-foundations-to-advanced/05-sentiment-analysis/docs/en.md

```python
pipe = Pipeline([
    ("tfidf", TfidfVectorizer(
        ngram_range=(1, 2),       # bigrams, so not_good is a feature
        min_df=2,
        sublinear_tf=True,        # dampens repeated words
        stop_words=None)),        # keeps negations
    ("clf", LogisticRegression(C=1.0, max_iter=1000)),
])
pipe.fit(X_train, y_train)
print(pipe.score(X_test, y_test))  # 75% to 85% on SST-2 with the 3 flags
```

## Vectorizer knobs
type: command-table
from: phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf/docs/en.md

| Command | What it does |
|---|---|
| `CountVectorizer()` | Tokenization, vocabulary and BoW in one call |
| `TfidfVectorizer()` | Adds IDF weighting and L2 normalization |
| `ngram_range=(1, 2)` | Includes bigrams. Usually boosts classification |
| `min_df=2` | Drops words in fewer than 2 docs |
| `max_df=0.95` | Drops words in more than 95% of docs |
| `stop_words="english"` | Builtin stopword list. Not for sentiment |
| `sublinear_tf=True` | Uses `1 + log(tf)` instead of raw `tf` |
| `get_feature_names_out()` | Lists the vocabulary in column order |

## Topic models
type: annotated-code
lang: python
from: phases/05-nlp-foundations-to-advanced/15-topic-modeling/docs/en.md

```python
cv = CountVectorizer(max_features=max_features, stop_words="english",
                     min_df=2, max_df=0.9)   # LDA needs raw counts
X = cv.fit_transform(documents)
lda = LatentDirichletAllocation(n_components=n_topics, random_state=42,
                                max_iter=50, learning_method="online")
doc_topic = lda.fit_transform(X)           # (n_docs, n_topics), rows sum to 1
topic_model = BERTopic(
    embedding_model="sentence-transformers/all-MiniLM-L6-v2",
    min_topic_size=15)                     # library default is 10
topics, probs = topic_model.fit_transform(documents)
info = topic_model.get_topic_info()       # Topic -1 is the outlier bucket
```

## Formulas
type: concepts
from: phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf/docs/en.md, phases/05-nlp-foundations-to-advanced/05-sentiment-analysis/docs/en.md, phases/05-nlp-foundations-to-advanced/15-topic-modeling/docs/en.md

- **TF-IDF**: $\frac{\mathrm{count}(w \text{ in } d)}{|d|} \cdot \log\frac{N}{\mathrm{df}(w)}$
- **Smoothed IDF**: $\log\frac{n + 1}{d + 1} + 1$. A word in every doc keeps IDF 1.
- **L2 row**: divide each row by its norm. Long docs stop dominating.
- **Naive Bayes**: log prior plus the sum of log $P(\text{word} \mid \text{class})$. Take the max.
- **Laplace**: $(\mathrm{count} + \alpha) / (\mathrm{total} + \alpha |V|)$. No zero probabilities.
- **Logistic regression**: sigmoid of $Xw + b$. Predict 1 at 0.5 or more.
- **Macro-F1**: mean of per-class F1, equally weighted.
- **c_v coherence**: NPMI of top-word pairs, compared by cosine. Higher is better.

## Defaults
type: defaults
from: phases/05-nlp-foundations-to-advanced/05-sentiment-analysis/docs/en.md, phases/05-nlp-foundations-to-advanced/15-topic-modeling/docs/en.md, phases/05-nlp-foundations-to-advanced/15-topic-modeling/code/main.py

| Setting | Default | Note |
|---|---|---|
| NB `alpha` | 1.0 | Teaching default. 0.01 is common in practice |
| LR `l2` | 0.01 | Start here and tune. Sparse features overfit |
| LR `epochs`, `lr` | 500 | Learning rate 0.05 |
| LR `C` | 1.0 | With `max_iter=1000` in scikit-learn |
| BERTopic `min_topic_size` | 10 | Use 50 or 100 over 10,000 docs |
| Gibbs `alpha`, `beta` | 0.1 | Beta is 0.01. Both must be positive |
| Gibbs `n_iters` | 200 | The demo runs 300 |
| Topic count | `max(5, round(sqrt(n_docs)))` | Clamp to 200 under 40,000 docs |

## Troubleshooting
type: troubleshooting
from: phases/05-nlp-foundations-to-advanced/01-text-processing/docs/en.md, phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf/docs/en.md, phases/05-nlp-foundations-to-advanced/05-sentiment-analysis/docs/en.md, phases/05-nlp-foundations-to-advanced/15-topic-modeling/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Accuracy drops after deploy | Training and inference preprocess differ | Ship one preprocess function in the model |
| Tokens change after an upgrade | Library version drift | Pin versions. Freeze 20 sample sentences |
| `ponies` stems to `poni` | Step 1a `ies` rule only | Use full Porter with step 1b |
| `watched` stays `watched` | Lemma table has no `ed` rule | Use WordNet or spaCy |
| "not good" reads positive | Stopword list drops negations | `stop_words=None` plus bigrams |
| High score, bad minority class | Micro-F1 or accuracy on imbalance | Report macro-F1, AUPRC over 95-5 |
| LDA junk topics | Stopwords and frequent terms | Set `min_df` and `max_df` |
| Many docs in topic -1 | HDBSCAN outlier bucket | Check `min_topic_size`, read the -1 docs |

## Use X when
type: qa
from: phases/05-nlp-foundations-to-advanced/01-text-processing/docs/en.md, phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf/docs/en.md, phases/05-nlp-foundations-to-advanced/05-sentiment-analysis/docs/en.md, phases/05-nlp-foundations-to-advanced/15-topic-modeling/docs/en.md

- **Stem or lemmatize?** Stem for search indexing. Lemmatize for text the user reads.
- **NLTK or spaCy?** NLTK to teach and swap parts. spaCy for production speed.
- **TF-IDF or embeddings?** TF-IDF for spam, logs, low data and explainable models.
- **When a transformer?** Sarcasm, aspects, sentiment shifts and low-resource languages.
- **LDA or BERTopic?** LDA for long docs with topic mixtures. BERTopic for short text.
- **No GPU?** Use LDA or NMF.

## Tips
type: tips
from: phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf/docs/en.md, phases/05-nlp-foundations-to-advanced/05-sentiment-analysis/docs/en.md, phases/05-nlp-foundations-to-advanced/15-topic-modeling/docs/en.md

- Stay sparse. Dense TF-IDF for 100k documents does not fit in memory.
- Read 5 wrong predictions per class before you trust a metric.
- Regenerate the baseline on your own pipeline, not the paper's number.
