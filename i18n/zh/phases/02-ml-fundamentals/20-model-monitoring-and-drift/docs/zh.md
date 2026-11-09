# 监测生产模式 数据漂移和概念漂移

> 部署的模型没有错误信息, 继续返回分数, 随着世界从训练数据中移动,

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2, Lessons 09 (Model Evaluation), 16 (Anomaly Detection), and 19 (ML System Design)
**Time:** ~110 minutes

## 学习目标

- 选择四层的监测信号:系统健康,输入,预测和结果
- 根据变化的部分,对变量漂移,前漂移和概念漂移进行区分
- 实施人口稳定指数,两样本的科尔摩戈罗夫-斯米尔诺夫统计数据,以及从零开始的奇方体测试
- 比较固定参考窗口与滑动电流窗口,并解释窗口尺寸如何改变噪音和延迟
- 设计一个警告政策,限制虚假警报,以效果大小,多次测试的纠正和持久规则
- 决定哪种漂移需要重新训练,哪种需要新的标签,哪种不需要采取行动

## 问题

付款风险模式是有95%的准确性的.两个月后,营销活动引入了更大的应用程序用户.四个月后,诈骗者改变了他们的策略,以前的安全付款开始变成回收.

模型服务在所有这些过程中返回每一个请求的HTTP200. 延迟正常,日志显示没有错误. 出现问题的第一种迹象是损坏发生几周后的财务报告.

软件监控检查服务是否回答.模型监控检查是否仍然有正确的答案,以及数据是否仍然像训练模型的数据.本课程构建了第二个工作的统计数据,窗户和警报政策.您将它们运行在合成流中,使用两个注入的变化,并观察监视器对哪个变化反应.

## 概念

### 监测什么

监测四层,前三层提前警告,第四层仅测量正确,而且迟到.

| Layer | Signals | Available | Question it answers |
|---|---|---|---|
| System health | p50 and p99 latency, error rate, throughput, memory | At once | Does the service answer? |
| Inputs | Distribution of each feature, missing-value rate, schema, new categories | At once | Does live data look like training data? |
| Predictions | Score distribution, positive rate, share of default answers | At once | Does the model behave as before? |
| Outcomes | Accuracy, precision, calibration, business metric | After the label delay | Is the model still right? |

输入监测是本课程的主要主题,因为它在标签到来之前就能工作. 演示显示的限制是:一些变化会让输入不受影响.

### 漂移的三个类型

写出输入的共同分布`x`标签`y`在两个方面:

```math
P(x, y) = P(x) \cdot P(y \mid x) = P(y) \cdot P(x \mid y)
```

每种漂移都改变了不同的因素:

| Drift | What changes | What stays | Payment example | Which monitor sees it |
|---|---|---|---|---|
| Covariate drift | `P(x)` | `P(y \| x)` | More app users with larger baskets | Input monitors |
| Prior drift | `P(y)` | `P(x \| y)` | The fraud rate doubles during an attack, and fraud looks the same | Prediction and outcome monitors |
| Concept drift | `P(y \| x)` | Can stay | The same basket now has a different fraud risk | Outcome monitors only |

Gama等人呼吁改变`P(y | x)`它们叫做变化.`P(x)`这就离开了`P(y | x)`它们的调查还根据时间的发生方式进行分类:突然,渐进,渐进,或者作为一个回来的概念.

变量漂移并不总是伤害.`P(y | x)`交通运输在没有训练数据的地区或接近决策界限时仍然会失去准确性.

### 延迟标签

预测后结果会出现.

| Problem | When the label arrives |
|---|---|
| Ad click | Seconds |
| Churn in the next 30 days | 30 days |
| Card fraud | When the chargeback arrives, often weeks later |
| Loan default | Months or years |

在延迟期间,你有输入和预测,但没有结果.监控输入和预测,加入标签到达时,并仅在标记部分计算结果指标.演示使用500事件的标签延迟,因此结果监测器总是将500事件追溯到过去.

