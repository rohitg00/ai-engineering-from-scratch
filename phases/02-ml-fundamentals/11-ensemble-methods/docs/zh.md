# 集成方法

> 一群弱学习器，正确组合后，变成了强学习器。这不仅仅是比喻。这是一个定理。

**类型：** 构建
**语言：** Python
**前置要求：** 第二阶段，第10课（偏差-方差权衡）
**时间：** ~120分钟

## 学习目标

- 从头实现 AdaBoost 和梯度提升，并解释 boosting 如何顺序减少偏差
- 构建 bagging 集成，并证明平均去相关模型如何在不增加偏差的情况下减少方差
- 比较 bagging、boosting 和 stacking 各自针对的误差分量
- 评估集成多样性，并解释为什么多数投票的准确率随更多独立的弱学习器而提高

## 问题

一棵决策树训练快、易于解释，但会过拟合。一个线性模型在复杂边界上会欠拟合。你可以花数天设计完美的模型架构。或者你可以组合一群不完美的模型，得到比其中任何一个都更好的结果。

集成方法正是这样做的。它们是在表格数据上赢得 Kaggle 比赛最可靠的技术，为大多数生产级 ML 系统提供动力，并且它们直观地展示了偏差-方差权衡。Bagging 减少方差。Boosting 减少偏差。Stacking 学习在哪些输入上信任哪些模型。

## 概念

### 为什么集成有效

假设你有 N 个独立的分类器，每个的准确率为 p > 0.5。多数投票的准确率为：

```
P(多数正确) = 对 k > N/2 求和的 C(N,k) * p^k * (1-p)^(N-k)
```

对于 21 个每个准确率 60% 的分类器，多数投票准确率约为 74%。对于 101 个，上升到 84%。当模型犯不同的错误时，错误被抵消了。

关键要求是**多样性（diversity）**。如果所有模型犯同样的错误，组合它们毫无帮助。集成之所以有效，是因为它们通过以下方式产生多样化的模型：

- 不同的训练子集（bagging）
- 不同的特征子集（随机森林）
- 顺序错误纠正（boosting）
- 不同的模型族（stacking）

### Bagging（Bootstrap 聚合）

Bagging 通过在训练数据的不同 bootstrap 样本上训练每个模型来创建多样性。

```mermaid
flowchart TD
    D[训练数据] --> B1[Bootstrap 样本 1]
    D --> B2[Bootstrap 样本 2]
    D --> B3[Bootstrap 样本 3]
    D --> BN[Bootstrap 样本 N]

    B1 --> M1[模型 1]
    B2 --> M2[模型 2]
    B3 --> M3[模型 3]
    BN --> MN[模型 N]

    M1 --> V[平均或多数投票]
    M2 --> V
    M3 --> V
    MN --> V

    V --> P[最终预测]
```

Bootstrap 样本是从原始数据中有放回地抽取的，大小与原始数据相同。每个 bootstrap 中约包含 63.2% 的唯一样本。剩余的 36.8%（袋外样本）提供了免费的验证集。

Bagging 在不显著增加偏差的情况下减少方差。每棵单独的树都会过拟合其 bootstrap 样本，但每棵树的过拟合是不同的，因此求平均会抵消噪声。

**随机森林（Random Forests）** 是 bagging 加上一个额外的技巧：在每个分裂点，只考虑一个随机特征子集。这迫使树之间产生更多的多样性。候选特征的典型数量是分类的 `sqrt(n_features)` 和回归的 `n_features / 3`。

### Boosting（顺序错误纠正）

Boosting 顺序训练模型。每个新模型关注之前模型犯错的样本。

```mermaid
flowchart LR
    D[带权重的数据] --> M1[模型 1]
    M1 --> E1[发现错误]
    E1 --> W1[增加错误样本的权重]
    W1 --> M2[模型 2]
    M2 --> E2[发现错误]
    E2 --> W2[增加错误样本的权重]
    W2 --> M3[模型 3]
    M3 --> F[所有模型的加权和]
```

