# 公平性准则——群体、个体、反事实（Fairness Criteria — Group, Individual, Counterfactual）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 公平性文献由三大家族构成。群体公平（group fairness）：人口学平价（demographic parity）、均等几率（equalized odds）、条件使用精度均等（conditional use accuracy equality）——在受保护群体之间保持平均比例相等。个体公平（individual fairness，Dwork et al. 2012）：相似的个体得到相似的决策；对决策映射施加 Lipschitz 条件。反事实公平（counterfactual fairness，Kusner et al. 2017）：若把敏感属性反事实地改变后决策不变，则该决策对个体而言是公平的。2024 年的理论结果（NeurIPS 2024）：CF（counterfactual）与精度之间存在内在权衡；一个与模型无关（model-agnostic）的方法可以把「最优但不公平」的预测器转化为 CF 预测器，且精度损失有界。回溯反事实（backtracking counterfactuals，arXiv:2401.13935，2024 年 1 月）：一种新范式，避免对法律保护属性施加干预。哲学层面的调和（ICLR Blogposts 2024）：在给定因果图（causal graph）的前提下，满足某些群体公平度量就蕴含了反事实公平。

**Type:** Learn
**Languages:** Python (stdlib, three-criteria comparison)
**Prerequisites:** Phase 18 · 20 (bias), Phase 02 (classical ML)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 陈述三种群体公平准则（demographic parity、equalized odds、conditional use accuracy equality）以及一条不可能性结果。
- 用 Dwork et al. 2012 的 Lipschitz 形式描述个体公平。
- 描述反事实公平及其对因果图的依赖。
- 解释回溯反事实，以及它为何能绕开「对受保护属性施加干预」这一难题。

## 问题（The Problem）

第 20 课讲的是如何度量偏差。第 21 课讲的是这种度量应当服务于哪个公平性标准。三大家族给出结构上不同的标准——一个模型可以是群体公平但个体不公平，也可以是反事实公平但群体不公平。选择哪个标准是一个政策决策；没有哪个标准在普遍意义上最优。

## 概念（The Concept）

### 群体公平（Group fairness）

