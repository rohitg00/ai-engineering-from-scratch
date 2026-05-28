# トピックモデリング — LDA と BERTopic

> LDA: 文書はトピックの混合であり、トピックは単語上の分布です。BERTopic: 文書を埋め込み空間でクラスタリングし、クラスタをトピックと見なします。目的は同じで、分解の仕方が異なります。

**種類:** 学習
**言語:** Python
**前提:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 03 (Word2Vec)
**所要時間:** 約45分

## 問題

1万件のカスタマーサポートチケット、5万本のニュース記事、20万件のツイートがあるとします。すべてを読まずに、その集合が何についてのものかを知る必要があります。ラベル付きカテゴリはありません。カテゴリがいくつ存在するかさえ分かりません。

トピックモデリングは、この問いに教師なしで答えます。コーパスを渡すと、少数の一貫したトピックと、各文書に対するそれらのトピック上の分布が返ってきます。

主要なアルゴリズム系統は2つです。LDA (2003) は、各文書を潜在トピックの混合として扱い、各トピックを単語上の分布として扱います。推論はベイズ的です。複数トピックへの所属を扱う必要があり、説明可能な単語レベルの確率分布が必要な本番環境では今でも使われています。

BERTopic (2020) は、文書を BERT でエンコードし、UMAP で次元削減し、HDBSCAN でクラスタリングし、class-based TF-IDF でトピック語を抽出します。短いテキスト、ソーシャルメディア、単語の重なりより意味的類似性が重要なケースで強力です。1文書に1トピックを割り当てるため、長文コンテンツでは制約になります。

このレッスンでは両者の直感を作り、与えられたコーパスに対してどちらを選ぶべきかを明確にします。

## コンセプト

![LDA の混合モデルと BERTopic のクラスタリング](../assets/topic-modeling.svg)

**LDA の生成ストーリー。** 各トピックは単語上の分布です。各文書はトピックの混合です。文書内の単語を生成するには、まず文書の混合分布からトピックをサンプルし、次にそのトピックの単語分布から単語をサンプルします。推論ではこれを逆向きに行います。観測された単語から、文書ごとのトピック分布とトピックごとの単語分布を推定します。この計算は collapsed Gibbs sampling や variational Bayes が担います。

LDA の主要な出力:

- `doc_topic`: 行列 `(n_docs, n_topics)`。各行の和は1（文書のトピック混合）。
- `topic_word`: 行列 `(n_topics, vocab_size)`。各行の和は1（トピックの単語分布）。

**BERTopic のパイプライン。**

1. 各文書を sentence transformer（例: `all-MiniLM-L6-v2`）でエンコードする。384次元ベクトル。
2. UMAP で約5次元まで次元削減する。BERT 埋め込みはクラスタリングには高次元すぎる。
3. HDBSCAN でクラスタリングする。密度ベースで、サイズの異なるクラスタと「外れ値」ラベルを生成する。
4. 各クラスタについて、そのクラスタの文書上で class-based TF-IDF を計算し、上位語を抽出する。

出力は文書ごとに1つのトピックです（加えて -1 の外れ値ラベル）。必要に応じて、HDBSCAN の確率ベクトルによるソフトな所属度も得られます。

## 構築

### Step 1: scikit-learn による LDA

```python
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.decomposition import LatentDirichletAllocation
import numpy as np


def fit_lda(documents, n_topics=5, max_features=1000):
    cv = CountVectorizer(
        max_features=max_features,
        stop_words="english",
        min_df=2,
        max_df=0.9,
    )
    X = cv.fit_transform(documents)
    lda = LatentDirichletAllocation(
        n_components=n_topics,
        random_state=42,
        max_iter=50,
        learning_method="online",
    )
    doc_topic = lda.fit_transform(X)
    feature_names = cv.get_feature_names_out()
    return lda, cv, doc_topic, feature_names


def print_top_words(lda, feature_names, n_top=10):
    for idx, topic in enumerate(lda.components_):
        top_idx = np.argsort(-topic)[:n_top]
        words = [feature_names[i] for i in top_idx]
        print(f"topic {idx}: {' '.join(words)}")
```

