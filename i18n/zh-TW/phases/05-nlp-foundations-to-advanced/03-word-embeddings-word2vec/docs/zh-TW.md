# word embedding：從零做出 Word2Vec

> 一個詞就是它身邊的那些詞。用這個想法訓練一個淺層網路，幾何就自己出現。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 3 · 03 (Backpropagation from Scratch)
**Time:** ~75 minutes

## The Problem｜問題

TF-IDF 知道 `dog` 和 `puppy` 是不同的詞。它不知道兩者意思幾乎一樣。在 `dog` 上訓練的分類器（classifier），無法泛化（generalize）到一篇寫著 `puppy` 的評論。你可以列同義詞糊過去，但稀有詞、領域行話，以及你沒預料到的每種語言，都會失敗。

你要的表示法，是讓 `dog` 和 `puppy` 在空間裡靠在一起。讓 `king - man + woman` 落在 `queen` 附近。讓在 `dog` 上訓練的模型，免費把一些訊號轉給 `puppy`。

Word2Vec 給了我們那個空間。兩層神經網路（neural network），以兆計 token 的訓練，2013 年發表。架構簡單到幾乎不好意思。結果重塑了之後十年的自然語言處理。

## The Concept｜核心概念

**分布假說（distributional hypothesis）**——Firth，1957：「一個詞是什麼，看它跟誰在一起。」如果兩個詞出現在相似的脈絡，它們的意思大概也相似。

Word2Vec 有兩種做法，都在用這個想法。

- **skip-gram。** 給定中心詞，預測周圍的詞。`cat -> (the, sat, on)`，視窗（window）大小是 2。
- **CBOW（continuous bag of words）。** 給定周圍的詞，預測中心詞。`(the, sat, on) -> cat`。

skip-gram 訓練較慢，但稀有詞處理得比較好。它成了預設。

網路有一個隱藏層（hidden layer），沒有非線性。輸入是詞彙表（vocabulary）上的 one-hot 向量（one-hot vector）。輸出是詞彙表上的 softmax。訓練完就把輸出層丟掉。隱藏層的權重就是 embedding。

```
one-hot(center) ── W ──▶ hidden (d-dim) ── W' ──▶ softmax(vocab)
                          ^
                          this is the embedding
```

關鍵手法：對 10 萬個詞做 softmax 貴到做不到。Word2Vec 用**負採樣（negative sampling）**把它變成二元分類。預測「這個脈絡詞有沒有出現在這個中心詞附近，是或否」。每個訓練配對只抽幾個負例（沒有一起出現的詞），而不是對整個詞彙表算 softmax。

```figure
word-vector-arithmetic
```

## Build It｜動手實作

### 步驟 1：從語料庫（corpus）做出訓練配對

```python
def skipgram_pairs(docs, window=2):
    pairs = []
    for doc in docs:
        for i, center in enumerate(doc):
            for j in range(max(0, i - window), min(len(doc), i + window + 1)):
                if i == j:
                    continue
                pairs.append((center, doc[j]))
    return pairs
```

```python
>>> skipgram_pairs([["the", "cat", "sat", "on", "mat"]], window=2)
[('the', 'cat'), ('the', 'sat'),
 ('cat', 'the'), ('cat', 'sat'), ('cat', 'on'),
 ('sat', 'the'), ('sat', 'cat'), ('sat', 'on'), ('sat', 'mat'),
 ...]
```

視窗裡每一組（中心，脈絡）都是一個正例。

### 步驟 2：embedding 表

兩張矩陣。`W` 是中心詞的 embedding 表（你留下的那張）。`W'` 是脈絡詞的表（常常丟掉，有時和 `W` 取平均）。

```python
import numpy as np


def init_embeddings(vocab_size, dim, seed=0):
    rng = np.random.default_rng(seed)
    W = rng.normal(0, 0.1, size=(vocab_size, dim))
    W_prime = rng.normal(0, 0.1, size=(vocab_size, dim))
    return W, W_prime
```

小的隨機初始化。詞彙大小 1 萬、維度（dimension）100 算貼近實務；教學用 50 個詞乘 16 維，就看得到幾何。

### 步驟 3：負採樣的目標

對每個正配對 `(center, context)`，從詞彙表抽 `k` 個隨機詞當負例。訓練模型，讓正例的內積（dot product）`W[center] · W'[context]` 高，負例的內積低。

