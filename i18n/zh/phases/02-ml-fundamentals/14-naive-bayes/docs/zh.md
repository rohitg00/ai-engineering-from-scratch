# 朴素贝叶斯

> "朴素"的假设是错的，但它依然有效。这正是它的美妙之处。

**Type:** Build
**Language:** Python
**Prerequisites:** Phase 2, Lessons 01-07（分类、贝叶斯定理）
**Time:** ~75 分钟

## 学习目标

- 从零实现带拉普拉斯平滑的多项式朴素贝叶斯，用于文本分类
- 解释为什么朴素的独立性假设在数学上是错的，但在实践中却能产生正确的类别排序
- 比较多项式、伯努利和高斯朴素贝叶斯三种变体，并针对给定特征类型选择合适的一种
- 在高维稀疏数据上将朴素贝叶斯与逻辑回归进行对比，并解释其中的偏差-方差权衡

## 问题

你需要对文本进行分类。把电子邮件分为垃圾邮件或非垃圾邮件。把客户评论分为正面或负面。把支持工单分类。你有数千个特征（每个词一个），而训练数据有限。

大多数分类器在这里都会失效。逻辑回归需要足够的样本才能可靠地估计数千个权重。决策树一次只按一个词切分，极易过拟合。在 10,000 维空间中的 KNN 毫无意义，因为每个点与其他所有点的距离都差不多。

朴素贝叶斯能应对这个问题。它做了一个数学上错误的假设（在给定类别的条件下，每个特征彼此独立），却仍然在文本分类上胜过“更聪明”的模型，尤其是在训练集很小的情况下。它只需对数据进行一次遍历即可完成训练。它可以扩展到数百万个特征。它能产生概率估计（尽管由于独立性假设，校准往往很差）。

理解为什么一个错误的假设能带来好的预测，会让你领会机器学习中一个根本的道理：最好的模型不是最正确的模型，而是针对你的数据拥有最佳偏差-方差权衡的模型。

## 概念

### 贝叶斯定理（快速回顾）

贝叶斯定理翻转条件概率：

```
P(class | features) = P(features | class) * P(class) / P(features)
```

我们想要 `P(class | features)` —— 即在给定文档中词语的条件下，文档属于某个类别的概率。我们可以由以下几项计算得出：
- `P(features | class)` —— 在该类别的文档中看到这些词的似然
- `P(class)` —— 该类别的先验概率（垃圾邮件总体上有多常见？）
- `P(features)` —— 证据项，对所有类别都相同，因此在比较时可以忽略

`P(class | features)` 最高的类别即为胜者。

### 朴素的独立性假设

精确计算 `P(features | class)` 需要估计所有特征的联合概率。当词汇量为 10,000 个词时，你需要估计一个覆盖 2^10,000 种可能组合的分布。这不可能。

朴素的假设是：在给定类别的条件下，每个特征条件独立。

```
P(w1, w2, ..., wn | class) = P(w1 | class) * P(w2 | class) * ... * P(wn | class)
```

这样就无需估计一个不可能的联合分布，而是估计 n 个简单的逐特征分布。每个分布只需要计数。

这个假设显然是错的。在任何文档中，"machine"和"learning"这两个词都不是独立的。但分类器并不需要正确的概率估计，它需要的是正确的排序——哪个类别的概率最高。独立性假设会引入系统性误差，但这些误差对所有类别的影响相似，因此排序仍然正确。

### 为什么它仍然有效

三个原因：

1. **要排序而非校准。** 分类只需要排名第一的类别正确。即使 P(spam) = 0.99999 而真实概率是 0.7，分类器仍然正确地选择了垃圾邮件。我们不需要正确的概率，我们需要的是正确的胜者。

2. **高偏差、低方差。** 独立性假设是一个强先验。它对模型施加了很强的约束，从而防止过拟合。在训练数据有限的情况下，一个略有偏差但稳定的模型胜过一个理论上正确但极不稳定的模型。这正是偏差-方差权衡的体现。

3. **特征冗余会相互抵消。** 相关特征提供冗余的证据。分类器会重复计算这些证据，但它也会为正确的类别重复计算。如果"machine"和"learning"总是同时出现，两者都为"tech"类别提供证据。朴素贝叶斯把它们计算了两次，但它是为正确的类别计算了两次。

还有第四个实际原因：朴素贝叶斯极其快速。训练只需对数据进行一次遍历统计频率。预测是一次矩阵乘法。你可以在几秒钟内对一百万个文档进行训练。这种速度意味着你可以更快地迭代、尝试更多特征集、运行比慢速模型更多的实验。

