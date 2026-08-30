# Sentiment Analysis

> 典型的NLP任务。您需要了解的有关经典文本分类的大部分信息都在这里显示。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段5 · 02（BoW + TF-IDF）、阶段2 · 14（天真的Bayes）
** 时间：** ~75分钟

## The Problem

“食物不是很好。“积极的还是消极的？

情绪听起来很简单。一位评论者说他们喜欢或不喜欢某件事。标记句子。它成为典型的NLP任务的原因是，每个看起来简单的案例都隐藏着一个困难的案例。否定颠覆了意义。讽刺将其颠倒过来。尽管有两个负面编码词，但“一点也不坏”仍然是积极的。收件箱比周围的文本承载更多的信号。领域词汇很重要（音乐评论中的“紧密”与时尚评论中的“紧密”）。

Sentiment是经典NLP的工作实验室。如果您明白为什么每个朴素基线都有特定的故障模式，那么您就明白为什么每个更丰富的模型都被发明了。本课从头开始建立天真的Bayes基线，添加了逻辑回归，并列出了使生产情绪成为合规级问题的陷阱。

## The Concept

![Sentiment pipeline: tokens → features → classifier → label](./assets/sentiment.svg)

古典情感是两步食谱。

1. ** 代表。**将文本转化为特征载体。BoW、TF-IDF或n-gram。
2. ** 分类。**对已标记的示例进行线性模型（Naive Bayes、逻辑回归、SV）。

天真的Bayes是最愚蠢的有效模型。假设给定标签，每个特征都是独立的。估计' P（字|正）'和' P（字|负）'从计数。推理时，乘以概率。“天真”的独立假设是错误的，但结果却惊人地强烈。原因：由于文本特征稀疏，数据中等，分类器更关心每个词倾向哪一边，而不是倾向多少。

逻辑回归修复了独立性假设。它学习每个特征的权重，包括负权重。“不好”，因为二元组合功能的权重为负。天真的Bayes无法对它从未标记的二元组合做到这一点。

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

故意小的。实际工作使用了数万个例子（IMDB、CST-2、Yelp polarity）。数学是相同的。

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

加法平滑（Alpha=1.0）是拉普拉斯平滑。如果没有它，课堂上未看到的单词的概率为零，日志就会爆炸。“Alpha=0.01”在实践中很常见。“Alpha=1.0”是教学默认设置。

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

L2正规化在这里很重要。文本特征是稀疏的;如果没有L2，模型会记住训练示例。从“0.01”开始并调整。

### Step 4: handling negation (the failure mode)

考虑“不好”和“不坏”。BoW分类器会看到“{not，good}”和“{not，bad}”，并从训练中出现得更多的哪一个中学习。二元语法分类器将“not_good”和“not_bad”视为不同的特征。这通常就足够了。

当您没有二元组合时，可以使用一个更简单的修复方法：** 否定作用域 **。在否定词后面加上“NOT_”的标记前，直到下一个标点符号。

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

现在“good”和“NOT_good”是不同的功能。分类器可以对它们进行相反的加权。三行预处理，可测量的准确性在情绪基准上跳跃。

### Step 5: evaluation metrics that matter

如果班级不平衡，仅靠准确性就会产生误导。真实的情绪库通常是70-80%的积极或70-80%的消极;恒定多数分类器的准确性为80%，毫无价值。报告以下每一项：

- ** 每个类别的精确度和召回率。**每个班一双。对他们进行宏观平均，以获得一个尊重阶级平衡的数字。
- ** 宏F1（不平衡数据的主要指标）。**每个级别F1分数的平均值，同等加权。当类别不平衡时，使用此而不是准确性。
- ** 加权-F1（替代）。**与宏相同，但按类别频率加权。当失衡本身具有商业意义时，与宏观F1一起报告。
- ** 混乱矩阵。**原始计数。在信任任何纯量指标之前始终进行检查;它揭示了模型混淆了哪对类。
- ** 每个类的错误样本。**每个课程得出5个错误的预测。阅读它们。没有什么可以取代阅读实际错误。

对于严重失衡的数据（比例> 95-5），请报告 **AUROC** 和 **AUPRC** 而不是准确性。AUPRC对少数族裔更敏感，这是您通常关心的（垃圾邮件、欺诈、罕见情绪）。

** 需要避免的常见错误。**在不平衡数据上报告微观F1而不是宏观F1给出的数字看起来很高，因为它由多数派主导。Macro-F1强迫您看到少数族裔级的表现。

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

scikit-learn正确地用六行字完成了这一任务。

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

需要注意的三件事。' stop_words=无'保留否定。' ngram_Range=（1，2）'添加了二元语法，因此' not_good '成为一个功能。“sublinear_tf=True”会抑制重复的单词。这三个标志是CST-2上75%准确基线和85%准确基线之间的差异。

### When to reach for a transformer

- 讽刺侦测经典模型在这里失败了。期
- 长篇评论中情绪发生了转变。
- 基于蚂蚁的情绪。“相机很棒，但电池很糟糕。“你需要将情绪归因于各个方面。仅限变形金刚或结构化输出模型。
- 非英语、低资源语言。多语言BERT免费为您提供零射击基线。

如果您需要上述任何一项，请跳到第7阶段（变压器深入研究）。否则，TF-IDF上的Naive Bayes或逻辑回归加上二元组加上否定处理是您2026年的生产基线。

### The reproducibility trap (again)

重新训练情绪模型是例行公事。重新评估它们并不是。论文中报告的准确性数字使用特定的拆分、特定的预处理、特定的符号化器。如果您将新模型与基线进行比较而不使用相同的管道，您将得到误导性的增量。始终在管道上重新生成基线，而不是纸张编号。

## Ship It

另存为“输出/prompt-sentiment-baseline.md”：

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

1. ** 简单。**在scikit-learn管道中添加“apply_negation”作为预处理步骤，并在小型情绪数据集上测量F1增量。
2. ** 中等。**实施类别加权逻辑回归（将' class_weight=“balanced”'传递给scikit-learn，或自己推导梯度）。衡量对90-10年级综合失衡的影响。
3. ** 很难。**通过根据情感模型的残余训练第二个分类器来构建讽刺检测器。记录您的实验设置。当你的准确性低于可能性时，请警告读者（2级讽刺的几率为~ 50%，而且大多数第一次尝试都是这样）。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 极性 | 正或负 | 二进制标签;有时扩展到中性或细粒度（5星）。 |
| 基于情绪的情感 | 按方面的两极 | 将情感归因于文本中提到的特定实体或属性。 |
| 否定范围 | 翻转附近的代币 | 在“not”后面加上“NOT_'直到标点符号为止。 |
| 拉普拉斯平滑 | 计数加1 | 防止朴素Bayes中的零概率特征。 |
| L2正则化 | 体重缩水 | 将“拉姆达 * sum（w#2）”添加到损失中。对于稀疏文本功能至关重要。 |

## Further Reading

- [Pang和Lee（2008）。意见挖掘和情绪分析]（https：//www.cs.cornell.edu/home/llee/opinion-mining-sentiment-Analysis-survey.html）-基础调查。很长，但前四部分涵盖了所有经典内容。
- [Wang和曼宁（2012）。基线和双胞胎：简单、良好的情绪和主题分类]（https：//aclanthology.org/P12-2018/）-展示二元组合+朴素的Bayes的论文在短文本上很难被击败。
- [scikit-learn文本特征提取文档]（https：//scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction）-参考`CountVectorizer`、`TfidfVectorizer`和您要调整的每个旋钮。
