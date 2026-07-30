# 單純貝氏

> 「單純」這個假設是錯的，但它照樣管用。這正是它迷人的地方。

**類型：** 實作
**程式語言：** Python
**先修單元：** 階段 2 · 單元 01-07（分類、貝氏定理）
**時間：** 約 75 分鐘

## 學習目標

- 從零實作多項式單純貝氏，加上拉普拉斯平滑，用於文本分類
- 說明單純獨立假設在數學上為什麼是錯的，卻能在實務上排出正確的類別順序
- 比較多項式、伯努利與高斯單純貝氏三種變體，並針對給定的特徵型態挑出對的那一個
- 在高維稀疏資料上把單純貝氏與邏輯迴歸放在一起評估，並說明背後起作用的偏差－變異權衡

## 問題所在

你需要對文本做分類。把郵件分成垃圾郵件或非垃圾郵件。把顧客評論分成正面或負面。把客服工單分到各個類別。你手上有數千個特徵（一個詞一個），訓練資料卻很有限。

大多數分類器在這裡就卡住了。邏輯迴歸需要足夠多的樣本，才能可靠地估出數千個權重。決策樹一次只針對一個詞做切分，過度擬合到不成樣子。KNN 在 10,000 維裡毫無意義，因為每個點跟其他每個點的距離都一樣遠。

單純貝氏應付得了。它做了一個數學上錯誤的假設（在給定類別的條件下，每個特徵都與其他每個特徵獨立），卻依然在文本分類上打敗那些「更聰明」的模型，訓練集小的時候尤其明顯。它只需要掃過資料一次就訓練完成。它可以擴展到數百萬個特徵。它也會產出機率估計（不過因為那個獨立假設，校準通常很差）。

理解一個錯誤的假設為什麼能導向好的預測，會讓你學到機器學習裡某件根本的事：最好的模型不是最正確的那個，而是對你的資料來說偏差－變異權衡最好的那個。

## 核心概念

### 貝氏定理（快速回顧）

貝氏定理把條件機率翻轉過來：

```
P(class | features) = P(features | class) * P(class) / P(features)
```

我們想要的是 `P(class | features)`——在已知文件裡有哪些詞的條件下，這份文件屬於某個類別的機率。我們可以從下面幾項算出它：
- `P(features | class)`——概似，也就是在這個類別的文件裡看到這些詞的機率
- `P(class)`——這個類別的先驗機率（垃圾郵件整體來說有多常見？）
- `P(features)`——證據，對所有類別都一樣，所以在互相比較時可以忽略

`P(class | features)` 最高的那個類別勝出。

### 單純獨立假設

要精確算出 `P(features | class)`，就得估計所有特徵的聯合機率。詞彙表有 10,000 個詞的話，你得估出一個橫跨 2^10,000 種可能組合的分布。不可能。

條件獨立假設是這樣的：在給定類別的條件下，每個特徵都彼此條件獨立。

```
P(w1, w2, ..., wn | class) = P(w1 | class) * P(w2 | class) * ... * P(wn | class)
```

於是你不必去估一個辦不到的聯合分布，只要估 n 個簡單的單特徵分布。每一個都只需要一組計數。

這個假設顯然是錯的。在任何文件裡，「machine」跟「learning」都不會獨立。但分類器並不需要正確的機率估計，它需要的是正確的排序——哪個類別的機率最高。獨立假設會引入系統性的誤差，但這些誤差對所有類別的影響差不多，所以排序仍然是對的。

### 為什麼它照樣管用

三個理由：

1. **排序重於校準。** 分類只需要排在最前面的那個類別是對的。就算真實機率是 0.7 而模型算出 P(spam) = 0.99999，分類器還是會正確地選中垃圾郵件。我們不需要正確的機率，我們需要正確的贏家。

2. **高偏差、低變異。** 獨立假設是一個很強的先驗。它把模型限制得很緊，因而擋住了過度擬合。訓練資料有限時，一個稍微有偏但穩定的模型，會勝過一個理論上正確卻極度不穩定的模型。這就是偏差－變異權衡在起作用。