### 逐步推导数学过程

让我们跟踪一个具体的例子。假设有两个类别：垃圾邮件和非垃圾邮件。我们的词汇表有三个词："free"、"money"、"meeting"。

训练数据：
- 垃圾邮件提及"free" 80 次、"money" 60 次、"meeting" 10 次（共 150 个词）
- 非垃圾邮件提及"free" 5 次、"money" 10 次、"meeting" 100 次（共 115 个词）
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

新邮件包含："free"（2 次）、"money"（1 次）、"meeting"（0 次）。

```
log P(spam | email) = log(0.4) + 2*log(0.529) + 1*log(0.399) + 0*log(0.072)
                    = -0.916 + 2*(-0.637) + (-0.919) + 0
                    = -3.109

log P(not-spam | email) = log(0.6) + 2*log(0.051) + 1*log(0.093) + 0*log(0.856)
                        = -0.511 + 2*(-2.976) + (-2.375) + 0
                        = -8.838
```

垃圾邮件以较大优势胜出。"free"出现两次是支持垃圾邮件的有力证据。注意，"meeting"未出现对两个对数和的贡献均为零（0 * log(P)）——在多项式朴素贝叶斯中，缺失的词没有影响。显式建模词缺失的是伯努利朴素贝叶斯。

### 三种变体

朴素贝叶斯有三种变体，每种以不同方式建模 `P(feature | class)`。

#### 多项式朴素贝叶斯

将每个特征建模为计数。最适合特征为词频或 TF-IDF 值的文本数据。

```
P(word_i | class) = (count of word_i in class + alpha) / (total words in class + alpha * vocab_size)
```

其中 `alpha` 是拉普拉斯平滑（下文解释）。这一变体是文本分类的主力。

#### 高斯朴素贝叶斯

将每个特征建模为正态分布。最适合连续特征。

```
P(x_i | class) = (1 / sqrt(2 * pi * var)) * exp(-(x_i - mean)^2 / (2 * var))
```

每个类别对每个特征有自己的均值和方差。当特征在每个类别内确实服从钟形曲线时，这种方法效果很好。

#### 伯努利朴素贝叶斯

将每个特征建模为二值（出现或不出现）。最适合短文本或二值特征向量。

```
P(word_i | class) = (docs in class containing word_i + alpha) / (total docs in class + 2 * alpha)
```

与多项式朴素贝叶斯不同，伯努利朴素贝叶斯显式地惩罚词的缺失。如果"free"通常出现在垃圾邮件中，但这封邮件中没有它，伯努利朴素贝叶斯会将其视为反对垃圾邮件的证据。

### 何时使用哪种变体

| 变体 | 特征类型 | 最适合 | 示例 |
|---------|-------------|----------|---------|
| 多项式 | 计数或频率 | 文本分类、词袋模型 | 垃圾邮件过滤、主题分类 |
| 高斯 | 连续值 | 特征近似正态分布的表格数据 | 鸢尾花分类、传感器数据 |
| 伯努利 | 二值（0/1） | 短文本、二值特征向量 | 短信垃圾过滤、出现/缺失特征 |

### 拉普拉斯平滑

当某个词出现在测试数据中，但从未在某一类别的训练数据中出现过，会发生什么？

没有平滑时：`P(word | class) = 0/N = 0`。一个零乘进整个乘积会使 `P(class | features) = 0`，无论其他证据如何。单个未见过的词会摧毁整个预测，不管有多少其他证据支持它。

拉普拉斯平滑给每个特征计数加上一个小的计数 `alpha`（通常为 1）：

```
P(word_i | class) = (count(word_i, class) + alpha) / (total_words_in_class + alpha * vocab_size)
```

在 alpha=1 时，每个词至少有一个极小的概率。测试邮件中出现"discombobulate"这个词不再会杀死垃圾邮件的概率。这种平滑有一个贝叶斯解释：它等价于在词分布上放置一个均匀的 Dirichlet 先验。

更高的 alpha 意味着更强的平滑（分布更均匀）。更低的 alpha 意味着模型更信任数据。Alpha 是一个需要调节的超参数。

Alpha 的影响：

