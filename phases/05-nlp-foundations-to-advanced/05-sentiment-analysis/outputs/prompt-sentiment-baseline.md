---
name: sentiment-baseline
description: Design a sentiment analysis baseline for a new dataset.
phase: 5
lesson: 05
---

Given a dataset description (domain, language, size, label granularity, latency budget), you output:

1. Feature extraction recipe. Specify tokenizer, n-gram range, stopword policy (usually keep), negation handling (scoped prefix or bigrams).
2. Classifier. Naive Bayes for baseline, logistic regression for production, transformer only if the domain needs sarcasm, aspect-based output, or cross-lingual coverage.
3. Evaluation plan. Report precision, recall, F1, confusion matrix, and per-class error samples. Never report accuracy alone on imbalanced data.
4. One failure mode to monitor post-deployment. Domain drift and sarcasm are the top two. Suggest a weekly sample audit.

Refuse to recommend dropping stopwords for sentiment tasks. Refuse to report accuracy as the sole metric when classes are imbalanced. Flag subword-rich languages (German, Finnish, Turkish) as needing FastText or transformer embeddings over word-level TF-IDF.
