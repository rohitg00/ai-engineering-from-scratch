# 线性回归

> 线性回归在你的数据中画出最佳直线。它是机器学习的“hello world”。

**Type:** Build
**Languages:** Python
**Prerequisites:** 阶段 1(线性代数、微积分、优化)、阶段 2 第 1 课
**Time:** 约 90 分钟

## 学习目标

- 推导均方误差的梯度下降更新规则，并从零实现线性回归
- 从计算复杂度及适用场景的角度比较梯度下降与正规方程
- 构建带特征标准化的多元线性回归模型，并解释学到的权重
- 解释 Ridge 回归(L2 正则化)如何通过惩罚大权重来防止过拟合

## 问题

你有一份数据：房屋面积及其售价。你想根据面积预测一栋新房屋的价格。你可以在散点图上目测，但你需要一个公式。你需要一条最拟合数据的直线，这样代入任意面积就能得到价格预测。

线性回归给你这条直线。更重要的是，它引入了完整的 ML 训练循环：定义模型、定义代价函数、优化参数。每个 ML 算法都遵循同样的模式。用这个最简单的情形掌握它，你就会在各处认出它。

这不仅适用于简单问题。线性回归在生产系统中用于需求预测、A/B 测试分析、金融建模，并且是所有回归任务的基线。

## 概念

### 模型

线性回归假设输入 (x) 与输出 (y) 之间存在线性关系：

```
y = wx + b
```

- `w`(权重/斜率)：x 每增加 1 时 y 变化多少
- `b`(偏置/截距)：x = 0 时 y 的值

对于多个输入(特征)，可以扩展为：

```
y = w1*x1 + w2*x2 + ... + wn*xn + b
```

或写成向量形式：`y = w^T * x + b`

目标是：找到使预测 y 在所有训练样本上尽可能接近实际 y 的 w 和 b 的值。

### 代价函数(均方误差)

如何衡量“尽可能接近”？你需要一个单一的数字来捕捉预测的误差程度。最常见的选择是均方误差(MSE):

```
MSE = (1/n) * sum((y_predicted - y_actual)^2)
```

为什么要平方？两个原因。第一，它对大误差的惩罚大于小误差(误差为 10 比误差为 1 差 100 倍，而不是 10 倍)。第二，平方函数处处光滑可导，使优化变得直接。

代价函数构成一个曲面。对于单个权重 w 和偏置 b,MSE 曲面像一个碗(凸抛物面)。碗底就是 MSE 最小化的位置。训练就是找到那个碗底。

### 梯度下降

梯度下降通过向山下走步来找到碗底。

```mermaid
flowchart TD
    A[Initialize w and b randomly] --> B[Compute predictions: y_hat = wx + b]
    B --> C[Compute cost: MSE]
    C --> D[Compute gradients: dMSE/dw, dMSE/db]
    D --> E[Update parameters]
    E --> F{Cost low enough?}
    F -->|No| B
    F -->|Yes| G[Done: optimal w and b found]
```

梯度告诉你两件事：每个参数应该往哪个方向移动，以及移动多少。

对于 y_hat = wx + b 的 MSE:

```
dMSE/dw = (2/n) * sum((y_hat - y) * x)
dMSE/db = (2/n) * sum(y_hat - y)
```

更新规则：

```
w = w - learning_rate * dMSE/dw
b = b - learning_rate * dMSE/db
```

学习率控制步长。太大：你会越过最小值并发散。太小：训练会花很长时间。典型的初始值：0.01、0.001 或 0.0001。

### 正规方程(闭式解)

对于线性回归，有一个直接公式可以在不迭代的情况下给出最优权重：

```
w = (X^T * X)^(-1) * X^T * y
```

它通过一次矩阵求逆直接解出 w。对小数据集效果完美。对大数据集(数百万行或数千个特征)，更倾向于梯度下降，因为矩阵求逆关于特征数是 O(n^3) 的。

