# 主題模型（topic modeling）——LDA 與 BERTopic

> LDA：文件是主題的混合，主題是詞上的分布。BERTopic：文件在 embedding 空間裡分群，群集就是主題。目標相同，分解不同。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 03 (Word2Vec)
**Time:** ~45 minutes

## The Problem｜問題

你有 1 萬件客服工單、5 萬篇新聞，或 20 萬則推文。你要知道這個集合在講什麼，卻不用讀完。你沒有帶標籤（label）的類別。你甚至不知道有幾個類別。

主題模型以無監督的方式回答這件事。給它一個語料庫（corpus），它還你一小組連貫的主題，以及每份文件在那些主題上的分布。

兩族演算法（algorithm）佔主導。LDA（2003）把每份文件看成潛在主題的混合，每個主題是詞上的分布。推論（inference）是貝氏的。當你需要多重主題歸屬、以及可解釋的詞級機率分布時，它仍在正式環境（production）交付。

BERTopic（2020）用 BERT 把文件編碼，用 UMAP 降維，用 HDBSCAN 分群，再用類別式 TF-IDF 抽出主題詞。它在短文、社群媒體、以及語意相似度比詞重疊更要緊的地方贏。一份文件只得一個主題，對長文是限制。

這一課為兩者建立直覺，並點名給定語料庫該選哪一個。

## The Concept｜核心概念

![LDA mixture model vs BERTopic clustering](../assets/topic-modeling.svg)

**LDA 的生成故事。** 每個主題是詞上的分布。每份文件是主題的混合。要在文件裡生成一個詞，先從該文件的混合抽出一個主題，再從該主題的分布抽出一個詞。推論把這個反過來：給定觀察到的詞，推出每份文件的主題分布，以及每個主題的詞分布。塌縮 Gibbs 取樣（collapsed Gibbs sampling）或變分貝氏（variational Bayes）做這筆數學。

LDA 的關鍵輸出：

- `doc_topic`：矩陣 `(n_docs, n_topics)`，每一列加總為 1（文件的主題混合）。
- `topic_word`：矩陣 `(n_topics, vocab_size)`，每一列加總為 1（主題的詞分布）。

**BERTopic 管線（pipeline）。**

1. 用句子 transformer（例如 `all-MiniLM-L6-v2`）把每份文件編碼。384 維向量。
2. 用 UMAP 把維度（dimensionality）降到約 5 維。BERT 的 embedding 維度太高，不適合分群。
3. 用 HDBSCAN 分群。基於密度，產出大小不一的群集，以及一個「離群」標籤。
4. 對每個群集，在該群集的文件上算類別式 TF-IDF，抽出排名前幾的詞。

輸出是一份文件一個主題（外加 -1 的離群標籤）。也可以用 HDBSCAN 的機率向量做軟歸屬。

```figure
topic-drift
```

## Build It｜動手實作

### 步驟 1：用 scikit-learn 做 LDA

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

注意：停用詞（stopword）拿掉了，min_df 和 max_df 濾掉罕見詞和到處都有的詞。用 CountVectorizer（不是 TfidfVectorizer），因為 LDA 要的是原始計數。

### 步驟 2：BERTopic（正式環境）

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

`Topic != -1` 這個過濾丟掉 BERTopic 的離群桶（HDBSCAN 分不出群集的文件）。`min_topic_size` 控制 HDBSCAN 的最小群集大小；BERTopic 函式庫（library）的預設是 10。這個例子為了本課的規模，明確設成 15。超過 1 萬份文件的語料庫，調到 50 或 100。

### 步驟 3：評估

兩種方法都輸出主題詞。問題是那些詞連不連貫。

- **主題連貫度（c_v）。** 把排名前幾的詞的配對，在滑動視窗的脈絡上算 NPMI（正規化點互資訊，normalized pointwise mutual information），再把分數聚成主題向量，用餘弦（cosine）相似度比較那些向量。越高越好。用 `gensim.models.CoherenceModel`，設 `coherence="c_v"`。
- **主題多樣性。** 所有主題的排名前幾的詞裡，不重複的詞佔多少。越高越好（主題不重疊）。
- **質性檢查。** 讀每個主題的排名前幾的詞。它們有沒有指到一件真的事？人的判斷仍是最後一道防線。

## 何時選哪個

| 情況 | 選擇 |
|-----------|------|
| 短文（推文、評論、標題） | BERTopic |
| 長文件、主題是混合的 | LDA |
| 沒有 GPU／算力有限 | LDA 或 NMF |
| 需要文件層級的多主題分布 | LDA |
| 要用 LLM 為主題命名 | BERTopic（直接支援） |
| 資源受限的邊緣部署（deployment） | LDA |
| 要最高的語意連貫 | BERTopic |

