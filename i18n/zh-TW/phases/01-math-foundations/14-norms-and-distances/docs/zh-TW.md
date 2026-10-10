# 範數與距離

> 距離函數定義了「相似」的意思。選錯了，後續所有步驟都會出問題。

**Type:** Build
**Language:** Python
**Prerequisites:** Phase 1, Lessons 01 (Linear Algebra Intuition), 02 (Vectors, Matrices & Operations)
**Time:** ~90 minutes

## Learning Objectives｜學習目標

- 從零實作 L1 範數（L1 norm）、L2 範數（L2 norm）、餘弦相似度（cosine similarity）、馬氏距離（Mahalanobis distance）、Jaccard 相似度（Jaccard similarity）與編輯距離（edit distance）函數
- 選擇適合指定 ML 任務的距離度量（distance metric），並說明其他選項為何會失效
- 說明 L1 與 L2 範數如何連結到 LASSO 和嶺迴歸正則化（Ridge regularization），以及它們的幾何限制區域
- 展示同一份資料集使用不同度量時，最近鄰會如何改變

## The Problem｜問題

你有兩個向量。它們可能是 word embedding，也可能是使用者輪廓，或像素（pixel）陣列。你想知道：它們有多接近？

答案完全取決於你選擇哪一種距離函數（distance function）。兩個資料點在某種度量下可能是最近鄰，在另一種度量下卻相距甚遠。KNN 分類器、推薦引擎（recommendation engine）、向量資料庫（vector database）、分群演算法（clustering algorithm）和損失函數（loss function）都取決於這項選擇。選錯了，模型最佳化的目標就會跟著錯。

沒有一種距離適用所有情境。L2 適合空間資料；NLP 則以餘弦相似度為主。Jaccard 適合集合，編輯距離適合字串，馬氏距離能納入相關性，Wasserstein 距離則搬運機率質量（probability mass）。每一種距離都代表了對「相似」的不同假設。

本課會從零建構各種主要距離函數，說明何時適合使用每一種，並展示同一份資料如何因度量不同而得出完全不同的最近鄰。

## The Concept｜核心概念

### 範數：衡量向量大小

範數（norm）用來衡量向量的「大小」。任意兩個向量間的距離函數都可以寫成兩者差值的範數：d(a, b) = ||a - b||。因此，理解範數就是理解距離。

### L1 範數（曼哈頓距離，Manhattan distance）

L1 範數會將所有分量的絕對值加總。

```
||x||_1 = |x_1| + |x_2| + ... + |x_n|
```

它也稱為曼哈頓距離，因為它衡量你在城市街道方格中行走的距離，而且只能沿著座標軸移動，不能走對角線。

```
Point A = (1, 1)
Point B = (4, 5)

L1 distance = |4-1| + |5-1| = 3 + 4 = 7

On a grid, you walk 3 blocks east and 4 blocks north.
```

適合使用 L1 的情況：
- 高維度稀疏資料（sparse data），例如文字特徵和 one-hot 編碼
- 希望對離群值（outlier）有較強的抵抗力時（單一巨大差異不會主導結果）
- 特徵選擇（feature selection）問題：L1 正則化（L1 regularization）會促進稀疏性（sparsity）

L1 正則化和 LASSO 的關係：把 ||w||_1 加進損失函數，會懲罰權重絕對值的總和，使小權重直接變成零，自動完成特徵選擇。L1 懲罰會在權重空間形成菱形限制區域；菱形頂點落在座標軸上，因此某些權重會是零。

與損失函數的關係：平均絕對誤差（Mean Absolute Error，MAE）是預測值與目標值之間 L1 距離的平均值。它對所有誤差施加線性懲罰，相較於 MSE，對離群值較穩健。

### L2 範數（歐幾里得距離，Euclidean distance）

L2 範數就是兩點間的直線距離，等於各分量平方和的平方根。

```
||x||_2 = sqrt(x_1^2 + x_2^2 + ... + x_n^2)
```

這就是你在幾何課學過的距離：畢氏定理在 n 維空間中的延伸。