### 多元线性回归

有多个特征时，模型变为：

```
y = w1*x1 + w2*x2 + ... + wn*xn + b
```

一切照旧：MSE 是代价函数，梯度下降同时更新所有权重。唯一的区别是你在拟合一个超平面而不是一条直线。

特征缩放在这里很重要。如果一个特征范围是 0 到 1,另一个是 0 到 1,000,000,梯度下降会很吃力，因为代价曲面被拉长了。训练前先标准化特征(减去均值，除以标准差)。

### 多项式回归

如果关系不是线性的怎么办？你仍然可以使用线性回归，只需创建多项式特征：

```
y = w1*x + w2*x^2 + w3*x^3 + b
```

这仍然是“线性”回归，因为模型对权重 (w1, w2, w3) 是线性的。你只是使用了 x 的非线性特征。

高次多项式可以拟合更复杂的曲线，但有过拟合风险。一个 10 次多项式会穿过 10 个点的数据集中的每一个点，但在新数据上预测很差。

### R 方得分

MSE 告诉你错得多离谱，但这个数字依赖于 y 的尺度。R 方(R^2)给出了一个与尺度无关的度量：

```
R^2 = 1 - (sum of squared residuals) / (sum of squared deviations from mean)
    = 1 - SS_res / SS_tot
```

- R^2 = 1.0:完美预测
- R^2 = 0.0:模型并不比每次都预测均值更好
- R^2 < 0.0:模型比预测均值还差

### 正则化预览(Ridge 回归)

当你有很多特征时，模型可能通过赋予过大的权重而过拟合。Ridge 回归(L2 正则化)增加了一个惩罚项：

```
Cost = MSE + lambda * sum(w_i^2)
```

惩罚项抑制过大的权重。超参数 lambda 控制权衡：lambda 越高，权重越小，正则化越强。后面的课程会深入讲解。现在只需知道它存在以及为什么有用。

```figure
linear-regression-fit
```

## 动手构建

### 第 1 步：生成样本数据

```python
import random
import math

random.seed(42)

TRUE_W = 3.0
TRUE_B = 7.0
N_SAMPLES = 100

X = [random.uniform(0, 10) for _ in range(N_SAMPLES)]
y = [TRUE_W * x + TRUE_B + random.gauss(0, 2.0) for x in X]

print(f"Generated {N_SAMPLES} samples")
print(f"True relationship: y = {TRUE_W}x + {TRUE_B} (+ noise)")
print(f"First 5 points: {[(round(X[i], 2), round(y[i], 2)) for i in range(5)]}")
```

### 第 2 步：用梯度下降从零实现线性回归

```python
class LinearRegression:
    def __init__(self, learning_rate=0.01):
        self.w = 0.0
        self.b = 0.0
        self.lr = learning_rate
        self.cost_history = []

    def predict(self, X):
        return [self.w * x + self.b for x in X]

    def compute_cost(self, X, y):
        predictions = self.predict(X)
        n = len(y)
        cost = sum((pred - actual) ** 2 for pred, actual in zip(predictions, y)) / n
        return cost

    def compute_gradients(self, X, y):
        predictions = self.predict(X)
        n = len(y)
        dw = (2 / n) * sum((pred - actual) * x for pred, actual, x in zip(predictions, y, X))
        db = (2 / n) * sum(pred - actual for pred, actual in zip(predictions, y))
        return dw, db

    def fit(self, X, y, epochs=1000, print_every=200):
        for epoch in range(epochs):
            dw, db = self.compute_gradients(X, y)
            self.w -= self.lr * dw
            self.b -= self.lr * db
            cost = self.compute_cost(X, y)
            self.cost_history.append(cost)
            if epoch % print_every == 0:
                print(f"  Epoch {epoch:4d} | Cost: {cost:.4f} | w: {self.w:.4f} | b: {self.b:.4f}")
        return self

    def r_squared(self, X, y):
        predictions = self.predict(X)
        y_mean = sum(y) / len(y)
        ss_res = sum((actual - pred) ** 2 for actual, pred in zip(y, predictions))
        ss_tot = sum((actual - y_mean) ** 2 for actual in y)
        return 1 - (ss_res / ss_tot)


print("=== Training Linear Regression (Gradient Descent) ===")
model = LinearRegression(learning_rate=0.005)
model.fit(X, y, epochs=1000, print_every=200)
print(f"\nLearned: y = {model.w:.4f}x + {model.b:.4f}")
print(f"True:    y = {TRUE_W}x + {TRUE_B}")
print(f"R-squared: {model.r_squared(X, y):.4f}")
```

