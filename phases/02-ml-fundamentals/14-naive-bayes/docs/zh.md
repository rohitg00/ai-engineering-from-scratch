# 朴素贝叶斯

> "朴素"的假设是错误的，但它仍然有效。这就是它的美妙之处。

**类型：** 构建
**语言：** Python
**前置要求：** 第二阶段，第01-07课（分类、贝叶斯定理）
**时间：** ~75分钟

## 学习目标

- 从头实现带拉普拉斯平滑的多项式朴素贝叶斯（Multinomial Naive Bayes），用于文本分类
- 解释为什么朴素独立性假设在数学上是错误的，但在实践中能产生正确的类别排序
- 比较多项式、伯努利和高斯朴素贝叶斯变体，并为给定特征类型选择正确的变体
- 在高维稀疏数据上将朴素贝叶斯与逻辑回归进行比较，并解释其中起作用的偏差-方差权衡

## 问题

你需要对文本进行分类。将电子邮件分为垃圾邮件或非垃圾邮件。将客户评论分为正面或负面。将支持工单分类。你有数千个特征（每个词一个）和有限的训练数据。

大多数分类器在这里会失败。逻辑回归需要足够的样本来可靠地估计数千个权重。决策树一次在一个词上分裂，且严重过拟合。10000 维的 KNN 毫无意义，因为每个点与其他每个点都同样远。

朴素贝叶斯处理了这个问题。它做出了一个数学上错误的假设（即给定类别时每个特征与其他每个特征独立），并且在文本分类上仍然优于"更聪明"的模型，尤其是在训练集较小的情况下。它只需对数据进行一次遍历即可训练。它可以扩展到数百万个特征。它产生概率估计（尽管由于独立性假设，通常校准不佳）。

理解为什么一个错误的假设能导致好的预测，教会你关于机器学习的基本知识：最好的模型不是最正确的那个，而是对你的数据具有最佳偏差-方差权衡的那个。

## 概念

### 贝叶斯定理（快速回顾）

贝叶斯定理翻转了条件概率：

```
P(class | features) = P(features | class) * P(class) / P(features)
```

我们想要 `P(class | features)` —— 给定文档中的词语，它属于某个类别的概率。我们可以从以下计算得到：
- `P(features | class)` —— 在这个类别的文档中看到这些词的可能性
- `P(class)` —— 类别的先验概率（垃圾邮件总体上有多常见？）
- `P(features)` —— 证据，对所有类别相同，因此在比较时可以忽略

具有最高 `P(class | features)` 的类别胜出。

### 朴素独立性假设

精确计算 `P(features | class)` 需要估计所有特征联合的概率。对于一个有 10,000 个词的词汇表，你需要估计一个覆盖 2^10,000 种可能组合的分布。不可能。

朴素假设：给定类别时，每个特征条件独立。

```
P(w1, w2, ..., wn | class) = P(w1 | class) * P(w2 | class) * ... * P(wn | class)
```

不需要一个不可能的联合分布，你估计 n 个简单的每个特征分布。每个只需要一个计数。

这个假设显然是错误的。词语"machine"和"learning"在任何文档中都不是独立的。但分类器不需要正确的概率估计。它需要正确的排序——哪个类别具有最高的概率。独立性假设引入系统性误差，但这些误差对所有类别的影响相似，因此排序保持正确。

### 为什么它仍然有效

三个原因：

1. **排序优先于校准。** 分类只需要排名第一的类别正确。即使 P(spam) = 0.99999 而真实概率是 0.7，分类器仍然正确选择 spam。我们不需要正确的概率。我们需要正确的胜出者。

2. **高偏差，低方差。** 独立性假设是一个强先验。它严重约束了模型，从而防止了过拟合。在有限训练数据下，一个略微错误但稳定的模型胜过一个理论上正确但极不稳定的模型。这就是偏差-方差权衡在起作用。

3. **特征冗余相互抵消。** 相关特征提供冗余证据。分类器重复计算了这个证据，但它也为正确的类别重复计算了。如果"machine"和"learning"总是同时出现，两者都为"技术"类别提供证据。NB 把它们算了两次，但它是为正确的类别算了两次。

第四个实际原因：朴素贝叶斯非常快。训练是对数据进行一次遍历来计数频率。预测是矩阵乘法。你可以在几秒钟内训练一百万个文档。这种速度意味着你可以更快地迭代，尝试更多特征集，并进行比慢速模型更多的实验。

### 逐步数学推导

让我们跟踪一个具体例子。假设我们有两个类别：spam 和 not-spam。我们的词汇表有三个词："free"、"money"、"meeting"。

