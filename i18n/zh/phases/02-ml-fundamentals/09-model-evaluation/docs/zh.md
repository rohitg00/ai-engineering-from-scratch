# 模型评估

> 模型的好坏取决于你衡量它的方式。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 1 (概率与分布、机器学习统计), Phase 2 第 1-8 课
**Time:** ~90 分钟

## 学习目标

- 从零实现 K 折和分层 K 折交叉验证，并解释为什么分层对不平衡数据很重要
- 从零计算 precision、recall、F1、AUC-ROC 以及回归指标(MSE、RMSE、MAE、R-squared)
- 通过解读学习曲线诊断模型是高偏差还是高方差
- 识别常见的评估错误，包括数据泄露、指标选择错误和测试集污染

## 问题所在

你训练了一个模型，在你的数据上达到了 95% 的准确率。这算好吗？

也许好，也许不好。如果你的数据中 95% 属于同一个类别，那么一个总是预测该类别的模型就能得到 95% 的准确率，却完全没用。如果你在训练所用的同一份数据上进行评估，那 95% 的数字毫无意义，因为模型只是记住了答案。如果你的数据集具有时间属性，而你在划分前进行了随机打乱，那么模型可能是在用未来的数据预测过去。

模型评估是大多数机器学习项目出问题的地方。错误的指标会让糟糕的模型看起来不错。错误的划分会让模型作弊。错误的比较会让你选到更差的模型。把评估做对不是可选项，它决定了模型是能在生产环境中正常工作，还是一接触真实数据就失败。

## 核心概念

### 训练集、验证集、测试集

```mermaid
flowchart LR
    A[Full Dataset] --> B[Train Set 60-70%]
    A --> C[Validation Set 15-20%]
    A --> D[Test Set 15-20%]
    B --> E[Fit Model]
    E --> C
    C --> F[Tune Hyperparameters]
    F --> E
    F --> G[Final Model]
    G --> D
    D --> H[Report Performance]
```

三种划分，三种用途：

- **训练集**:模型从这份数据中学习，训练过程中会看到这些样本。
- **验证集**:用于调超参数和模型选择。模型从不在这些数据上训练，但你的决策会受其影响。
- **测试集**:只在最后触碰一次，用于报告最终性能。如果你查看了测试性能后又回头修改模型，它就不再是测试集，而是变成了第二个验证集。

测试集是你的留出保证，确保所报告的性能反映模型在真正未见过的数据上的表现。

### K 折交叉验证

当数据集很小时，单次训练/验证划分会浪费数据，且估计结果噪声较大。K 折交叉验证让所有数据都同时用于训练和验证：

```mermaid
flowchart TB
    subgraph Fold1["Fold 1"]
        direction LR
        V1["Val"] --- T1a["Train"] --- T1b["Train"] --- T1c["Train"] --- T1d["Train"]
    end
    subgraph Fold2["Fold 2"]
        direction LR
        T2a["Train"] --- V2["Val"] --- T2b["Train"] --- T2c["Train"] --- T2d["Train"]
    end
    subgraph Fold3["Fold 3"]
        direction LR
        T3a["Train"] --- T3b["Train"] --- V3["Val"] --- T3c["Train"] --- T3d["Train"]
    end
    subgraph Fold4["Fold 4"]
        direction LR
        T4a["Train"] --- T4b["Train"] --- T4c["Train"] --- V4["Val"] --- T4d["Train"]
    end
    subgraph Fold5["Fold 5"]
        direction LR
        T5a["Train"] --- T5b["Train"] --- T5c["Train"] --- T5d["Train"] --- V5["Val"]
    end
    Fold1 --> R["Average scores"]
    Fold2 --> R
    Fold3 --> R
    Fold4 --> R
    Fold5 --> R
```

1. 将数据划分为 K 个大小相等的折
2. 对每个折，在其余 K-1 个折上训练，在该折上验证
3. 对 K 个验证得分取平均

K=5 或 K=10 是标准选择。每个数据点恰好被用于验证一次。平均得分比任何单次划分都更稳定。

