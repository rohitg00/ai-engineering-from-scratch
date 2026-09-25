# 情感分析

> 经典的 NLP 任务。关于传统文本分类你需要知道的大部分内容都会在这里出现。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 02（BoW + TF-IDF）、Phase 2 · 14（Naive Bayes）
**Time:** 约 75 分钟

## 问题所在

“这食物还不错。”——正面还是负面？

情感分析听起来很简单。评论者表示他们喜欢或不喜欢某样东西。给句子贴标签即可。它之所以成为经典 NLP 任务，是因为每个看似简单的案例背后都隐藏着一个难题。否定会翻转语义。讽刺会颠倒语义。“一点都不差”尽管含有两个负面编码的词，却是正面的。Emoji 比周围的文本携带更多信号。领域词汇很重要（音乐评论中的 `tight` 与时尚评论中的 `tight`）。

情感分析是传统 NLP 的实训场。如果你理解为什么每个朴素的基线方法都有特定的失效模式，你就能理解为什么发明了每一个更丰富的模型。本课从零构建 Naive Bayes 基线，加入逻辑回归，并指出使生产环境中的情感分析成为合规级问题的陷阱。

## 核心概念

传统情感分析是一个两步流程。

1. **表示。** 将文本转换为特征向量。BoW、TF-IDF 或 n-gram。
2. **分类。** 在带标签的样本上拟合线性模型（Naive Bayes、逻辑回归、SVM）。

Naive Bayes 是能用的最笨的模型。假设每个特征在给定标签的条件下相互独立。从计数中估计 `P(word | positive)` 和 `P(word | negative)`。推理时，将概率相乘。“朴素”的独立性假设错得离谱，但结果却出奇地好。原因在于：面对稀疏的文本特征和适中的数据量，分类器关心的是每个词倾向于哪一边，而不是倾向的程度。

逻辑回归修正了独立性假设。它为每个特征学习一个权重，包括负权重。作为 bigram 特征的 `not good` 会得到负权重。Naive Bayes 无法对从未标注过的 bigram 做到这一点。

```figure
sentiment-logits
```

## 动手实现

### 步骤 1：一个真实的小型数据集

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

规模小是有意为之。实际工作会使用数万个样本（IMDb、SST-2、Yelp polarity）。数学原理完全相同。

### 步骤 2：从零实现多项式 Naive Bayes

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

加法平滑（alpha=1.0）就是 Laplace 平滑。没有它，一个在某类别中未见过的词概率为零，对数会爆炸。实践中常用 `alpha=0.01`。`alpha=1.0` 是教学中的默认值。

### 步骤 3：从零实现逻辑回归

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

L2 正则化在这里至关重要。文本特征是稀疏的；没有 L2，模型会记住训练样本。从 `0.01` 开始，然后再调优。

### 步骤 4：处理否定（失效模式）

考虑“not good”和“not bad”。BoW 分类器看到的是 `{not, good}` 和 `{not, bad}`，并从训练中出现次数更多的那个学习。bigram 分类器看到的是 `not_good` 和 `not_bad`，并将它们作为不同的特征来学习。这通常就足够了。

当你没有 bigram 时，一个更粗糙但可行的修复方法是**否定作用域**。给否定词之后的词元加上 `NOT_` 前缀，直到下一个标点。

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

现在 `good` 和 `NOT_good` 是不同的特征。分类器可以给它们相反的权重。三行预处理代码，在情感基准上带来可衡量的准确率提升。

### 步骤 5：真正重要的评估指标

如果类别不平衡，单靠准确率会产生误导。真实的情感语料库通常有 70-80% 正面或 70-80% 负面；一个恒定多数类分类器能获得 80% 的准确率，却毫无价值。请报告以下每一项：

- **每类精确率和召回率。** 每个类别一对。对它们取宏平均，得到一个尊重类别平衡的单一数值。
- **Macro-F1（不平衡数据的主要指标）。** 每类 F1 分数的均值，等权计算。当类别不平衡时用它代替准确率。
- **Weighted-F1（备选）。** 与 macro 相同，但按类别频率加权。当不平衡本身具有业务意义时，与 macro-F1 一并报告。
- **混淆矩阵。** 原始计数。在信任任何标量指标之前务必检查它；它能揭示模型混淆的是哪一对类别。
- **每类错误样本。** 每个类别抽取 5 个错误预测。逐一阅读。没有什么能替代阅读实际错误。