训练数据：
- Spam 邮件提到"free" 80 次、"money" 60 次、"meeting" 10 次（总共 150 个词）
- Not-spam 邮件提到"free" 5 次、"money" 10 次、"meeting" 100 次（总共 115 个词）
- 40% 的邮件是 spam，60% 是 not-spam

使用拉普拉斯平滑（alpha=1）：

```
P(free | spam)    = (80 + 1) / (150 + 3) = 81/153 = 0.529
P(money | spam)   = (60 + 1) / (150 + 3) = 61/153 = 0.399
P(meeting | spam) = (10 + 1) / (150 + 3) = 11/153 = 0.072

P(free | not-spam)    = (5 + 1) / (115 + 3) = 6/118 = 0.051
P(money | not-spam)   = (10 + 1) / (115 + 3) = 11/118 = 0.093
P(meeting | not-spam) = (100 + 1) / (115 + 3) = 101/118 = 0.856
```

新邮件包含："free"（2次）、"money"（1次）、"meeting"（0次）。

```
log P(spam | email) = log(0.4) + 2*log(0.529) + 1*log(0.399) + 0*log(0.072)
                    = -0.916 + 2*(-0.637) + (-0.919) + 0
                    = -3.109

log P(not-spam | email) = log(0.6) + 2*log(0.051) + 1*log(0.093) + 0*log(0.856)
                        = -0.511 + 2*(-2.976) + (-2.375) + 0
                        = -8.838
```

Spam 以很大优势胜出。"free"出现两次是 spam 的有力证据。注意"meeting"没有出现对两个对数求和贡献为零（0 * log(P)）——在多项式 NB 中，不存在的词没有影响。是伯努利 NB 显式地建模了词的缺失。

### 三种变体

朴素贝叶斯有三种形式。每种对 `P(feature | class)` 的建模方式不同。

#### 多项式朴素贝叶斯（Multinomial Naive Bayes）

将每个特征建模为计数。最适合特征是词频或 TF-IDF 值的文本数据。

```
P(word_i | class) = (word_i 在类别中的计数 + alpha) / (类别中的总词数 + alpha * vocab_size)
```

`alpha` 是拉普拉斯平滑（下面解释）。这个变体是文本分类的主力。

#### 高斯朴素贝叶斯（Gaussian Naive Bayes）

将每个特征建模为正态分布。最适合连续特征。

```
P(x_i | class) = (1 / sqrt(2 * pi * var)) * exp(-(x_i - mean)^2 / (2 * var))
```

每个类别每个特征获得自己的均值和方差。当特征在每个类别内确实遵循钟形曲线时，这很有效。

#### 伯努利朴素贝叶斯（Bernoulli Naive Bayes）

将每个特征建模为二进制（存在或不存在）。最适合短文本或二进制特征向量。

```
P(word_i | class) = (包含 word_i 的类别文档数 + alpha) / (类别中总文档数 + 2 * alpha)
```

与多项式不同，伯努利明确惩罚了词的缺失。如果"free"通常出现在 spam 中，但在这封邮件中不存在，伯努利将其算作反对 spam 的证据。

### 何时使用每种变体

| 变体 | 特征类型 | 最适合 | 示例 |
|---------|-------------|----------|---------|
| 多项式 | 计数或频率 | 文本分类，词袋模型 | 邮件垃圾邮件、主题分类 |
| 高斯 | 连续值 | 具有近似正态特征的表格数据 | Iris 分类、传感器数据 |
| 伯努利 | 二进制（0/1） | 短文本、二进制特征向量 | 短信垃圾邮件、存在/不存在特征 |

### 拉普拉斯平滑

当测试数据中出现一个词，但在训练数据中某个类别从未出现过该词，会发生什么？

没有平滑：`P(word | class) = 0/N = 0`。一个零乘遍整个乘积使得 `P(class | features) = 0`，无论所有其他证据如何。单个未见过的词就摧毁了整个预测，无论有多少其他证据支持它。

拉普拉斯平滑向每个特征计数添加一个小计数 `alpha`（通常为 1）：

```
P(word_i | class) = (count(word_i, class) + alpha) / (total_words_in_class + alpha * vocab_size)
```

使用 alpha=1，每个词至少获得一个极小的概率。测试邮件中出现词"discombobulate"不再杀死 spam 概率。平滑有贝叶斯解释：它等同于在词分布上放置一个均匀的 Dirichlet 先验。

更高的 alpha 意味着更强的平滑（更均匀的分布）。更低的 alpha 意味着模型更信任数据。Alpha 是一个你需要调优的超参数。