**分层 K 折**:在每个折中保持类别分布。如果数据集中类别 A 占 70%、类别 B 占 30%,每个折都会有大致相同的比例。这对不平衡数据集很重要，因为随机划分可能把所有少数类样本都放进同一个折。

### 分类指标

**混淆矩阵**:一切的基础。对于二分类：

|  | 预测为正 | 预测为负 |
|--|---|---|
| 实际为正 | True Positive (TP) | False Negative (FN) |
| 实际为负 | False Positive (FP) | True Negative (TN) |

所有其他指标都由这个矩阵推导而来：

- **Accuracy(准确率)** = (TP + TN) / (TP + TN + FP + FN)。预测正确的比例。类别不平衡时具有误导性。
- **Precision(精确率)** = TP / (TP + FP)。在所有预测为正的样本中，有多少确实为正？当假正代价高时使用(例如垃圾邮件过滤器把真实邮件标记为垃圾邮件)。
- **Recall(召回率/灵敏度)** = TP / (TP + FN)。在所有实际为正的样本中，我们捕获了多少？当假负代价高时使用(例如癌症筛查漏检肿瘤)。
- **F1 score** = 2 * precision * recall / (precision + recall)。precision 和 recall 的调和平均。当两者都不明显占优时用于平衡。
- **AUC-ROC**:受试者工作特征曲线下面积。绘制不同分类阈值下的真正率与假正率。AUC = 0.5 表示随机猜测，AUC = 1.0 表示完美分离。它与阈值无关：衡量模型把正样本排在负样本之上的能力，与所选的截断值无关。

### 回归指标

- **MSE**(均方误差)= mean((y_true - y_pred)^2)。对大误差进行二次惩罚。对异常值敏感。
- **RMSE**(均方根误差)= sqrt(MSE)。与目标变量单位相同，比 MSE 更容易解释。
- **MAE**(平均绝对误差)= mean(|y_true - y_pred|)。对所有误差线性处理，比 MSE 对异常值更稳健。
- **R-squared** = 1 - SS_res / SS_tot,其中 SS_res = sum((y_true - y_pred)^2),SS_tot = sum((y_true - y_mean)^2)。模型解释的方差比例。R^2 = 1.0 是完美。R^2 = 0.0 表示模型并不比总是预测均值更好。如果模型比均值还差，R^2 可以为负。

### 学习曲线

绘制训练和验证得分随训练集大小变化的曲线：

- **高偏差(欠拟合)**：两条曲线收敛到较低的得分。增加更多数据无济于事，你需要更复杂的模型。
- **高方差(过拟合)**：训练得分高，但验证得分低得多，两者差距很大。增加更多数据应该会有帮助。

### 验证曲线

绘制训练和验证得分随某个超参数变化的曲线：

- 复杂度较低时：两个得分都低(欠拟合)
- 复杂度适中时：两个得分都高且接近
- 复杂度较高时：训练得分保持高位，但验证得分下降(过拟合)

最优超参数值就是验证得分达到峰值的位置。

### 常见的评估错误

**数据泄露**：测试集的信息泄露到训练中。例子：在划分之前在整个数据集上拟合缩放器、在时间序列预测中包含未来数据、使用由目标变量派生的特征。务必先划分，再预处理。

**类别不平衡**：99% 的交易是合法的，1% 是欺诈。一个总是预测"合法"的模型能得到 99% 的准确率。应改用 precision、recall、F1 或 AUC-ROC。

**错误的指标**：在应该优化 recall 的场景(医疗诊断)中优化 accuracy,或者在数据有严重异常值时优化 RMSE(应改用 MAE)。

**不使用分层划分**：对于不平衡数据，随机划分可能导致验证折中少数类样本极少，从而产生不稳定的估计。

**测试过于频繁**：每次查看测试性能并做出调整，都是在向测试集过拟合。测试集只能用一次。

```figure
precision-recall-threshold
```

## 动手实现

### 步骤 1:训练/验证/测试划分

