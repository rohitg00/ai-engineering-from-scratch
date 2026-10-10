# 資訊檢索與搜尋

> 精準但脆弱。稠密檢索網撒得很寬，卻會漏掉關鍵字。混合是 2026 年的預設。其餘都是調校。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 04 (GloVe, FastText, Subword)
**Time:** ~75 minutes

## The Problem｜問題

使用者打「what happens if someone lies to get money」，期待找到真正涵蓋這件事的法條：「Section 420 IPC.」。關鍵字搜尋完全找不到（沒有共同詞彙）。若 embedding 不是在法律文本上訓練的，語意搜尋也會漏。真正的搜尋兩邊都要處理。

資訊檢索是每套 RAG 系統、每個搜尋框、每個文件站模糊查找底下的管線（pipeline）。2026 年在正式環境行得通的架構不是單一方法。它是一串互補的方法，每一層接住前一層漏掉的。

這一課把每一塊做出來，並點名每一塊接住哪些失敗。

## The Concept｜核心概念

![Hybrid retrieval: BM25 + dense + RRF + cross-encoder rerank](../assets/retrieval.svg)

四層。挑你需要的。

1. **稀疏檢索（BM25）。** 在精確相符上又快又準，語意很差。跑在倒排索引上。數百萬份文件上，每個查詢不到 10 毫秒。法條編號、產品代號、錯誤訊息、命名實體（named entity）會抓對。
2. **稠密檢索。** 把查詢和文件編成向量。最近鄰搜尋。抓得到改寫和語意相似。差一個字元的精確關鍵字會漏。用 FAISS 或向量資料庫時，每個查詢 50 到 200 毫秒。
3. **融合。** 把稀疏和稠密的排名合併。倒數排名融合（Reciprocal Rank Fusion，RRF）是簡單的預設，因為它不理原始分數（兩者尺度不同），只用排名位置。當你知道某個訊號在你的領域佔上風，加權融合是一個選項。
4. **交叉編碼器重排。** 取融合後的前 30。跑交叉編碼器（查詢和文件一起，為每一對打分）。留下前 5。交叉編碼器每一對比雙編碼器慢，但準很多。只跑前 30，把成本攤掉。

三路檢索（BM25 加稠密，再加上像 SPLADE 這種學出來的稀疏）在 2026 年的評測上勝過兩路，但需要學出來的稀疏索引的基礎設施。對多數團隊，兩路加上交叉編碼器重排剛剛好。

```figure
gx-hybrid-retrieval
```

## Build It｜動手實作

### 步驟 1：從零寫 BM25

```python
import math
import re
from collections import Counter

TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(text):
    return TOKEN_RE.findall(text.lower())


class BM25:
    def __init__(self, corpus, k1=1.5, b=0.75):
        if not corpus:
            raise ValueError("corpus must not be empty")
        self.corpus = [tokenize(d) for d in corpus]
        self.k1 = k1
        self.b = b
        self.n_docs = len(self.corpus)
        self.avg_dl = sum(len(d) for d in self.corpus) / self.n_docs
        self.df = Counter()
        for doc in self.corpus:
            for term in set(doc):
                self.df[term] += 1

    def idf(self, term):
        n = self.df.get(term, 0)
        return math.log(1 + (self.n_docs - n + 0.5) / (n + 0.5))

    def score(self, query, doc_idx):
        q_tokens = tokenize(query)
        doc = self.corpus[doc_idx]
        dl = len(doc)
        freq = Counter(doc)
        score = 0.0
        for term in q_tokens:
            f = freq.get(term, 0)
            if f == 0:
                continue
            numerator = f * (self.k1 + 1)
            denominator = f + self.k1 * (1 - self.b + self.b * dl / self.avg_dl)
            score += self.idf(term) * numerator / denominator
        return score

    def rank(self, query, top_k=10):
        scored = [(self.score(query, i), i) for i in range(self.n_docs)]
        scored.sort(reverse=True)
        return scored[:top_k]
```

兩個參數值得知道。`k1=1.5` 控制詞頻（term frequency）飽和；越高，詞重複的權重越大。`b=0.75` 控制長度正規化（normalization）；0 不理文件長度，1 完全正規化。預設是 Robertson 在原論文的建議，很少需要調校。

### 步驟 2：用雙編碼器做稠密檢索