注意点: stopwords を除去し、`min_df` と `max_df` で希少語と遍在語をフィルタしています。また、LDA は生のカウントを前提とするため、TfidfVectorizer ではなく CountVectorizer を使います。

### Step 2: BERTopic（本番向け）

```python
from bertopic import BERTopic

topic_model = BERTopic(
    embedding_model="sentence-transformers/all-MiniLM-L6-v2",
    min_topic_size=15,
    verbose=True,
)

topics, probs = topic_model.fit_transform(documents)
info = topic_model.get_topic_info()
print(info.head(20))
valid_topics = info[info["Topic"] != -1]["Topic"].tolist()
for topic_id in valid_topics[:5]:
    print(f"topic {topic_id}: {topic_model.get_topic(topic_id)[:10]}")
```

`Topic != -1` のフィルタは、BERTopic の外れ値バケット（HDBSCAN がクラスタリングできなかった文書）を取り除きます。`min_topic_size` は HDBSCAN の最小クラスタサイズを制御します。BERTopic ライブラリのデフォルトは10です。この例では、レッスンの規模に合わせて明示的に15にしています。1万文書を超えるコーパスでは、50または100に増やします。

### Step 3: 評価

どちらの手法もトピック語を出力します。問題は、その語群に一貫性があるかどうかです。

- **トピックコヒーレンス（c_v）。** スライディングウィンドウ文脈における上位語ペアの NPMI（normalized pointwise mutual information）を組み合わせ、スコアをトピックベクトルに集約し、それらのベクトルを cosine similarity で比較します。高いほど良いです。`gensim.models.CoherenceModel` を `coherence="c_v"` で使います。
- **トピック多様性。** 全トピックの上位語に含まれるユニーク語の割合です。高いほど良いです（トピック同士が重なっていない）。
- **定性的な確認。** 各トピックの上位語を読みます。それらは実在する概念に名前を付けていますか。最後の防衛線は今でも人間の判断です。

## どちらを選ぶか

| 状況 | 選択 |
|-----------|------|
| 短いテキスト（ツイート、レビュー、見出し） | BERTopic |
| トピック混合を持つ長文 | LDA |
| GPU なし / 計算資源が限られる | LDA または NMF |
| 文書レベルの複数トピック分布が必要 | LDA |
| トピックラベル付けで LLM と統合したい | BERTopic（直接サポート） |
| リソース制約のあるエッジ配置 | LDA |
| 意味的なコヒーレンスを最大化したい | BERTopic |

実務上もっとも大きな判断材料は文書長です。BERT 埋め込みは切り捨てが起きますが、LDA のカウントはどの長さでも扱えます。埋め込みモデルのコンテキストを超える文書では、チャンク化して集約するか、LDA を使います。

## 使いどころ

2026年のスタック:

- **BERTopic.** 短いテキストや、意味が重要なあらゆるケースのデフォルト。
- **`gensim.models.LdaModel`.** 本番向けの古典的 LDA。成熟しており、実戦で鍛えられている。
- **`sklearn.decomposition.LatentDirichletAllocation`.** 実験に使いやすい LDA。
- **NMF.** 非負値行列因子分解。LDA の高速な代替で、短いテキストでは同等の品質を出すことがある。
- **Top2Vec.** BERTopic に似た設計。コミュニティは小さいが、一部ベンチマークで良好。
- **FASTopic.** より新しく、非常に大きなコーパスでは BERTopic より高速。
- **LLM-based labeling.** 任意のクラスタリングを実行し、その後モデルに各クラスタの名前を付けさせる。

## 仕上げ

`outputs/skill-topic-picker.md` として保存します。

