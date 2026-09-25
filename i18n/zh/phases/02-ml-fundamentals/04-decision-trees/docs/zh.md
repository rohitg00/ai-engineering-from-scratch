# 决策树与随机森林

> 决策树不过是一张流程图。但由它们组成的森林，却是机器学习中最强大的工具之一。

**Type:** Build
**Language:** Python
**Prerequisites:** Phase 1（第 09 课 信息论、第 06 课 概率）
**Time:** 约 90 分钟

## 学习目标

- 实现 Gini 不纯度、熵和信息增益的计算，以找到最优的决策树分裂点
- 从零构建一个带预剪枝控制（最大深度、最小样本数）的决策树分类器
- 使用 bootstrap 采样和特征随机化构建随机森林，并解释它为何能降低方差
- 比较 MDI 特征重要性与置换重要性，并识别 MDI 何时存在偏差

## 问题

你有一份表格数据。行是样本，列是特征，还有一个你想预测的目标列。你可以直接上神经网络。但对于表格数据，基于树的模型（决策树、随机森林、梯度提升树）始终优于深度学习。Kaggle 上的结构化数据竞赛由 XGBoost 和 LightGBM 主导，而不是 Transformer。

为什么？树模型无需预处理即可处理混合特征类型（数值型和分类型）。它们无需特征工程即可处理非线性关系。它们是可解释的：你可以查看树，确切地看到预测为何产生。而平均了许多树的随机森林，在中等规模数据集上具有很强的抗过拟合能力。

本课使用递归分裂从零构建决策树，然后在其之上构建随机森林。你将实现分裂准则背后的数学（Gini 不纯度、熵、信息增益），并理解为什么弱学习器的集成会变强。

## 概念

### 决策树做什么

决策树通过一系列是/否问题，将特征空间划分为矩形区域。

```mermaid
graph TD
    A["Age < 30?"] -->|Yes| B["Income > 50k?"]
    A -->|No| C["Credit Score > 700?"]
    B -->|Yes| D["Approve"]
    B -->|No| E["Deny"]
    C -->|Yes| F["Approve"]
    C -->|No| G["Deny"]
```

每个内部节点针对某个阈值测试一个特征。每个叶节点做出一个预测。要分类一个新数据点，你从根节点开始，沿分支走直到到达叶节点。

树的构建是自顶向下的：在每个节点上，选择最能分离数据的特征和阈值。“最好”由分裂准则定义。

### 分裂准则：度量不纯度

在每个节点上，我们有一组样本。我们希望对它们进行分裂，使得到的子节点尽可能“纯”，即每个子节点主要包含一个类别。

**Gini 不纯度**衡量的是：如果一个随机抽取的样本按照该节点的类别分布来标注，它被错误分类的概率。

```
Gini(S) = 1 - sum(p_k^2)

where p_k is the proportion of class k in set S.
```

对于纯节点（全为一个类别），Gini = 0。对于 50/50 的二分类分裂，Gini = 0.5。越低越好。

```
Example: 6 cats, 4 dogs

Gini = 1 - (0.6^2 + 0.4^2) = 1 - (0.36 + 0.16) = 0.48
```

**熵**衡量节点中的信息量（混乱程度）。在 Phase 1 第 09 课中已讲过。

```
Entropy(S) = -sum(p_k * log2(p_k))
```

对于纯节点，熵 = 0。对于 50/50 的二分类分裂，熵 = 1.0。越低越好。

```
Example: 6 cats, 4 dogs

Entropy = -(0.6 * log2(0.6) + 0.4 * log2(0.4))
        = -(0.6 * -0.737 + 0.4 * -1.322)
        = 0.442 + 0.529
        = 0.971 bits
```

**信息增益**是分裂后不纯度（熵或 Gini）的降低量。

```
IG(S, feature, threshold) = Impurity(S) - weighted_avg(Impurity(S_left), Impurity(S_right))

where the weights are the proportions of samples in each child.
```