对于严重不平衡的数据（> 95-5 的比例），报告 **AUROC** 和 **AUPRC** 而不是准确率。AUPRC 对少数类更敏感，而这通常正是你关心的（垃圾邮件、欺诈、稀有情感）。

**要避免的常见错误。** 在不平衡数据上报告 micro-F1 而非 macro-F1 会得到一个看似很高的数值，因为它被多数类主导。Macro-F1 迫使你看到少数类的表现。

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

## 使用它

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

需要注意三点。`stop_words=None` 保留否定。`ngram_range=(1, 2)` 加入 bigram，使 `not_good` 成为特征。`sublinear_tf=True` 抑制重复词。这三个标志就是 SST-2 上 75% 准确率基线与 85% 准确率基线之间的差别。

### 何时转向 Transformer

- 讽刺检测。传统模型在这里会失败。没有例外。
- 情感在文档中途发生转变的长评论。
- 基于方面的情感分析。“相机很棒但电池很糟糕。”你需要将情感归因于特定方面。只有 Transformer 或结构化输出模型能做到。
- 非英语、低资源语言。Multilingual BERT 免费为你提供零样本基线。

如果你需要以上任何一项，直接跳到第 7 阶段（Transformer 深入探讨）。否则，在 TF-IDF 加 bigram 加否定处理之上使用 Naive Bayes 或逻辑回归，就是你在 2026 年的生产基线。

### 可复现性陷阱（再一次）

重新训练情感模型是例行公事。重新评估它们却不是。论文中报告的准确率数字使用特定的数据划分、特定的预处理、特定的分词器。如果你在与基线比较时没有使用完全相同的流水线，你会得到误导性的差值。务必在你自己的流水线上重新生成基线，而不是引用论文的数字。

## 发布它

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

1. **简单。** 在 scikit-learn 流水线中加入 `apply_negation` 作为预处理步骤，并在一个小型情感数据集上测量 F1 差值。
2. **中等。** 实现类别加权逻辑回归（向 scikit-learn 传入 `class_weight="balanced"`，或自己推导梯度）。在合成的 90-10 类别不平衡上测量其效果。
3. **困难。** 通过在情感模型的残差上训练第二个分类器来构建讽刺检测器。记录你的实验设置。当你的准确率低于随机水平时提醒读者（二分类讽刺任务的随机水平约为 50%，大多数首次尝试都会落在那里）。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| Polarity（极性） | 正面或负面 | 二分类标签；有时扩展为中性或细粒度（5 星）。 |
| Aspect-based sentiment（基于方面的情感） | 每个方面的极性 | 将情感归因于文本中提到的特定实体或属性。 |
| Negation scoping（否定作用域） | 反转附近的词元 | 给"not"之后的词元加 `NOT_` 前缀，直到标点。 |
| Laplace smoothing（Laplace 平滑） | 计数加 1 | 防止 Naive Bayes 中出现零概率特征。 |
| L2 regularization（L2 正则化） | 收缩权重 | 在损失中加入 `lambda * sum(w^2)`。对稀疏文本特征至关重要。 |

## 延伸阅读

- [Pang and Lee (2008). Opinion Mining and Sentiment Analysis](https://www.cs.cornell.edu/home/llee/opinion-mining-sentiment-analysis-survey.html) — 奠基性综述。篇幅很长，但前四节涵盖了所有传统方法。
- [Wang and Manning (2012). Baselines and Bigrams: Simple, Good Sentiment and Topic Classification](https://aclanthology.org/P12-2018/) — 这篇论文表明 bigram + Naive Bayes 在短文本上难以超越。
- [scikit-learn 文本特征提取文档](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) — `CountVectorizer`、`TfidfVectorizer` 以及你要调优的每个参数的参考。