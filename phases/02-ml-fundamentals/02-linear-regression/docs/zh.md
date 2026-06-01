# 02 · 线性回归

> 线性回归在你的数据中拟合出最佳的一条直线。它是机器学习的「Hello World」。

**类型：** 实践构建
**语言：** Python
**前置：** 阶段 1（线性代数、微积分、优化），阶段 2 第 1 课
**时长：** 约 90 分钟

## 学习目标

- 推导均方误差的梯度下降更新规则，并从零实现线性回归
- 从计算复杂度和适用场景两个角度对比梯度下降与正规方程（normal equation）
- 构建带特征标准化（feature standardization）的多元线性回归模型，并解读学到的权重
- 解释岭回归（Ridge regression，即 L2 正则化）如何通过惩罚大权重来防止过拟合

## 问题

你有一批数据：房屋面积及其成交价格。你想根据一套新房的面积来预测它的价格。你可以在散点图上凭肉眼估计，但你需要的是一个公式。你需要一条最能拟合数据的直线，这样就能代入任意面积、得到价格预测。

线性回归就为你提供了这条直线。更重要的是，它引出了整套机器学习训练循环：定义模型、定义代价函数、优化参数。每一个机器学习算法都遵循这同一套模式。在这里用最简单的情形掌握它，你以后就能在任何地方认出它。

这不仅适用于简单问题。线性回归被用于生产系统中的需求预测、A/B 测试分析、金融建模，也是每一个回归任务的基线。

## 概念

### 模型

线性回归假设输入（x）与输出（y）之间存在线性关系：

```
y = wx + b
```

- `w`（权重/斜率）：x 每增加 1，y 改变多少
- `b`（偏置/截距）：当 x = 0 时 y 的取值

对于多个输入（特征），它扩展为：

```
y = w1*x1 + w2*x2 + ... + wn*xn + b
```

或写成向量形式：`y = w^T * x + b`

目标：找到 w 和 b 的取值，使预测的 y 在所有训练样本上都尽可能接近真实的 y。

### 代价函数（均方误差）

如何衡量「尽可能接近」？你需要用一个数字来刻画预测错得有多离谱。最常见的选择是均方误差（Mean Squared Error，MSE）：

```
MSE = (1/n) * sum((y_predicted - y_actual)^2)
```

为什么要平方？有两个原因。第一，它对大误差的惩罚远重于小误差（误差为 10 的糟糕程度是误差为 1 的 100 倍，而不是 10 倍）。第二，平方函数处处光滑且可导，这让优化变得直截了当。

代价函数会形成一个曲面。对于单个权重 w 和偏置 b，MSE 曲面看起来像一个碗（一个凸抛物面）。碗底就是 MSE 取得最小值的地方。训练就意味着找到这个碗底。

### 梯度下降

梯度下降通过沿着下坡方向一步步走，来找到碗底。

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

梯度告诉你两件事：每个参数该往哪个方向移动，以及该移动多少。

对于 y_hat = wx + b 的 MSE：

```
dMSE/dw = (2/n) * sum((y_hat - y) * x)
dMSE/db = (2/n) * sum(y_hat - y)
```

更新规则：

```
w = w - learning_rate * dMSE/dw
b = b - learning_rate * dMSE/db
```

学习率（learning rate）控制步长。太大：你会越过最小值并发散。太小：训练会慢得没完没了。常见的初始取值：0.01、0.001 或 0.0001。

### 正规方程（闭式解）

专门针对线性回归，存在一个无需任何迭代就能直接给出最优权重的公式：

```
w = (X^T * X)^(-1) * X^T * y
```

它通过对一个矩阵求逆，一步求解出 w。对于小数据集，它工作得完美无缺。对于大数据集（数百万行或数千个特征），则更倾向于使用梯度下降，因为矩阵求逆关于特征数量的复杂度为 O(n^3)。

### 多元线性回归

有多个特征时，模型变为：

```
y = w1*x1 + w2*x2 + ... + wn*xn + b
```

其余一切照旧：MSE 仍是代价函数，梯度下降同时更新所有权重。唯一的区别是你拟合的是一个超平面（hyperplane），而不是一条直线。

特征缩放（feature scaling）在这里很重要。如果一个特征的取值范围是 0 到 1，而另一个是 0 到 1,000,000，梯度下降会很吃力，因为代价曲面会变得又细又长。在训练前对特征做标准化（减去均值，再除以标准差）。

### 多项式回归

如果关系不是线性的怎么办？你仍然可以通过构造多项式特征来使用线性回归：

```
y = w1*x + w2*x^2 + w3*x^3 + b
```

这依然属于「线性」回归，因为模型关于权重（w1、w2、w3）是线性的。你只是使用了 x 的非线性特征而已。

更高次的多项式能拟合更复杂的曲线，但有过拟合的风险。一个 10 次多项式能精确穿过一个 10 点数据集中的每一个点，但对新数据的预测会很糟糕。

### R 方分数