Boosting 减少偏差。每个新模型纠正当前集成的系统性错误。最终预测是所有模型的加权和，其中更好的模型获得更高的权重。

权衡：如果你运行太多轮次，boosting 可能会过拟合，因为它持续拟合更难的样本，其中一些可能是噪声。

### AdaBoost

AdaBoost（自适应 Boosting）是第一个实用的 boosting 算法。它可以与任何基学习器配合使用，典型的是决策桩（深度为1的树）。

算法：

```
1. 初始化样本权重：对所有 i，w_i = 1/N

2. 对 t = 1 到 T：
   a. 在加权数据上训练弱学习器 h_t
   b. 计算加权误差：
      err_t = sum(w_i * I(h_t(x_i) != y_i)) / sum(w_i)
   c. 计算模型权重：
      alpha_t = 0.5 * ln((1 - err_t) / err_t)
   d. 更新样本权重：
      w_i = w_i * exp(-alpha_t * y_i * h_t(x_i))
   e. 归一化权重使其和为 1

3. 最终预测：H(x) = sign(sum(alpha_t * h_t(x)))
```

误差低的模型获得更高的 alpha。被错误分类的样本获得更高的权重，以便下一个模型关注它们。

### 梯度提升

梯度提升将 boosting 推广到任意损失函数。它不是重新加权样本，而是将每个新模型拟合到当前集成的残差（损失的负梯度）。

```
1. 初始化：F_0(x) = argmin_c sum(L(y_i, c))

2. 对 t = 1 到 T：
   a. 计算伪残差：
      r_i = -dL(y_i, F_{t-1}(x_i)) / dF_{t-1}(x_i)
   b. 拟合一个树 h_t 到残差 r_i
   c. 找到最佳步长：
      gamma_t = argmin_gamma sum(L(y_i, F_{t-1}(x_i) + gamma * h_t(x_i)))
   d. 更新：
      F_t(x) = F_{t-1}(x) + learning_rate * gamma_t * h_t(x)

3. 最终预测：F_T(x)
```

对于平方误差损失，伪残差就是实际残差：`r_i = y_i - F_{t-1}(x_i)`。每棵树实际上是拟合前一个集成的误差。

学习率（缩减）控制每棵树的贡献。较小的学习率需要更多树，但泛化能力更好。典型值：0.01 到 0.3。

### XGBoost：它为什么主导表格数据

XGBoost（eXtreme Gradient Boosting）是带有工程优化的梯度提升，使其快速、准确且抗过拟合：

- **正则化目标：** 对叶权重的 L1 和 L2 惩罚防止单棵树过于自信
- **二阶近似：** 使用损失的一阶和二阶导数，给出更好的分裂决策
- **稀疏感知分裂：** 通过在每个分裂点学习缺失数据的最佳方向，原生处理缺失值
- **列采样：** 像随机森林一样，在每个分裂点采样特征以获得多样性
- **加权分位数草图：** 在分布式数据上高效找到连续特征的分裂点
- **缓存感知块结构：** 针对 CPU 缓存线优化的内存布局

对于表格数据，XGBoost（及其后继者 LightGBM）持续优于神经网络。这在短期内不会改变。如果你的数据适合放在有行和列的表中，从梯度提升开始。

### Stacking（元学习）

Stacking 使用多个基模型的预测作为元学习器的特征。

```mermaid
flowchart TD
    D[训练数据] --> M1[模型 1：随机森林]
    D --> M2[模型 2：SVM]
    D --> M3[模型 3：逻辑回归]

    M1 --> P1[预测 1]
    M2 --> P2[预测 2]
    M3 --> P3[预测 3]

    P1 --> META[元学习器]
    P2 --> META
    P3 --> META

    META --> F[最终预测]
```

元学习器学习对于哪些输入信任哪些基模型。如果随机森林在某些区域更好而 SVM 在其他区域更好，元学习器将学会相应地进行路由。

为避免数据泄露，基模型的预测必须通过训练集上的交叉验证生成。你永远不能在同一数据上训练基模型并生成元特征。