```python
import random
import math


def train_val_test_split(X, y, train_ratio=0.6, val_ratio=0.2, seed=42):
    random.seed(seed)
    n = len(X)
    indices = list(range(n))
    random.shuffle(indices)

    train_end = int(n * train_ratio)
    val_end = int(n * (train_ratio + val_ratio))

    train_idx = indices[:train_end]
    val_idx = indices[train_end:val_end]
    test_idx = indices[val_end:]

    X_train = [X[i] for i in train_idx]
    y_train = [y[i] for i in train_idx]
    X_val = [X[i] for i in val_idx]
    y_val = [y[i] for i in val_idx]
    X_test = [X[i] for i in test_idx]
    y_test = [y[i] for i in test_idx]

    return X_train, y_train, X_val, y_val, X_test, y_test
```

### 步骤 2:K 折和分层 K 折交叉验证

```python
def kfold_split(n, k=5, seed=42):
    random.seed(seed)
    indices = list(range(n))
    random.shuffle(indices)

    fold_size = n // k
    folds = []

    for i in range(k):
        start = i * fold_size
        end = start + fold_size if i < k - 1 else n
        val_idx = indices[start:end]
        train_idx = indices[:start] + indices[end:]
        folds.append((train_idx, val_idx))

    return folds


def stratified_kfold_split(y, k=5, seed=42):
    random.seed(seed)

    class_indices = {}
    for i, label in enumerate(y):
        class_indices.setdefault(label, []).append(i)

    for label in class_indices:
        random.shuffle(class_indices[label])

    folds = [{"train": [], "val": []} for _ in range(k)]

    for label, indices in class_indices.items():
        fold_size = len(indices) // k
        for i in range(k):
            start = i * fold_size
            end = start + fold_size if i < k - 1 else len(indices)
            val_part = indices[start:end]
            train_part = indices[:start] + indices[end:]
            folds[i]["val"].extend(val_part)
            folds[i]["train"].extend(train_part)

    return [(f["train"], f["val"]) for f in folds]


def cross_validate(X, y, model_fn, k=5, metric_fn=None, stratified=False):
    n = len(X)

    if stratified:
        folds = stratified_kfold_split(y, k)
    else:
        folds = kfold_split(n, k)

    scores = []
    for train_idx, val_idx in folds:
        X_train = [X[i] for i in train_idx]
        y_train = [y[i] for i in train_idx]
        X_val = [X[i] for i in val_idx]
        y_val = [y[i] for i in val_idx]

        model = model_fn()
        model.fit(X_train, y_train)
        predictions = [model.predict(x) for x in X_val]

        if metric_fn:
            score = metric_fn(y_val, predictions)
        else:
            score = sum(1 for yt, yp in zip(y_val, predictions) if yt == yp) / len(y_val)
        scores.append(score)

    return scores
```

### 步骤 3:混淆矩阵与分类指标

```python
def confusion_matrix(y_true, y_pred):
    tp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 1)
    tn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 0)
    fp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 1)
    fn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 0)
    return tp, tn, fp, fn


def accuracy(y_true, y_pred):
    tp, tn, fp, fn = confusion_matrix(y_true, y_pred)
    total = tp + tn + fp + fn
    return (tp + tn) / total if total > 0 else 0.0


def precision(y_true, y_pred):
    tp, tn, fp, fn = confusion_matrix(y_true, y_pred)
    return tp / (tp + fp) if (tp + fp) > 0 else 0.0


def recall(y_true, y_pred):
    tp, tn, fp, fn = confusion_matrix(y_true, y_pred)
    return tp / (tp + fn) if (tp + fn) > 0 else 0.0


def f1_score(y_true, y_pred):
    p = precision(y_true, y_pred)
    r = recall(y_true, y_pred)
    return 2 * p * r / (p + r) if (p + r) > 0 else 0.0


def roc_curve(y_true, y_scores):
    thresholds = sorted(set(y_scores), reverse=True)
    tpr_list = []
    fpr_list = []

    total_positives = sum(y_true)
    total_negatives = len(y_true) - total_positives

    for threshold in thresholds:
        y_pred = [1 if s >= threshold else 0 for s in y_scores]
        tp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 1)
        fp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 1)

        tpr = tp / total_positives if total_positives > 0 else 0.0
        fpr = fp / total_negatives if total_negatives > 0 else 0.0

        tpr_list.append(tpr)
        fpr_list.append(fpr)

    return fpr_list, tpr_list, thresholds


def auc_roc(y_true, y_scores):
    fpr_list, tpr_list, _ = roc_curve(y_true, y_scores)

    pairs = sorted(zip(fpr_list, tpr_list))
    fpr_sorted = [p[0] for p in pairs]
    tpr_sorted = [p[1] for p in pairs]

    area = 0.0
    for i in range(1, len(fpr_sorted)):
        width = fpr_sorted[i] - fpr_sorted[i - 1]
        height = (tpr_sorted[i] + tpr_sorted[i - 1]) / 2
        area += width * height

    return area
```

