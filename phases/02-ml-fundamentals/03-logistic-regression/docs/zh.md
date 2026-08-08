# 03 · 逻辑回归

> 逻辑回归把一条直线弯成 S 形曲线，用概率来回答是与否的问题。

**类型：** 动手构建
**语言：** Python
**前置：** 第 2 阶段第 1-2 课（什么是机器学习、线性回归）
**时长：** 约 90 分钟

## 学习目标

- 使用「sigmoid 函数」与「二元交叉熵损失（binary cross-entropy loss）」从零实现逻辑回归
- 计算并解读二分类的精确率、召回率、F1 分数以及混淆矩阵
- 解释为什么 MSE 不适用于分类，以及为什么二元交叉熵能产生凸的代价曲面
- 构建用于多分类的 softmax 回归模型，并权衡阈值调优的取舍

## 问题所在

你想根据肿瘤的大小预测它是恶性还是良性。你尝试用线性回归，结果它输出 0.3、1.7 或 -0.5 这样的数字。这些数字是什么意思？1.7 是「非常恶性」吗？-0.5 是「非常良性」吗？线性回归输出的是无界的数字。而分类需要的是介于 0 和 1 之间的有界概率，以及一个明确的决策：是或否。

逻辑回归解决了这个问题。它取同样的线性组合（wx + b），然后将其传入 sigmoid 函数，该函数会把任意数字压缩到 (0, 1) 区间。输出是一个概率。你设定一个阈值（通常是 0.5）来做出决策。

这是实践中使用最广泛的算法之一。尽管名字里带「回归」，逻辑回归其实是分类算法，而不是回归算法。这个名字来源于它所使用的「逻辑（logistic）函数」，即 sigmoid 函数。

## 核心概念

### 为什么线性回归不适用于分类

设想根据学习时长来预测通过/不通过（1/0）。线性回归会在数据上拟合一条直线：

```
hours:  1   2   3   4   5   6   7   8   9   10
actual: 0   0   0   0   1   1   1   1   1   1
```

线性拟合给出的预测可能是：第 1 小时为 -0.2，第 10 小时为 1.3。这些值不是概率，它们低于 0 又高于 1。更糟的是，单个离群点（某个学了 50 小时的人）就会把整条直线拽偏，从而改变对所有人的预测。

分类需要这样一个函数：

- 输出介于 0 和 1 之间的值（概率）
- 形成一个陡峭的过渡（决策边界）
- 不会被远离边界的离群点所扭曲

### sigmoid 函数

sigmoid 函数恰好能做到这一点：

```
sigmoid(z) = 1 / (1 + e^(-z))
```

性质：

- 当 z 是很大的正数时，sigmoid(z) 趋近于 1
- 当 z 是很大的负数时，sigmoid(z) 趋近于 0
- 当 z = 0 时，sigmoid(z) = 0.5
- 输出始终介于 0 和 1 之间
- 函数处处平滑且可微

它的导数有一个便利的形式：sigmoid'(z) = sigmoid(z) * (1 - sigmoid(z))。这使得梯度计算十分高效。

### 逻辑回归 = 线性模型 + sigmoid

模型先计算 z = wx + b（与线性回归相同），然后应用 sigmoid：

```mermaid
flowchart LR
    X[Input features x] --> L["Linear: z = wx + b"]
    L --> S["Sigmoid: p = 1/(1+e^-z)"]
    S --> D{"p >= 0.5?"}
    D -->|Yes| P[Predict 1]
    D -->|No| N[Predict 0]
```

输出 p 被解释为 P(y=1 | x)，即输入属于类别 1 的概率。决策边界位于 wx + b = 0 处，此时 sigmoid 的输出恰好为 0.5。

### 二元交叉熵损失

你不能在逻辑回归中使用 MSE。MSE 与 sigmoid 搭配会产生一个带有许多局部极小值的非凸代价曲面。应当改用「二元交叉熵（binary cross-entropy）」，也叫对数损失（log loss）：

```
Loss = -(1/n) * sum(y * log(p) + (1-y) * log(1-p))
```

为什么这样有效：

- 当 y=1 且 p 接近 1 时：log(1) = 0，因此损失接近 0（预测正确，代价低）
- 当 y=1 且 p 接近 0 时：log(0) 趋向负无穷，因此损失极大（预测错误，代价高）
- 当 y=0 且 p 接近 0 时：log(1) = 0，因此损失接近 0（预测正确，代价低）
- 当 y=0 且 p 接近 1 时：log(0) 趋向负无穷，因此损失极大（预测错误，代价高）