### 投票

最简单的集成。直接组合预测。

- **硬投票：** 对类别标签进行多数投票。
- **软投票：** 平均预测概率，选择平均概率最高的类别。通常更好，因为它使用了置信度信息。

## 动手实现

### 第1步：决策桩（基学习器）

`code/ensembles.py` 中的代码从头实现了一切。我们从决策桩开始：一个单次分裂的树。

```python
class DecisionStump:
    def __init__(self):
        self.feature_idx = None
        self.threshold = None
        self.polarity = 1
        self.alpha = None

    def fit(self, X, y, weights):
        n_samples, n_features = X.shape
        best_error = float("inf")

        for f in range(n_features):
            thresholds = np.unique(X[:, f])
            for thresh in thresholds:
                for polarity in [1, -1]:
                    pred = np.ones(n_samples)
                    pred[polarity * X[:, f] < polarity * thresh] = -1
                    error = np.sum(weights[pred != y])
                    if error < best_error:
                        best_error = error
                        self.feature_idx = f
                        self.threshold = thresh
                        self.polarity = polarity

    def predict(self, X):
        n = X.shape[0]
        pred = np.ones(n)
        idx = self.polarity * X[:, self.feature_idx] < self.polarity * self.threshold
        pred[idx] = -1
        return pred
```

### 第2步：从头实现 AdaBoost

```python
class AdaBoostScratch:
    def __init__(self, n_estimators=50):
        self.n_estimators = n_estimators
        self.stumps = []
        self.alphas = []

    def fit(self, X, y):
        n = X.shape[0]
        weights = np.full(n, 1 / n)

        for _ in range(self.n_estimators):
            stump = DecisionStump()
            stump.fit(X, y, weights)
            pred = stump.predict(X)

            err = np.sum(weights[pred != y])
            err = np.clip(err, 1e-10, 1 - 1e-10)

            alpha = 0.5 * np.log((1 - err) / err)
            weights *= np.exp(-alpha * y * pred)
            weights /= weights.sum()

            stump.alpha = alpha
            self.stumps.append(stump)
            self.alphas.append(alpha)

    def predict(self, X):
        total = sum(a * s.predict(X) for a, s in zip(self.alphas, self.stumps))
        return np.sign(total)
```

### 第3步：从头实现梯度提升

```python
class GradientBoostingScratch:
    def __init__(self, n_estimators=100, learning_rate=0.1, max_depth=3):
        self.n_estimators = n_estimators
        self.lr = learning_rate
        self.max_depth = max_depth
        self.trees = []
        self.initial_pred = None

    def fit(self, X, y):
        self.initial_pred = np.mean(y)
        current_pred = np.full(len(y), self.initial_pred)

        for _ in range(self.n_estimators):
            residuals = y - current_pred
            tree = SimpleRegressionTree(max_depth=self.max_depth)
            tree.fit(X, residuals)
            update = tree.predict(X)
            current_pred += self.lr * update
            self.trees.append(tree)

    def predict(self, X):
        pred = np.full(X.shape[0], self.initial_pred)
        for tree in self.trees:
            pred += self.lr * tree.predict(X)
        return pred
```

### 第4步：与 sklearn 比较

代码验证了我们从头实现的版本产生的准确率与 sklearn 的 `AdaBoostClassifier` 和 `GradientBoostingClassifier` 相似，并并排比较所有方法。

## 使用它

### 何时使用每种方法

| 方法 | 减少 | 最适合 | 注意 |
|--------|---------|----------|---------------|
| Bagging / 随机森林 | 方差 | 噪声数据、多特征 | 不能帮助解决偏差问题 |
| AdaBoost | 偏差 | 干净数据、简单基学习器 | 对异常值和噪声敏感 |
| 梯度提升 | 偏差 | 表格数据、比赛 | 训练慢，不调优容易过拟合 |
| XGBoost / LightGBM | 两者 | 生产级表格 ML | 超参数多 |
| Stacking | 两者 | 争取最后 1-2% 准确率 | 复杂，元学习器过拟合风险 |
| 投票 | 方差 | 快速组合多样化模型 | 仅当模型多样化时才有用 |