### 第 3 步：正规方程(闭式解)

```python
class LinearRegressionNormal:
    def __init__(self):
        self.w = 0.0
        self.b = 0.0

    def fit(self, X, y):
        n = len(X)
        x_mean = sum(X) / n
        y_mean = sum(y) / n
        numerator = sum((X[i] - x_mean) * (y[i] - y_mean) for i in range(n))
        denominator = sum((X[i] - x_mean) ** 2 for i in range(n))
        self.w = numerator / denominator
        self.b = y_mean - self.w * x_mean
        return self

    def predict(self, X):
        return [self.w * x + self.b for x in X]

    def r_squared(self, X, y):
        predictions = self.predict(X)
        y_mean = sum(y) / len(y)
        ss_res = sum((actual - pred) ** 2 for actual, pred in zip(y, predictions))
        ss_tot = sum((actual - y_mean) ** 2 for actual in y)
        return 1 - (ss_res / ss_tot)


print("\n=== Normal Equation (Closed-Form) ===")
model_normal = LinearRegressionNormal()
model_normal.fit(X, y)
print(f"Learned: y = {model_normal.w:.4f}x + {model_normal.b:.4f}")
print(f"R-squared: {model_normal.r_squared(X, y):.4f}")
```

### 第 4 步：多元线性回归

```python
class MultipleLinearRegression:
    def __init__(self, n_features, learning_rate=0.01):
        self.weights = [0.0] * n_features
        self.bias = 0.0
        self.lr = learning_rate
        self.cost_history = []

    def predict_single(self, x):
        return sum(w * xi for w, xi in zip(self.weights, x)) + self.bias

    def predict(self, X):
        return [self.predict_single(x) for x in X]

    def compute_cost(self, X, y):
        predictions = self.predict(X)
        n = len(y)
        return sum((pred - actual) ** 2 for pred, actual in zip(predictions, y)) / n

    def fit(self, X, y, epochs=1000, print_every=200):
        n = len(y)
        n_features = len(X[0])
        for epoch in range(epochs):
            predictions = self.predict(X)
            errors = [pred - actual for pred, actual in zip(predictions, y)]
            for j in range(n_features):
                grad = (2 / n) * sum(errors[i] * X[i][j] for i in range(n))
                self.weights[j] -= self.lr * grad
            grad_b = (2 / n) * sum(errors)
            self.bias -= self.lr * grad_b
            cost = self.compute_cost(X, y)
            self.cost_history.append(cost)
            if epoch % print_every == 0:
                print(f"  Epoch {epoch:4d} | Cost: {cost:.4f}")
        return self

    def r_squared(self, X, y):
        predictions = self.predict(X)
        y_mean = sum(y) / len(y)
        ss_res = sum((actual - pred) ** 2 for actual, pred in zip(y, predictions))
        ss_tot = sum((actual - y_mean) ** 2 for actual in y)
        return 1 - (ss_res / ss_tot)


random.seed(42)
N = 100
X_multi = []
y_multi = []
for _ in range(N):
    size = random.uniform(500, 3000)
    bedrooms = random.randint(1, 5)
    age = random.uniform(0, 50)
    price = 50 * size + 10000 * bedrooms - 1000 * age + 50000 + random.gauss(0, 20000)
    X_multi.append([size, bedrooms, age])
    y_multi.append(price)


def standardize(X):
    n_features = len(X[0])
    means = [sum(X[i][j] for i in range(len(X))) / len(X) for j in range(n_features)]
    stds = []
    for j in range(n_features):
        variance = sum((X[i][j] - means[j]) ** 2 for i in range(len(X))) / len(X)
        stds.append(variance ** 0.5)
    X_scaled = []
    for i in range(len(X)):
        row = [(X[i][j] - means[j]) / stds[j] if stds[j] > 0 else 0 for j in range(n_features)]
        X_scaled.append(row)
    return X_scaled, means, stds


y_mean_val = sum(y_multi) / len(y_multi)
y_std_val = (sum((yi - y_mean_val) ** 2 for yi in y_multi) / len(y_multi)) ** 0.5
y_scaled = [(yi - y_mean_val) / y_std_val for yi in y_multi]

X_scaled, x_means, x_stds = standardize(X_multi)

print("\n=== Multiple Linear Regression (3 features) ===")
print("Features: house size, bedrooms, age")
multi_model = MultipleLinearRegression(n_features=3, learning_rate=0.01)
multi_model.fit(X_scaled, y_scaled, epochs=1000, print_every=200)

print(f"\nWeights (standardized): {[round(w, 4) for w in multi_model.weights]}")
print(f"Bias (standardized): {multi_model.bias:.4f}")
print(f"R-squared: {multi_model.r_squared(X_scaled, y_scaled):.4f}")
```

