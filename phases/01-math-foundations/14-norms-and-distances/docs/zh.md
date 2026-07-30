# 範數與距離

> 你選的距離函式，定義了「相似」是什麼意思。選錯了，下游全部跟著壞掉。

**類型：** 實作
**程式語言：** Python
**先修單元：** 階段 1 · 01（線性代數的直覺）、02（向量、矩陣與運算）
**時間：** 約 90 分鐘

## 學習目標

- 從零實作 L1、L2、餘弦、馬氏（Mahalanobis）、Jaccard 與編輯距離等函式
- 為特定的 ML 任務挑出合適的距離度量，並說明其他選項為什麼行不通
- 把 L1 與 L2 範數連結到 LASSO 與 Ridge 正則化，以及它們幾何上的約束區域
- 示範同一份資料集在不同度量下，會得到不同的最近鄰

## 問題所在

你手上有兩個向量。也許是詞嵌入，也許是使用者輪廓，也許是像素陣列。你需要知道：它們有多接近？

答案完全取決於你挑了哪個距離函式。兩個資料點在某個度量下是彼此的最近鄰，換一個度量卻可能相隔甚遠。你的 KNN 分類器、你的推薦引擎、你的向量資料庫、你的分群演算法、你的損失函式——全部都靠這個選擇。選錯了，模型就會朝錯誤的目標最佳化。

沒有一個放諸四海皆準的最佳距離。L2 適合空間性資料。餘弦相似度在 NLP 一統天下。Jaccard 處理集合。編輯距離處理字串。馬氏距離考慮了相關性。Wasserstein 搬動機率質量。每一個都編碼了一種不同的假設，關於「相似」到底是什麼意思。

這個單元會從零打造所有主要的距離函式，告訴你每一個在什麼時候才是對的工具，並示範同一份資料在不同度量下，會得出完全不同的最近鄰。

## 核心概念

### 範數：衡量向量的大小

範數衡量一個向量的「大小」。任何兩個向量之間的距離函式，都可以寫成它們差的範數：d(a, b) = ||a - b||。所以搞懂範數，就是搞懂距離。

### L1 範數（曼哈頓距離）

L1 範數把所有分量的絕對值加起來。

```
||x||_1 = |x_1| + |x_2| + ... + |x_n|
```

它之所以叫曼哈頓距離，是因為它衡量的是你在城市棋盤格街道上走的路程——只能沿著座標軸方向前進，不能走對角線。

```
Point A = (1, 1)
Point B = (4, 5)

L1 distance = |4-1| + |5-1| = 3 + 4 = 7

On a grid, you walk 3 blocks east and 4 blocks north.
```

什麼時候用 L1：

- 高維稀疏資料（文字特徵、one-hot 編碼）
- 當你想對離群值有韌性時（單一個巨大的差異不會主導結果）
- 特徵選擇問題（L1 正則化會促成稀疏性）

與 L1 正則化（Lasso）的關聯：在損失函式裡加上 ||w||_1，就是懲罰權重絕對值的總和。這會把小的權重推到剛好為零，等於自動做特徵選擇。L1 懲罰在權重空間裡形成菱形的約束區域，而菱形的角落落在座標軸上，那裡有部分權重為零。

與損失函式的關聯：平均絕對誤差（MAE）就是預測值與目標值之間的平均 L1 距離。它對所有誤差都以線性方式懲罰，因此比 MSE 更耐得住離群值。

### L2 範數（歐氏距離）

L2 範數就是直線距離：各分量平方和的平方根。

```
||x||_2 = sqrt(x_1^2 + x_2^2 + ... + x_n^2)
```

這就是你在幾何課學到的那個距離。n 維空間裡的畢氏定理。

```
Point A = (1, 1)
Point B = (4, 5)

L2 distance = sqrt((4-1)^2 + (5-1)^2) = sqrt(9 + 16) = sqrt(25) = 5.0

The straight line, cutting diagonally through the grid.
```

什麼時候用 L2：

- 低維到中維的連續資料
- 當各特徵的尺度相當時
- 物理距離（空間資料、感測器讀值）
- 像素層級的影像相似度