Alpha 的效果：

| Alpha | 效果 | 何时使用 |
|-------|--------|-------------|
| 0.001 | 几乎不平滑，信任数据 | 非常大的训练集，预期没有未见过的特征 |
| 0.1 | 轻度平滑 | 大训练集 |
| 1.0 | 标准拉普拉斯平滑 | 默认起始点 |
| 10.0 | 强平滑，平坦分布 | 非常小的训练集，预期有许多未见过的特征 |

### 对数空间计算

将数百个概率（每个小于 1）相乘会导致浮点数下溢。即使真实值是一个非常小的正数，这个乘积在浮点数中也会变成零。

解决方案：在对数空间中工作。不是相乘概率，而是相加它们的对数：

```
log P(class | x1, x2, ..., xn) = log P(class) + sum_i log P(xi | class)
```

这使预测变成了点积：

```
log_scores = X @ log_feature_probs.T + log_class_priors
prediction = argmax(log_scores)
```

矩阵乘法。这就是为什么朴素贝叶斯预测如此之快——它与单层线性模型是相同的操作。

### 朴素贝叶斯 vs 逻辑回归

两者都是用于文本的线性分类器。区别在于它们建模什么。

| 方面 | 朴素贝叶斯 | 逻辑回归 |
|--------|------------|-------------------|
| 类型 | 生成式（建模 P(X\|Y)） | 判别式（建模 P(Y\|X)） |
| 训练 | 计数频率 | 优化损失函数 |
| 小数据 | 更好（强先验有帮助） | 更差（不足以估计权重） |
| 大数据 | 更差（错误假设有害） | 更好（灵活的边界） |
| 特征 | 假设独立 | 处理相关性 |
| 速度 | 单次遍历，非常快 | 迭代优化 |
| 校准 | 概率差 | 概率更好 |

经验法则：从朴素贝叶斯开始。如果有足够数据且 NB 达到平台期，切换到逻辑回归。

### 分类管道

```mermaid
flowchart LR
    A[原始文本] --> B[分词]
    B --> C[构建词汇表]
    C --> D[统计词频]
    D --> E[应用平滑]
    E --> F[计算对数概率]
    F --> G[预测：argmax P(类别|词)]

    style A fill:#f9f,stroke:#333
    style G fill:#9f9,stroke:#333
```

在实践中，我们使用对数空间以避免浮点数下溢。不是将许多小概率相乘，而是相加它们的对数：

```
log P(class | features) = log P(class) + sum_i log P(feature_i | class)
```

```figure
naive-bayes
```

## 动手实现

`code/naive_bayes.py` 中的代码从头实现了 MultinomialNB 和 GaussianNB。

### MultinomialNB

从头实现：

1. **fit(X, y)**：对每个类别，统计每个特征的频率。添加拉普拉斯平滑。计算对数概率。存储类别先验（类别频率的对数）。

2. **predict_log_proba(X)**：对每个样本，计算 log P(class) + 对所有类别的 sum log P(feature_i | class)。这是一个矩阵乘法：X @ log_probs.T + log_priors。

3. **predict(X)**：返回具有最高对数概率的类别。

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

关键洞察：拟合后，预测就是矩阵乘法加上偏置。这就是为什么朴素贝叶斯如此之快。

### GaussianNB

对于连续特征，我们为每个类别的每个特征估计均值和方差：

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

预测使用每个特征的高斯 PDF，跨特征相乘（在对数空间中相加）。

### 演示：文本分类

代码生成合成词袋数据，模拟两个类别（技术文章 vs 体育文章）。每个类别有不同的词频分布。MultinomialNB 使用词计数对它们进行分类。

合成数据的工作方式：我们创建 200 个"词"（特征列）。词 0-39 在技术文章中高频，在体育文章中低频。词 80-119 在体育文章中高频，在技术文章中低频。词 40-79 在两者中都是中频。这创建了一个现实场景，其中一些词是强类别指标，其他是噪声。

### 演示：连续特征

代码生成类似 Iris 的数据（3 个类别、4 个特征、高斯簇）。GaussianNB 使用每个类别的均值和方差进行分类。每个类别有不同的中心（均值向量）和不同的离散程度（方差），模拟了真实世界中测量值在类别之间存在系统性差异的数据。

代码还演示了：
- **平滑比较：** 使用不同 alpha 值训练 MultinomialNB，展示平滑强度对准确率的影响。
- **训练规模实验：** NB 准确率如何随着训练数据从 20 增长到 1600 个样本而改善。即使样本非常少，NB 也能达到不错的准确率——这是它的主要优势。
- **混淆矩阵：** 每个类别的精确率、召回率和 F1 分数，展示 NB 在哪里犯错。

