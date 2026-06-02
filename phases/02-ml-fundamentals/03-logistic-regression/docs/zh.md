# 逻辑回归（Logistic Regression）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 逻辑回归把一条直线掰成 S 形曲线，用概率来回答「是」或「否」的问题。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 2 Lesson 1-2（什么是 ML、线性回归）
**Time:** ~90 minutes

## 学习目标（Learning Objectives）

- 用 sigmoid 函数和二元 cross-entropy（交叉熵）损失，从零实现逻辑回归
- 计算并解读二分类的 precision、recall、F1 score 与 confusion matrix（混淆矩阵）
- 解释为什么 MSE 不适合分类，以及为什么二元 cross-entropy 能给出凸的代价曲面
- 构建 softmax 回归做多分类，并评估阈值调整带来的取舍

## 问题（The Problem）

你想根据肿瘤大小判断它是恶性还是良性。你尝试用线性回归。它输出的是 0.3、1.7、-0.5 这样的数。这些数到底是什么意思？1.7 是「非常恶性」？-0.5 是「非常良性」？线性回归输出的是无界数字。分类需要的是 0 到 1 之间有界的概率，以及一个明确的判断：是或否。

逻辑回归正是为此而来。它沿用同样的线性组合（wx + b），然后过一遍 sigmoid 函数——sigmoid 把任何实数都压缩到 (0, 1) 区间。输出就是一个概率。你设定一个阈值（通常是 0.5），然后做出决定。

这是实际工作中使用最广泛的算法之一。别被名字误导——逻辑回归是分类算法，不是回归算法。这个名字来源于它使用的 logistic（sigmoid）函数。

## 概念（The Concept）

### 为什么线性回归不适合分类（Why Linear Regression Fails for Classification）

设想根据学习时长预测「通过 / 不通过」（1/0）。线性回归会拟合出一条直线穿过这些数据：

```
hours:  1   2   3   4   5   6   7   8   9   10
actual: 0   0   0   0   1   1   1   1   1   1
```

线性拟合可能在 1 小时处给出 -0.2、在 10 小时处给出 1.3 这样的预测。这些值不是概率。它们跑到了 0 以下、1 以上。更糟的是，一个孤立的离群点（比如某人学习了 50 小时）就会把整条直线拽偏，从而改变所有人的预测。

分类需要的函数应该满足：
- 输出值在 0 到 1 之间（即概率）
- 形成一个陡峭的过渡（决策边界）
- 不会被远离边界的离群点扭曲

### sigmoid 函数（The Sigmoid Function）

sigmoid 函数恰好做到了这些：

```
sigmoid(z) = 1 / (1 + e^(-z))
```

性质：
- 当 z 是较大正数时，sigmoid(z) 趋近 1
- 当 z 是较大负数时，sigmoid(z) 趋近 0
- 当 z = 0 时，sigmoid(z) = 0.5
- 输出始终介于 0 和 1 之间
- 函数处处光滑可导

它的导数有一个很方便的形式：sigmoid'(z) = sigmoid(z) * (1 - sigmoid(z))。这让梯度计算非常高效。

### 逻辑回归 = 线性模型 + sigmoid（Logistic Regression = Linear Model + Sigmoid）

模型先算 z = wx + b（和线性回归一样），再过一遍 sigmoid：

```mermaid
flowchart LR
    X[输入特征 x] --> L["线性 z = wx + b"]
    L --> S["Sigmoid p = 1/(1+e^-z)"]
    S --> D{"p >= 0.5？"}
    D -->|是| P[预测为 1]
    D -->|否| N[预测为 0]
```

输出 p 解释为 P(y=1 | x)，即输入属于类别 1 的概率。决策边界就在 wx + b = 0 这个位置——此时 sigmoid 的输出恰好是 0.5。

### 二元 cross-entropy 损失（Binary Cross-Entropy Loss）

逻辑回归不能用 MSE。MSE 套上 sigmoid 会得到一个非凸的代价曲面，里面有许多局部极小值。要用的是二元 cross-entropy（也叫 log loss）：

```
Loss = -(1/n) * sum(y * log(p) + (1-y) * log(1-p))
```

为什么它能 work：
- y=1 且 p 接近 1：log(1) = 0，所以损失接近 0（预测正确，代价低）
- y=1 且 p 接近 0：log(0) 趋向负无穷，所以损失巨大（预测错了，代价高）
- y=0 且 p 接近 0：log(1) = 0，所以损失接近 0（预测正确，代价低）
- y=0 且 p 接近 1：log(0) 趋向负无穷，所以损失巨大（预测错了，代价高）

对逻辑回归而言，这个损失函数是凸的，能保证存在唯一的全局最小值。

### 逻辑回归的梯度下降（Gradient Descent for Logistic Regression）

二元 cross-entropy 配 sigmoid，梯度有非常干净的形式：

```
dL/dw = (1/n) * sum((p - y) * x)
dL/db = (1/n) * sum(p - y)
```

这看起来跟线性回归的梯度一模一样。区别在于这里的 p = sigmoid(wx + b)，而不是 p = wx + b。sigmoid 引入了非线性，但梯度更新的规则保持不变。

```mermaid
flowchart TD
    A[初始化 w=0, b=0] --> B[前向传播 z = wx+b, p = sigmoid z]
    B --> C[计算 loss 二元交叉熵]
    C --> D["计算梯度 dw = (1/n) * sum((p-y)*x)"]
    D --> E[更新 w = w - lr*dw, b = b - lr*db]
    E --> F{收敛了吗？}
    F -->|否| B
    F -->|是| G[模型训练完成]
```

