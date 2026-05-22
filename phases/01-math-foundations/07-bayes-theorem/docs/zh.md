# 贝叶斯定理（Bayes' Theorem）

> 概率论关乎你所期望的。贝叶斯定理关乎你所学习的。

**类型：** 构建
**语言：** Python
**前置条件：** 阶段1，第06课（概率基础）
**时长：** ~75分钟

## 学习目标

- 应用贝叶斯定理，根据先验、似然和证据计算后验概率
- 从头构建一个朴素贝叶斯文本分类器，包含拉普拉斯平滑和对数空间计算
- 比较极大似然估计（MLE）和极大后验估计（MAP），并解释MAP如何对应L2正则化
- 使用Beta-二项共轭先验实现A/B测试的顺序贝叶斯更新

## 问题

一项医学检测的准确率为99%。你检测结果呈阳性。你实际患病的概率是多少？

大多数人会说99%。真正的答案取决于这种疾病的罕见程度。如果每10000人中只有1人患病，那么阳性结果仅意味着大约1%的患病概率。其余99%的阳性结果是来自健康人的假警报。

这不是一个脑筋急转弯题。这就是贝叶斯定理。每一个垃圾邮件过滤器，每一个医学诊断，每一个量化不确定性的机器学习模型，都使用完全相同的推理。你从一个信念开始。你看到证据。你进行更新。

如果你在构建机器学习系统时不理解这一点，你将误解模型输出，设置错误的阈值，并发布过度自信的预测。

## 概念

### 从联合概率到贝叶斯

你在第06课已经知道条件概率是：

```
P(A|B) = P(A 且 B) / P(B)
```

对称地：

```
P(B|A) = P(A 且 B) / P(A)
```

两个表达式共享相同的分子：P(A 且 B)。将两者相等并重新整理：

```
P(A 且 B) = P(A|B) * P(B) = P(B|A) * P(A)

因此：

P(A|B) = P(B|A) * P(A) / P(B)
```

这就是贝叶斯定理。四个量，一个等式。

### 四个部分

| 部分 | 名称 | 含义 |
|------|------|------|
| P(A\|B) | 后验（Posterior） | 看到证据B后，你对A更新后的信念 |
| P(B\|A) | 似然（Likelihood） | 如果A为真，证据B出现的概率 |
| P(A) | 先验（Prior） | 看到任何证据之前，你对A的信念 |
| P(B) | 证据（Evidence） | 在所有可能性下看到B的总概率 |

证据项P(B)作为归一化因子。你可以用全概率公式展开它：

```
P(B) = P(B|A) * P(A) + P(B|非A) * P(非A)
```

### 医学检测示例

一种疾病影响每10000人中的1人。检测准确率为99%（能检出99%的患病者，假阳性率为1%）。

```
P(患病)          = 0.0001     (先验：疾病罕见)
P(阳性|患病) = 0.99       (似然：检测能检出)
P(阳性|健康) = 0.01    (假阳性率)

P(阳性) = P(阳性|患病) * P(患病) + P(阳性|健康) * P(健康)
            = 0.99 * 0.0001 + 0.01 * 0.9999
            = 0.000099 + 0.009999
            = 0.010098

P(患病|阳性) = P(阳性|患病) * P(患病) / P(阳性)
                 = 0.99 * 0.0001 / 0.010098
                 = 0.0098
                 = 0.98%
```

不到1%。先验占主导地位。当一个条件罕见时，即使准确的检测也主要产生假阳性。这就是为什么医生会要求确认检测。

### 垃圾邮件过滤器示例

你收到一封包含“lottery”一词的电子邮件。它是垃圾邮件吗？