MSE 告诉你错得有多离谱，但这个数字依赖于 y 的尺度。R 方（R^2）给出一个与尺度无关的度量：

```
R^2 = 1 - (sum of squared residuals) / (sum of squared deviations from mean)
    = 1 - SS_res / SS_tot
```

- R^2 = 1.0：完美预测
- R^2 = 0.0：模型并不比每次都预测均值更好
- R^2 < 0.0：模型比预测均值还要差

### 正则化预览（岭回归）

当特征很多时，模型可能通过赋予很大的权重而过拟合。岭回归（L2 正则化）会加上一个惩罚项：

```
Cost = MSE + lambda * sum(w_i^2)
```

这个惩罚项会抑制大权重。超参数 lambda 控制权衡：lambda 越大，权重越小，正则化越强。这将在后续某一课中深入讲解。现在你只需知道它的存在，以及它为何有用。

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

### 第 3 步：正规方程（闭式解）

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

### 第 6 步：岭回归（L2 正则化）

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

## 实战应用

现在用 scikit-learn 做同样的事情——这才是你在生产环境中真正会用到的工具。

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

你从零实现的版本与 scikit-learn 产出相同的结果。区别在于：scikit-learn 处理了各种边界情形、数值稳定性以及性能优化。生产环境用库，从零实现的版本则用来理解背后到底发生了什么。

## 交付产出

本课会产出：
- `outputs/skill-regression.md`——一份用于根据问题选择正确回归方法的技能（skill）文档

## 练习

1. 实现批量梯度下降（batch gradient descent）、随机梯度下降（stochastic gradient descent，SGD）以及小批量梯度下降（mini-batch gradient descent）。在同一个数据集上比较它们的收敛速度。哪种收敛最快？哪种的代价曲线最平滑？
2. 从一个三次函数（y = ax^3 + bx^2 + cx + d + noise）生成数据。拟合 1 次、3 次和 10 次多项式。比较训练集 R^2 与测试集 R^2。在几次时过拟合开始变得明显？
3. 实现 Lasso 回归（L1 正则化：penalty = alpha * sum(|w_i|)）。在多特征房价数据上训练。对比哪些权重归零了，与岭回归相比有何不同。为什么 L1 会产生稀疏解，而 L2 不会？

## 关键术语

| 术语 | 人们口头怎么说 | 它实际指什么 |
|------|----------------|----------------------|
| 线性回归（Linear regression） | 「在数据中画一条线」 | 找到权重 w 和偏置 b，使 wx+b 与真实 y 值之间的平方差之和最小 |
| 代价函数（Cost function） | 「模型有多差」 | 一个将模型参数映射为单个数字（衡量预测误差）的函数，优化过程要将其最小化 |
| 均方误差（Mean squared error） | 「误差平方的平均」 | (1/n) * sum of (predicted - actual)^2，对大误差施加不成比例的惩罚 |
| 梯度下降（Gradient descent） | 「往山下走」 | 利用偏导数，朝着减小代价函数的方向迭代调整参数 |
| 学习率（Learning rate） | 「步长」 | 一个标量，控制每一步梯度下降中参数改变多少 |
| 正规方程（Normal equation） | 「直接解出来」 | 闭式解 w = (X^T X)^-1 X^T y，无需迭代即可给出最优权重 |
| R 方（R-squared） | 「拟合得有多好」 | 模型所解释的 y 方差占比，取值范围从负无穷到 1.0 |
| 特征缩放（Feature scaling） | 「让特征可比」 | 将特征变换到相近的范围（例如零均值、单位方差），使梯度下降收敛更快 |
| 正则化（Regularization） | 「惩罚复杂度」 | 在代价函数中加入一项以收缩权重，防止过拟合 |
| 岭回归（Ridge regression） | 「L2 正则化」 | 在 MSE 上加入 lambda * sum(w_i^2) 惩罚项的线性回归 |
| 多项式回归（Polynomial regression） | 「用线性数学拟合曲线」 | 在多项式特征（x、x^2、x^3……）上做线性回归，关于权重仍然是线性的 |
| 过拟合（Overfitting） | 「死记训练数据」 | 使用一个复杂到能拟合训练数据中噪声的模型，结果在新数据上失效 |

## 延伸阅读

- [An Introduction to Statistical Learning (ISLR)](https://www.statlearning.com/) —— 免费 PDF，第 3 章和第 6 章用实用的 R 示例讲解线性回归与正则化
- [The Elements of Statistical Learning (ESL)](https://hastie.su.domains/ElemStatLearn/) —— 免费 PDF，ISLR 的进阶数学姊妹篇，对岭回归和 lasso 有更深入的处理
- [Stanford CS229 Lecture Notes on Linear Regression](https://cs229.stanford.edu/main_notes.pdf) —— 吴恩达（Andrew Ng）的讲义，从第一性原理推导正规方程与梯度下降
- [scikit-learn LinearRegression documentation](https://scikit-learn.org/stable/modules/linear_model.html) —— LinearRegression、Ridge、Lasso 与 ElasticNet 的实用参考，附带代码示例
