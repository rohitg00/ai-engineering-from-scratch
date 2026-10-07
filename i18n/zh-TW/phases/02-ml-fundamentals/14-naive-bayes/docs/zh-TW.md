# 樸素貝氏（Naive Bayes）

> 「樸素」假設明明不成立，模型卻照樣有效。這正是它迷人的地方。

**Type:** Build
**Language:** Python
**Prerequisites:** Phase 2, Lessons 01-07 (classification, Bayes' theorem)
**Time:** ~75 minutes

## 學習目標

- 從頭實作搭配 Laplace 平滑的 Multinomial Naive Bayes，用於文字分類
- 說明為什麼樸素獨立假設在數學上不正確，實務上卻能正確排列類別
- 比較 Multinomial、Bernoulli 與 Gaussian Naive Bayes，並依特徵類型選擇合適的變體
- 在高維稀疏資料上比較 Naive Bayes 與邏輯迴歸，並說明其中的偏差－變異取捨

## 問題

你需要替文字分類，例如將電子郵件分成垃圾郵件或非垃圾郵件、將顧客評論分成正面或負面，或將客服案件分到不同類別。這類任務可能有數千個特徵（每個詞一個），但訓練資料有限。

多數分類器在這種情況下都很吃力。邏輯迴歸需要足夠的樣本，才能可靠地估計數千個權重。決策樹一次只依一個詞切分，很容易嚴重過度擬合。在 10,000 維空間中，KNN 也失去意義，因為每個點到其他點的距離都差不多。

Naive Bayes 能處理這類問題。它採用一個數學上不正確的假設：給定類別後，各個特徵彼此獨立。即使如此，它在文字分類上的表現仍常勝過「更聰明」的模型，尤其是訓練集較小時。它只需掃描資料一次即可訓練，可擴展到數百萬個特徵，也能估計機率（但獨立假設常使機率校準不佳）。

理解錯誤的假設為什麼仍能帶來良好預測，可以讓我們看見機器學習的一項基本原理：最好的模型未必是最正確的模型，而是最符合手上資料之偏差－變異取捨的模型。

## 核心概念

### 貝氏定理（快速複習）

貝氏定理可以反轉條件機率：

```text
P(class | features) = P(features | class) * P(class) / P(features)
```

我們要估計的是 `P(class | features)`，也就是給定文件中的詞之後，該文件屬於某個類別的機率。可以從下列項目計算：
- `P(features | class)`：該類別文件中出現這些詞的可能性
- `P(class)`：該類別的先驗機率（例如垃圾郵件通常有多常見？）
- `P(features)`：證據項；所有類別的值都相同，因此比較類別時可以忽略

`P(class | features)` 最高的類別就是預測結果。

### 樸素獨立假設

若要精確計算 `P(features | class)`，就必須估計所有特徵的聯合機率。假設詞彙表有 10,000 個詞，就得估計涵蓋 `2^10,000` 種可能組合的分布，根本不可行。

樸素假設是：給定類別後，每個特徵都條件獨立。

```text
P(w1, w2, ..., wn | class) = P(w1 | class) * P(w2 | class) * ... * P(wn | class)
```

如此一來，就不必估計一個不可能處理的聯合分布，而是分別估計 n 個簡單的特徵分布。每個分布只需要計數。

這個假設顯然不成立。任何文件裡的「machine」和「learning」都不會彼此獨立。但分類器不需要精準的機率估計，只需要正確排序，也就是找出機率最高的類別。獨立假設會帶來系統性誤差，但這些誤差對各個類別的影響相近，因此排序仍可能正確。

### 為什麼仍然有效

原因有三個：

1. **排序比校準重要。** 分類只需要排在最前面的類別正確。即使實際機率是 0.7，模型估計 `P(spam) = 0.99999`，只要仍正確選出垃圾郵件即可。我們不需要精準機率，只需要選對類別。

2. **高偏差、低變異。** 獨立假設是一項很強的先驗限制，會大幅約束模型，避免過度擬合。訓練資料有限時，稍有錯誤但穩定的模型，勝過理論上正確卻極不穩定的模型。這就是偏差－變異取捨的實際作用。

3. **特徵冗餘會互相抵銷。** 相關特徵提供重複的證據。分類器會重複計算這些證據，但也會對正確類別重複計算。假如「machine」和「learning」總是一起出現，兩者都能支持「tech」類別。Naive Bayes 會把證據計算兩次，但計算兩次的仍是正確方向。

還有一個實務上的原因：Naive Bayes 非常快。訓練時只要掃描資料一次並統計頻率；預測時只需做矩陣乘法。幾秒內就能用數百萬份文件訓練。這種速度讓你能更快迭代、嘗試更多特徵組合，並比使用較慢模型時執行更多實驗。

### 數學推導步驟

我們用一個具體例子逐步推算。假設有兩個類別：垃圾郵件與非垃圾郵件。詞彙表有三個詞：「free」、「money」和「meeting」。

訓練資料：
- 垃圾郵件中「free」出現 80 次、「money」出現 60 次、「meeting」出現 10 次（總計 150 個詞）
- 非垃圾郵件中「free」出現 5 次、「money」出現 10 次、「meeting」出現 100 次（總計 115 個詞）
- 40% 的電子郵件是垃圾郵件，60% 是非垃圾郵件

使用 Laplace 平滑（alpha=1）：

```text
P(free | spam)    = (80 + 1) / (150 + 3) = 81/153 = 0.529
P(money | spam)   = (60 + 1) / (150 + 3) = 61/153 = 0.399
P(meeting | spam) = (10 + 1) / (150 + 3) = 11/153 = 0.072

P(free | not-spam)    = (5 + 1) / (115 + 3) = 6/118 = 0.051
P(money | not-spam)   = (10 + 1) / (115 + 3) = 11/118 = 0.093
P(meeting | not-spam) = (100 + 1) / (115 + 3) = 101/118 = 0.856
```

新郵件包含：「free」2 次、「money」1 次、「meeting」0 次。

```text
log P(spam | email) = log(0.4) + 2*log(0.529) + 1*log(0.399) + 0*log(0.072)
                    = -0.916 + 2*(-0.637) + (-0.919) + 0
                    = -3.109

log P(not-spam | email) = log(0.6) + 2*log(0.051) + 1*log(0.093) + 0*log(0.856)
                        = -0.511 + 2*(-2.976) + (-2.375) + 0
                        = -8.838
```

垃圾郵件的分數明顯較高。「free」出現兩次，是支持垃圾郵件的強烈證據。注意，「meeting」沒有出現，因此它在兩個對數加總中都貢獻 0（`0 * log(P)`）。在 Multinomial NB 中，未出現的詞不會產生影響；Bernoulli NB 才會明確建模詞語是否缺席。

### 三種變體

Naive Bayes 有三種形式，各自以不同方式建模 `P(feature | class)`。

#### Multinomial Naive Bayes（多項式樸素貝氏）

將每個特徵視為計數。適合特徵為詞頻或 TF-IDF 值的文字資料。

```text
P(word_i | class) = (count of word_i in class + alpha) / (total words in class + alpha * vocab_size)
```

`alpha` 是 Laplace 平滑參數（稍後會說明）。這是文字分類最常用的變體。

#### Gaussian Naive Bayes（高斯樸素貝氏）

將每個特徵建模為常態分布，適合連續特徵。

```text
P(x_i | class) = (1 / sqrt(2 * pi * var)) * exp(-(x_i - mean)^2 / (2 * var))
```

每個類別的每個特徵都有各自的平均值和變異數。若特徵在各類別中的分布確實近似鐘形曲線，這種方法就很有效。

#### Bernoulli Naive Bayes（伯努利樸素貝氏）

將每個特徵視為二元值（存在或不存在）。適合短文字或二元特徵向量。

```text
P(word_i | class) = (docs in class containing word_i + alpha) / (total docs in class + 2 * alpha)
```

和 Multinomial 不同，Bernoulli 會明確計入詞語缺席的情況。如果「free」通常會出現在垃圾郵件中，但這封郵件沒有出現，就會成為反對垃圾郵件類別的證據。

### 各變體的適用情境

| 變體 | 特徵類型 | 適用情境 | 範例 |
|---------|-------------|----------|---------|
| Multinomial | 計數或頻率 | 文字分類、詞袋 | 垃圾郵件、主題分類 |
| Gaussian | 連續值 | 特徵近似常態分布的表格資料 | Iris 分類、感測器資料 |
| Bernoulli | 二元值（0/1） | 短文字、二元特徵向量 | SMS 垃圾訊息、特徵存在與否 |

### Laplace 平滑

如果測試資料出現一個訓練資料中從未在某個類別出現過的詞，會發生什麼事？

沒有平滑時：`P(word | class) = 0/N = 0`。整個機率乘積只要乘上一個 0，`P(class | features)` 就會變成 0，不論其他證據多有力。單一未見過的詞就會毀掉整個預測。

Laplace 平滑會在每個特徵的計數上加上一個小值 `alpha`（通常為 1）：

```text
P(word_i | class) = (count(word_i, class) + alpha) / (total_words_in_class + alpha * vocab_size)
```

當 alpha=1 時，每個詞至少會有一個極小的機率。測試郵件中即使出現「discombobulate」，也不會讓垃圾郵件的機率歸零。從貝氏觀點來看，平滑相當於對詞語分布加上均勻的 Dirichlet 先驗。

alpha 越大，平滑越強，分布也越平均；alpha 越小，模型越相信資料本身。alpha 是需要調校的超參數。

alpha 的影響：

| Alpha | 效果 | 適用情境 |
|-------|--------|-------------|
| 0.001 | 幾乎不平滑，相信資料 | 訓練集很大，預期不會遇到未見特徵 |
| 0.1 | 輕度平滑 | 訓練集大 |
| 1.0 | 標準 Laplace 平滑 | 建議的預設起點 |
| 10.0 | 強力平滑，使分布趨於平均 | 訓練集很小，預期會遇到許多未見特徵 |

### 對數空間計算

相乘數百個小於 1 的機率會造成浮點數下溢。即使實際結果是很小的正數，浮點運算仍可能將乘積算成 0。

解法是在對數空間中計算：不再相乘機率，而是將它們的對數相加：

```text
log P(class | x1, x2, ..., xn) = log P(class) + sum_i log P(xi | class)
```

這會把預測化為點積：

```python
log_scores = X @ log_feature_probs.T + log_class_priors
prediction = argmax(log_scores)
```

這就是矩陣乘法。Naive Bayes 的預測之所以很快，是因為它和單層線性模型做的是同一種運算。

### Naive Bayes 與邏輯迴歸

兩者都是用於文字的線性分類器，差別在於它們建模的對象不同。

| 比較面向 | Naive Bayes | 邏輯迴歸 |
|--------|------------|-------------------|
| 類型 | 生成式（建模 `P(X\|Y)`） | 判別式（建模 `P(Y\|X)`） |
| 訓練方式 | 統計頻率 | 最佳化損失函式 |
| 小型資料集 | 較佳（強先驗有幫助） | 較差（不足以估計權重） |
| 大型資料集 | 較差（錯誤假設造成影響） | 較佳（決策邊界較有彈性） |
| 特徵 | 假設彼此獨立 | 能處理相關性 |
| 速度 | 掃描一次，速度快 | 反覆最佳化 |
| 機率校準 | 機率估計較差 | 機率估計較佳 |

經驗法則：先從 Naive Bayes 開始。如果資料量足夠但模型表現停滯，再改用邏輯迴歸。

### 分類流程

```mermaid
flowchart LR
    A[原始文字] --> B[斷詞]
    B --> C[建立詞彙表]
    C --> D[統計詞頻]
    D --> E[套用平滑]
    E --> F[計算對數機率]
    F --> G[預測：找出給定詞語時機率最高的類別]

    style A fill:#f9f,stroke:#333
    style G fill:#9f9,stroke:#333
```

實務上，我們會在對數空間中計算，以避免浮點數下溢。不把許多很小的機率相乘，而是將其對數相加：

```text
log P(class | features) = log P(class) + sum_i log P(feature_i | class)
```

```figure
naive-bayes
```

## Build It：動手實作

本課程的程式碼會在 `code/naive_bayes.py` 中從頭實作 MultinomialNB 和 GaussianNB。

### MultinomialNB

從頭實作的步驟如下：

1. **`fit(X, y)`：** 對每個類別統計各特徵的頻率、加入 Laplace 平滑、計算對數機率，並儲存類別先驗（類別頻率的對數）。

2. **`predict_log_proba(X)`：** 對所有類別和每筆樣本，計算 `log P(class) + sum of log P(feature_i | class)`。這就是矩陣乘法：`X @ log_probs.T + log_priors`。

3. **`predict(X)`：** 回傳對數機率最高的類別。

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

關鍵在於：模型擬合完成後，預測只需做矩陣乘法再加上偏置項，因此 Naive Bayes 能非常快速地完成預測。

### GaussianNB

對於連續特徵，我們會針對每個類別及每個特徵估計平均值和變異數：

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

預測時，會逐一計算每個特徵的 Gaussian PDF，再將各特徵的結果相乘（在對數空間中則是相加）。

### 示範：文字分類

程式碼會產生模擬兩種類別（科技文章與體育文章）的合成詞袋資料。每個類別的詞頻分布不同，MultinomialNB 會根據詞數進行分類。

合成資料的設計方式如下：我們建立 200 個「詞」（特徵欄）。第 0–39 個詞在科技文章中頻率高、在體育文章中頻率低；第 80–119 個詞則相反；第 40–79 個詞在兩類文章中的頻率都中等。這會模擬部分詞能明確代表類別、其他詞則是雜訊的情境。

### 示範：連續特徵

程式碼會產生類似 Iris 的資料（3 個類別、4 個特徵和常態分布群集）。GaussianNB 會根據各類別的平均值和變異數進行分類。每個類別都有不同的中心（平均向量）與分散程度（變異數），模擬測量值會隨類別系統性變化的真實情境。

程式碼也會示範：
- **平滑比較：** 使用不同 alpha 值訓練 MultinomialNB，觀察平滑強度如何影響準確率。
- **訓練資料量實驗：** 觀察訓練資料從 20 筆增加到 1,600 筆時，NB 的準確率如何提升。NB 即使用很少資料也能達到不錯的準確率，這是它的主要優勢。
- **混淆矩陣：** 查看各類別的 Precision、Recall 和 F1 分數，了解 NB 會在哪些情況下出錯。

### 預測速度

Naive Bayes 的預測就是矩陣乘法。若有 n 筆樣本、d 個特徵和 k 個類別：
- MultinomialNB：一次矩陣乘法 `(n × d) @ (d × k)`，複雜度為 `O(n * d * k)`
- GaussianNB：計算 `n × k` 個 Gaussian PDF，每次計算涵蓋 d 個特徵，複雜度為 `O(n * d * k)`

兩者的計算量都隨每個維度呈線性增加。相較之下，KNN 必須計算與所有訓練資料的距離，使用 RBF 核的 SVM 則必須計算與所有支援向量的核值。NB 的預測速度快上好幾個數量級。

## Use It：套用現成工具

在 sklearn 中，兩種變體都能用一行設定完成：

```python
from sklearn.naive_bayes import GaussianNB, MultinomialNB

gnb = GaussianNB()
gnb.fit(X_train, y_train)
print(f"GaussianNB accuracy: {gnb.score(X_test, y_test):.3f}")

mnb = MultinomialNB(alpha=1.0)
mnb.fit(X_train_counts, y_train)
print(f"MultinomialNB accuracy: {mnb.score(X_test_counts, y_test):.3f}")
```

使用 sklearn 進行文字分類：

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

`naive_bayes.py` 會在相同資料上比較從頭實作與 sklearn，確認實作結果正確。

### 使用 Naive Bayes 搭配 TF-IDF

原始詞數會讓每個詞的每次出現都具有相同權重。但「the」和「is」等常見詞會出現在所有類別中，幾乎不提供資訊。TF-IDF（Term Frequency－Inverse Document Frequency，詞頻－逆向文件頻率）會降低常見詞的權重，並提高少見且有區別力的詞之權重。

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline

text_clf = Pipeline([
    ("tfidf", TfidfVectorizer()),
    ("classifier", MultinomialNB(alpha=0.1)),
])
```

TF-IDF 值皆為非負數，因此可搭配 MultinomialNB。TF-IDF 加上 MultinomialNB 是文字分類中效果最好的基準方法之一，在訓練樣本少於 10,000 筆的資料集上，表現常優於更複雜的模型。

### 短文字使用 BernoulliNB

對推文、SMS 或聊天訊息等短文字，BernoulliNB 的表現可能優於 MultinomialNB。短文字的詞數較少，因此 MultinomialNB 仰賴的詞頻資訊較不可靠。BernoulliNB 只看詞語是否出現，對短文字來說通常更穩定。

```python
from sklearn.naive_bayes import BernoulliNB
from sklearn.feature_extraction.text import CountVectorizer

text_clf = Pipeline([
    ("vectorizer", CountVectorizer(binary=True)),
    ("classifier", BernoulliNB(alpha=1.0)),
])
```

`CountVectorizer` 的 `binary=True` 旗標會將所有計數轉成 0 或 1。如果沒有設定，BernoulliNB 仍可運作，但輸入的計數並非它原本設計要處理的形式。

### 校準 Naive Bayes 的機率

Naive Bayes 的機率校準通常不佳。當模型估計 `P(spam) = 0.95` 時，實際機率可能只有 0.7。如果你需要可靠的機率估計（例如用來設定閾值或與其他模型組合），可以使用 sklearn 的 CalibratedClassifierCV：

```python
from sklearn.calibration import CalibratedClassifierCV

calibrated_nb = CalibratedClassifierCV(MultinomialNB(), cv=5, method="sigmoid")
calibrated_nb.fit(X_train, y_train)
proba = calibrated_nb.predict_proba(X_test)
```

它會透過交叉驗證，在 NB 的原始分數上擬合邏輯迴歸。產生的機率會更接近類別的實際出現頻率。

### 常見注意事項

1. **特徵值為負數。** MultinomialNB 要求特徵值非負。如果資料中有負值（例如某些設定下的 TF-IDF 或標準化特徵），請改用 GaussianNB，或將特徵平移為正值。

2. **特徵變異數為零。** GaussianNB 會除以變異數。如果某個類別中的特徵變異數為零（所有值都相同），機率計算就會出錯。程式碼會在所有變異數上加上很小的平滑值（1e-9），避免這個問題。

3. **類別不平衡。** 如果 99% 的電子郵件都不是垃圾郵件，非垃圾郵件的先驗機率 `P(not-spam) = 0.99` 就會強到蓋過可能性證據。你可以手動指定類別先驗，或在 sklearn 中使用 `class_prior` 參數。

4. **特徵縮放。** MultinomialNB 不需要縮放（它使用計數）。GaussianNB 也不需要縮放（它會估計各特徵的統計量）。這是它相較於容易受特徵尺度影響的邏輯迴歸和 SVM 的優勢。

## Ship It：交付成果

本課程會產出：
- `outputs/skill-naive-bayes-chooser.md`：用來挑選合適 NB 變體的決策技能
- `code/naive_bayes.py`：從頭實作 MultinomialNB 與 GaussianNB，並和 sklearn 比較

### Naive Bayes 何時會失效

當獨立假設導致類別排序錯誤（而不只是機率估計不準）時，NB 就會失效。以下情況可能發生：

1. **特徵之間有強烈交互作用。** 如果類別取決於兩個特徵的組合，而不是其中任何一個特徵本身（例如 XOR 模式），NB 就無法捕捉。單獨看每個特徵都沒有證據，NB 也無法把它們非線性地組合起來。

2. **高度相關的特徵提供相反證據。** 假如特徵 A 表示「垃圾郵件」、特徵 B 表示「非垃圾郵件」，但 A 和 B 在實際資料中完全相關（總是一起出現），NB 就會把它們視為互相矛盾的證據。

3. **訓練資料非常多。** 資料足夠時，邏輯迴歸等判別式模型能學到真正的決策邊界，表現超越 NB。小資料時有幫助的獨立假設，這時反而限制了模型。

實務上，文字分類很少遇到這些失效情況。文字特徵很多、個別影響微弱，獨立假設造成的誤差通常會互相抵銷。若是特徵不多且彼此高度相關的表格資料，建議先考慮邏輯迴歸或樹模型。

## Exercises：練習

1. **平滑實驗。** 使用 alpha 為 0.01、0.1、1.0、10.0 和 100 的值，訓練文字資料的 MultinomialNB。繪製準確率與 alpha 的關係圖。效能在哪裡達到高峰？為什麼 alpha 非常大時表現會變差？

2. **特徵獨立性測試。** 取一份真實文字資料集，挑選兩個明顯相關的詞（例如「machine」和「learning」）。計算 `P(word1 | class) * P(word2 | class)`，並與 `P(word1 AND word2 | class)` 比較。獨立假設造成多大的誤差？會影響分類準確率嗎？

3. **實作 Bernoulli。** 在程式碼中新增 BernoulliNB 類別。將詞袋轉成二元值（出現／未出現），再與 MultinomialNB 比較文字資料上的準確率。什麼情況下 Bernoulli 的表現較好？

4. **比較 NB 與邏輯迴歸。** 在文字資料上訓練兩種模型。從 100 筆訓練樣本開始，逐步增加到 10,000 筆。繪製兩者的準確率與訓練集大小之關係圖。邏輯迴歸會在什麼時候超越 Naive Bayes？

5. **垃圾郵件過濾器。** 建立完整的垃圾郵件分類器：將原始電子郵件文字斷詞、建立詞彙表、產生詞袋特徵、訓練 MultinomialNB，並以 Precision 和 Recall 評估（為什麼不能只看準確率？）。

## 關鍵詞

| 術語 | 常見說法 | 實際意義 |
|------|----------------|----------------------|
| Naive Bayes | 「簡單的機率分類器」 | 套用貝氏定理，並假設給定類別後特徵條件獨立的分類器 |
| Conditional independence | 「特徵彼此不影響」 | `P(A, B \| C) = P(A \| C) * P(B \| C)`；已知 C 後，知道 B 不會再提供 A 的額外資訊 |
| Laplace smoothing | 「加一平滑」 | 在每個特徵的計數上加上一個小值，避免零機率主導預測 |
| Prior | 「觀察資料前的信念」 | `P(class)`，觀察任何特徵之前，各類別的機率 |
| Likelihood | 「資料符合的程度」 | `P(features \| class)`，已知類別時觀察到這些特徵的機率 |
| Posterior | 「觀察資料後的信念」 | `P(class \| features)`，觀察特徵後更新的類別機率 |
| Generative model | 「描述資料如何生成」 | 學習 `P(X \| Y)` 和 `P(Y)`，再以貝氏定理求出 `P(Y \| X)` 的模型 |
| Discriminative model | 「描述決策邊界」 | 直接學習 `P(Y \| X)`，不建模 X 如何生成的模型 |
| Log probability | 「避免下溢」 | 使用 `log P` 而非 P 計算，避免許多小數相乘後在浮點運算中變成 0 |

## 延伸閱讀

- [scikit-learn Naive Bayes 文件](https://scikit-learn.org/stable/modules/naive_bayes.html)：介紹三種變體與數學細節
- [McCallum 和 Nigam，Naive Bayes 文字分類事件模型比較（1998）](https://www.cs.cmu.edu/~knigam/papers/multinomial-aaaiws98.pdf)：比較文字分類中 Multinomial 與 Bernoulli 的經典研究
- [Rennie 等人，改善 Naive Bayes 文字分類器的假設問題（2003）](https://people.csail.mit.edu/jrennie/papers/icml03-nb.pdf)：探討文字分類中 Naive Bayes 的改良方法
- [Ng 和 Jordan，判別式分類器與生成式分類器的比較（2001）](https://ai.stanford.edu/~ang/papers/nips01-discriminativegenerative.pdf)：證明資料較少時，NB 比 LR 更快收斂
