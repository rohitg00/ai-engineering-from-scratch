# 信息检索与搜索

> BM25 精确但脆弱。密集检索撒大网但漏关键词。混合是 2026 年的默认选择。其他都是调优。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 5 · 02（BoW + TF-IDF），阶段 5 · 04（GloVe、FastText、子词）
**时间：** ~75 分钟

## 问题

用户输入"如果有人撒谎骗钱会发生什么"，期望找到实际涵盖该问题的法规："IPC 第 420 条"。关键词搜索完全找不到（没有共享词汇）。语义搜索如果在法律文本上训练过 embeddings 就能找到。真正的搜索必须处理两者。

IR 是每个 RAG 系统、每个搜索栏、每个文档网站模糊查找下的 pipeline。2026 年在生产中有效的架构不是单一方法，而是一系列互补方法的链条，每个方法捕获前一个方法的失败。

本课构建每一部分，并指出每个部分捕获哪些失败。

## 概念

四层结构。选择你需要的。

1. **稀疏检索（BM25）。** 快速，在精确匹配上精确，在语义上糟糕。在倒排索引上运行。对百万文档的查询低于 10ms。正确获取法规引用、产品代码、错误消息、命名实体。
2. **密集检索。** 将查询和文档编码为向量。最近邻搜索。捕获释义和语义相似度。遗漏相差一个字符的精确关键词匹配。使用 FAISS 或向量数据库每次查询 50-200ms。
3. **融合。** 合并稀疏和密集的排名列表。Reciprocal Rank Fusion（RRF）是简单的默认选择，因为它忽略原始分数（存在于不同尺度）且仅使用排名位置。当你知道一个信号在你的领域中占主导地位时，加权融合是一个选项。
4. **交叉编码器重排序。** 取融合后的前 30 个。运行交叉编码器（查询 + 文档一起，对每对评分）。保留前 5 个。交叉编码器每对比双编码器慢，但准确得多。你通过只在 top-30 上运行它们来分摊成本。

三路检索（BM25 + 密集 + 学习型稀疏如 SPLADE）在 2026 年基准测试中优于两路，但需要学习型稀疏索引的基础设施。对于大多数团队，两路加交叉编码器重排序是最佳点。

## 开始构建

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

两个值得了解的超参数。`k1=1.5` 控制词频饱和；越高意味着给词重复更多权重。`b=0.75` 控制长度归一化；0 忽略文档长度，1 完全归一化。默认值来自原始论文中的 Robertson 推荐，很少需要调整。

### 第 2 步：使用双编码器的密集检索

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

L2 归一化 embeddings，使得点积等于余弦。`all-MiniLM-L6-v2` 是 384 维，快速，对大多数英语检索足够强。对于多语言工作，使用 `paraphrase-multilingual-MiniLM-L12-v2`。对于最高准确率，使用 `bge-large-en-v1.5` 或 `e5-large-v2`。

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

`k=60` 这个常数来自原始 RRF 论文。更高的 `k` 会扁平化排名差异的贡献；更低的 `k` 使顶部排名主导。60 是已发布的默认值，很少需要调整。

### 第 4 步：混合搜索 + 重排序

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

三个阶段组合而成。BM25 找到词法匹配。密集检索找到语义匹配。RRF 合并两个排名，无需分数校准。交叉编码器使用查询-文档对共同重打分 top-30，捕捉双编码器遗漏的细粒度相关性。保留 top-5。

### 第 5 步：评估

| 指标 | 含义 |
|--------|---------|
| Recall@k | 在存在正确文档的查询中，它在 top-k 中出现的频率是多少？ |
| MRR（Mean Reciprocal Rank） | 第一个相关文档的 1/排名的平均值。 |
| nDCG@k | 考虑相关性分级，而不仅是二分类相关/不相关。 |

对于 RAG 特别地，检索器的 **Recall@k** 是最重要的数字。如果正确的段落不在检索到的集合中，你的阅读器无法回答。

调试技巧：对于失败的查询，对比稀疏和密集排名的差异。如果一个找到了正确的文档而另一个没有，你就有了词汇不匹配（修复：添加缺失的一半）或语义歧义（修复：更好的 embeddings 或重排序器）。

## 使用现成工具

2026 年技术栈：