3. **特徵冗餘會互相抵消。** 相關的特徵提供的是重複的證據。分類器把這些證據重複計算了，但它對正確的類別也一樣重複計算。如果「machine」跟「learning」總是一起出現，兩者都構成「科技」類別的證據。NB 把它們算了兩次，但是為對的那個類別算了兩次。

還有第四個實務上的理由：單純貝氏極快。訓練就是掃過資料一次數頻率。預測就是一次矩陣乘法。你可以在幾秒內用一百萬份文件訓練完。這種速度意味著你可以迭代得更快、試更多組特徵、跑更多實驗，是慢模型辦不到的。

### 一步一步算數學

我們拿一個具體例子走一遍。假設有兩個類別：spam 與 not-spam。詞彙表有三個詞：「free」、「money」、「meeting」。

訓練資料：
- 垃圾郵件裡「free」出現 80 次、「money」60 次、「meeting」10 次（共 150 個詞）
- 非垃圾郵件裡「free」出現 5 次、「money」10 次、「meeting」100 次（共 115 個詞）
- 40% 的郵件是垃圾郵件，60% 不是

加上拉普拉斯平滑（alpha=1）之後：

```
P(free | spam)    = (80 + 1) / (150 + 3) = 81/153 = 0.529
P(money | spam)   = (60 + 1) / (150 + 3) = 61/153 = 0.399
P(meeting | spam) = (10 + 1) / (150 + 3) = 11/153 = 0.072

P(free | not-spam)    = (5 + 1) / (115 + 3) = 6/118 = 0.051
P(money | not-spam)   = (10 + 1) / (115 + 3) = 11/118 = 0.093
P(meeting | not-spam) = (100 + 1) / (115 + 3) = 101/118 = 0.856
```

新來的郵件裡有：「free」（2 次）、「money」（1 次）、「meeting」（0 次）。

```
log P(spam | email) = log(0.4) + 2*log(0.529) + 1*log(0.399) + 0*log(0.072)
                    = -0.916 + 2*(-0.637) + (-0.919) + 0
                    = -3.109

log P(not-spam | email) = log(0.6) + 2*log(0.051) + 1*log(0.093) + 0*log(0.856)
                        = -0.511 + 2*(-2.976) + (-2.375) + 0
                        = -8.838
```

spam 以很大的差距勝出。「free」出現兩次，是垃圾郵件的強烈證據。注意「meeting」沒有出現，對兩邊的對數總和都貢獻零（0 * log(P)）——在多項式 NB 裡，缺席的詞完全沒有作用。會明確為詞的缺席建模的是伯努利 NB。

### 三種變體

單純貝氏有三種口味。每一種對 `P(feature | class)` 的建模方式都不同。

#### 多項式單純貝氏

把每個特徵當成計數來建模。最適合特徵是詞頻或 TF-IDF 值的文本資料。

```
P(word_i | class) = (count of word_i in class + alpha) / (total words in class + alpha * vocab_size)
```

其中的 `alpha` 就是拉普拉斯平滑（下面會說明）。這個變體是文本分類的主力。

#### 高斯單純貝氏

把每個特徵當成常態分布來建模。最適合連續特徵。

```
P(x_i | class) = (1 / sqrt(2 * pi * var)) * exp(-(x_i - mean)^2 / (2 * var))
```

每個類別在每個特徵上都有自己的平均值與變異數。當特徵在每個類別內部確實呈鐘形曲線時，這招很有效。

#### 伯努利單純貝氏

把每個特徵當成二元值（出現或未出現）來建模。最適合短文本或二元特徵向量。

```
P(word_i | class) = (docs in class containing word_i + alpha) / (total docs in class + 2 * alpha)
```

跟多項式不同，伯努利會明確地為一個詞的缺席施加懲罰。如果「free」通常出現在垃圾郵件裡，但這封郵件裡沒有，伯努利就把這件事當成反對垃圾郵件的證據。

### 各變體的適用時機

