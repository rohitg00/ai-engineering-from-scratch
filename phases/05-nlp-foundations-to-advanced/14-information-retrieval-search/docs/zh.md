# 14 · 信息检索与搜索

> BM25 精确但脆弱。稠密检索撒网广却漏掉关键词。混合检索是 2026 年的默认方案。其余一切都是调参。

**类型：** 实战构建
**语言：** Python
**前置：** 阶段 5 · 02（词袋 + TF-IDF）、阶段 5 · 04（GloVe、FastText、子词）
**时长：** 约 75 分钟

## 问题所在

用户输入「如果有人骗钱会怎么样」，期望找到真正涵盖这一情形的法条：「印度刑法典第 420 条（Section 420 IPC）」。关键词搜索会完全错过它（没有共同词汇）。如果嵌入向量没有在法律文本上训练过，语义搜索也会错过它。真实的搜索系统必须同时应对这两种情况。

信息检索（Information Retrieval，IR）是每一个 RAG 系统、每一个搜索框、每一个文档站点模糊查找背后的流水线。能在生产环境中跑通的 2026 年架构不是单一方法，而是一条由互补方法组成的链条，每一环都负责弥补前一环的失败。

本课逐一构建每个组件，并指明每一环负责挽救哪一类失败。

## 核心概念

〔图：混合检索：BM25 + 稠密检索 + RRF + 交叉编码器重排〕

四个层次。按需选取。

1. **稀疏检索（Sparse retrieval，BM25）。** 快速、对精确匹配高度精准，但语义能力极差。在倒排索引上运行，百万级文档下单次查询耗时不到 10ms。能正确命中法条引用、产品编码、错误信息和命名实体。
2. **稠密检索（Dense retrieval）。** 将查询和文档编码为向量，做最近邻搜索。能捕捉同义改写和语义相似度。会漏掉仅差一个字符的精确关键词匹配。使用 FAISS 或向量数据库时单次查询耗时 50-200ms。
3. **融合（Fusion）。** 将稀疏与稠密的排序列表合并。倒数排名融合（Reciprocal Rank Fusion，RRF）是省心的默认选择，因为它忽略原始分数（这些分数处于不同量纲），只使用排名位置。当你明确知道某一信号在自己领域中占主导时，加权融合也是一个选项。
4. **交叉编码器重排（Cross-encoder rerank）。** 取融合结果的前 30 名，跑一遍交叉编码器（将查询 + 文档一起送入，为每一对打分），保留前 5 名。交叉编码器逐对处理比双编码器慢得多，但准确得多。通过只在前 30 名上运行来摊薄开销。

三路检索（BM25 + 稠密 + SPLADE 这类学习型稀疏检索）在 2026 年的基准测试中胜过两路检索，但需要为学习型稀疏索引搭建基础设施。对大多数团队而言，两路检索加交叉编码器重排是最佳平衡点。

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

有两个参数值得了解。`k1=1.5` 控制词频饱和度；值越高，重复出现的词项被赋予的权重越大。`b=0.75` 控制长度归一化；取 0 完全忽略文档长度，取 1 则完全归一化。这两个默认值出自原始论文中 Robertson 的推荐，很少需要调整。

### 第 2 步：用双编码器做稠密检索

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

对嵌入向量做 L2 归一化，使点积等于余弦相似度。`all-MiniLM-L6-v2` 是 384 维、速度快，对大多数英文检索任务已足够强。做多语言任务时使用 `paraphrase-multilingual-MiniLM-L12-v2`。追求最高准确率时使用 `bge-large-en-v1.5` 或 `e5-large-v2`。

### 第 3 步：倒数排名融合

```python
def reciprocal_rank_fusion(rankings, k=60):
    scores = {}
    for ranking in rankings:
        for rank, (_, doc_idx) in enumerate(ranking):
            scores[doc_idx] = scores.get(doc_idx, 0.0) + 1.0 / (k + rank + 1)
    fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [(score, doc_idx) for doc_idx, score in fused]
```

常数 `k=60` 来自最初的 RRF 论文。`k` 越大，排名差异的贡献越被抹平；`k` 越小，靠前的排名越占主导。60 是论文公布的默认值，很少需要调整。

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

三个阶段组合在一起。BM25 找出词面匹配。稠密检索找出语义匹配。RRF 无需分数校准即可合并两个排序。交叉编码器将查询-文档对一起送入，重新为前 30 名打分，从而捕捉双编码器漏掉的细粒度相关性。保留前 5 名。

### 第 5 步：评估

| 指标 | 含义 |
|--------|---------|
| Recall@k | 在确实存在正确文档的查询中，正确文档落在前 k 名的比例有多高？ |
| MRR（平均倒数排名，Mean Reciprocal Rank） | 首个相关文档排名倒数（1/rank）的平均值。 |
| nDCG@k | 考虑相关性的分级程度，而不只是「相关/不相关」的二元判断。 |

特别是对 RAG 而言，检索器的 **Recall@k** 是最重要的数字。如果正确段落根本不在检索结果集中，阅读器（reader）就无从作答。

