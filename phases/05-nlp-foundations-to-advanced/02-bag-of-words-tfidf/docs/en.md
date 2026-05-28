# Bag of Words、TF-IDF、テキスト表現

> まず数え、考えるのはその後です。2026 年でも、明確に定義されたタスクでは TF-IDF が埋め込みに勝つことがあります。

**種別:** 実装
**言語:** Python
**前提条件:** フェーズ 5 · 01 (テキスト処理)、フェーズ 2 · 02 (ゼロからの線形回帰)
**所要時間:** 約 75 分

## 課題

モデルが必要とするのは数値です。手元にあるのは文字列です。

どの NLP パイプラインも同じ問いに答えなければなりません。可変長のトークン列を、分類器が消費できる固定長ベクトルへどう変換するか。この分野が最初にたどり着いた答えは、動くものの中で最も単純なものでした。単語を数える。ベクトルを作る。

そのベクトルは、どの埋め込みモデルよりも多くの本番 NLP を支えてきました。スパムフィルタ、トピック分類器、ログ異常検知、検索ランキング (BM25 以前)、初期の感情分析、学術 NLP ベンチマークの最初の 10 年。2026 年の実務者も、狭い分類タスクではまずこれに手を伸ばします。高速で、解釈可能で、単語の有無が重要なタスクでは 4 億パラメータの埋め込みモデルと区別がつかないこともよくあります。

このレッスンでは、Bag of Words を作り、その後 TF-IDF をゼロから作ります。続いて scikit-learn が同じことを 3 行で行う様子を見ます。最後に、埋め込みへ切り替えるべき失敗モードを明確にします。

## 考え方

**Bag of Words (BoW)** は語順を捨てます。各文書について、語彙中の各単語が何回出現するかを数えます。ベクトル長は語彙サイズです。位置 `i` は単語 `i` の出現回数です。

**TF-IDF** は BoW に重みを付け直します。すべての文書に現れる単語は情報量が低いので重みを下げます。コーパス全体では珍しいが、ある 1 文書では頻出する単語はシグナルなので重みを上げます。

```
TF-IDF(w, d) = TF(w, d) * IDF(w)
             = count(w in d) / |d| * log(N / df(w))
```

ここで `TF` は文書内の語頻度、`df` は文書頻度 (その単語を含む文書数)、`N` は総文書数です。`log` は、どこにでも出る単語の重みを有界に保ちます。

重要な性質は、どちらも解釈可能な軸を持つスパースベクトルを作ることです。学習済み分類器の重みを見れば、どの単語が文書をどのクラスへ押しているかを読めます。768 次元の BERT 埋め込みではこれはできません。

## 作ってみる

### ステップ 1: 語彙を作る

```python
def build_vocab(docs):
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    return vocab
```

入力は、トークン化済み文書のリストです (単語レベルのトークナイザなら何でもかまいません。このレッスンの `code/main.py` は簡略化した小文字化版を使います)。出力は `{word: index}` の辞書です。安定した挿入順序により、単語インデックス 0 は最初の文書で最初に見つかった単語になります。慣習は実装によって異なり、scikit-learn はアルファベット順に並べます。

### ステップ 2: Bag of Words

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

行は文書です。列は語彙インデックスです。要素 `[i][j]` は「単語 `j` が文書 `i` に何回現れるか」です。文書 1 には `cat` が 2 回あります。実際に 2 回出ているからです。文書 0 では `ran` は 0 回です。出ていないからです。

### ステップ 3: 語頻度と文書頻度

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

名前を付けておく価値のある平滑化の工夫が 2 つあります。`(n+1)/(d+1)` は `log(x/0)` を避けます。末尾の `+1` は、すべての文書に出る単語でも IDF が 0 ではなく 1 になることを保証し、scikit-learn のデフォルトに合わせます。他の実装では生の `log(N/df)` を使います。どちらも動きますが、平滑化版のほうが扱いやすいです。

### ステップ 4: TF-IDF

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

3 文書、5 語彙 (`the`, `cat`, `sat`, `dog`, `ran`) です。`the` は 3 文書すべてに現れるため、IDF は低くなります。`dog` は 1 文書にしか現れないため、IDF は高くなります。ベクトルはスパースで (ほとんどの要素は小さい)、識別力のある単語が浮き上がります。

### ステップ 5: 行を L2 正規化する

```python
def l2_normalize(matrix):
    out = []
    for row in matrix:
        norm = math.sqrt(sum(x * x for x in row))
        out.append([x / norm if norm else 0 for x in row])
    return out
```

正規化しないと、長い文書ほど大きなベクトルになり、類似度スコアを支配します。L2 正規化はすべての文書を単位超球面上に置きます。行同士のコサイン類似度は、単なるドット積になります。

## 使ってみる

scikit-learn には本番向け実装が入っています。

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

`CountVectorizer` は、トークン化、語彙作成、BoW を 1 回の呼び出しで行います。`TfidfVectorizer` は IDF 重み付けと L2 正規化を追加します。どちらもスパース行列を返します。10 万文書では、密行列表現はメモリに収まりません。分類器が密行列を要求するまではスパースのままにしてください。