與 L2 正則化（Ridge）的關聯：在損失函式裡加上 ||w||_2^2，就是懲罰過大的權重。與 L1 不同，它不會把權重推到零，而是等比例地把所有權重朝零收縮。L2 懲罰形成圓形的約束區域，座標軸上沒有角落，所以權重會變小，但很少剛好等於零。

與損失函式的關聯：均方誤差（MSE）是 L2 距離平方的平均。平方讓大誤差受到的懲罰遠重於小誤差。

```
MAE (L1 loss):  |y - y_hat|         Linear penalty. Robust to outliers.
MSE (L2 loss):  (y - y_hat)^2       Quadratic penalty. Sensitive to outliers.
```

### Lp 範數：整個家族

L1 與 L2 都是 Lp 範數的特例：

```
||x||_p = (|x_1|^p + |x_2|^p + ... + |x_n|^p)^(1/p)
```

不同的 p 值會產生不同形狀的「單位球」（也就是所有與原點距離為 1 的點所構成的集合）：

```
p=1:    Diamond shape      (corners on axes)
p=2:    Circle/sphere      (the usual round ball)
p=3:    Superellipse       (rounded square)
p=inf:  Square/hypercube   (flat sides along axes)
```

### 無窮範數（Chebyshev 距離）

當 p 趨於無窮大，Lp 範數會收斂到絕對值最大的那個分量。

```
||x||_inf = max(|x_1|, |x_2|, ..., |x_n|)
```

兩點之間的距離，由它們差異最大的那一個維度決定。其他維度全部被忽略。

```
Point A = (1, 1)
Point B = (4, 5)

L-inf distance = max(|4-1|, |5-1|) = max(3, 4) = 4
```

什麼時候用無窮範數：

- 當任一單一維度的最壞偏差才是關鍵時
- 棋盤遊戲（西洋棋的王就是以無窮範數移動：往任何方向走一步都算 1）
- 製造公差（每一個尺寸都必須落在規格內）

### 餘弦相似度與餘弦距離

餘弦相似度衡量兩個向量之間的夾角，忽略它們的大小。

```
cos_sim(a, b) = (a . b) / (||a||_2 * ||b||_2)
```

它的範圍從 -1（方向相反）到 +1（方向相同）。互相垂直的向量餘弦相似度為 0。

餘弦距離把它轉成距離：cosine_distance = 1 - cosine_similarity。範圍從 0（方向完全相同）到 2（方向完全相反）。

```
a = (1, 0)    b = (1, 1)

cos_sim = (1*1 + 0*1) / (1 * sqrt(2)) = 1/sqrt(2) = 0.707
cos_dist = 1 - 0.707 = 0.293
```

餘弦為什麼在 NLP 與嵌入領域一統天下：在文字裡，文件長度不該影響相似度。一篇談貓的文章，就算長度是另一篇談貓的文章的兩倍，兩者仍然應該算「相似」。餘弦相似度忽略大小（長度），只在意方向。兩篇詞彙分布相同、長度不同的文件會指向同一個方向，餘弦相似度是 1.0。

什麼時候用餘弦相似度：

- 文字相似度（TF-IDF 向量、詞嵌入、句子嵌入）
- 任何「大小是雜訊、方向才是訊號」的領域
- 推薦系統（使用者偏好向量）
- 嵌入搜尋（向量資料庫幾乎都用餘弦或內積）

### 內積相似度與餘弦相似度的差別

兩個向量的內積是：

```
a . b = a_1*b_1 + a_2*b_2 + ... + a_n*b_n
      = ||a|| * ||b|| * cos(angle)
```

餘弦相似度就是內積除以兩者的大小做正規化。當兩個向量都已經正規化成單位長度（大小 = 1），內積與餘弦相似度就完全相同。

```
If ||a|| = 1 and ||b|| = 1:
    a . b = cos(angle between a and b)
```

它們何時會不同：內積包含了大小的資訊。大小較大的向量會拿到較高的內積分數。這在某些檢索系統裡很有用——你希望「熱門」項目排得更前面，大小就成了品質或重要性的隱含訊號。

```
a = (3, 0)    b = (1, 0)    c = (0, 1)

dot(a, b) = 3     dot(a, c) = 0
cos(a, b) = 1.0   cos(a, c) = 0.0

Both agree on direction, but dot product also reflects magnitude.
```