### 参考和当前窗口

每次漂移测试都比较两个样本:

- **Reference window.**训练数据,或者你手动检查的生产期,直到你重新训练,它保持固定.
- **Current window.**最新事件,或是最后一次`N`事件或最后一次事件`T`时间.

滑窗向前移动比其尺寸小的一步,因此连续的窗户重叠.滑窗以其全部尺寸移动.窗户尺寸是折扣.小窗口反应很快,但会产生噪音.大窗口是稳定的,但报告变化迟到.

季节性打破了天真的窗户.周一的交通与周六的交通不同.

### 人口稳定指数

根据信用评分,PSI是指数值的.将参考值分为子,通常是指数分数分数的十个子,使每个子都占据了参考值的10%. 计算每个子中的当前值的份额. 然后每子加上一个术语:

```math
\text{PSI} = \sum_{\text{bins}} (\text{current\_share} - \text{reference\_share}) \cdot \ln\left(\frac{\text{current\_share}}{\text{reference\_share}}\right)
```

零的分数为记载无限,所以将每个分数切割到小值,例如0.0001.PSI是对称.它等于KL分离从流向参考加上KL分离从参考到参考.

实践者读PSI与固定带:0.1以下是稳定的,0.1到0.25是中等的转变,0.25以上是显著的转变.把这些带视为一个规则,而不是一个测试.PSI随着垃圾桶数量增长而缩小,样本尺寸缩小.在演示中,500事件的窗户没有漂移分数在0.01到0.04之间.

### 科尔摩戈罗夫-斯米尔诺夫统计数据

两样式KS统计数据`D`是两个经验累积分布函数之间的最大垂直差距:

```math
D = \max_x \left\lvert F_{\text{reference}}(x) - F_{\text{current}}(x) \right\rvert
```

`D`对于相同样本为0和不重叠的样本为1.它不需要容器.p值来自实际样本大小的科尔摩戈尔夫分布.`n * m / (n + m)`现在,我们要去.

对于一个不关心的差距,p值将达到零.0.02标准偏差的转移是"显著"的,每窗口发生百万次事件.使用 `D`只有当两个 `D`并且p值超过了其门.

### 基方体测试对类别特征

对于一个类别特征,例如支付道,构建一个表,每个类别有两个行 (引用,流动) 和一个列.每个单元中的预期数量来自列和列总数:

```math
\begin{aligned}
\text{expected}[r][c] &= \text{row\_total}[r] \cdot \text{column\_total}[c] / \text{grand\_total} \\
\text{chi2} &= \sum_{\text{cells}} (\text{observed} - \text{expected})^2 / \text{expected}
\end{aligned}
```

测试已经`k - 1`对于`k`类别.只在当前窗口中出现的类别添加了一个大术语,因此测试反应于新的值.Cramér的V是效果大小.对于一个两个行的表,它等于二平方根`chi2 / grand_total`现在,我们要去.

### 警报门和虚假警报

每次测试都有一个错误报警率`alpha`监测测试进行了许多测试,每小时检查50个功能.`alpha = 0.05`预计每天会有60个假报警,而没有任何变化.

警报率保持有效的四个规则:

1. **Correct for multiple tests.**波恩弗罗尼纠正分为`alpha`测试数量. 演示使用一个家庭`alpha`两个测试中使用0.01的值,因此每次测试使用0.005.
2. **Require an effect size.**只有当PSI,`D`,或者克雷默的V也过了门.
3. **Require persistence.**只有在`k`演示使用了`k = 2`现在,我们要去.
4. **Separate warnings from alerts.**警告到仪表板上,警告到一个人.

测试规则2在工作中.一个清洁的窗口有0.0009的平平方p值,低于每次测试的值.`alpha`克雷默的V值低于0.1,所以保险记录一个警告,而不是一个警报.

### 训练重复的触发器

重训的三种常见原因:

- **Schedule.**训练每周或每月. 这很简单,但它在没有什么改变的时候重新训练,
- **Drift.**输入漂移在重要特征上保持超过门时,重新训练.
- **Performance.**结果指标下降到参考值减去宽容时,再训练.

转变的决定了重训能做什么:

| Drift | Useful action |
|---|---|
| Covariate drift, accuracy stable | Often none. Keep watching the outcome metric. |
| Covariate drift into regions with little data | Retrain on recent data that includes those regions |
| Prior drift | Recalibrate the scores or move the decision threshold |
| Concept drift | Collect new labels first. Retraining on old labels teaches the old concept again. |

经过重新训练,将新模型测试在最新标记数据上. 通过系统设计课程的影子和色阶段推出它. 然后重新设置参考窗口为新训练数据.

```figure
mlprod-drift-psi
```

## 建立它

编码在`code/main.py`只有使用标准图书馆.

### 步骤1:量子垃圾桶和PSI

片边缘是参考分数.`bisect_right`找到每个值的垃圾桶.

```python
def quantile_edges(reference: list[float], bins: int = 10) -> list[float]:
    ordered = sorted(reference)
    n = len(ordered)
    edges = [ordered[min(n - 1, (n * i) // bins)] for i in range(1, bins)]
    return sorted(set(edges))


def psi_from_fractions(expected: list[float], actual: list[float], eps: float = 1e-4) -> float:
    total = 0.0
    for e, a in zip(expected, actual):
        e, a = max(e, eps), max(a, eps)
        total += (a - e) * math.log(a / e)
    return total
```

### 步骤2:KS统计数据及其p值

随着两个分类样本的分类,在每个不同的值上,在两个样本中移动过每一个副本,然后比较两个累积的份额.

```python
def ks_statistic(sample_a: list[float], sample_b: list[float]) -> float:
    a, b = sorted(sample_a), sorted(sample_b)
    n, m = len(a), len(b)
    i = j = 0
    d = 0.0
    while i < n and j < m:
        x = min(a[i], b[j])
        while i < n and a[i] <= x:
            i += 1
        while j < m and b[j] <= x:
            j += 1
        d = max(d, abs(i / n - j / m))
    return d
```

对于Kolmogorov分布,p值使用了系列,`2 * sum((-1)^(k-1) * exp(-2 k^2 lambda^2))`随着`lambda = sqrt(n * m / (n + m)) * D`现在,我们要去.

### 步骤3: 奇方体测试

`chi2_sf`通过调整上部不完整的马函数计算了奇方形生存函数.它使用了一系列用于小参数和一个连续的分数用于大参数. `chi_square_test`构建两个行表,计算统计数据,返回p值和Cramér的V.

```python
def chi_square_test(reference_counts: dict[str, int], current_counts: dict[str, int]) -> ChiSquareResult:
    categories = [c for c in sorted(set(reference_counts) | set(current_counts))
                  if reference_counts.get(c, 0) + current_counts.get(c, 0) > 0]
    rows = [[reference_counts.get(c, 0) for c in categories], [current_counts.get(c, 0) for c in categories]]
    row_totals = [sum(r) for r in rows]
    grand = sum(row_totals)
    if len(categories) < 2 or 0 in row_totals:
        return ChiSquareResult(0.0, 0, 1.0, 0.0)
    statistic = 0.0
    for col, _ in enumerate(categories):
        col_total = rows[0][col] + rows[1][col]
        for r in range(2):
            expected = row_totals[r] * col_total / grand
            statistic += (rows[r][col] - expected) ** 2 / expected
    dof = len(categories) - 1
    return ChiSquareResult(statistic, dof, chi2_sf(statistic, dof), math.sqrt(statistic / grand))
```

### 步骤4:窗户和漂移显示器

`SlidingWindow`保持最后一个`size`事件`deque`现在,我们要去.`DriftMonitor`计算一个次,计算一个次.`check`方法返回PSI,`D`对于每个数值的 KS p值,以及每个类型的 chi 平方结果.