```markdown
---
name: topic-picker
description: コーパスに対して LDA と BERTopic のどちらを選ぶかを判断し、ライブラリ、調整項目、評価方法を指定する。
version: 1.0.0
phase: 5
lesson: 15
tags: [nlp, topic-modeling]
---

コーパスの説明（文書数、平均長、ドメイン、言語、計算予算）が与えられたら、次を出力する。

1. アルゴリズム。LDA / NMF / BERTopic / Top2Vec / FASTopic。理由を1文で示す。
2. 設定。トピック数: `recommended = max(5, round(sqrt(n_docs)))`。40,000文書未満のコーパスでは200を上限にする。>200を許可するのは、コーパスが本当に大規模（>40k）な場合だけで、その際は計算コストが増えることを明記する。`min_df` / `max_df` フィルタと、ニューラル手法で使う埋め込みモデルもここに含める。
3. 評価。`gensim.models.CoherenceModel` によるトピックコヒーレンス（c_v）、トピック多様性、20サンプルの人手確認。
4. 調べるべき失敗モード。LDA では、ストップワードや高頻度語を吸収する「ジャンクトピック」。BERTopic では、曖昧な文書を飲み込む -1 外れ値クラスタ。

埋め込みモデルのコンテキストウィンドウを超える文書に対して、チャンク化戦略なしで BERTopic を使う提案は拒否する。非常に短いテキスト（ツイート、10トークン未満のレビュー）に対しては、コヒーレンスが崩れるため LDA を拒否する。`n_topics` が5未満の場合は不適切である可能性が高いと指摘する。40k文書未満のコーパスで >200 の場合は、過剰分割の可能性が高いと指摘する。
```

## 演習

1. **Easy。** 20 Newsgroups データセットに対して、5トピックの LDA を当てはめます。各トピックの上位10語を出力します。各トピックに手でラベルを付けます。アルゴリズムは本当のカテゴリを見つけられましたか。
2. **Medium。** 同じ 20 Newsgroups のサブセットに BERTopic を当てはめます。見つかったトピック数、上位語、定性的なコヒーレンスを LDA と比較します。どちらが本当のカテゴリをより明確に表面化しますか。
3. **Hard。** 自分のコーパスで LDA と BERTopic の両方について c_v コヒーレンスを計算します。それぞれを5、10、20、50トピックで実行します。コヒーレンス対トピック数をプロットします。トピック数に対してどちらの手法がより安定しているかを報告します。

## 重要用語

| 用語 | よく言われる意味 | 実際の意味 |
|------|-----------------|-----------------------|
| Topic | コーパスが扱っているもの | 単語上の確率分布（LDA）、または類似文書のクラスタ（BERTopic）。 |
| Mixed membership | 文書が複数トピックであること | LDA は各文書に、全トピック上の分布を割り当てる。 |
| UMAP | 次元削減 | 局所構造を保存する多様体学習。BERTopic で使われる。 |
| HDBSCAN | 密度クラスタリング | サイズの異なるクラスタを見つける。外れ値には「ノイズ」ラベル（-1）を生成する。 |
| c_v coherence | トピック品質指標 | スライディングウィンドウ内で測る、上位トピック語の点別相互情報量の平均。 |

## 参考資料

- [Blei, Ng, Jordan (2003). Latent Dirichlet Allocation](https://www.jmlr.org/papers/volume3/blei03a/blei03a.pdf) — LDA の論文。
- [Grootendorst (2022). BERTopic: Neural topic modeling with a class-based TF-IDF procedure](https://arxiv.org/abs/2203.05794) — BERTopic の論文。
- [Röder, Both, Hinneburg (2015). Exploring the Space of Topic Coherence Measures](https://svn.aksw.org/papers/2015/WSDM_Topic_Evaluation/public.pdf) — c_v などを導入した論文。
- [BERTopic documentation](https://maartengr.github.io/BERTopic/) — 本番向けリファレンス。例が優れている。