### 表格数据的生产级选型

对于大多数表格预测问题，这是尝试的顺序：

1. **LightGBM 或 XGBoost** 使用默认参数
2. 调优 n_estimators、learning_rate、max_depth、min_child_weight
3. 如果你需要最后 0.5%，用 3-5 个多样化模型构建 stacking 集成
4. 全程使用交叉验证

尽管不断有研究尝试，神经网络在表格数据上几乎总是比梯度提升更差。TabNet、NODE 和类似架构偶尔能匹配但很少能击败调优好的 XGBoost。

## 交付使用

本课程产出 `outputs/prompt-ensemble-selector.md` -- 一个帮助你为给定数据集选择正确集成方法的提示词。描述你的数据（大小、特征类型、噪声水平、类别平衡）和你正在解决的问题。该提示词会走查一个决策清单，推荐一种方法，建议起始超参数，并警告该方法的常见错误。同时产出 `outputs/skill-ensemble-builder.md`，包含完整的选择指南。

## 练习题

1. 修改 AdaBoost 实现，跟踪每轮后的训练准确率。绘制准确率与估计器数量的关系图。何时收敛？
2. 通过向回归树添加随机特征子采样，从头实现随机森林。用 `max_features=sqrt(n_features)` 训练 100 棵树并平均预测。与单棵树的方差减少进行比较。
3. 在梯度提升实现中，添加早停：跟踪每轮后的验证损失，当连续 10 轮没有改善时停止。它实际需要多少棵树？
4. 构建一个 stacking 集成，使用三个基模型（逻辑回归、决策树、K 近邻）和一个逻辑回归元学习器。使用 5 折交叉验证生成元特征。与每个单独的基模型进行比较。
5. 在同一数据集上使用默认参数运行 XGBoost。将其准确率与你的从头实现的梯度提升进行比较。计时两者。速度差异有多大？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| Bagging | "在随机子集上训练" | Bootstrap 聚合：在 bootstrap 样本上训练模型，平均预测以减少方差 |
| Boosting | "关注困难样本" | 顺序训练模型，每个纠正当前集成的错误，以减少偏差 |
| AdaBoost | "重新加权数据" | 通过样本权重更新的 Boosting；被错误分类的点在下一个学习器中获得更高权重 |
| 梯度提升（Gradient boosting） | "拟合残差" | 通过将每个新模型拟合到损失函数的负梯度来进行 Boosting |
| XGBoost | "Kaggle 武器" | 带正则化、二阶优化和系统级速度技巧的梯度提升 |
| Stacking | "模型之上的模型" | 将基模型的预测作为元学习器的输入特征 |
| 随机森林（Random forest） | "许多随机化的树" | 对决策树使用 Bagging，在每个分裂点添加随机特征子采样以获得多样性 |
| 集成多样性（Ensemble diversity） | "犯不同的错误" | 模型必须在错误上不相关，集成才能比个体更好 |
| 袋外误差（Out-of-bag error） | "免费验证" | 不在 bootstrap 抽取中的样本（~36.8%）作为验证集，无需独立保留集 |

## 延伸阅读

- [Schapire & Freund: Boosting: Foundations and Algorithms](https://mitpress.mit.edu/9780262526036/) -- AdaBoost 创造者的著作
- [Friedman: Greedy Function Approximation: A Gradient Boosting Machine (2001)](https://statweb.stanford.edu/~jhf/ftp/trebst.pdf) -- 原始梯度提升论文
- [Chen & Guestrin: XGBoost (2016)](https://arxiv.org/abs/1603.02754) -- XGBoost 论文
- [Wolpert: Stacked Generalization (1992)](https://www.sciencedirect.com/science/article/abs/pii/S0893608005800231) -- 原始 stacking 论文
- [scikit-learn Ensemble Methods](https://scikit-learn.org/stable/modules/ensemble.html) -- 实用参考