| 變體 | 特徵型態 | 最適合 | 例子 |
|---------|-------------|----------|---------|
| 多項式 | 計數或頻率 | 文本分類、詞袋 | 垃圾郵件分類、主題分類 |
| 高斯 | 連續值 | 特徵大致常態的表格資料 | 鳶尾花分類、感測器資料 |
| 伯努利 | 二元（0/1） | 短文本、二元特徵向量 | 簡訊垃圾訊息、有無型特徵 |

### 拉普拉斯平滑

如果某個詞出現在測試資料裡，卻從沒在某個類別的訓練資料中出現過，會發生什麼事？

不做平滑的話：`P(word | class) = 0/N = 0`。一個零乘進整個乘積，就讓 `P(class | features) = 0`，其他所有證據一律作廢。單單一個沒見過的詞就毀掉整個預測，不管有多少其他證據支持它。

拉普拉斯平滑會給每個特徵計數都加上一個小小的量 `alpha`（通常是 1）：

```
P(word_i | class) = (count(word_i, class) + alpha) / (total_words_in_class + alpha * vocab_size)
```

alpha=1 時，每個詞至少都拿到一點點機率。測試郵件裡出現「discombobulate」，不會再把垃圾郵件的機率整個殺掉。這個平滑有貝氏上的解讀：它等同於在詞分布上放一個均勻的 Dirichlet 先驗。

alpha 越大表示平滑越強（分布越趨近均勻）。alpha 越小表示模型越相信資料。alpha 是一個你要調的超參數。

alpha 的效果：

| Alpha | 效果 | 適用時機 |
|-------|--------|-------------|
| 0.001 | 幾乎不平滑，相信資料 | 訓練集非常大，預期不會有沒見過的特徵 |
| 0.1 | 輕度平滑 | 訓練集很大 |
| 1.0 | 標準的拉普拉斯平滑 | 預設的起點 |
| 10.0 | 重度平滑，把分布壓平 | 訓練集非常小，預期有很多沒見過的特徵 |

### 對數空間計算

把數百個機率（每個都小於 1）乘在一起，會造成浮點下溢。就算真值是一個很小的正數，乘積在浮點數裡也會變成零。

解法是：在對數空間裡運算。不要把機率相乘，改成把它們的對數相加：

```
log P(class | x1, x2, ..., xn) = log P(class) + sum_i log P(xi | class)
```

這讓預測變成一次內積：

```
log_scores = X @ log_feature_probs.T + log_class_priors
prediction = argmax(log_scores)
```

矩陣乘法。這就是單純貝氏預測為什麼那麼快——它跟單層線性模型做的是同一種運算。

### 單純貝氏 vs 邏輯迴歸

兩者都是用於文本的線性分類器。差別在於它們各自建模的對象。

| 面向 | 單純貝氏 | 邏輯迴歸 |
|--------|------------|-------------------|
| 類型 | 生成式（建模 P(X\|Y)） | 判別式（建模 P(Y\|X)） |
| 訓練 | 數頻率 | 最佳化損失函式 |
| 小資料 | 較好（強先驗有幫助） | 較差（不足以估出權重） |
| 大資料 | 較差（錯的假設開始扣分） | 較好（邊界較有彈性） |
| 特徵 | 假設彼此獨立 | 能處理相關性 |
| 速度 | 掃一次資料，非常快 | 迭代式最佳化 |
| 校準 | 機率很差 | 機率較好 |

經驗法則：先用單純貝氏。如果你的資料夠多，而 NB 的表現已經停滯，就換成邏輯迴歸。

### 分類流程

```mermaid
flowchart LR
    A[Raw Text] --> B[Tokenize]
    B --> C[Build Vocabulary]
    C --> D[Count Word Frequencies]
    D --> E[Apply Smoothing]
    E --> F[Compute Log Probabilities]
    F --> G[Predict: argmax P class given words]

    style A fill:#f9f,stroke:#333
    style G fill:#9f9,stroke:#333
```

實務上我們在對數空間裡運算，以避免浮點下溢。不把很多小機率相乘，而是把它們的對數相加：