```
Point A = (1, 1)
Point B = (4, 5)

L2 distance = sqrt((4-1)^2 + (5-1)^2) = sqrt(9 + 16) = sqrt(25) = 5.0

The straight line, cutting diagonally through the grid.
```

適合使用 L2 的情況：
- 中低維度的連續資料
- 特徵尺度相近時
- 物理距離，例如空間資料和感測器讀數
- 以像素（pixel）為單位比較影像相似度

L2 正則化（L2 regularization）與嶺迴歸（Ridge）的關係：把 ||w||_2^2 加進損失函數，會懲罰過大的權重。和 L1 不同，它不會把權重推到零，而是按比例將所有權重縮小。L2 懲罰會形成圓形限制區域，座標軸上沒有頂點，因此權重會變小，但很少會剛好變成零。

與損失函數的關係：均方誤差（mean squared error，MSE）是 L2 距離平方後的平均值。平方運算會讓大誤差受到比小誤差更重的懲罰。

```
MAE (L1 loss):  |y - y_hat|         Linear penalty. Robust to outliers.
MSE (L2 loss):  (y - y_hat)^2       Quadratic penalty. Sensitive to outliers.
```

### Lp 範數：通用範數族

L1 和 L2 都是 Lp 範數（Lp norm）的特例：

```
||x||_p = (|x_1|^p + |x_2|^p + ... + |x_n|^p)^(1/p)
```

不同的 p 值會產生不同形狀的「單位球（unit ball）」（所有距離原點為 1 的點所構成的集合）：

```
p=1:    Diamond shape      (corners on axes)
p=2:    Circle/sphere      (the usual round ball)
p=3:    Superellipse       (rounded square)
p=inf:  Square/hypercube   (flat sides along axes)
```

### L-infinity 範數（L-infinity norm；切比雪夫距離，Chebyshev distance）

當 p 趨近無限大時，Lp 範數會收斂到各分量絕對值的最大值，稱為 L-infinity 範數（L-infinity norm）。

```
||x||_inf = max(|x_1|, |x_2|, ..., |x_n|)
```

兩點之間的距離由差異最大的那個維度決定，其餘維度都不納入計算。

```
Point A = (1, 1)
Point B = (4, 5)

L-inf distance = max(|4-1|, |5-1|) = max(3, 4) = 4
```

適合使用 L-infinity 的情況：
- 關心任何單一維度上的最壞情況偏差時
- 遊戲棋盤（西洋棋的國王採用 L-infinity 移動：任意方向移動一步，代價都是 1）
- 製造公差（每個維度都必須在規格範圍內）

### 餘弦相似度與餘弦距離

餘弦相似度（cosine similarity）衡量兩個向量的夾角，不考慮向量長度。

```
cos_sim(a, b) = (a . b) / (||a||_2 * ||b||_2)
```

餘弦相似度的範圍是 -1（方向相反）到 +1（方向相同）。互相垂直的向量，其餘弦相似度為 0。

餘弦距離（cosine distance）會將它轉換成距離：cosine_distance = 1 - cosine_similarity。範圍是 0（方向相同）到 2（方向相反）。

```
a = (1, 0)    b = (1, 1)

cos_sim = (1*1 + 0*1) / (1 * sqrt(2)) = 1/sqrt(2) = 0.707
cos_dist = 1 - 0.707 = 0.293
```

為什麼 NLP 和 embedding 常用餘弦相似度：在文字資料中，文件長度不應該影響相似度。一篇談貓的文章，即使篇幅是另一篇談貓文章的兩倍，兩者仍應該算「相似」。餘弦相似度忽略向量長度，只關心方向。兩篇文字的詞彙分布相同、長度不同時，向量方向相同，餘弦相似度就是 1.0。

適合使用餘弦相似度的情況：
- 文字相似度（TF-IDF 向量、word embedding、句子 embedding）
- 向量長度是雜訊、方向才是訊號的領域
- 推薦系統（使用者偏好向量）
- embedding 搜尋（向量資料庫幾乎一律使用餘弦相似度或內積）

