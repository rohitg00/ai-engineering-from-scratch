# 情感分析

> 典型的NLP任务。关于经典文本分类所需的大多数知识都会在这里呈现。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段5·02（词袋+TF-IDF），阶段2·14（朴素贝叶斯）
**时长：** 约75分钟

## 问题

“食物不太好。”正面还是负面？

情感听起来很简单。评论者说他们喜欢或不喜欢某个事物。给句子打标签。它成为典型NLP任务的原因是，每一个看似简单的案例背后都隐藏着一个难题。否定会翻转含义。讽刺会反转含义。“还不错”虽然有否定词但却是正面。表情符号承载的信号比周围文本更多。领域词汇很重要（音乐评论中的“紧密” vs 时尚评论中的“紧身”）。

情感是经典NLP的工作实验室。如果你理解了为什么每一个朴素基线都有特定的失败模式，你就理解了为什么每一个更丰富的模型被发明出来。本课程从头构建一个朴素贝叶斯基线，添加逻辑回归，并指出那些使得生产环境中的情感分析成为一个合规级问题的陷阱。

## 概念

经典情感分析是一个两步配方。

1. **表示。** 将文本转换为特征向量。词袋（BoW）、TF-IDF或n-grams。
2. **分类。** 在标记样本上拟合一个线性模型（朴素贝叶斯、逻辑回归、支持向量机）。

朴素贝叶斯是可行的最傻模型。假设每个特征在给定标签的条件下是独立的。根据计数估计`P(词 | 正面)`和`P(词 | 负面)`。推理时，相乘这些概率。“朴素”独立假设荒谬地错误，但结果却出奇地强。原因在于：对于稀疏文本特征和中等规模数据，分类器更关心每个词倾向于哪一侧，而不是倾斜程度。

逻辑回归修复了独立假设。它为每个特征学习一个权重，包括负权重。`not good`作为二元特征获得负权重。朴素贝叶斯无法对从未标记过的二元组做到这一点。

## 构建它

### 第1步：一个真正的小型数据集

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

故意做小。实际工作使用成千上万的样本（IMDb、SST-2、Yelp极性）。数学完全相同。

### 第2步：从头实现多项朴素贝叶斯

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

加法平滑（alpha=1.0）即拉普拉斯平滑。没有它，在某个类别中未见过的词概率为零，对数会爆炸。实践中常用`alpha=0.01`。`alpha=1.0`是教学默认值。

### 第3步：从头实现逻辑回归

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

L2正则化在这里很重要。文本特征是稀疏的；没有L2正则化，模型会记忆训练样本。从`0.01`开始并调优。

### 第4步：处理否定（失败模式）

考虑“not good”和“not bad”。一个词袋分类器看到`{not, good}`和`{not, bad}`，并从训练中出现更多的那个学习。一个二元组分类器看到`not_good`和`not_bad`，并将它们作为不同的特征学习。这通常就足够了。

当你没有二元组时，一个更粗糙的修复方法：**否定作用域**。将否定词后面的标记加上`NOT_`前缀，直到下一个标点符号。

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

现在`good`和`NOT_good`是不同的特征。分类器可以对它们赋予相反的权重。三行预处理，情感基准测试上的准确率就会有可测量的提升。

### 第5步：重要的评估指标

如果类别不平衡，仅靠准确率会产生误导。真实的情感语料库通常是70-80%正面或70-80%负面；一个常数多数分类器可以达到80%的准确率但毫无价值。报告以下每一项：

- **每个类别的精确率和召回率。** 每个类别一对。对它们进行宏平均，得到一个尊重类别平衡的单一数值。
- **宏平均F1（不平衡数据的主要指标）。** 每个类别F1分数的等权平均值。当类别不平衡时代替准确率使用。
- **加权平均F1（备选）。** 与宏平均相同，但按类别频率加权。当不平衡本身具有业务意义时，与宏平均F1一同报告。
- **混淆矩阵。** 原始计数。在信任任何标量指标之前务必检查；它揭示了模型混淆了哪一对类别。
- **每个类别的错误样本。** 每个类别抽取5个错误预测。阅读它们。没有什么可以替代阅读实际错误。

对于严重不平衡的数据（>95-5比例），报告**AUROC**和**AUPRC**而非准确率。AUPRC对少数类更为敏感，而这通常是你关心的（垃圾邮件、欺诈、罕见情感）。