```python
def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -20, 20)))


def train_pair(W, W_prime, center_idx, context_idx, negative_indices, lr):
    v_c = W[center_idx]
    u_pos = W_prime[context_idx]
    u_negs = W_prime[negative_indices]

    pos_score = sigmoid(v_c @ u_pos)
    neg_scores = sigmoid(u_negs @ v_c)

    grad_center = (pos_score - 1) * u_pos
    for i, u in enumerate(u_negs):
        grad_center += neg_scores[i] * u

    W[context_idx] = W[context_idx]
    W_prime[context_idx] -= lr * (pos_score - 1) * v_c
    for i, neg_idx in enumerate(negative_indices):
        W_prime[neg_idx] -= lr * neg_scores[i] * v_c
    W[center_idx] -= lr * grad_center
```

關鍵公式是正配對的邏輯斯損失（logistic loss）——希望 sigmoid 接近 1——再加上負配對的邏輯斯損失，希望 sigmoid 接近 0。梯度流向兩張表。完整推導在原論文；想記住的話，用紙筆走一次。

### 步驟 4：在玩具語料庫上訓練

```python
def train(docs, dim=16, window=2, k_neg=5, epochs=100, lr=0.05, seed=0):
    vocab = build_vocab(docs)
    vocab_size = len(vocab)
    rng = np.random.default_rng(seed)
    W, W_prime = init_embeddings(vocab_size, dim, seed=seed)
    pairs = skipgram_pairs(docs, window=window)

    for epoch in range(epochs):
        rng.shuffle(pairs)
        for center, context in pairs:
            c_idx = vocab[center]
            ctx_idx = vocab[context]
            negs = rng.integers(0, vocab_size, size=k_neg)
            negs = [n for n in negs if n != ctx_idx and n != c_idx]
            train_pair(W, W_prime, c_idx, ctx_idx, negs, lr)
    return vocab, W
```

在大型語料庫上跑夠多 epoch（訓練週期）之後，共享脈絡的詞，中心 embedding 會很像。玩具語料庫上只隱約看得到。在數十億個 token 上，效果就非常明顯。

### 步驟 5：類比這個技巧

```python
def nearest(vocab, W, target_vec, topk=5, exclude=None):
    exclude = exclude or set()
    inv_vocab = {i: w for w, i in vocab.items()}
    norms = np.linalg.norm(W, axis=1, keepdims=True) + 1e-9
    W_norm = W / norms
    target = target_vec / (np.linalg.norm(target_vec) + 1e-9)
    sims = W_norm @ target
    order = np.argsort(-sims)
    out = []
    for i in order:
        if i in exclude:
            continue
        out.append((inv_vocab[i], float(sims[i])))
        if len(out) == topk:
            break
    return out


def analogy(vocab, W, a, b, c, topk=5):
    v = W[vocab[b]] - W[vocab[a]] + W[vocab[c]]
    return nearest(vocab, W, v, topk=topk, exclude={vocab[a], vocab[b], vocab[c]})
```

在預訓練的 300 維 Google News 向量上：

```python
>>> analogy(vocab, W, "man", "king", "woman")
[('queen', 0.71), ('monarch', 0.62), ('princess', 0.59), ...]
```

`king - man + woman = queen`。不是因為模型知道王室是什麼。是因為向量 `(king - man)` 抓到類似「王室」的東西，加到 `woman` 上就落在王室女性那一區附近。

## Use It｜實際應用

從零寫 Word2Vec 是為了教學。正式環境的自然語言處理用 `gensim`。

```python
from gensim.models import Word2Vec

sentences = [
    ["the", "cat", "sat", "on", "the", "mat"],
    ["the", "dog", "ran", "across", "the", "room"],
]

model = Word2Vec(
    sentences,
    vector_size=100,
    window=5,
    min_count=1,
    sg=1,
    negative=5,
    workers=4,
    epochs=30,
)

print(model.wv["cat"])
print(model.wv.most_similar("cat", topn=3))
```

實際應用時，你幾乎不會自己訓練 Word2Vec。你下載預訓練向量。

- **GloVe** — Stanford 的共現矩陣分解。50、100、200、300 維的預訓練向量版本。一般涵蓋不錯。第 04 課專門講 GloVe。
- **fastText** — Facebook 把 Word2Vec 擴充成對字元 n-gram 做 embedding。用子詞組合（subword composition）處理詞彙表外（out-of-vocabulary，OOV）的詞。第 04 課。
- **Google News 上預訓練的 Word2Vec** — 300 維、300 萬詞的詞彙表，2013 年發表。到現在每天仍有人下載。

### Word2Vec 在 2026 年什麼時候仍然贏

