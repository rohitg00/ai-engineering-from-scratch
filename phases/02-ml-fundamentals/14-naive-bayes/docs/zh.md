# 14 · 朴素贝叶斯

> 这个「朴素」假设是错的，可它照样能用。这正是它的妙处所在。

**类型：** 动手实现
**语言：** Python
**前置：** 第 2 阶段，第 01-07 课（分类、贝叶斯定理）
**时长：** 约 75 分钟

## 学习目标

- 从零实现带拉普拉斯平滑（Laplace smoothing）的多项式朴素贝叶斯（Multinomial Naive Bayes），用于文本分类
- 解释为何「朴素」的独立性假设在数学上是错误的，但在实践中却能产生正确的类别排序
- 比较多项式（Multinomial）、伯努利（Bernoulli）和高斯（Gaussian）三种朴素贝叶斯变体，并为给定的特征类型选出正确的那一个
- 在高维稀疏数据上将朴素贝叶斯与逻辑回归（logistic regression）对比评估，并解释其中起作用的偏差-方差权衡（bias-variance tradeoff）

## 问题所在

你需要对文本分类。把邮件分为垃圾邮件或非垃圾邮件；把用户评论分为正面或负面；把客服工单分到各个类别。你有成千上万个特征（每个词一个），而训练数据却很有限。

大多数分类器在这里都会卡住。逻辑回归需要足够多的样本才能可靠地估计成千上万个权重。决策树一次只在一个词上分裂，会疯狂地过拟合。在 10000 维空间里跑 KNN 毫无意义，因为每个点到其他任意点的距离都几乎相等。

朴素贝叶斯能搞定这件事。它做了一个数学上错误的假设（即给定类别后，每个特征与其他任何特征都相互独立），但在文本分类上它仍然胜过那些「更聪明」的模型，尤其是在训练集很小的时候。它只需对数据扫描一遍就能完成训练。它可以扩展到上百万个特征。它还能给出概率估计（不过由于独立性假设，这些概率通常校准得很差）。

理解为何一个错误的假设却能带来好的预测，会让你领悟到机器学习中某个根本性的东西：最好的模型不是最「正确」的那个，而是对你的数据具有最佳偏差-方差权衡的那个。

## 核心概念

### 贝叶斯定理（快速回顾）

贝叶斯定理用来翻转条件概率：

```
P(class | features) = P(features | class) * P(class) / P(features)
```

我们想要的是 `P(class | features)`——在给定文档中所含词语的条件下，该文档属于某个类别的概率。我们可以由以下几项计算出它：
- `P(features | class)`——在这个类别的文档中看到这些词的似然
- `P(class)`——该类别的先验概率（一般来说垃圾邮件有多常见？）
- `P(features)`——证据项，它对所有类别都相同，所以在做比较时可以忽略

`P(class | features)` 最高的那个类别胜出。

### 朴素独立性假设

要精确计算 `P(features | class)`，需要估计所有特征同时出现的联合概率。如果词表有 10000 个词，你就得估计一个覆盖 2^10000 种可能组合的分布。这不可能办到。

朴素假设是：给定类别后，每个特征都是条件独立的。

```
P(w1, w2, ..., wn | class) = P(w1 | class) * P(w2 | class) * ... * P(wn | class)
```

这样，你不再需要那个不可能算出来的联合分布，而是估计 n 个简单的单特征分布。每一个都只需要一次计数。

这个假设显然是错的。在任何文档里，「machine」和「learning」这两个词都不是相互独立的。但分类器并不需要正确的概率估计，它需要的是正确的排序——哪个类别的概率最高。独立性假设引入了系统性误差，但这些误差对所有类别的影响是类似的，所以排序仍然保持正确。

### 为什么它依然有效

有三个原因：

1. **排序优于校准。** 分类只需要排名第一的类别是正确的。即便真实概率是 0.7 时分类器算出 P(spam) = 0.99999，它仍然能正确地选中垃圾邮件。我们不需要正确的概率，我们需要的是正确的赢家。