實務上：

- 想要純粹的方向相似度時，用餘弦相似度
- 大小本身帶有意義時，用內積
- 許多向量資料庫（Pinecone、Weaviate、Qdrant）讓你自己選
- 如果你的嵌入已經做過 L2 正規化，選哪個都一樣

### 馬氏距離

歐氏距離把所有維度一視同仁。但如果你的特徵彼此相關，或尺度差很多，L2 給出的結果會誤導你。

馬氏距離把資料的共變異結構考慮進來。

```
d_M(x, y) = sqrt((x - y)^T * S^(-1) * (x - y))
```

其中 S 是資料的共變異矩陣。

直觀來說：馬氏距離先把資料去相關並正規化（白化），再在變換後的空間裡算 L2 距離。如果 S 是單位矩陣（特徵彼此不相關、變異數為 1），馬氏距離就退化成歐氏距離。

```
Example: height and weight are correlated.
Someone 6'2" and 180 lbs is not unusual.
Someone 5'0" and 180 lbs is unusual.

Euclidean distance might say they are equally far from the mean.
Mahalanobis distance correctly identifies the second as an outlier
because it accounts for the height-weight correlation.
```

什麼時候用馬氏距離：

- 離群值偵測（與平均值的馬氏距離很大的點就是離群值）
- 特徵尺度與相關性各異時的分類問題
- 當你的資料量足以估出一個可靠的共變異矩陣時
- 製造業的品質管制（多變量製程監控）

### Jaccard 相似度（用於集合）

Jaccard 相似度衡量兩個集合之間的重疊程度。

```
J(A, B) = |A intersect B| / |A union B|
```

範圍從 0（完全不重疊）到 1（兩集合相同）。Jaccard 距離 = 1 - Jaccard 相似度。

```
A = {cat, dog, fish}
B = {cat, bird, fish, snake}

Intersection = {cat, fish}         size = 2
Union = {cat, dog, fish, bird, snake}  size = 5

Jaccard similarity = 2/5 = 0.4
Jaccard distance = 0.6
```

什麼時候用 Jaccard：

- 比較標籤、分類或特徵的集合
- 基於詞彙有無（而非頻率）的文件相似度
- 近似重複偵測（用 MinHash 近似 Jaccard）
- 比較二元特徵向量（有／無的資料）
- 評估分割模型（Intersection over Union 就是 Jaccard）

### 編輯距離（Levenshtein 距離）

編輯距離計算把一個字串轉成另一個字串，最少需要幾次單字元操作。操作有三種：插入、刪除、替換。

```
"kitten" -> "sitting"

kitten -> sitten  (substitute k -> s)
sitten -> sittin  (substitute e -> i)
sittin -> sitting (insert g)

Edit distance = 3
```

用動態規劃計算：填一張矩陣，其中位置 (i, j) 是字串 A 前 i 個字元與字串 B 前 j 個字元之間的編輯距離。

```
        ""  s  i  t  t  i  n  g
    ""   0  1  2  3  4  5  6  7
    k    1  1  2  3  4  5  6  7
    i    2  2  1  2  3  4  5  6
    t    3  3  2  1  2  3  4  5
    t    4  4  3  2  1  2  3  4
    e    5  5  4  3  2  2  3  4
    n    6  6  5  4  3  3  2  3
```

什麼時候用編輯距離：

- 拼字檢查與校正
- DNA 序列比對（搭配加權操作）
- 模糊字串比對
- 雜亂文字資料的去重

### KL 散度（不是距離，但被當成距離用）

KL 散度衡量一個機率分布與另一個分布差多少。單元 09 會細講，但它該出現在這裡，因為大家都把它當「距離」用，儘管它並不是。

```
D_KL(P || Q) = sum(p(x) * log(p(x) / q(x)))
```

關鍵性質：KL 散度不對稱。

```
D_KL(P || Q) != D_KL(Q || P)
```

這表示它不滿足距離度量最基本的要求。它也不滿足三角不等式。它是一種散度，不是距離。