对于逻辑回归而言，这个损失函数是凸的，从而保证存在唯一的全局最小值。

### 逻辑回归的梯度下降

sigmoid 配合二元交叉熵时，梯度有一个简洁的形式：

```
dL/dw = (1/n) * sum((p - y) * x)
dL/db = (1/n) * sum(p - y)
```

它们看起来和线性回归的梯度完全相同。区别在于这里 p = sigmoid(wx + b)，而不是 p = wx + b。sigmoid 引入了非线性，但梯度更新规则保持不变。

```mermaid
flowchart TD
    A[Initialize w=0, b=0] --> B[Forward pass: z = wx+b, p = sigmoid z]
    B --> C[Compute loss: binary cross-entropy]
    C --> D["Compute gradients: dw = (1/n) * sum((p-y)*x)"]
    D --> E[Update: w = w - lr*dw, b = b - lr*db]
    E --> F{Converged?}
    F -->|No| B
    F -->|Yes| G[Model trained]
```

### 决策边界

对于二维输入（两个特征），决策边界是满足以下等式的那条直线：

```
w1*x1 + w2*x2 + b = 0
```

一侧的点被分类为 1，另一侧的点被分类为 0。逻辑回归总是产生线性的决策边界。如果你需要一条曲线边界，要么增加多项式特征，要么改用非线性模型。

### 使用 softmax 进行多分类

二元逻辑回归处理两个类别。对于 k 个类别，使用「softmax 函数」：

```
softmax(z_i) = e^(z_i) / sum(e^(z_j) for all j)
```

每个类别都有自己的权重向量。模型为每个类别计算一个分数 z_i，然后 softmax 将这些分数转换为加起来等于 1 的概率。预测的类别就是概率最高的那一个。

损失函数变为「类别交叉熵（categorical cross-entropy）」：

```
Loss = -(1/n) * sum(sum(y_k * log(p_k)))
```

其中 y_k 对真实类别为 1，对其余所有类别为 0（即「独热编码（one-hot encoding）」）。

### 评估指标

仅有准确率是不够的。对于一个 95% 为负、5% 为正的数据集，一个永远预测为负的模型能拿到 95% 的准确率，却毫无用处。

**混淆矩阵（Confusion Matrix）**：

| | 预测为正 | 预测为负 |
|---|---|---|
| 实际为正 | 真正例 True Positive (TP) | 假负例 False Negative (FN) |
| 实际为负 | 假正例 False Positive (FP) | 真负例 True Negative (TN) |

**精确率（Precision）**：在所有被预测为正的样本中，有多少确实是正的？

```
Precision = TP / (TP + FP)
```

**召回率（Recall，又称灵敏度 Sensitivity）**：在所有实际为正的样本中，我们捕捉到了多少？

```
Recall = TP / (TP + FN)
```

**F1 分数（F1 Score）**：精确率与召回率的调和平均数，对两个指标进行平衡。

```
F1 = 2 * (Precision * Recall) / (Precision + Recall)
```

何时应优先考虑哪个：

- **精确率**：当假正例代价高昂时（垃圾邮件过滤器，你不希望误拦合法邮件）
- **召回率**：当假负例代价高昂时（癌症筛查，你不希望漏掉一个肿瘤）
- **F1**：当你需要一个单一的、平衡的指标时

## 动手构建

### 第 1 步：sigmoid 函数与数据生成

```python
import random
import math

def sigmoid(z):
    z = max(-500, min(500, z))
    return 1.0 / (1.0 + math.exp(-z))


random.seed(42)
N = 200
X = []
y = []

for _ in range(N // 2):
    X.append([random.gauss(2, 1), random.gauss(2, 1)])
    y.append(0)

for _ in range(N // 2):
    X.append([random.gauss(5, 1), random.gauss(5, 1)])
    y.append(1)

combined = list(zip(X, y))
random.shuffle(combined)
X, y = zip(*combined)
X = list(X)
y = list(y)

print(f"Generated {N} samples (2 classes, 2 features)")
print(f"Class 0 center: (2, 2), Class 1 center: (5, 5)")
print(f"First 5 samples:")
for i in range(5):
    print(f"  Features: [{X[i][0]:.2f}, {X[i][1]:.2f}], Label: {y[i]}")
```