すべてを変えるノブ:

| 引数 | 効果 |
|-----|--------|
| `ngram_range=(1, 2)` | バイグラムを含めます。通常は分類性能が上がります。 |
| `min_df=2` | 2 文書未満にしか出ない単語を落とします。ノイズの多いデータで語彙を削ります。 |
| `max_df=0.95` | 95% を超える文書に出る単語を落とします。固定リストなしでストップワード削除に近い効果を得ます。 |
| `stop_words="english"` | scikit-learn 組み込みのストップワードリストです。タスク依存です。感情分析では否定語を落としてはいけません。 |
| `sublinear_tf=True` | 生の `tf` ではなく `1 + log(tf)` を使います。1 文書内で同じ語が何度も繰り返されるときに有効です。 |

### 2026 年時点でも TF-IDF が勝つ場面

- スパム検出、トピックラベリング、ログ異常フラグ付け。重要なのは単語の有無であり、意味の微妙な違いではありません。
- データが少ない状況 (ラベル付き例が数百件)。TF-IDF + ロジスティック回帰には事前学習コストがありません。
- レイテンシが重要な場所。TF-IDF + 線形モデルはマイクロ秒で応答します。Transformer で文書を埋め込むには 10-100ms かかります。
- 予測理由の説明が必要なシステム。分類器の係数を見ます。上位の正の単語が理由です。

### TF-IDF が失敗する場面

意味を見ないことによる失敗です。次の 2 文書を考えます。

- "The movie was not good at all."
- "The movie was excellent."

一方は否定的なレビューです。もう一方は肯定的です。TF-IDF 上での重なりは正確に `{the, movie, was}` です。Bag-of-Words 分類器は、`good` の近くにある `not` がラベルを反転させることを記憶しなければなりません。十分なデータがあれば学習できますが、構文を理解するモデルほど自然には扱えません。

もう 1 つの失敗は、推論時の語彙外語です。IMDb レビューで学習した BoW モデルは、`Zoomer-approved` というトークンが学習時に一度も出ていなければ、どう扱えばよいかわかりません。サブワード埋め込み (レッスン 04) はこれを扱えます。TF-IDF にはできません。

### ハイブリッド: TF-IDF 重み付き埋め込み

2026 年の中規模データ分類における実務的デフォルトは、TF-IDF 重みを単語埋め込みへのアテンションとして使うことです。

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

埋め込みから意味的な表現力を得て、TF-IDF から希少語の強調を得ます。分類器はプール済みベクトルで学習します。ラベル付き例が約 5 万件未満の感情分類、トピック分類、意図分類では、どちらか単独より良いことがあります。

## 形にして届ける

`outputs/prompt-vectorization-picker.md` として保存します。

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

## 演習

1. **易しい。** L2 正規化済み TF-IDF 出力に対して `cosine_similarity(doc_vec_a, doc_vec_b)` を実装してください。同一文書は 1.0、語彙が重ならない文書は 0.0 になることを確認します。
2. **普通。** `bag_of_words` に `n-gram` サポートを追加してください。パラメータ `n` は `n`-gram のカウントを生成します。`["the", "cat", "sat"]` に対して `n=2` を指定すると、`["the cat", "cat sat"]` のバイグラムカウントが生成されることをテストします。
3. **難しい。** 上の TF-IDF 重み付き埋め込みハイブリッドを、GloVe 100d ベクトルを使って作ってください (一度ダウンロードしてキャッシュします)。20 Newsgroups データセットで、素の TF-IDF、素の平均プール埋め込みと分類精度を比較してください。どこでどれが勝つかを報告します。

## 重要用語

| 用語 | よく言われる意味 | 実際の意味 |
|------|-----------------|-----------------------|
| BoW | 単語頻度ベクトル | 1 文書内の語彙単語のカウント。語順を捨てます。 |
| TF | 語頻度 | 文書内の単語カウント。文書長で正規化することもあります。 |
| DF | 文書頻度 | その単語を少なくとも 1 回含む文書数。 |
| IDF | 逆文書頻度 | 平滑化された `log(N / df)`。どこにでも出る単語の重みを下げます。 |
| スパースベクトル | ほとんどがゼロ | 語彙は通常 1 万から 10 万語で、特定の文書に出るものはその一部です。 |
| コサイン類似度 | ベクトルの角度 | L2 正規化済みベクトルのドット積です。1 は同一、0 は直交を表します。 |

## 参考資料

- [scikit-learn — feature extraction from text](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) — 標準的な API リファレンス。すべてのノブについての注記もあります。
- [Salton, G., & Buckley, C. (1988). Term-weighting approaches in automatic text retrieval](https://www.sciencedirect.com/science/article/pii/0306457388900210) — TF-IDF を 10 年以上のデフォルトにした論文。
- ["Why TF-IDF Still Beats Embeddings" — Ashfaque Thonikkadavan (Medium)](https://medium.com/@cmtwskb/why-tf-idf-still-beats-embeddings-ad85c123e1b2) — 古い手法がいつ、なぜ勝つのかについての 2026 年の見方。
