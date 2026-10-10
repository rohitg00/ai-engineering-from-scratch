# 詞袋（bag of words）、TF-IDF 與文字表示

> 先計數，再思考。在定義清楚的任務上，TF-IDF 到 2026 年仍然打得過 embedding。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 02 (Linear Regression from Scratch)
**Time:** ~75 minutes

## The Problem｜問題

模型要的是數字。你手上是字串。

每條自然語言處理管線（pipeline）都要回答同一個問題。怎麼把長度不固定的 token 串，變成分類器（classifier）吃得下的固定長度向量。這個領域最早落到的答案，就是那個最笨、但行得通的做法。把詞數一數。做成一個向量。

這個向量撐起的正式環境自然語言處理，比任何 embedding 模型都多。垃圾郵件篩選器、主題分類器、日誌異常偵測、搜尋排序（BM25 之前）、第一波情感分析、學術自然語言處理基準的第一個十年。2026 年的實作者，在範圍窄的分類任務上仍會先伸手拿它。它快、可解釋，而且在「詞在不在」才要緊的任務上，常常和 4 億參數的 embedding 模型分不出來。

這一課從零做出詞袋，再做出 TF-IDF。接著看 scikit-learn 怎麼用三行做同一件事。最後點名那個會讓你改拿 embedding 的失敗方式。

## The Concept｜核心概念

**詞袋（BoW）**丟掉順序。每份文件計數詞彙表（vocabulary）裡每個詞出現幾次。向量長度就是詞彙表大小。位置 `i` 是詞 `i` 的次數。

**TF-IDF**重新加權詞袋。每個文件都出現的詞沒有資訊，所以把它縮小。在語料庫（corpus）裡稀有、但在單一份文件裡頻繁的詞是訊號，所以把它放大。

```
TF-IDF(w, d) = TF(w, d) * IDF(w)
             = count(w in d) / |d| * log(N / df(w))
```

其中 `TF` 是文件裡的詞頻（term frequency），`df` 是文件頻率（document frequency，有多少份文件含有這個詞），`N` 是文件總數。`log` 讓到處都出現的詞，權重有個上限。

關鍵性質：兩者都產出稀疏向量（sparse vector），而且每個軸都讀得懂。你可以看訓練好的分類器權重，讀出哪些詞把文件推向哪一類。768 維的 BERT embedding 做不到這件事。

```figure
bow-tfidf
```

## Build It｜動手實作

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

輸入：已做完 tokenization 的文件清單（任何詞級 tokenizer 都可以；這一課的 `code/main.py` 用的是簡化的小寫版）。輸出：`{word: index}` 字典。插入順序穩定，所以索引 0 是第一份文件裡第一個看到的詞。慣例各家不同；scikit-learn 依字母排序。

### 步驟 2：詞袋

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

列是文件。欄是詞彙表索引。格子 `[i][j]` 是「詞 `j` 在文件 `i` 裡出現幾次」。文件 1 的 `cat` 是兩次，因為它確實出現兩次。文件 0 的 `ran` 是零次，因為它沒出現。

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

兩個平滑技巧值得點名。`(n+1)/(d+1)` 避開 `log(x/0)`。尾端的 `+1` 讓出現在每一份文件裡的詞，逆文件頻率（inverse document frequency）仍是 1（不是 0），對上 scikit-learn 的預設。別的實作用原始的 `log(N/df)`。兩種都行；平滑版比較不容易踩到除以零。

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

三份文件，五個詞彙（`the`、`cat`、`sat`、`dog`、`ran`）。`the` 三份都有，所以它的逆文件頻率低。`dog` 只在一份出現，所以它的逆文件頻率高。向量是稀疏的（多數元素很小），有區別力的詞會跳出來。

### 步驟 5：把每一列做 L2 正規化（normalization）

```python
def l2_normalize(matrix):
    out = []
    for row in matrix:
        norm = math.sqrt(sum(x * x for x in row))
        out.append([x / norm if norm else 0 for x in row])
    return out
```

沒有正規化時，較長的文件向量較大，會主導相似度分數。L2 正規化把每份文件放到單位超球面上。列與列之間的餘弦相似度（cosine similarity）這時就只是內積。

## Use It｜實際應用

scikit-learn 交付的是正式環境版本。

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

`CountVectorizer` 一次呼叫就做完 tokenization、詞彙表和詞袋。`TfidfVectorizer` 再加逆文件頻率加權和 L2 正規化。兩者都回傳稀疏矩陣（sparse matrix）。10 萬份文件時，稠密版放不進記憶體（memory）；在分類器要求稠密之前，保持稀疏。

會把結果整個改掉的旋鈕：