```python
from sentence_transformers import SentenceTransformer
import numpy as np


def build_dense_index(corpus, model_id="sentence-transformers/all-MiniLM-L6-v2"):
    encoder = SentenceTransformer(model_id)
    embeddings = encoder.encode(corpus, normalize_embeddings=True)
    return encoder, embeddings


def dense_search(encoder, embeddings, query, top_k=10):
    q_emb = encoder.encode([query], normalize_embeddings=True)
    sims = (embeddings @ q_emb.T).flatten()
    order = np.argsort(-sims)[:top_k]
    return [(float(sims[i]), int(i)) for i in order]
```

把 embedding 做 L2 正規化，內積（dot product）就等於餘弦相似度（cosine similarity）。`all-MiniLM-L6-v2` 是 384 維（dimension），快，對多數英文檢索夠強。多語用 `paraphrase-multilingual-MiniLM-L12-v2`。要最高準確率（accuracy），用 `bge-large-en-v1.5` 或 `e5-large-v2`。

### 步驟 3：倒數排名融合

```python
def reciprocal_rank_fusion(rankings, k=60):
    scores = {}
    for ranking in rankings:
        for rank, (_, doc_idx) in enumerate(ranking):
            scores[doc_idx] = scores.get(doc_idx, 0.0) + 1.0 / (k + rank + 1)
    fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [(score, doc_idx) for doc_idx, score in fused]
```

`k=60` 這個常數來自原始 RRF 論文。`k` 越高，排名差距的貢獻越平；`k` 越低，前幾名越主導。60 是發表的預設，很少需要調校。

### 步驟 4：混合搜尋加重排

```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")


def hybrid_search(query, bm25, encoder, dense_embeddings, corpus, top_k=5, pool_size=30, reranker=reranker):
    sparse_ranking = bm25.rank(query, top_k=pool_size)
    dense_ranking = dense_search(encoder, dense_embeddings, query, top_k=pool_size)
    fused = reciprocal_rank_fusion([sparse_ranking, dense_ranking])[:pool_size]

    pairs = [(query, corpus[doc_idx]) for _, doc_idx in fused]
    scores = reranker.predict(pairs)
    reranked = sorted(zip(scores, [doc_idx for _, doc_idx in fused]), reverse=True)
    return reranked[:top_k]
```

三個階段接在一起。BM25 找詞彙相符。稠密找語意相符。RRF 合併兩個排名，不需要校準分數。交叉編碼器把前 30 用查詢–文件配對重新打分，補上雙編碼器漏掉的細緻相關性。留下前 5。

### 步驟 5：評估

| 指標 | 意義 |
|--------|---------|
| Recall@k | 在正確文件存在的查詢裡，它有多常出現在前 k？ |
| MRR（平均倒數排名） | 第一份相關文件的 1/排名 的平均。 |
| nDCG@k | 算進相關性的等級，不只是相關／不相關的二分。 |

對 RAG 來說，檢索器的 **Recall@k** 是最重要的數字。正確段落不在檢索集合裡，閱讀器答不出來。

除錯提示：對失敗的查詢，比對稀疏和稠密的排名。一個找到、另一個沒找到，就是詞彙對不上（補上缺的那一半），或語意有歧義（換更好的 embedding，或加重排器）。

## Use It｜實際應用

2026 年的組合：

| 規模 | 組合 |
|-------|-------|
| 1000 到 10 萬份文件 | 記憶體（memory）內的 BM25 加 `all-MiniLM-L6-v2` embedding 加 RRF。不需要分開的資料庫。 |
| 10 萬到 1000 萬份文件 | FAISS 或 pgvector 做稠密，Elasticsearch / OpenSearch 做 BM25。平行跑。 |
| 1000 萬份以上 | Qdrant / Weaviate / Vespa / Milvus，支援混合。交叉編碼器重排前 30。 |
| 品質前沿 | 三路（BM25 加稠密加 SPLADE）加 ColBERT late-interaction |

無論選哪個，都要為評估留預算。先評測檢索召回率（recall），再評測端到端的 RAG 準確率。檢索器漏掉的，閱讀器補不回來。

### 2026 年正式環境 RAG 用代價換來的教訓