2. **高偏差、低方差。** 独立性假设是一个很强的先验。它大幅约束了模型，从而防止过拟合。在训练数据有限时，一个略有偏差但稳定的模型，会胜过一个理论上正确却极不稳定的模型。这正是偏差-方差权衡在起作用。

3. **特征冗余会相互抵消。** 相关特征提供的是冗余证据。分类器会重复计算这份证据，但它对正确的类别同样会重复计算。如果「machine」和「learning」总是同时出现，那么它们都为「tech」类别提供证据。朴素贝叶斯把它们数了两遍，但它是为正确的类别数了两遍。

还有第四个实践层面的原因：朴素贝叶斯极快。训练只是对数据扫描一遍统计频次。预测则是一次矩阵乘法。你可以在几秒钟内对一百万篇文档完成训练。这种速度意味着你可以更快地迭代、尝试更多的特征集合、跑更多的实验——这是较慢的模型做不到的。

### 一步步推导数学

让我们走一遍一个具体的例子。假设我们有两个类别：垃圾邮件（spam）和非垃圾邮件（not-spam）。我们的词表有三个词：「free」、「money」、「meeting」。

训练数据：
- 垃圾邮件中「free」出现 80 次、「money」出现 60 次、「meeting」出现 10 次（总词数 150）
- 非垃圾邮件中「free」出现 5 次、「money」出现 10 次、「meeting」出现 100 次（总词数 115）
- 40% 的邮件是垃圾邮件，60% 是非垃圾邮件

使用拉普拉斯平滑（alpha=1）：

```
P(free | spam)    = (80 + 1) / (150 + 3) = 81/153 = 0.529
P(money | spam)   = (60 + 1) / (150 + 3) = 61/153 = 0.399
P(meeting | spam) = (10 + 1) / (150 + 3) = 11/153 = 0.072

P(free | not-spam)    = (5 + 1) / (115 + 3) = 6/118 = 0.051
P(money | not-spam)   = (10 + 1) / (115 + 3) = 11/118 = 0.093
P(meeting | not-spam) = (100 + 1) / (115 + 3) = 101/118 = 0.856
```

一封新邮件包含：「free」（2 次）、「money」（1 次）、「meeting」（0 次）。

```
log P(spam | email) = log(0.4) + 2*log(0.529) + 1*log(0.399) + 0*log(0.072)
                    = -0.916 + 2*(-0.637) + (-0.919) + 0
                    = -3.109

log P(not-spam | email) = log(0.6) + 2*log(0.051) + 1*log(0.093) + 0*log(0.856)
                        = -0.511 + 2*(-2.976) + (-2.375) + 0
                        = -8.838
```

垃圾邮件以巨大优势胜出。「free」出现两次是支持垃圾邮件的强证据。注意，「meeting」没有出现，它对两个对数和的贡献都是零（0 * log(P)）——在多项式朴素贝叶斯中，缺席的词没有任何影响。是伯努利朴素贝叶斯才会显式地对词的缺席进行建模。

### 三种变体

朴素贝叶斯有三种风味。每一种对 `P(feature | class)` 的建模方式都不同。

#### 多项式朴素贝叶斯（Multinomial Naive Bayes）

把每个特征建模为一个计数。最适合文本数据，其中特征是词频或 TF-IDF 值。

```
P(word_i | class) = (count of word_i in class + alpha) / (total words in class + alpha * vocab_size)
```

其中 `alpha` 是拉普拉斯平滑（下文会解释）。这个变体是文本分类的主力。

#### 高斯朴素贝叶斯（Gaussian Naive Bayes）

把每个特征建模为一个正态分布。最适合连续特征。

```
P(x_i | class) = (1 / sqrt(2 * pi * var)) * exp(-(x_i - mean)^2 / (2 * var))
```

每个类别在每个特征上都有自己的均值和方差。当特征在每个类别内部确实服从钟形曲线时，这种方法效果很好。

#### 伯努利朴素贝叶斯（Bernoulli Naive Bayes）