### 步骤 4:回归指标

```python
def mse(y_true, y_pred):
    n = len(y_true)
    return sum((yt - yp) ** 2 for yt, yp in zip(y_true, y_pred)) / n


def rmse(y_true, y_pred):
    return math.sqrt(mse(y_true, y_pred))


def mae(y_true, y_pred):
    n = len(y_true)
    return sum(abs(yt - yp) for yt, yp in zip(y_true, y_pred)) / n


def r_squared(y_true, y_pred):
    mean_y = sum(y_true) / len(y_true)
    ss_res = sum((yt - yp) ** 2 for yt, yp in zip(y_true, y_pred))
    ss_tot = sum((yt - mean_y) ** 2 for yt in y_true)
    if ss_tot == 0:
        return 0.0
    return 1.0 - ss_res / ss_tot
```

### 步骤 5:学习曲线

```python
def learning_curve(X, y, model_fn, metric_fn, train_sizes=None, val_ratio=0.2, seed=42):
    random.seed(seed)
    n = len(X)
    indices = list(range(n))
    random.shuffle(indices)

    val_size = int(n * val_ratio)
    val_idx = indices[:val_size]
    pool_idx = indices[val_size:]

    X_val = [X[i] for i in val_idx]
    y_val = [y[i] for i in val_idx]

    if train_sizes is None:
        train_sizes = [int(len(pool_idx) * r) for r in [0.1, 0.2, 0.4, 0.6, 0.8, 1.0]]

    train_scores = []
    val_scores = []

    for size in train_sizes:
        subset = pool_idx[:size]
        X_train = [X[i] for i in subset]
        y_train = [y[i] for i in subset]

        model = model_fn()
        model.fit(X_train, y_train)

        train_pred = [model.predict(x) for x in X_train]
        val_pred = [model.predict(x) for x in X_val]

        train_scores.append(metric_fn(y_train, train_pred))
        val_scores.append(metric_fn(y_val, val_pred))

    return train_sizes, train_scores, val_scores
```

### 步骤 6:一个用于测试的简单分类器，以及完整演示

