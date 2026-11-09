# 获取信息和搜索

> 虽然BM25是精确的,但很脆弱.密集的网投宽,但错过关键字.混合型是2026年默认的.其他一切都在调整.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 04 (GloVe, FastText, Subword)
**Time:** ~75 minutes

## 问题

用户输入"如果有人说谎来获得钱会发生什么?"并希望找到实际覆盖该条例:"IPC第420条".一个关键词搜索完全错过了它 (没有共享的词汇库).一个语义搜索错过了它如果嵌入式没有训练在法律文本.真正的搜索必须处理两者.

根据"图库"的定义,每一个图库都会被查到一个位置,每一个图库都会被查到一个位置.

这一课构建了每一个小块,每一个捕获都失败了.

## 概念

![Hybrid retrieval: BM25 + dense + RRF + cross-encoder rerank](../assets/retrieval.svg)

选择你需要的四层.

1. **Sparse retrieval (BM25).**快速,准确的匹配,可怕的语义. 翻转索引. 每次查询在数百万文件中. 获得法规引用,产品代码,错误信息,命名实体正确.
2. **Dense retrieval.**编码查询和文件成向量. 最近邻居搜索.捕捉句子和语义相似性. 错过一个字符不同的关键字匹配. 50-200ms 每个查询与FAISS或向量DB.
3. **Fusion.**合并排名列表从稀疏和密集. 相互排名融合 (RRF) 是简单的默认,因为它忽略原始分数 (生活在不同的尺度中) 并仅使用排名位置.当你知道一个信号为你的域占主导地位时,重量融合是一个选择.
4. **Cross-encoder rerank.**通过合,运行一个跨编码器 (查询+文档一起,分分分每对).保持前五个.跨编码器比双编码器较慢,但更准确.

两向检索 (BM25 +密集 +学习空间,如SPLADE) 在2026年比较高于两向检索,但需要学习空间指数的基础设施.对于大多数团队来说,双向加加密交叉编码重排是最好的点.

```figure
gx-hybrid-retrieval
```

## 建立它

### 步骤1:从零开始BM25

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

值得知道的两个参数.`k1=1.5`控制术语频率和;更高意味着更重的术语重复. `b=0.75`根据罗伯逊的建议,通常需要调整. 根据罗伯逊的建议, 罗伯逊的建议, 罗伯逊的建议是完全正常化的.

### 步骤2:使用双编码器进行密集检索

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

点产量等于kosine.`all-MiniLM-L6-v2`对于多语言工作,使用 `paraphrase-multilingual-MiniLM-L12-v2`为了最准确的,`bge-large-en-v1.5`或`e5-large-v2`现在,我们要去.

### 步骤3:相互级别的融合

```python
def reciprocal_rank_fusion(rankings, k=60):
    scores = {}
    for ranking in rankings:
        for rank, (_, doc_idx) in enumerate(ranking):
            scores[doc_idx] = scores.get(doc_idx, 0.0) + 1.0 / (k + rank + 1)
    fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [(score, doc_idx) for doc_idx, score in fused]
```

其他`k=60`常数来自原始的RRF纸.`k`降低了排名差异的贡献;`k`现在,我们在这个问题上,我们需要一个问题.

### 步骤4:混合搜索+重排

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

组建三个阶段.BM25发现词汇匹配.密集发现语义匹配.RRF不需要分数校准的情况下合并两个排名.跨编码器使用查询文档对进行重新评分,从而捕获了双编码器错过的细粒度相关性.保持前-5.

### 五步:评估

| Metric | Meaning |
|--------|---------|
| Recall@k | Of queries where the correct document exists, how often is it in the top-k? |
| MRR (Mean Reciprocal Rank) | Average of 1/rank of first relevant document. |
| nDCG@k | Accounts for relevance gradations, not just binary relevant/not. |

对于RAG而言,**Recall@k**如果没有正确的段落,读者不能回答.

调试提示:对于失败的查询,分别稀疏和密集的排名.如果一个找到正确的文档,而另一个没有,你会出现词汇不匹配 (修正:添加缺失的一半) 或语义模糊 (修正:更好的嵌入或重新排名).

