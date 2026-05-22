# 信息检索与搜索

> BM25 精确但脆弱。稠密检索网罗广泛但遗漏关键词。混合检索是2026年的默认选择。其他所有工作都是调参。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段5 · 02（BoW + TF-IDF），阶段5 · 04（GloVe、FastText、子词）
**耗时：** 约75分钟

## 问题

用户输入“如果有人通过撒谎来获取钱财会发生什么”时，期望能找到真正涵盖该行为的法条：“印度刑法典第420条”。关键词搜索完全无法命中（没有共享的词汇）。语义搜索如果嵌入向量不是在法律文本上训练的，也会错过正确结果。真正的搜索必须同时处理这两种情况。

信息检索（IR）是所有 RAG 系统、搜索栏、文档站点模糊查找背后的流水线。2026年在生产环境中工作的架构不是单一方法，而是一系列互补方法组成的链条，每种方法都弥补前一种方法的不足。

本课程将逐一构建这些组件，并说明每种组件解决了哪些失效场景。

## 概念

![混合检索：BM25 + 稠密检索 + RRF + 交叉编码器重排序](../assets/retrieval.svg)

四个层次。按需选用。

1. **稀疏检索（BM25）。** 速度快，精确匹配准确，语义方面表现差。基于倒排索引运行。在数百万篇文档上每次查询耗时低于10毫秒。能准确找到法条引用、产品代码、错误消息、命名实体。
2. **稠密检索。** 将查询和文档编码为向量。最近邻搜索。捕获同义改写和语义相似性。但会遗漏相差一个字符的精确关键词匹配。使用 FAISS 或向量数据库时每次查询耗时50-200毫秒。
3. **融合。** 合并稀疏检索和稠密检索的排序列表。倒数排序融合（Reciprocal Rank Fusion, RRF）是简单的默认方法，因为它忽略原始分数（这些分数处于不同的量级），仅使用排名位置。当你清楚某一信号在你的领域中占主导时，可以选择加权融合。
4. **交叉编码器重排序。** 取融合后的前30个结果。运行交叉编码器（将查询和文档一起输入，对每个配对打分）。保留前5个。交叉编码器每对样本的推理速度比双编码器慢，但准确度远高于后者。通过仅在顶部30个结果上运行来分摊成本。

在2026年的基准测试中，三重检索（BM25 + 稠密检索 + 学习型稀疏检索如 SPLADE）优于双重检索，但需要为学习型稀疏索引搭建基础设施。对于大多数团队，双重检索加上交叉编码器重排序是最佳平衡点。

## 构建它

### 步骤1：从头实现 BM25

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

有两个值得了解的参数。`k1=1.5` 控制词频饱和；值越大，对词重复赋予的权重越高。`b=0.75` 控制长度归一化；值为0忽略文档长度，值为1完全归一化。这两个默认值来自 Robertson 在原始论文中的建议，很少需要调整。

### 步骤2：使用双编码器进行稠密检索

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

将嵌入向量进行 L2 归一化，使得点积等于余弦相似度。`all-MiniLM-L6-v2` 维度为384，速度快，对于大多数英文检索足够强。用于多语言场景时，使用 `paraphrase-multilingual-MiniLM-L12-v2`。追求最高准确度时，使用 `bge-large-en-v1.5` 或 `e5-large-v2`。

### 步骤3：倒数排序融合

```python
def reciprocal_rank_fusion(rankings, k=60):
    scores = {}
    for ranking in rankings:
        for rank, (_, doc_idx) in enumerate(ranking):
            scores[doc_idx] = scores.get(doc_idx, 0.0) + 1.0 / (k + rank + 1)
    fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [(score, doc_idx) for doc_idx, score in fused]
```

常数 `k=60` 来自原始的 RRF 论文。`k` 越大，排名差异的贡献越平缓；`k` 越小，高排名的主导作用越强。60 是公布的默认值，很少需要调整。

### 步骤4：混合搜索 + 重排序

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

三个阶段的组合。BM25 找到词汇匹配。稠密检索找到语义匹配。RRF 在不需要分数校准的情况下合并两个排序。交叉编码器将查询和文档配对后对前30个结果重新打分，捕获双编码器遗漏的细粒度相关性。保留前5个。

### 步骤5：评估

| 评估指标 | 含义 |
|--------|------|
| Recall@k | 在正确文档存在的查询中，它出现在前k位中的比例。 |
| MRR（平均倒数排名） | 第一个相关文档的排名倒数的平均值。 |
| nDCG@k | 考虑相关性的分级（不仅是二值相关/不相关）。 |

专门针对 RAG，检索器的 **Recall@k** 是最重要的数值。如果正确的段落不在检索集合中，阅读器无法给出答案。

调试技巧：对于失败的查询，比较稀疏和稠密检索的排序。如果其中一个找到了正确文档而另一个没有，要么是词汇不匹配（修复：添加缺失的一半），要么是语义歧义（修复：更好的嵌入向量或重排序器）。

## 使用它

2026 年技术栈：

| 规模 | 技术栈 |
|-------|--------|
| 1k-100k 篇文档 | 内存中的 BM25 + `all-MiniLM-L6-v2` 嵌入向量 + RRF。无需单独的数据库。 |
| 100k-10M 篇文档 | 使用 FAISS 或 pgvector 进行稠密检索 + 使用 Elasticsearch / OpenSearch 进行 BM25 检索。并行运行。 |
| 10M+ 篇文档 | Qdrant / Weaviate / Vespa / Milvus 并支持混合检索。对前30个结果进行交叉编码器重排序。 |
| 最优质量前沿 | 三重检索（BM25 + 稠密检索 + SPLADE）+ ColBERT 晚期交互重排序 |