### 第 5 步：多项式回归

```python
class PolynomialRegression:
    def __init__(self, degree, learning_rate=0.01):
        self.degree = degree
        self.weights = [0.0] * degree
        self.bias = 0.0
        self.lr = learning_rate

    def make_features(self, X):
        return [[x ** (d + 1) for d in range(self.degree)] for x in X]

    def predict(self, X):
        features = self.make_features(X)
        return [sum(w * f for w, f in zip(self.weights, row)) + self.bias for row in features]

    def fit(self, X, y, epochs=1000, print_every=200):
        features = self.make_features(X)
        n = len(y)
        for epoch in range(epochs):
            predictions = [sum(w * f for w, f in zip(self.weights, row)) + self.bias for row in features]
            errors = [pred - actual for pred, actual in zip(predictions, y)]
            for j in range(self.degree):
                grad = (2 / n) * sum(errors[i] * features[i][j] for i in range(n))
                self.weights[j] -= self.lr * grad
            grad_b = (2 / n) * sum(errors)
            self.bias -= self.lr * grad_b
            if epoch % print_every == 0:
                cost = sum(e ** 2 for e in errors) / n
                print(f"  Epoch {epoch:4d} | Cost: {cost:.6f}")
        return self

    def r_squared(self, X, y):
        predictions = self.predict(X)
        y_mean = sum(y) / len(y)
        ss_res = sum((actual - pred) ** 2 for actual, pred in zip(y, predictions))
        ss_tot = sum((actual - y_mean) ** 2 for actual in y)
        return 1 - (ss_res / ss_tot)


random.seed(42)
X_poly = [x / 10.0 for x in range(0, 50)]
y_poly = [0.5 * x ** 2 - 2 * x + 3 + random.gauss(0, 1.0) for x in X_poly]

x_max = max(abs(x) for x in X_poly)
X_poly_norm = [x / x_max for x in X_poly]
y_poly_mean = sum(y_poly) / len(y_poly)
y_poly_std = (sum((yi - y_poly_mean) ** 2 for yi in y_poly) / len(y_poly)) ** 0.5
y_poly_norm = [(yi - y_poly_mean) / y_poly_std for yi in y_poly]

print("\n=== Polynomial Regression (degree 2 vs degree 5) ===")
print("True relationship: y = 0.5x^2 - 2x + 3")

print("\nDegree 2:")
poly2 = PolynomialRegression(degree=2, learning_rate=0.1)
poly2.fit(X_poly_norm, y_poly_norm, epochs=2000, print_every=500)
print(f"  R-squared: {poly2.r_squared(X_poly_norm, y_poly_norm):.4f}")

print("\nDegree 5:")
poly5 = PolynomialRegression(degree=5, learning_rate=0.1)
poly5.fit(X_poly_norm, y_poly_norm, epochs=2000, print_every=500)
print(f"  R-squared: {poly5.r_squared(X_poly_norm, y_poly_norm):.4f}")

print("\nDegree 2 fits the true curve well. Degree 5 fits training data slightly better")
print("but risks overfitting on new data.")
```