正向 KL（D_KL(P || Q)）是「求均值型」的：Q 會試著覆蓋 P 的所有模態。
反向 KL（D_KL(Q || P)）是「求模態型」的：Q 會集中在 P 的某一個模態上。

你會在哪裡看到 KL 散度：

- VAE（ELBO 裡的 KL 項會把潛在分布推向先驗）
- 知識蒸餾（學生模型試著對上老師模型的分布）
- RLHF（KL 懲罰項讓微調後的模型不會離基礎模型太遠）
- 策略梯度方法（約束策略的更新幅度）

### Wasserstein 距離（推土機距離）

Wasserstein 距離衡量把一個機率分布變成另一個所需的最小「工作量」。可以這樣想：如果一個分布是一堆土，另一個是一個坑，你得搬多少土、搬多遠？

```
W(P, Q) = inf over all transport plans gamma of E[d(x, y)]
```

對一維分布來說，它會簡化成兩者累積分布函式之差的絕對值積分：

```
W_1(P, Q) = integral |CDF_P(x) - CDF_Q(x)| dx
```

Wasserstein 為什麼重要：

- 它是真正的度量（對稱，滿足三角不等式）
- 即使兩個分布完全不重疊，它仍然提供梯度（KL 散度這時會變成無限大）
- 這個性質讓它成為 Wasserstein GAN（WGAN）的核心，解決了原始 GAN 訓練不穩定的問題

```
Distributions with no overlap:

P: [1, 0, 0, 0, 0]    Q: [0, 0, 0, 0, 1]

KL divergence: infinity (log of zero)
Wasserstein: 4 (move all mass 4 bins)

Wasserstein gives a meaningful gradient. KL does not.
```

什麼時候用 Wasserstein：

- GAN 訓練（WGAN、WGAN-GP）
- 比較可能完全不重疊的分布
- 最佳傳輸問題
- 影像檢索（比較色彩直方圖）

### 為什麼不同任務需要不同的距離

| 任務 | 最合適的距離 | 為什麼 |
|------|--------------|-----|
| 文字相似度 | 餘弦 | 大小是雜訊，方向才是意義 |
| 影像像素比較 | L2 | 空間關係有意義，各特徵尺度相當 |
| 稀疏高維特徵 | L1 | 有韌性，不會放大罕見的大差異 |
| 集合重疊（標籤、分類） | Jaccard | 資料天生是集合，不是向量 |
| 字串比對 | 編輯距離 | 操作對應到人類編輯的直覺 |
| 離群值偵測 | 馬氏 | 把特徵的相關性與尺度考慮進來 |
| 比較分布 | KL 散度 | 衡量用 Q 取代 P 所損失的資訊 |
| GAN 訓練 | Wasserstein | 分布不重疊時仍提供梯度 |
| 嵌入（向量資料庫） | 餘弦或內積 | 嵌入被訓練成用方向來編碼語意 |
| 推薦 | 內積 | 大小可以編碼熱門度或信心 |
| DNA 序列 | 加權編輯距離 | 替換成本因核苷酸配對而異 |
| 製造品質管制 | 無窮範數 | 任一維度的最壞偏差才是關鍵 |

### 與損失函式的關聯

損失函式就是套用在預測值與目標值之間的距離函式。

```
Loss function       Distance it uses       Behavior
MSE                 L2 squared             Penalizes large errors heavily
MAE                 L1                     Penalizes all errors equally
Huber loss          L1 for large errors,   Best of both: robust to outliers,
                    L2 for small errors    smooth gradient near zero
Cross-entropy       KL divergence          Measures distribution mismatch
Hinge loss          max(0, margin - d)     Only penalizes below margin
Triplet loss        L2 (typically)         Pulls positives close, pushes
                                           negatives away
Contrastive loss    L2                     Similar pairs close, dissimilar
                                           pairs beyond margin
```

### 與正則化的關聯

正則化就是在損失函式上加一項對權重的範數懲罰。

