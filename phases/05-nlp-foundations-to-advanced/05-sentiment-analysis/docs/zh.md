# 情感分析

> 经典的 NLP 任务。关于经典文本分类你需要知道的大部分内容都在这里呈现。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 5 · 02（BoW + TF-IDF），阶段 2 · 14（Naive Bayes）
**时间：** ~75 分钟

## 问题

"The food was not great." 是正面还是负面？

情感听起来很简单。评论者说了他们喜欢或不喜欢某事物。给句子打标签。它成为经典 NLP 任务的原因是，每个看似简单的案例都隐藏着一个困难案例。否定翻转了含义。讽刺颠倒了它。"Not bad at all" 尽管有两个负面编码的词，却是正面的。Emoji 比周围文本携带更多信号。领域词汇很重要（`tight` 在音乐评论中与在时尚评论中不同）。

情感是经典 NLP 的工作实验室。如果你理解为什么每个朴素基线都有特定的失败模式，你就理解为什么每个更丰富的模型被发明出来。本课从零构建 Naive Bayes 基线，添加逻辑回归，并指出使生产级情感成为合规级问题的陷阱。

## 概念

经典情感分析是一个两步配方。

1. **表示。** 将文本转换为特征向量。BoW、TF-IDF 或 n-grams。
2. **分类。** 在标注样本上拟合线性模型（Naive Bayes、逻辑回归、SVM）。

Naive Bayes 是能工作的最简单的模型。假设在给定标签的情况下每个特征独立。从计数中估计 `P(word | positive)` 和 `P(word | negative)`。推理时，乘以概率。"naive" 的独立性假设错得离谱，但结果却惊人地强。原因：使用稀疏文本特征和中等数据时，分类器更关心每个词偏向哪一侧，而不是程度。

逻辑回归修复了独立性假设。它学习每个特征的权重，包括负权重。`not good` 作为一个 bigram 特征获得负权重。Naive Bayes 无法为它从未标记过的 bigram 做到这一点。

```figure
sentiment-logits
```

## 开始构建

### 第 1 步：一个真正的小型数据集

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

故意用小规模。实际工作使用数万个样本（IMDb、SST-2、Yelp polarity）。数学完全相同。

### 第 2 步：从零实现多项式 Naive Bayes

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

加法平滑（alpha=1.0）是 Laplace 平滑。没有它，在某个类别中未见过的词概率为零，log 会爆炸。`alpha=0.01` 在实践中很常见。`alpha=1.0` 是教学默认值。

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

L2 正则化在这里很重要。文本特征是稀疏的；没有 L2，模型会记忆训练样本。从 `0.01` 开始并调优。

### 第 4 步：处理否定（失败模式）

考虑 "not good" 和 "not bad"。一个 BoW 分类器看到 `{not, good}` 和 `{not, bad}`，并从训练中出现频率更高的一方学习。一个 bigram 分类器看到 `not_good` 和 `not_bad`，并将它们作为不同的特征学习。这通常就足够了。

当你没有 bigram 时可以用的更粗暴的修复：**否定作用域**。将否定词后的 token 添加 `NOT_` 前缀，直到下一个标点。

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

现在 `good` 和 `NOT_good` 是不同的特征。分类器可以对它们赋予相反的权重。三行预处理，在情感基准测试上可测量地提升准确率。

### 第 5 步：真正重要的评估指标

如果类别不平衡，仅靠准确率具有误导性。真实的情感语料库通常是 70-80% 正面或 70-80% 负面；一个恒定预测多数类的分类器能获得 80% 的准确率，但毫无价值。报告以下每一项：

- **每个类别的精确率和召回率。** 每个类别一对。对它们取宏平均，得到一个尊重类别平衡的单一数值。
- **宏平均 F1（不平衡数据的主要指标）。** 每个类别 F1 的均值，等权重。当类别不平衡时，用这个代替准确率。
- **加权平均 F1（替代方案）。** 与宏平均相同，但按类别频率加权。当不平衡本身具有业务意义时，与宏平均 F1 一起报告。
- **混淆矩阵。** 原始计数。在信任任何标量指标之前始终检查；它揭示了模型混淆了哪对类别。
- **每个类别的错误样本。** 每个类别拉取 5 个错误预测。阅读它们。没有什么可以替代阅读实际错误。