```python
class SimpleLogistic:
    def __init__(self, lr=0.1, epochs=100):
        self.lr = lr
        self.epochs = epochs
        self.weights = None
        self.bias = 0.0

    def sigmoid(self, z):
        z = max(-500, min(500, z))
        return 1.0 / (1.0 + math.exp(-z))

    def fit(self, X, y):
        n_features = len(X[0])
        self.weights = [0.0] * n_features
        self.bias = 0.0

        for _ in range(self.epochs):
            for xi, yi in zip(X, y):
                z = sum(w * x for w, x in zip(self.weights, xi)) + self.bias
                pred = self.sigmoid(z)
                error = yi - pred
                for j in range(n_features):
                    self.weights[j] += self.lr * error * xi[j]
                self.bias += self.lr * error

    def predict_proba(self, x):
        z = sum(w * xi for w, xi in zip(self.weights, x)) + self.bias
        return self.sigmoid(z)

    def predict(self, x):
        return 1 if self.predict_proba(x) >= 0.5 else 0


class SimpleLinearRegression:
    def __init__(self, lr=0.001, epochs=200):
        self.lr = lr
        self.epochs = epochs
        self.weights = None
        self.bias = 0.0

    def fit(self, X, y):
        n_features = len(X[0])
        self.weights = [0.0] * n_features
        self.bias = 0.0
        n = len(X)

        for _ in range(self.epochs):
            for xi, yi in zip(X, y):
                pred = sum(w * x for w, x in zip(self.weights, xi)) + self.bias
                error = yi - pred
                for j in range(n_features):
                    self.weights[j] += self.lr * error * xi[j] / n
                self.bias += self.lr * error / n

    def predict(self, x):
        return sum(w * xi for w, xi in zip(self.weights, x)) + self.bias


def standardize(values):
    n = len(values)
    mean = sum(values) / n
    var = sum((v - mean) ** 2 for v in values) / n
    std = math.sqrt(var) if var > 0 else 1.0
    return [(v - mean) / std for v in values], mean, std


def make_classification_data(n=300, seed=42):
    random.seed(seed)
    X = []
    y = []
    for _ in range(n):
        x1 = random.gauss(0, 1)
        x2 = random.gauss(0, 1)
        label = 1 if (x1 + x2 + random.gauss(0, 0.5)) > 0 else 0
        X.append([x1, x2])
        y.append(label)
    return X, y


def make_regression_data(n=200, seed=42):
    random.seed(seed)
    X = []
    y = []
    for _ in range(n):
        x1 = random.uniform(0, 10)
        x2 = random.uniform(0, 5)
        target = 3 * x1 + 2 * x2 + random.gauss(0, 2)
        X.append([x1, x2])
        y.append(target)
    return X, y


def make_imbalanced_data(n=300, minority_ratio=0.05, seed=42):
    random.seed(seed)
    X = []
    y = []
    for _ in range(n):
        if random.random() < minority_ratio:
            x1 = random.gauss(3, 0.5)
            x2 = random.gauss(3, 0.5)
            label = 1
        else:
            x1 = random.gauss(0, 1)
            x2 = random.gauss(0, 1)
            label = 0
        X.append([x1, x2])
        y.append(label)
    return X, y


if __name__ == "__main__":
    X_clf, y_clf = make_classification_data(300)

    print("=== Train/Validation/Test Split ===")
    X_train, y_train, X_val, y_val, X_test, y_test = train_val_test_split(X_clf, y_clf)
    print(f"  Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
    print(f"  Train class distribution: {sum(y_train)}/{len(y_train)} positive")
    print(f"  Val class distribution: {sum(y_val)}/{len(y_val)} positive")

    model = SimpleLogistic(lr=0.1, epochs=200)
    model.fit(X_train, y_train)

    print("\n=== Classification Metrics ===")
    y_pred = [model.predict(x) for x in X_test]
    tp, tn, fp, fn = confusion_matrix(y_test, y_pred)
    print(f"  Confusion matrix: TP={tp}, TN={tn}, FP={fp}, FN={fn}")
    print(f"  Accuracy:  {accuracy(y_test, y_pred):.4f}")
    print(f"  Precision: {precision(y_test, y_pred):.4f}")
    print(f"  Recall:    {recall(y_test, y_pred):.4f}")
    print(f"  F1 Score:  {f1_score(y_test, y_pred):.4f}")

    y_scores = [model.predict_proba(x) for x in X_test]
    auc = auc_roc(y_test, y_scores)
    print(f"  AUC-ROC:   {auc:.4f}")

    print("\n=== K-Fold Cross-Validation (K=5) ===")
    cv_scores = cross_validate(
        X_clf, y_clf,
        model_fn=lambda: SimpleLogistic(lr=0.1, epochs=200),
        k=5,
        metric_fn=accuracy,
    )
    mean_cv = sum(cv_scores) / len(cv_scores)
    std_cv = math.sqrt(sum((s - mean_cv) ** 2 for s in cv_scores) / len(cv_scores))
    print(f"  Fold scores: {[round(s, 4) for s in cv_scores]}")
    print(f"  Mean: {mean_cv:.4f} (+/- {std_cv:.4f})")

    print("\n=== Stratified K-Fold Cross-Validation (K=5) ===")
    strat_scores = cross_validate(
        X_clf, y_clf,
        model_fn=lambda: SimpleLogistic(lr=0.1, epochs=200),
        k=5,
        metric_fn=accuracy,
        stratified=True,
    )
    strat_mean = sum(strat_scores) / len(strat_scores)
    strat_std = math.sqrt(sum((s - strat_mean) ** 2 for s in strat_scores) / len(strat_scores))
    print(f"  Fold scores: {[round(s, 4) for s in strat_scores]}")
    print(f"  Mean: {strat_mean:.4f} (+/- {strat_std:.4f})")

    print("\n=== Imbalanced Data: Why Accuracy Lies ===")
    X_imb, y_imb = make_imbalanced_data(300, minority_ratio=0.05)
    positives = sum(y_imb)
    print(f"  Class distribution: {positives} positive, {len(y_imb) - positives} negative ({positives/len(y_imb)*100:.1f}% positive)")

    always_negative = [0] * len(y_imb)
    print(f"  Always-negative baseline:")
    print(f"    Accuracy:  {accuracy(y_imb, always_negative):.4f}")
    print(f"    Precision: {precision(y_imb, always_negative):.4f}")
    print(f"    Recall:    {recall(y_imb, always_negative):.4f}")
    print(f"    F1 Score:  {f1_score(y_imb, always_negative):.4f}")

    X_tr_i, y_tr_i, X_v_i, y_v_i, X_te_i, y_te_i = train_val_test_split(X_imb, y_imb)
    model_imb = SimpleLogistic(lr=0.5, epochs=500)
    model_imb.fit(X_tr_i, y_tr_i)
    y_pred_imb = [model_imb.predict(x) for x in X_te_i]
    print(f"\n  Trained model on imbalanced data:")
    print(f"    Accuracy:  {accuracy(y_te_i, y_pred_imb):.4f}")
    print(f"    Precision: {precision(y_te_i, y_pred_imb):.4f}")
    print(f"    Recall:    {recall(y_te_i, y_pred_imb):.4f}")
    print(f"    F1 Score:  {f1_score(y_te_i, y_pred_imb):.4f}")

    print("\n=== Regression Metrics ===")
    X_reg, y_reg = make_regression_data(200)

    col0 = [x[0] for x in X_reg]
    col1 = [x[1] for x in X_reg]
    col0_s, m0, s0 = standardize(col0)
    col1_s, m1, s1 = standardize(col1)
    X_reg_scaled = [[col0_s[i], col1_s[i]] for i in range(len(X_reg))]

    X_tr_r, y_tr_r, X_v_r, y_v_r, X_te_r, y_te_r = train_val_test_split(X_reg_scaled, y_reg)
    reg_model = SimpleLinearRegression(lr=0.01, epochs=500)
    reg_model.fit(X_tr_r, y_tr_r)
    y_pred_r = [reg_model.predict(x) for x in X_te_r]

    print(f"  MSE:       {mse(y_te_r, y_pred_r):.4f}")
    print(f"  RMSE:      {rmse(y_te_r, y_pred_r):.4f}")
    print(f"  MAE:       {mae(y_te_r, y_pred_r):.4f}")
    print(f"  R-squared: {r_squared(y_te_r, y_pred_r):.4f}")

    mean_baseline = [sum(y_tr_r) / len(y_tr_r)] * len(y_te_r)
    print(f"\n  Mean baseline:")
    print(f"    MSE:       {mse(y_te_r, mean_baseline):.4f}")
    print(f"    R-squared: {r_squared(y_te_r, mean_baseline):.4f}")

    print("\n=== Learning Curve ===")
    sizes, train_sc, val_sc = learning_curve(
        X_clf, y_clf,
        model_fn=lambda: SimpleLogistic(lr=0.1, epochs=200),
        metric_fn=accuracy,
    )
    print(f"  {'Size':>6} {'Train':>8} {'Val':>8}")
    for s, tr, va in zip(sizes, train_sc, val_sc):
        print(f"  {s:>6} {tr:>8.4f} {va:>8.4f}")

    print("\n=== Statistical Model Comparison ===")
    model_a_scores = cross_validate(
        X_clf, y_clf,
        model_fn=lambda: SimpleLogistic(lr=0.1, epochs=100),
        k=5, metric_fn=accuracy,
    )
    model_b_scores = cross_validate(
        X_clf, y_clf,
        model_fn=lambda: SimpleLogistic(lr=0.1, epochs=500),
        k=5, metric_fn=accuracy,
    )
    diffs = [a - b for a, b in zip(model_a_scores, model_b_scores)]
    mean_diff = sum(diffs) / len(diffs)
    std_diff = math.sqrt(sum((d - mean_diff) ** 2 for d in diffs) / len(diffs))
    t_stat = mean_diff / (std_diff / math.sqrt(len(diffs))) if std_diff > 0 else 0.0
    print(f"  Model A (100 epochs) mean: {sum(model_a_scores)/len(model_a_scores):.4f}")
    print(f"  Model B (500 epochs) mean: {sum(model_b_scores)/len(model_b_scores):.4f}")
    print(f"  Mean difference: {mean_diff:.4f}")
    print(f"  Paired t-statistic: {t_stat:.4f}")
    print(f"  (|t| > 2.78 for significance at p<0.05 with df=4)")
```