```
log P(class | features) = log P(class) + sum_i log P(feature_i | class)
```

```figure
naive-bayes
```

## 動手實作

`code/naive_bayes.py` 裡的程式碼從零實作了 MultinomialNB 與 GaussianNB。

### MultinomialNB

從零實作的做法：

1. **fit(X, y)**：對每個類別，數出每個特徵的頻率。加上拉普拉斯平滑。算出對數機率。存下類別先驗（類別頻率取對數）。

2. **predict_log_proba(X)**：對每個樣本，針對所有類別算出 log P(class) 加上所有 log P(feature_i | class) 的總和。這就是一次矩陣乘法：X @ log_probs.T + log_priors。

3. **predict(X)**：回傳對數機率最高的那個類別。

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

關鍵洞見：訓練完之後，預測就只是一次矩陣乘法加上一個偏置。這就是單純貝氏那麼快的原因。

### GaussianNB

對連續特徵，我們估出每個類別、每個特徵的平均值與變異數：

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

預測時對每個特徵套用高斯 PDF，再跨特徵相乘（在對數空間裡是相加）。

### 示範：文本分類

程式會產生合成的詞袋資料，模擬兩個類別（科技文章與運動文章）。每個類別有不同的詞頻分布。MultinomialNB 用詞的計數把它們分類。

這批合成資料是這樣造出來的：我們建 200 個「詞」（特徵欄）。第 0-39 個詞在科技文章裡頻率高、在運動文章裡低。第 80-119 個詞在運動文章裡頻率高、在科技文章裡低。第 40-79 個詞在兩邊都是中等頻率。這造出一個接近真實的情境：有些詞是強烈的類別指標，有些只是雜訊。

### 示範：連續特徵

程式會產生類似鳶尾花的資料（3 個類別、4 個特徵、高斯群集）。GaussianNB 用每個類別的平均值與變異數做分類。每個類別有不同的中心（平均值向量）與不同的散布程度（變異數），模仿真實世界中量測值會隨類別系統性地改變的情況。

程式也一併示範了：
- **平滑比較：** 用不同的 alpha 值訓練 MultinomialNB，展示平滑強度對準確率的影響。
- **訓練集大小實驗：** 當訓練資料從 20 個樣本增加到 1600 個時，NB 的準確率怎麼提升。就算樣本非常少，NB 也能達到不錯的準確率——這是它最主要的優勢。
- **混淆矩陣：** 各類別的精確率、召回率與 F1 分數，看出 NB 在哪裡犯錯。

### 預測速度

單純貝氏的預測就是一次矩陣乘法。對 n 個樣本、d 個特徵、k 個類別來說：
- MultinomialNB：一次矩陣乘法 (n x d) @ (d x k) = O(n * d * k)
- GaussianNB：n * k 次高斯 PDF 計算，每次跨 d 個特徵 = O(n * d * k)

兩者在每個維度上都是線性的。把這拿來跟 KNN（需要計算到所有訓練點的距離）或用 RBF 核的 SVM（需要對所有支持向量做核運算）比一比。在預測時間上，NB 快了好幾個數量級。

## 框架應用

用 sklearn 的話，兩個變體都只要一行：

```python
from sklearn.naive_bayes import GaussianNB, MultinomialNB

gnb = GaussianNB()
gnb.fit(X_train, y_train)
print(f"GaussianNB accuracy: {gnb.score(X_test, y_test):.3f}")

mnb = MultinomialNB(alpha=1.0)
mnb.fit(X_train_counts, y_train)
print(f"MultinomialNB accuracy: {mnb.score(X_test_counts, y_test):.3f}")
```

用 sklearn 做文本分類：

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

`naive_bayes.py` 裡的程式碼會在同一批資料上，把從零實作的版本跟 sklearn 拿來對照，以驗證正確性。

### TF-IDF 搭配單純貝氏

原始的詞計數讓每個詞的每次出現都有同樣的權重。但像「the」、「is」這類常見詞在每個類別裡都出現得很頻繁——它們不帶任何資訊。TF-IDF（詞頻－逆文件頻率）會壓低常見詞的權重，拉高罕見而有區辨力的詞。

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline

text_clf = Pipeline([
    ("tfidf", TfidfVectorizer()),
    ("classifier", MultinomialNB(alpha=0.1)),
])
```

TF-IDF 的值是非負的，所以能跟 MultinomialNB 搭配。TF-IDF + MultinomialNB 這個組合是文本分類最強的基準線之一。在訓練樣本少於 10,000 的資料集上，它經常打贏更複雜的模型。

### 用 BernoulliNB 處理短文本

對短文本（推文、簡訊、聊天訊息）來說，BernoulliNB 可能勝過 MultinomialNB。短文本的詞計數很低，所以 MultinomialNB 賴以為生的頻率資訊充滿雜訊。BernoulliNB 只在意出現或未出現，在短文本上比較可靠。

```python
from sklearn.naive_bayes import BernoulliNB
from sklearn.feature_extraction.text import CountVectorizer

text_clf = Pipeline([
    ("vectorizer", CountVectorizer(binary=True)),
    ("classifier", BernoulliNB(alpha=1.0)),
])
```

CountVectorizer 的 `binary=True` 旗標會把所有計數轉成 0/1。少了它，BernoulliNB 仍然能跑，但它看到的是它並非為此設計的計數值。

### 校準 NB 機率

NB 的機率校準得很差。當 NB 說 P(spam) = 0.95 時，真實機率可能是 0.7。如果你需要可靠的機率估計（例如要設一個閾值，或要跟其他模型結合），就用 sklearn 的 CalibratedClassifierCV：

```python
from sklearn.calibration import CalibratedClassifierCV