把每个特征建模为二值（出现或缺席）。最适合短文本或二值特征向量。

```
P(word_i | class) = (docs in class containing word_i + alpha) / (total docs in class + 2 * alpha)
```

与多项式不同，伯努利会显式地惩罚某个词的缺席。如果「free」通常出现在垃圾邮件中，但在这封邮件里没有出现，那么伯努利会把这一点算作反对垃圾邮件的证据。

### 何时使用每种变体

| 变体 | 特征类型 | 最适合 | 示例 |
|---------|-------------|----------|---------|
| Multinomial | 计数或频率 | 文本分类、词袋（bag-of-words） | 邮件垃圾过滤、主题分类 |
| Gaussian | 连续值 | 特征近似正态的表格数据 | 鸢尾花分类、传感器数据 |
| Bernoulli | 二值（0/1） | 短文本、二值特征向量 | 短信垃圾过滤、出现/缺席特征 |

### 拉普拉斯平滑

当某个词出现在测试数据里，但在某个特定类别的训练数据中从未出现过时，会发生什么？

不做平滑时：`P(word | class) = 0/N = 0`。一个零乘进整个连乘式，会让 `P(class | features) = 0`，无论其他所有证据如何。一个从未见过的词就能摧毁整个预测，不管有多少其他证据在支持它。

拉普拉斯平滑会给每个特征计数加上一个很小的计数 `alpha`（通常是 1）：

```
P(word_i | class) = (count(word_i, class) + alpha) / (total_words_in_class + alpha * vocab_size)
```

当 alpha=1 时，每个词都至少有一个极小的概率。出现在测试邮件中的「discombobulate」这个词不再会扼杀垃圾邮件的概率。这种平滑有一个贝叶斯解释：它等价于在词分布上放置一个均匀的狄利克雷（Dirichlet）先验。

alpha 越大，平滑越强（分布越均匀）。alpha 越小，模型越信任数据。alpha 是一个需要你调节的超参数。

alpha 的影响：

| Alpha | 影响 | 何时使用 |
|-------|--------|-------------|
| 0.001 | 几乎不平滑，信任数据 | 训练集非常大，预期没有未见过的特征 |
| 0.1 | 轻度平滑 | 训练集较大 |
| 1.0 | 标准拉普拉斯平滑 | 默认起点 |
| 10.0 | 重度平滑，拉平分布 | 训练集非常小，预期有许多未见过的特征 |

### 对数空间计算

把成百上千个概率（每个都小于 1）相乘会导致浮点下溢（underflow）。即使真实值是一个很小的正数，乘积在浮点表示中也会变成零。

解决办法是：在对数空间中计算。不是把概率相乘，而是把它们的对数相加：

```
log P(class | x1, x2, ..., xn) = log P(class) + sum_i log P(xi | class)
```

这就把预测变成了一次点积：

```
log_scores = X @ log_feature_probs.T + log_class_priors
prediction = argmax(log_scores)
```

就是矩阵乘法。这正是朴素贝叶斯预测如此之快的原因——它和单层线性模型做的是同一种运算。

### 朴素贝叶斯 vs 逻辑回归

两者都是用于文本的线性分类器。区别在于它们各自建模的对象。

| 方面 | 朴素贝叶斯 | 逻辑回归 |
|--------|------------|-------------------|
| 类型 | 生成式（建模 P(X\|Y)） | 判别式（建模 P(Y\|X)） |
| 训练 | 统计频次 | 优化损失函数 |
| 小数据 | 更好（强先验有帮助） | 更差（不足以估计权重） |
| 大数据 | 更差（错误假设拖后腿） | 更好（边界更灵活） |
| 特征 | 假设独立 | 能处理相关性 |
| 速度 | 单遍扫描，非常快 | 迭代优化 |
| 校准 | 概率较差 | 概率较好 |

经验法则：从朴素贝叶斯开始。如果你有足够的数据，且朴素贝叶斯的性能进入平台期，就切换到逻辑回归。

### 分类流水线