### 步骤5:警报政策

政策将每个设置的指标转换为一个水平,并计算每信号的连续漂移窗户:

```python
def level(self, metrics: dict[str, float]) -> str:
    if "psi" in metrics:
        if metrics["psi"] >= self.psi_drift or (metrics["ks"] >= self.ks_drift and metrics["ks_p"] < self.alpha):
            return "drift"
        return "warn" if metrics["psi"] >= self.psi_warn else "ok"
    if metrics["p"] < self.alpha and metrics["v"] >= self.min_cramers_v:
        return "drift"
    return "warn" if metrics["p"] < self.alpha else "ok"
```

`update`收益`ALERT`在完整的窗口上,`resolved`在警报后的第一扇清洁窗口.

### 步骤 6: 喷射漂移的流

流有9000个付款事件,`amount`其他`channel`钱的钱`label`它们的四个部分:

| Events | Amount | Channel mix (app, store, web) | Label boundary | Change |
|---|---|---|---|---|
| 0 to 2999 | mean 100, sd 20 | 35, 15, 50 percent | 120 | Reference period |
| 3000 to 4999 | mean 118, sd 24 | 60, 10, 30 percent | 120 | Covariate drift |
| 5000 to 6499 | mean 100, sd 20 | 35, 15, 50 percent | 120 | Back to normal |
| 6500 to 8999 | mean 100, sd 20 | 35, 15, 50 percent | 105 | Concept drift |

模型是值的`amount`窗户会举行500场活动,然后在250之前移动.

```bash
python3 code/main.py
npx tsx code/main.ts
```

```console
  end    PSI   KS D   chi2 p    acc  levels (amount/channel/accuracy)  events
 3000  0.010  0.041  3.0e-01  0.932  ok/ok/ok
 3250  0.152  0.163  7.6e-06  0.924  drift/warn/ok
 3500  0.463  0.298  2.8e-26  0.936  drift/drift/ok                     ALERT amount
 3750  0.609  0.343  3.5e-35  0.942  drift/drift/ok                     ALERT channel
 ...
 5500  0.026  0.044  2.6e-01  0.898  ok/ok/ok                           resolved amount, resolved channel
 ...
 7250  0.040  0.048  7.1e-01  0.848  ok/ok/drift
 7500  0.022  0.039  6.1e-01  0.778  ok/ok/drift                        ALERT accuracy
```

阅读结果三个部分:

- **Covariate drift.**流开始于3000事件,`amount`警报率为3500. 精度保持在0.89至0.95之间,因为标签规则没有改变.
- **Recovery.**输入在5000时恢复正常,两个警报在5500时恢复.
- **Concept drift.**漂移开始于6500,输入监测器保持沉默,因为输入没有改变.精度从0.946降至0.76至0.79.

## 用它

**scipy.** `scipy.stats`统计数据与从头开始的代码相匹配.

```python
from scipy import stats

result = stats.ks_2samp(reference_amounts, current_amounts)
print(result.statistic, result.pvalue)

table = [[1000, 700, 300], [140, 290, 70]]
chi2 = stats.chi2_contingency(table)
print(chi2.statistic, chi2.pvalue, chi2.dof)
```

我们检查了`ks_statistic`其他`chi_square_test`随机样本的 KS 数据,奇方数数据和奇方数 p 值与浮点精度相匹配.超过200个随机样本对,KS p 值与奇方数值不同,高达18%.最大的差距在非常小的 p 值.

由于我们使用了限制科尔摩戈罗夫分布的方法,`ks_2samp`采用了两个样本最多具有10,000个值时的精确方法.它的无比模式采用了圆形有效样本大小的有限样本分布.`chi2_contingency`根据Yates的连续性修正,因此统计数据在此不同.

**Monitoring libraries.**许多开源库将这些测试包装成报告和仪表板:

- **Evidently**对于一个包含1000行或更少的引用,它使用数列的KS测试和类列的Chi-平方测试.对于较大的数据,它使用Wasserstein距离和Jensen-Shannon差距,具有0.1的门值.PSI是您可以选择的其他方法之一.
- **NannyML**根据NanyML的文件,CBPE处理了变量变化,但并没有处理概念漂移.演示流显示为什么:只有标签才揭示了概念漂移.
- **TensorFlow Data Validation**对于数值特征,它使用L-无限距离和约的Jensen-Shannon分差.它还将训练数据与服务数据进行比较,该课程涵盖的特征存储.

编程编程,编程,仪表板等等等.

对于士学位申请,[LLM observability lesson](../../../17-infrastructure-and-production/13-llm-observability/docs/en.md)基础设施阶段包括追踪和评估工具. 本课程的想法仍然适用于这些系统的输入和输出.

## 运送它

这一课产生了`outputs/skill-drift-monitoring.md`技能计划监测器用于新模型,并进行分类,询问哪个层被射击,哪种层符合证据,以及是否是等待,重新校准,收集标签或重新训练.

## 运动

1. 运行200和2000事件的窗口,记录3000事件前的错误警告和警报延迟.
2. 设置`n_tests=1`现在`patience=1`其他`min_cramers_v=0`清洁时间的警报数量从5000到6500.
3. 添加一个特征,平均每100次事件增长0.01次. 找出哪个信号,PSI或KS,首先反应.
4. 按照Jensen-Shannon距离的定义,在每一个窗口都能使用相同的子.
5. 添加一个显示器来显示模型的正确预测率.

## 关键词

| Term | What people say | What it means |
|------|----------------|----------------------|
| Data drift | "The data changed" | A change in the distribution of inputs, predictions, or labels compared with a reference window |
| Covariate drift | "New kinds of users" | `P(x)` changes while `P(y \| x)` stays the same |
| Prior drift | "More positives than before" | `P(y)` changes while `P(x \| y)` stays the same, also called label shift |
| Concept drift | "The rules of the game changed" | `P(y \| x)` changes, so the same input now has a different correct answer |
| Reference window | "The baseline data" | A fixed sample, often the training data, that every current window is compared with |
| PSI | "The stability score" | A symmetric sum over bins of (current share minus reference share) times the log of their ratio |
| KS statistic | "The KS test" | The largest gap between two empirical cumulative distribution functions |
| Cramér's V | "Effect size for categories" | The chi-square statistic scaled to the range 0 to 1 |
| Label delay | "Ground truth comes later" | The time between a prediction and the arrival of its true outcome |
| Alert fatigue | "Too many pages" | People ignore alerts because most of them were false alarms |

## 进一步阅读

- [Gama et al., A Survey on Concept Drift Adaptation (ACM Computing Surveys, 2014)](https://research.tue.nl/en/publications/a-survey-on-concept-drift-adaptation)实际和虚拟漂移,漂移模式和适应方法
- [Rabanser, Günnemann, and Lipton, Failing Loudly: An Empirical Study of Methods for Detecting Dataset Shift (NeurIPS 2019)](https://arxiv.org/abs/1810.11953): 两样品测试,用于发现转变
- [Lu et al., Learning under Concept Drift: A Review (2020)](https://arxiv.org/abs/2004.05785)向检测,理解和适应方法
- [Yurdakul, Statistical Properties of Population Stability Index (Western Michigan University, 2018)](https://scholarworks.wmich.edu/dissertations/3208/):PSI对样本大小和垃圾桶数量的行为
- [scipy.stats.ks_2samp documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ks_2samp.html):对两样本KS测试的精确和不符号的p值方法
- [Evidently, How data drift detection works](https://docs.evidentlyai.com/metrics/explainer_drift):按列类型和数据大小的默认测试选择
- [NannyML, Performance estimation](https://nannyml.readthedocs.io/en/stable/how_it_works/performance_estimation.html):CBPE及其假设