| 參數 | 效果 |
|-----|--------|
| `ngram_range=(1, 2)` | 納入二元 n-gram。通常對分類有幫助。 |
| `min_df=2` | 丟掉出現在少於 2 份文件的詞。在雜訊資料上把詞彙表削小。 |
| `max_df=0.95` | 丟掉出現在超過 95% 文件的詞。近似於拿掉停用詞（stopword），又不必寫死一份清單。 |
| `stop_words="english"` | scikit-learn 內建的停用詞清單。看任務——情感分析不該丟掉否定詞。 |
| `sublinear_tf=True` | 用 `1 + log(tf)` 取代原始 `tf`。一個詞在同一份文件裡重複很多次時有幫助。 |

### TF-IDF 什麼時候仍然贏（截至 2026 年）

- 垃圾郵件偵測、主題標註、日誌異常標記。要緊的是詞在不在；語意的細緻差別不要緊。
- 資料量較少的情境（幾百筆標好的例子）。TF-IDF 加上邏輯斯迴歸（logistic regression）沒有預訓練成本。
- 延遲要緊的地方。TF-IDF 加線性模型，微秒就回答。把一份文件送進 transformer 做 embedding，要 10 到 100 毫秒。
- 必須解釋自己預測的系統。檢查分類器的係數。係數最高的正向詞就是模型做出該預測的依據。

### TF-IDF 什麼時候失敗

語意理解不足的問題。看這兩份文件：

- 「The movie was not good at all.」
- 「The movie was excellent.」

一份是負評。一份是正評。它們的 TF-IDF 重疊正好是 `{the, movie, was}`。詞袋分類器必須記住：`not` 出現在 `good` 附近會把標籤（label）翻過來。資料夠多時它學得會，但永遠不像懂句法的模型那樣順。

另一種失敗：推論（inference）時碰到詞彙表外詞（out-of-vocabulary word）。在 IMDb 評論上訓練的詞袋模型，如果 `Zoomer-approved` 這個 token 訓練時沒出現過，就不知道怎麼辦。子詞 embedding（subword embedding）（第 04 課）處理得了。TF-IDF 不行。

### 混合：用 TF-IDF 加權的 embedding

2026 年、中等資料量分類的務實預設：把 TF-IDF 權重當成 word embedding 上的注意力（attention）。

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

你從 embedding 得到語意容量，從 TF-IDF 得到對稀有詞的強調。分類器在池化後的向量上訓練。標好的例子大約在 5 萬筆以下時，情感、主題、意圖分類上，這比單獨用任何一邊都好。

## Ship It｜交付成果

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

## Exercises｜練習

1. **簡單。** 在 L2 正規化後的 TF-IDF 輸出上實作 `cosine_similarity(doc_vec_a, doc_vec_b)`。驗證相同文件分數是 1.0，詞彙完全不相交的文件分數是 0.0。
2. **中等。** 為 `bag_of_words` 加上 `n-gram`。參數 `n` 產出 `n`-gram 的計數。測試 `n=2` 作用在 `["the", "cat", "sat"]` 時，會為 `["the cat", "cat sat"]` 產出二元 n-gram 計數。
3. **困難。** 用 GloVe 100 維向量（下載一次，放進快取）做出上面那個 TF-IDF 加權 embedding 的混合。在 20 Newsgroups 資料集（dataset）上，和純 TF-IDF、純平均池化 embedding 比分類準確率。回報哪一種在哪裡贏。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 詞袋 | 詞頻向量 | 一份文件裡詞彙表各詞的次數。丟掉順序。 |
| 詞頻 | 詞出現的頻率 | 一個詞在一份文件裡的次數，可以選擇再用文件長度正規化。 |
| 文件頻率 | 有多少份文件含有這個詞 | 至少含有這個詞一次的文件數。 |
| 逆文件頻率 | 把常見詞壓低的權重 | 平滑過的 `log(N / df)`。把到處出現的詞權重壓低。 |
| 稀疏向量 | 大部分是零 | 詞彙表通常有 1 萬到 10 萬個詞；任一文件裡多數詞都不在。 |
| 餘弦相似度 | 向量夾角 | L2 正規化向量的內積。1 是相同，0 是正交。 |

## Further Reading｜延伸閱讀

- [scikit-learn — feature extraction from text](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) ——標準的 API 參考，每個旋鈕都有說明。
- [Salton, G., & Buckley, C. (1988). Term-weighting approaches in automatic text retrieval](https://www.sciencedirect.com/science/article/pii/0306457388900210) ——讓 TF-IDF 成為那十年預設的論文。
- ["Why TF-IDF Still Beats Embeddings" — Ashfaque Thonikkadavan (Medium)](https://medium.com/@cmtwskb/why-tf-idf-still-beats-embeddings-ad85c123e1b2) ——2026 年對舊方法何時會贏、以及為什麼的看法。