## 用它

现在,我们要做什么?

| Scale | Stack |
|-------|-------|
| 1k-100k docs | In-memory BM25 + `all-MiniLM-L6-v2` embeddings + RRF. No separate DB. |
| 100k-10M docs | FAISS or pgvector for dense + Elasticsearch / OpenSearch for BM25. Run in parallel. |
| 10M+ docs | Qdrant / Weaviate / Vespa / Milvus with hybrid support. Cross-encoder rerank on top-30. |
| Best-quality frontier | Three-way (BM25 + dense + SPLADE) + ColBERT late-interaction reranking |

根据您选择的预算进行评估. 预测检索提醒,然后再进行预测,以检测到RAG的精度.

### 2026年生产RAG的难以获取教训

- **80% of RAG failures trace to ingestion and chunking, not the model.**团队花了几周时间交换LLM和调整提示,而检索每第三次查询都会地返回错误的文本.
- **Chunking strategy matters more than chunk size.**固定尺寸分开分开表,代码和嵌入式标题.句子意识是默认的;语义或LLM基于的分断为技术文件和产品手册付出代价.
- **Parent-doc pattern.**检索小小的"孩子"块以获得精确性.当来自同一父母部分的多个孩子出现时,在父母块中交换以保持文本.这在不需要重新训练的情况下不断提高答案质量.
- **k_rerank=3 is usually optimal.**如果 k=8 对你来说仍然比 k=3 更好,那么重新排名器的性能低.
- **HyDE / query expansion.**通过查询生成一个假设答案,嵌入,检索. 弥合短问题和长文档之间的措辞差距. 免费的精确升降,没有训练.
- **Context budget under 8K tokens.**连续击中这个极限意味着重排门太松散了.
- **Version everything.**提示,分量规则,嵌入模型,重新排序器.任何漂移都会默默破坏答案质量. CI 关闭信任,文本精确性和未回答问题的率,用户在看到之前阻止回归.
- **Three-way retrieval (BM25 + dense + learned-sparse like SPLADE) outperforms two-way**根据2026年基准,特别是对混合正确名词和语义的查询.

根据2026年行业测量,正确的检索设计可以减少70-90%.大多数RAG性能增长来自更好的检索,而不是模型细节调整.

## 运送它

保存如`outputs/skill-retrieval-picker.md`其他:

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

## 运动

1. **Easy.**实施`hybrid_search`测试20个查询. 仅BM25,仅密集和混合物之间的5个回忆.
2. **Medium.**添加MRR计算.对于每个已知正确文档的测试查询,在BM25,密集和混合排名中找到正确文档的排名. 报告每个文档的MRR.
3. **Hard.**通过多个负面排名输失 (Sentence Transformers) 调整域名上的密集编码器.从500个查询文档对构建训练集.比较调整前和调整后的回忆.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BM25 | Keyword search | Okapi BM25. Scores documents by term frequency, IDF, and length. |
| Dense retrieval | Vector search | Encode query + doc into vectors, find nearest neighbors. |
| Bi-encoder | Embedding model | Encodes query and doc independently. Fast at query time. |
| Cross-encoder | Reranker model | Encodes query + doc together. Slow but accurate. |
| RRF | Rank fusion | Combine two rankings by summing `1/(k + rank)`. |
| Recall@k | Retrieval metric | Fraction of queries where a relevant doc is in the top-k. |

## 进一步阅读

- [Robertson and Zaragoza (2009). The Probabilistic Relevance Framework: BM25 and Beyond](https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf)最终的BM25治疗.
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906)DPR,是法典双码码器.
- [Formal et al. (2021). SPLADE: Sparse Lexical and Expansion Model](https://arxiv.org/abs/2107.05720)                              
- [Cormack, Clarke, Büttcher (2009). Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)  纸质
- [Khattab and Zaharia (2020). ColBERT: Efficient and Effective Passage Search](https://arxiv.org/abs/2004.12832) 晚间互动检索.
