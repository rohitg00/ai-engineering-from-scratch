# 情感分析（Sentiment Analysis）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> NLP 的标志性任务。关于经典文本分类，你需要知道的大部分东西都在这里。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 2 · 14 (Naive Bayes)
**Time:** ~75 minutes

## 问题（Problem）

“The food was not great.” 是 positive（正面）还是 negative（负面）？

情感分析听起来很简单：评论者表达喜欢或不喜欢某样东西，给句子打个标签即可。它之所以成为 NLP 的标志性任务，是因为每一个看起来简单的 case 都藏着一个困难的 case。否定会反转含义。讽刺也会反转含义。“Not bad at all”尽管包含两个偏负面的词，整体却是正面的。emoji 携带的信号常常比周围文本更强。领域词汇也很关键（音乐评论里的 `tight` 与时尚评论里的 `tight` 含义不同）。

情感分析是经典 NLP 的实战练兵场。如果你能理解每个朴素 baseline（基线）为何会以特定方式失效，就能理解为何后来出现了那些更丰富的模型。本课从零搭一个 Naive Bayes baseline，再加上 logistic regression（逻辑回归），并指出那些让生产级情感分析变成合规级问题的陷阱。

## 概念（Concept）

经典情感分析是两步配方。

1. **表示（Represent）。** 把文本转成特征向量。BoW、TF-IDF 或 n-gram。
2. **分类（Classify）。** 在带标签样本上拟合一个线性模型（Naive Bayes、logistic regression、SVM）。

Naive Bayes 是“最笨却好用”的模型。它假设每个特征在给定标签下相互独立，从计数中估计 `P(word | positive)` 和 `P(word | negative)`。推理（inference）时把这些概率相乘。这个“朴素”的独立性假设错得离谱，效果却出奇地强。原因是：在稀疏文本特征和中等规模数据下，分类器更关心每个词偏向哪一边，而不是偏向得有多严重。

Logistic regression 修正了独立性假设。它为每个特征学习一个权重，包括负权重。把 `not good` 作为 bigram 特征时，它会拿到一个负权重。Naive Bayes 对从未单独标注过的 bigram 做不到这点。

## 动手实现（Build It）

### Step 1：一个真正的小数据集

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

故意做小。真实场景下的数据集是几万条样本（IMDb、SST-2、Yelp polarity）。数学完全一样。

### Step 2：从零实现多项式 Naive Bayes

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

加性平滑（alpha=1.0）就是 Laplace smoothing（拉普拉斯平滑）。如果不加，某个词在某个类里没出现过，概率就是 0，对数会爆炸。实际工程里 `alpha=0.01` 比较常见，`alpha=1.0` 是教学默认值。

### Step 3：从零实现 logistic regression

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

L2 正则化在这里很关键。文本特征是稀疏的；不加 L2，模型会直接背训练样本。从 `0.01` 开始调。

### Step 4：处理否定（典型失效模式）

考虑 “not good” 和 “not bad”。BoW 分类器看到的是 `{not, good}` 和 `{not, bad}`，只能从训练集中谁出现得多来学。bigram 分类器看到的是 `not_good` 和 `not_bad`，把它们当作两个不同的特征——通常这就够用了。

如果你没有 bigram，还有一个糙但有效的办法：**否定作用域（negation scoping）**。在否定词之后、下一个标点之前的所有 token 前面加 `NOT_` 前缀。

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

现在 `good` 和 `NOT_good` 是两个不同的特征。分类器可以给它们相反的权重。三行预处理代码，在情感分析 benchmark 上能换来肉眼可见的准确率提升。

### Step 5：真正重要的评估指标

如果类别不平衡，单看 accuracy 会非常误导。真实的情感语料库通常是 70–80% positive 或 70–80% negative；一个永远输出多数类的常数分类器能拿 80% accuracy，却毫无价值。下面这些都要报告：

- **每类的 precision 和 recall。** 每类一对。做 macro 平均得到一个尊重类别均衡的总数。
- **Macro-F1（不平衡数据的主指标）。** 各类 F1 的平均，等权重。类别不平衡时用它代替 accuracy。
- **Weighted-F1（备选）。** 与 macro 类似但按类频率加权。当不平衡本身具有业务含义时，与 macro-F1 一起报告。
- **混淆矩阵（confusion matrix）。** 原始计数。在你信任任何标量指标之前都要先看它；它能告诉你模型把哪两个类弄混了。
- **每类错误样本。** 每类抽 5 个错误预测，亲自读一遍。没有什么能取代真正读错误样本。

