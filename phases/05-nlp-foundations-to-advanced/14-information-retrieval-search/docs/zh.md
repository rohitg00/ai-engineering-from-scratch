# 信息检索与搜索（Information Retrieval and Search）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> BM25 精准但脆弱。Dense（稠密检索）撒得很开，却会漏关键词。Hybrid（混合检索）是 2026 年的默认选择。剩下的事都是调参。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 04 (GloVe, FastText, Subword)
**Time:** ~75 minutes

## 问题（The Problem）

用户输入「what happens if someone lies to get money」，期望搜到真正能覆盖这件事的法条：「Section 420 IPC」。关键词搜索完全没戏（词汇上没有交集）。语义搜索如果 embedding 没在法律文本上训练过，也会漏掉。真实场景下的搜索必须两边都能扛。

IR（信息检索）是每一个 RAG 系统、每一个搜索框、每一个文档站模糊查找背后的流水线。2026 年能在生产里跑得通的架构，不是某一个单独的方法，而是一条由若干互补方法串起来的链路，每一环都补上前一环的失败。

本课会把每一块都搭起来，并指出每一块到底捕捉的是哪种失败。

## 概念（The Concept）

![Hybrid retrieval: BM25 + dense + RRF + cross-encoder rerank](../assets/retrieval.svg)

四层。按需取用。

1. **稀疏检索（Sparse retrieval / BM25）。** 快、对精确匹配很准，对语义理解一塌糊涂。在倒排索引上跑。百万级文档下每个 query 不到 10ms。法条编号、产品代码、报错信息、命名实体——这些它都能拿对。
2. **稠密检索（Dense retrieval）。** 把 query 和文档编码成向量，做最近邻搜索。能抓到改写和语义相似度。但只要差一个字符的精确关键词匹配，它就会漏。用 FAISS 或向量数据库，每个 query 50-200ms。
3. **融合（Fusion）。** 把稀疏和稠密两路的排序结果合并起来。Reciprocal Rank Fusion（RRF，倒数排名融合）是最省心的默认方案，因为它无视原始分数（两边的分数尺度根本不一样），只看排名位置。如果你确定某一路在你这个领域里占主导，再考虑加权融合。
4. **Cross-encoder 重排（rerank）。** 取融合后的 top-30，跑一个 cross-encoder（query 和 document 拼到一起，对每一对打分），保留 top-5。Cross-encoder 单对推理比 bi-encoder 慢，但准得多。只在 top-30 上跑，可以把成本摊薄。

三路检索（BM25 + dense + 类似 SPLADE 的 learned-sparse）在 2026 年的基准测试里优于两路，但需要为 learned-sparse 索引准备相应基础设施。对大多数团队来说，两路 + cross-encoder rerank 是性价比最高的组合。

## 动手实现（Build It）

### 第 1 步：从零实现 BM25

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

两个值得了解的参数。`k1=1.5` 控制词频饱和度，越大越看重词频的重复出现。`b=0.75` 控制长度归一化，0 表示完全忽略文档长度，1 表示完全归一化。这两个默认值是 Robertson 在原论文里的推荐值，几乎不需要调。

### 第 2 步：用 bi-encoder 做 dense 检索

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

把 embedding 做 L2 归一化，这样点积就等于余弦相似度。`all-MiniLM-L6-v2` 是 384 维、速度快，对大多数英文检索来说足够强。多语言场景用 `paraphrase-multilingual-MiniLM-L12-v2`。要追求最高精度，用 `bge-large-en-v1.5` 或 `e5-large-v2`。

### 第 3 步：Reciprocal Rank Fusion

```python
def reciprocal_rank_fusion(rankings, k=60):
    scores = {}
    for ranking in rankings:
        for rank, (_, doc_idx) in enumerate(ranking):
            scores[doc_idx] = scores.get(doc_idx, 0.0) + 1.0 / (k + rank + 1)
    fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [(score, doc_idx) for doc_idx, score in fused]
```

`k=60` 这个常数来自 RRF 原论文。`k` 越大，排名差异的贡献越平；`k` 越小，靠前的排名越占主导。60 是论文里发布的默认值，几乎不需要调。

### 第 4 步：hybrid 搜索 + rerank

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

三阶段串起来。BM25 找词面匹配。Dense 找语义匹配。RRF 把两个排名合并起来，不需要做分数标定。Cross-encoder 把 query 和 document 一起送进去，对 top-30 重新打分，捕捉到 bi-encoder 漏掉的细粒度相关性。最后保留 top-5。

### 第 5 步：评估（evaluation）

| Metric | Meaning |
|--------|---------|
| Recall@k | 在那些「正确文档确实存在」的 query 里，正确文档落在 top-k 的频率。 |
| MRR (Mean Reciprocal Rank) | 第一个相关文档排名的倒数的平均值。 |
| nDCG@k | 考虑相关性的等级差异，而不是只看「相关 / 不相关」二值。 |

具体到 RAG，retriever 的 **Recall@k** 是最重要的指标。如果正确段落根本没进检索结果，reader 怎么也答不出来。