每个节点上的贪心算法：尝试每个特征和每个可能的阈值，选择使信息增益最大的（特征， 阈值）组合。

### 分裂是如何工作的

对于当前节点上有 n 个特征和 m 个样本的数据集：

1. 对每个特征 j（j = 1 到 n）：
   - 按特征 j 对样本排序
   - 尝试相邻不同值之间的每个中点作为阈值
   - 计算每个阈值的信息增益
2. 选择信息增益最高的特征和阈值
3. 将数据分裂为左（feature <= threshold）和右（feature > threshold）
4. 对每个子节点递归

这种贪心方法不能保证得到全局最优树。找到最优树是 NP-hard 问题。但贪心分裂在实践中效果很好。

### 停止条件

没有停止条件的话，树会一直生长直到每个叶节点都纯净（每个叶节点一个样本）。这会完美地记住训练数据，但泛化能力极差。

**预剪枝**在树完全长成之前停止它：
- 最大深度：树达到设定深度时停止分裂
- 每个叶节点的最小样本数：节点样本少于 k 个时停止
- 最小信息增益：最佳分裂对不纯度的改善小于阈值时停止
- 最大叶节点数：限制叶节点总数

**后剪枝**先让树完全长成，然后修剪回去：
- 代价复杂度剪枝（scikit-learn 使用）：加入与叶节点数量成正比的惩罚项。增大惩罚以获得更小的树
- 错误率降低剪枝：如果移除某个子树后验证误差不增加，则移除它

预剪枝更简单、更快。后剪枝通常产生更好的树，因为它不会过早停止那些可能引出更多有用分裂的分裂。

### 用于回归的决策树

在回归中，叶节点的预测是该叶节点中目标值的均值。分裂准则也随之改变：

**方差减少**取代信息增益：

```
VR(S, feature, threshold) = Var(S) - weighted_avg(Var(S_left), Var(S_right))
```

选择使方差减少最多的分裂。树将输入空间划分为若干区域，并在每个区域中预测一个常数（均值）。

### 随机森林：集成的力量

单棵决策树方差很高。数据的微小变化可能产生完全不同的树。随机森林通过平均许多树来解决这个问题。

```mermaid
graph TD
    D["Training Data"] --> B1["Bootstrap Sample 1"]
    D --> B2["Bootstrap Sample 2"]
    D --> B3["Bootstrap Sample 3"]
    D --> BN["Bootstrap Sample N"]
    B1 --> T1["Tree 1<br>(random feature subset)"]
    B2 --> T2["Tree 2<br>(random feature subset)"]
    B3 --> T3["Tree 3<br>(random feature subset)"]
    BN --> TN["Tree N<br>(random feature subset)"]
    T1 --> V["Aggregate Predictions<br>(majority vote or average)"]
    T2 --> V
    T3 --> V
    TN --> V
```

两个随机性来源使树彼此多样：

**Bagging（bootstrap aggregating）：** 每棵树在 bootstrap 样本上训练，即从训练数据中有放回地随机抽样。大约 63% 的原始样本会出现在每个 bootstrap 中（其余是袋外样本，可用于验证）。

**特征随机化：** 在每次分裂时，只考虑特征的随机子集。对于分类，默认是 sqrt(n_features)；对于回归，是 n_features/3。这防止所有树都在同一个主导特征上分裂。

关键洞察：平均许多不相关的树可以在不增加偏差的情况下降低方差。每棵单独的树可能很平庸，但集成是强大的。

### 特征重要性

随机森林天然提供特征重要性分数。最常用的方法：

**不纯度平均减少（MDI）：** 对每个特征，累加所有树中所有使用该特征的节点上不纯度的总降低量。在较早的分裂中产生更大不纯度降低的特征更重要。

```
importance(feature_j) = sum over all nodes where feature_j is used:
    (n_samples_at_node / n_total_samples) * impurity_decrease
```

这种方法很快（在训练过程中计算），但偏向高基数特征以及有更多可能分裂点的特征。

