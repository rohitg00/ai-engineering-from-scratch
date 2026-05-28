# 単語埋め込み — Word2Vecをスクラッチから

> 単語は、その周囲に現れる単語によって理解できる。この考え方で浅いネットワークを学習すると、幾何構造が現れる。

**種類:** 実装
**言語:** Python
**前提:** フェーズ 5 · 02 (BoW + TF-IDF)、フェーズ 3 · 03 (Backpropagation from Scratch)
**時間:** 約75分

## 問題

TF-IDFは、`dog` と `puppy` が別の単語であることは分かります。しかし、それらがほぼ同じ意味を持つことは分かりません。`dog` で学習した分類器は、`puppy` について書かれたレビューへうまく一般化できません。同義語リストでごまかすこともできますが、まれな語、ドメイン固有の専門用語、想定していなかったあらゆる言語で破綻します。

欲しいのは、`dog` と `puppy` が空間上で近い位置に来る表現です。`king - man + woman` が `queen` の近くに来る表現です。`dog` で学習したモデルの信号が、追加コストなしで `puppy` にも少し伝わる表現です。

Word2Vecはその空間を与えました。2層ニューラルネットワーク、1兆トークン規模の学習、2013年の発表。アーキテクチャは拍子抜けするほど単純です。それでも結果は、その後10年のNLPを作り替えました。

## コンセプト

**分布仮説** (Firth, 1957): "You shall know a word by the company it keeps." 2つの単語が似た文脈に現れるなら、おそらく意味も似ています。

Word2Vecには、この考え方を使う2つの方式があります。

- **Skip-gram。** 中心語から周辺語を予測します。ウィンドウサイズ2なら `cat -> (the, sat, on)` です。
- **CBOW (continuous bag of words)。** 周辺語から中心語を予測します。`(the, sat, on) -> cat` です。

Skip-gramは学習が遅い一方で、まれな語をよりよく扱えます。そのため標準的な選択になりました。

ネットワークは非線形性のない隠れ層を1つ持ちます。入力は語彙上のone-hotベクトルです。出力は語彙全体へのsoftmaxです。学習後、出力層は捨てます。隠れ層の重みが埋め込みになります。

```
one-hot(center) ── W ──▶ hidden (d-dim) ── W' ──▶ softmax(vocab)
                          ^
                          this is the embedding
```

問題は、10万語に対するsoftmaxが非常に高コストであることです。Word2Vecは**負例サンプリング**を使い、これを二値分類タスクに変えます。「この文脈語はこの中心語の近くに現れたか、はい/いいえ」を予測します。語彙全体にsoftmaxを計算する代わりに、各学習ペアごとに少数の負例、つまり共起していない単語をサンプルします。

## 実装

### ステップ1: コーパスから学習ペアを作る

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

ウィンドウ内のすべての `(center, context)` ペアが正例の学習サンプルになります。

### ステップ2: 埋め込みテーブル

行列は2つあります。`W` は中心語の埋め込みテーブルで、最終的に保持するものです。`W'` は文脈語のテーブルで、多くの場合は捨てますが、`W` と平均することもあります。

```python
import numpy as np


def init_embeddings(vocab_size, dim, seed=0):
    rng = np.random.default_rng(seed)
    W = rng.normal(0, 0.1, size=(vocab_size, dim))
    W_prime = rng.normal(0, 0.1, size=(vocab_size, dim))
    return W, W_prime
```

小さな乱数で初期化します。語彙サイズ10k、次元100は現実的な規模です。学習用の例なら、語彙50、16次元でも幾何構造は見えます。

### ステップ3: 負例サンプリングの目的関数

各正例ペア `(center, context)` について、語彙から `k` 個のランダムな単語を負例としてサンプルします。正例では内積 `W[center] · W'[context]` が高く、負例では低くなるようにモデルを学習します。

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

中心となる式は、正例ペアに対するロジスティック損失、つまりsigmoidを1に近づける損失と、負例ペアに対するロジスティック損失、つまりsigmoidを0に近づける損失の和です。勾配は両方のテーブルに流れます。完全な導出は元論文にあります。一度、紙と鉛筆で追うと記憶に残ります。

### ステップ4: 小さなコーパスで学習する

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

十分なエポック数と大きなコーパスがあれば、似た文脈を共有する単語は、似た中心語埋め込みを持つようになります。おもちゃのコーパスでは効果はうっすら見える程度です。数十億トークンなら、はっきり見えます。

### ステップ5: アナロジーのトリック

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

事前学習済みの300次元Google Newsベクトルでは、次のようになります。

```python
>>> analogy(vocab, W, "man", "king", "woman")
[('queen', 0.71), ('monarch', 0.62), ('princess', 0.59), ...]
```