### 第 6 步：Ridge 回归(L2 正则化)

```python
class RidgeRegression:
    def __init__(self, n_features, learning_rate=0.01, alpha=1.0):
        self.weights = [0.0] * n_features
        self.bias = 0.0
        self.lr = learning_rate
        self.alpha = alpha

    def predict_single(self, x):
        return sum(w * xi for w, xi in zip(self.weights, x)) + self.bias

    def predict(self, X):
        return [self.predict_single(x) for x in X]

    def fit(self, X, y, epochs=1000, print_every=200):
        n = len(y)
        n_features = len(X[0])
        for epoch in range(epochs):
            predictions = self.predict(X)
            errors = [pred - actual for pred, actual in zip(predictions, y)]
            mse = sum(e ** 2 for e in errors) / n
            reg_term = self.alpha * sum(w ** 2 for w in self.weights)
            cost = mse + reg_term
            for j in range(n_features):
                grad = (2 / n) * sum(errors[i] * X[i][j] for i in range(n))
                grad += 2 * self.alpha * self.weights[j]
                self.weights[j] -= self.lr * grad
            grad_b = (2 / n) * sum(errors)
            self.bias -= self.lr * grad_b
            if epoch % print_every == 0:
                print(f"  Epoch {epoch:4d} | Cost: {cost:.4f} | L2 penalty: {reg_term:.4f}")
        return self


print("\n=== Ridge Regression (L2 Regularization) ===")
print("Same data as multiple regression, with alpha=0.1")
ridge = RidgeRegression(n_features=3, learning_rate=0.01, alpha=0.1)
ridge.fit(X_scaled, y_scaled, epochs=1000, print_every=200)
print(f"\nRidge weights: {[round(w, 4) for w in ridge.weights]}")
print(f"Plain weights: {[round(w, 4) for w in multi_model.weights]}")
print("Ridge weights are smaller (shrunk toward zero) due to the L2 penalty.")
```

## 使用现成工具

现在用 scikit-learn 实现同样的功能，这才是你在生产中实际会用的东西。

```python
from sklearn.linear_model import LinearRegression as SklearnLR
from sklearn.linear_model import Ridge
from sklearn.preprocessing import PolynomialFeatures, StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
import numpy as np

np.random.seed(42)
X_sk = np.random.uniform(0, 10, (100, 1))
y_sk = 3.0 * X_sk.squeeze() + 7.0 + np.random.normal(0, 2.0, 100)

X_train, X_test, y_train, y_test = train_test_split(X_sk, y_sk, test_size=0.2, random_state=42)

lr = SklearnLR()
lr.fit(X_train, y_train)
y_pred = lr.predict(X_test)

print("=== Scikit-learn Linear Regression ===")
print(f"Coefficient (w): {lr.coef_[0]:.4f}")
print(f"Intercept (b): {lr.intercept_:.4f}")
print(f"R-squared (test): {r2_score(y_test, y_pred):.4f}")
print(f"MSE (test): {mean_squared_error(y_test, y_pred):.4f}")

poly = PolynomialFeatures(degree=2, include_bias=False)
X_poly_sk = poly.fit_transform(X_train)
X_poly_test = poly.transform(X_test)

lr_poly = SklearnLR()
lr_poly.fit(X_poly_sk, y_train)
print(f"\nPolynomial degree 2 R-squared: {r2_score(y_test, lr_poly.predict(X_poly_test)):.4f}")

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

ridge = Ridge(alpha=1.0)
ridge.fit(X_train_scaled, y_train)
print(f"Ridge R-squared: {r2_score(y_test, ridge.predict(X_test_scaled)):.4f}")
print(f"Ridge coefficient: {ridge.coef_[0]:.4f}")
```