**置换重要性**是另一种选择：打乱一个特征的值，衡量模型准确率下降多少。更可靠但更慢。

### 何时树优于神经网络

在表格数据上，树和森林胜过神经网络。原因有几个：

| 因素 | 树 | 神经网络 |
|--------|-------|----------------|
| 混合类型（数值 + 分类） | 原生支持 | 需要编码 |
| 小数据集（< 1 万行） | 效果好 | 过拟合 |
| 特征交互 | 通过分裂发现 | 需要架构设计 |
| 可解释性 | 完全透明 | 黑箱 |
| 训练时间 | 分钟级 | 小时级 |
| 超参数敏感度 | 低 | 高 |

当数据具有空间或序列结构（图像、文本、音频）时，神经网络获胜。对于扁平的特征表格，树是默认选择。

```figure
decision-tree-depth
```

## 动手构建

### 步骤 1：Gini 不纯度和熵

从零实现两种分裂准则，并验证它们对哪些分裂是好的判断一致。

```python
import math

def gini_impurity(labels):
    n = len(labels)
    if n == 0:
        return 0.0
    counts = {}
    for label in labels:
        counts[label] = counts.get(label, 0) + 1
    return 1.0 - sum((c / n) ** 2 for c in counts.values())

def entropy(labels):
    n = len(labels)
    if n == 0:
        return 0.0
    counts = {}
    for label in labels:
        counts[label] = counts.get(label, 0) + 1
    return -sum(
        (c / n) * math.log2(c / n) for c in counts.values() if c > 0
    )
```

### 步骤 2：寻找最佳分裂

尝试每个特征和每个阈值，返回信息增益最高的那个。

```python
def information_gain(parent_labels, left_labels, right_labels, criterion="gini"):
    measure = gini_impurity if criterion == "gini" else entropy
    n = len(parent_labels)
    n_left = len(left_labels)
    n_right = len(right_labels)
    if n_left == 0 or n_right == 0:
        return 0.0
    parent_impurity = measure(parent_labels)
    child_impurity = (
        (n_left / n) * measure(left_labels) +
        (n_right / n) * measure(right_labels)
    )
    return parent_impurity - child_impurity
```

### 步骤 3：构建 DecisionTree 类

递归分裂、预测和特征重要性追踪。`_build` 是树的核心：当节点纯净或达到预剪枝限制时停止，否则选取最佳分裂并递归到两个子节点。