无论你选择什么，都要为评估留出预算。在衡量端到端 RAG 准确率之前，先基准测试检索的召回率。阅读器无法修正检索器遗漏的内容。

### 2026年生产级 RAG 的宝贵经验

- **80% 的 RAG 失败源于数据摄入和分块，而非模型。** 团队花费数周切换 LLM 并调整提示词，而检索器默默地在每三次查询中返回一次错误上下文。先解决分块问题。
- **分块策略比分块大小更重要。** 固定大小的切分会破坏表格、代码和嵌套标题。句子感知分块是默认选择；对于技术文档和产品手册，语义或基于 LLM 的分块效果更佳。
- **父文档模式。** 检索小的“子”块以保持精确性。当来自同一父节的多个子块出现时，用父块替换以保留上下文。此方法无需重新训练即可持续提升回答质量。
- **k_rerank=3 通常最优。** 超过这个数量的每个额外块都会增加 token 开销和生成延迟，而不提升回答质量。如果你那里 k=8 仍然优于 k=3，说明重排序器表现不佳。
- **HyDE / 查询扩展。** 从查询生成一个假设性的回答，将其嵌入后进行检索。在短查询和长文档之间架起措辞鸿沟。无需训练即可获得免费的精确度提升。
- **上下文预算不超过 8K tokens。** 在此限制下持续命中意味着重排序器的阈值过于宽松。
- **所有内容皆需版本控制。** 提示词、分块规则、嵌入模型、重排序器。任何漂移都会悄悄破坏回答质量。CI 门控（对忠实性、上下文精确度、未回答问题率的检查）在用户发现问题之前阻止回归。
- **三重检索（BM25 + 稠密检索 + 学习型稀疏检索如 SPLADE）优于双重检索**，在 2026 年基准测试中尤其适用于混合了专有名词和语义的查询。当基础设施支持 SPLADE 索引时，可以部署该方案。

据 2026 年行业测量，合理的检索设计可将幻觉减少 70-90%。大多数 RAG 性能提升来自更好的检索，而非模型微调。

## 交付它

保存为 `outputs/skill-retrieval-picker.md`：

```markdown
---
name: retrieval-picker
description: 为给定的语料库和查询模式选择检索技术栈。
version: 1.0.0
phase: 5
lesson: 14
tags: [nlp, retrieval, rag, search]
---

给定需求（语料库大小、查询模式、延迟预算、质量标准、基础设施约束），输出：

1. 技术栈。仅 BM25、仅稠密检索、混合（BM25 + 稠密检索 + RRF）、混合 + 交叉编码器重排序、或三重检索（BM25 + 稠密检索 + 学习型稀疏检索）。
2. 稠密编码器。指定具体模型。匹配语言、领域和上下文长度。
3. 重排序器。如果使用，指定具体的交叉编码器模型。注意重排序会在前30个结果上增加30-100毫秒延迟。
4. 评估计划。Recall@10 是主要的检索器指标。对于多答案场景使用 MRR。先建立基线，增量改进需相对于基线测量。

对于含有命名实体、错误代码或产品 SKU 的语料库，拒绝推荐仅稠密检索，除非用户有证据表明稠密检索能处理精确匹配。对于高风险检索（法律、医疗）——其中最终前5个结果决定了用户的答案——拒绝跳过重排序。
```

## 练习

1. **简单。** 在一个包含500篇文档的语料库上实现上述 `hybrid_search`。测试20个查询。比较仅 BM25、仅稠密检索、以及混合检索的 recall@5。
2. **中等。** 添加 MRR 计算。对于每个已知正确文档的测试查询，在 BM25、稠密和混合检索排序中找到正确文档的排名。报告每种方法的 MRR。
3. **困难。** 使用 MultipleNegativesRankingLoss（Sentence Transformers）在你的领域上微调一个稠密编码器。从500个查询-文档对构建训练集。比较微调前后的召回率。

## 关键术语

| 术语 | 人们常说的意思 | 实际含义 |
|------|----------------|--------|
| BM25 | 关键词搜索 | Okapi BM25。根据词频、IDF和长度对文档打分。 |
| 稠密检索 | 向量搜索 | 将查询和文档编码为向量，寻找最近邻。 |
| 双编码器 | 嵌入模型 | 独立编码查询和文档。查询时速度快。 |
| 交叉编码器 | 重排序模型 | 一起编码查询和文档。速度慢但准确。 |
| RRF | 排序融合 | 通过求和 `1/(k + rank)` 合并两个排序。 |
| Recall@k | 检索指标 | 查询中相关文档出现在前k个中的比例。 |

## 延伸阅读

- [Robertson and Zaragoza (2009). The Probabilistic Relevance Framework: BM25 and Beyond](https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf) — BM25 的权威论述。
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) — DPR，经典的双编码器模型。
- [Formal et al. (2021). SPLADE: Sparse Lexical and Expansion Model](https://arxiv.org/abs/2107.05720) — 学习型稀疏检索器，缩小了与稠密检索的差距。
- [Cormack, Clarke, Büttcher (2009). Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf) — RRF 论文。
- [Khattab and Zaharia (2020). ColBERT: Efficient and Effective Passage Search](https://arxiv.org/abs/2004.12832) — 晚期交互检索。