### 决策边界（The Decision Boundary）

对一个二维输入（两个特征），决策边界就是这条直线：

```
w1*x1 + w2*x2 + b = 0
```

直线一侧的点被分到类别 1，另一侧被分到类别 0。逻辑回归始终给出的是线性的决策边界。如果你需要一条曲线边界，要么加多项式特征，要么用非线性模型。

### 用 softmax 做多分类（Multi-Class Classification with Softmax）

二元逻辑回归只能处理两类。对 k 类问题，要用 softmax 函数：

```
softmax(z_i) = e^(z_i) / sum(e^(z_j) for all j)
```

每个类别都有自己的权重向量。模型为每个类别 i 算出一个分数 z_i，softmax 把这些分数转成总和为 1 的概率。预测类别就是概率最高的那个。

损失函数变成 categorical cross-entropy：

```
Loss = -(1/n) * sum(sum(y_k * log(p_k)))
```

其中 y_k 在真实类别上取 1、其余位置取 0（即 one-hot encoding，独热编码）。

### 评估指标（Evaluation Metrics）

只看 accuracy 是不够的。对于一个 95% 负样本、5% 正样本的数据集，一个永远预测为负的模型 accuracy 能到 95%——但毫无用处。

**Confusion Matrix（混淆矩阵）**：

| | 预测为正 | 预测为负 |
|---|---|---|
| 实际为正 | True Positive (TP) | False Negative (FN) |
| 实际为负 | False Positive (FP) | True Negative (TN) |

**Precision（精确率）**：在所有被预测为正的样本里，有多少真的是正？
```
Precision = TP / (TP + FP)
```

**Recall（召回率，也叫 Sensitivity）**：在所有真实的正样本里，我们抓到了多少？
```
Recall = TP / (TP + FN)
```

**F1 Score**：precision 和 recall 的调和平均，平衡两个指标。
```
F1 = 2 * (Precision * Recall) / (Precision + Recall)
```

什么时候侧重哪一个：
- **Precision**：当假阳性代价高时（垃圾邮件过滤——你不想把正常邮件拦掉）
- **Recall**：当假阴性代价高时（癌症筛查——你不想漏掉一个肿瘤）
- **F1**：当你需要一个平衡的单一指标时

## 动手实现（Build It）

### Step 1：sigmoid 函数与数据生成

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

### Step 2：从零实现逻辑回归

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

### Step 3：从零实现混淆矩阵和评估指标

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

### Step 4：决策边界分析

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

### Step 5：用 softmax 做多分类

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

### Step 6：阈值调优

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

## 用起来（Use It）

下面用 scikit-learn 做同一件事。

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

你从零写的实现得到的是同样的决策边界和指标。scikit-learn 额外提供了 solver 选项（liblinear、lbfgs、saga）、自动正则化、多分类策略（one-vs-rest、multinomial）以及数值稳定性优化。

## 上线部署（Ship It）

本课产出：
- `code/logistic_regression.py` —— 从零实现的逻辑回归及评估指标

## 练习（Exercises）

1. 生成一个**线性不可分**的数据集（比如两个同心圆）。训练逻辑回归，观察它的失败。然后加入多项式特征（x1^2、x2^2、x1*x2）再训练一次。展示 accuracy 是如何提升的。
2. 为 3 类的 softmax 模型实现一个多分类的 confusion matrix。计算每一类的 precision 和 recall。哪一类最难分？
3. 从零构建一条 ROC 曲线。对 0 到 1 之间的 100 个阈值，计算 true positive rate 和 false positive rate。用梯形法计算 AUC（曲线下面积）。

## 关键术语（Key Terms）

| Term | 大家通常怎么说 | 实际含义 |
|------|----------------|----------------------|
| Logistic regression | 「分类用的回归」 | 一个线性模型加 sigmoid 函数，输出类别概率 |
| Sigmoid function | 「S 形曲线」 | 函数 1/(1+e^(-z))，把任意实数映射到 (0, 1) 区间 |
| Binary cross-entropy | 「log loss」 | 损失函数 -[y*log(p) + (1-y)*log(1-p)]，会重罚那些「自信但错」的预测 |
| Decision boundary | 「分界线」 | 模型输出概率等于 0.5 的曲面，把预测的类别一分为二 |
| Softmax | 「多分类版的 sigmoid」 | 把一组分数转成总和为 1 的概率的函数 |
| Precision | 「挑出来的里面有多少是对的」 | TP / (TP + FP)，预测为正的样本里真正为正的比例 |
| Recall | 「该挑出来的里面挑中了多少」 | TP / (TP + FN)，真实正样本里被模型正确识别的比例 |
| F1 score | 「平衡的 accuracy」 | precision 与 recall 的调和平均：2*P*R / (P+R) |
| Confusion matrix | 「错误分布表」 | 一张展示每对类别的 TP、TN、FP、FN 计数的表 |
| Threshold | 「判定阈值」 | 模型预测为类别 1 时的概率门槛（默认 0.5，可调） |
| One-hot encoding | 「类别的二进制列」 | 把类别 k 表示成除第 k 位为 1、其余全为 0 的向量 |
| Categorical cross-entropy | 「多分类 log loss」 | 二元 cross-entropy 在 k 类上的扩展，配合 one-hot 标签使用 |