| Alpha | 效果 | 何时使用 |
|-------|--------|-------------|
| 0.001 | 几乎不平滑，信任数据 | 训练集非常大，预计不会出现未见过的特征 |
| 0.1 | 轻度平滑 | 大训练集 |
| 1.0 | 标准拉普拉斯平滑 | 默认起点 |
| 10.0 | 重度平滑，拉平分布 | 训练集非常小，预计会出现许多未见过的特征 |

### 对数空间计算

将数百个概率（每个都小于 1）相乘会导致浮点下溢。即使真实值是一个极小的正数，乘积在浮点数中也会变成零。

解决方案：在对数空间中工作。不将概率相乘，而是将它们的对数相加：

```
log P(class | x1, x2, ..., xn) = log P(class) + sum_i log P(xi | class)
```

这将预测转化为点积：

```
log_scores = X @ log_feature_probs.T + log_class_priors
prediction = argmax(log_scores)
```

矩阵乘法。这就是朴素贝叶斯预测如此快速的原因——它与单层线性模型的操作完全相同。

### 朴素贝叶斯 vs 逻辑回归

两者都是用于文本的线性分类器。区别在于它们建模的对象不同。

| 方面 | 朴素贝叶斯 | 逻辑回归 |
|--------|------------|-------------------|
| 类型 | 生成式（建模 P(X\|Y)） | 判别式（建模 P(Y\|X)） |
| 训练 | 统计频率 | 优化损失函数 |
| 小数据 | 更好（强先验有帮助） | 更差（样本不足以估计权重） |
| 大数据 | 更差（错误假设带来损害） | 更好（决策边界灵活） |
| 特征 | 假设独立 | 能处理相关性 |
| 速度 | 一次遍历，非常快 | 迭代优化 |
| 校准 | 概率较差 | 概率较好 |

经验法则：先从朴素贝叶斯开始。如果你有足够的数据而 NB 已到平台期，就切换到逻辑回归。

### 分类流程

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

在实践中，我们在对数空间中工作以避免浮点下溢。我们不将许多小概率相乘，而是将它们的对数相加：

```
log P(class | features) = log P(class) + sum_i log P(feature_i | class)
```

```figure
naive-bayes
```

## 动手实现

`code/naive_bayes.py` 中的代码从零实现了 MultinomialNB 和 GaussianNB。

### MultinomialNB

从零实现的步骤：

1. **fit(X, y)**：对每个类别，统计每个特征的频率。加上拉普拉斯平滑。计算对数概率。存储类别先验（类别频率的对数）。

2. **predict_log_proba(X)**：对每个样本，为所有类别计算 log P(class) + sum of log P(feature_i | class)。这是一次矩阵乘法：X @ log_probs.T + log_priors。

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

关键洞见：拟合之后，预测只是矩阵乘法加一个偏置。这就是朴素贝叶斯如此快速的原因。

### GaussianNB

对于连续特征，我们为每个类别、每个特征估计均值和方差：

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

预测时对每个特征使用高斯 PDF，并在各特征之间相乘（在对数空间中相加）。

### 演示：文本分类

代码生成合成的词袋数据，模拟两个类别（科技文章 vs 体育文章）。每个类别有不同的词频分布。MultinomialNB 使用词数对它们进行分类。

合成数据的工作方式如下：我们创建 200 个"词"（特征列）。词 0-39 在科技文章中频率高，在体育文章中频率低。词 80-119 在体育文章中频率高，在科技文章中频率低。词 40-79 在两者中频率均为中等。这创造了一个现实的场景：某些词是强类别指示器，而其他词是噪声。

### 演示：连续特征

代码生成类似 Iris 的数据（3 个类别、4 个特征、高斯簇）。GaussianNB 使用每个类别的均值和方差进行分类。每个类别有不同的中心（均值向量）和不同的散布（方差），模拟真实世界数据中不同类别之间测量值系统性差异的情况。

代码还演示了：
- **平滑对比：** 用不同的 alpha 值训练 MultinomialNB，展示平滑强度对准确率的影响。
- **训练规模实验：** NB 的准确率如何随着训练数据从 20 个样本增长到 1600 个样本而提升。即使在样本极少的情况下，NB 也能达到不错的准确率——这是它的主要优势。
- **混淆矩阵：** 每个类别的精确率、召回率和 F1 分数，展示 NB 在哪里犯错。

### 预测速度

朴素贝叶斯的预测是一次矩阵乘法。对于 n 个样本、d 个特征、k 个类别：
- MultinomialNB：一次矩阵乘法 (n x d) @ (d x k) = O(n * d * k)
- GaussianNB：n * k 次高斯 PDF 求值，每次遍历 d 个特征 = O(n * d * k)