调试小贴士：对失败的 query，diff 一下稀疏和稠密两路的排名。如果其中一路找到了正确文档而另一路没找到，那就是词汇错配（修法：把缺的那一半补上）或者语义歧义（修法：换更好的 embedding 或加一个 reranker）。

## 用起来（Use It）

2026 年的技术栈：

| Scale | Stack |
|-------|-------|
| 1k-100k 文档 | 内存里跑 BM25 + `all-MiniLM-L6-v2` embedding + RRF。不用单独的数据库。 |
| 100k-10M 文档 | dense 用 FAISS 或 pgvector + BM25 用 Elasticsearch / OpenSearch。并行跑。 |
| 10M+ 文档 | 用支持 hybrid 的 Qdrant / Weaviate / Vespa / Milvus。在 top-30 上跑 cross-encoder rerank。 |
| 追求极致质量 | 三路（BM25 + dense + SPLADE）+ ColBERT 后期交互（late-interaction）重排 |

不管选哪种，预算里都要留出评估的部分。先跑检索的 recall 基准，再跑端到端 RAG 准确率的基准。retriever 漏掉的东西，reader 是补不回来的。

### 2026 年生产环境 RAG 踩出来的硬经验

- **80% 的 RAG 失败都是 ingestion（数据接入）和 chunking 的问题，不是模型的问题。** 团队花上几周换 LLM、调 prompt，可检索每三个 query 就悄无声息地返回错误的上下文。先修 chunking。
- **chunking 策略比 chunk 大小更重要。** 固定大小切片会切断表格、代码、嵌套标题。按句切（sentence-aware）是默认；技术文档和产品手册做语义切片或基于 LLM 的 chunking 才划得来。
- **Parent-doc 模式。** 检索小的「child」chunk 拿精度。当同一个 parent 段落里出现多个 child 时，把整个 parent 块换上去，保住上下文。这一招能稳定提升回答质量，且不需要重新训练。
- **k_rerank=3 通常是最优。** 超过这个数，每多一个 chunk 都只是多花 token、多增延迟，对回答质量没贡献。如果你这边 k=8 仍比 k=3 好，那就是 reranker 没发挥好。
- **HyDE / 查询扩展（query expansion）。** 用 query 生成一个假想答案，把这个假想答案 embedding，再去检索。在「短问题 vs 长文档」之间补上措辞鸿沟。免训练的精度提升。
- **上下文预算控制在 8K token 以内。** 频繁顶到这个上限，说明 reranker 阈值放得太松。
- **所有东西都要做版本管理。** Prompt、chunking 规则、embedding 模型、reranker。任何一个漂移都会悄悄拉低回答质量。在 CI 里设上忠实度（faithfulness）、context precision、未答率三道闸门，能在用户看到之前拦下回归。
- **三路检索（BM25 + dense + 类似 SPLADE 的 learned-sparse）在 2026 基准上优于两路**，尤其是在「专有名词 + 语义」混合的 query 上。当基础设施支持 SPLADE 索引时，就上。

按 2026 年行业实测，把检索设计做对可以减少 70-90% 的 hallucination（幻觉）。RAG 性能提升大头来自更好的检索，而不是模型微调。

## 上线部署（Ship It）

存为 `outputs/skill-retrieval-picker.md`：

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

## 练习（Exercises）

1. **Easy.** 在一个 500 文档的语料上实现上面的 `hybrid_search`。测 20 个 query，比较 BM25-only、dense-only、hybrid 三种方案的 recall@5。
2. **Medium.** 加上 MRR 的计算。对每一个有已知正确文档的测试 query，找出正确文档在 BM25、dense、hybrid 排名中的位置。报告每种方案的 MRR。
3. **Hard.** 用 MultipleNegativesRankingLoss（Sentence Transformers）在你自己的领域上微调一个 dense encoder。从 500 个 query-document 对里构造训练集。比较微调前后的 recall。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BM25 | 关键词搜索 | Okapi BM25。基于词频、IDF 和文档长度给文档打分。 |
| Dense retrieval | 向量搜索 | 把 query 和 doc 编码成向量，做最近邻查找。 |
| Bi-encoder | embedding 模型 | 把 query 和 doc 独立编码。query 时刻很快。 |
| Cross-encoder | reranker 模型 | 把 query 和 doc 一起编码。慢但准。 |
| RRF | 排名融合 | 把两路排名按 `1/(k + rank)` 求和合并。 |
| Recall@k | 检索指标 | 在多大比例的 query 中，相关文档落在 top-k。 |

## 延伸阅读（Further Reading）

- [Robertson and Zaragoza (2009). The Probabilistic Relevance Framework: BM25 and Beyond](https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf) — BM25 的权威综述。
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) — DPR，bi-encoder 的标杆论文。
- [Formal et al. (2021). SPLADE: Sparse Lexical and Expansion Model](https://arxiv.org/abs/2107.05720) — learned-sparse 检索器，把和 dense 之间的差距抹平。
- [Cormack, Clarke, Büttcher (2009). Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf) — RRF 原论文。
- [Khattab and Zaharia (2020). ColBERT: Efficient and Effective Passage Search](https://arxiv.org/abs/2004.12832) — 后期交互（late-interaction）检索。