```
L1 regularization (Lasso):   loss + lambda * ||w||_1
  -> Sparse weights. Some weights become exactly zero.
  -> Automatic feature selection.
  -> Solution has corners (non-differentiable at zero).

L2 regularization (Ridge):   loss + lambda * ||w||_2^2
  -> Small weights. All weights shrink toward zero.
  -> No feature selection (nothing goes to exactly zero).
  -> Smooth solution everywhere.

Elastic Net:                  loss + lambda_1 * ||w||_1 + lambda_2 * ||w||_2^2
  -> Combines sparsity of L1 with stability of L2.
  -> Groups of correlated features are kept or dropped together.
```

L1 為什麼會產生稀疏性、L2 卻不會：想像二維權重空間裡的約束區域。L1 是菱形，L2 是圓形。損失函式的等高線（橢圓）最有可能碰到菱形的某個角落，而那裡有一個權重是零；碰到圓形時則是碰在一個平滑的點上，兩個權重都不為零。

### 最近鄰搜尋

每一個距離函式都隱含一個最近鄰搜尋問題：給一個查詢點，在資料集裡找出最接近的點。

在 n 個點、d 維的資料集上，精確最近鄰搜尋每次查詢是 O(n * d)。資料集一大，這就太慢了。

近似最近鄰（ANN）演算法用一點點精確度換取巨大的速度提升：

```
Algorithm         Approach                      Used by
KD-trees          Axis-aligned space partition   scikit-learn (low-dim)
Ball trees        Nested hyperspheres            scikit-learn (medium-dim)
LSH               Random hash projections        Near-duplicate detection
HNSW              Hierarchical navigable         FAISS, Qdrant, Weaviate
                  small-world graph
IVF               Inverted file index with       FAISS (billion-scale)
                  cluster-based search
Product quant.    Compress vectors, search       FAISS (memory-constrained)
                  in compressed space
```

HNSW（Hierarchical Navigable Small World）是現代向量資料庫裡的主流演算法。它建出一張多層圖，每個節點連到自己的近似最近鄰。搜尋從最上層開始（稀疏、跳得遠），一路往下降到最底層（稠密、跳得近）。

```figure
norm-unit-balls
```

## 動手實作

### 步驟 1：所有範數與距離函式

完整實作請看 `code/distances.py`。每個函式都只用基本的 Python 數學從零寫成。

### 步驟 2：同一份資料、不同距離、不同鄰居

`distances.py` 裡的示範會建一個資料集、挑一個查詢點，然後展示最近鄰如何隨距離度量改變。在 L1 下「最近」的那個點，在 L2 或餘弦下可能就不是最近的了。

### 步驟 3：嵌入相似度搜尋

程式碼裡還包含一個模擬的嵌入相似度搜尋，分別用餘弦相似度與 L2 距離找出跟查詢最相似的「文件」，顯示兩者的排名可以不一樣。

## 框架應用

最常見的實務用途：在向量資料庫裡找相似項目。

```python
import numpy as np

def cosine_similarity_matrix(X):
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    X_normalized = X / norms
    return X_normalized @ X_normalized.T

embeddings = np.random.randn(1000, 768)

sim_matrix = cosine_similarity_matrix(embeddings)

query_idx = 0
similarities = sim_matrix[query_idx]
top_k = np.argsort(similarities)[::-1][1:6]
print(f"Top 5 most similar to item 0: {top_k}")
print(f"Similarities: {similarities[top_k]}")
```

當你呼叫 `model.encode(text)` 然後去搜尋一個向量資料庫，底層發生的就是這件事。嵌入模型把文字映射成向量，向量資料庫再算出你的查詢向量與每一個儲存向量之間的餘弦相似度（或內積），並用 ANN 演算法避免真的把每一個都算過。

## 練習

1. 計算 (1, 2, 3) 與 (4, 0, 6) 之間的 L1、L2 與無窮範數距離。驗證對任意一對點，L-inf <= L2 <= L1 都成立。證明這個順序為什麼是必然的。

2. 造出兩個向量，讓餘弦相似度很高（> 0.9）但 L2 距離很大（> 10）。用幾何解釋這是怎麼一回事。接著再造出兩個向量，讓餘弦相似度很低（< 0.3）但 L2 距離很小（< 0.5）。

3. 實作一個函式，吃進一個資料集與一個查詢點，回傳 L1、L2、餘弦與馬氏距離下各自的最近鄰。找出一個資料集，讓這四者對「哪個點最近」全都各執一詞。