两者在每个维度上都是线性的。相比之下，KNN（需要对所有训练点计算距离）或带 RBF 核的 SVM（需要对所有支持向量进行核求值）。NB 在预测时快了几个数量级。

## 使用

使用 sklearn，两种变体都只需一行代码：

```python
from sklearn.naive_bayes import GaussianNB, MultinomialNB

gnb = GaussianNB()
gnb.fit(X_train, y_train)
print(f"GaussianNB accuracy: {gnb.score(X_test, y_test):.3f}")

mnb = MultinomialNB(alpha=1.0)
mnb.fit(X_train_counts, y_train)
print(f"MultinomialNB accuracy: {mnb.score(X_test_counts, y_test):.3f}")
```

用 sklearn 进行文本分类：

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

`naive_bayes.py` 中的代码将在相同数据上把从零实现与 sklearn 进行对比，以验证正确性。

### TF-IDF 与朴素贝叶斯

原始词数对每次出现赋予每个词相同的权重。但像"the"和"is"这样的常用词在每个类别中都会频繁出现——它们不携带信息。TF-IDF（词频 - 逆文档频率）会降低常见词的权重，提高稀有的、有区分性的词的权重。

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline

text_clf = Pipeline([
    ("tfidf", TfidfVectorizer()),
    ("classifier", MultinomialNB(alpha=0.1)),
])
```

TF-IDF 值是非负的，因此可以与 MultinomialNB 配合使用。TF-IDF + MultinomialNB 的组合是文本分类最强的基线之一。在训练样本少于 10,000 的数据集上，它经常胜过更复杂的模型。

### 短文本使用 BernoulliNB

对于短文本（推文、短信、聊天消息），BernoulliNB 可能优于 MultinomialNB。短文本词数少，因此 MultinomialNB 所依赖的频率信息噪声较大。BernoulliNB 只关心出现与否，这在短文本上更可靠。

```python
from sklearn.naive_bayes import BernoulliNB
from sklearn.feature_extraction.text import CountVectorizer

text_clf = Pipeline([
    ("vectorizer", CountVectorizer(binary=True)),
    ("classifier", BernoulliNB(alpha=1.0)),
])
```

CountVectorizer 中的 `binary=True` 标志将所有计数转换为 0/1。如果没有它，BernoulliNB 仍然可以工作，但它看到的计数并非其设计所针对的输入。

### 校准 NB 概率

NB 的概率校准很差。当 NB 说 P(spam) = 0.95 时，真实概率可能是 0.7。如果你需要可靠的概率估计（例如，用于设置阈值或与其他模型结合），请使用 sklearn 的 CalibratedClassifierCV：

```python
from sklearn.calibration import CalibratedClassifierCV

