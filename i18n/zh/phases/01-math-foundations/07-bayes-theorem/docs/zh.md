# 贝叶斯定理

> 概率是你预期的,贝叶斯定理是你学习的.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lesson 06 (Probability Fundamentals)
**Time:** ~75 minutes

## 学习目标

- 应用贝叶斯定理来计算后期概率从前,概率和证据
- 创建一个简单的贝叶斯文本分类器从零开始,使用拉普莱斯平滑和日志空间计算
- 比较MLE和MAP估计,并解释MAP如何与L2规范化相符
- 执行使用Beta-Binomial结合前列进行A/B测试的连续贝叶斯式更新

## 问题

医疗检查是99%准确的.你检测得阳性.你确实有什么机会患上这种疾病?

大多数人说99%.真实的答案取决于这种疾病是多么罕见.如果每1万人中有1人患有这种疾病,积极的结果只会给你患病的机会大约1%.其余的99%的积极结果是健康人发出的虚假警报.

这不是一个诡计的问题.这是贝叶斯定理.每一个垃圾邮件过器,每一个医疗诊断,每一个测量不确定性的机器学习模型都使用了这个正确的推理.你从一个信念开始.你看到证据.你更新.

如果你没有理解这一点,就会误解模型输出,设定不好的门,

## 概念

### 从联合概率到贝斯

根据第六课,你已经知道条件概率是:

```math
P(A \mid B) = \frac{P(A \text{ and } B)}{P(B)}
```

并且对称:

```math
P(B \mid A) = \frac{P(A \text{ and } B)}{P(A)}
```

两个表达式都有相同的数值:$P(A \text{ and } B)$给它们平衡,然后重新安排:

```math
\begin{aligned}
P(A \text{ and } B) &= P(A \mid B) \cdot P(B) = P(B \mid A) \cdot P(A) \\[4pt]
&\text{Therefore:} \\[4pt]
P(A \mid B) &= \frac{P(B \mid A) \cdot P(A)}{P(B)}
\end{aligned}
```

这就是贝叶斯定理,四个量,一个方程.

### 它们的四部分

| Part | Name | What it means |
|------|------|---------------|
| $P(A \mid B)$ | Posterior | Your updated belief about $A$ after seeing evidence $B$ |
| $P(B \mid A)$ | Likelihood | How probable the evidence $B$ is if $A$ is true |
| $P(A)$ | Prior | Your belief about $A$ before seeing any evidence |
| $P(B)$ | Evidence | Total probability of seeing $B$ under all possibilities |

证据的期限$P(B)$通过使用总概率法来扩展它:

```math
P(B) = P(B \mid A) \cdot P(A) + P(B \mid \text{not } A) \cdot P(\text{not } A)
```

### 医疗检测的例子

检测结果是99%准确的 (检测结果是99%的病人,结果是1%的错误阳性).

```math
\begin{aligned}
P(\text{sick}) &= 0.0001 \quad \text{(prior: disease is rare)} \\
P(\text{positive} \mid \text{sick}) &= 0.99 \quad \text{(likelihood: test catches it)} \\
P(\text{positive} \mid \text{healthy}) &= 0.01 \quad \text{(false positive rate)} \\[6pt]
P(\text{positive}) &= P(\text{positive} \mid \text{sick}) \cdot P(\text{sick}) + P(\text{positive} \mid \text{healthy}) \cdot P(\text{healthy}) \\
&= 0.99 \cdot 0.0001 + 0.01 \cdot 0.9999 \\
&= 0.000099 + 0.009999 \\
&= 0.010098 \\[6pt]
P(\text{sick} \mid \text{positive}) &= P(\text{positive} \mid \text{sick}) \cdot P(\text{sick}) / P(\text{positive}) \\
&= 0.99 \cdot 0.0001 / 0.010098 \\
&= 0.0098 \\
&= 0.98\%
\end{aligned}
```

医生们说,如果病情很少,即使是精确的测试也会产生虚假阳性.

### 垃圾邮件过器的例子

你收到一封包含"彩票"的电子邮件.

