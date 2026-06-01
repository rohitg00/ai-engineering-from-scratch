# 05 · 情感分析

> 最经典的 NLP 任务。关于传统文本分类，你需要知道的大部分内容都会在这里出现。

**类型：** 实践构建
**语言：** Python
**前置：** 第 5 阶段 · 02（词袋 + TF-IDF）、第 2 阶段 · 14（朴素贝叶斯）
**时长：** 约 75 分钟

## 问题所在

"The food was not great."（这食物不咋样。）是正面还是负面？

情感分析听起来很简单：评论者表达了喜欢或不喜欢某样东西，给这句话打个标签即可。它之所以成为最经典的 NLP 任务，是因为每一个看似简单的案例背后都藏着一个棘手的情况。「否定（negation）」会反转含义。「反讽（sarcasm）」会颠倒它。"Not bad at all"（一点也不差）尽管含有两个带负面色彩的词，整体却是正面的。表情符号（emoji）携带的信号往往比周围文字更强。领域词汇也很关键（`tight` 在音乐评论里和在时尚评论里含义不同）。

情感分析是一个研究传统 NLP 的活实验室。如果你理解了为什么每一个朴素基线都有特定的失败模式，你就理解了为什么每一个更丰富的模型会被发明出来。本课将从零构建一个朴素贝叶斯基线，加入逻辑回归，并指出那些让生产环境中的情感分析变成合规级难题的陷阱。

## 核心概念

传统情感分析是一个两步配方。

1. **表示（Represent）。** 把文本转换成特征向量。词袋（BoW）、TF-IDF 或 n-gram。
2. **分类（Classify）。** 在带标签的样本上拟合一个线性模型（朴素贝叶斯、逻辑回归、SVM）。

朴素贝叶斯是「能用的最笨模型」。它假设给定标签后每个特征都相互独立，从计数中估计 `P(word | positive)` 与 `P(word | negative)`，在推理时把这些概率相乘。这个「朴素」的独立性假设错得离谱，结果却强得惊人。原因在于：在稀疏的文本特征和适中的数据量下，分类器关心的是每个词更偏向哪一边，而不是偏向多少。

逻辑回归修正了独立性假设。它为每个特征学习一个权重，包括负权重。作为二元组（bigram）特征的 `not good` 会得到一个负权重。朴素贝叶斯对于它从未标注过的二元组无法做到这一点。

## 动手构建

### 第 1 步：一个真实的迷你数据集

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

故意做得很小。真实工作会用到数万条样本（IMDb、SST-2、Yelp polarity）。数学原理完全相同。

### 第 2 步：从零实现多项式朴素贝叶斯

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

加性平滑（alpha=1.0）就是「拉普拉斯平滑（Laplace smoothing）」。没有它，某个在某类别中从未出现过的词概率为零，取对数后会爆炸。实践中 `alpha=0.01` 很常见；`alpha=1.0` 是教学默认值。

### 第 3 步：从零实现逻辑回归

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

「L2 正则化（L2 regularization）」在这里很关键。文本特征是稀疏的；没有 L2，模型会记住训练样本。从 `0.01` 起步并调优。

### 第 4 步：处理否定（这正是失败模式）

考虑 "not good"（不好）和 "not bad"（不坏）。词袋分类器看到的是 `{not, good}` 和 `{not, bad}`，会从训练中出现更多的那一项里学习。二元组分类器看到的是 `not_good` 和 `not_bad`，把它们当作不同的特征来学习。这通常就足够了。

当你没有二元组时，有一个更粗糙但有效的修法：**否定作用域划分（negation scoping）**。给否定词之后、直到下一个标点为止的词加上 `NOT_` 前缀。

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

现在 `good` 和 `NOT_good` 是不同的特征，分类器可以给它们相反的权重。三行预处理代码，就能在情感分析基准上带来可测量的准确率提升。

### 第 5 步：真正重要的评估指标

如果类别不平衡，单凭准确率会产生误导。真实的情感语料通常有 70-80% 是正面，或 70-80% 是负面；一个永远预测多数类的分类器能得到 80% 的准确率，却毫无价值。请报告以下每一项：

- **各类别的精确率（precision）与召回率（recall）。** 每个类别一对。对它们取宏平均（macro-average），得到一个尊重类别平衡的单一数值。
- **宏 F1（macro-F1，不平衡数据的首要指标）。** 各类别 F1 分数的均值，等权重。当类别不平衡时用它代替准确率。
- **加权 F1（weighted-F1，替代方案）。** 与宏 F1 相同，但按类别频率加权。当不平衡本身具有业务含义时，可与宏 F1 一并报告。
- **混淆矩阵（confusion matrix）。** 原始计数。在相信任何标量指标之前务必先查看它；它揭示了模型混淆的是哪一对类别。
- **各类别的错误样本。** 每个类别抽出 5 个预测错误的样本，读一读。没有什么能替代亲自阅读真实的错误。