```python
import random

class DecisionTree:
    def __init__(self, max_depth=None, min_samples_split=2,
                 min_samples_leaf=1, criterion="gini",
                 max_features=None):
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.min_samples_leaf = min_samples_leaf
        self.criterion = criterion
        self.max_features = max_features
        self.tree = None
        self.feature_importances_ = None

    def fit(self, X, y):
        self.n_features = len(X[0])
        self.feature_importances_ = [0.0] * self.n_features
        self.n_samples = len(X)
        self.tree = self._build(X, y, depth=0)
        total = sum(self.feature_importances_)
        if total > 0:
            self.feature_importances_ = [
                fi / total for fi in self.feature_importances_
            ]

    def predict(self, X):
        return [self._predict_one(x, self.tree) for x in X]

    def _build(self, X, y, depth):
        if len(set(y)) == 1:
            return {"leaf": True, "value": y[0]}

        if self.max_depth is not None and depth >= self.max_depth:
            return self._make_leaf(y)

        if len(y) < self.min_samples_split:
            return self._make_leaf(y)

        best_feature, best_threshold, best_gain = self._best_split(X, y)

        if best_feature is None or best_gain <= 0:
            return self._make_leaf(y)

        left_X, left_y, right_X, right_y = self._split_data(
            X, y, best_feature, best_threshold
        )

        if len(left_y) < self.min_samples_leaf or len(right_y) < self.min_samples_leaf:
            return self._make_leaf(y)

        weight = len(y) / self.n_samples
        self.feature_importances_[best_feature] += weight * best_gain

        return {
            "leaf": False,
            "feature": best_feature,
            "threshold": best_threshold,
            "left": self._build(left_X, left_y, depth + 1),
            "right": self._build(right_X, right_y, depth + 1),
        }

    def _make_leaf(self, y):
        counts = {}
        for label in y:
            counts[label] = counts.get(label, 0) + 1
        return {"leaf": True, "value": max(counts, key=counts.get)}

    def _best_split(self, X, y):
        best_feature = None
        best_threshold = None
        best_gain = -1.0

        if self.max_features == "sqrt":
            k = max(1, int(math.sqrt(self.n_features)))
            feature_indices = random.sample(range(self.n_features), k)
        elif isinstance(self.max_features, int):
            if self.max_features < 1:
                raise ValueError("max_features must be at least 1 when given as an integer")
            k = min(self.max_features, self.n_features)
            feature_indices = random.sample(range(self.n_features), k)
        else:
            feature_indices = list(range(self.n_features))

        for feature_idx in feature_indices:
            values = sorted(set(X[i][feature_idx] for i in range(len(X))))
            if len(values) <= 1:
                continue

            for i in range(len(values) - 1):
                threshold = (values[i] + values[i + 1]) / 2.0
                left_y = [y[j] for j in range(len(X)) if X[j][feature_idx] <= threshold]
                right_y = [y[j] for j in range(len(X)) if X[j][feature_idx] > threshold]

                if len(left_y) < self.min_samples_leaf or len(right_y) < self.min_samples_leaf:
                    continue

                gain = information_gain(y, left_y, right_y, self.criterion)
                if gain > best_gain:
                    best_gain = gain
                    best_feature = feature_idx
                    best_threshold = threshold

        return best_feature, best_threshold, best_gain

    def _split_data(self, X, y, feature, threshold):
        left_X, left_y, right_X, right_y = [], [], [], []
        for i in range(len(X)):
            if X[i][feature] <= threshold:
                left_X.append(X[i])
                left_y.append(y[i])
            else:
                right_X.append(X[i])
                right_y.append(y[i])
        return left_X, left_y, right_X, right_y

    def _predict_one(self, x, node):
        if node["leaf"]:
            return node["value"]
        if x[node["feature"]] <= node["threshold"]:
            return self._predict_one(x, node["left"])
        return self._predict_one(x, node["right"])
```

### 步骤 4：构建 RandomForest 类

Bootstrap 采样、特征随机化和多数投票。

```python
class RandomForest:
    def __init__(self, n_trees=100, max_depth=None,
                 min_samples_split=2, max_features="sqrt",
                 criterion="gini"):
        self.n_trees = n_trees
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.max_features = max_features
        self.criterion = criterion
        self.trees = []

    def fit(self, X, y):
        n = len(X)
        for _ in range(self.n_trees):
            indices = [random.randint(0, n - 1) for _ in range(n)]
            X_boot = [X[i] for i in indices]
            y_boot = [y[i] for i in indices]
            tree = DecisionTree(
                max_depth=self.max_depth,
                min_samples_split=self.min_samples_split,
                max_features=self.max_features,
                criterion=self.criterion,
            )
            tree.fit(X_boot, y_boot)
            self.trees.append(tree)

    def predict(self, X):
        all_preds = [tree.predict(X) for tree in self.trees]
        predictions = []
        for i in range(len(X)):
            votes = {}
            for preds in all_preds:
                v = preds[i]
                votes[v] = votes.get(v, 0) + 1
            predictions.append(max(votes, key=votes.get))
        return predictions
```

完整实现及所有辅助方法见 `code/trees.py`。

## 使用它

使用 scikit-learn，训练一个随机森林只需三行代码：

```python
from sklearn.ensemble import RandomForestClassifier
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split

X, y = load_iris(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(X, y, random_state=42)

rf = RandomForestClassifier(n_estimators=100, random_state=42)
rf.fit(X_train, y_train)
print(f"Accuracy: {rf.score(X_test, y_test):.4f}")
print(f"Feature importances: {rf.feature_importances_}")
```

