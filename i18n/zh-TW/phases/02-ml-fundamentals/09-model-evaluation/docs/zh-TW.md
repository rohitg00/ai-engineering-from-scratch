# 模型評估（model evaluation）

> 模型好不好，取決於你怎麼衡量它。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 1 (Probability & Distributions, Statistics for ML), Phase 2 Lessons 1-8
**Time:** ~90 minutes

## Learning Objectives｜學習目標

- 從頭實作 K 折（K-fold）與分層 K 折（stratified K-fold）交叉驗證（cross-validation），並說明分層對類別不平衡（class imbalance）資料為何重要
- 從頭計算精確率（precision）、召回率（recall）、F1 分數（F1 score）、AUC-ROC 與迴歸指標（regression metrics，MSE、RMSE、MAE、R 平方（R-squared））
- 解讀學習曲線（learning curve），診斷模型是高偏差（high bias）還是高變異（high variance）
- 辨識常見的評估錯誤：資料洩漏（data leakage）、選錯指標（metric），以及測試集（test set）污染

## The Problem｜問題

你訓練了一個模型。它在你的資料上拿到 95% 的準確率（accuracy）。這算好嗎？

也許算，也許不算。如果你 95% 的資料都屬於同一個類別（class），那麼一個永遠預測該類別的模型也能拿到 95% 的準確率，卻完全沒用。如果你拿訓練用的同一份資料來評估，那個 95% 毫無意義，因為模型只是把答案背起來了。如果你的資料集（dataset）帶有時間成分，而你切分前先隨機打亂，模型可能正在用未來的資料預測過去。

模型評估是大多數機器學習（machine learning）專案出錯的地方。選錯指標會讓爛模型看起來很好；切錯資料會讓模型作弊；比錯對象會讓你選到比較差的那個。把評估做對不是可有可無的事——它是「在正式環境跑得動的模型」與「一碰到真實資料就掛掉的模型」之間的差別。

## The Concept｜核心概念

### 訓練集、驗證集、測試集

```mermaid
flowchart LR
    A[完整資料集] --> B[訓練集 60-70%]
    A --> C[驗證集 15-20%]
    A --> D[測試集 15-20%]
    B --> E[擬合模型]
    E --> C
    C --> F[調整超參數]
    F --> E
    F --> G[最終模型]
    G --> D
    D --> H[回報表現]
```

三種切分，三種用途：

- **訓練集（training set）**：模型從這些資料中學習。訓練時它看的就是這些樣本（example）。
- **驗證集（validation set）**：用來調整超參數（hyperparameter）和挑選模型。模型從不用它訓練，但你的決策會受它影響。
- **測試集**：只在最後碰一次，用來回報最終表現。如果你看了測試表現之後回頭改模型，它就不再是測試集——它已經變成第二個驗證集了。

測試集是你的保留集（hold-out）保證：它確保你回報的表現，反映的是模型面對真正沒見過的資料時的樣子。

### K 折交叉驗證

資料集小的時候，單一次的訓練／驗證切分既浪費資料，估計又不穩定。K 折交叉驗證讓每一份資料都既能用於訓練也能用於驗證：

```mermaid
flowchart TB
    subgraph Fold1["第 1 折"]
        direction LR
        V1["驗證"] --- T1a["訓練"] --- T1b["訓練"] --- T1c["訓練"] --- T1d["訓練"]
    end
    subgraph Fold2["第 2 折"]
        direction LR
        T2a["訓練"] --- V2["驗證"] --- T2b["訓練"] --- T2c["訓練"] --- T2d["訓練"]
    end
    subgraph Fold3["第 3 折"]
        direction LR
        T3a["訓練"] --- T3b["訓練"] --- V3["驗證"] --- T3c["訓練"] --- T3d["訓練"]
    end
    subgraph Fold4["第 4 折"]
        direction LR
        T4a["訓練"] --- T4b["訓練"] --- T4c["訓練"] --- V4["驗證"] --- T4d["訓練"]
    end
    subgraph Fold5["第 5 折"]
        direction LR
        T5a["訓練"] --- T5b["訓練"] --- T5c["訓練"] --- T5d["訓練"] --- V5["驗證"]
    end
    Fold1 --> R["平均各折分數"]
    Fold2 --> R
    Fold3 --> R
    Fold4 --> R
    Fold5 --> R
```

1. 把資料切成 K 個等大的折（fold）
2. 每一折輪流當驗證集：用其餘 K-1 折訓練，用該折驗證
3. 把 K 個驗證分數取平均

