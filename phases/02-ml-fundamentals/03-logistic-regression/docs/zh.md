# Logistic回归

> 逻辑回归将直线弯曲成S曲线，以回答具有概率的是或否问题。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段2第1-2课（什么是ML，线性回归）
** 时间：** ~90分钟

## 学习目标

- 使用Sigmoid函数和二进制交叉熵损失从头开始实施逻辑回归
- 计算和解释二进制分类的精确度、召回率、F1评分和混淆矩阵
- 解释为什么SSE无法分类以及为什么二元交叉信息会产生凸成本表面
- 构建用于多类分类的softmax回归模型并评估阈值调整权衡

## 问题

您想要根据肿瘤的大小来预测肿瘤是恶性还是良性。你尝试线性回归。它输出0.3、1.7或-0.5等数字。这些是什么意思？1.7“非常恶性”吗？-0.5“非常良性”吗？线性回归输出无界数。分类需要0和1之间的有限概率，以及明确的决定：是或否。

逻辑回归解决了这个问题。它采用相同的线性组合（wx + b）并将其传递给sigmoid函数，该函数将任何数字压缩到范围（0，1）中。输出是一个可能性。您设置一个阈值（通常为0.5）并做出决定。

这是实践中使用最广泛的算法之一。尽管它的名字是逻辑回归，但它是一种分类算法，而不是回归算法。该名称来自它使用的逻辑（sigmoid）函数。

## 概念

### 为什么线性回归无法分类

想象一下根据学习时间预测通过/失败（1/0）。线性回归在数据中匹配一条线：

```
hours:  1   2   3   4   5   6   7   8   9   10
actual: 0   0   0   0   1   1   1   1   1   1
```

线性匹配可能会在第1小时产生-0.2和第10小时产生1.3的预测。这些值不是概率。它们低于0并高于1。更糟糕的是，一个异常值（研究了50小时的人）会拖拖拉拉，改变每个人的预测。

分类需要一个功能：
- 输出值介于0和1之间（概率）
- 创建急剧的过渡（决策边界）
- 不被远离边界的异常值扭曲

### sigmoid函数

sigmoid函数正是这样做的：

```
sigmoid(z) = 1 / (1 + e^(-z))
```

属性：
- 当z较大且正值时，sigmoid（z）接近1
- 当z很大且为负时，sigmoid（z）接近0
- 当z = 0时，sigmoid（z）= 0.5
- 输出始终介于0和1之间
- 功能流畅、随处可见

导数有一个方便的形式：sigmoid '（z）= sigmoid（z）*（1 - sigmoid（z））。这使得梯度计算高效。

### 逻辑回归=线性模型+ Sigmoid

该模型计算z = wx + b（与线性回归相同），然后应用Sigmoid：

```mermaid
flowchart LR
    X[Input features x] --> L["Linear: z = wx + b"]
    L --> S["Sigmoid: p = 1/(1+e^-z)"]
    S --> D{"p >= 0.5?"}
    D -->|Yes| P[Predict 1]
    D -->|No| N[Predict 0]
```

输出p解释为P（y=1| x），输入属于类别1的概率。决策边界是wx + b = 0，这使得sigmoid输出恰好为0.5。

### 二元交叉熵损失

您不能使用SSE进行逻辑回归。具有Sigmoid的SSE创建了具有许多局部极小值的非凸成本表面。相反，使用二进制交叉熵（log loss）：

```
Loss = -(1/n) * sum(y * log(p) + (1-y) * log(1-p))
```

为什么这有效：
- 当y=1且p接近1时：log（1）= 0，因此损失接近0（正确，成本低）
- 当y=1且p接近0时：log（0）接近负无穷大，因此损失巨大（错误，成本高）
- 当y=0且p接近0时：log（1）= 0，因此损失接近0（正确，成本低）
- 当y=0且p接近1时：log（0）接近负无穷大，因此损失巨大（错误，成本高）

对于逻辑回归，该损失函数是凸的，保证单一的全局最小值。

### 逻辑回归的梯度下降

具有Sigmoid的二元交叉熵的梯度具有清晰的形式：

```
dL/dw = (1/n) * sum((p - y) * x)
dL/db = (1/n) * sum(p - y)
```

这些看起来与线性回归梯度相同。区别在于p = sigmoid（wx + b）而不是p = wx + b。Sigmoid引入了非线性，但梯度更新规则保持不变。

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

对于2D输入（两个特征），决策边界是其中的线：

```
w1*x1 + w2*x2 + b = 0
```