在实践中，梯度提升树（XGBoost、LightGBM、CatBoost）通常比随机森林更强，因为它们按顺序构建树，每棵树都在纠正前一棵树的错误。但随机森林更难配置出错，且几乎不需要超参数调优。

## 发布它

本课产出 `outputs/prompt-tree-interpreter.md` —— 一个为业务相关方解读决策树分裂的提示词。向它输入训练好的树的结构（深度、特征、分裂阈值、准确率），它会将模型翻译成通俗语言的规则，对特征重要性排序，标记过拟合或数据泄漏，并推荐后续步骤。每当你需要向不读代码的人解释树模型时，都可以使用它。

## 练习

1. 在一个有 3 个类别的二维数据集上训练单棵决策树。手动追踪分裂过程并画出矩形的决策边界。比较 max_depth=2 与 max_depth=10 时的边界。

2. 为回归树实现方差减少分裂。对 200 个点生成 y = sin(x) + noise 并拟合你的回归树。绘制树的分段常数预测与真实曲线的对比。

3. 构建包含 1、5、10、50 和 200 棵树的随机森林。绘制训练准确率和测试准确率随树数量的变化。观察测试准确率趋于平稳但不会下降（森林抗过拟合）。

4. 在 5 个不同数据集上比较 Gini 不纯度与熵作为分裂准则。测量准确率和树深度。在大多数情况下，它们产生几乎相同的结果。解释原因。

5. 实现置换重要性。在一个某特征是随机噪声但具有高基数的数据集上，将其与 MDI 重要性进行比较。MDI 会给噪声特征很高的排名，而置换重要性不会。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| 决策树 | “预测用的流程图” | 通过学习一系列 if/else 分裂，将特征空间划分为矩形区域的模型 |
| Gini 不纯度 | “节点有多混杂” | 在一个节点上随机样本被错误分类的概率。0 = 纯净，0.5 = 二分类下的最大不纯度 |
| 熵 | “节点中的混乱度” | 节点处的信息量。0 = 纯净，1.0 = 二分类下的最大不确定性。来自信息论 |
| 信息增益 | “分裂有多好” | 分裂后不纯度的降低量。选择分裂的贪心准则 |
| 预剪枝 | “提前停止树的生长” | 通过设置最大深度、最小样本数或最小增益阈值，提前停止树的生长 |
| 后剪枝 | “之后修剪树” | 先让树完全长成，然后移除不能改善验证性能的子树 |
| Bagging | “在随机子集上训练” | Bootstrap aggregating。每个模型在不同的有放回随机样本上训练 |
| 随机森林 | “一堆树” | 决策树的集成，每棵树在 bootstrap 样本上训练，且每次分裂使用随机特征子集 |
| 特征重要性（MDI） | “哪些特征重要” | 每个特征贡献的不纯度总降低量，在所有树和节点上求和 |
| 置换重要性 | “打乱再检验” | 随机打乱一个特征的值后准确率的下降。对噪声特征比 MDI 更可靠 |
| 方差减少 | “信息增益的回归版” | 信息增益在回归树中的对应物。选择使目标方差减少最多的分裂 |
| Bootstrap 样本 | “有重复的随机样本” | 从原始数据集中有放回抽取的随机样本。大小相同，但包含重复值 |

## 延伸阅读

- [Breiman: Random Forests (2001)](https://link.springer.com/article/10.1023/A:1010933404324) - 随机森林的原始论文
- [Grinsztajn 等：Why do tree-based models still outperform deep learning on tabular data? (2022)](https://arxiv.org/abs/2207.08815) - 树模型与神经网络在表格任务上的严谨比较
- [scikit-learn Decision Trees documentation](https://scikit-learn.org/stable/modules/tree.html) - 带可视化工具的实用指南
- [XGBoost: A Scalable Tree Boosting System (Chen & Guestrin, 2016)](https://arxiv.org/abs/1603.02754) - 主导 Kaggle 的梯度提升论文