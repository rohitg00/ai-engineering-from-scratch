# 詞袋模型、TF-IDF 與文字表示

> 先數，再想。到了 2026 年，在定義清楚的任務上，TF-IDF 依然打得贏嵌入模型。

**類型：** 實作
**程式語言：** Python
**先修單元：** 階段 5 · 01（文字處理）、階段 2 · 02（從零實作線性迴歸）
**時間：** 約 75 分鐘

## 問題所在

模型要的是數字。你手上有的是字串。

每一條 NLP 流程都得回答同一個問題：怎麼把一串長度不定的詞元，變成分類器吃得下的固定長度向量。這個領域最先找到的答案，是所有能用的做法裡最笨的那一個——把詞數一數，做成一個向量。

那個向量撐起的生產級 NLP，比任何嵌入模型都多：垃圾信件過濾器、主題分類器、日誌異常偵測、搜尋排序（BM25 之前）、第一波情感分析、學術 NLP 基準測試的第一個十年。2026 年的實務工作者在面對範圍狹窄的分類任務時，還是會先伸手去拿它。它快、可解讀，而且在「詞有沒有出現」才是重點的任務上，常常和一個 4 億參數的嵌入模型看不出差別。

這個單元會從零打造詞袋模型，接著做 TF-IDF。然後展示 scikit-learn 用三行做完同一件事。最後點名那個會逼你去改用嵌入的失效模式。

## 核心概念

**詞袋模型（Bag of Words, BoW）** 把順序丟掉。對每一份文件，數一數詞彙表裡的每個詞出現了幾次。向量長度就是詞彙表大小。位置 `i` 是詞 `i` 的出現次數。

**TF-IDF** 替詞袋模型重新配權重。一個在每份文件裡都出現的詞不帶資訊，所以把它調小。一個在整個語料庫裡稀有、卻在某一份文件裡頻繁出現的詞是訊號，所以把它調大。

```math
\begin{aligned}
\text{TF-IDF}(w, d) &= \text{TF}(w, d) \cdot \text{IDF}(w) \\
&= \frac{\mathop{\mathrm{count}}(w \text{ in } d)}{|d|} \cdot \log\frac{N}{\mathop{\mathrm{df}}(w)}
\end{aligned}
```

其中 `TF` 是該詞在該文件裡的詞頻，`df` 是文件頻率（有幾份文件含有這個詞），`N` 是文件總數。那個 `log` 讓無所不在的詞的權重不會失控。

關鍵性質：兩者產生的都是帶有可解讀座標軸的稀疏向量。你可以攤開一個訓練好的分類器的權重，直接讀出哪些詞把一份文件推向哪個類別。用 768 維的 BERT 嵌入，你做不到這件事。

```figure
bow-tfidf
```

## 動手實作

### 步驟 1：建立詞彙表

```python
def build_vocab(docs):
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    return vocab
```

輸入：一串已分詞的文件（任何詞層級的分詞器都行；本單元的 `code/main.py` 用的是簡化過的小寫版本）。輸出：`{word: index}` 字典。插入順序穩定，意思是索引 0 的詞就是第一份文件裡看到的第一個詞。慣例各家不同；scikit-learn 會按字母排序。

### 步驟 2：詞袋模型

```python
def bag_of_words(docs, vocab):
    matrix = [[0] * len(vocab) for _ in docs]
    for i, doc in enumerate(docs):
        for token in doc:
            if token in vocab:
                matrix[i][vocab[token]] += 1
    return matrix
```

```python
>>> docs = [["cat", "sat", "on", "mat"], ["cat", "cat", "ran"]]
>>> vocab = build_vocab(docs)
>>> bag_of_words(docs, vocab)
[[1, 1, 1, 1, 0], [2, 0, 0, 0, 1]]
```

每一列是一份文件。每一欄是一個詞彙表索引。第 `[i][j]` 格是「詞 `j` 在文件 `i` 裡出現了幾次」。文件 1 的 `cat` 是 2，因為它真的出現兩次。文件 0 的 `ran` 是 0，因為它真的沒出現。

### 步驟 3：詞頻與文件頻率

```python
import math


def term_frequency(doc_bow, doc_length):
    return [c / doc_length if doc_length else 0 for c in doc_bow]


def document_frequency(bow_matrix):
    df = [0] * len(bow_matrix[0])
    for row in bow_matrix:
        for j, count in enumerate(row):
            if count > 0:
                df[j] += 1
    return df


def inverse_document_frequency(df, n_docs):
    return [math.log((n_docs + 1) / (d + 1)) + 1 for d in df]
```