- **人口学平价（Demographic parity）。** 对所有群体，P(Y=1 | A=a) = P(Y=1 | A=a')。各群体的接受率相等。
- **均等几率（Equalized odds）。** P(Y=1 | Y\*=y, A=a) = P(Y=1 | Y\*=y, A=a')。各群体的 TPR 与 FPR 相等。
- **条件使用精度均等（Conditional use accuracy equality）。** P(Y\*=y | Y=y, A=a) = P(Y\*=y | Y=y, A=a')。各群体的预测值相等。

不可能性（Chouldechova，Kleinberg-Mullainathan-Raghavan 2017）：在基础发生率（base rates）不相等时，这三者无法同时被满足。

### 个体公平（Individual fairness）

Dwork et al. 2012。如果对某个任务相关的相似度度量 d，决策映射 f 满足 |f(x) - f(x')| <= L * d(x, x')（其中 L 为某个 Lipschitz 常数），则 f 是个体公平的。相似的个体得到相似的决策。

需要先定义 d。这是政策问题，不是统计问题。

### 反事实公平（Counterfactual fairness）

Kusner et al. 2017。在某个总体的因果模型下，若把个体 i 的敏感属性反事实地改变后决策不变，则该决策对个体 i 反事实公平。

需要一张因果 DAG（有向无环图）。DAG 是建模选择。反事实公平的合理性取决于 DAG 的合理性。

### CF 与精度的权衡（The CF-vs-accuracy trade-off）

NeurIPS 2024 的理论结果：反事实公平与预测精度之间存在内在权衡。一个 model-agnostic 的方法可以把「最优但不公平」的预测器转化为 CF 预测器，精度代价有界。该精度代价取决于「最优不公平」预测器中敏感属性系数的大小。

### 回溯反事实（Backtracking counterfactuals）

arXiv:2401.13935（2024 年 1 月）。传统反事实需要对敏感属性施加干预——「如果这个人是另一种性别，决策会改变吗」。在法律上这是有问题的：分类法（classification law）禁止对受保护属性施加干预。

回溯反事实把方向反过来：不去干预属性，而是问个体实际特征的哪种组合会产生那种反事实结果。这就绕开了法律层面的反对。

### 哲学层面的调和（Philosophical reconciliation）

ICLR Blogposts 2024。一旦手里握着一张因果图，满足某些群体公平度量就蕴含了反事实公平。这三大家族并非正交；它们是同一底层因果结构的不同侧面。

这并不消解不可能性定理（基础发生率不相等仍然阻碍群体公平的同时满足）。但它表明：「群体」与「个体 / 反事实」之间表面上的对立，部分来自对因果模型的不显式表述。

### 这一课在 Phase 18 中的位置（Where this fits in Phase 18）

第 20 课是偏差度量。第 21 课是公平性定义。第 22 课是隐私（差分隐私）。第 23 课是水印。这些是与「分配」相关的课程，与第 7–11 课「与欺骗相关」的课程互补。

## 用起来（Use It）

`code/main.py` 构造一个带敏感属性、基础发生率不相等的玩具二分类数据集。在一个简单的分类器上分别计算 demographic parity、equalized odds、conditional use accuracy equality。观察三种指标互相分歧。应用一次面向 demographic parity 的重加权（re-weighting），观察它在另外两个指标上的代价。

## 上线部署（Ship It）

本课产出 `outputs/skill-fairness-criterion.md`。给定一个公平性主张或政策，识别它主张的是哪一条准则、模型在所主张的不相等基础发生率下能否满足其余准则、以及该主张依赖怎样一张因果 DAG。

## 练习（Exercises）

1. 运行 `code/main.py`。在默认数据上汇报三种群体指标。应用面向 demographic parity 的重加权后再次汇报。

2. 用非敏感特征上的 L2 距离实现 Dwork et al. 2012 的个体公平度量。汇报有多少对个体在常数 L=1 下违反 Lipschitz。

3. 阅读 Kusner et al. 2017。为简历评分构造一个简单的双特征因果 DAG，并指出它所蕴含的反事实公平条件。

4. 2024 年的回溯反事实论文避免了对受保护属性施加干预。描述一个这一点对法律合规性至关重要的场景。

5. ICLR 2024 的调和论点主张群体公平与反事实公平是同一结构的不同侧面。在 `code/main.py` 的三条准则中任选两条，陈述使它们等价所需的因果假设。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 它真正的意思 |
|------|-----------------|------------------------|
| Demographic parity | 「比例相等」 | P(Y=1 \| A=a) 在各群体之间相等 |
| Equalized odds | 「TPR/FPR 相等」 | 各群体的 true-positive 和 false-positive 比例相等 |
| Conditional use accuracy | 「PPV/NPV 相等」 | 各群体的预测值相等 |
| Individual fairness | 「Lipschitz 条件」 | 相似个体得到相似决策 |
| Counterfactual fairness | 「因果改变下的不变性」 | 在反事实地改变属性后决策不变 |
| Backtracking counterfactual | 「用实际值解释」 | 反事实由结果向后推理，而不是从属性向前推理 |
| Impossibility theorem | 「三者冲突」 | Chouldechova / KMR 2017：在基础发生率不相等时群体准则相互排斥 |

## 延伸阅读（Further Reading）

- [Dwork et al. — Fairness through Awareness (arXiv:1104.3913)](https://arxiv.org/abs/1104.3913) —— 个体公平
- [Kusner, Loftus, Russell, Silva — Counterfactual Fairness (arXiv:1703.06856)](https://arxiv.org/abs/1703.06856) —— 反事实公平
- [Chouldechova — Fair prediction with disparate impact (arXiv:1703.00056)](https://arxiv.org/abs/1703.00056) —— 不可能性
- [Backtracking Counterfactuals (arXiv:2401.13935)](https://arxiv.org/abs/2401.13935) —— 受保护属性干预的新范式
