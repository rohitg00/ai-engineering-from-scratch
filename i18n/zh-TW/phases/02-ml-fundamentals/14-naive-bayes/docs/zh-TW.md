# 單純貝氏（Naive Bayes）

> 「單純（naive）」假設是錯的，但它還是能用。這正是它的好處。

**Type:** Build
**Language:** Python
**Prerequisites:** Phase 2, Lessons 01-07 (classification, Bayes' theorem)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 從頭實作多項單純貝氏（Multinomial Naive Bayes），並用拉普拉斯平滑（Laplace smoothing）做文字分類（text classification）
- 說明為什麼單純的獨立性假設在數學上是錯的，實務上卻仍能排出正確的類別排名
- 比較多項、伯努利（Bernoulli）與高斯單純貝氏（Gaussian Naive Bayes），並依特徵類型選對的變體
- 在高維稀疏資料上把單純貝氏和邏輯斯迴歸（logistic regression）放在一起評估，並說明其中的偏差－變異取捨（bias-variance tradeoff）

## The Problem｜問題

你要做文字分類。把電子郵件分成垃圾郵件或非垃圾郵件，把顧客評論分成正面或負面，把客服單分成不同類別。你有數千個特徵（feature）（每個詞一個），訓練資料（training data）卻有限。

多數分類器（classifier）在這裡會卡住。邏輯斯迴歸需要足夠的樣本，才能可靠地估計數千個權重（weight）。決策樹（decision tree）一次只對一個詞做分割，會嚴重過度擬合（overfitting）。k 最近鄰法（KNN）在 10,000 個維度（dimension）裡沒有意義，因為每個點和其他點的距離都差不多。

單純貝氏處理得了這種情況。它做了一個數學上錯誤的假設（給定類別後，每個特徵都獨立於其他特徵），但在文字分類上，尤其是訓練集很小的時候，它仍然勝過那些「更聰明」的模型。它只要把資料走一遍就能訓練完。它能擴展到數百萬個特徵。它會給出機率（probability）估計（不過因為獨立性假設，這些機率常常校準（calibration）得很差）。

弄懂一個錯誤假設為什麼仍能帶來好的預測，會讓你學到機器學習（machine learning）的一件根本事情：最好的模型不是最正確的那個，而是對你的資料有最好偏差－變異取捨的那個。

## The Concept｜核心概念

### 貝氏定理（Bayes' theorem）快速回顧

貝氏定理把條件機率反過來：

```
P(class | features) = P(features | class) * P(class) / P(features)
```

我們要的是 `P(class | features)`——給定文件裡的詞，這份文件屬於某類別的機率。它可以用下面三項算出來：
- `P(features | class)`——概似（likelihood）：在這個類別的文件裡看到這些詞的可能程度
- `P(class)`——先驗機率（prior probability）：這個類別的先驗（垃圾郵件整體有多常見？）
- `P(features)`——證據（evidence）：對所有類別都一樣，所以比較時可以忽略

`P(class | features)` 最高的類別獲勝。

### 單純的獨立性假設

要精確計算 `P(features | class)`，必須估計所有特徵一起出現的聯合機率。詞彙表（vocabulary）有 10,000 個詞時，你得估計 2^10,000 種組合上的分布。這做不到。

單純假設是：給定類別後，每個特徵都條件獨立（conditional independence）。

```
P(w1, w2, ..., wn | class) = P(w1 | class) * P(w2 | class) * ... * P(wn | class)
```

你不必估計一個做不到的聯合分布（joint distribution），只要估計 n 個簡單的單特徵分布。每一個只需要一個計數。

這個假設顯然是錯的。任何文件裡「machine」和「learning」都不獨立。但分類器不需要正確的機率估計，它需要正確的排名——哪個類別的機率最高。獨立性假設會帶入系統性誤差，但這些誤差對所有類別的影響類似，所以排名仍然正確。

### 為什麼它仍然有效

三個原因：

1. **排名重於校準。** 分類只需要排名最高的類別是對的。就算 P(spam) = 0.99999，而真實機率是 0.7，分類器仍然會正確選到垃圾郵件。我們不需要正確的機率，我們需要正確的贏家。

2. **高偏差（high bias）、低變異（low variance）。** 獨立性假設是很強的先驗。它大幅限制模型，從而防止過度擬合。訓練資料有限時，一個稍有偏差但穩定的模型，勝過理論上正確卻非常不穩定的模型。這就是偏差－變異取捨的具體展現。

3. **特徵冗餘（feature redundancy）會互相抵消。** 相關的特徵提供的是重複證據。分類器會把這份證據算兩次，但它也是對正確的類別算兩次。如果「machine」和「learning」總是一起出現，兩者都是「tech」類別的證據。單純貝氏把它們各算一次、合計兩次，但兩次都算在正確的類別上。

第四個實務原因：單純貝氏非常快。訓練只是把資料走一遍、計算頻率。預測是一次矩陣乘法（matrix multiplication）。一百萬份文件可以在幾秒內訓練完。這種速度讓你能更快迭代、嘗試更多特徵集合、跑更多實驗。

### 逐步數學

用一個具體例子走一遍。假設有兩個類別：垃圾郵件與非垃圾郵件。詞彙表有三個詞：「free」、「money」、「meeting」。

訓練資料：
- 垃圾郵件提到「free」80 次、「money」60 次、「meeting」10 次（共 150 個詞）
- 非垃圾郵件提到「free」5 次、「money」10 次、「meeting」100 次（共 115 個詞）
- 40% 的郵件是垃圾郵件，60% 不是

使用拉普拉斯平滑（alpha=1）：

```
P(free | spam)    = (80 + 1) / (150 + 3) = 81/153 = 0.529
P(money | spam)   = (60 + 1) / (150 + 3) = 61/153 = 0.399
P(meeting | spam) = (10 + 1) / (150 + 3) = 11/153 = 0.072

P(free | not-spam)    = (5 + 1) / (115 + 3) = 6/118 = 0.051
P(money | not-spam)   = (10 + 1) / (115 + 3) = 11/118 = 0.093
P(meeting | not-spam) = (100 + 1) / (115 + 3) = 101/118 = 0.856
```

新郵件包含：「free」（2 次）、「money」（1 次）、「meeting」（0 次）。

```
log P(spam | email) = log(0.4) + 2*log(0.529) + 1*log(0.399) + 0*log(0.072)
                    = -0.916 + 2*(-0.637) + (-0.919) + 0
                    = -3.109

log P(not-spam | email) = log(0.6) + 2*log(0.051) + 1*log(0.093) + 0*log(0.856)
                        = -0.511 + 2*(-2.976) + (-2.375) + 0
                        = -8.838
```

垃圾郵件以很大的差距獲勝。「free」出現兩次是垃圾郵件的強證據。注意「meeting」沒有出現時，對兩邊的對數和貢獻都是零（0 * log(P)）——在多項單純貝氏裡，沒出現的詞沒有影響。明確把「詞沒出現」建進模型的，是伯努利單純貝氏。

### 三種變體

單純貝氏有三種形式。每一種對 `P(feature | class)` 的建模方式不同。

#### 多項單純貝氏

把每個特徵建成計數。最適合特徵是詞頻或 TF-IDF（詞頻–逆文件頻率）值的文字資料。

```
P(word_i | class) = (count of word_i in class + alpha) / (total words in class + alpha * vocab_size)
```

`alpha` 就是拉普拉斯平滑（下面會說明）。這個變體是文字分類的主力。

#### 高斯單純貝氏

把每個特徵建成常態分布（normal distribution）。最適合連續特徵。

```
P(x_i | class) = (1 / sqrt(2 * pi * var)) * exp(-(x_i - mean)^2 / (2 * var))
```

每個類別對每個特徵都有自己的平均數（mean）與變異數（variance）。當特徵在各類別內確實接近鐘形曲線時，這個變體效果很好。

#### 伯努利單純貝氏

把每個特徵建成二元值（出現或未出現）。最適合短文字或二元特徵向量。

```
P(word_i | class) = (docs in class containing word_i + alpha) / (total docs in class + 2 * alpha)
```

和多項不同，伯努利會明確懲罰某個詞沒有出現。如果「free」通常出現在垃圾郵件裡，但這封信沒有它，伯努利會把這件事當成反對垃圾郵件的證據。

### 何時用哪一種

| 變體 | 特徵類型 | 最適合 | 例子 |
|---------|-------------|----------|---------|
| 多項 | 計數或頻率 | 文字分類、詞袋（bag of words） | 電子郵件垃圾郵件、主題分類 |
| 高斯 | 連續值 | 特徵大致呈常態的表格資料（tabular data） | 鳶尾花分類、感測器資料 |
| 伯努利 | 二元（0/1） | 短文字、二元特徵向量 | 簡訊垃圾郵件、出現／未出現特徵 |

### 拉普拉斯平滑

如果一個詞出現在測試資料（test data）裡，卻從未出現在某個類別的訓練資料中，會發生什麼事？

沒有平滑時：`P(word | class) = 0/N = 0`。一個零乘進整個乘積，就會讓 `P(class | features) = 0`，不管其他證據有多強。一個沒見過的詞就毀掉整次預測，即使其餘證據都支持這個類別。

拉普拉斯平滑會給每個特徵計數加上一個小的 `alpha`（通常是 1）：

```
P(word_i | class) = (count(word_i, class) + alpha) / (total_words_in_class + alpha * vocab_size)
```

alpha=1 時，每個詞至少有一點點機率。測試郵件裡出現「discombobulate」不再會把垃圾郵件機率清成零。平滑有貝氏解釋：它等同於在詞分布上放一個均勻的狄利克雷先驗（Dirichlet prior）。

alpha 愈高，平滑愈強（分布愈接近均勻）。alpha 愈低，模型愈信任資料。alpha 是你要調校的超參數（hyperparameter）。

alpha 的效果：

| Alpha | 效果 | 何時使用 |
|-------|--------|-------------|
| 0.001 | 幾乎不平滑，信任資料 | 訓練集非常大，預期不會有沒見過的特徵 |
| 0.1 | 輕度平滑 | 大型訓練集 |
| 1.0 | 標準拉普拉斯平滑 | 預設（default）起點 |
| 10.0 | 重度平滑，把分布壓平 | 訓練集非常小，預期有很多沒見過的特徵 |

### 對數空間計算

把數百個小於 1 的機率相乘，會造成浮點數（floating point）下溢位（underflow）。在浮點數裡乘積會變成零，但真實值其實是一個非常小的正數。

解法是在對數空間計算。不要把機率相乘，改把它們的對數相加：

```
log P(class | x1, x2, ..., xn) = log P(class) + sum_i log P(xi | class)
```

這會把預測變成內積（dot product）：

```
log_scores = X @ log_feature_probs.T + log_class_priors
prediction = argmax(log_scores)
```

一次矩陣乘法（matrix multiplication）。這就是單純貝氏預測這麼快的原因——它和單層線性模型是同一種運算。

### 單純貝氏與邏輯斯迴歸

兩者都是文字用的線性分類器。差別在於它們建模的對象。

| 面向 | 單純貝氏 | 邏輯斯迴歸 |
|--------|------------|-------------------|
| 類型 | 生成模型（generative model）——建模 P(X\|Y) | 判別式模型（discriminative model）——建模 P(Y\|X) |
| 訓練 | 計算頻率 | 最佳化（optimization）損失函數（loss function） |
| 小資料 | 較好（強先驗有幫助） | 較差（不足以估計權重） |
| 大資料 | 較差（錯誤假設會傷到它） | 較好（邊界有彈性） |
| 特徵 | 假設獨立 | 能處理相關 |
| 速度 | 單遍、非常快 | 迭代式最佳化 |
| 校準 | 機率較差 | 機率較好 |

經驗法則：先從單純貝氏開始。如果你有足夠的資料，而單純貝氏的表現停滯了，就改用邏輯斯迴歸。

### 分類管線（pipeline）

```mermaid
flowchart LR
    A[原始文字] --> B[切成 token]
    B --> C[建立詞彙表]
    C --> D[計算詞頻]
    D --> E[套用平滑]
    E --> F[計算對數機率]
    F --> G[預測：argmax 給定詞的類別機率]

    style A fill:#f9f,stroke:#333
    style G fill:#9f9,stroke:#333
```

實務上我們在對數空間計算，以避免浮點下溢位。不要把很多很小的機率相乘，改把它們的對數相加：

```
log P(class | features) = log P(class) + sum_i log P(feature_i | class)
```

```figure
naive-bayes
```

## Build It｜動手實作

`code/naive_bayes.py` 裡的程式碼從頭實作了 MultinomialNB 與 GaussianNB。

### MultinomialNB

從頭實作的內容：

1. **fit(X, y)：** 對每個類別計算各特徵的頻率。加上拉普拉斯平滑。計算對數機率（log probability）。儲存類別先驗（class prior）（類別頻率的對數）。

2. **predict_log_proba(X)：** 對每個樣本、每個類別，計算 log P(class) 加上所有 log P(feature_i | class) 的和。這是一次矩陣乘法（matrix multiplication）：X @ log_probs.T + log_priors。

3. **predict(X)：** 回傳對數機率最高的類別。

```python
class MultinomialNB:
    def __init__(self, alpha=1.0):
        self.alpha = alpha

    def fit(self, X, y):
        classes = np.unique(y)
        n_classes = len(classes)
        n_features = X.shape[1]

        self.classes_ = classes
        self.class_log_prior_ = np.zeros(n_classes)
        self.feature_log_prob_ = np.zeros((n_classes, n_features))

        for i, c in enumerate(classes):
            X_c = X[y == c]
            self.class_log_prior_[i] = np.log(X_c.shape[0] / X.shape[0])
            counts = X_c.sum(axis=0) + self.alpha
            self.feature_log_prob_[i] = np.log(counts / counts.sum())

        return self
```

關鍵洞見：擬合之後，預測只是矩陣乘法（matrix multiplication）再加上一個偏置（bias）。這就是單純貝氏這麼快的原因。

### GaussianNB

對連續特徵，我們估計每個類別、每個特徵的平均數與變異數：

```python
class GaussianNB:
    def __init__(self):
        pass

    def fit(self, X, y):
        classes = np.unique(y)
        self.classes_ = classes
        self.means_ = np.zeros((len(classes), X.shape[1]))
        self.vars_ = np.zeros((len(classes), X.shape[1]))
        self.priors_ = np.zeros(len(classes))

        for i, c in enumerate(classes):
            X_c = X[y == c]
            self.means_[i] = X_c.mean(axis=0)
            self.vars_[i] = X_c.var(axis=0) + 1e-9
            self.priors_[i] = X_c.shape[0] / X.shape[0]

        return self
```

預測時對每個特徵使用高斯機率密度，再跨特徵相乘（在對數空間裡則是相加）。

### 示範：文字分類

程式碼產生合成的詞袋資料，模擬兩個類別（科技文章對運動文章）。每個類別有不同的詞頻分布。MultinomialNB 用詞數來分類。

合成資料是這樣運作的：我們建立 200 個「詞」（特徵欄）。詞 0–39 在科技文章裡頻率高、在運動文章裡頻率低。詞 80–119 在運動文章裡頻率高、在科技文章裡頻率低。詞 40–79 在兩邊都是中等頻率。這製造出一個接近真實的情境：有些詞是很強的類別指標，有些只是雜訊。

### 示範：連續特徵

程式碼產生類似鳶尾花的資料（3 個類別、4 個特徵、高斯叢集）。GaussianNB 用每個類別的平均數與變異數來分類。每個類別有不同的中心（平均數向量）和不同的散佈（變異數），模仿真實世界裡各類別的量測值會系統性不同的資料。

程式碼也示範了：
- **平滑比較：** 用不同的 alpha 訓練 MultinomialNB，顯示平滑強度對準確率（accuracy）的影響。
- **訓練集大小實驗：** 訓練資料從 20 筆成長到 1600 筆時，單純貝氏的準確率如何上升。就算樣本非常少，它也能達到還可以的準確率——這是它的主要優勢。
- **混淆矩陣（confusion matrix）：** 用每個類別的精確率（precision）、召回率（recall）與 F1 分數，看出單純貝氏錯在哪裡。

### 預測速度

單純貝氏的預測是一次矩陣乘法（matrix multiplication）。對 n 個樣本、d 個特徵、k 個類別：
- MultinomialNB：一次矩陣乘法（matrix multiplication） (n x d) @ (d x k) = O(n * d * k)
- GaussianNB：n * k 次高斯機率密度計算，每次涵蓋 d 個特徵 = O(n * d * k)

兩者在每個維度上都是線性的。對比必須對所有訓練點算距離的 k 最近鄰法，或必須對所有支援向量（support vector）計算核函數（kernel function）的 RBF 核 SVM，單純貝氏在預測時快上好幾個數量級。

## Use It｜實際應用

用 sklearn 時，兩種變體都是一行就能建立：

```python
from sklearn.naive_bayes import GaussianNB, MultinomialNB

gnb = GaussianNB()
gnb.fit(X_train, y_train)
print(f"GaussianNB accuracy: {gnb.score(X_test, y_test):.3f}")

mnb = MultinomialNB(alpha=1.0)
mnb.fit(X_train_counts, y_train)
print(f"MultinomialNB accuracy: {mnb.score(X_test_counts, y_test):.3f}")
```

用 sklearn 做文字分類：

```python
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline

text_clf = Pipeline([
    ("vectorizer", CountVectorizer()),
    ("classifier", MultinomialNB(alpha=1.0)),
])

text_clf.fit(train_texts, train_labels)
accuracy = text_clf.score(test_texts, test_labels)
```

`naive_bayes.py` 裡的程式碼會在同一份資料上，把從頭實作的版本和 sklearn 比較，以驗證正確性。

### TF-IDF 與單純貝氏

原始詞數讓每個詞的每一次出現權重都一樣。但「the」和「is」這類常見詞在每個類別裡都常出現——它們沒有資訊。TF-IDF 會降低常見詞的權重，提高罕見且有區辨力的詞的權重。

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline

text_clf = Pipeline([
    ("tfidf", TfidfVectorizer()),
    ("classifier", MultinomialNB(alpha=0.1)),
])
```

TF-IDF 的值是非負的，所以可以搭配 MultinomialNB。TF-IDF 加上 MultinomialNB 是文字分類最強的基準之一。在訓練樣本少於 10,000 筆的資料集（dataset）上，它常常勝過更複雜的模型。

### 短文字用 BernoulliNB

對短文字（推文、簡訊、聊天訊息），BernoulliNB 可以勝過 MultinomialNB。短文字的詞數很低，所以 MultinomialNB 依賴的頻率資訊雜訊較大。BernoulliNB 只在乎出現或未出現，在短文字上更可靠。

```python
from sklearn.naive_bayes import BernoulliNB
from sklearn.feature_extraction.text import CountVectorizer

text_clf = Pipeline([
    ("vectorizer", CountVectorizer(binary=True)),
    ("classifier", BernoulliNB(alpha=1.0)),
])
```

CountVectorizer 的 `binary=True` 旗標會把所有計數轉成 0/1。沒有這個旗標，BernoulliNB 仍然能跑，但這些計數並非 BernoulliNB 設計來處理的輸入。

### 校準單純貝氏的機率

單純貝氏的機率校準得很差。當它說 P(spam) = 0.95 時，真實機率可能是 0.7。如果你需要可靠的機率估計（例如要設閾值（threshold），或要和其他模型組合），就用 sklearn 的 CalibratedClassifierCV：

```python
from sklearn.calibration import CalibratedClassifierCV

calibrated_nb = CalibratedClassifierCV(MultinomialNB(), cv=5, method="sigmoid")
calibrated_nb.fit(X_train, y_train)
proba = calibrated_nb.predict_proba(X_test)
```

這會用交叉驗證（cross-validation），在單純貝氏的原始分數上再擬合一個邏輯斯迴歸。得到的機率會更接近真實的類別頻率。

### 常見陷阱

1. **負的特徵值。** MultinomialNB 要求特徵非負。如果你有負值（例如某些設定下的 TF-IDF，或標準化（standardization）後的特徵），改用 GaussianNB，或把特徵平移成正數。

2. **變異數為零的特徵。** GaussianNB 會除以變異數。如果某個特徵在某個類別的變異數是零（所有值都相同），機率計算就會壞掉。程式碼會給所有變異數加上一個小的平滑項（1e-9）來避免這件事。

3. **類別不平衡（class imbalance）。** 如果 99% 的郵件都不是垃圾郵件，先驗 P(not-spam) = 0.99 會強到壓過概似證據。你可以手動設定類別先驗，或使用 sklearn 的 class_prior 參數。

4. **特徵縮放（feature scaling）。** MultinomialNB 不需要縮放（它處理的是計數）。GaussianNB 也不需要縮放（它估計的是每個特徵自己的統計量）。這是相對邏輯斯迴歸和 SVM 的優勢，後兩者對特徵尺度很敏感。

## Ship It｜交付成果

本課會產出：
- `outputs/skill-naive-bayes-chooser.md`——一份用來挑選正確單純貝氏變體的決策 skill
- `code/naive_bayes.py`——從頭實作的 MultinomialNB 與 GaussianNB，並與 sklearn 比較

### 單純貝氏何時會失敗

單純貝氏失敗，是在獨立性假設造成錯誤排名的時候（不只是機率不正確）。這會發生在：

1. **強烈的特徵交互作用。** 如果類別取決於兩個特徵的組合，而不是其中任何一個單獨出現（類似 XOR 的模式），單純貝氏會完全漏掉。每個特徵單獨都沒有證據，而單純貝氏不能以非線性方式把它們組合起來。

2. **高度相關、但證據方向相反的特徵。** 如果特徵 A 說「垃圾郵件」、特徵 B 說「非垃圾郵件」，但 A 和 B 完全相關（現實中它們總是一致），單純貝氏會看到其實並不存在的衝突證據。

3. **非常大的訓練集。** 資料夠多時，邏輯斯迴歸這類判別式模型會學到真正的決策邊界，並勝過單純貝氏。在小資料上有幫助的獨立性假設，這時反而拖住模型。

實務上，這些失敗模式在文字分類裡很少見。文字特徵又多又各自很弱，獨立性假設造成的誤差傾向互相抵消。對特徵少、又強烈相關的表格資料，請先考慮邏輯斯迴歸或樹模型（tree-based model）。

## Exercises｜練習

1. **平滑實驗。** 用 alpha 為 0.01、0.1、1.0、10.0 與 100.0 的 MultinomialNB 在文字資料上訓練。畫出準確率對 alpha 的圖。表現在哪裡達到高峰？為什麼非常高的 alpha 會傷到表現？

2. **特徵獨立性測試。** 拿一個真實文字資料集。選兩個明顯相關的詞（「machine」和「learning」）。計算 P(word1 | class) * P(word2 | class)，並和 P(word1 AND word2 | class) 比較。獨立性假設錯了多少？它會影響分類準確率嗎？

3. **伯努利實作。** 在程式碼裡加上一個 BernoulliNB 類別。把詞袋轉成二元（出現／未出現），並在文字資料上和 MultinomialNB 比較準確率。伯努利什麼時候會贏？

4. **單純貝氏對邏輯斯迴歸。** 兩者都在文字資料上訓練。從 100 筆訓練樣本開始，增加到 10,000 筆。畫出兩者的準確率對訓練集大小。邏輯斯迴歸在哪個點超過單純貝氏？

5. **垃圾郵件篩選器（spam filter）。** 打造一個完整的垃圾郵件分類器：把原始郵件文字切成 token、建立詞彙表、建立詞袋特徵、訓練 MultinomialNB，並用精確率與召回率評估（不只看準確率——為什麼？）。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|----------------------|
| 單純貝氏 | 「簡單的機率分類器」 | 套用貝氏定理，並假設給定類別後特徵條件獨立的分類器 |
| 條件獨立 | 「特徵彼此不影響」 | P(A, B \| C) = P(A \| C) * P(B \| C)——一旦知道 C，知道 B 不會再告訴你任何關於 A 的新資訊 |
| 拉普拉斯平滑 | 「加一平滑」 | 給每個特徵加上一個小計數，避免零機率主導預測 |
| 先驗 | 「看到資料之前你相信的事」 | P(class)——觀察任何特徵之前，每個類別的機率 |
| 概似 | 「資料配得多好」 | P(features \| class)——已知類別時，觀察到這些特徵的機率 |
| 後驗 | 「看到資料之後你相信的事」 | P(class \| features)——觀察特徵之後，類別被更新過的機率 |
| 生成模型 | 「建模資料是怎麼產生的」 | 學習 P(X \| Y) 與 P(Y)，再用貝氏定理得到 P(Y \| X) 的模型 |
| 判別式模型 | 「建模決策邊界」 | 直接學習 P(Y \| X)，不建模 X 如何生成的模型 |
| 對數機率 | 「避免下溢位」 | 用 log P 而不是 P，避免很多小數相乘後在浮點數裡變成零 |

## Further Reading｜延伸閱讀

- [scikit-learn Naive Bayes docs](https://scikit-learn.org/stable/modules/naive_bayes.html)——三種變體與數學細節
- [McCallum and Nigam, A Comparison of Event Models for Naive Bayes Text Classification (1998)](https://www.cs.cmu.edu/~knigam/papers/multinomial-aaaiws98.pdf)——多項與伯努利用於文字的經典比較
- [Rennie et al., Tackling the Poor Assumptions of Naive Bayes Text Classifiers (2003)](https://people.csail.mit.edu/jrennie/papers/icml03-nb.pdf)——改進文字單純貝氏的方法
- [Ng and Jordan, On Discriminative vs. Generative Classifiers (2001)](https://ai.stanford.edu/~ang/papers/nips01-discriminativegenerative.pdf)——證明資料較少時單純貝氏比邏輯斯迴歸更快收斂