K=5 或 K=10 是標準選擇。每個資料點（data point）恰好被拿來驗證一次。平均分數比任何單一切分都更穩定。

**分層 K 折**：保持每一折的類別分布（class distribution）不變。如果你的資料集是 70% A 類、30% B 類，每一折也會大致維持同樣的比例。這對類別不平衡（class imbalance）資料集很重要——隨機切分可能把少數類（minority class）樣本全塞進同一折。

### 分類指標

**混淆矩陣（confusion matrix）**：一切的基礎。以二元分類（binary classification）為例：

|  | 預測為正類 | 預測為負類 |
|--|---|---|
| 實際為正類 | 真陽性（true positive，TP） | 偽陰性（false negative，FN） |
| 實際為負類 | 偽陽性（false positive，FP） | 真陰性（true negative，TN） |

其他所有指標都從這張矩陣推導出來：

- **準確率** = (TP + TN) / (TP + TN + FP + FN)。預測正確的比例。類別不平衡（class imbalance）時會誤導。
- **精確率** = TP / (TP + FP)。所有預測為正類的樣本中，實際真的是正類的有多少？當偽陽性代價高時用它（例如垃圾郵件篩選器把正常郵件誤判為垃圾郵件）。
- **召回率**（亦稱敏感度（sensitivity）） = TP / (TP + FN)。所有實際為正類的樣本中，我們抓到了多少？當偽陰性代價高時用它（例如癌症篩檢漏掉腫瘤）。
- **F1 分數** = 2 * precision * recall / (precision + recall)。精確率與召回率的調和平均數（harmonic mean）。兩者都重要、沒有誰明顯優先時用它來平衡。
- **AUC-ROC**：ROC 曲線（Receiver Operating Characteristic curve）下的面積。ROC 曲線描繪不同分類閾值（threshold）下，真陽性率（true positive rate）對偽陽性率（false positive rate）的變化。AUC = 0.5 代表隨機亂猜，AUC = 1.0 代表完美分離。它與閾值無關——不管你選什麼切點，它衡量的是模型把正類排在負類前面的能力。

### 迴歸指標

- **MSE**（Mean Squared Error，均方誤差） = mean((y_true - y_pred)^2)。以平方懲罰大誤差，對離群值（outlier）敏感。
- **RMSE**（Root Mean Squared Error，均方根誤差） = sqrt(MSE)。與目標變數（target variable）同單位，比 MSE 更好解讀。
- **MAE**（Mean Absolute Error，平均絕對誤差） = mean(|y_true - y_pred|)。對所有誤差採線性懲罰，比 MSE 對離群值更穩健。
- **R 平方（R-squared）** = 1 - SS_res / SS_tot，其中 SS_res = sum((y_true - y_pred)^2)，SS_tot = sum((y_true - y_mean)^2)。模型所解釋的變異數（variance）比例。R^2 = 1.0 是完美；R^2 = 0.0 代表模型不比永遠預測平均數好；模型比預測平均數還差時，R^2 甚至可以是負的。

### 學習曲線

把訓練分數與驗證分數畫成訓練集大小的函數：

- **高偏差——欠擬合（underfitting）**：兩條曲線收斂到低分。加更多資料沒有用——你需要更複雜的模型。
- **高變異——過度擬合（overfitting）**：訓練分數很高，但驗證分數低很多，兩者之間的缺口很大。加更多資料應該會有幫助。

### 驗證曲線（validation curve）

把訓練分數與驗證分數畫成某個超參數的函數：

- 複雜度太低時：兩個分數都很低（欠擬合）
- 複雜度剛好時：兩個分數都很高且彼此接近
- 複雜度太高時：訓練分數依然很高，但驗證分數下滑（過度擬合）

最佳超參數值就在驗證分數的峰頂。

### 常見的評估錯誤

**資料洩漏**：測試集的資訊滲進訓練。例子：切分前就在完整資料集上擬合縮放器（scaler）、在時間序列（time series）預測裡混入未來資料、使用從目標衍生出來的特徵（feature）。永遠先切分，再前處理（preprocessing）。

**類別不平衡（class imbalance）**：99% 的交易是正常交易，1% 是詐欺。一個永遠預測「正常」的模型能拿到 99% 的準確率。改用精確率、召回率、F1 或 AUC-ROC。