## 使用它

使用 scikit-learn 时，评估已内置在工作流中：

```python
from sklearn.model_selection import cross_val_score, StratifiedKFold, learning_curve
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, mean_squared_error, r2_score,
)
from sklearn.linear_model import LogisticRegression

model = LogisticRegression()
scores = cross_val_score(model, X, y, cv=StratifiedKFold(5), scoring="f1")
```

从零实现的版本清楚地展示了交叉验证到底做了什么(没有魔法，只是 for 循环和索引追踪)、每个指标如何计算(只是统计 TP/FP/TN/FN),以及为什么分层很重要(在每个折中保持类别比例)。库版本增加了并行化、更多评分选项以及与 pipeline 的集成。

## 交付成果

本课产出：
- `outputs/skill-evaluation.md` - 一份涵盖分类和回归模型评估策略的技能

## 练习

1. 实现 precision-recall 曲线：绘制不同阈值下 precision 与 recall 的关系。计算平均精度(PR 曲线下面积)。在不平衡数据集上比较 PR 曲线与 ROC 曲线，并解释各自何时更具参考价值。
2. 构建嵌套交叉验证循环：外层循环评估模型性能，内层循环调超参数。用它公平地比较两个模型，同时避免验证数据泄露到评估中。
3. 实现用于模型比较的置换检验：打乱标签、重新训练并测量性能。重复 100 次以构建零分布，计算观测到的模型性能相对于该分布的 p 值。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| 过拟合 | "记住了训练数据" | 模型捕捉了训练数据中的噪声，在训练集上表现良好但在未见数据上表现差 |
| 交叉验证 | "在不同子集上测试" | 系统地轮换用于验证的数据部分，并对所有轮换的结果取平均 |
| Precision | "预测为正的样本中有多少是对的" | TP / (TP + FP):正预测中确实为正的比例 |
| Recall | "实际为正的样本中我们找到了多少" | TP / (TP + FN):实际为正的样本被正确识别的比例 |
| AUC-ROC | "模型区分类别的能力" | 所有阈值下真正率与假正率曲线下的面积，范围从 0.5(随机)到 1.0(完美) |
| R-squared | "解释了多少方差" | 1 - (残差平方和 / 总平方和)：模型捕捉的目标方差比例 |
| 数据泄露 | "模型作弊了" | 在训练时使用了预测时不可得的信息，导致评估结果过于乐观 |
| 学习曲线 | "性能如何随数据量变化" | 训练和验证得分随训练集大小变化的图，可揭示欠拟合或过拟合 |
| 分层划分 | "保持类别比例平衡" | 划分数据使每个子集的各类别比例与完整数据集相同 |

## 延伸阅读

- [scikit-learn 模型选择指南](https://scikit-learn.org/stable/model_selection.html) - 关于交叉验证、指标和超参数调优的全面参考
- [Beyond Accuracy: Precision and Recall(Google ML Crash Course)](https://developers.google.com/machine-learning/crash-course/classification/precision-and-recall) - 配有交互示例的清晰讲解
- [A Survey of Cross-Validation Procedures(Arlot & Celisse, 2010)](https://projecteuclid.org/journals/statistics-surveys/volume-4/issue-none/A-survey-of-cross-validation-procedures-for-model-selection/10.1214/09-SS054.full) - 对不同交叉验证策略何时有效、为何有效的严谨论述