对于严重不平衡的数据（比例超过 95-5），请报告 **AUROC** 和 **AUPRC** 而非准确率。AUPRC 对少数类更敏感，而少数类往往正是你关心的对象（垃圾信息、欺诈、稀有情感）。

**应避免的常见错误。** 在不平衡数据上报告微 F1（micro-F1）而非宏 F1，会给出一个看起来很高的数字，因为它被多数类主导了。宏 F1 会迫使你看到少数类的表现。

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

## 实际运用

scikit-learn 用六行代码就能正确完成。

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

注意三件事。`stop_words=None` 保留了否定词。`ngram_range=(1, 2)` 加入了二元组，让 `not_good` 成为一个特征。`sublinear_tf=True` 抑制了重复出现的词。在 SST-2 上，这三个开关就是 75% 准确率基线和 85% 准确率基线之间的区别。

### 何时该上 Transformer

- 反讽检测。传统模型在这里彻底失败，没有例外。
- 情感在文档中途发生转变的长篇评论。
- 「方面级情感分析（aspect-based sentiment）」。"Camera was great but battery was terrible."（相机很棒但电池很糟。）你需要把情感归因到具体的方面。只有 Transformer 或结构化输出模型才能胜任。
- 非英语的低资源语言。多语言 BERT 能免费给你一个零样本（zero-shot）基线。

如果你需要上述任何一项，可以直接跳到第 7 阶段（Transformer 深入剖析）。否则，在 TF-IDF 加二元组加否定处理之上跑朴素贝叶斯或逻辑回归，就是你 2026 年的生产基线。

### 可复现性陷阱（再次出现）

重新训练情感模型是家常便饭，重新评估它们却不是。论文中报告的准确率数字使用的是特定的数据划分、特定的预处理、特定的分词器。如果你在没有使用完全相同流水线的情况下把新模型与某个基线做对比，你得到的差值会产生误导。永远要在你自己的流水线上重新生成基线，而不是直接用论文里的数字。

## 交付物

保存为 `outputs/prompt-sentiment-baseline.md`：

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

## 练习

1. **简单。** 把 `apply_negation` 作为预处理步骤加入 scikit-learn 流水线，并在一个小型情感数据集上测量 F1 的变化量。
2. **中等。** 实现类别加权的逻辑回归（向 scikit-learn 传入 `class_weight="balanced"`，或者自己推导梯度）。在一个合成的 90-10 类别不平衡数据上测量其效果。
3. **困难。** 通过在情感模型的残差上训练第二个分类器来构建一个反讽检测器。记录你的实验设置。当你的准确率低于随机水平时要向读者发出警告（二分类反讽的随机水平约为 50%，而大多数初次尝试都落在那附近）。

## 关键术语

| 术语 | 人们常说 | 实际含义 |
|------|-----------------|-----------------------|
| 极性（Polarity） | 正面或负面 | 二元标签；有时扩展为中性或细粒度（5 星）。 |
| 方面级情感（Aspect-based sentiment） | 按方面给出极性 | 把情感归因到文本中提及的特定实体或属性。 |
| 否定作用域划分（Negation scoping） | 反转邻近的词 | 给 "not" 之后直到标点为止的词加上 `NOT_` 前缀。 |
| 拉普拉斯平滑（Laplace smoothing） | 给计数加 1 | 防止朴素贝叶斯中出现零概率特征。 |
| L2 正则化（L2 regularization） | 收缩权重 | 在损失中加入 `lambda * sum(w^2)`。对稀疏文本特征至关重要。 |

## 延伸阅读

- [Pang and Lee (2008). Opinion Mining and Sentiment Analysis](https://www.cs.cornell.edu/home/llee/opinion-mining-sentiment-analysis-survey.html) — 奠基性综述。篇幅很长，但前四节涵盖了传统方法的一切。
- [Wang and Manning (2012). Baselines and Bigrams: Simple, Good Sentiment and Topic Classification](https://aclanthology.org/P12-2018/) — 这篇论文证明了二元组 + 朴素贝叶斯在短文本上很难被超越。
- [scikit-learn 文本特征提取文档](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) — `CountVectorizer`、`TfidfVectorizer` 以及你将要调节的每一个旋钮的参考资料。