`king - man + woman = queen` です。これはモデルが王権とは何かを知っているからではありません。ベクトル `(king - man)` が「royal」のようなものを捉えており、それを `woman` に足すと、王族かつ女性を表す領域の近くに着地するからです。

## 使う

Word2Vecをスクラッチから書くのは学習のためです。本番のNLPでは `gensim` を使います。

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

実務では、Word2Vecを自分で学習することはほとんどありません。事前学習済みベクトルをダウンロードします。

- **GloVe** — Stanfordの共起行列分解アプローチです。50d、100d、200d、300dのチェックポイントがあります。一般的なカバレッジが良好です。レッスン04でGloVeを具体的に扱います。
- **fastText** — FacebookによるWord2Vec拡張で、文字n-gramを埋め込みます。未知語をサブワードの合成で扱えます。レッスン04。
- **Google Newsの事前学習済みWord2Vec** — 300d、300万語語彙、2013年公開。今でも毎日ダウンロードされています。

### 2026年でもWord2Vecが勝つ場面

- 軽量なドメイン特化検索。医療論文の要旨で1時間ほどノートPC学習すれば、汎用モデルでは捉えにくい専門ベクトルが得られます。
- アナロジー型の特徴量エンジニアリング。`gender_vector = mean(man - woman pairs)`。それを他の単語から引くと、性別に中立な軸を作れます。公平性研究では今でも使われます。
- 解釈しやすさ。100次元はPCAやt-SNEでプロットして、クラスタ形成を実際に見られる程度に小さいです。
- 推論をGPUなしのオンデバイスで走らせる必要がある場所。Word2Vecのlookupは1行を取り出すだけです。

### Word2Vecが失敗する場所

多義性の壁です。`bank` は1つのベクトルしか持ちません。`river bank` と `financial bank` は同じベクトルを共有します。`table` も、表計算の表と家具のテーブルで同じです。下流の分類器は、そのベクトルだけでは語義を区別できません。

文脈化埋め込み (ELMo、BERT、それ以降のすべてのtransformer) は、周囲の文脈に基づいて単語の出現ごとに異なるベクトルを作ることで、この問題を解きました。これがWord2VecからBERTへの飛躍です。静的な表現から文脈依存の表現へ。フェーズ7ではtransformer側を扱います。

もう1つの失敗は未知語問題です。学習データに入っていなければ、Word2Vecは `Zoomer-approved` を見たことがありません。フォールバックはありません。fastTextはサブワード合成でこれを修正します (レッスン04)。

## 成果物

`outputs/skill-embedding-probe.md` として保存します。

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

## 演習

1. **初級。** 猫と犬についての小さなコーパス (20文) で学習ループを実行してください。200エポック後に、`nearest(vocab, W, W[vocab["cat"]])` の上位3件に `dog` が入ることを確認します。入らない場合は、エポック数または語彙を増やしてください。
2. **中級。** 頻出語のsubsamplingを追加してください。頻度が `10^-5` を超える単語を、その頻度に比例した確率で学習ペアから落とします。まれな語の類似度に与える影響を測定してください。
3. **上級。** 20 Newsgroupsコーパスでモデルを学習してください。`he - she` と `doctor - nurse` の2つのバイアス軸を計算します。職業語を両方の軸に射影してください。どの職業でバイアス差が最大かを報告します。これは公平性研究者が使うタイプのprobeです。

## 重要用語

| 用語 | よくある言い方 | 実際の意味 |
|------|----------------|------------|
| Word embedding | 単語をベクトルにする | 文脈から学習された、密で低次元な表現です。典型的には100-300次元です。 |
| Skip-gram | Word2Vecのトリック | 中心語から文脈語を予測します。CBOWより遅いですが、まれな語に強いです。 |
| Negative sampling | 学習の近道 | 語彙全体へのsoftmaxを、`k` 個のランダム単語に対する二値分類で置き換えます。 |
| Static embedding | 1単語に1ベクトル | 文脈に関係なく同じベクトルを使います。多義性で失敗します。 |
| Contextual embedding | 文脈に敏感なベクトル | 周囲の単語に基づき、出現ごとに異なるベクトルになります。transformerが生成するものです。 |
| OOV | 語彙外 | 学習時に見ていない単語です。Word2Vecはこの単語のベクトルを生成できません。 |

## 参考資料

- [Mikolov et al. (2013). Distributed Representations of Words and Phrases and their Compositionality](https://arxiv.org/abs/1310.4546) — 負例サンプリングの論文です。短く読みやすいです。
- [Rong, X. (2014). word2vec Parameter Learning Explained](https://arxiv.org/abs/1411.2738) — 元論文の数式が重く感じる場合に、勾配の導出を最も分かりやすく説明しています。
- [gensim Word2Vec tutorial](https://radimrehurek.com/gensim/models/word2vec.html) — 実際に機能する本番向け学習設定です。
