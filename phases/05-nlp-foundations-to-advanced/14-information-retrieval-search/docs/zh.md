# Information Retrieval and Search

> BM 25精确但易碎。密集撒网广，但错过关键词。混合型是2026年的默认版本。其他一切都在调整。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段5 · 02（BoW + TF-IDF）、阶段5 · 04（GloVe、Fasttext、Subword）
** 时间：** ~75分钟

## The Problem

用户输入“如果有人为了赚钱而撒谎会发生什么”，并希望找到实际涵盖这一点的法规：“IPC第420条。“关键词搜索完全错过了它（没有共享词汇）。如果嵌入不是在法律文本上训练的，语义搜索就会错过它。真正的搜索必须同时处理这两个问题。

IR是每个RAG系统、每个搜索栏、每个文档网站的模糊查找下的管道。适用于生产的2026年架构并不是单一方法。这是一系列互补方法，每一种方法都会发现前一种方法的失败。

本课构建了每件作品，并列出了每件作品所遇到的失败。

## The Concept

![Hybrid retrieval: BM25 + dense + RRF + cross-encoder rerank](../assets/retrieval.svg)

四层。选择您需要的。

1. ** 稀疏检索（BM 25）。**快速、精确匹配，但语义很糟糕。运行倒置指数。对数百万个文档进行每次查询的时间低于10 ms。获取法规引用、产品代码、错误消息、命名实体权利。
2. ** 密集检索。**将查询和文档编码为载体。最近的邻居搜索。捕获重述和语义相似性。错过相差一个字符的确切关键字匹配。使用FAISS或载体DB每次查询50- 200 ms。
3. ** 融合。**合并稀疏和密集的排名列表。互惠排名融合（RRF）是简单的默认值，因为它忽略原始分数（以不同的量表存在）并且仅使用排名位置。当您知道一个信号对您的域占主导地位时，加权融合是一种选择。
4. ** 交叉编码器重新排名。**从融合中获得前30名。运行交叉编码器（查询+文档一起，对每对进行评分）。保持前5名。每对交叉编码器比双编码器慢，但准确得多。您只需将它们排在前30名即可摊销。

三向检索（BM 25+密集+学习稀疏，如SPLADE）在2026年基准中优于双向检索，但需要用于学习稀疏索引的基础设施。对于大多数团队来说，双向加交叉编码器重新排名是最佳选择。

## Build It

### Step 1: BM25 from scratch

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

两个值得了解的参数。“k1=1.5”控制术语频率饱和度;越高意味着术语重复的权重越大。' b=0.75 '控制长度规范化; 0忽略文档长度，1完全规范化。默认值是罗伯逊在原始论文中提出的建议，很少需要调整。

### Step 2: dense retrieval with a bi-encoder

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

L2-归一化嵌入，使点积等于余弦。`all-MiniLM-L 6-v2`是384-dim，快速，强大，足以满足大多数英语检索。对于多语言工作，使用`paraphrase-multilingual-MiniLM-L12-v2`。对于最高精度，请使用`bge-large-en-v1.5`或`e5-large-v2`。

### Step 3: Reciprocal Rank Fusion

```python
def reciprocal_rank_fusion(rankings, k=60):
    scores = {}
    for ranking in rankings:
        for rank, (_, doc_idx) in enumerate(ranking):
            scores[doc_idx] = scores.get(doc_idx, 0.0) + 1.0 / (k + rank + 1)
    fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [(score, doc_idx) for doc_idx, score in fused]
```

“k=60”常数来自RRF原始论文。较高的k是排名差异的贡献;较低的k使顶级排名占据主导地位。60是已发布的默认值，很少需要调整。

### Step 4: hybrid search + rerank

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

组成三个阶段。BM 25查找词汇匹配。密集查找语义匹配。RRF将两个排名合并，无需分数校准。交叉编码器使用查询-文档对一起重核前30个，这捕获了双向编码器错过的细粒度相关性。保持前5名。

### Step 5: evaluation

| 度量 | 意义 |
|--------|---------|
| 召回@k | 对于存在正确文档的查询，它出现在top-k中的频率有多高？ |
| MRR（平均倒数） | 平均1/第一个相关文件的等级。 |
| nDCG@k | 考虑相关性等级，而不仅仅是二元相关/不相关。 |

特别对于RAG来说，寻回犬的 **Recall@k** 是最重要的数字。如果正确的段落不在检索到的集中，您的读者无法回答。

收件箱提示：对于失败的查询，区分稀疏和密集排名。如果一个人找到了正确的文档，而另一个人没有找到，那么您就会出现词汇不匹配（修复：添加缺失的一半）或语义模糊（修复：更好的嵌入或重新排序）。

## Use It

2026年堆栈：

