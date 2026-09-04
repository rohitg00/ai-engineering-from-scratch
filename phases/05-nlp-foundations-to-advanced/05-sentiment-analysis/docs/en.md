# Sentiment Analysis

> The canonical NLP task. Most of what you need to know about classical text classification shows up here.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 2 · 14 (Naive Bayes)
**Time:** ~75 minutes

## The Problem

"The food was not great." Positive or negative?

Sentiment sounds simple. A reviewer said they liked or did not like something. Label the sentence. The reason it became the canonical NLP task is that every easy-looking case hides a hard one. Negation flips meaning. Sarcasm inverts it. "Not bad at all" is positive despite two negative-coded words. Emojis carry more signal than surrounding text. Domain vocabulary matters (`tight` in music review versus `tight` in fashion review).

Sentiment is a working lab for classical NLP. If you understand why every naive baseline has a specific failure mode, you understand why every richer model was invented. This lesson builds a Naive Bayes baseline from scratch, adds logistic regression, and names the traps that make production sentiment a compliance-grade problem.

## The Concept

Classical sentiment is a two-step recipe.

1. **Represent.** Turn the text into a feature vector. BoW, TF-IDF, or n-grams.
2. **Classify.** Fit a linear model (Naive Bayes, logistic regression, SVM) on labeled examples.

Naive Bayes is the dumbest model that works. Assume every feature is independent given the label. Estimate `P(word | positive)` and `P(word | negative)` from counts. At inference, multiply the probabilities. The "naive" independence assumption is laughably wrong and yet the results are shockingly strong. The reason: with sparse text features and moderate data, the classifier cares about which side each word leans toward more than how much.

Logistic regression fixes the independence assumption. It learns a weight per feature, including negative weights. `not good` as a bigram feature gets a negative weight. Naive Bayes cannot do that for bigrams it has never labeled.

```figure
sentiment-logits
```

## Build It

### Step 1: a real mini-dataset

```python
POSITIVE = [
    "absolutely loved this movie",
    "beautiful cinematography and a great story",
    "one of the best films of the year",
    "brilliant acting from the lead",
    "heartwarming and funny",
]

NEGATIVE = [
    "boring and far too long",
    "not worth your time",
    "the plot made no sense",
    "terrible acting, awful script",
    "i want my two hours back",
]
```

Small on purpose. Real work uses tens of thousands of examples (IMDb, SST-2, Yelp polarity). The math is identical.

### Step 2: multinomial Naive Bayes from scratch

```python
import math
from collections import Counter


def train_nb(docs_by_class, vocab, alpha=1.0):
    class_priors = {}
    class_word_probs = {}
    total_docs = sum(len(d) for d in docs_by_class.values())

    for cls, docs in docs_by_class.items():
        class_priors[cls] = len(docs) / total_docs
        counts = Counter()
        for doc in docs:
            for token in doc:
                counts[token] += 1
        total = sum(counts.values()) + alpha * len(vocab)
        class_word_probs[cls] = {
            w: (counts[w] + alpha) / total for w in vocab
        }
    return class_priors, class_word_probs


def predict_nb(doc, class_priors, class_word_probs):
    scores = {}
    for cls in class_priors:
        s = math.log(class_priors[cls])
        for token in doc:
            if token in class_word_probs[cls]:
                s += math.log(class_word_probs[cls][token])
        scores[cls] = s
    return max(scores, key=scores.get)
```

Additive smoothing (alpha=1.0) is Laplace smoothing. Without it, a word unseen in a class has probability zero and the log explodes. `alpha=0.01` is common in practice. `alpha=1.0` is the teaching default.

### Step 3: logistic regression from scratch

```python
import numpy as np


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -20, 20)))


def train_lr(X, y, epochs=500, lr=0.05, l2=0.01):
    n_features = X.shape[1]
    w = np.zeros(n_features)
    b = 0.0
    for _ in range(epochs):
        logits = X @ w + b
        preds = sigmoid(logits)
        err = preds - y
        grad_w = X.T @ err / len(y) + l2 * w
        grad_b = err.mean()
        w -= lr * grad_w
        b -= lr * grad_b
    return w, b


def predict_lr(X, w, b):
    return (sigmoid(X @ w + b) >= 0.5).astype(int)
```

L2 regularization matters here. Text features are sparse; without L2 the model memorizes training examples. Start at `0.01` and tune.

### Step 4: handling negation (the failure mode)

Consider "not good" and "not bad". A BoW classifier sees `{not, good}` and `{not, bad}` and learns from whichever showed up more in training. A bigram classifier sees `not_good` and `not_bad` and learns them as distinct features. That is usually enough.

A cruder fix that works when you do not have bigrams: **negation scoping**. Prefix tokens following a negation word with `NOT_` up to the next punctuation.

```python
NEGATION_WORDS = {"not", "no", "never", "nor", "none", "nothing", "neither"}
NEGATION_TERMINATORS = {".", "!", "?", ",", ";"}


def apply_negation(tokens):
    out = []
    negate = False
    for token in tokens:
        if token in NEGATION_TERMINATORS:
            negate = False
            out.append(token)
            continue
        if token in NEGATION_WORDS:
            negate = True
            out.append(token)
            continue
        out.append(f"NOT_{token}" if negate else token)
    return out
```

```python
>>> apply_negation(["not", "good", "at", "all", ".", "but", "funny"])
['not', 'NOT_good', 'NOT_at', 'NOT_all', '.', 'but', 'funny']
```

Now `good` and `NOT_good` are different features. The classifier can weight them opposite. Three lines of preprocessing, measurable accuracy jump on sentiment benchmarks.

### Step 5: evaluation metrics that matter