有兩個平滑技巧值得點名。`(n+1)/(d+1)` 避開 `log(x/0)`。結尾那個 `+1` 保證一個出現在所有文件裡的詞，IDF 仍然是 1（而不是 0），這和 scikit-learn 的預設一致。其他實作用的是原始的 `log(N/df)`。兩種都能用；平滑過的版本比較友善。

### 步驟 4：TF-IDF

```python
def tfidf(bow_matrix):
    n_docs = len(bow_matrix)
    df = document_frequency(bow_matrix)
    idf = inverse_document_frequency(df, n_docs)
    out = []
    for row in bow_matrix:
        length = sum(row)
        tf = term_frequency(row, length)
        out.append([tf_j * idf_j for tf_j, idf_j in zip(tf, idf)])
    return out
```

```python
>>> docs = [
...     ["the", "cat", "sat"],
...     ["the", "dog", "sat"],
...     ["the", "cat", "ran"],
... ]
>>> vocab = build_vocab(docs)
>>> bow = bag_of_words(docs, vocab)
>>> tfidf(bow)
```

三份文件，五個詞彙表詞（`the`、`cat`、`sat`、`dog`、`ran`）。`the` 在三份文件裡都出現，所以 IDF 很低。`dog` 只在一份裡出現，所以 IDF 很高。這些文件向量是稀疏的（大多數格子都很小），有辨識力的詞會跳出來。

### 步驟 5：對每一列做 L2 正規化

```python
def l2_normalize(matrix):
    out = []
    for row in matrix:
        norm = math.sqrt(sum(x * x for x in row))
        out.append([x / norm if norm else 0 for x in row])
    return out
```

不做正規化的話，較長的文件會拿到較大的向量，把相似度分數整個壓過去。L2 正規化把每一份文件都放到單位超球面上。這樣一來，兩列之間的餘弦相似度就只是一個內積。

## 框架應用

scikit-learn 附了生產級的版本。

```python
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer

docs = ["the cat sat on the mat", "the dog sat on the mat", "the cat ran"]

bow_vectorizer = CountVectorizer()
bow = bow_vectorizer.fit_transform(docs)
print(bow_vectorizer.get_feature_names_out())
print(bow.toarray())

tfidf_vectorizer = TfidfVectorizer()
tfidf = tfidf_vectorizer.fit_transform(docs)
print(tfidf.toarray().round(3))
```

`CountVectorizer` 一次呼叫就做完分詞、詞彙表與詞袋模型。`TfidfVectorizer` 再加上 IDF 加權與 L2 正規化。兩者回傳的都是稀疏矩陣。對 10 萬份文件來說，稠密版本塞不進記憶體；在分類器真的要求稠密之前，就一直保持稀疏。

會徹底改變結果的旋鈕：

| 參數 | 效果 |
|-----|--------|
| `ngram_range=(1, 2)` | 納入 bigram。通常能提升分類效果。 |
| `min_df=2` | 丟掉出現在少於 2 份文件裡的詞。在雜訊多的資料上能修剪詞彙表。 |
| `max_df=0.95` | 丟掉出現在超過 95% 文件裡的詞。不用寫死清單就能近似停用詞移除。 |
| `stop_words="english"` | scikit-learn 內建的停用詞清單。看任務而定——情感分析*不該*丟掉否定詞。 |
| `sublinear_tf=True` | 用 `1 + log(tf)` 取代原始的 `tf`。當某個詞在一份文件裡重複很多次時有幫助。 |

### TF-IDF 至今仍然勝出的地方（截至 2026 年）

- 垃圾信件偵測、主題標註、日誌異常標記。重點是詞有沒有出現；語意上的細微差別不重要。
- 資料很少的情境（幾百個標註樣本）。TF-IDF 加上邏輯迴歸沒有預訓練成本。
- 任何在意延遲的地方。TF-IDF 加一個線性模型在微秒級就給出答案。把一份文件送過 transformer 做嵌入要 10-100ms。
- 必須解釋自己預測結果的系統。去看分類器的係數，排在最前面的正向詞就是理由。

### TF-IDF 失效的時候

語意盲的失效。看看這兩份文件：

- "The movie was not good at all."
- "The movie was excellent."

一則是負評，一則是正評。它們的 TF-IDF 交集恰好是 `{the, movie, was}`。一個詞袋模型分類器必須硬記住「`not` 出現在 `good` 附近會翻轉標籤」這件事。資料夠多它學得起來，但永遠不會像懂語法的模型那樣優雅。

另一個失效：推論時遇到詞彙表外的詞。一個在 IMDb 評論上訓練的詞袋模型，碰到 `Zoomer-approved` 完全不知道該怎麼辦——如果這個詞元從沒在訓練時出現過。子詞嵌入（單元 04）能處理這件事。TF-IDF 不行。

