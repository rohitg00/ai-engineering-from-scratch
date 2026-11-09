# 感觉分析

> 关于经典文本分类的大部分知识都在这里.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 2 · 14 (Naive Bayes)
**Time:** ~75 minutes

## 问题

"食物不好". 积极还是消极?

感觉听起来很简单.一个评论员说他们喜欢或不喜欢某种东西.标签句子.它成为了神圣的NLP任务的原因是每个容易看起来的案例都隐藏着一个难以理解的.否定翻转意义.刺反转意义. "不坏的"是积极的,尽管有两个负面编码的词.爱莫吉带有比周围文本更多的信号.域名词汇问题 (`tight`在音乐评论中`tight`在时尚审查中).

感觉是经典NLP的工作实验室.如果你明白为什么每一个天真的基线都有特定的失败模式,你就会明白为什么每一个更丰富的模型都被发明了.这个课程从零开始构建了一个天真的贝叶斯基线,添加了物流回归,并命名了使生产感觉成为合规程度问题的陷.

## 概念

经典情感是一个两步的食谱.

1. **Represent.**转换文本为特征向量.
2. **Classify.**根据标记的例子,适应线性模型 (Naive Bayes,物流回归,SVM).

简单的贝耶斯是最愚蠢的模型,假设每个特征都独立,`P(word | positive)`其他`P(word | negative)`根据"无常"独立假设,这是一个可笑的错误,但结果却令人震惊.原因是:由于文本的特征稀少,并且数据中等,分类器关心每个词的倾向是哪个方面,而不是多少.

逻辑回归修复了独立假设. 它学习每个特征的权重,包括负权重. `not good`简单的贝耶斯不能为它从未标记过的比格拉姆做.

```figure
sentiment-logits
```

## 建立它

### 步骤1:一个真正的微型数据集

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

实际工作使用了数万个例子 (IMDb,SST-2,Yelp极度).数学是相同的.

### 步骤2:从零开始,多个个字母的天真贝耶斯

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

没有它,一个词在类中看不到的概率为零,并且日志爆炸. `alpha=0.01`实际上,这种情况是常见的.`alpha=1.0`现在,我们在教学中,

### 步骤3:从零开始的物流回归

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

文本特征很少,没有L2模型记住训练示例.`0.01`听,听听.

### 操作否定 (故障模式)

考虑"不好"和"不坏".`{not, good}`其他`{not, bad}`们的们都会看到一个大类别.`not_good`其他`not_bad`对于这些问题,我们需要了解更多的信息.

没有大子的时候可以做得更好.**negation scoping**后面的代码是否定字符.`NOT_`接下来的分字.

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

现在`good`其他`NOT_good`它们的分类器可以对比重重. 三行预处理,可测量的准确性跳跃于情感基准.

### 步骤5:重要的评估指标

只有在类别不平衡的情况下,准确性就会误导.实际的情感体通常是70-80%正确的或70-80%负面的;一个常数多数的分类器获得80%的准确性,并且是无价值的.报告以下每一个:

- **Per-class precision and recall.**给每班一个对,对它们进行宏观平均,以得到一个尊重班级平衡的单个数字.
- **Macro-F1 (primary metric for imbalanced data).**平均每类F1分数,均重.当类不平衡时,使用这个比较.
- **Weighted-F1 (alternative).**报告与宏F1同时,当不平衡本身具有商业意义时.
- **Confusion matrix.**总是检查之前信任任何规模度量; 它揭示模型混的类对.
- **Per-class error samples.**每班就有五个错误预测,阅读它们. 没有什么可以取代读到实际错误.

对于严重失衡的数据 (> 95-5 比例),报告**AUROC**其他**AUPRC**非洲人民共和国人民共和国 (AUPRC) 对少数民族群体更敏感,这就是你通常关心的 (垃圾邮件,欺诈,罕见情绪).

**Common bug to avoid.**报告微F1而不是宏F1在不平衡数据上给出一个看起来很高的数字,因为它由多数类占主导地位.

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

## 用它

子学习用六行,正确.

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

需要注意的三个东西.`stop_words=None`没有任何证据.`ngram_range=(1, 2)`增加了大图.`not good`成为一个特征 (scikit-learn将两个词与空间相结合).`sublinear_tf=True`它们是SST-2的75%准确基线和85%准确基线之间的区别.

### 什么时候要找变压器

- 刺的检测,古典模型失败了.
- 长期的评论,情绪在文件中转移.
- 基于面积的感觉. "相机很棒,但电池很糟糕".你需要把感觉归因于面积.
- 无英语,资源低.多语言BERT免费提供零截图的基础线.

如果您需要上述任何一个,请跳转到第7阶段 (变压器深入潜水).否则,TF-IDF+大图+否定处理的无知贝斯或物流回归将是2026年生产基线.

### 复制性陷 (再次)

重新训练情感模型是常规的.重新评估它们不是.报纸中报告的准确数量使用特定的分区,特定的预处理,特定的代币化.如果你比较你的新模型与一个基线,而不使用相同的管道,你会得到误导性地分数.总是重建你的基线,而不是纸质的数字.

## 运送它

保存如`outputs/prompt-sentiment-baseline.md`其他:

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

## 运动

1. **Easy.**加入`apply_negation`作为一个预处理步骤,在 scikit-学习管道中测量F1三角形在一个小的情感数据集.
2. **Medium.**实施按类权重的物流回归 (通过 `class_weight="balanced"`测量对合成90-10类失衡的影响.
3. **Hard.**通过训练第二个分类器对情感模型的残余进行刺探测器. 记录你的实验设置. 当你的准确性低于机会时,警告读者 (二级刺的机会水平是50%左右,大多数第一次尝试都会降落在那里).

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Polarity | Positive or negative | Binary label; sometimes extended to neutral or fine-grained (5-star). |
| Aspect-based sentiment | Per-aspect polarity | Attribute sentiment to specific entities or attributes mentioned in text. |
| Negation scoping | Reversing nearby tokens | Prefix tokens after "not" with `NOT_` until punctuation. |
| Laplace smoothing | Adding 1 to counts | Prevents zero-probability features in Naive Bayes. |
| L2 regularization | Shrinking weights | Adds `lambda * sum(w^2)` to loss. Essential for sparse text features. |

## 进一步阅读

- [Pang and Lee (2008). Opinion Mining and Sentiment Analysis](https://www.cs.cornell.edu/home/llee/opinion-mining-sentiment-analysis-survey.html)长时间,但第一四节涵盖了古典的全部内容.
- [Wang and Manning (2012). Baselines and Bigrams: Simple, Good Sentiment and Topic Classification](https://aclanthology.org/P12-2018/)报纸显示了大图 +天真的贝耶斯,
- [scikit-learn text feature extraction docs](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction)参考`CountVectorizer`现在`TfidfVectorizer`你会调节每一个按.
