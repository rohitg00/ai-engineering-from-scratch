# 線性迴歸

> 線性迴歸會在資料中畫出最貼近資料點的直線。它是機器學習的「Hello, World!」。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 1 (Linear Algebra, Calculus, Optimization), Phase 2 Lesson 1
**Time:** ~90 minutes

## 學習目標

- 推導均方誤差的梯度下降更新規則，並從零實作線性迴歸
- 比較梯度下降與正規方程式的計算複雜度，並判斷各自適用的情況
- 建立含特徵標準化的多元線性迴歸模型，並解讀學得的權重
- 說明 Ridge 迴歸（L2 正則化）如何透過懲罰較大的權重來防止過度擬合

## 問題

你有一份房屋大小與售價的資料，想根據新房屋的大小預測價格。你可以在散佈圖上目測趨勢，但實際上需要一個公式：找出一條最貼合資料的直線，輸入任意房屋大小後就能預測價格。

線性迴歸能幫你找出這條線。更重要的是，它帶你認識完整的機器學習訓練迴圈：定義模型、定義成本函式、最佳化參數。每種機器學習演算法都遵循相同模式。先從最簡單的情況掌握它，你就會在其他地方看見相同模式。

線性迴歸不只適用於簡單問題。正式系統也會用它做需求預測、A/B 測試分析、財務模型，以及各種迴歸任務的基準。

## 核心概念

### 模型

線性迴歸假設輸入 (x) 和輸出 (y) 之間具有線性關係：

```text
y = wx + b
```

- `w`（權重／斜率）：x 每增加 1，y 會改變多少
- `b`（偏差／截距）：x = 0 時 y 的值

若有多個輸入（特徵），模型會擴展為：

```text
y = w1*x1 + w2*x2 + ... + wn*xn + b
```

向量形式可寫成：`y = w^T * x + b`

目標是找出 w 和 b 的值，讓所有訓練範例的預測 y 都盡可能接近實際 y。

### 成本函式（均方誤差）

如何衡量「盡可能接近」？你需要用一個數值表示預測錯得多嚴重。最常見的選擇是均方誤差（MSE）：

```text
MSE = (1/n) * sum((y_predicted - y_actual)^2)
```

為什麼要平方？有兩個原因。第一，它對大誤差的懲罰大於小誤差（誤差 10 的懲罰是誤差 1 的 100 倍，而非 10 倍）。第二，平方函式處處平滑且可微，因此容易進行最佳化。

成本函式會形成一個曲面。若只有一個權重 w 和偏差 b，MSE 曲面看起來像碗（凸拋物面）。碗底就是 MSE 最小的位置。訓練就是找出這個碗底。

### 梯度下降

梯度下降會沿著下坡方向逐步移動，以找到碗底。

```mermaid
flowchart TD
    A[隨機初始化 w 和 b] --> B[計算預測值：y_hat = wx + b]
    B --> C[計算成本：MSE]
    C --> D[計算梯度：dMSE/dw、dMSE/db]
    D --> E[更新參數]
    E --> F{成本夠低了嗎？}
    F -->|否| B
    F -->|是| G[完成：找到最佳 w 和 b]
```

梯度會告訴你兩件事：每個參數應該往哪個方向移動，以及移動多少。

對於 y_hat = wx + b 的 MSE：

```text
dMSE/dw = (2/n) * sum((y_hat - y) * x)
dMSE/db = (2/n) * sum(y_hat - y)
```

更新規則如下：

```text
w = w - learning_rate * dMSE/dw
b = b - learning_rate * dMSE/db
```

學習率控制每一步的大小。學習率太大，會越過最小值而發散；太小則會讓訓練花上很久。常見的起始值為 0.01、0.001 或 0.0001。

### 正規方程式（封閉解）

只針對線性迴歸，有一個可直接求出最佳權重的公式，不需要反覆迭代：

```text
w = (X^T * X)^(-1) * X^T * y
```

這個公式透過反矩陣一步求出 w。對小型資料集而言效果很好。若資料集很大（數百萬列或數千個特徵），因為矩陣反轉的複雜度是特徵數的 O(n³)，通常會改用梯度下降。

### 多元線性迴歸

有多個特徵時，模型會變成：

```text
y = w1*x1 + w2*x2 + ... + wn*xn + b
```

其他部分都相同：成本函式仍是 MSE，梯度下降會同時更新所有權重。唯一差異是現在要擬合超平面，而不是直線。

這時特徵縮放很重要。如果一個特徵的範圍是 0 到 1，另一個則是 0 到 1,000,000，成本曲面會變得狹長，讓梯度下降難以收斂。訓練前先標準化特徵（減去平均值，再除以標準差）。

### 多項式迴歸

如果關係不是線性的呢？你仍然可以透過建立多項式特徵來使用線性迴歸：

```text
y = w1*x + w2*x^2 + w3*x^3 + b
```

這仍稱為「線性」迴歸，因為模型對權重 (w1, w2, w3) 是線性的；只是使用了 x 的非線性特徵。

較高次的多項式能擬合更複雜的曲線，但也有過度擬合的風險。10 次多項式可以穿過 10 個資料點中的每一點，卻可能無法準確預測新資料。