calibrated_nb = CalibratedClassifierCV(MultinomialNB(), cv=5, method="sigmoid")
calibrated_nb.fit(X_train, y_train)
proba = calibrated_nb.predict_proba(X_test)
```

它使用交叉验证在 NB 的原始分数之上拟合一个逻辑回归。得到的概率更接近真实的类别频率。

### 常见陷阱

1. **负特征值。** MultinomialNB 要求特征非负。如果你有负值（如某些设置下的 TF-IDF 或标准化特征），请改用 GaussianNB，或将特征平移为正值。

2. **零方差特征。** GaussianNB 要除以方差。如果某个特征在某个类别中的方差为零（所有值相同），概率计算就会出错。代码在所有方差上加了小的平滑项（1e-9）以防止这种情况。

3. **类别不平衡。** 如果 99% 的邮件不是垃圾邮件，先验 P(not-spam) = 0.99 太强，会压倒似然证据。你可以手动设置类别先验，或使用 sklearn 中的 class_prior 参数。

4. **特征缩放。** MultinomialNB 不需要缩放（它处理的是计数）。GaussianNB 也不需要缩放（它估计的是逐特征统计量）。这是相对于对特征尺度敏感的逻辑回归和 SVM 的一个优势。

## 上线

本课产出：
- `outputs/skill-naive-bayes-chooser.md` —— 选择合适 NB 变体的决策技能
- `code/naive_bayes.py` —— 从零实现的 MultinomialNB 和 GaussianNB，以及与 sklearn 的对比

### 朴素贝叶斯何时失效

当独立性假设导致错误的排序（而不仅是错误的概率）时，NB 会失效。这发生在：

1. **强特征交互。** 如果类别取决于两个特征的组合而非任一单独特征（类似 XOR 的模式），NB 将完全无法捕捉。每个特征单独不提供任何证据，而 NB 无法非线性地组合它们。

2. **高度相关特征提供相反证据。** 如果特征 A 表明"垃圾邮件"，特征 B 表明"非垃圾邮件"，但 A 和 B 完全相关（现实中它们总是保持一致），NB 会看到并不存在的冲突证据。

3. **非常大的训练集。** 当数据足够多时，逻辑回归等判别式模型能学到真实的决策边界并胜过 NB。在小数据时帮了忙的独立性假设，此时反而拖累了模型。

在实践中，这些失效模式对于文本分类来说很少见。文本特征数量众多、各自微弱，且独立性假设的误差倾向于相互抵消。对于特征较少且强相关的表格数据，可优先考虑逻辑回归或基于树的模型。

## 练习

1. **平滑实验。** 在文本数据上用 alpha 值 0.01、0.1、1.0、10.0 和 100.0 训练 MultinomialNB。绘制准确率随 alpha 变化的曲线。性能在哪里达到峰值？为什么非常高的 alpha 会造成损害？

2. **特征独立性检验。** 取一个真实的文本数据集。挑选两个明显相关的词（"machine"和"learning"）。计算 P(word1 | class) * P(word2 | class)，并与 P(word1 AND word2 | class) 比较。独立性假设错了多少？它是否影响分类准确率？

3. **伯努利实现。** 在代码中扩展一个 BernoulliNB 类。将词袋转换为二值（出现/缺失），并在文本数据上与 MultinomialNB 比较准确率。伯努利什么时候胜出？

4. **NB vs 逻辑回归。** 在文本数据上训练两者。从 100 个训练样本开始，逐步增加到 10,000。绘制两者的准确率随训练集大小变化的曲线。逻辑回归在什么规模上超越朴素贝叶斯？

5. **垃圾邮件过滤器。** 构建一个完整的垃圾邮件分类器：对原始邮件文本分词、构建词汇表、创建词袋特征、训练 MultinomialNB，并用精确率和召回率进行评估（而不仅仅是准确率——为什么？）。

## 关键术语

| 术语 | 人们怎么说 | 它实际意味着什么 |
|------|----------------|----------------------|
| 朴素贝叶斯 | "简单的概率分类器" | 一种应用贝叶斯定理并假设在给定类别条件下特征相互独立的分类器 |
| 条件独立 | "特征之间互不影响" | P(A, B \| C) = P(A \| C) * P(B \| C) —— 一旦知道 C，知道 B 对 A 不提供任何新信息 |
| 拉普拉斯平滑 | "加一平滑" | 给每个特征加一个小的计数，防止零概率主导预测 |
| 先验 | "看到数据之前你相信什么" | P(class) —— 在观察任何特征之前各类别的概率 |
| 似然 | "数据拟合得有多好" | P(features \| class) —— 在已知类别的条件下观察到这些特征的概率 |
| 后验 | "看到数据之后你相信什么" | P(class \| features) —— 观察特征之后更新得到的类别概率 |
| 生成式模型 | "建模数据如何生成" | 学习 P(X \| Y) 和 P(Y)，然后利用贝叶斯定理得到 P(Y \| X) 的模型 |
| 判别式模型 | "建模决策边界" | 直接学习 P(Y \| X) 而不建模 X 如何生成的模型 |
| 对数概率 | "避免下溢" | 使用 log P 而不是 P，防止许多小数的乘积在浮点数中变为零 |

## 延伸阅读

- [scikit-learn 朴素贝叶斯文档](https://scikit-learn.org/stable/modules/naive_bayes.html) —— 包含数学细节的全部三种变体
- [McCallum and Nigam, A Comparison of Event Models for Naive Bayes Text Classification (1998)](https://www.cs.cmu.edu/~knigam/papers/multinomial-aaaiws98.pdf) —— 多项式与伯努利在文本上的经典对比
- [Rennie et al., Tackling the Poor Assumptions of Naive Bayes Text Classifiers (2003)](https://people.csail.mit.edu/jrennie/papers/icml03-nb.pdf) —— 针对文本的 NB 改进
- [Ng and Jordan, On Discriminative vs. Generative Classifiers (2001)](https://ai.stanford.edu/~ang/papers/nips01-discriminativegenerative.pdf) —— 证明了 NB 在数据较少时比 LR 收敛更快