```mermaid
flowchart LR
    A[Raw Text] --> B[Tokenize]
    B --> C[Build Vocabulary]
    C --> D[Count Word Frequencies]
    D --> E[Apply Smoothing]
    E --> F[Compute Log Probabilities]
    F --> G[Predict: argmax P class given words]

    style A fill:#f9f,stroke:#333
    style G fill:#9f9,stroke:#333
```

在实践中，我们在对数空间中计算，以避免浮点下溢。不是把许多小概率相乘，而是把它们的对数相加：

```
log P(class | features) = log P(class) + sum_i log P(feature_i | class)
```

## 动手实现

`code/naive_bayes.py` 中的代码从零实现了 MultinomialNB 和 GaussianNB。

### MultinomialNB

从零实现的步骤：

1. **fit(X, y)**：对每个类别，统计每个特征的频次。加上拉普拉斯平滑。计算对数概率。存储类别先验（类别频率的对数）。

2. **predict_log_proba(X)**：对每个样本，对所有类别计算 log P(class) + sum of log P(feature_i | class)。这是一次矩阵乘法：X @ log_probs.T + log_priors。

3. **predict(X)**：返回对数概率最高的类别。

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

关键洞见是：拟合完成后，预测就只是矩阵乘法加上一个偏置项。这正是朴素贝叶斯如此之快的原因。

### GaussianNB

对于连续特征，我们对每个类别、每个特征估计均值和方差：

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

预测时，对每个特征使用高斯概率密度函数（PDF），并在各特征上相乘（在对数空间中相加）。

### 演示：文本分类

代码生成模拟两个类别（科技类文章 vs 体育类文章）的合成词袋数据。每个类别有不同的词频分布。MultinomialNB 使用词计数对它们进行分类。

这份合成数据是这样工作的：我们创建 200 个「词」（特征列）。第 0-39 号词在科技类文章中频率高、在体育类中频率低。第 80-119 号词在体育类中频率高、在科技类中频率低。第 40-79 号词在两类中都是中等频率。这就构造出一个真实的场景：有些词是强类别指示符，另一些则是噪声。

### 演示：连续特征

代码生成类似鸢尾花（Iris）的数据（3 个类别、4 个特征、高斯簇）。GaussianNB 使用每个类别的均值和方差进行分类。每个类别有不同的中心（均值向量）和不同的离散程度（方差），模拟现实世界中不同类别之间测量值系统性差异的数据。

代码还演示了：
- **平滑对比：** 用不同的 alpha 值训练 MultinomialNB，展示平滑强度对准确率的影响。
- **训练集规模实验：** 当训练数据从 20 个样本增长到 1600 个样本时，朴素贝叶斯的准确率如何提升。即便样本极少，朴素贝叶斯也能达到不错的准确率——这是它的主要优势。
- **混淆矩阵：** 各类别的精确率（precision）、召回率（recall）和 F1 分数，展示朴素贝叶斯在哪些地方出错。

### 预测速度

朴素贝叶斯的预测是一次矩阵乘法。对于 n 个样本、d 个特征、k 个类别：
- MultinomialNB：一次矩阵乘法 (n x d) @ (d x k) = O(n * d * k)
- GaussianNB：n * k 次高斯 PDF 求值，每次覆盖 d 个特征 = O(n * d * k)

两者在每个维度上都是线性的。把它和 KNN（需要计算到所有训练点的距离）或带 RBF 核的 SVM（需要对所有支持向量做核求值）相比。在预测阶段，朴素贝叶斯要快上几个数量级。

## 上手使用

在 sklearn 中，两种变体都是一行代码：

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

`naive_bayes.py` 中的代码会在相同数据上把从零实现与 sklearn 进行对比，以验证正确性。

### TF-IDF 与朴素贝叶斯

原始词计数让每个词的每次出现都拥有相同的权重。但像「the」和「is」这样的常见词在每个类别里都频繁出现——它们不携带任何信息。TF-IDF（词频-逆文档频率，Term Frequency - Inverse Document Frequency）会降低常见词的权重，并提升那些罕见、有区分度的词的权重。

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline

text_clf = Pipeline([
    ("tfidf", TfidfVectorizer()),
    ("classifier", MultinomialNB(alpha=0.1)),
])
```

TF-IDF 值是非负的，所以它们能与 MultinomialNB 配合使用。TF-IDF + MultinomialNB 的组合是文本分类最强的基线之一。在训练样本少于 10000 个的数据集上，它经常能击败更复杂的模型。

### 用于短文本的 BernoulliNB

对于短文本（推文、短信、聊天消息），BernoulliNB 可以胜过 MultinomialNB。短文本的词计数很低，所以 MultinomialNB 所依赖的频次信息会很嘈杂。BernoulliNB 只关心出现或缺席，这在短文本上更可靠。

```python
from sklearn.naive_bayes import BernoulliNB
from sklearn.feature_extraction.text import CountVectorizer

text_clf = Pipeline([
    ("vectorizer", CountVectorizer(binary=True)),
    ("classifier", BernoulliNB(alpha=1.0)),
])
```

CountVectorizer 中的 `binary=True` 标志会把所有计数转换为 0/1。没有它，BernoulliNB 仍然能工作，但它看到的是它本就不是为之设计的计数。

### 校准朴素贝叶斯的概率

朴素贝叶斯的概率校准得很差。当朴素贝叶斯说 P(spam) = 0.95 时，真实概率可能只有 0.7。如果你需要可靠的概率估计（比如用来设定阈值，或与其他模型组合），可以使用 sklearn 的 CalibratedClassifierCV：

```python
from sklearn.calibration import CalibratedClassifierCV