### R 平方分數

MSE 能表示預測錯得多嚴重，但數值會受 y 的尺度影響。R 平方（R²）則提供不受尺度影響的衡量方式：

```text
R^2 = 1 - (sum of squared residuals) / (sum of squared deviations from mean)
    = 1 - SS_res / SS_tot
```

- R² = 1.0：完美預測
- R² = 0.0：模型不比每次都預測平均值好
- R² < 0.0：模型比每次都預測平均值更差

### 正則化預覽（Ridge 迴歸）

特徵很多時，模型可能會因為給予某些特徵很大的權重而過度擬合。Ridge 迴歸（L2 正則化）會加入懲罰項：

```text
Cost = MSE + lambda * sum(w_i^2)
```

懲罰項會抑制過大的權重。超參數 lambda 控制取捨：lambda 越高，權重越小，正則化效果越強。後續課程會深入介紹；目前先了解這種方法的存在及其用途。

```figure
linear-regression-fit
```

## Build It：從零實作

### 步驟 1：產生範例資料

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

### 步驟 2：從零實作梯度下降線性迴歸

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

### 步驟 3：正規方程式（封閉解）

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

### 步驟 4：多元線性迴歸

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

### 步驟 5：多項式迴歸

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

### 步驟 6：Ridge 迴歸（L2 正則化）

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

## Use It：實際應用

接著使用實際工作中會採用的 scikit-learn，做相同的事。

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

從零實作的版本與 scikit-learn 會得到相同結果。差異在於 scikit-learn 處理了邊界情況、數值穩定性及效能最佳化。正式環境請使用函式庫；從零實作的版本則可協助你理解背後的運作方式。

## Ship It：交付成果

本課程會產生：
- `outputs/skill-regression.md`——根據問題選擇合適迴歸方法的 skill

## Exercises：練習

1. 實作批次梯度下降、隨機梯度下降（SGD）和小批次梯度下降，並比較它們在相同資料集上的收斂速度。哪種收斂最快？哪種成本曲線最平滑？
2. 使用三次函式 (y = ax^3 + bx^2 + cx + d + noise) 產生資料，分別擬合 1 次、3 次和 10 次多項式，比較訓練 R² 和測試 R²。多項式次數到幾次時，過度擬合開始變得明顯？
3. 實作 Lasso 迴歸（L1 正則化：penalty = alpha * sum(|w_i|)），並使用多特徵房屋資料訓練。比較 Lasso 和 Ridge 會讓哪些權重變成零。為什麼 L1 會產生稀疏解，而 L2 不會？

## 關鍵詞

| 術語 | 一般說法 | 實際意義 |
|------|----------|----------|
| 線性迴歸 |「在資料上畫一條線」| 找出 w 和 b，使 wx+b 與實際 y 值的平方差總和最小 |
| 成本函式 |「模型有多糟」| 將模型參數映射為單一數值、衡量預測誤差的函式；最佳化過程會將其最小化 |
| 均方誤差 |「誤差平方的平均值」| (1/n) * sum((預測值 - 實際值)^2)，會對大誤差施加更重的懲罰 |
| 梯度下降 |「往下坡走」| 根據偏導數逐步調整參數，以降低成本函式 |
| 學習率 |「步伐大小」| 控制每次梯度下降更新幅度的純量 |
| 正規方程式 |「直接求解」| 封閉解 w = (X^T X)^-1 X^T y，不需反覆迭代即可求得最佳權重 |
| R 平方 |「擬合得多好」| 模型能解釋 y 變異的比例，範圍從負無限大到 1.0 |
| 特徵縮放 |「讓特徵尺度相近」| 將特徵轉換到相近範圍（例如平均值為 0、變異數為 1），讓梯度下降更快收斂 |
| 正則化 |「懲罰模型複雜度」| 在成本函式中加入項目來縮小權重，防止過度擬合 |
| Ridge 迴歸 |「L2 正則化」| 在線性迴歸的 MSE 中加入 lambda * sum(w_i^2) 懲罰項 |
| 多項式迴歸 |「用線性數學擬合曲線」| 對多項式特徵（x、x^2、x^3、...）執行線性迴歸，模型對權重仍是線性的 |
| 過度擬合 |「記住訓練資料」| 模型過於複雜，連訓練資料中的雜訊也一併擬合，因而無法處理新資料 |

## 延伸閱讀

- [An Introduction to Statistical Learning (ISLR)](https://www.statlearning.com/)——免費 PDF，第 3 和第 6 章以實務 R 範例介紹線性迴歸和正則化
- [The Elements of Statistical Learning (ESL)](https://hastie.su.domains/ElemStatLearn/)——免費 PDF，與 ISLR 相輔相成的數學教材，深入介紹 Ridge 和 Lasso
- [Stanford CS229 線性迴歸講義](https://cs229.stanford.edu/main_notes.pdf)——Andrew Ng 的講義，從基本原理推導正規方程式和梯度下降
- [scikit-learn LinearRegression 文件](https://scikit-learn.org/stable/modules/linear_model.html)——LinearRegression、Ridge、Lasso 和 ElasticNet 的實作參考，附有程式碼範例