Accuracy alone is misleading if classes are imbalanced. Real sentiment corpora are usually 70-80% positive or 70-80% negative; a constant-majority classifier gets 80% accuracy and is worthless. Report every one of the following:

- **Per-class precision and recall.** One pair per class. Macro-average them to get a single number that respects class balance.
- **Macro-F1 (primary metric for imbalanced data).** Mean of per-class F1 scores, equally weighted. Use this instead of accuracy when classes are imbalanced.
- **Weighted-F1 (alternative).** Same as macro but weighted by class frequency. Report alongside macro-F1 when the imbalance itself has business meaning.
- **Confusion matrix.** Raw counts. Always inspect before trusting any scalar metric; it reveals which pair of classes the model confuses.
- **Per-class error samples.** Pull 5 wrong predictions per class. Read them. Nothing replaces reading the actual errors.

For severely imbalanced data (> 95-5 ratio), report **AUROC** and **AUPRC** instead of accuracy. AUPRC is more sensitive to the minority class, which is what you usually care about (spam, fraud, rare sentiment).

**Common bug to avoid.** Reporting micro-F1 instead of macro-F1 on imbalanced data gives a number that looks high because it is dominated by the majority class. Macro-F1 forces you to see the minority-class performance.

```python
def evaluate(y_true, y_pred):
    tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
    tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)
    precision = tp / (tp + fp) if tp + fp else 0
    recall = tp / (tp + fn) if tp + fn else 0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0
    return {"tp": tp, "fp": fp, "tn": tn, "fn": fn, "precision": precision, "recall": recall, "f1": f1}
```

## Use It

scikit-learn does it in six lines, correctly.

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

pipe = Pipeline([
    ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True, stop_words=None)),
    ("clf", LogisticRegression(C=1.0, max_iter=1000)),
])
pipe.fit(X_train, y_train)
print(pipe.score(X_test, y_test))
```

Three things to notice. `stop_words=None` keeps negations. `ngram_range=(1, 2)` adds bigrams so `not_good` becomes a feature. `sublinear_tf=True` dampens repeated words. These three flags are the difference between a 75%-accurate baseline and an 85%-accurate baseline on SST-2.

### When to reach for a transformer

- Sarcasm detection. Classical models fail here. Period.
- Long reviews where sentiment shifts mid-document.
- Aspect-based sentiment. "Camera was great but battery was terrible." You need to attribute sentiment to aspects. Transformers or structured output models only.
- Non-English, low-resource languages. Multilingual BERT gives you a zero-shot baseline for free.

If you need any of the above, skip ahead to phase 7 (transformers deep dive). Otherwise, Naive Bayes or logistic regression on TF-IDF plus bigrams plus negation handling is your 2026 production baseline.

### The reproducibility trap (again)

Retraining sentiment models is routine. Re-evaluating them is not. Accuracy numbers reported in papers use specific splits, specific preprocessing, specific tokenizers. If you compare your new model to a baseline without using the identical pipeline, you will get misleading deltas. Always regenerate the baseline on your pipeline, not the paper's number.

## Ship It

Save as `outputs/prompt-sentiment-baseline.md`:

```markdown
---
name: sentiment-baseline
description: Design a sentiment analysis baseline for a new dataset.
phase: 5
lesson: 05
---

Given a dataset description (domain, language, size, label granularity, latency budget), you output:

1. Feature extraction recipe. Specify tokenizer, n-gram range, stopword policy (usually keep), negation handling (scoped prefix or bigrams).
2. Classifier. Naive Bayes for baseline, logistic regression for production, transformer only if the domain needs sarcasm / aspects / cross-lingual.
3. Evaluation plan. Report precision, recall, F1, confusion matrix, and per-class error samples (not just scalars).
4. One failure mode to monitor post-deployment. Domain drift and sarcasm are the top two.

Refuse to recommend dropping stopwords for sentiment tasks. Refuse to report accuracy as the sole metric when classes are imbalanced (e.g., 90% positive). Flag subword-rich languages as needing FastText or transformer embeddings over word-level TF-IDF.
```

## Exercises

1. **Easy.** Add `apply_negation` as a preprocessing step in the scikit-learn pipeline and measure the F1 delta on a small sentiment dataset.
2. **Medium.** Implement class-weighted logistic regression (pass `class_weight="balanced"` to scikit-learn, or derive the gradient yourself). Measure the effect on a synthetic 90-10 class imbalance.
3. **Hard.** Build a sarcasm detector by training a second classifier on the residuals of the sentiment model. Document your experimental setup. Warn the reader when your accuracy is below chance (chance-level on 2-class sarcasm is ~50%, and most first attempts land there).

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Polarity | Positive or negative | Binary label; sometimes extended to neutral or fine-grained (5-star). |
| Aspect-based sentiment | Per-aspect polarity | Attribute sentiment to specific entities or attributes mentioned in text. |
| Negation scoping | Reversing nearby tokens | Prefix tokens after "not" with `NOT_` until punctuation. |
| Laplace smoothing | Adding 1 to counts | Prevents zero-probability features in Naive Bayes. |
| L2 regularization | Shrinking weights | Adds `lambda * sum(w^2)` to loss. Essential for sparse text features. |

## Further Reading

- [Pang and Lee (2008). Opinion Mining and Sentiment Analysis](https://www.cs.cornell.edu/home/llee/opinion-mining-sentiment-analysis-survey.html) — the foundational survey. Long, but the first four sections cover everything classical.
- [Wang and Manning (2012). Baselines and Bigrams: Simple, Good Sentiment and Topic Classification](https://aclanthology.org/P12-2018/) — the paper that showed bigrams + Naive Bayes is hard to beat on short text.
- [scikit-learn text feature extraction docs](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) — reference for `CountVectorizer`, `TfidfVectorizer`, and every knob you'll tune.