对于严重不平衡的数据（比例 > 95-5），用 **AUROC** 和 **AUPRC** 替代 accuracy。AUPRC 对少数类更敏感，而少数类往往是你真正在乎的（垃圾邮件、欺诈、稀有情感）。

**常见踩坑。** 在不平衡数据上汇报 micro-F1 而不是 macro-F1，会得到一个被多数类主导的虚高数字。Macro-F1 强迫你直面少数类的表现。

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

## 用起来（Use It）

scikit-learn 用六行就能正确做完。

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

注意三处。`stop_words=None` 保留否定词。`ngram_range=(1, 2)` 加上 bigram，让 `not_good` 成为一个特征。`sublinear_tf=True` 削弱重复词的影响。在 SST-2 上，这三个开关就是 75% 准确率 baseline 和 85% 准确率 baseline 的分水岭。

### 什么时候该上 transformer

- 讽刺识别。经典模型在这里就是不行。没商量。
- 长评论，情感在文档中段发生反转。
- aspect-based sentiment（基于方面的情感分析）。 “Camera was great but battery was terrible.” 你需要把情感归因到具体方面。只能用 transformer 或结构化输出模型。
- 非英语、低资源语言。Multilingual BERT 免费给你一个 zero-shot baseline。

如果你需要上面任何一项，直接跳到 phase 7（transformer 深度课）。否则，TF-IDF + bigram + 否定处理之上的 Naive Bayes 或 logistic regression，就是你 2026 年的生产级 baseline。

### 可复现性陷阱（再一次）

重新训练情感模型是家常便饭，重新评估却不是。论文里报告的 accuracy 用的是特定的数据集划分、特定的预处理、特定的 tokenizer。如果你拿新模型和 baseline 比较时没有用完全相同的 pipeline（流水线），得到的差异是误导性的。永远在你自己的 pipeline 上重新生成 baseline，而不是引用论文里的数字。

## 上线部署（Ship It）

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

## 练习（Exercises）

1. **简单。** 把 `apply_negation` 作为一个预处理步骤加进 scikit-learn 的 pipeline，在一个小型情感数据集上测出 F1 的增量。
2. **中等。** 实现类别加权的 logistic regression（在 scikit-learn 里传 `class_weight="balanced"`，或者自己推导梯度）。在一个合成的 90-10 类别不平衡上测它的效果。
3. **困难。** 用情感模型的残差再训一个分类器，做一个讽刺识别器。把你的实验设置写清楚。当准确率低于随机水平（二分类讽刺的随机水平约 50%，多数人第一次尝试就掉到这里）时，要在文中提醒读者。

## 关键术语（Key Terms）

| 术语 | 别人怎么说 | 实际意思 |
|------|-----------------|-----------------------|
| Polarity（极性） | 正面或负面 | 二分类标签；有时扩展为中性或更细粒度（5 星）。 |
| Aspect-based sentiment（基于方面的情感） | 按方面打极性 | 把情感归因到文本中提到的具体实体或属性。 |
| Negation scoping（否定作用域） | 反转邻近 token | 在“not”之后的 token 前加 `NOT_` 前缀，直到遇到标点。 |
| Laplace smoothing | 把计数加 1 | 防止 Naive Bayes 中出现零概率特征。 |
| L2 正则化 | 缩小权重 | 在 loss 里加上 `lambda * sum(w^2)`。对稀疏文本特征至关重要。 |

## 延伸阅读（Further Reading）

- [Pang and Lee (2008). Opinion Mining and Sentiment Analysis](https://www.cs.cornell.edu/home/llee/opinion-mining-sentiment-analysis-survey.html) —— 奠基性综述。很长，但前四节涵盖了所有经典内容。
- [Wang and Manning (2012). Baselines and Bigrams: Simple, Good Sentiment and Topic Classification](https://aclanthology.org/P12-2018/) —— 这篇论文证明了 bigram + Naive Bayes 在短文本上很难被打败。
- [scikit-learn text feature extraction docs](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) —— `CountVectorizer`、`TfidfVectorizer` 以及你会调的每一个旋钮的参考文档。