| 规模 | 堆叠 |
|-------|-------|
| 1 k-100 k个文档 | 内存BM 25 +' all-MiniLM-L 6-v2 '嵌入+ RRF。没有单独的DB。 |
| 100 k-10 M个文档 | FAISS或pgvector for dense + Elasticsearch / OpenSearch for BM 25。平行运行。 |
| 1000万+个文档 | Qdrant / Weaviate / Vespa / Milvus，提供混合支持。交叉编码器重新排名前30名。 |
| 最佳质量边界 | 三向（BM 25+密集+ SPLADE）+ ColBERT后期互动重新排名 |

无论您选择什么，请为评估做预算。在对端到端RAG准确性进行基准测试之前进行基准检索召回。读者无法修复寻回犬错过的内容。

### The hard-won lessons from 2026 production RAG

- **80%的RAG故障可追溯到摄入和分块，而不是模型。**团队花费数周的时间交换LLM和调优提示，而检索每三个查询都会悄悄返回错误的上下文。首先修复分块。
- ** 分块策略比块大小更重要。**固定大小拆分中断表、代码和嵌套标题。默认情况是句子感知;语义或基于LLM的分块可以为技术文档和产品手册带来回报。
- ** 家长医生模式。**删除小的“子”块以确保准确性。当出现同一父部分的多个子部分时，交换父块以保留上下文。这在无需再培训的情况下持续提高了答案质量。
- **k_rank =3通常是最佳选择。**过去的每一个额外的区块都会增加代币成本和生成延迟，而不会提高答案质量。如果k=8对您来说仍然优于k=3，那么重新排名者的表现不佳。
- **HyDE /查询扩展。**从查询中生成假设答案，嵌入并检索。弥合了短问题和长文件之间的措辞差距。免费精确提升，无需培训。
- ** 8 K代币以下的上下文预算。**持续命中该限制意味着重排序阈值太宽松。
- ** 版本所有内容。**预算、分块规则、嵌入模型、重新排名。任何漂移都会悄悄地破坏答案质量。在用户看到回归之前，CI会对忠实性、上下文精确性和未回答问题率进行封锁。
- ** 三路检索（BM 25+密集+学习-稀疏，如SPLADE）在2026年基准测试中优于双向 **，尤其是对于混合专有名词和语义的查询。当基础设施支持SPLADE索引时发货。

根据2026年行业测量，适当的检索设计可将幻觉减少70-90%。大多数RAG性能收益来自更好的检索，而不是模型微调。

## Ship It

另存为“输出/skill-retrieval-picker.md”：

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

## Exercises

1. ** 简单。**在500个文档的数据库上实现上面的“hybrid_search”。测试20个查询。比较仅BM 25、仅密集和混合之间的召回率为5。
2. ** 中等。**添加MRR计算。对于具有已知正确文档的每个测试查询，在BM 25、密集和混合排名中查找正确文档的排名。报告每个人的MRR。
3. ** 很难。**使用MultipleNegativesRankingLoss（Sentence Transformers）微调域上的密集编码器。从500个查询文档对构建训练集。比较微调前和微调后的召回。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| BM25 | 关键字搜索 | 霍加皮BM 25。按术语频率、IDF和长度对文档进行评分。 |
| 密集检索 | 矢量搜索 | 将查询+文档编码为载体，找到最近的邻居。 |
| 双编码器 | 嵌入模型 | 独立编码查询和文档。查询时间快。 |
| 交叉编码器 | 重新分析模型 | 将查询+文档编码在一起。缓慢但准确。 |
| RRF | 等级融合 | 通过相加“1/（k + rank）”来组合两个排名。 |
| 召回@k | 检索指标 | 相关文档位于前k中的查询比例。 |

## Further Reading

- [罗伯逊和萨拉戈萨（2009）。概率相关性框架：BM 25及以后]（https：//www.staff.city.ac.uk/guardsbrp622/papers/foundations_bm25_review.pdf）-BM 25的最终治疗。
- [Karpukhin等人（2020）。开放域QA的密集通道检索]（https：//arxiv.org/ab/2004.04906）- DPR，规范的双编码器。
- [Formal等人（2021）。SPLADE：稀疏词汇和扩展模型]（https：//arxiv.org/ab/2107.05720）-学习稀疏检索器，用密集缩小差距。
- [Cormack、Clarke、Büttcher（2009）。互惠Rank Fusion优于Condorcet和个体Rank Learning方法]（https：//plg.uwaterloo.ca/guardgvcormac/cormacksigir09-rrf.pdf）- RRF论文。
- [Khattab和Zaharia（2020）。ColBERT：高效且有效的段落搜索]（https：//arxiv.org/ab/2004.12832）-后期交互检索。