```math
\begin{aligned}
P(\text{spam}) &= 0.3 \quad \text{(30\% of email is spam)} \\
P(\text{"lottery"} \mid \text{spam}) &= 0.05 \quad \text{(5\% of spam emails contain "lottery")} \\
P(\text{"lottery"} \mid \text{not spam}) &= 0.001 \quad \text{(0.1\% of legitimate emails contain "lottery")} \\[6pt]
P(\text{"lottery"}) &= 0.05 \cdot 0.3 + 0.001 \cdot 0.7 \\
&= 0.015 + 0.0007 \\
&= 0.0157 \\[6pt]
P(\text{spam} \mid \text{"lottery"}) &= 0.05 \cdot 0.3 / 0.0157 \\
&= 0.955 \\
&= 95.5\%
\end{aligned}
```

一个字将概率从30%转移到95.5%. 一个真正的垃圾邮件过器同时应用百度百度单词.

### 简单的贝耶斯:独立假设

简单的贝耶斯将这一点扩展到多个特征,假设所有特征都在给类别的条件下独立:

```math
P(\text{class} \mid \text{feature}_1, \text{feature}_2, \ldots, \text{feature}_n) = \frac{P(\text{class}) \cdot P(\text{feature}_1 \mid \text{class}) \cdot P(\text{feature}_2 \mid \text{class}) \cdots P(\text{feature}_n \mid \text{class})}{P(\text{feature}_1, \text{feature}_2, \ldots, \text{feature}_n)}
```

单词出现并不独立 ("新"和"纽约"相关).但这种假设在实践中非常有效,因为分类器只需要排名类,而不是产生校准概率.

由于所有类的分母是相同的,所以你可以跳过它,

```math
\text{score}(\text{class}) = P(\text{class}) \cdot \prod_i P(\text{feature}_i \mid \text{class})
```

选择最高分的班级.

### 极限概率估计 (MLE)

你怎么得到了?$P(\text{feature} \mid \text{class})$根据训练数据?

```math
P(\text{"free"} \mid \text{spam}) = \frac{\text{number of spam emails containing "free"}}{\text{total spam emails}}
```

现在,我们要选择最可能的参数值, 并且要最大化概率函数,

问题:如果一个词在训练中从来没有出现在垃圾邮件中,MLE给它一个可能性是零.一个未见的词会杀死整个产品.

```math
P(\text{word} \mid \text{class}) = \frac{\text{count}(\text{word}, \text{class}) + 1}{\text{total\_words\_in\_class} + \text{vocabulary\_size}}
```

增加1个数量,确保没有可能性是零的.

没有在任何培训信息中出现的单词都不在词汇中.`predict`没有证据证明任何一个类.

### 后期最大 (MAP)

们需要什么参数才能达到最大的水平?$P(\text{data} \mid \text{parameters})$现在,我们要去.

图表问: 什么参数最大化$P(\text{parameters} \mid \text{data})$现在,我们要去.

根据贝叶斯定理:

```math
P(\text{parameters} \mid \text{data}) \propto P(\text{data} \mid \text{parameters}) \cdot P(\text{parameters})
```

图为""的定位,即""的定位,即""的定位,即""的定位.

| Estimation | Optimizes | ML equivalent |
|------------|-----------|---------------|
| MLE | $P(\text{data} \mid \text{params})$ | Unregularized training |
| MAP | $P(\text{data} \mid \text{params}) \cdot P(\text{params})$ | L2 / L1 regularization |

### 贝叶斯人与频率主义者:实际的区别

频率学家认为参数是固定的未知的.他们问道:"如果我重复这个实验多次,会发生什么?"

贝叶斯人把参数视为分布,他们问:"鉴于我观察到的,我对参数有什么看法?"

对于构建ML系统,实际的区别:

| Aspect | Frequentist | Bayesian |
|--------|-------------|----------|
| Output | Point estimate | Distribution over values |
| Uncertainty | Confidence intervals (about procedure) | Credible intervals (about parameter) |
| Small data | Can overfit | Prior acts as regularization |
| Computation | Usually faster | Often requires sampling (MCMC) |

贝耶斯方法在需要校准不确定性 (医疗决策,安全关键系统) 或数据稀缺时 (短暂学习,冷启动) 闪耀.

### 为什么贝耶斯思想对 ML 重要