4. 用 CDF 方法手算 [0.5, 0.5, 0, 0] 與 [0, 0, 0.5, 0.5] 之間的 Wasserstein 距離。接著算 [0.25, 0.25, 0.25, 0.25] 與 [0, 0, 0.5, 0.5] 之間的距離。哪一個比較大？為什麼？

5. 實作 MinHash 來近似 Jaccard 相似度。產生 100 個隨機集合，算出所有配對的精確 Jaccard 值，再與使用 50、100、200 個雜湊函式的 MinHash 近似結果比較。把近似誤差畫成圖。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|----------------|----------------------|
| 範數 | 「向量的大小」 | 一個把向量映射到非負純量的函式，滿足三角不等式、絕對齊次性，且只有零向量的範數為零 |
| L1 範數 | 「曼哈頓距離」 | 各分量絕對值之和。在最佳化中會產生稀疏性。對離群值有韌性 |
| L2 範數 | 「歐氏距離」 | 各分量平方和的平方根。歐氏空間裡的直線距離 |
| Lp 範數 | 「一般化的範數」 | 各分量絕對值 p 次方之和的 p 次方根。L1 與 L2 都是它的特例 |
| 無窮範數 | 「最大範數」或「Chebyshev 距離」 | 絕對值最大的那個分量。Lp 在 p 趨於無窮時的極限 |
| 餘弦相似度 | 「向量之間的夾角」 | 內積除以兩者大小做正規化。範圍從 -1 到 +1。忽略向量長度 |
| 餘弦距離 | 「1 減掉餘弦相似度」 | 把餘弦相似度轉成距離。範圍從 0 到 2 |
| 內積 | 「沒正規化的餘弦」 | 逐分量相乘後加總。等於餘弦相似度乘上兩者的大小 |
| 馬氏距離 | 「懂得相關性的距離」 | 在用資料共變異矩陣白化過（去相關並正規化）的空間裡算的 L2 距離 |
| Jaccard 相似度 | 「集合的重疊」 | 交集大小除以聯集大小。用於集合，不是向量 |
| 編輯距離 | 「Levenshtein 距離」 | 把一個字串轉成另一個所需的最少插入、刪除與替換次數 |
| KL 散度 | 「分布之間的距離」 | 不是真正的距離（不對稱）。衡量用 Q 來編碼 P 所多花的位元數 |
| Wasserstein 距離 | 「推土機距離」 | 把質量從一個分布搬到另一個分布的最小工作量。是真正的度量 |
| 近似最近鄰 | 「ANN 搜尋」 | 一類演算法（HNSW、LSH、IVF），能比精確搜尋快得多地找出近似最接近的點 |
| HNSW | 「向量資料庫那個演算法」 | Hierarchical Navigable Small World 圖。用多層圖做快速近似最近鄰搜尋 |
| L1 正則化 | 「Lasso」 | 把權重的 L1 範數加進損失函式。會把權重逼到零（稀疏性） |
| L2 正則化 | 「Ridge」或「weight decay」 | 把權重 L2 範數的平方加進損失函式。讓權重朝零收縮，但不產生稀疏性 |
| Elastic Net | 「L1 + L2」 | 結合 L1 與 L2 正則化。處理相關特徵群的表現比單用任一者都好 |

## 延伸閱讀

- [FAISS: A Library for Efficient Similarity Search](https://github.com/facebookresearch/faiss) —— Meta 的十億級 ANN 搜尋函式庫
- [Wasserstein GAN (Arjovsky et al., 2017)](https://arxiv.org/abs/1701.07875) —— 把推土機距離引進 GAN 的那篇論文
- [Locality-Sensitive Hashing (Indyk & Motwani, 1998)](https://dl.acm.org/doi/10.1145/276698.276876) —— 奠基性的 ANN 演算法
- [Efficient Estimation of Word Representations (Mikolov et al., 2013)](https://arxiv.org/abs/1301.3781) —— Word2Vec，餘弦相似度從此成為嵌入的預設選擇
- [sklearn.neighbors documentation](https://scikit-learn.org/stable/modules/neighbors.html) —— scikit-learn 裡距離度量與最近鄰演算法的實用指南