- **80% 的 RAG 失敗來自匯入和切塊，不是模型。** 團隊花好幾週換大型語言模型、調校 prompt，檢索卻每三個查詢就悄悄回錯脈絡。先修切塊。
- **切塊策略比區塊大小更要緊。** 固定長度的切開會弄破表格、程式碼和巢狀標題。預設用句子感知；技術文件和產品手冊上，語意切塊或用 LLM 切塊划算。
- **父文件模式。** 檢索小的「子」區塊來換精確率（precision）。同一個父區段的多個子區塊出現時，換成父區塊，保住脈絡。這穩定地拉高答案品質，不用重新訓練。
- **k_rerank=3 通常剛好。** 再多的區塊只增加 token 成本和生成延遲（latency），不拉高答案品質。若對你來說 k=8 仍比 k=3 好，重排器不夠力。
- **HyDE／查詢擴展。** 從查詢生成一個假設答案，把那個答案做成 embedding 再檢索。補上短問題和長文件之間的說法落差。不用訓練就有的精確率提升。
- **脈絡預算低於 8000 個 token。** 在這個上限還穩定命中，表示重排器的閾值太鬆。
- **全部都要有版本。** prompt、切塊規則、embedding 模型、重排器。任何漂移都會悄悄弄壞答案品質。用忠實度、脈絡精確率、未回答問題比率做 CI 閘門，在使用者看到之前擋下退步。
- **三路檢索（BM25 加稠密，加上像 SPLADE 的學出來的稀疏）勝過兩路**，尤其是專有名詞和語意混在一起的查詢。基礎設施支援 SPLADE 索引時再交付。

依 2026 年的產業量測，設計好的檢索把幻覺（hallucination）減少 70% 到 90%。RAG 的多數增益來自更好的檢索，不是模型 fine-tune。

## Ship It｜交付成果

存成 `outputs/skill-retrieval-picker.md`：

```markdown
---
name: retrieval-picker
description: Pick a retrieval stack for a given corpus and query pattern.
version: 1.0.0
phase: 5
lesson: 14
tags: [nlp, retrieval, rag, search]
---

Given requirements (corpus size, query pattern, latency budget, quality bar, infra constraints), output:

1. Stack. BM25 only, dense only, hybrid (BM25 + dense + RRF), hybrid + cross-encoder rerank, or three-way (BM25 + dense + learned-sparse).
2. Dense encoder. Name the specific model. Match to language(s), domain, and context length.
3. Reranker. Name the specific cross-encoder model if used. Flag that rerank adds 30-100ms latency on top-30.
4. Evaluation plan. Recall@10 is the primary retriever metric. MRR for multi-answer. Baseline first, incremental improvements measured against it.

Refuse to recommend dense-only for corpora with named entities, error codes, or product SKUs unless the user has evidence dense handles exact matches. Refuse to skip reranking for high-stakes retrieval (legal, medical) where the final top-5 decides the user's answer.
```

## Exercises｜練習

1. **簡單。** 在 500 份文件的語料庫（corpus）上實作上面的 `hybrid_search`。測 20 個查詢。比較只有 BM25、只有稠密、和混合在前 5 的召回率。
2. **中等。** 加上 MRR。每個有已知正確文件的測試查詢，找出正確文件在 BM25、稠密、混合排名裡的名次。各報 MRR。
3. **困難。** 用 MultipleNegativesRankingLoss（Sentence Transformers）在你的領域上 fine-tune 稠密編碼器。用 500 對查詢–文件做訓練集。比較 fine-tune 前後的召回率。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| BM25 | 關鍵字搜尋 | Okapi BM25。用詞頻、逆文件頻率（IDF）和長度為文件打分。 |
| 稠密檢索 | 向量搜尋 | 把查詢和文件編成向量，找最近鄰。 |
| 雙編碼器 | embedding 模型 | 查詢和文件各自編碼。查詢時快。 |
| 交叉編碼器 | 重排模型 | 查詢和文件一起編碼。慢，但準。 |
| RRF | 排名融合 | 把兩個排名的 `1/(k + rank)` 加總。 |
| Recall@k | 檢索指標 | 相關文件出現在前 k 的查詢所佔比例。 |

## Further Reading｜延伸閱讀

- [Robertson and Zaragoza (2009). The Probabilistic Relevance Framework: BM25 and Beyond](https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf) ——BM25 的定本。
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) ——DPR，標準的雙編碼器。
- [Formal et al. (2021). SPLADE: Sparse Lexical and Expansion Model](https://arxiv.org/abs/2107.05720) ——學出來的稀疏檢索器，補上和稠密的差距。
- [Cormack, Clarke, Büttcher (2009). Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf) ——RRF 論文。
- [Khattab and Zaharia (2020). ColBERT: Efficient and Effective Passage Search](https://arxiv.org/abs/2004.12832) ——晚期互動。