calibrated_nb = CalibratedClassifierCV(MultinomialNB(), cv=5, method="sigmoid")
calibrated_nb.fit(X_train, y_train)
proba = calibrated_nb.predict_proba(X_test)
```

它会用交叉验证在朴素贝叶斯的原始分数之上拟合一个逻辑回归。得到的概率会更接近真实的类别频率。

### 常见坑

1. **负的特征值。** MultinomialNB 要求特征非负。如果你有负值（比如某些设置下的 TF-IDF，或标准化后的特征），改用 GaussianNB，或者把特征平移到正值区间。

2. **零方差特征。** GaussianNB 会除以方差。如果某个特征在某个类别中方差为零（所有值都相同），概率计算就会崩溃。代码会给所有方差加上一个很小的平滑项（1e-9）来防止这种情况。

3. **类别不平衡。** 如果 99% 的邮件都是非垃圾邮件，那么先验 P(not-spam) = 0.99 强到足以压倒似然证据。你可以手动设置类别先验，或在 sklearn 中使用 class_prior 参数。

4. **特征缩放。** MultinomialNB 不需要缩放（它作用于计数）。GaussianNB 也不需要缩放（它估计的是每个特征的统计量）。这相对逻辑回归和 SVM 是一个优势，后两者对特征尺度很敏感。

## 交付成果

本课产出：
- `outputs/skill-naive-bayes-chooser.md`——一个用于挑选正确朴素贝叶斯变体的决策技能
- `code/naive_bayes.py`——从零实现的 MultinomialNB 和 GaussianNB，并与 sklearn 对比

### 朴素贝叶斯失效之时

当独立性假设导致排序错误（而不仅仅是概率错误）时，朴素贝叶斯就会失效。这种情况发生在：

1. **强特征交互。** 如果类别取决于两个特征的组合，而非任何单个特征（类似异或 XOR 的模式），朴素贝叶斯会完全错过它。单个特征本身不提供任何证据，而朴素贝叶斯无法以非线性方式把它们组合起来。

2. **高度相关且证据相反的特征。** 如果特征 A 说「spam」，特征 B 说「not-spam」，但 A 和 B 完全相关（现实中它们总是一致），朴素贝叶斯会看到本不存在的相互冲突的证据。

3. **非常大的训练集。** 有了足够的数据，逻辑回归这类判别式模型能学到真实的决策边界，从而超越朴素贝叶斯。曾在小数据上帮了忙的独立性假设，此时反而拖累了模型。

在实践中，对于文本分类，这些失效模式很少见。文本特征数量庞大、单个都很弱，且独立性假设的误差往往会相互抵消。对于特征少且存在强相关的表格数据，请优先考虑逻辑回归或基于树的模型。

## 练习

1. **平滑实验。** 在文本数据上用 0.01、0.1、1.0、10.0、100.0 这些 alpha 值训练 MultinomialNB。画出准确率随 alpha 变化的曲线。性能在哪里达到峰值？为什么过高的 alpha 会有害？

2. **特征独立性检验。** 取一个真实的文本数据集。挑两个明显相关的词（「machine」和「learning」）。计算 P(word1 | class) * P(word2 | class)，并与 P(word1 AND word2 | class) 比较。独立性假设错得有多离谱？它会影响分类准确率吗？

3. **伯努利实现。** 用一个 BernoulliNB 类来扩展代码。把词袋转换为二值（出现/缺席），并在文本数据上与 MultinomialNB 比较准确率。伯努利什么时候会胜出？

4. **朴素贝叶斯 vs 逻辑回归。** 在文本数据上同时训练两者。从 100 个训练样本开始，逐步增加到 10000 个。为两者画出准确率随训练集规模变化的曲线。逻辑回归在什么时候会反超朴素贝叶斯？

5. **垃圾邮件过滤器。** 构建一个完整的垃圾邮件分类器：对原始邮件文本分词、构建词表、创建词袋特征、训练 MultinomialNB、用精确率和召回率评估（而不仅仅是准确率——为什么？）。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|----------------------|
| 朴素贝叶斯（Naive Bayes） | 「简单的概率分类器」 | 一种应用贝叶斯定理的分类器，它假设在给定类别后特征条件独立 |
| 条件独立（Conditional independence） | 「特征之间互不影响」 | P(A, B \| C) = P(A \| C) * P(B \| C)——一旦你知道了 C，知道 B 不会告诉你任何关于 A 的新信息 |
| 拉普拉斯平滑（Laplace smoothing） | 「加一平滑」 | 给每个特征加上一个很小的计数，以防止零概率主宰整个预测 |
| 先验（Prior） | 「你看到数据之前的信念」 | P(class)——在观察任何特征之前每个类别的概率 |
| 似然（Likelihood） | 「数据拟合得有多好」 | P(features \| class)——在已知类别的情况下观察到这些特征的概率 |
| 后验（Posterior） | 「你看到数据之后的信念」 | P(class \| features)——在观察到特征之后该类别的更新概率 |
| 生成式模型（Generative model） | 「建模数据是如何生成的」 | 一种学习 P(X \| Y) 和 P(Y) 的模型，然后用贝叶斯定理得到 P(Y \| X) |
| 判别式模型（Discriminative model） | 「建模决策边界」 | 一种直接学习 P(Y \| X) 而不对 X 如何生成进行建模的模型 |
| 对数概率（Log probability） | 「避免下溢」 | 用 log P 而非 P 进行计算，以防止许多小数相乘在浮点中变为零 |

## 延伸阅读

- [scikit-learn 朴素贝叶斯文档](https://scikit-learn.org/stable/modules/naive_bayes.html)——三种变体及其数学细节
- [McCallum 和 Nigam，《A Comparison of Event Models for Naive Bayes Text Classification》(1998)](https://www.cs.cmu.edu/~knigam/papers/multinomial-aaaiws98.pdf)——多项式 vs 伯努利用于文本的经典对比
- [Rennie 等人，《Tackling the Poor Assumptions of Naive Bayes Text Classifiers》(2003)](https://people.csail.mit.edu/jrennie/papers/icml03-nb.pdf)——针对文本的朴素贝叶斯改进
- [Ng 和 Jordan，《On Discriminative vs. Generative Classifiers》(2001)](https://ai.stanford.edu/~ang/papers/nips01-discriminativegenerative.pdf)——证明在数据较少时朴素贝叶斯比逻辑回归收敛更快