### 第 2 步：从零实现逻辑回归

```python
class LogisticRegression:
    def __init__(self, n_features, learning_rate=0.01):
        self.weights = [0.0] * n_features
        self.bias = 0.0
        self.lr = learning_rate
        self.loss_history = []

    def predict_proba(self, x):
        z = sum(w * xi for w, xi in zip(self.weights, x)) + self.bias
        return sigmoid(z)

    def predict(self, x, threshold=0.5):
        return 1 if self.predict_proba(x) >= threshold else 0

    def compute_loss(self, X, y):
        n = len(y)
        total = 0.0
        for i in range(n):
            p = self.predict_proba(X[i])
            p = max(1e-15, min(1 - 1e-15, p))
            total += y[i] * math.log(p) + (1 - y[i]) * math.log(1 - p)
        return -total / n

    def fit(self, X, y, epochs=1000, print_every=200):
        n = len(y)
        n_features = len(X[0])
        for epoch in range(epochs):
            dw = [0.0] * n_features
            db = 0.0
            for i in range(n):
                p = self.predict_proba(X[i])
                error = p - y[i]
                for j in range(n_features):
                    dw[j] += error * X[i][j]
                db += error
            for j in range(n_features):
                self.weights[j] -= self.lr * (dw[j] / n)
            self.bias -= self.lr * (db / n)
            loss = self.compute_loss(X, y)
            self.loss_history.append(loss)
            if epoch % print_every == 0:
                print(f"  Epoch {epoch:4d} | Loss: {loss:.4f} | w: [{self.weights[0]:.3f}, {self.weights[1]:.3f}] | b: {self.bias:.3f}")
        return self

    def accuracy(self, X, y):
        correct = sum(1 for i in range(len(y)) if self.predict(X[i]) == y[i])
        return correct / len(y)


split = int(0.8 * N)
X_train, X_test = X[:split], X[split:]
y_train, y_test = y[:split], y[split:]

print("\n=== Training Logistic Regression ===")
model = LogisticRegression(n_features=2, learning_rate=0.1)
model.fit(X_train, y_train, epochs=1000, print_every=200)

print(f"\nTrain accuracy: {model.accuracy(X_train, y_train):.4f}")
print(f"Test accuracy:  {model.accuracy(X_test, y_test):.4f}")
print(f"Weights: [{model.weights[0]:.4f}, {model.weights[1]:.4f}]")
print(f"Bias: {model.bias:.4f}")
```

### 第 3 步：从零实现混淆矩阵与各项指标

```python
class ClassificationMetrics:
    def __init__(self, y_true, y_pred):
        self.tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
        self.tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)
        self.fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
        self.fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)

    def accuracy(self):
        total = self.tp + self.tn + self.fp + self.fn
        return (self.tp + self.tn) / total if total > 0 else 0

    def precision(self):
        denom = self.tp + self.fp
        return self.tp / denom if denom > 0 else 0

    def recall(self):
        denom = self.tp + self.fn
        return self.tp / denom if denom > 0 else 0

    def f1(self):
        p = self.precision()
        r = self.recall()
        return 2 * p * r / (p + r) if (p + r) > 0 else 0

    def print_confusion_matrix(self):
        print(f"\n  Confusion Matrix:")
        print(f"                  Predicted")
        print(f"                  Pos   Neg")
        print(f"  Actual Pos     {self.tp:4d}  {self.fn:4d}")
        print(f"  Actual Neg     {self.fp:4d}  {self.tn:4d}")

    def print_report(self):
        self.print_confusion_matrix()
        print(f"\n  Accuracy:  {self.accuracy():.4f}")
        print(f"  Precision: {self.precision():.4f}")
        print(f"  Recall:    {self.recall():.4f}")
        print(f"  F1 Score:  {self.f1():.4f}")


y_pred_test = [model.predict(x) for x in X_test]
print("\n=== Classification Report (Test Set) ===")
metrics = ClassificationMetrics(y_test, y_pred_test)
metrics.print_report()
```

### 第 4 步：决策边界分析