實務上最大的考量是文件長度。BERT 的 embedding 會截斷；LDA 的計數不管多長都算。文件長過 embedding 模型的脈絡時，要麼切塊再聚合，要麼用 LDA。

## Use It｜實際應用

2026 年的組合：

- **BERTopic。** 短文、以及語意要緊的場合的預設。
- **`gensim.models.LdaModel`。** 正式環境的經典 LDA，成熟，經過實戰。
- **`sklearn.decomposition.LatentDirichletAllocation`。** 實驗用的簡單 LDA。
- **NMF。** 非負矩陣分解（non-negative matrix factorization）。LDA 的快速替代，短文上品質相近。
- **Top2Vec。** 設計和 BERTopic 相近。社群較小，但有些評測上不錯。
- **FASTopic。** 較新，在非常大的語料庫上比 BERTopic 快。
- **用 LLM 命名。** 先做任何分群，再 prompt 模型為每個群集取名。

## Ship It｜交付成果

存成 `outputs/skill-topic-picker.md`：

```markdown
---
name: topic-picker
description: Pick LDA or BERTopic for a corpus. Specify library, knobs, evaluation.
version: 1.0.0
phase: 5
lesson: 15
tags: [nlp, topic-modeling]
---

Given a corpus description (document count, avg length, domain, language, compute budget), output:

1. Algorithm. LDA / NMF / BERTopic / Top2Vec / FASTopic. One-sentence reason.
2. Configuration. Number of topics: `recommended = max(5, round(sqrt(n_docs)))`, clamped to 200 for corpora under 40,000 docs; permit >200 only when the corpus is genuinely large (>40k) and note the increased compute cost. `min_df` / `max_df` filters and embedding model for neural approaches also belong here.
3. Evaluation. Topic coherence (c_v) via `gensim.models.CoherenceModel`, topic diversity, and a 20-sample human read.
4. Failure mode to probe. For LDA, "junk topics" absorbing stopwords and frequent terms. For BERTopic, the -1 outlier cluster swallowing ambiguous documents.

Refuse BERTopic on documents longer than the embedding model's context window without a chunking strategy. Refuse LDA on very short text (tweets, reviews under 10 tokens) as coherence collapses. Flag any n_topics choice below 5 as likely wrong; flag >200 on corpora under 40k docs as likely over-splitting.
```

## Exercises｜練習

1. **簡單。** 在 20 Newsgroups 資料集（dataset）上用 5 個主題配 LDA。印出每個主題前 10 個詞。用手為每個主題命名。演算法找到真正的類別了嗎？
2. **中等。** 在同一個 20 Newsgroups 子集上配 BERTopic。比較找到的主題數、排名前幾的詞、和質性連貫，對上 LDA。哪一個把真正的類別呈現得更乾淨？
3. **困難。** 在你的語料庫上為 LDA 和 BERTopic 算 c_v 連貫度。各跑 5、10、20、50 個主題。畫連貫度對主題數。報告哪一個在不同主題數上更穩。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 主題 | 語料庫在講的一件事 | 詞上的機率分布（LDA），或相似文件的群集（BERTopic）。 |
| 多重主題歸屬 | 文件屬於多個主題 | LDA 給每份文件一個涵蓋所有主題的分布。 |
| UMAP | 降維 | 保留局部結構的流形學習；BERTopic 會用。 |
| HDBSCAN | 密度分群 | 找出大小不一的群集；離群點標成「雜訊」（-1）。 |
| c_v 連貫度 | 主題品質指標 | 滑動視窗裡，主題排名前幾的詞的平均點互資訊。 |

## Further Reading｜延伸閱讀

- [Blei, Ng, Jordan (2003). Latent Dirichlet Allocation](https://www.jmlr.org/papers/volume3/blei03a/blei03a.pdf) ——LDA 論文。
- [Grootendorst (2022). BERTopic: Neural topic modeling with a class-based TF-IDF procedure](https://arxiv.org/abs/2203.05794) ——BERTopic 論文。
- [Röder, Both, Hinneburg (2015). Exploring the Space of Topic Coherence Measures](https://svn.aksw.org/papers/2015/WSDM_Topic_Evaluation/public.pdf) ——提出 c_v 和相關指標的論文。
- [BERTopic documentation](https://maartengr.github.io/BERTopic/) ——正式環境的參考。範例很好。