### 內積相似度對比餘弦相似度

兩個向量的內積（dot product）為：

```
a . b = a_1*b_1 + a_2*b_2 + ... + a_n*b_n
      = ||a|| * ||b|| * cos(angle)
```

餘弦相似度是將內積除以兩個向量長度的結果。若兩個向量都已正規化為單位長度（長度 = 1），內積和餘弦相似度就相同。

```
If ||a|| = 1 and ||b|| = 1:
    a . b = cos(angle between a and b)
```

兩者的差異：內積包含向量長度資訊。長度較大的向量會得到較高的內積分數。在某些檢索系統中，這很重要，因為你可能希望「熱門」項目排名較高。向量長度會成為一種隱含的品質或重要性訊號。

```
a = (3, 0)    b = (1, 0)    c = (0, 1)

dot(a, b) = 3     dot(a, c) = 0
cos(a, b) = 1.0   cos(a, c) = 0.0

Both agree on direction, but dot product also reflects magnitude.
```

實務上：
- 只想比較方向相似度時，使用餘弦相似度
- 向量長度也代表有意義的資訊時，使用內積
- 許多向量資料庫（Pinecone、Weaviate、Qdrant）都能讓你選擇其中一種
- 如果 embedding 已用 L2 範數正規化，選哪一種都一樣

### 馬氏距離

歐幾里得距離會平等看待所有維度。但如果特徵彼此相關或尺度不同，L2 距離就會產生誤導結果。

馬氏距離（Mahalanobis distance）會把資料的共變異數結構納入考量。

```
d_M(x, y) = sqrt((x - y)^T * S^(-1) * (x - y))
```

其中 S 是資料的共變異數矩陣（covariance matrix）。

直觀來說，馬氏距離會先將資料去相關並正規化，也就是白化（whitening），然後在轉換後的空間計算 L2 距離。如果 S 是單位矩陣（特徵互不相關且變異數為 1），馬氏距離就會退化成歐幾里得距離。

```
Example: height and weight are correlated.
Someone 6'2" and 180 lbs is not unusual.
Someone 5'0" and 180 lbs is unusual.

Euclidean distance might say they are equally far from the mean.
Mahalanobis distance correctly identifies the second as an outlier
because it accounts for the height-weight correlation.
```

適合使用馬氏距離的情況：
- 離群值偵測（與平均數的馬氏距離很大的點就是離群值）
- 特徵尺度不同且彼此相關時的分類
- 有足夠資料估計可靠的共變異數矩陣時
- 製造品質管制（多變量製程監控）

### Jaccard 相似度（適用於集合）

Jaccard 相似度（Jaccard similarity）衡量兩個集合的重疊程度。

```
J(A, B) = |A intersect B| / |A union B|
```

範圍是 0（完全沒有重疊）到 1（集合完全相同）。Jaccard 距離（Jaccard distance）= 1 - Jaccard 相似度。

```
A = {cat, dog, fish}
B = {cat, bird, fish, snake}

Intersection = {cat, fish}         size = 2
Union = {cat, dog, fish, bird, snake}  size = 5

Jaccard similarity = 2/5 = 0.4
Jaccard distance = 0.6
```

適合使用 Jaccard 的情況：
- 比較標籤、類別或特徵集合
- 根據文字是否出現（而非出現頻率）比較文件相似度
- 偵測近似重複資料（用 MinHash 近似估計 Jaccard 相似度）
- 比較二元特徵向量（是否出現的資料）
- 評估影像分割模型（交並比（intersection over union，IoU）= Jaccard）

### 編輯距離（Levenshtein 距離，Levenshtein distance）

編輯距離（edit distance）計算將一個字串轉換成另一個字串所需的最少單一字元操作次數。操作包括插入、刪除或取代。

```
"kitten" -> "sitting"

kitten -> sitten  (substitute k -> s)
sitten -> sittin  (substitute e -> i)
sittin -> sitting (insert g)

Edit distance = 3
```