### 预测速度

朴素贝叶斯预测是一个矩阵乘法。对于 n 个样本，d 个特征和 k 个类别：
- MultinomialNB：一次矩阵乘法 (n x d) @ (d x k) = O(n * d * k)
- GaussianNB：n * k 次高斯 PDF 评估，每次覆盖 d 个特征 = O(n * d * k)

两者在每个维度上都是线性的。比较一下 KNN（需要计算到所有训练点的距离）或带有 RBF 核的 SVM（需要与所有支持向量进行核评估）。NB 在预测时快了几个数量级。

## 使用它

使用 sklearn，两个变体都是一行代码：

```python
from sklearn.naive_bayes import GaussianNB, MultinomialNB

gnb = GaussianNB()
gnb.fit(X_train, y_train)
print(f"高斯NB准确率：{gnb.score(X_test, y_test):.3f}")

mnb = MultinomialNB(alpha=1.0)
mnb.fit(X_train_counts, y_train)
print(f"多项式NB准确率：{mnb.score(X_test_counts, y_test):.3f}")
```

使用 sklearn 进行文本分类：

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

`naive_bayes.py` 中的代码将从头实现的版本与 sklearn 在相同数据上进行比较，以验证正确性。

### TF-IDF 与朴素贝叶斯

原始词计数赋予每个词每次出现相等的权重。但像"the"和"is"这样的常见词在每个类别中频繁出现——它们不携带信息。TF-IDF（词频-逆文档频率）降低常见词的权重，提高罕见、有判别力的词的权重。

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline

text_clf = Pipeline([
    ("tfidf", TfidfVectorizer()),
    ("classifier", MultinomialNB(alpha=0.1)),
])
```

TF-IDF 值是非负的，因此它们与 MultinomialNB 兼容。TF-IDF + MultinomialNB 的组合是文本分类最强的基线之一。在训练样本少于 10,000 的数据集上，它经常击败更复杂的模型。

### 用于短文本的 BernoulliNB

对于短文本（推文、短信、聊天消息），BernoulliNB 可以优于 MultinomialNB。短文本的词计数低，因此 MultinomialNB 依赖的频率信息有噪声。BernoulliNB 只关心存在或不存在，这对于短文本更可靠。

```python
from sklearn.naive_bayes import BernoulliNB
from sklearn.feature_extraction.text import CountVectorizer

text_clf = Pipeline([
    ("vectorizer", CountVectorizer(binary=True)),
    ("classifier", BernoulliNB(alpha=1.0)),
])
```

CountVectorizer 中的 `binary=True` 标志将所有计数转换为 0/1。没有它，BernoulliNB 仍然可以工作，但看到的是它并非为此设计的计数。

### 校准 NB 概率

NB 概率校准不佳。当 NB 说 P(spam) = 0.95 时，真实概率可能只有 0.7。如果你需要可靠的概率估计（例如，设置阈值或与其他模型组合），使用 sklearn 的 CalibratedClassifierCV：

```python
from sklearn.calibration import CalibratedClassifierCV