你的从零实现和 scikit-learn 产生相同的结果。区别在于：scikit-learn 处理边界情况、数值稳定性和性能优化。生产中使用库。使用从零实现的版本来理解背后发生了什么。

## 发布成果

本课产出：
- `outputs/skill-regression.md` - 一项根据问题选择正确回归方法的技能

## 练习

1. 实现批量梯度下降、随机梯度下降(SGD)和小批量梯度下降。在同一数据集上比较收敛速度。哪个收敛最快？哪个的代价曲线最平滑？
2. 从三次函数生成数据(y = ax^3 + bx^2 + cx + d + noise)。拟合 1 次、3 次和 10 次多项式。比较训练 R^2 和测试 R^2。在几次时过拟合变得明显？
3. 实现 Lasso 回归(L1 正则化：penalty = alpha * sum(|w_i|))。在多特征住房数据上训练。比较哪些权重变为零，并与 Ridge 对比。为什么 L1 产生稀疏解而 L2 不会？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| 线性回归 | “在数据中画一条线” | 找到使 wx+b 与实际 y 值的平方差之和最小的权重 w 和偏置 b |
| 代价函数 | “模型有多差” | 将模型参数映射为衡量预测误差的单一数值的函数，优化过程将其最小化 |
| 均方误差 | “误差的平方的平均” | (1/n) * (预测 - 实际)^2 之和，对大误差施加不成比例的惩罚 |
| 梯度下降 | “往山下走” | 利用偏导数，沿降低代价函数的方向迭代调整参数 |
| 学习率 | “步长” | 控制每次梯度下降步骤中参数变化幅度的标量 |
| 正规方程 | “直接求解” | 闭式解 w = (X^T X)^-1 X^T y,无需迭代即可给出最优权重 |
| R 方 | “拟合有多好” | 模型解释的 y 方差比例，取值范围从负无穷到 1.0 |
| 特征缩放 | “让特征可比较” | 将特征变换到相近的范围(如零均值、单位方差)，使梯度下降收敛更快 |
| 正则化 | “惩罚复杂度” | 在代价函数中加入收缩权重的项，防止过拟合 |
| Ridge 回归 | “L2 正则化” | 在 MSE 上加入 lambda * sum(w_i^2) 惩罚项的线性回归 |
| 多项式回归 | “用线性数学拟合曲线” | 在多项式特征 (x, x^2, x^3, ...) 上的线性回归，对权重仍是线性的 |
| 过拟合 | “死记训练数据” | 使用过于复杂的模型，拟合了训练数据中的噪声，在新数据上表现不佳 |

## 延伸阅读

- [An Introduction to Statistical Learning (ISLR)](https://www.statlearning.com/) -- 免费 PDF,第 3 章和第 6 章用实用的 R 示例讲解线性回归和正则化
- [The Elements of Statistical Learning (ESL)](https://hastie.su.domains/ElemStatLearn/) -- 免费 PDF,ISLR 更数学化的姊妹篇，更深入地讨论 ridge 和 lasso
- [Stanford CS229 Lecture Notes on Linear Regression](https://cs229.stanford.edu/main_notes.pdf) -- Andrew Ng 的讲义，从第一性原理推导正规方程和梯度下降
- [scikit-learn LinearRegression documentation](https://scikit-learn.org/stable/modules/linear_model.html) -- LinearRegression、Ridge、Lasso 和 ElasticNet 的实用参考，附代码示例