```python
print("\n=== Decision Boundary ===")
w1, w2 = model.weights
b = model.bias
print(f"Decision boundary: {w1:.4f}*x1 + {w2:.4f}*x2 + {b:.4f} = 0")
if abs(w2) > 1e-10:
    print(f"Solved for x2:     x2 = {-w1/w2:.4f}*x1 + {-b/w2:.4f}")

print("\nSample predictions near the boundary:")
test_points = [
    [3.0, 3.0],
    [3.5, 3.5],
    [4.0, 4.0],
    [2.5, 2.5],
    [5.0, 5.0],
]
for point in test_points:
    prob = model.predict_proba(point)
    pred = model.predict(point)
    print(f"  [{point[0]}, {point[1]}] -> prob={prob:.4f}, class={pred}")
```

### 第 5 步：用 softmax 实现多分类

```python
class SoftmaxRegression:
    def __init__(self, n_features, n_classes, learning_rate=0.01):
        self.n_features = n_features
        self.n_classes = n_classes
        self.lr = learning_rate
        self.weights = [[0.0] * n_features for _ in range(n_classes)]
        self.biases = [0.0] * n_classes

    def softmax(self, scores):
        max_score = max(scores)
        exp_scores = [math.exp(s - max_score) for s in scores]
        total = sum(exp_scores)
        return [e / total for e in exp_scores]

    def predict_proba(self, x):
        scores = [
            sum(self.weights[k][j] * x[j] for j in range(self.n_features)) + self.biases[k]
            for k in range(self.n_classes)
        ]
        return self.softmax(scores)

    def predict(self, x):
        probs = self.predict_proba(x)
        return probs.index(max(probs))

    def fit(self, X, y, epochs=1000, print_every=200):
        n = len(y)
        for epoch in range(epochs):
            grad_w = [[0.0] * self.n_features for _ in range(self.n_classes)]
            grad_b = [0.0] * self.n_classes
            total_loss = 0.0
            for i in range(n):
                probs = self.predict_proba(X[i])
                for k in range(self.n_classes):
                    target = 1.0 if y[i] == k else 0.0
                    error = probs[k] - target
                    for j in range(self.n_features):
                        grad_w[k][j] += error * X[i][j]
                    grad_b[k] += error
                true_prob = max(probs[y[i]], 1e-15)
                total_loss -= math.log(true_prob)
            for k in range(self.n_classes):
                for j in range(self.n_features):
                    self.weights[k][j] -= self.lr * (grad_w[k][j] / n)
                self.biases[k] -= self.lr * (grad_b[k] / n)
            if epoch % print_every == 0:
                print(f"  Epoch {epoch:4d} | Loss: {total_loss / n:.4f}")
        return self

    def accuracy(self, X, y):
        correct = sum(1 for i in range(len(y)) if self.predict(X[i]) == y[i])
        return correct / len(y)


random.seed(42)
X_3class = []
y_3class = []

centers = [(1, 1), (5, 1), (3, 5)]
for label, (cx, cy) in enumerate(centers):
    for _ in range(50):
        X_3class.append([random.gauss(cx, 0.8), random.gauss(cy, 0.8)])
        y_3class.append(label)

combined = list(zip(X_3class, y_3class))
random.shuffle(combined)
X_3class, y_3class = zip(*combined)
X_3class = list(X_3class)
y_3class = list(y_3class)

split_3 = int(0.8 * len(X_3class))
X_train_3 = X_3class[:split_3]
y_train_3 = y_3class[:split_3]
X_test_3 = X_3class[split_3:]
y_test_3 = y_3class[split_3:]

print("\n=== Multi-class Softmax Regression (3 classes) ===")
softmax_model = SoftmaxRegression(n_features=2, n_classes=3, learning_rate=0.1)
softmax_model.fit(X_train_3, y_train_3, epochs=1000, print_every=200)
print(f"\nTrain accuracy: {softmax_model.accuracy(X_train_3, y_train_3):.4f}")
print(f"Test accuracy:  {softmax_model.accuracy(X_test_3, y_test_3):.4f}")

print("\nSample predictions:")
for i in range(5):
    probs = softmax_model.predict_proba(X_test_3[i])
    pred = softmax_model.predict(X_test_3[i])
    print(f"  True: {y_test_3[i]}, Predicted: {pred}, Probs: [{', '.join(f'{p:.3f}' for p in probs)}]")
```

### 第 6 步：阈值调优

```python
print("\n=== Threshold Tuning ===")
print("Default threshold: 0.5. Adjusting the threshold trades precision for recall.\n")

thresholds = [0.3, 0.4, 0.5, 0.6, 0.7]
print(f"{'Threshold':>10} {'Accuracy':>10} {'Precision':>10} {'Recall':>10} {'F1':>10}")
print("-" * 52)

for t in thresholds:
    y_pred_t = [1 if model.predict_proba(x) >= t else 0 for x in X_test]
    m = ClassificationMetrics(y_test, y_pred_t)
    print(f"{t:>10.1f} {m.accuracy():>10.4f} {m.precision():>10.4f} {m.recall():>10.4f} {m.f1():>10.4f}")
```