calibrated_nb = CalibratedClassifierCV(MultinomialNB(), cv=5, method="sigmoid")
calibrated_nb.fit(X_train, y_train)
proba = calibrated_nb.predict_proba(X_test)
```

这通过交叉验证在 NB 的原始分数之上拟合了一个逻辑回归。得到的概率更接近真实的类别频率。

### 常见陷阱

1. **负特征值。** MultinomialNB 需要非负特征。如果你有负值（如某些设置下的 TF-IDF 或标准化特征），改用 GaussianNB，或将特征平移为正数。

2. **零方差特征。** GaussianNB 除以方差。如果一个特征对某个类别的方差为零（所有值相同），概率计算会出问题。代码向所有方差添加了一个小的平滑项（1e-9）来防止这种情况。

3. **类别不平衡。** 如果 99% 的邮件不是垃圾邮件，先验 P(not-spam) = 0.99 太强，会压倒似然证据。你可以手动设置类别先验，或在 sklearn 中使用 class_prior 参数。

4. **特征缩放。** MultinomialNB 不需要缩放（它处理计数）。GaussianNB 也不需要缩放（它估计每个特征的统计量）。这是相对于逻辑回归和 SVM 的优势，后两者对特征尺度敏感。

## 交付使用

本课程产出：
- `outputs/skill-naive-bayes-chooser.md` -- 选择正确 NB 变体的决策技能
- `code/naive_bayes.py` -- 从零实现的 MultinomialNB 和 GaussianNB，附带 sklearn 比较

### 朴素贝叶斯何时失败

当独立性假设导致不正确的排序（而不仅仅是不正确的概率）时，NB 会失败。这发生在：

1. **强特征交互。** 如果类别取决于两个特征的组合而不是任何一个单独的特征（XOR 类模式），NB 将完全错过它。每个特征单独不提供证据，而 NB 不能非线性地组合它们。

2. **具有相反证据的高度相关特征。** 如果特征 A 说"spam"而特征 B 说"not-spam"，但 A 和 B 完全相关（它们实际上总是一致的），NB 会看到本不存在的冲突证据。

3. **非常大的训练集。** 有了足够的数据，像逻辑回归这样的判别式模型能学习到真实的决策边界，并优于 NB。在小数据时帮助了模型的独立性假设现在限制了它。

在实践中，这些失败模式在文本分类中很少见。文本特征数量多、单独弱，且独立性假设的误差倾向于相互抵消。对于具有少量强相关特征的表格数据，请首先考虑逻辑回归或基于树的模型。

## 练习题

1. **平滑实验。** 在文本数据上使用 alpha 值 0.01、0.1、1.0、10.0 和 100.0 训练 MultinomialNB。绘制准确率 vs alpha 图。性能在哪里达到峰值？为什么非常高的 alpha 有害？
2. **特征独立性测试。** 取一个真实文本数据集。选择两个明显相关的词（如"machine"和"learning"）。计算 P(word1 | class) * P(word2 | class) 并与 P(word1 AND word2 | class) 比较。独立性假设错得有多离谱？它会影响分类准确率吗？
3. **伯努利实现。** 用 BernoulliNB 类扩展代码。将词袋转换为二进制（存在/不存在）并与文本数据上的 MultinomialNB 比较准确率。伯努利何时胜出？
4. **NB vs 逻辑回归。** 两者都在文本数据上训练。从 100 个训练样本开始，增加到 10,000。绘制两者准确率 vs 训练集大小的图。逻辑回归在哪个点超过朴素贝叶斯？
5. **垃圾邮件过滤器。** 构建一个完整的垃圾邮件分类器：对原始邮件文本进行分词、构建词汇表、创建词袋特征、训练 MultinomialNB、用精确率和召回率评估（而不仅仅是准确率——为什么？）。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| 朴素贝叶斯（Naive Bayes） | "简单的概率分类器" | 应用贝叶斯定理并假设给定类别时特征条件独立的分类器 |
| 条件独立（Conditional independence） | "特征互不影响" | P(A, B \| C) = P(A \| C) * P(B \| C)——知道 C 后，知道 B 不会告诉你关于 A 的任何新信息 |
| 拉普拉斯平滑（Laplace smoothing） | "加一平滑" | 向每个特征添加小计数，防止零概率主导预测 |
| 先验（Prior） | "看到数据前你相信的" | P(class)——在观察任何特征之前每个类别的概率 |
| 似然（Likelihood） | "数据拟合得如何" | P(features \| class)——如果知道类别，观察到这些特征的概率 |
| 后验（Posterior） | "看到数据后你相信的" | P(class \| features)——观察特征后类别的更新概率 |
| 生成式模型（Generative model） | "建模数据如何生成" | 学习 P(X \| Y) 和 P(Y)，然后使用贝叶斯定理得到 P(Y \| X) 的模型 |
| 判别式模型（Discriminative model） | "建模决策边界" | 直接学习 P(Y \| X) 而不建模 X 如何生成的模型 |
| 对数概率（Log probability） | "避免下溢" | 使用 log P 而不是 P，以防止许多小数的乘积在浮点数中变为零 |

## 延伸阅读

- [scikit-learn Naive Bayes docs](https://scikit-learn.org/stable/modules/naive_bayes.html) -- 所有三种变体的数学细节
- [McCallum and Nigam, A Comparison of Event Models for Naive Bayes Text Classification (1998)](https://www.cs.cmu.edu/~knigam/papers/multinomial-aaaiws98.pdf) -- 文本分类中多项式 vs 伯努利的经典比较
- [Rennie et al., Tackling the Poor Assumptions of Naive Bayes Text Classifiers (2003)](https://people.csail.mit.edu/jrennie/papers/icml03-nb.pdf) -- 文本 NB 的改进
- [Ng and Jordan, On Discriminative vs. Generative Classifiers (2001)](https://ai.stanford.edu/~ang/papers/nips01-discriminativegenerative.pdf) -- 证明 NB 用更少数据比 LR 收敛更快