此距離以動態規劃（dynamic programming）計算。填入一個矩陣，其中第 (i, j) 格代表字串 A 的前 i 個字元與字串 B 的前 j 個字元之間的編輯距離。

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

適合使用編輯距離的情況：
- 拼字檢查與更正
- DNA 序列比對（使用加權操作）
- 模糊字串比對
- 清理雜亂文字資料時去除重複項目

### KL 散度（KL divergence；並非距離，但常被當成距離使用）

KL 散度（KL divergence）衡量兩個機率分布（probability distribution）之間的差異。第 09 課已介紹 KL 散度；即使它並非距離，仍常被當成「距離」使用，因此也值得在這裡討論。

```
D_KL(P || Q) = sum(p(x) * log(p(x) / q(x)))
```

關鍵性質：KL 散度不對稱。

```
D_KL(P || Q) != D_KL(Q || P)
```

因此它不符合距離度量（distance metric）的基本條件，也不滿足三角不等式（triangle inequality）。它是散度，不是距離。

正向 KL（D_KL(P || Q)）會「偏向平均」（mean-seeking）：Q 會試著涵蓋 P 的所有眾數。反向 KL（D_KL(Q || P)）會「偏向眾數」（mode-seeking）：Q 會集中在 P 的單一眾數上。

你會在以下情況看到 KL 散度：
- VAE（ELBO 中的 KL 項會將潛在分布推向先驗分布）
- 知識蒸餾（學生模型嘗試貼近教師模型的分布）
- RLHF（KL 懲罰會讓經過 fine-tuning 的模型維持接近基礎模型）
- 策略梯度方法（限制策略更新）

### Wasserstein 距離（Wasserstein distance；推土距離，Earth Mover's Distance）

Wasserstein 距離（Wasserstein distance）衡量將一種機率分布轉換成另一種所需的最小「功」。可以想像一種分布是一堆土，另一種是坑洞：你要搬多少土、搬多遠？

```
W(P, Q) = inf over all transport plans gamma of E[d(x, y)]
```

對一維分布而言，可簡化為累積分布函數（cumulative distribution function，CDF）的絕對差值之積分：

```
W_1(P, Q) = integral |CDF_P(x) - CDF_Q(x)| dx
```

Wasserstein 距離的重要性：
- 它是真正的距離度量（對稱，且滿足三角不等式）
- 即使兩個分布沒有重疊，它仍能提供梯度（KL 散度會趨近無限大）
- 這項性質讓它成為 Wasserstein GAN（WGAN）的核心，解決了原始 GAN 訓練不穩定的問題

```
Distributions with no overlap:

P: [1, 0, 0, 0, 0]    Q: [0, 0, 0, 0, 1]

KL divergence: infinity (log of zero)
Wasserstein: 4 (move all mass 4 bins)

Wasserstein gives a meaningful gradient. KL does not.
```

適合使用 Wasserstein 距離的情況：
- GAN 訓練（WGAN、WGAN-GP）
- 比較可能沒有重疊的分布
- 最優傳輸（optimal transport）問題
- 影像檢索（比較色彩直方圖）

### 不同任務為何需要不同距離

| 任務 | 最適合的距離 | 原因 |
|------|--------------|-----|
| 文字相似度 | 餘弦相似度 | 長度是雜訊，方向代表意義 |
| 影像像素（pixel）比較 | L2 | 空間關係重要，特徵尺度相近 |
| 稀疏高維特徵 | L1 | 穩健，不會放大罕見的大差異 |
| 集合重疊（標籤、類別） | Jaccard | 資料本來就是集合，不是向量 |
| 字串比對 | 編輯距離 | 操作方式符合人類編輯文字的直覺 |
| 離群值偵測 | 馬氏距離 | 納入特徵相關性和尺度 |
| 比較分布 | KL 散度 | 衡量用 Q 取代 P 時損失的資訊量 |
| GAN 訓練 | Wasserstein | 即使分布沒有重疊也能提供梯度 |
| embedding（向量資料庫） | 餘弦相似度或內積 | embedding 經訓練後會以方向編碼意義 |
| 推薦 | 內積 | 長度可能編碼熱門程度或信心 |
| DNA 序列 | 加權編輯距離（weighted edit distance） | 不同核苷酸配對的取代成本不同 |
| 製造品質管制 | L-infinity | 任何維度上的最壞偏差都很重要 |

