# 信息检索与搜索

> BM25 精确但脆弱。稠密检索覆盖面广但会漏掉关键词。混合检索是 2026 年的默认方案。其余的都是调优。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 04 (GloVe, FastText, Subword)
**Time:** ~75 分钟

## 问题所在

用户输入"what happens if someone lies to get money"（如果有人撒谎骗钱会怎样），期望找到真正覆盖该情形的法条："Section 420 IPC"。关键词搜索完全找不到它（没有共享词汇）。语义搜索也找不到，如果嵌入模型没有在法律文本上训练过。真正的搜索必须两者兼顾。

IR 是每个 RAG 系统、每个搜索框、每个文档网站模糊查找背后的流水线。2026 年在生产环境中可行的架构不是单一方法，而是一系列互补方法的链条，每一环都弥补前一环的失败。

本课逐个构建每个组件，并说明每一环能弥补哪些失败。

## 概念

![Hybrid retrieval: BM25 + dense + RRF + cross-encoder rerank](../assets/retrieval.svg)

四个层次。按需选用。

1. **稀疏检索（BM25）。** 快速，对精确匹配精准，对语义很差。运行在倒排索引上。数百万文档中每个查询不到 10 毫秒。能正确匹配法条编号、产品代码、错误信息、命名实体。
2. **稠密检索。** 将查询和文档编码为向量。最近邻搜索。能捕捉改写和语义相似。会漏掉仅差一个字符的精确关键词匹配。使用 FAISS 或向量数据库，每个查询 50-200 毫秒。
3. **融合。** 合并稀疏和稠密的排序列表。倒数排序融合（RRF）是简单的默认选择，因为它忽略原始分数（量纲各不相同），只使用排名位置。当你知道某个信号在你的领域占主导时，可以选用加权融合。
4. **交叉编码器重排。** 取融合后的前 30 条。运行交叉编码器（查询 + 文档一起输入，为每一对打分）。保留前 5 条。交叉编码器每对比双编码器慢，但准确得多。通过只对前 30 条运行来摊薄成本。

三路检索（BM25 + 稠密 + SPLADE 等学习型稀疏）在 2026 年的基准测试中优于两路检索，但需要支持学习型稀疏索引的基础设施。对大多数团队来说，两路加交叉编码器重排是最优平衡点。

```figure
gx-hybrid-retrieval
```

## 动手构建

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

两个值得了解的参数。`k1=1.5` 控制词频饱和度；值越高，词重复的权重越大。`b=0.75` 控制长度归一化；0 表示忽略文档长度，1 表示完全归一化。默认值来自原始论文中 Robertson 的建议，很少需要调优。

### 第 2 步：使用双编码器的稠密检索

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

对嵌入做 L2 归一化，使点积等于余弦相似度。`all-MiniLM-L6-v2` 为 384 维，快速，对大多数英文检索足够强。多语言场景使用 `paraphrase-multilingual-MiniLM-L12-v2`。追求最高精度时，用 `bge-large-en-v1.5` 或 `e5-large-v2`。

### 第 3 步：倒数排序融合

```python
def reciprocal_rank_fusion(rankings, k=60):
    scores = {}
    for ranking in rankings:
        for rank, (_, doc_idx) in enumerate(ranking):
            scores[doc_idx] = scores.get(doc_idx, 0.0) + 1.0 / (k + rank + 1)
    fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [(score, doc_idx) for doc_idx, score in fused]
```

常数 `k=60` 来自原始 RRF 论文。较高的 `k` 会抹平排名差异的贡献；较低的 `k` 会让靠前的排名占主导。60 是已发表的默认值，很少需要调优。

### 第 4 步：混合搜索 + 重排

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

三个阶段组合而成。BM25 找到词汇匹配。稠密找到语义匹配。RRF 在不需要分数校准的情况下合并两个排名。交叉编码器将查询-文档对一起输入，对前 30 条重新打分，捕捉双编码器漏掉的细粒度相关性。保留前 5 条。

### 第 5 步：评估

| 指标 | 含义 |
|--------|---------|
| Recall@k | 在正确文档存在的查询中，它出现在前 k 名的频率是多少？ |
| MRR（Mean Reciprocal Rank） | 首个相关文档的 1/rank 的平均值。 |
| nDCG@k | 考虑相关性分级，而不仅仅是相关/不相关的二值。 |

对 RAG 而言，检索器的 **Recall@k** 是最重要的数字。如果正确的段落不在检索结果中，你的阅读器（reader）就无法作答。

调试技巧：对于失败的查询，对比稀疏和稠密的排名。如果一方找到了正确的文档而另一方没有，那么就是词汇不匹配（修复：补充缺失的一半）或语义歧义（修复：更好的嵌入或重排器）。