它们的联系比比喻更深.

**Priors are regularization.**对于重量来说,一个高斯式先例是L2规律化.一个拉普莱斯式先例是L1.每次你添加一个规律化术语,你就会做一个贝耶斯式声明,你预计的参数值是什么.

**Posteriors are uncertainty.**贝耶斯方法给出了分布:"我认为$P(\text{spam})$平均值为0.8至0.95".

**Bayes updates are online learning.**当你的模型看到新的数据时,它会逐步更新自己的信念,而不是从头开始重新训练.

**Model comparison is Bayesian.**贝叶斯信息标准 (BIC),边际概率和贝叶斯因素都使用贝叶斯推理来选择没有过度适应的模型.

```figure
bayes-update
```

## 建立它

### 步骤1:贝叶斯定理函数

```python
def bayes(prior, likelihood, false_positive_rate):
    evidence = likelihood * prior + false_positive_rate * (1 - prior)
    posterior = likelihood * prior / evidence
    return posterior

result = bayes(prior=0.0001, likelihood=0.99, false_positive_rate=0.01)
print(f"P(sick|positive) = {result:.4f}")
```

### 步骤2: 简单的贝叶斯分类器

```python
import math
from collections import defaultdict

class NaiveBayes:
    def __init__(self, smoothing=1.0):
        self.smoothing = smoothing
        self.class_counts = defaultdict(int)
        self.word_counts = defaultdict(lambda: defaultdict(int))
        self.class_word_totals = defaultdict(int)
        self.vocab = set()

    def train(self, documents, labels):
        for doc, label in zip(documents, labels):
            self.class_counts[label] += 1
            words = doc.lower().split()
            for word in words:
                self.word_counts[label][word] += 1
                self.class_word_totals[label] += 1
                self.vocab.add(word)

    def predict(self, document):
        words = [word for word in document.lower().split() if word in self.vocab]
        total_docs = sum(self.class_counts.values())
        vocab_size = len(self.vocab)
        best_class = None
        best_score = float("-inf")
        for cls in self.class_counts:
            score = math.log(self.class_counts[cls] / total_docs)
            for word in words:
                count = self.word_counts[cls].get(word, 0)
                total = self.class_word_totals[cls]
                score += math.log((count + self.smoothing) / (total + self.smoothing * vocab_size))
            if score > best_score:
                best_score = score
                best_class = cls
        return best_class
```

记载概率防止下流.乘以许多小概率产生数量太小,无法浮动点.编算记载概率是数学的稳定和数学上的等价.

### 步骤3:训练垃圾邮件数据

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

### 步骤4:检查所学到的可能性

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

## 用它

无辜的贝伊斯实施,准备生产的飞船:

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

算法相同. CountVectorizer处理代码化和词汇构建. MultinomialNB处理内地平滑和日志概率.你的从头开始版本在40行中做同样的事情.

## 运送它

代码在 果中是 果的代码, 代码在 果的代码中是 果的代码.`code/bayes.py`通过Python的标准库,它运行无关.`code/bayes.ts`仅使用 Node 标准库.

### 结合的先驱

当前和后的分布属于同一类分布时,前的分布被称为"结合". 这使得贝耶斯的更新对代数清洁 - - 你得到一个没有数字集成的闭式后的形式.

| Likelihood | Conjugate Prior | Posterior | Example |
|-----------|----------------|-----------|---------|
| Bernoulli | $\text{Beta}(a, b)$ | $\text{Beta}(a + \text{successes}, b + \text{failures})$ | Coin flip bias estimation |
| Normal (known variance) | $\text{Normal}(\mu_0, \sigma_0)$ | Normal(weighted mean, smaller variance) | Sensor calibration |
| Poisson | $\text{Gamma}(a, b)$ | $\text{Gamma}(a + \text{sum of counts}, b + n)$ | Modeling arrival rates |
| Multinomial | $\text{Dirichlet}(\alpha)$ | $\text{Dirichlet}(\alpha + \text{counts})$ | Topic modeling, language models |

没有结合前数,你需要蒙特卡罗样本或变化推理来接近后方.

实际上,Beta分布是最常见的结合式前. $\text{Beta}(a, b)$平均值是$a/(a+b)$越大$a+b$分布越集中 (更有信心).