### 與損失函數的關係

損失函數是套用在預測值與目標值上的距離函數。

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

### 與正則化的關係

正則化會在損失函數中加入權重範數懲罰。

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

L1 為什麼會產生稀疏性，而 L2 不會：想像二維權重空間中的限制區域。L1 是菱形，L2 是圓形。損失函數的等高線（橢圓）最可能在菱形頂點碰到限制區域，此時有一個權重為零；等高線碰到圓形時則是在平滑處，兩個權重都不為零。

### 最近鄰搜尋

每一種距離函數都會導出最近鄰搜尋問題：給定一個查詢點，找出資料集中與它最接近的點。

在 n 個點、每點 d 個維度的資料集中，精確最近鄰搜尋（exact nearest neighbor search）每次查詢需要 O(n * d) 的時間。資料量大時，這太慢了。

近似最近鄰（approximate nearest neighbor，ANN）演算法用少量準確度換取大幅加速：

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

HNSW（Hierarchical Navigable Small World）是現代向量資料庫的主流演算法。它會建立多層圖，每個節點都連到近似最近鄰。搜尋從頂層（稀疏、可長距離跳躍）開始，逐層往下到最底層（密集、短距離跳躍）。

```figure
norm-unit-balls
```

## Build It｜動手實作

### 步驟 1：實作所有範數與距離函數

完整實作請見 `code/distances.py`。每個函數都只用基本 Python 數學運算，從零建構。

### 步驟 2：同一份資料、不同距離、不同最近鄰

`distances.py` 中的示範會建立資料集、選取查詢點，並展示最近鄰如何隨距離度量改變。在 L1 下「最近」的點，未必也是 L2 或餘弦距離下最近的點。

### 步驟 3：embedding 相似度搜尋（similarity search）

程式碼包含一個模擬 embedding 相似度搜尋的範例，使用餘弦相似度與 L2 距離找出最相似的「文件」，並展示兩者的排名可能不同。

## Use It｜實際應用

最常見的實際用途，是在向量資料庫中尋找相似項目。

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

呼叫 `model.encode(text)`，再搜尋向量資料庫時，背後就是這套流程。embedding 模型會把文字映射成向量。向量資料庫會計算查詢向量與每個儲存向量之間的餘弦相似度（或內積），並使用近似最近鄰演算法，避免逐一檢查所有向量。

## Exercises｜練習

1. 計算 (1, 2, 3) 和 (4, 0, 6) 之間的 L1、L2 和 L-infinity 距離。驗證 L-inf <= L2 <= L1 對任意點對都成立，並證明這個排序為何必然成立。

2. 建立兩個向量，使餘弦相似度很高（> 0.9），但 L2 距離很大（> 10）。從幾何角度說明發生了什麼事。接著再建立兩個餘弦相似度很低（< 0.3）但 L2 距離很小（< 0.5）的向量。

3. 實作一個函數，輸入資料集和查詢點，並分別依 L1、L2、餘弦和馬氏距離回傳最近鄰。找出一份資料集，讓這四種距離得出的最近鄰各不相同。

4. 用 CDF 方法手算 [0.5, 0.5, 0, 0] 和 [0, 0, 0.5, 0.5] 之間的 Wasserstein 距離，再計算 [0.25, 0.25, 0.25, 0.25] 和 [0, 0, 0.5, 0.5] 之間的距離。哪一個比較大？為什麼？