一侧的分数被归类为1，另一侧的分数被归类为0。逻辑回归总是产生线性决策边界。如果您需要曲线边界，则可以添加多项特征或使用非线性模型。

### 使用Softmax进行多类别分类

二元逻辑回归处理两类。对于k个类，使用softmax函数：

```
softmax(z_i) = e^(z_i) / sum(e^(z_j) for all j)
```

每个类都有自己的权重载体。该模型计算每个类别的分数z_i，然后softmax将分数转换为总和为1的概率。预测的类别是概率最高的类别。

损失函数变成类别交叉熵：

```
Loss = -(1/n) * sum(sum(y_k * log(p_k)))
```

其中y_k对于真实类为1，对于所有其他类为0（一热编码）。

### 评估指标

仅靠准确性是不够的。对于95%阴性和5%阳性的数据集，总是预测阴性的模型可以获得95%的准确率，但毫无用处。

** 混乱矩阵 **：

|  | 预测的肯定 | 预测阴性 |
|---|---|---|
| 实际上积极 | 真阳性（TP） | 假阴性（FN） |
| 实际上存在负 | 假阳性（FP） | 真阴性（TN） |

** 精确度 **：在所有预测的阳性中，有多少实际上是阳性的？
```
Precision = TP / (TP + FP)
```

** 回忆 **（敏感性）：在所有实际积极因素中，我们发现了多少？
```
Recall = TP / (TP + FN)
```

**F1得分 **：精确度和召回率的调和平均值。平衡两个指标。
```
F1 = 2 * (Precision * Recall) / (Precision + Recall)
```

何时优先考虑：
- ** 精度 **：当误报成本高昂时（垃圾邮件过滤器，您不想阻止合法电子邮件）
- ** 回忆 **：当假阴性代价高昂时（癌症筛查，您不想错过肿瘤）
- **F1**：当您需要单个平衡指标时

## 建设党

### 步骤1：Sigmoid函数和数据生成

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

### 第2步：从头开始逻辑回归

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

### 第3步：从头开始混乱矩阵和指标

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

### 第4步：决策边界分析

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

### 第5步：使用softmax的多类

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

### 第6步：阈值调整

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

## 使用它

现在scikit-learn也是如此。

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

从头开始的实现会产生相同的决策边界和指标。Scikit-learn添加了求解器选项（liblinear、lbfgs、saga）、自动正规化、多类策略（一vs-rest、多项）和数字稳定性优化。

## 把它运

本课产生：
- ' code/logic_registry.py '-从头开始使用指标进行逻辑回归

## 演习

1. 生成不可线性分离的数据集（例如，两个同心圆）。训练逻辑回归并观察其失败。然后添加多项特征（x1#2，x2#2，x1*x2）并再次训练。表明准确性有所提高。
2. 为3级softmax模型实现多级混淆矩阵。计算每个类别的精确度和召回率。哪个类别最难分类？
3. 从头开始构建ROC曲线。对于0到1的100个阈值，计算真阳性率和假阳性率。使用梯形法则计算曲线下面积。

## 关键术语

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|----------------|----------------------|
| Logistic回归 | “分类回归” | 线性模型后面是输出类概率的Sigmoid函数 |
| Sigmoid函数 | “S曲线” | 函数1/（1+e '（-z）），将任何偶数映射到范围（0，1） |
| 二进制交叉熵 | “原木损失” | 损失函数-[y*log（p）+（1-y）*log（1-p）]，严重惩罚有信心的错误预测 |
| 决策边界 | “分界线” | 模型输出概率等于0.5的表面，分离预测类别 |
| Softmax | “多类Sigmoid” | 一个将分数的载体转换为总和为1的概率的函数 |
| 精度 | “有多少选择是相关的” | TP /（TP + FP），实际上是积极的积极预测的比例 |
| 召回 | “选择了多少个相关” | TP /（TP + FN），模型正确识别的实际阳性分数 |
| F1分数 | “平衡的准确性” | 精确度和召回率的调和平均值：2*P*R /（P+R） |
| 混淆矩阵 | “错误分解” | 显示每个类别对的TP、TN、FP、FN计数的表格 |
| 阈值 | “The Cutoff” | 模型预测第1类的概率值（默认0.5，可调） |
| 独热编码 | “类别的二进制列” | 将类k表示为零的载体，位置k处有1 |
| 分类交叉熵 | “多类日志丢失” | 使用单热编码标签将二进制交叉信息扩展到k个类 |