## 实际使用

现在用 scikit-learn 做同样的事情。

```python
from sklearn.linear_model import LogisticRegression as SklearnLR
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sklearn.metrics import confusion_matrix, classification_report
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import numpy as np

np.random.seed(42)
X_0 = np.random.randn(100, 2) + [2, 2]
X_1 = np.random.randn(100, 2) + [5, 5]
X_sk = np.vstack([X_0, X_1])
y_sk = np.array([0] * 100 + [1] * 100)

X_tr, X_te, y_tr, y_te = train_test_split(X_sk, y_sk, test_size=0.2, random_state=42)

scaler = StandardScaler()
X_tr_sc = scaler.fit_transform(X_tr)
X_te_sc = scaler.transform(X_te)

lr = SklearnLR()
lr.fit(X_tr_sc, y_tr)
y_pred = lr.predict(X_te_sc)

print("=== Scikit-learn Logistic Regression ===")
print(f"Accuracy:  {accuracy_score(y_te, y_pred):.4f}")
print(f"Precision: {precision_score(y_te, y_pred):.4f}")
print(f"Recall:    {recall_score(y_te, y_pred):.4f}")
print(f"F1:        {f1_score(y_te, y_pred):.4f}")
print(f"\nConfusion Matrix:\n{confusion_matrix(y_te, y_pred)}")
print(f"\nClassification Report:\n{classification_report(y_te, y_pred)}")
```

你从零实现的版本会产生相同的决策边界和指标。scikit-learn 额外提供了求解器选项（liblinear、lbfgs、saga）、自动正则化、多分类策略（one-vs-rest、multinomial）以及数值稳定性优化。

## 交付成果

本课产出：

- `code/logistic_regression.py` —— 从零实现、带评估指标的逻辑回归

## 练习

1. 生成一个**非线性可分**的数据集（例如两个同心圆）。训练逻辑回归并观察它的失败。然后加入多项式特征（x1^2、x2^2、x1*x2）再次训练。展示准确率的提升。
2. 为 3 类 softmax 模型实现一个多分类混淆矩阵。计算每个类别的精确率和召回率。哪一个类别最难分类？
3. 从零构建一条 ROC 曲线。对从 0 到 1 的 100 个阈值，计算真正例率与假正例率。用梯形法则计算 AUC（曲线下面积）。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| 逻辑回归 Logistic regression | 「用于分类的回归」 | 一个线性模型后接一个 sigmoid 函数，输出类别概率 |
| sigmoid 函数 | 「S 形曲线」 | 函数 1/(1+e^(-z))，把任意实数映射到 (0, 1) 区间 |
| 二元交叉熵 Binary cross-entropy | 「对数损失（log loss）」 | 损失函数 -[y*log(p) + (1-y)*log(1-p)]，对自信但错误的预测施以重罚 |
| 决策边界 Decision boundary | 「分界线」 | 模型输出概率等于 0.5 的那个曲面，用于分隔被预测的各类别 |
| Softmax | 「多分类版的 sigmoid」 | 把一个分数向量转换为加起来等于 1 的概率的函数 |
| 精确率 Precision | 「被选中的有多少是相关的」 | TP / (TP + FP)，正预测中实际为正的比例 |
| 召回率 Recall | 「相关的有多少被选中了」 | TP / (TP + FN)，实际为正中被模型正确识别的比例 |
| F1 分数 F1 score | 「平衡准确率」 | 精确率与召回率的调和平均数：2*P*R / (P+R) |
| 混淆矩阵 Confusion matrix | 「错误明细表」 | 一张展示每对类别 TP、TN、FP、FN 计数的表格 |
| 阈值 Threshold | 「分界点」 | 高于此概率值模型即预测为类别 1（默认 0.5，可调） |
| 独热编码 One-hot encoding | 「为各类别设的二元列」 | 将类别 k 表示为一个全零向量、仅在第 k 位为 1 |
| 类别交叉熵 Categorical cross-entropy | 「多分类版对数损失」 | 二元交叉熵向 k 个类别的扩展，使用独热编码的标签 |