调试小贴士：对于失败的查询，对比稀疏排序与稠密排序的差异。如果其中一个找到了正确文档而另一个没找到，那么你遇到的要么是词汇不匹配（解决办法：补上缺失的那一半），要么是语义歧义（解决办法：换更好的嵌入或加上重排器）。

## 实际运用

2026 年的技术栈：

| 规模 | 技术栈 |
|-------|-------|
| 1k-100k 篇文档 | 内存中的 BM25 + `all-MiniLM-L6-v2` 嵌入 + RRF。无需独立数据库。 |
| 100k-10M 篇文档 | 稠密侧用 FAISS 或 pgvector + BM25 侧用 Elasticsearch / OpenSearch。并行运行。 |
| 10M+ 篇文档 | 支持混合检索的 Qdrant / Weaviate / Vespa / Milvus。在前 30 名上做交叉编码器重排。 |
| 顶级质量前沿 | 三路检索（BM25 + 稠密 + SPLADE） + ColBERT 后期交互（late-interaction）重排 |

无论怎么选，都要为评估留出预算。先对检索召回率做基准测试，再对端到端 RAG 准确率做基准测试。检索器漏掉的东西，阅读器无法补救。

### 2026 年生产级 RAG 中的血泪经验

- **80% 的 RAG 失败可追溯到数据摄入和分块（chunking），而非模型本身。** 团队花数周时间更换大模型、调整提示词，而检索却在每三个查询里就悄悄返回一次错误上下文。先把分块修好。
- **分块策略比分块大小更重要。** 固定大小的切分会把表格、代码和嵌套标题切坏。句子感知（sentence-aware）分块是默认选择；语义分块或基于大模型的分块在技术文档和产品手册上更划算。
- **父文档模式（Parent-doc pattern）。** 检索小的「子」块以保证精确度。当来自同一父级章节的多个子块同时出现时，替换为父级块以保留上下文。这一做法无需重新训练即可稳定提升答案质量。
- **`k_rerank=3` 通常是最优值。** 超过这个数的每一个额外块都会增加 token 成本和生成延迟，却不会提升答案质量。如果对你来说 k=8 仍然优于 k=3，那是重排器表现不佳。
- **HyDE / 查询扩展（query expansion）。** 由查询生成一个假设性答案，对它做嵌入，再去检索。它弥合了短问题与长文档之间的措辞差距。无需训练即可免费提升精确度。
- **上下文预算控制在 8K token 以内。** 如果总是顶到这个上限，说明重排器的阈值设得太宽松。
- **一切都要做版本管理。** 提示词、分块规则、嵌入模型、重排器。任何漂移都会悄悄破坏答案质量。以忠实度（faithfulness）、上下文精确度（context precision）和未答问题率（unanswered-question rate）作为 CI 关卡，在用户察觉之前拦住回退。
- **三路检索（BM25 + 稠密 + SPLADE 这类学习型稀疏检索）在 2026 年基准测试中胜过两路检索**，尤其是对那些把专有名词与语义混在一起的查询。当基础设施支持 SPLADE 索引时就上它。

根据 2026 年的行业测量数据，合理的检索设计能将幻觉减少 70-90%。RAG 的大部分性能提升来自更好的检索，而非模型微调。

## 交付产物

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

1. **简单。** 在一个 500 篇文档的语料上实现上面的 `hybrid_search`。用 20 个查询测试。比较仅 BM25、仅稠密、混合三者在 5 处的召回率。
2. **中等。** 加入 MRR 计算。对每个有已知正确文档的测试查询，找出正确文档在 BM25、稠密和混合排序中的排名。报告三者各自的 MRR。
3. **困难。** 使用 MultipleNegativesRankingLoss（Sentence Transformers）在你自己的领域上微调一个稠密编码器。用 500 对查询-文档构建训练集。比较微调前后的召回率。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| BM25 | 关键词搜索 | Okapi BM25。根据词频、IDF 和文档长度为文档打分。 |
| 稠密检索（Dense retrieval） | 向量搜索 | 将查询 + 文档编码为向量，找最近邻。 |
| 双编码器（Bi-encoder） | 嵌入模型 | 独立编码查询和文档。查询时速度快。 |
| 交叉编码器（Cross-encoder） | 重排模型 | 将查询 + 文档一起编码。慢但准确。 |
| RRF | 排名融合 | 通过对 `1/(k + rank)` 求和来合并两个排序。 |
| Recall@k | 检索指标 | 相关文档落在前 k 名的查询所占比例。 |

## 延伸阅读

- [Robertson and Zaragoza (2009). The Probabilistic Relevance Framework: BM25 and Beyond](https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf) —— 关于 BM25 的权威论述。
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) —— DPR，经典的双编码器。
- [Formal et al. (2021). SPLADE: Sparse Lexical and Expansion Model](https://arxiv.org/abs/2107.05720) —— 缩小与稠密检索差距的学习型稀疏检索器。
- [Cormack, Clarke, Büttcher (2009). Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf) —— RRF 论文。
- [Khattab and Zaharia (2020). ColBERT: Efficient and Effective Passage Search](https://arxiv.org/abs/2004.12832) —— 后期交互检索。