### 混合做法：TF-IDF 加權的嵌入

2026 年在中等資料量分類上的務實預設做法：把 TF-IDF 的特徵權重當成詞嵌入上的注意力。

```python
def tfidf_weighted_embedding(doc, tfidf_scores, embedding_table, dim):
    vec = [0.0] * dim
    total_weight = 0.0
    for token in doc:
        if token not in embedding_table or token not in tfidf_scores:
            continue
        weight = tfidf_scores[token]
        emb = embedding_table[token]
        for i in range(dim):
            vec[i] += weight * emb[i]
        total_weight += weight
    if total_weight == 0:
        return vec
    return [v / total_weight for v in vec]
```

你從嵌入那邊拿到語意容量，從 TF-IDF 那邊拿到對稀有詞的強調。分類器就在這個池化後的向量上訓練。在標註樣本大約 5 萬以下時，這在情感、主題與意圖分類上都勝過單獨使用任何一邊。

## 產出交付

存成 `outputs/prompt-vectorization-picker.md`：

```markdown
---
name: vectorization-picker
description: Given a text-classification task, recommend BoW, TF-IDF, embeddings, or a hybrid.
phase: 5
lesson: 02
---

You recommend a text-vectorization strategy. Given a task description, output:

1. Representation (BoW, TF-IDF, transformer embeddings, or a hybrid). Explain why in one sentence.
2. Specific vectorizer configuration. Name the library. Quote the arguments (`ngram_range`, `min_df`, `max_df`, `sublinear_tf`, `stop_words`).
3. One failure mode to test before shipping.

Refuse to recommend embeddings when the user has under 500 labeled examples unless they show evidence of semantic failure in a TF-IDF baseline. Refuse to remove stopwords for sentiment analysis (negations carry signal). Flag class imbalance as needing more than a vectorizer change.

Example input: "Classifying 30k customer support tickets into 12 categories. Most tickets are 2-3 sentences. English only. Need explainability for audit logs."

Example output:

- Representation: TF-IDF. 30k examples is not small; explainability requirement rules out dense embeddings.
- Config: `TfidfVectorizer(ngram_range=(1, 2), min_df=3, max_df=0.95, sublinear_tf=True, stop_words=None)`. Keep stopwords because category keywords sometimes are stopwords ("not working" vs "working").
- Failure to test: verify `min_df=3` does not drop rare category keywords. Run `get_feature_names_out` filtered by class and eyeball.
```

## 練習

1. **簡單。** 在 L2 正規化過的 TF-IDF 輸出上實作 `cosine_similarity(doc_vec_a, doc_vec_b)`。驗證相同的文件分數是 1.0，詞彙表互不相交的文件分數是 0.0。
2. **中等。** 為 `bag_of_words` 加上 `n-gram` 支援。參數 `n` 會產生 `n`-gram 的計數。測試 `n=2` 套用在 `["the", "cat", "sat"]` 上會產生 `["the cat", "cat sat"]` 的 bigram 計數。
3. **困難。** 用 GloVe 100 維向量打造上面那個 TF-IDF 加權嵌入的混合做法（下載一次，然後快取）。在 20 Newsgroups 資料集上，把它的分類準確率和純 TF-IDF、純平均池化嵌入做比較。回報哪一種在哪裡勝出。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|-----------------|-----------------------|
| BoW | 「詞頻向量」 | 詞彙表裡各個詞在一份文件中的出現次數。把順序丟掉。 |
| TF | 「詞頻」 | 一個詞在一份文件裡的出現次數，可選擇用文件長度正規化。 |
| DF | 「文件頻率」 | 至少含有這個詞一次的文件數。 |
| IDF | 「逆文件頻率」 | 平滑過的 `log(N / df)`。把到處都出現的詞調低權重。 |
| 稀疏向量 | 「幾乎都是零」 | 詞彙表通常有 1 萬到 10 萬個詞；對任一份文件來說，大多數都不存在。 |
| 餘弦相似度 | 「向量夾角」 | L2 正規化向量的內積。1 是完全相同，0 是正交。 |

## 延伸閱讀

- [scikit-learn — feature extraction from text](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) —— 標準 API 參考，還附上每一個旋鈕的說明。
- [Salton, G., & Buckley, C. (1988). Term-weighting approaches in automatic text retrieval](https://www.sciencedirect.com/science/article/pii/0306457388900210) —— 讓 TF-IDF 成為十年預設做法的那篇論文。
- ["Why TF-IDF Still Beats Embeddings" — Ashfaque Thonikkadavan (Medium)](https://medium.com/@cmtwskb/why-tf-idf-still-beats-embeddings-ad85c123e1b2) —— 2026 年的觀點：舊方法什麼時候勝出，以及為什麼。