贝塔前的特殊情况:
- $\text{Beta}(1, 1)$您对参数没有意见.
- $\text{Beta}(10, 10)$您坚信参数接近0.5.
- $\text{Beta}(1, 10)$参数是小的.

更新规则非常简单:

```math
\begin{aligned}
\text{Prior:} \quad & \text{Beta}(a, b) \\
\text{Data:} \quad & s \text{ successes}, f \text{ failures} \\
\text{Posterior:} \quad & \text{Beta}(a + s, b + f)
\end{aligned}
```

没有整体,没有样本,只是加算.

### 序列的贝叶斯语更新

贝叶斯推理是自然的序列.今天的后者成为明天的前者. 这就是真正的系统在没有重新处理所有历史数据的情况下逐步学习的方式.

具体例子:估计硬币是否公平.

**Day 1: No data yet.**
开始$\text{Beta}(1, 1)$没有任何意见.
- 前平均:0.5
- 预先是平面的 [0, 1]

**Day 2: Observe 7 heads, 3 tails.**
$\text{Posterior} = \text{Beta}(1 + 7, 1 + 3) = \text{Beta}(8, 4)$
- 后期平均值:$8/12 = 0.667$
- 证据表明,硬币偏向头部

**Day 3: Observe 5 more heads, 5 more tails.**
现在用昨天的后面作为今天的前面.
$\text{Posterior} = \text{Beta}(8 + 5, 4 + 5) = \text{Beta}(13, 9)$
- 后期平均值:$13/22 = 0.591$
- 根据新的平衡数据,估计将重回0.5

```mermaid
graph LR
    A["Prior<br/>Beta(1,1)<br/>mean = 0.50"] -->|"7H, 3T"| B["Posterior 1<br/>Beta(8,4)<br/>mean = 0.67"]
    B -->|"becomes prior"| C["Prior 2<br/>Beta(8,4)"]
    C -->|"5H, 5T"| D["Posterior 2<br/>Beta(13,9)<br/>mean = 0.59"]
```

观察的顺序并不重要.$\text{Beta}(1,1)$更新了12个头和8个尾,同时给出了$\text{Beta}(13, 9)$顺序更新和批量更新是数学上相当的. 但顺序更新让你在每一步都能做出决定,而不需要存储原始数据.

这就是生产ML系统的在线学习的基础. 普森对盗进行样本取,增量推系统和流动异性检测器都使用这种模式.

### 连接到A/B测试

化测试是贝叶斯推理.

设置:您正在测试两个按颜色:A变体 (蓝色) 和B变体 (绿色).您想知道哪个获得更多点击.

贝耶斯 A/B 测试:

1. **Prior.**开始$\text{Beta}(1, 1)$对于两种变体,没有先前的偏好.
2. **Data.**选择A: 1000个浏览中50个点击,选择B: 1000个浏览中65个点击.
3. **Posteriors.**
   - 答: $\text{Beta}(1 + 50, 1 + 950) = \text{Beta}(51, 951)$平均值 = 0.051
   - $\text{Beta}(1 + 65, 1 + 935) = \text{Beta}(66, 936)$平均值 = 0.066
4. **Decision.**计算$P(B > A)$-- B 的真实转换率比 A 的更高的可能性.

计算$P(B > A)$分析上很难,但蒙特卡罗却让它很平凡.

```
1. Draw 100,000 samples from Beta(51, 951)  -> samples_A
2. Draw 100,000 samples from Beta(66, 936)  -> samples_B
3. P(B > A) = fraction of samples where B > A
```

如果$P(B > A) > 0.95$如果它在0.05到0.95之间,你继续收集数据.$P(B > A) < 0.05$您的船只变量A.

频率A/B测试的优势:
- 你得到了直接的概率声明:"有97%的机会B更好"
- 没有p值的混,没有"未能拒绝零假设"的对冲.
- 您可以随时检查结果,而不需要加大假阳性率 (没有"查问题")
- 您可以包含先前的知识 (例如,之前的测试表明转换率通常为3-8%)