## 实际应用

2026 年的技术栈：

| 规模 | 技术栈 |
|-------|-------|
| 1k-100k 文档 | 内存中 BM25 + `all-MiniLM-L6-v2` 嵌入 + RRF。无需单独的数据库。 |
| 100k-10M 文档 | FAISS 或 pgvector 处理稠密 + Elasticsearch / OpenSearch 处理 BM25。并行运行。 |
| 10M+ 文档 | Qdrant / Weaviate / Vespa / Milvus，支持混合检索。在前 30 条上做交叉编码器重排。 |
| 追求极致质量 | 三路（BM25 + 稠密 + SPLADE）+ ColBERT 后期交互重排 |

无论选什么，都要为评估留出预算。在基准测试端到端 RAG 准确率之前，先基准测试检索召回率。检索器漏掉的东西，阅读器无法弥补。

### 2026 年生产级 RAG 的惨痛教训

- **80% 的 RAG 失败源于数据摄取和分块，而不是模型。** 团队花数周更换 LLM、调优提示词，而检索器却每隔三次查询就悄悄返回错误上下文。先修复分块。
- **分块策略比分块大小更重要。** 固定大小的切分会破坏表格、代码和嵌套标题。句子感知切分是默认选择；语义分块或基于 LLM 的分块对技术文档和产品手册很值得。
- **父文档模式。** 检索小的"子"块以保证精确度。当同一父级章节的多个子块同时出现时，换入父级块以保留上下文。这一做法无需重新训练就能持续提升答案质量。
- **k_rerank=3 通常是最优的。** 超过这个数的每个额外块都增加 token 成本和生成延迟，却不提升答案质量。如果 k=8 对你仍然比 k=3 好，说明重排器表现不佳。
- **HyDE / 查询扩展。** 从查询生成一个假设性答案，对它做嵌入，再检索。弥合短问题与长文档之间的措辞差距。无需训练即可免费获得精确度提升。
- **上下文预算控制在 8K token 以内。** 在该上限处持续命中说明重排器阈值过松。
- **一切都要版本化。** 提示词、分块规则、嵌入模型、重排器。任何漂移都会悄悄破坏答案质量。以忠实度、上下文精确率和未回答问题率为门槛的 CI 门禁，能在用户看到之前拦住回归。
- **三路检索（BM25 + 稠密 + SPLADE 等学习型稀疏）优于两路检索**——在 2026 年基准测试中，尤其是在专有名词与语义混合的查询上。当基础设施支持 SPLADE 索引时就上它。

根据 2026 年的行业测量，合理的检索设计可将幻觉减少 70-90%。RAG 性能提升大多来自更好的检索，而不是模型微调。

## 交付上线

保存为 `outputs/skill-retrieval-picker.md`：

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

## 练习

1. **简单。** 在 500 篇文档的语料库上实现上面的 `hybrid_search`。测试 20 个查询。比较 BM25 单独、稠密单独和混合检索在 k=5 时的召回率。
2. **中等。** 添加 MRR 计算。对每个已知正确文档的测试查询，找出正确文档在 BM25、稠密和混合排名中的名次。报告各自的 MRR。
3. **困难。** 使用 MultipleNegativesRankingLoss（Sentence Transformers）在你的领域上微调一个稠密编码器。用 500 个查询-文档对构建训练集。比较微调前后的召回率。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| BM25 | 关键词搜索 | Okapi BM25。基于词频、IDF 和长度为文档打分。 |
| 稠密检索 | 向量搜索 | 将查询 + 文档编码为向量，查找最近邻。 |
| 双编码器 | 嵌入模型 | 独立编码查询和文档。查询时快。 |
| 交叉编码器 | 重排器模型 | 将查询 + 文档一起编码。慢但准确。 |
| RRF | 排名融合 | 通过对 `1/(k + rank)` 求和来合并两个排名。 |
| Recall@k | 检索指标 | 相关文档出现在前 k 名的查询比例。 |

## 延伸阅读

- [Robertson and Zaragoza (2009). The Probabilistic Relevance Framework: BM25 and Beyond](https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf) — BM25 的权威论述。
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) — DPR，经典的双编码器。
- [Formal et al. (2021). SPLADE: Sparse Lexical and Expansion Model](https://arxiv.org/abs/2107.05720) — 缩小与稠密检索差距的学习型稀疏检索器。
- [Cormack, Clarke, Büttcher (2009). Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf) — RRF 论文。
- [Khattab and Zaharia (2020). ColBERT: Efficient and Effective Passage Search](https://arxiv.org/abs/2004.12832) — 后期交互检索。