对于严重不平衡的数据（> 95-5 比例），报告 **AUROC** 和 **AUPRC** 而不是准确率。AUPRC 对少数类更敏感，这通常是你关心的（垃圾邮件、欺诈、罕见情感）。

**需要避免的常见错误。** 在不平衡数据上报告微平均 F1 而不是宏平均 F1，会得到一个看起来很high的数字，因为它被多数类主导了。宏平均 F1 迫使你看到少数类的表现。

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

## 使用现成工具

scikit-learn 用六行代码正确完成。

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

需要注意三件事。`stop_words=None` 保留否定词。`ngram_range=(1, 2)` 添加 bigram，使得 `not_good` 成为一个特征。`sublinear_tf=True` 抑制重复词。这三个标志是在 SST-2 上 75% 准确率基线与 85% 准确率基线之间的差异。

### 何时使用 transformer

- 讽刺检测。经典模型在这里会失败。句号。
- 长评论，情感在文档中间发生变化。
- 基于方面的情感。"Camera was great but battery was terrible." 你需要将情感归因于方面。仅限 transformer 或结构化输出模型。
- 非英语、低资源语言。多语言 BERT 免费为你提供零样本基线。

如果你需要以上任何一项，请跳到阶段 7（transformer 深入介绍）。否则，使用 TF-IDF 加 bigram 加否定处理的 Naive Bayes 或逻辑回归是你 2026 年的生产基线。

### 可复现性陷阱（再次强调）

重新训练情感模型是常规操作。重新评估它们则不是。论文中报告的准确率数字使用特定的划分、特定的预处理、特定的 tokenizer。如果你在没有使用完全相同 pipeline 的情况下将新模型与基线进行比较，你会得到误导性的差异。始终在你的 pipeline 上重新生成基线，而不是使用论文的数字。

## 交付

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

1. **简单。** 在 scikit-learn pipeline 中将 `apply_negation` 添加为预处理步骤，并在一个小型情感数据集上测量 F1 差值。
2. **中等。** 实现类别加权逻辑回归（向 scikit-learn 传递 `class_weight="balanced"`，或自行推导梯度）。在合成的 90-10 类别不平衡上测量效果。
3. **困难。** 通过在情感模型残差上训练第二个分类器来构建一个讽刺检测器。记录你的实验设置。当你的准确率低于随机水平时警告读者（二类讽刺的随机水平约为 50%，大多数首次尝试都在这个水平）。

## 关键术语

| 术语 | 人们说的意思 | 实际含义 |
|------|-----------------|-----------------------|
| Polarity | 正面或负面 | 二分类标签；有时扩展到中性或细粒度（5 星）。 |
| Aspect-based sentiment | 每个方面的极性 | 将情感归因于文本中提到的特定实体或属性。 |
| Negation scoping | 翻转附近 token | 在 "not" 之后将 token 添加 `NOT_` 前缀，直到标点。 |
| Laplace smoothing | 计数加 1 | 防止 Naive Bayes 中出现零概率特征。 |
| L2 regularization | 收缩权重 | 在损失中添加 `lambda * sum(w^2)`。对稀疏文本特征至关重要。 |

## 延伸阅读

- [Pang and Lee (2008). Opinion Mining and Sentiment Analysis](https://www.cs.cornell.edu/home/llee/opinion-mining-sentiment-analysis-survey.html) —— 基础性综述。很长，但前四节涵盖了所有经典内容。
- [Wang and Manning (2012). Baselines and Bigrams: Simple, Good Sentiment and Topic Classification](https://aclanthology.org/P12-2018/) —— 证明 bigram + Naive Bayes 在短文本上难以被击败的论文。
- [scikit-learn text feature extraction docs](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) —— `CountVectorizer`、`TfidfVectorizer` 以及你将调优的每个参数的参考文档。