- 輕量、特定領域的檢索。在筆電上花一小時訓練醫學摘要，得到通用模型抓不到的專門向量。
- 類比式的特徵工程（feature engineering）。`gender_vector = mean(man - woman pairs)`。從其他詞減掉它，得到一條性別中性的軸。公平性研究仍在用。
- 可解釋性。100 維小到可以用主成分分析（PCA）或 t-SNE 畫出來，真的看見分群成形。
- 推論（inference）必須在沒有 GPU 的裝置（device）上跑的地方。Word2Vec 查表就是取一列。

### Word2Vec 在哪裡失敗

一詞多義（polysemy）這道牆。`bank` 只有一個向量。`river bank` 和 `financial bank` 共用它。`table`（試算表對上家具）也共用。下游的分類器無法從這個向量分辨詞義。

contextual embedding（ELMo、BERT，以及之後每個 transformer）解決了這件事：依周圍脈絡，為這個詞的每次出現產出不同向量。那就是從 Word2Vec 跳到 BERT：從 static embedding 到 contextual embedding。第 7 階段講 transformer 那一半。

另一個失敗是詞彙表外（out-of-vocabulary，OOV）。如果訓練資料沒有 `Zoomer-approved`，Word2Vec 就沒看過。沒有退路。fastText 用子詞組合修這件事（第 04 課）。

## Ship It｜交付成果

存成 `outputs/skill-embedding-probe.md`：

```markdown
---
name: embedding-probe
description: Inspect a word2vec model. Run analogies, find neighbors, diagnose quality.
version: 1.0.0
phase: 5
lesson: 03
tags: [nlp, embeddings, debugging]
---

You probe trained word embeddings to verify they are working. Given a `gensim.models.KeyedVectors` object and a vocabulary, you run:

1. Three canonical analogy tests. `king : man :: queen : woman`. `paris : france :: tokyo : japan`. `walking : walked :: swimming : ?`. Report the top-1 result and its cosine.
2. Five nearest-neighbor tests on domain-specific words the user supplies. Print top-5 neighbors with cosines.
3. One symmetry check. `similarity(a, b) == similarity(b, a)` to within float precision.
4. One degenerate check. If any embedding has a norm below 0.01 or above 100, the model has a training bug. Flag it.

Refuse to declare a model good on analogy accuracy alone. Analogy benchmarks are gameable and do not transfer to downstream tasks. Recommend intrinsic + downstream evaluation together.
```

## Exercises｜練習

1. **簡單。** 在很小的語料庫（20 句貓和狗）上跑訓練迴圈。200 個 epoch 之後，驗證 `nearest(vocab, W, W[vocab["cat"]])` 的前 3 名有 `dog`。若沒有，增加 epoch 或詞彙。
2. **中等。** 加上常見詞的子取樣（subsampling）。頻率高於 `10^-5` 的詞，以和頻率成比例的機率從訓練配對裡丟掉。衡量對稀有詞相似度的影響。
3. **困難。** 在 20 Newsgroups 資料集（dataset）上訓練一個模型。算兩條偏見（bias）軸：`he - she` 和 `doctor - nurse`。把職業詞投影到兩條軸上。回報哪些職業的偏見差距最大。這是公平性研究者用的那種探查。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| word embedding | 把詞當成向量 | 從脈絡學來的稠密、低維（通常 100 到 300）表示。 |
| skip-gram | Word2Vec 的手法 | 由中心詞預測脈絡詞。比 CBOW 慢，稀有詞比較好。 |
| 負採樣 | 訓練捷徑 | 用對 `k` 個隨機詞的二元分類，取代整個詞彙表上的 softmax。 |
| static embedding | 一個詞一個向量 | 不管脈絡，向量都一樣。一詞多義時失敗。 |
| contextual embedding | 看脈絡的向量 | 依周圍的詞，每次出現給不同向量。transformer 產出的就是這個。 |
| OOV | 詞彙表外（out-of-vocabulary，OOV） | 訓練時沒看過的詞。Word2Vec 無法為它們產出向量。 |

## Further Reading｜延伸閱讀

- [Mikolov et al. (2013). Distributed Representations of Words and Phrases and their Compositionality](https://arxiv.org/abs/1310.4546) ——負採樣那篇論文。短，也好讀。
- [Rong, X. (2014). word2vec Parameter Learning Explained](https://arxiv.org/abs/1411.2738) ——梯度推導最清楚的一篇；原論文的數學若覺得密，看這篇。
- [gensim Word2Vec tutorial](https://radimrehurek.com/gensim/models/word2vec.html) ——正式環境裡真的行得通的訓練設定。