**選錯指標**：該最佳化（optimization）召回率時卻在最佳化準確率（醫療診斷）；資料裡有極端離群值時卻在最佳化 RMSE（這種情況改用 MAE）。

**沒有用分層切分（stratified split）**：類別不平衡（class imbalance）時，隨機切分可能讓驗證折只剩極少的少數類樣本，估計就不穩。

**測試太多次**：每次你看了測試表現再回頭調整，就是在對測試集過度擬合。測試集只能用一次。

```figure
precision-recall-threshold
```

## Build It｜動手實作

### 步驟 1：訓練／驗證／測試切分

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

### 步驟 2：K 折與分層 K 折交叉驗證

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

### 步驟 3：混淆矩陣與分類指標

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

### 步驟 4：迴歸指標

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

### 步驟 5：學習曲線

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

### 步驟 6：一個用來測試的簡單分類器，以及完整示範

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

## Use It｜實際應用

有了 scikit-learn，評估直接內建在流程裡：

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

從頭實作的版本能確切呈現交叉驗證在做什麼（沒有魔法，只是 for 迴圈和索引追蹤）、每個指標怎麼算（只是在數 TP/FP/TN/FN），以及分層為什麼重要（在每一折保持類別比例）。函式庫（library）版本另外加入了平行化、更多評分選項，以及與管線（pipeline）的整合。

## Ship It｜交付成果

本課會產出：
- `outputs/skill-evaluation.md`——一份涵蓋分類與迴歸模型評估策略的 skill

## Exercises｜練習

1. 實作精確率–召回率曲線（precision-recall curve）：畫出不同閾值下的精確率對召回率。計算平均精確率（average precision，PR 曲線下面積）。在類別不平衡（class imbalance）資料集上比較 PR 曲線與 ROC 曲線，並說明什麼情況下哪一個更有參考價值。
2. 建立巢狀交叉驗證（nested cross-validation）迴圈：外層迴圈評估模型表現，內層迴圈調整超參數。用它公平比較兩個模型，不把驗證資料洩漏進評估裡。
3. 實作模型比較用的置換檢定（permutation test）：打亂標籤（label）、重新訓練、測量表現。重複 100 次建立虛無分布（null distribution）。針對觀察到的模型表現，計算對應這個分布的 p 值（p-value）。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|----------------------|
| 過度擬合（overfitting） | 「把訓練資料背起來」 | 模型捕捉到訓練資料中的雜訊，在訓練資料上表現好、在沒見過的資料上表現差 |
| 交叉驗證（cross-validation） | 「在不同子集上測試」 | 有系統地輪換哪一部分資料用於驗證，並對所有輪換的結果取平均 |
| 精確率（precision） | 「預測為正類的有多少是對的」 | TP / (TP + FP)：正類預測中實際為正類的比例 |
| 召回率（recall） | 「實際為正類的我們找到多少」 | TP / (TP + FN)：實際正類中被正確辨識出來的比例 |
| AUC-ROC | 「模型把類別分得多開」 | 在所有閾值下，真陽性率對偽陽性率的曲線下面積，從 0.5（隨機）到 1.0（完美） |
| R 平方（R-squared） | 「解釋了多少變異」 | 1 -（殘差平方和 ÷ 總平方和）：模型捕捉到的目標變異數比例 |
| 資料洩漏（data leakage） | 「模型作弊了」 | 訓練時使用了預測時不可能取得的資訊，導致評估結果過度樂觀 |
| 學習曲線（learning curve） | 「資料更多時表現怎麼變」 | 訓練分數與驗證分數對訓練集大小的圖，用來看出欠擬合或過度擬合 |
| 分層切分（stratified split） | 「保持類別比例平衡」 | 切分資料時，讓每個子集的各類別比例與完整資料集相同 |

## Further Reading｜延伸閱讀

- [scikit-learn Model Selection Guide](https://scikit-learn.org/stable/model_selection.html)——交叉驗證、指標與超參數調整的完整參考
- [Beyond Accuracy: Precision and Recall (Google ML Crash Course)](https://developers.google.com/machine-learning/crash-course/classification/precision-and-recall)——附互動範例的清楚解說
- [A Survey of Cross-Validation Procedures (Arlot & Celisse, 2010)](https://projecteuclid.org/journals/statistics-surveys/volume-4/issue-none/A-survey-of-cross-validation-procedures-for-model-selection/10.1214/09-SS054.full)——嚴謹探討各種交叉驗證策略何時有效、為何有效