```
P(垃圾邮件)                = 0.3      (30%的电子邮件是垃圾邮件)
P("lottery"|垃圾邮件)      = 0.05     (5%的垃圾邮件包含"lottery")
P("lottery"|非垃圾邮件)  = 0.001    (0.1%的合法邮件包含"lottery")

P("lottery") = 0.05 * 0.3 + 0.001 * 0.7
             = 0.015 + 0.0007
             = 0.0157

P(垃圾邮件|"lottery") = 0.05 * 0.3 / 0.0157
                  = 0.955
                  = 95.5%
```

一个词就将概率从30%提升到95.5%。真正的垃圾邮件过滤器同时跨数百个词应用贝叶斯定理。

### 朴素贝叶斯：独立性假设

朴素贝叶斯通过假设在给定类别的情况下所有特征条件独立，将贝叶斯定理扩展到多个特征：

```
P(类别 | 特征_1, 特征_2, ..., 特征_n)
  = P(类别) * P(特征_1|类别) * P(特征_2|类别) * ... * P(特征_n|类别)
    / P(特征_1, 特征_2, ..., 特征_n)
```

“朴素”的部分就是独立性假设。在文本中，词的出现并非独立（“New”和“York”是相关的）。但在实践中，这个假设效果出奇地好，因为分类器只需要对类别进行排序，而不是产生校准的概率。

由于分母对所有类别相同，你可以忽略它，只比较分子：

```
得分(类别) = P(类别) * P(特征_i | 类别) 的乘积
```

选择得分最高的类别。

### 极大似然估计（MLE）

如何从训练数据中获得P(特征|类别)？计数。

```
P("免费"|垃圾邮件) = (包含"免费"的垃圾邮件数量) / (垃圾邮件总数)
```

这就是MLE：选择使观测数据最有可能的参数值。你是在最大化似然函数，对于离散计数，它简化为相对频率。

问题：如果一个词在训练期间从未出现在垃圾邮件中，MLE会赋予它零概率。一个未见过的词就会毁掉整个乘积。使用拉普拉斯平滑修复此问题：

```
P(词|类别) = (count(词, 类别) + 1) / (类别中总词数 + 词汇表大小)
```

对每个计数加1，确保没有概率为零。

### 极大后验估计（MAP）

MLE问：什么参数最大化P(数据|参数)？

MAP问：什么参数最大化P(参数|数据)？

根据贝叶斯定理：

```
P(参数|数据) 正比于 P(数据|参数) * P(参数)
```

MAP在参数本身之上添加了一个先验。如果你认为参数应该很小，你可以将其编码为一个惩罚较大值的先验。这与机器学习中的L2正则化相同。岭回归中的“岭”惩罚本质上是一个关于权重的高斯先验。

| 估计方法 | 优化目标 | 机器学习等价 |
|------------|-----------|---------------|
| MLE | P(数据\|参数) | 无正则化的训练 |
| MAP | P(数据\|参数) * P(参数) | L2 / L1 正则化 |

### 贝叶斯学派 vs 频率学派：实际差异

频率学派将参数视为固定未知量。他们问：“如果我反复进行这个实验很多次，会发生什么？”

贝叶斯学派将参数视为分布。他们问：“根据我观察到的情况，我对参数有什么信念？”

对于构建机器学习系统，实际差异如下：

| 方面 | 频率学派 | 贝叶斯学派 |
|--------|-------------|----------|
| 输出 | 点估计 | 值的分布 |
| 不确定性 | 置信区间（关于过程） | 可信区间（关于参数） |
| 小数据 | 可能过拟合 | 先验充当正则化 |
| 计算 | 通常较快 | 通常需要采样（MCMC） |

大多数生产级机器学习是频率学派的（SGD，点估计）。贝叶斯方法在需要校准的不确定性（医疗决策，安全关键系统）或数据稀缺（少样本学习，冷启动）时表现出色。

### 为什么贝叶斯思维对机器学习很重要

这种联系比类比更深刻：

**先验就是正则化。** 权重上的高斯先验是L2正则化。拉普拉斯先验是L1。每次你添加一个正则化项，你都在做出关于你期望的参数值的贝叶斯声明。