calibrated_nb = CalibratedClassifierCV(MultinomialNB(), cv=5, method="sigmoid")
calibrated_nb.fit(X_train, y_train)
proba = calibrated_nb.predict_proba(X_test)
```

這會用交叉驗證，在 NB 的原始分數之上再擬合一個邏輯迴歸。得到的機率會更接近真實的類別頻率。

### 常見陷阱

1. **負的特徵值。** MultinomialNB 要求特徵非負。如果你有負值（例如某些設定下的 TF-IDF，或標準化過的特徵），改用 GaussianNB，或把特徵整體平移成正值。

2. **變異數為零的特徵。** GaussianNB 會除以變異數。如果某個特徵在某個類別裡的變異數是零（所有值都一樣），機率計算就會壞掉。程式碼會對所有變異數加上一個很小的平滑項（1e-9）來避免這件事。

3. **類別不平衡。** 如果 99% 的郵件都不是垃圾郵件，先驗 P(not-spam) = 0.99 強到會壓過概似提供的證據。你可以手動設定類別先驗，或使用 sklearn 的 class_prior 參數。

4. **特徵縮放。** MultinomialNB 不需要縮放（它處理的是計數）。GaussianNB 也不需要（它估的是每個特徵各自的統計量）。這相對於邏輯迴歸與 SVM 是個優勢，那兩者對特徵尺度很敏感。

## 產出交付

這個單元產出：
- `outputs/skill-naive-bayes-chooser.md`——一項用來挑選正確 NB 變體的決策技能
- `code/naive_bayes.py`——從零實作的 MultinomialNB 與 GaussianNB，附上與 sklearn 的對照

### 單純貝氏什麼時候會失效

當條件獨立假設造成排序錯誤（而不只是機率錯誤）時，NB 就會失效。這在下列情況會發生：

1. **特徵之間有強烈交互作用。** 如果類別取決於兩個特徵的組合，而不取決於任一個單獨的特徵（類似 XOR 的模式），NB 會完全抓不到。每個特徵單獨都不提供任何證據，而 NB 沒辦法非線性地把它們結合起來。

2. **高度相關的特徵給出相反的證據。** 如果特徵 A 說「spam」而特徵 B 說「not-spam」，但 A 與 B 完全相關（在現實中總是一致），NB 就會在本來沒有衝突的地方看到衝突的證據。

3. **訓練集非常大。** 資料一多，像邏輯迴歸這類判別式模型就能學到真正的決策邊界，表現超過 NB。那個在小資料時幫上忙的獨立假設，現在反而拖住了模型。

實務上，這些失效模式在文本分類裡很少見。文本特徵數量多、單個都很弱，獨立假設造成的誤差往往互相抵消。至於特徵少、彼此又高度相關的表格資料，先考慮邏輯迴歸或樹狀模型。

## 練習

1. **平滑實驗。** 用 alpha 值 0.01、0.1、1.0、10.0 與 100.0 在文本資料上訓練 MultinomialNB。畫出準確率對 alpha 的曲線。表現在哪裡達到高峰？為什麼 alpha 非常大時會扣分？

2. **特徵獨立性檢驗。** 拿一份真實的文本資料集。挑兩個明顯相關的詞（「machine」與「learning」）。算出 P(word1 | class) * P(word2 | class)，再跟 P(word1 AND word2 | class) 比較。這個獨立假設錯得有多離譜？它會影響分類準確率嗎？

3. **伯努利實作。** 為程式碼加上一個 BernoulliNB 類別。把詞袋轉成二元（出現／未出現），在文本資料上跟 MultinomialNB 比準確率。伯努利在什麼情況下會贏？

4. **NB vs 邏輯迴歸。** 兩者都用文本資料訓練。從 100 個訓練樣本開始，一路增加到 10,000。為兩者畫出準確率對訓練集大小的曲線。邏輯迴歸在哪個點超車單純貝氏？

5. **垃圾郵件過濾器。** 打造一個完整的垃圾郵件分類器：把原始郵件文字分詞、建詞彙表、造出詞袋特徵、訓練 MultinomialNB，然後用精確率與召回率評估（不是只看準確率——為什麼？）。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|----------------|----------------------|
| 單純貝氏 | 「那個簡單的機率式分類器」 | 套用貝氏定理的分類器，並假設在給定類別的條件下各特徵彼此條件獨立 |
| 條件獨立 | 「特徵之間互不影響」 | P(A, B \| C) = P(A \| C) * P(B \| C)——一旦知道 C，知道 B 就不會再告訴你關於 A 的任何新事情 |
| 拉普拉斯平滑 | 「加一平滑」 | 給每個特徵都加上一個小小的計數，避免機率為零主導整個預測 |
| 先驗 | 「看到資料之前你相信的事」 | P(class)——在觀測到任何特徵之前，每個類別的機率 |
| 概似 | 「資料吻合得有多好」 | P(features \| class)——已知類別的情況下，觀測到這些特徵的機率 |
| 後驗 | 「看到資料之後你相信的事」 | P(class \| features)——觀測到那些特徵之後，該類別更新後的機率 |
| 生成式模型 | 「建模資料是怎麼生成的」 | 學出 P(X \| Y) 與 P(Y)，再用貝氏定理得到 P(Y \| X) 的模型 |
| 判別式模型 | 「建模決策邊界」 | 直接學出 P(Y \| X)，不去建模 X 是怎麼生成的模型 |
| 對數機率 | 「避免下溢」 | 用 log P 取代 P，避免很多小數字的乘積在浮點數裡變成零 |

## 延伸閱讀

- [scikit-learn Naive Bayes docs](https://scikit-learn.org/stable/modules/naive_bayes.html) —— 三個變體的完整介紹與數學細節
- [McCallum and Nigam, A Comparison of Event Models for Naive Bayes Text Classification (1998)](https://www.cs.cmu.edu/~knigam/papers/multinomial-aaaiws98.pdf) —— 多項式與伯努利用於文本的經典比較
- [Rennie et al., Tackling the Poor Assumptions of Naive Bayes Text Classifiers (2003)](https://people.csail.mit.edu/jrennie/papers/icml03-nb.pdf) —— 針對文本改進 NB 的做法
- [Ng and Jordan, On Discriminative vs. Generative Classifiers (2001)](https://ai.stanford.edu/~ang/papers/nips01-discriminativegenerative.pdf) —— 證明資料較少時 NB 收斂得比 LR 快