5. 實作 MinHash，近似估計 Jaccard 相似度。產生 100 個隨機集合，計算所有集合配對的精確 Jaccard 相似度，再使用 50、100 和 200 個雜湊函數比較 MinHash 的近似值，並繪製估計誤差。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|----------------------|
| 範數（norm） | 「向量的大小」 | 將向量映射成非負純量的函數，須滿足三角不等式、絕對齊次性，且只有零向量的範數為零。 |
| L1 範數（L1 norm） | 「曼哈頓距離」 | 各分量絕對值的總和。能在最佳化中產生稀疏性，且對離群值穩健。 |
| L2 範數（L2 norm） | 「歐幾里得距離」 | 各分量平方和的平方根，也就是歐幾里得空間中的直線距離。 |
| Lp 範數（Lp norm） | 「廣義範數」 | 各分量絕對值的 p 次方總和，再取 p 次方根。L1 和 L2 都是它的特例。 |
| L-infinity 範數（L-infinity norm） | 「最大範數」或「切比雪夫距離」 | 各分量絕對值的最大值，也是 p 趨近無限大時 Lp 範數的極限。 |
| 餘弦相似度（cosine similarity） | 「向量夾角」 | 將內積除以兩向量長度的乘積。範圍為 -1 到 +1，不考慮向量長度。 |
| 餘弦距離（cosine distance） | 「1 減餘弦相似度」 | 將餘弦相似度轉換成距離，範圍為 0 到 2。 |
| 內積（dot product） | 「未正規化的餘弦相似度」 | 各分量相乘後加總，等於餘弦相似度乘上兩個向量的長度。 |
| 馬氏距離（Mahalanobis distance） | 「納入相關性的距離」 | 在經資料共變異數矩陣白化（去相關並正規化）的空間中計算 L2 距離。 |
| Jaccard 相似度（Jaccard similarity） | 「集合重疊度」 | 交集大小除以聯集大小，適用於集合而非向量。 |
| 編輯距離（edit distance） | 「Levenshtein 距離」 | 將一個字串轉換成另一個字串所需的最少插入、刪除和取代次數。 |
| KL 散度（KL divergence） | 「分布之間的距離」 | 並非真正的距離（不對稱），衡量使用 Q 編碼 P 時多出的資訊位元。 |
| Wasserstein 距離（Wasserstein distance） | 「推土距離」 | 將機率質量從一種分布搬運到另一種所需的最小功；它是真正的距離度量。 |
| 近似最近鄰（ANN） | 「ANN 搜尋」 | HNSW、LSH、IVF 等演算法能比精確搜尋快很多，找到近似最近的點。 |
| HNSW | 「向量資料庫演算法」 | Hierarchical Navigable Small World 圖。用於快速近似最近鄰搜尋的多層圖。 |
| L1 正則化（L1 regularization） | 「LASSO」 | 將權重的 L1 範數加進損失函數，促使部分權重變成零，產生稀疏性。 |
| L2 正則化（L2 regularization） | 「嶺迴歸（Ridge）或 weight decay」 | 將權重的 L2 範數平方加進損失函數，使權重縮小，但不會產生稀疏性。 |
| Elastic Net | 「L1 + L2」 | 結合 L1 和 L2 正則化，比單獨使用任一方法更能處理相關特徵群組。 |

## Further Reading｜延伸閱讀

- [FAISS: A Library for Efficient Similarity Search](https://github.com/facebookresearch/faiss) - Meta 的近似最近鄰搜尋函式庫，可處理十億級資料
- [Wasserstein GAN (Arjovsky et al., 2017)](https://arxiv.org/abs/1701.07875) - 將 Earth Mover's distance 引入 GAN 的論文
- [Locality-Sensitive Hashing (Indyk & Motwani, 1998)](https://dl.acm.org/doi/10.1145/276698.276876) - 近似最近鄰搜尋的基礎演算法
- [Efficient Estimation of Word Representations (Mikolov et al., 2013)](https://arxiv.org/abs/1301.3781) - Word2Vec 論文，餘弦相似度因此成為 embedding 的預設選擇
- [sklearn.neighbors documentation](https://scikit-learn.org/stable/modules/neighbors.html) - scikit-learn 距離度量與最近鄰演算法的實務指南