**后验就是不确定性。** 单一的预测概率无法告诉你模型对该估计有多少信心。贝叶斯方法为你提供了一个分布：“我认为P(垃圾邮件)在0.8到0.95之间。”

**贝叶斯更新就是在在线学习。** 今天的后验成为明天的先验。当你的模型看到新数据时，它会增量更新其信念，而不是从头重新训练。

**模型比较就是贝叶斯式的。** 贝叶斯信息准则（BIC）、边际似然和贝叶斯因子都使用贝叶斯推理在模型之间进行选择，而不会过拟合。

## 动手构建

### 第1步：贝叶斯定理函数

```python
def bayes(prior, likelihood, false_positive_rate):
    evidence = likelihood * prior + false_positive_rate * (1 - prior)
    posterior = likelihood * prior / evidence
    return posterior

result = bayes(prior=0.0001, likelihood=0.99, false_positive_rate=0.01)
print(f"P(sick|positive) = {result:.4f}")
```

### 第2步：朴素贝叶斯分类器

```python
import math
from collections import defaultdict

class NaiveBayes:
    def __init__(self, smoothing=1.0):
        self.smoothing = smoothing  # 平滑系数
        self.class_counts = defaultdict(int)  # 每个类别的文档数
        self.word_counts = defaultdict(lambda: defaultdict(int))  # 每个类别下每个词的计数
        self.class_word_totals = defaultdict(int)  # 每个类别的总词数
        self.vocab = set()  # 词汇表

    def train(self, documents, labels):
        for doc, label in zip(documents, labels):
            self.class_counts[label] += 1
            words = doc.lower().split()
            for word in words:
                self.word_counts[label][word] += 1
                self.class_word_totals[label] += 1
                self.vocab.add(word)

    def predict(self, document):
        words = document.lower().split()
        total_docs = sum(self.class_counts.values())
        vocab_size = len(self.vocab)
        best_class = None
        best_score = float("-inf")
        for cls in self.class_counts:
            # 对数先验
            score = math.log(self.class_counts[cls] / total_docs)
            for word in words:
                count = self.word_counts[cls].get(word, 0)
                total = self.class_word_totals[cls]
                # 带拉普拉斯平滑的对数似然
                score += math.log((count + self.smoothing) / (total + self.smoothing * vocab_size))
            if score > best_score:
                best_score = score
                best_class = cls
        return best_class
```

使用对数概率可以防止下溢。将许多小概率相乘会产生浮点数无法表示的小数字。求和对数概率在数值上稳定且在数学上等价。

### 第3步：在垃圾邮件数据上训练

```python
train_docs = [
    "win free money now",
    "free lottery ticket winner",
    "claim your prize today free",
    "urgent offer free cash",
    "congratulations you won free",
    "meeting tomorrow at noon",
    "project update attached",
    "can we schedule a call",
    "quarterly report review",
    "lunch on thursday sounds good",
    "team standup notes attached",
    "please review the pull request",
]

train_labels = [
    "spam", "spam", "spam", "spam", "spam",
    "ham", "ham", "ham", "ham", "ham", "ham", "ham",
]

classifier = NaiveBayes()
classifier.train(train_docs, train_labels)

test_messages = [
    "free money waiting for you",
    "meeting rescheduled to friday",
    "you won a free prize",
    "please review the attached report",
]

for msg in test_messages:
    print(f"  '{msg}' -> {classifier.predict(msg)}")
```

### 第4步：检查学习到的概率

```python
def show_top_words(classifier, cls, n=5):
    vocab_size = len(classifier.vocab)
    total = classifier.class_word_totals[cls]
    probs = {}
    for word in classifier.vocab:
        count = classifier.word_counts[cls].get(word, 0)
        probs[word] = (count + classifier.smoothing) / (total + classifier.smoothing * vocab_size)
    sorted_words = sorted(probs.items(), key=lambda x: x[1], reverse=True)
    for word, prob in sorted_words[:n]:
        print(f"    {word}: {prob:.4f}")

print("\nTop spam words:")
show_top_words(classifier, "spam")
print("\nTop ham words:")
show_top_words(classifier, "ham")
```