| Aspect | Frequentist A/B | Bayesian A/B |
|--------|----------------|--------------|
| Output | p-value | $P(B > A)$ |
| Interpretation | "How surprising is this data if A=B?" | "How likely is B better than A?" |
| Early stopping | Inflates false positives | Safe at any point (given a well-chosen prior and correctly specified model) |
| Prior knowledge | Not used | Encoded as Beta prior |
| Decision rule | $p < 0.05$ | $P(B > A) > \text{threshold}$ |

## 运动

1. **Multiple tests.**独立测试中,患者检测得两次阳性 (两者都99%准确,病例在1万中1).$P(\text{sick})$试验后,使用后面的后面,作为前面的第二次试验.

2. **Smoothing impact.**运行垃圾邮件分类器,以0.01,0.1,1.0,和10.0的平滑值运行.顶级词概率如何改变?平滑=0和只出现在子中的词发生了什么?

3. **Add features.**扩展NaiveBayes 类,以使消息长度 (短/长) 作为单词数量的功能. 估计$P(\text{short} \mid \text{spam})$其他$P(\text{short} \mid \text{ham})$根据训练数据,将其折叠成预测分数.

4. **MAP by hand.**根据观察到的数据 (7个头在10个币中),使用一个$\text{Beta}(2,2)$之前.与MLE估计相比 ($7/10$)

### 暗示

**Exercise 1.**电话`bayes`检测1后,再用后方作为前方. `sequential_bayes(prior, likelihood, false_positive_rate, 2)`必须提供相同的值,接近0.5.

**Exercise 2.**创建一个`NaiveBayes(smoothing=s)`对于每个值,将其训练在相同的数据上,`top_words`通过平滑0,一个从来没有出现在垃圾邮件中的字得到了0的概率,所以它的日志没有定义.

**Exercise 3.**计算多少短短的垃圾邮件和便,按每个类的消息数量进行分数,并将该比例的日志添加到分数中`predict`检查每个类的两个概率的总数为1.

**Exercise 4.**通过一个$\text{Beta}(\alpha, \beta)$之前,MAP估计是$\frac{h + \alpha - 1}{n + \alpha + \beta - 2}$放进去$h = 7$现在$n = 10$;结果必须在MLE (0.7) 和之前模式 (0.5) 之间.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Prior | "My initial guess" | $P(\text{hypothesis})$ before observing evidence. In ML: the regularization term. |
| Likelihood | "How well the data fits" | $P(\text{evidence} \mid \text{hypothesis})$. How probable the observed data is under a specific hypothesis. |
| Posterior | "My updated belief" | $P(\text{hypothesis} \mid \text{evidence})$. The prior multiplied by the likelihood, then normalized. |
| Evidence | "The normalizing constant" | $P(\text{data})$ across all hypotheses. Ensures the posterior sums to 1. |
| Naive Bayes | "That simple text classifier" | A classifier that assumes features are independent given the class. Works well despite the false assumption. |
| Laplace smoothing | "Add-one smoothing" | Adding a small count to every feature to prevent zero probabilities from unseen data. |
| MLE | "Just use the frequencies" | Choose parameters that maximize $P(\text{data} \mid \text{parameters})$. No prior. Can overfit with small data. |
| MAP | "MLE with a prior" | Choose parameters that maximize $P(\text{data} \mid \text{parameters}) \cdot P(\text{parameters})$. Equivalent to regularized MLE. |
| Log-probability | "Work in log space" | Using $\log(P)$ instead of $P$ to avoid floating-point underflow when multiplying many small numbers. |
| False positive | "A wrong alarm" | The test says positive, but the true state is negative. Drives the base rate fallacy. |

## 进一步阅读

- [3Blue1Brown: Bayes' theorem](https://www.youtube.com/watch?v=HZGCoVF3YvM)- 视觉解释与医疗检测示例
- [Stanford CS229: Generative Learning Algorithms](https://cs229.stanford.edu/main_notes.pdf)- 简单的贝尔斯及其与歧视性模式的联系
- [Think Bayes](https://greenteapress.com/wp/think-bayes/)- 免费书,贝耶斯统计数据,使用Python代码
- [scikit-learn Naive Bayes](https://scikit-learn.org/stable/modules/naive_bayes.html)-生产实施情况以及每种变体使用时间