**常见错误需避免。** 在不平衡数据上报告微平均F1而非宏平均F1，会得到一个看起来很高的数值，因为它被多数类别主导。宏平均F1迫使你看到少数类别的表现。

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

scikit-learn用六行代码就能正确完成。

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

需要注意三件事。`stop_words=None`保留了否定词。`ngram_range=(1, 2)`添加了二元组，使得`not_good`成为一个特征。`sublinear_tf=True`对重复词进行衰减。这三个标志是在SST-2上75%准确率基线 vs 85%准确率基线的区别。

### 何时使用Transformer

- 讽刺检测。经典模型在此失败。绝对。
- 情感在文档中间发生转移的长评论。
- 基于方面的情感。“相机很棒但电池很差。”你需要将情感归因于方面。只有Transformer或结构化输出模型能做到。
- 非英语、低资源语言。多语言BERT为你免费提供一个零样本基线。

如果你需要上述任何一种，跳到阶段7（Transformer深入探讨）。否则，TF-IDF加上二元组和否定处理的朴素贝叶斯或逻辑回归就是你2026年的生产基线。

### 可重复性陷阱（再次提及）

重新训练情感模型是常规操作。但重新评估它们却不是。论文中报告的准确率使用了特定的划分、特定的预处理、特定的分词器。如果你不使用完全相同的管道将新模型与基线进行比较，你会得到误导性的差异。始终在你的管道上重新生成基线，而不是论文中的数字。

## 交付

保存为`outputs/prompt-sentiment-baseline.md`：

```markdown
---
name: sentiment-baseline
description: 为新数据集设计一个情感分析基线。
phase: 5
lesson: 05
---

给定一个数据集描述（领域、语言、规模、标签粒度、延迟预算），你输出：

1. 特征提取方案。指定分词器、n-gram范围、停用词策略（通常保留）、否定处理（作用域前缀或二元组）。
2. 分类器。朴素贝叶斯用于基线，逻辑回归用于生产，仅当领域需要讽刺/方面/跨语言时才使用Transformer。
3. 评估计划。报告精确率、召回率、F1、混淆矩阵以及每个类别的错误样本（不仅仅是标量）。
4. 部署后需要监控的一种失败模式。领域漂移和讽刺是前两个。

拒绝为情感任务推荐删除停用词。当类别不平衡（例如90%正面）时，拒绝仅以准确率作为唯一指标报告。对于富含子词的语言，指出需要FastText或Transformer词嵌入而非词级别的TF-IDF。
```

## 练习

1. **简单。** 在scikit-learn管道中将`apply_negation`作为预处理步骤添加，并在一个小型情感数据集上测量F1的差异。
2. **中等。** 实现类别加权的逻辑回归（向scikit-learn传递`class_weight="balanced"`，或自行推导梯度）。在合成的90-10类别不平衡上测量效果。
3. **困难。** 通过在情感模型残差上训练第二个分类器来构建一个讽刺检测器。记录你的实验设置。当你的准确率低于随机水平时（二分类讽刺的随机水平为~50%，大多数首次尝试都会达到这个水平），警告读者。

## 关键术语

| 术语 | 通常说法 | 实际含义 |
|------|----------|----------|
| 极性 | 正面或负面 | 二元标签；有时扩展为中性或细粒度（5星）。 |
| 基于方面的情感 | 按方面的极性 | 将情感归因于文本中提到的特定实体或属性。 |
| 否定作用域 | 逆转附近的词元 | 将"not"之后的词元加上`NOT_`前缀，直到遇到标点。 |
| 拉普拉斯平滑 | 计数加1 | 防止朴素贝叶斯中出现零概率特征。 |
| L2正则化 | 收缩权重 | 在损失中添加`lambda * sum(w^2)`。对于稀疏文本特征至关重要。 |

## 深入阅读

- [Pang and Lee (2008). Opinion Mining and Sentiment Analysis](https://www.cs.cornell.edu/home/llee/opinion-mining-sentiment-analysis-survey.html) — 基础性综述。篇幅较长，但前四节涵盖了所有经典内容。
- [Wang and Manning (2012). Baselines and Bigrams: Simple, Good Sentiment and Topic Classification](https://aclanthology.org/P12-2018/) — 这篇论文展示了在短文本上，二元组+朴素贝叶斯很难被击败。
- [scikit-learn text feature extraction docs](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) — `CountVectorizer`、`TfidfVectorizer`以及你将调优的每个参数的参考文档。