| 规模 | 技术栈 |
|-------|-------|
| 1k-100k 文档 | 内存中 BM25 + `all-MiniLM-L6-v2` embeddings + RRF。无需独立数据库。 |
| 100k-1000 万文档 | FAISS 或 pgvector 用于密集 + Elasticsearch / OpenSearch 用于 BM25。并行运行。 |
| 1000 万+ 文档 | Qdrant / Weaviate / Vespa / Milvus，支持混合。在 top-30 上进行交叉编码器重排序。 |
| 最佳质量前沿 | 三路（BM25 + 密集 + SPLADE）+ ColBERT 后期交互重排序 |

无论你选择什么，都要为评估分配预算。在评估端到端 RAG 准确率之前，先对检索召回率进行基准测试。阅读器无法修复检索器遗漏的内容。

### 2026 年生产 RAG 的硬核经验教训

- **80% 的 RAG 失败追溯到引入和分块，而不是模型。** 团队花数周更换 LLM 和调优提示，而检索每三次查询就默默地返回错误的上下文。先修复分块。
- **分块策略比块大小更重要。** 固定大小分割会破坏表格、代码和嵌套标题。句子感知是默认选择；语义或基于 LLM 的分块对技术文档和产品手册有回报。
- **父文档模式。** 检索小的"子"块以获得精确度。当来自同一父章节的多个子块出现时，换成父块以保留上下文。这无需重新训练即可持续提升答案质量。
- **k_rerank=3 通常是最优的。** 超过这个数的每个额外块都会增加 token 成本和生成延迟，而不会提升答案质量。如果 k=8 仍然比 k=3 对你好，那说明重排序器表现不佳。
- **HyDE / 查询扩展。** 从查询生成一个假设性答案，嵌入它，然后检索。弥合短问题与长文档之间的措辞差距。无需训练的免费精确率提升。
- **上下文预算低于 8K token。** 在该限制下持续命中意味着重排序器阈值太宽松。
- **对所有内容进行版本管理。** 提示、分块规则、embedding 模型、重排序器。任何漂移都会静默破坏答案质量。CI 门控在忠实度、上下文精确率和未回答问题率上，在用户看到回归之前阻止它们。
- **三路检索（BM25 + 密集 + 学习型稀疏如 SPLADE）优于两路**，在 2026 年基准测试中尤其适用于混合专有名词和语义的查询。当基础设施支持 SPLADE 索引时交付。

根据 2026 年的行业测量，正确的检索设计可将幻觉减少 70-90%。大多数 RAG 性能提升来自更好的检索，而不是模型微调。

## 交付

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

1. **简单。** 在一个 500 文档语料库上实现上述 `hybrid_search`。测试 20 个查询。比较仅 BM25、仅密集和混合的 recall@5。
2. **中等。** 添加 MRR 计算。对于每个具有已知正确文档的测试查询，找到正确文档在 BM25、密集和混合排名中的排名。报告每个的 MRR。
3. **困难。** 使用 MultipleNegativesRankingLoss（Sentence Transformers）在你的领域上微调密集编码器。从 500 个查询-文档对构建训练集。比较微调前后的召回率。

## 关键术语

| 术语 | 人们说的意思 | 实际含义 |
|------|-----------------|-----------------------|
| BM25 | 关键词搜索 | Okapi BM25。通过词频、IDF 和长度对文档打分。 |
| Dense retrieval | 向量搜索 | 将查询 + 文档编码为向量，找到最近邻。 |
| Bi-encoder | Embedding 模型 | 独立编码查询和文档。查询时快速。 |
| Cross-encoder | 重排序器模型 | 一起编码查询 + 文档。慢但准确。 |
| RRF | 排名融合 | 通过求和 `1/(k + rank)` 来合并两个排名。 |
| Recall@k | 检索指标 | 相关文档在 top-k 中的查询比例。 |

## 延伸阅读

- [Robertson and Zaragoza (2009). The Probabilistic Relevance Framework: BM25 and Beyond](https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf) —— BM25 的权威论述。
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) —— DPR，经典双编码器。
- [Formal et al. (2021). SPLADE: Sparse Lexical and Expansion Model](https://arxiv.org/abs/2107.05720) —— 弥合与密集检索差距的学习型稀疏检索器。
- [Cormack, Clarke, Büttcher (2009). Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf) —— RRF 论文。
- [Khattab and Zaharia (2020). ColBERT: Efficient and Effective Passage Search](https://arxiv.org/abs/2004.12832) —— 后期交互检索。