## 使用它

Scikit-learn 提供了生产级的朴素贝叶斯实现：

```python
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import classification_report

vectorizer = CountVectorizer()
X_train = vectorizer.fit_transform(train_docs)
clf = MultinomialNB()
clf.fit(X_train, train_labels)

X_test = vectorizer.transform(test_messages)
predictions = clf.predict(X_test)
for msg, pred in zip(test_messages, predictions):
    print(f"  '{msg}' -> {pred}")
```

相同的算法。`CountVectorizer` 处理分词和词汇表构建。`MultinomialNB` 在内部处理平滑和对数概率。你从头编写的版本用40行代码做了相同的事情。

## 部署它

这里构建的 `NaiveBayes` 类演示了完整的流程：分词、带拉普拉斯平滑的概率估计、对数空间预测。`code/bayes.py` 中的代码无需依赖Python标准库之外的任何东西即可端到端运行。

### 共轭先验

当先验和后验属于同一分布族时，该先验被称为“共轭”的。这使得贝叶斯更新在代数上非常简洁——你可以得到封闭形式的后验，而无需数值积分。

| 似然 | 共轭先验 | 后验 | 示例 |
|-----------|----------------|-----------|---------|
| 伯努利（Bernoulli） | Beta(a, b) | Beta(a + 成功数, b + 失败数) | 硬币抛掷偏倚估计 |
| 正态（已知方差） | 正态(mu_0, sigma_0) | 正态(加权均值, 更小方差) | 传感器校准 |
| 泊松（Poisson） | Gamma(a, b) | Gamma(a + 计数总和, b + n) | 到达率建模 |
| 多项（Multinomial） | Dirichlet(alpha) | Dirichlet(alpha + 计数) | 主题建模，语言模型 |

为什么这很重要：没有共轭先验，你需要蒙特卡洛采样或变分推理来近似后验。有了共轭先验，你只需要更新两个数字。

Beta分布是实践中最重要的共轭先验。Beta(a, b) 表示你对一个概率参数的信念。均值为 a/(a+b)。a+b 越大，分布越集中（越有信心）。

Beta先验的特殊情况：
- Beta(1, 1) = 均匀分布。你对参数没有意见。
- Beta(10, 10) = 峰值在0.5。你强烈相信参数接近0.5。
- Beta(1, 10) = 偏向0。你认为参数很小。

更新规则极其简单：

```
先验：     Beta(a, b)
数据：     成功s次，失败f次
后验： Beta(a + s, b + f)
```

无需积分。无需采样。只需加法。

### 顺序贝叶斯更新

贝叶斯推理自然是顺序的。今天的后验成为明天的先验。这就是真实系统如何增量学习而不重新处理所有历史数据的方式。

具体示例：估计一枚硬币是否公平。

**第1天：还没有数据。**
从 Beta(1, 1) 开始 —— 一个均匀先验。你没有意见。
- 先验均值：0.5
- 先验在 [0, 1] 上是平的

**第2天：观察到7次正面，3次反面。**
后验 = Beta(1 + 7, 1 + 3) = Beta(8, 4)
- 后验均值：8/12 = 0.667
- 证据表明硬币偏向正面

**第3天：又观察到5次正面，5次反面。**
使用昨天的后验作为今天的先验。
后验 = Beta(8 + 5, 4 + 5) = Beta(13, 9)
- 后验均值：13/22 = 0.591
- 平衡的新数据将估计值拉回到0.5附近

```mermaid
graph LR
    A["先验<br/>Beta(1,1)<br/>均值 = 0.50"] -->|"7次正面,