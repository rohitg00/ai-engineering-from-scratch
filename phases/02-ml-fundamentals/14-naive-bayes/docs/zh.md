# 朴素贝叶斯（Naive Bayes）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 「naive（朴素）」假设是错的，但它就是能 work。这正是它的精妙之处。

**Type:** Build
**Language:** Python
**Prerequisites:** Phase 2, Lessons 01-07 (classification, Bayes' theorem)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 从零实现 Multinomial Naive Bayes（多项式朴素贝叶斯），配合 Laplace smoothing（拉普拉斯平滑）做文本分类
- 解释为什么 naive 独立性假设在数学上是错的，但在实践中却能产出正确的类别排序
- 比较 Multinomial、Bernoulli、Gaussian 三种 Naive Bayes 变体，并为给定的特征类型挑出合适的那一种
- 在高维稀疏数据上把 Naive Bayes 与 logistic regression（逻辑回归）做对比，并解释其中的偏差-方差（bias-variance）权衡

## 问题（The Problem）

你需要做文本分类。把邮件分成 spam 和 not-spam，把用户评论分成正面和负面，把工单分成不同的类别。你有上千个特征（每个词一个），训练数据却很有限。

大多数分类器在这里都会卡壳。Logistic regression 需要足够的样本才能可靠地估计上千个权重。决策树一次只在一个词上分裂，过拟合得一塌糊涂。KNN 在 10000 维空间里基本没意义，因为每个点和其他每个点的距离都差不多远。

Naive Bayes 处理得了。它做了一个数学上错误的假设（在给定类别的条件下，每个特征都和其他每个特征独立），但在文本分类上仍然能跑赢那些「更聪明」的模型，尤其是在训练集小的时候。它只需对数据做一次 pass 就训练完。它能 scale 到上百万特征。它还能给出概率估计（虽然由于独立性假设，这些概率往往校准得很差）。

理解为什么一个错误的假设反而带来好的预测，会教会你机器学习里一件非常本质的事情：最好的模型不是最正确的那个，而是对你的数据有最好 bias-variance 权衡的那个。

## 概念（The Concept）

### 贝叶斯定理（Bayes' Theorem）（速览）

贝叶斯定理把条件概率反过来：

```
P(class | features) = P(features | class) * P(class) / P(features)
```

我们想要的是 `P(class | features)`——一篇文档在给定它包含的词的情况下，属于某个类别的概率。我们可以从下面三项算出来：
- `P(features | class)`——在该类别的文档里看到这些词的似然（likelihood）
- `P(class)`——该类别的先验概率（spam 整体上有多常见？）
- `P(features)`——证据项，对所有类别都一样，所以比较时可以忽略

`P(class | features)` 最大的那个类别赢。

### naive 独立性假设

精确计算 `P(features | class)` 需要估计所有特征的联合概率。词表有 10000 个词时，你得估计一个在 2^10000 种组合上的分布。不可能。

naive 假设：在给定类别的条件下，每个特征都条件独立。

```
P(w1, w2, ..., wn | class) = P(w1 | class) * P(w2 | class) * ... * P(wn | class)
```

不再去估那个不可能的联合分布，而是估 n 个简单的、每个特征各自的分布。每个分布只需要计数。

这个假设显然是错的。「machine」和「learning」这两个词在任何文档里都不可能独立。但分类器并不需要正确的概率估计，它只需要正确的排序——哪个类别概率最高。独立性假设会引入系统性偏差，但这些偏差对所有类别影响相似，所以排序仍然正确。

### 它为什么还能 work

三个原因：

1. **排序优于校准。** 分类只需要排在最前面的类别是对的。哪怕 P(spam) = 0.99999 而真实概率是 0.7，分类器仍然会正确地选 spam。我们不需要正确的概率，只要正确的赢家。

2. **高偏差、低方差。** 独立性假设是一个很强的先验。它对模型施加了很重的约束，从而避免过拟合。在训练数据有限时，一个略有偏差但稳定的模型，会打败一个理论上正确但极度不稳定的模型。这就是 bias-variance 权衡在起作用。

3. **特征冗余会互相抵消。** 相关的特征提供冗余的证据。分类器会重复计入这些证据，但它对正确的那个类别也会重复计入。如果「machine」和「learning」总是同时出现，它们都为「tech」类别提供证据。NB 把它们数了两遍，但它是为正确的类别数了两遍。

第四个、更实用的理由：Naive Bayes 极快。训练只是对数据做一次 pass 来计频次。预测就是一次矩阵乘法。一百万篇文档可以在几秒内训练完。这种速度意味着你可以更快地迭代、试更多的特征组合、跑更多的实验，比那些慢吞吞的模型强。

### 一步步走数学

我们走一个具体例子。假设有两个类别：spam 和 not-spam。词表里有三个词：「free」、「money」、「meeting」。

训练数据：
- Spam 邮件里出现了 80 次「free」、60 次「money」、10 次「meeting」（共 150 个词）
- Not-spam 邮件里出现了 5 次「free」、10 次「money」、100 次「meeting」（共 115 个词）
- 40% 的邮件是 spam，60% 是 not-spam

加上 Laplace smoothing（alpha=1）：

```
P(free | spam)    = (80 + 1) / (150 + 3) = 81/153 = 0.529
P(money | spam)   = (60 + 1) / (150 + 3) = 61/153 = 0.399
P(meeting | spam) = (10 + 1) / (150 + 3) = 11/153 = 0.072

P(free | not-spam)    = (5 + 1) / (115 + 3) = 6/118 = 0.051
P(money | not-spam)   = (10 + 1) / (115 + 3) = 11/118 = 0.093
P(meeting | not-spam) = (100 + 1) / (115 + 3) = 101/118 = 0.856
```

新邮件包含：「free」（2 次）、「money」（1 次）、「meeting」（0 次）。

```
log P(spam | email) = log(0.4) + 2*log(0.529) + 1*log(0.399) + 0*log(0.072)
                    = -0.916 + 2*(-0.637) + (-0.919) + 0
                    = -3.109

log P(not-spam | email) = log(0.6) + 2*log(0.051) + 1*log(0.093) + 0*log(0.856)
                        = -0.511 + 2*(-2.976) + (-2.375) + 0
                        = -8.838
```

Spam 大幅胜出。「free」出现两次是 spam 的有力证据。注意「meeting」没出现这件事对两个 log 求和都是零贡献（0 * log(P)）——在 Multinomial NB 里，缺席的词没有任何影响。是 Bernoulli NB 才显式建模词的缺席。

### 三个变体

Naive Bayes 有三种风味，区别在于对 `P(feature | class)` 的建模方式不同。

#### Multinomial Naive Bayes（多项式朴素贝叶斯）

把每个特征建模为一个计数。最适合特征是词频或 TF-IDF 值的文本数据。

```
P(word_i | class) = (count of word_i in class + alpha) / (total words in class + alpha * vocab_size)
```

`alpha` 就是 Laplace smoothing（下文解释）。这个变体是文本分类的主力。

#### Gaussian Naive Bayes（高斯朴素贝叶斯）

把每个特征建模为正态分布。最适合连续特征。

```
P(x_i | class) = (1 / sqrt(2 * pi * var)) * exp(-(x_i - mean)^2 / (2 * var))
```

每个类别的每个特征都有自己的均值和方差。当特征在每个类别内部确实近似呈钟形分布时，这种方式效果很好。

#### Bernoulli Naive Bayes（伯努利朴素贝叶斯）

把每个特征建模为二值（出现或不出现）。最适合短文本或二值特征向量。

```
P(word_i | class) = (docs in class containing word_i + alpha) / (total docs in class + 2 * alpha)
```

和 Multinomial 不同，Bernoulli 显式地惩罚某个词的缺席。如果「free」通常在 spam 里出现，但本封邮件里没出现，Bernoulli 会把这件事算作不利于 spam 的证据。

### 什么时候用哪个变体

| 变体 | 特征类型 | 最适合 | 例子 |
|---|---|---|---|
| Multinomial | 计数或频次 | 文本分类、bag-of-words（词袋） | 邮件 spam、主题分类 |
| Gaussian | 连续值 | 特征近似正态的表格数据 | 鸢尾花分类、传感器数据 |
| Bernoulli | 二值（0/1） | 短文本、二值特征向量 | 短信 spam、出现/缺席类特征 |

### Laplace 平滑（Laplace Smoothing）

如果某个词在测试数据里出现，但在某个类别的训练数据里从没出现过，会怎样？

不做平滑：`P(word | class) = 0/N = 0`。一个零乘进整个连乘，会让 `P(class | features) = 0`，无论别的证据多强。一个没见过的词就把整个预测毁掉了，无论别的证据多支持它。

Laplace smoothing 给每个特征计数加上一个小常数 `alpha`（通常是 1）：

```
P(word_i | class) = (count(word_i, class) + alpha) / (total_words_in_class + alpha * vocab_size)
```

alpha=1 时，每个词都至少有一个微小的概率。测试邮件里出现「discombobulate」这种词，不再会把 spam 概率打到零。这种平滑还有贝叶斯解释：它等价于在词分布上放一个均匀的 Dirichlet 先验。

alpha 越大，平滑越强（分布越接近均匀）；alpha 越小，模型越信任数据。alpha 是一个需要调的超参数。

alpha 的影响：

| Alpha | 效果 | 何时使用 |
|---|---|---|
| 0.001 | 几乎不平滑，完全信任数据 | 训练集非常大，预期没有未见过的特征 |
| 0.1 | 轻度平滑 | 训练集较大 |
| 1.0 | 标准 Laplace 平滑 | 默认起点 |
| 10.0 | 重度平滑，分布被拍平 | 训练集非常小，预期有大量未见过的特征 |

### 在 log 空间里计算

把几百个概率（每个都小于 1）连乘会触发浮点下溢。明明真值是一个非常小的正数，浮点数下却变成了零。

解法：在 log 空间里算。不再乘概率，而是把它们的对数加起来：

```
log P(class | x1, x2, ..., xn) = log P(class) + sum_i log P(xi | class)
```

这把预测变成了一个点积：

```
log_scores = X @ log_feature_probs.T + log_class_priors
prediction = argmax(log_scores)
```

矩阵乘法。这正是 Naive Bayes 预测如此快的原因——它就是一个单层线性模型在做的同一件事。

### Naive Bayes vs Logistic Regression

两者都是文本上的线性分类器。区别在于它们建模的是什么。

| 方面 | Naive Bayes | Logistic Regression |
|---|---|---|
| 类型 | 生成式（建模 P(X\|Y)） | 判别式（建模 P(Y\|X)） |
| 训练 | 计频次 | 优化损失函数 |
| 小数据 | 更好（强先验有帮助） | 更差（数据不够估权重） |
| 大数据 | 更差（错误假设拖后腿） | 更好（决策边界更灵活） |
| 特征 | 假设独立 | 能处理相关性 |
| 速度 | 单次 pass，非常快 | 迭代优化 |
| 校准 | 概率较差 | 概率较好 |

经验法则：先上 Naive Bayes。如果数据足够多、NB 见顶了，再切到 logistic regression。

### 分类流水线

```mermaid
flowchart LR
    A[原始文本] --> B[分词]
    B --> C[构建词表]
    C --> D[统计词频]
    D --> E[应用平滑]
    E --> F[计算对数概率]
    F --> G[预测 argmax P 给定词时的类别]

    style A fill:#f9f,stroke:#333
    style G fill:#9f9,stroke:#333
```

实践中，我们在 log 空间里运算来避免浮点下溢。不再把许多小概率乘起来，而是把它们的对数加起来：

```
log P(class | features) = log P(class) + sum_i log P(feature_i | class)
```

## 动手实现（Build It）

`code/naive_bayes.py` 中的代码从零实现了 MultinomialNB 和 GaussianNB。

### MultinomialNB

从零开始的实现：

1. **fit(X, y)**：对每个类别，统计每个特征的频次。加 Laplace smoothing。计算 log 概率。存下类先验（类别频率的 log）。

2. **predict_log_proba(X)**：对每个样本、每个类别，计算 log P(class) + sum of log P(feature_i | class)。这就是一次矩阵乘法：X @ log_probs.T + log_priors。

3. **predict(X)**：返回 log 概率最高的类别。

```python
class MultinomialNB:
    def __init__(self, alpha=1.0):
        self.alpha = alpha

    def fit(self, X, y):
        classes = np.unique(y)
        n_classes = len(classes)
        n_features = X.shape[1]

        self.classes_ = classes
        self.class_log_prior_ = np.zeros(n_classes)
        self.feature_log_prob_ = np.zeros((n_classes, n_features))

        for i, c in enumerate(classes):
            X_c = X[y == c]
            self.class_log_prior_[i] = np.log(X_c.shape[0] / X.shape[0])
            counts = X_c.sum(axis=0) + self.alpha
            self.feature_log_prob_[i] = np.log(counts / counts.sum())

        return self
```

关键洞察：fit 完之后，预测就只是一个矩阵乘法加一个偏置。这就是为什么 Naive Bayes 这么快。

### GaussianNB

对连续特征，我们按类别按特征估计均值和方差：

```python
class GaussianNB:
    def __init__(self):
        pass

    def fit(self, X, y):
        classes = np.unique(y)
        self.classes_ = classes
        self.means_ = np.zeros((len(classes), X.shape[1]))
        self.vars_ = np.zeros((len(classes), X.shape[1]))
        self.priors_ = np.zeros(len(classes))

        for i, c in enumerate(classes):
            X_c = X[y == c]
            self.means_[i] = X_c.mean(axis=0)
            self.vars_[i] = X_c.var(axis=0) + 1e-9
            self.priors_[i] = X_c.shape[0] / X.shape[0]

        return self
```

预测时按特征用高斯 PDF，然后跨特征相乘（即在 log 空间里相加）。

### 演示：文本分类

代码生成合成的 bag-of-words 数据，模拟两个类别（科技文章 vs 体育文章）。每个类别有不同的词频分布。MultinomialNB 用词数对它们分类。

合成数据是这样造的：我们造 200 个「词」（特征列）。词 0-39 在科技文章里高频、体育文章里低频。词 80-119 在体育文章里高频、科技文章里低频。词 40-79 在两类里都中频。这样就营造了一个真实场景：一些词是强类别指示器，另一些只是噪声。

### 演示：连续特征

代码生成类似鸢尾花的数据（3 类、4 个特征、高斯簇）。GaussianNB 用每类每特征的均值和方差做分类。每个类别有不同的中心（均值向量）和不同的散布（方差），模拟真实世界里测量值在不同类别间的系统性差异。

代码还演示了：
- **平滑对比：** 用不同 alpha 值训练 MultinomialNB，展示平滑强度对准确率的影响。
- **训练集规模实验：** NB 准确率如何随训练数据从 20 涨到 1600 而提升。NB 即便只有非常少的样本也能达到不错的准确率——这是它的主要优势。
- **混淆矩阵：** 每类的 precision、recall、F1 score，展示 NB 在哪些地方出错。

### 预测速度

Naive Bayes 预测就是一次矩阵乘法。对 n 个样本、d 个特征、k 个类别：
- MultinomialNB：一次矩阵乘 (n x d) @ (d x k) = O(n * d * k)
- GaussianNB：n * k 次高斯 PDF 求值，每次跨 d 个特征 = O(n * d * k)

两者在每个维度上都是线性的。对比一下 KNN（要对所有训练点算距离）或者带 RBF kernel 的 SVM（要对所有支持向量算 kernel），NB 在预测时快了几个数量级。

## 用起来（Use It）

用 sklearn，两个变体都是一行：

```python
from sklearn.naive_bayes import GaussianNB, MultinomialNB

gnb = GaussianNB()
gnb.fit(X_train, y_train)
print(f"GaussianNB accuracy: {gnb.score(X_test, y_test):.3f}")

mnb = MultinomialNB(alpha=1.0)
mnb.fit(X_train_counts, y_train)
print(f"MultinomialNB accuracy: {mnb.score(X_test_counts, y_test):.3f}")
```

用 sklearn 做文本分类：

```python
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline

text_clf = Pipeline([
    ("vectorizer", CountVectorizer()),
    ("classifier", MultinomialNB(alpha=1.0)),
])

text_clf.fit(train_texts, train_labels)
accuracy = text_clf.score(test_texts, test_labels)
```

`naive_bayes.py` 里的代码会把从零实现的版本和 sklearn 在同一份数据上做对比，验证正确性。

### TF-IDF 配合 Naive Bayes

原始词数对每个词每次出现都赋予相同的权重。但像「the」、「is」这种词在每个类别里都频繁出现——它们不带任何信息。TF-IDF（Term Frequency - Inverse Document Frequency，词频-逆文档频率）会降低常见词的权重、提升稀有的、有区分度的词的权重。

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline

text_clf = Pipeline([
    ("tfidf", TfidfVectorizer()),
    ("classifier", MultinomialNB(alpha=0.1)),
])
```

TF-IDF 值是非负的，所以可以和 MultinomialNB 配合。TF-IDF + MultinomialNB 是文本分类里最强的 baseline 之一。在训练样本少于 10000 的数据集上，它常常能打过更复杂的模型。

### 短文本用 BernoulliNB

对于短文本（推文、SMS、聊天消息），BernoulliNB 可以胜过 MultinomialNB。短文本词数少，MultinomialNB 依赖的频次信息很嘈杂。BernoulliNB 只关心出现/缺席，在短文本下更可靠。

```python
from sklearn.naive_bayes import BernoulliNB
from sklearn.feature_extraction.text import CountVectorizer

text_clf = Pipeline([
    ("vectorizer", CountVectorizer(binary=True)),
    ("classifier", BernoulliNB(alpha=1.0)),
])
```

CountVectorizer 里的 `binary=True` 把所有计数转成 0/1。不加这个开关，BernoulliNB 仍能跑，但它看到的是它本来不是为之设计的计数。

### 校准 NB 的概率

NB 的概率校准很差。NB 说 P(spam) = 0.95 时，真实概率可能只是 0.7。如果你需要可靠的概率估计（比如要设阈值，或要和别的模型组合），用 sklearn 的 CalibratedClassifierCV：

```python
from sklearn.calibration import CalibratedClassifierCV

calibrated_nb = CalibratedClassifierCV(MultinomialNB(), cv=5, method="sigmoid")
calibrated_nb.fit(X_train, y_train)
proba = calibrated_nb.predict_proba(X_test)
```

它会用交叉验证在 NB 的原始分数之上再拟合一个 logistic regression。得到的概率会更接近真实的类别频率。

### 常见坑

1. **负的特征值。** MultinomialNB 要求特征非负。如果你有负值（比如某些设置下的 TF-IDF 或标准化过的特征），改用 GaussianNB，或把特征整体平移到正数。

2. **零方差特征。** GaussianNB 要除以方差。如果某个特征在某个类别里方差为零（所有值都一样），概率计算会崩。代码给所有方差都加了一个小的平滑项（1e-9）来避免这种情况。

3. **类别不平衡。** 如果 99% 的邮件都是 not-spam，先验 P(not-spam) = 0.99 强到能压倒似然证据。你可以手动设类先验，或者用 sklearn 的 class_prior 参数。

4. **特征缩放。** MultinomialNB 不需要缩放（它处理计数）。GaussianNB 也不需要（它按特征估计统计量）。这是相对 logistic regression 和 SVM 的一个优势——后两者对特征尺度敏感。

## 上线部署（Ship It）

本课产出：
- `outputs/skill-naive-bayes-chooser.md`——一个用来挑选合适 NB 变体的决策 skill
- `code/naive_bayes.py`——从零实现的 MultinomialNB 和 GaussianNB，以及与 sklearn 的对比

### Naive Bayes 什么时候会失败

NB 失败的场景是独立性假设导致排序错误（不是概率错误而已）。这种情况发生在：

1. **强特征交互。** 如果类别取决于两个特征的组合，而非它们各自（XOR 那种模式），NB 会完全错过。每个特征单独看都没证据，而 NB 没法非线性地组合它们。

2. **高度相关、证据相反的特征。** 如果特征 A 说「spam」、特征 B 说「not-spam」，但 A 和 B 在现实中完全相关（它们总是一致的），NB 会看到本不存在的相互冲突的证据。

3. **训练集非常大。** 数据足够多时，logistic regression 这类判别式模型会学到真正的决策边界，超过 NB。在小数据上帮了忙的独立性假设，这时反而拖了模型的后腿。

实践中，这些失败模式在文本分类里都很罕见。文本特征数量多、单个都很弱，独立性假设的偏差倾向于互相抵消。对于特征少且强相关的表格数据，先考虑 logistic regression 或基于树的模型。

## 练习（Exercises）

1. **平滑实验。** 在文本数据上分别用 alpha 为 0.01、0.1、1.0、10.0、100.0 训练 MultinomialNB。画准确率 vs alpha 的图。性能在哪里达到峰值？为什么 alpha 太大反而伤性能？

2. **特征独立性测试。** 拿一个真实文本数据集。挑两个明显相关的词（「machine」和「learning」）。计算 P(word1 | class) * P(word2 | class)，并和 P(word1 AND word2 | class) 对比。独立性假设错得多离谱？这影响分类准确率吗？

3. **Bernoulli 实现。** 在代码中扩展一个 BernoulliNB 类。把 bag-of-words 转成二值（出现/缺席），并在文本数据上和 MultinomialNB 对比准确率。Bernoulli 什么时候赢？

4. **NB vs Logistic Regression。** 在文本数据上同时训练两者。从 100 个训练样本起步，逐步增加到 10000。画两者的准确率 vs 训练集大小的曲线。什么时候 Logistic Regression 反超 Naive Bayes？

5. **Spam 过滤器。** 搭一个完整的 spam 分类器：对原始邮件文本做 tokenize、构建词表、生成 bag-of-words 特征、训练 MultinomialNB、用 precision 和 recall 评估（不只是 accuracy——为什么？）。

## 关键术语（Key Terms）

| 术语 | 大家会怎么说 | 它真正的意思 |
|---|---|---|
| Naive Bayes | 「简单的概率分类器」 | 应用贝叶斯定理的分类器，假设给定类别后特征条件独立 |
| Conditional independence（条件独立） | 「特征之间互不影响」 | P(A, B \| C) = P(A \| C) * P(B \| C)——一旦知道 C，B 就再也告诉你不了关于 A 的新信息 |
| Laplace smoothing | 「加一平滑」 | 给每个特征加一个小计数，防止零概率主宰预测 |
| Prior（先验） | 「看到数据之前你相信的东西」 | P(class)——观察任何特征之前每个类别的概率 |
| Likelihood（似然） | 「数据有多契合」 | P(features \| class)——已知类别时观察到这些特征的概率 |
| Posterior（后验） | 「看到数据之后你相信的东西」 | P(class \| features)——观察了特征之后该类别更新过的概率 |
| Generative model（生成式模型） | 「建模数据是怎么产生的」 | 学习 P(X \| Y) 和 P(Y)，再用贝叶斯定理得到 P(Y \| X) 的模型 |
| Discriminative model（判别式模型） | 「建模决策边界」 | 直接学习 P(Y \| X) 而不建模 X 是如何产生的模型 |
| Log probability | 「避免下溢」 | 用 log P 而非 P，防止许多小数相乘在浮点下变成零 |

## 延伸阅读（Further Reading）

- [scikit-learn Naive Bayes 文档](https://scikit-learn.org/stable/modules/naive_bayes.html)——三种变体的数学细节
- [McCallum and Nigam, A Comparison of Event Models for Naive Bayes Text Classification (1998)](https://www.cs.cmu.edu/~knigam/papers/multinomial-aaaiws98.pdf)——Multinomial vs Bernoulli 在文本上的经典对比
- [Rennie et al., Tackling the Poor Assumptions of Naive Bayes Text Classifiers (2003)](https://people.csail.mit.edu/jrennie/papers/icml03-nb.pdf)——文本场景下对 NB 的改进
- [Ng and Jordan, On Discriminative vs. Generative Classifiers (2001)](https://ai.stanford.edu/~ang/papers/nips01-discriminativegenerative.pdf)——证明 NB 在数据较少时比 LR 收敛更快
