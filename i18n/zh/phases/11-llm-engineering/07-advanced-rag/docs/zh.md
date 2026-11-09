# 技术的发展

> 基本RAG检索了最相似的顶部k块. 这适用于简单的问题. 它用于多个跳槽推理,模糊的查询和大体. 高级RAG是 10 文件的演示和 10 百万文件的系统之间的区别.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11, Lesson 06 (RAG)
**Time:** ~90 minutes
**Related:**阶段5 · 23 (RAG的零碎策略) 涵盖了所有六种零碎算法复式,语义,句子,母文档,晚期零碎,文本检索使用VECTARA/Anthropic基准.本课程建立在上面:混合搜索,重排,查询转换.

## 学习目标

- 实施先进的分断策略 (语义,递归,父母和孩子) 保存文档结构和文本
- 构建一个混合搜索管道,结合BM25关键字匹配与语义向量搜索和跨编码重排器
- 应用查询转换技术 (HyDE,多查询,退步) 改善对模糊或复杂的问题的检索
- 诊断和修复常见的RAG故障:错误的部分检索,答案不在文本中,多跳推理分断

## 问题

在第06课中,你建立了一个基本的RAG管道.

**Ambiguous query**语义搜索显示了收入战略,收入预测和财务总监对收入增长的想法.所有这些都与"收入"这个词类似.没有包含实际数字.正确的部分说:"$47.2M in Q3 2025" but uses the word "earnings" instead of "revenue." The embedding model thinks "revenue strategy" is closer to the query than "Q3 earnings were $其他国家

**Multi-hop question**答案: "哪个团队获得了最高的客户满意度评分改善?" 这需要找到每个团队的满意度评分,将它们比较,并确定最大的.没有单个部分包含答案.信息分散在团队报告中.

**Large corpus problem**您有200万块.正确的答案是#1,847,293块.您的前五个检索引入了#14,#89,201,#1,200,000,#44,#901,333块. 嵌入空间很近,但没有包含答案.在这个规模上,近邻搜索引入了足够的错误,使相关结果被推出了上层k.

基本RAG失败,因为向量相似性与相关性不同. 一个部分可以从语义上看似一个查询,但没有用于回答它. 高级RAG使用四种技术解决这一问题:混合搜索 (添加关键词匹配),重新排名 (更仔细评分候选人),查询转换 (在搜索之前修复查询),更好的分量 (在正确的细分度中检索).

## 概念

### 混合搜索:语义 +关键词

语义搜索 (向量相似性) 很好理解意义. "我如何取消订阅?"与"取消你的计划的步骤"相匹配,尽管他们没有分享任何单词.但它没有准确的匹配. "错误代码E-4021"可能不匹配含有"E-4021"的部分,如果嵌入模型把它视为噪音.

关键字搜索 (BM25) 是相反的.它在精确匹配时优异. "E-4021"匹配完美. 但如果文件说"终止你的计划",则"取消我的订阅"返回零结果.

混合搜索运行了两者,然后将结果合并.

**BM25**搜索引擎的核心是自1990年代以来.

```
BM25(q, d) = sum over terms t in q:
    IDF(t) * (tf(t,d) * (k1 + 1)) / (tf(t,d) + k1 * (1 - b + b * |d| / avgdl))
```

在文件d中的tf,d是t的术语频率, IDF(t) 是反向文件频率,

简单地说:当包含查询术语 (特别是罕见的) 时,BM25的文档得分更高,但重复术语的回报率却下降.一个用字母"收入"50倍的文档并不比一次使用的文档50倍更相关.

### 相互级别融合 (RRF)

它们是如何组合的? 相互排列融合是标准方法.

```
RRF_score(d) = sum over rankings R:
    1 / (k + rank_R(d))
```

在这种情况下, k 是一个常数 (通常是60),它阻止了排名最高的结果占据主导地位.

在向量搜索中排名第一的文件和BM25中排名第五的文件得到: 1/(60+1) + 1/(60+5) = 0.0164 + 0.0154 = 0.0318

在向量搜索中排名第3的文件和BM25中排名第2的文件得到: 1/(60+3) + 1/(60+2) = 0.0159 + 0.0161 = 0.0320

根据RRF的数据,RRF自然会平衡两个信号.在两个列表中排名高的文档获得最佳分数.在一个列表中排名第一但不在另一个列表中排名的文档获得中等分数.这是强大的,因为它使用排名,而不是原始分数,因此两种系统之间的分数分布差异并不重要.

### 排名重定

检索 (无论是向量,关键字或混合) 是快速的,但不准确的.它使用双编码器:查询和每个文档都独立嵌入,然后进行比较.嵌入式计算一次并缓存.这可扩展到数百万文档.

排名使用跨编码器:查询和候选文件被合并成一个输出相关性分数的模型.该模型同时看到两个文本,并可以捕获它们之间的细微互动.跨编码器可以理解"Q3的收益是什么?"对于包含"Q3中的47.2M美元"的部分非常相关,即使双编码器错过了连接.

交换:交叉编码器比双编码器100-1000倍慢,因为它们共同处理查询文档对.你不能预先计算100万份文档的交叉编码分数.解决方案:获取更大的候选人集 (来自混合搜索的Top-50),然后再使用交叉编码器排名以获得最终的Top-5.

```mermaid
graph LR
    Q["Query"] --> H["Hybrid Search"]
    H --> C50["Top 50 candidates"]
    C50 --> RR["Cross-Encoder Reranker"]
    RR --> C5["Top 5 final results"]
    C5 --> P["Build prompt"]
    P --> LLM["Generate answer"]
```

常见的重新排名模型 (2026年排行):
- 协同排名3.5:管理 API,多语言,混合体中最佳回忆收益
- 旅行重新排名-2.5:管理 API,最低的延迟
- 简单的语言:开放式,100多种语言
- bge-renanker-v2-m3:开放权重,强基线
- 跨码码器/ms-marco-MiniLM-L-6-v2:开放权重,运行于CPU用于原型设计
- 后期交互多向量重排器  $O(\text{tokens})$没有$O(\text{docs})$在得分时间

### 查询转换

有时问题不是检索,而是查询本身. "新政策变化是什么?"是一个可怕的搜索查询.它没有具体的术语.嵌入模糊.没有检索系统可以从中找到正确的文件.

**Query rewriting**通过将用户的查询转换为更好的搜索查询.

```
User: "What was that thing about the new policy change?"
Rewritten: "Recent policy changes and updates"
```

**HyDE (Hypothetical Document Embeddings)**代替查询,生成一个假设答案,嵌入,并搜索类似的真实文档.

```
Query: "What is the refund policy for enterprise?"
Hypothetical answer: "Enterprise customers are eligible for a full refund
within 60 days of purchase. Refunds are pro-rated based on the remaining
subscription period and processed within 5-7 business days."
```

嵌入假设答案,并寻找类似于它的真实文档.直觉:假设答案在嵌入空间中比原始问题更接近真实答案.问题和答案具有不同的语言结构.通过生成假设答案,你将在嵌入中的"问题空间"和"答案空间"之间的差距弥合.

代在检索之前添加一个LLM调用. 这增加了500-2000ms的延迟.

### 亲子的分手

标准的碎片化需要进行折扣:小块用于精确的检索,大块用于足够的文本化.

索引小块 (128个代币) 获取.当一个小块被获取时,返回其母块 (512个代币) 为提示.小块与查询精确匹配.母块为LLM产生一个好的答案提供了足够的背景.

```mermaid
graph TD
    P["Parent chunk (512 tokens)<br/>Full section about refund policy"]
    C1["Child chunk (128 tokens)<br/>Standard plan: 30-day refund"]
    C2["Child chunk (128 tokens)<br/>Enterprise: 60-day pro-rated"]
    C3["Child chunk (128 tokens)<br/>Processing time: 5-7 days"]
    C4["Child chunk (128 tokens)<br/>How to submit a request"]

    P --> C1
    P --> C2
    P --> C3
    P --> C4

    Q["Query: enterprise refund?"] -.->|"matches child"| C2
    C2 -.->|"return parent"| P
```

查询"企业退款?"与小部分C2精确相匹配. 但提示收到完整的父母部分P,其中包括处理时间和提交过程的周围环境.

### 分析数据

在执行向量搜索之前,按日期,来源,类别,作者,语言过数据. 这减少了搜索空间,防止无关的结果.

没有过度过的元数据,你会搜索整个库,并可能找到一个两年历史的安全文件,

产品RAG系统将元数据存储在每个部分旁边:源文件,创建日期,类别,作者,版本.向量数据库支持在搜索相似性之前预先过元数据,这对于规模性能至关重要.

### 评估

你建立了RAG系统.你怎么知道它是否有效?

**Retrieval relevance (Recall@k)**对于已知相关文件的测试问题,在前k结果中显示的相关文件的百分比是多少?

**Faithfulness**如果检索的部分写"60天退款窗口"和模型说"90天退款窗口",那就是忠诚度失败.模型虽然有正确的文本,但却产生了幻觉.

**Answer correctness**产生的答案是否符合预期答案?这是端到端的指标. 它结合检索质量和生成质量.

简单的忠实性检查:在生成的答案中,检查每一个索赔,并验证它在检索的部分中出现 (实质上).如果答案中包含一个没有检索的部分的事实,那么它可能是幻觉的.

```mermaid
graph TD
    subgraph "Evaluation Framework"
        Q["Test questions<br/>+ expected answers<br/>+ relevant doc IDs"]
        Q --> Ret["Retrieval evaluation<br/>Recall@k: are right<br/>docs retrieved?"]
        Q --> Faith["Faithfulness evaluation<br/>Is answer grounded<br/>in retrieved docs?"]
        Q --> Correct["Correctness evaluation<br/>Does answer match<br/>expected answer?"]
    end
```

```figure
agentic-rag-loop
```

## 建立它

### 步骤1:BM25的实施

```python
import math
from collections import Counter

class BM25:
    def __init__(self, k1=1.2, b=0.75):
        self.k1 = k1
        self.b = b
        self.docs = []
        self.doc_lengths = []
        self.avg_dl = 0
        self.doc_freqs = {}
        self.n_docs = 0

    def index(self, documents):
        self.docs = documents
        self.n_docs = len(documents)
        self.doc_lengths = []
        self.doc_freqs = {}

        for doc in documents:
            words = doc.lower().split()
            self.doc_lengths.append(len(words))
            unique_words = set(words)
            for word in unique_words:
                self.doc_freqs[word] = self.doc_freqs.get(word, 0) + 1

        self.avg_dl = sum(self.doc_lengths) / self.n_docs if self.n_docs else 1

    def score(self, query, doc_idx):
        query_words = query.lower().split()
        doc_words = self.docs[doc_idx].lower().split()
        doc_len = self.doc_lengths[doc_idx]
        word_counts = Counter(doc_words)
        score = 0.0

        for term in query_words:
            if term not in word_counts:
                continue
            tf = word_counts[term]
            df = self.doc_freqs.get(term, 0)
            idf = math.log((self.n_docs - df + 0.5) / (df + 0.5) + 1)
            numerator = tf * (self.k1 + 1)
            denominator = tf + self.k1 * (1 - self.b + self.b * doc_len / self.avg_dl)
            score += idf * numerator / denominator

        return score

    def search(self, query, top_k=10):
        scores = [(i, self.score(query, i)) for i in range(self.n_docs)]
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]
```

### 步骤2:相互级别的融合

```python
def reciprocal_rank_fusion(ranked_lists, k=60):
    scores = {}
    for ranked_list in ranked_lists:
        for rank, (doc_id, _) in enumerate(ranked_list):
            if doc_id not in scores:
                scores[doc_id] = 0.0
            scores[doc_id] += 1.0 / (k + rank + 1)
    fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return fused
```

### 步骤3:混合搜索管道

```python
def hybrid_search(query, chunks, vector_embeddings, vocab, idf, bm25_index, top_k=5, fusion_k=60):
    query_emb = tfidf_embed(query, vocab, idf)
    vector_results = search(query_emb, vector_embeddings, top_k=top_k * 3)
    bm25_results = bm25_index.search(query, top_k=top_k * 3)
    fused = reciprocal_rank_fusion([vector_results, bm25_results], k=fusion_k)
    return fused[:top_k]
```

### 步骤4:简单的重排

在制作中,你会使用一个跨编码模型.在这里我们构建一个重排器,

```python
def rerank(query, candidates, chunks):
    query_words = set(query.lower().split())
    stop_words = {"the", "a", "an", "is", "are", "was", "were", "what", "how",
                  "why", "when", "where", "do", "does", "for", "of", "in", "to",
                  "and", "or", "on", "at", "by", "it", "its", "this", "that",
                  "with", "from", "be", "has", "have", "had", "not", "but"}
    query_terms = query_words - stop_words

    scored = []
    for doc_id, initial_score in candidates:
        chunk = chunks[doc_id].lower()
        chunk_words = set(chunk.split())

        term_overlap = len(query_terms & chunk_words)

        query_bigrams = set()
        q_list = [w for w in query.lower().split() if w not in stop_words]
        for i in range(len(q_list) - 1):
            query_bigrams.add(q_list[i] + " " + q_list[i + 1])
        bigram_matches = sum(1 for bg in query_bigrams if bg in chunk)

        position_boost = 0
        for term in query_terms:
            pos = chunk.find(term)
            if pos != -1 and pos < len(chunk) // 3:
                position_boost += 0.5

        rerank_score = (
            term_overlap * 1.0
            + bigram_matches * 2.0
            + position_boost
            + initial_score * 5.0
        )
        scored.append((doc_id, rerank_score))

    scored.sort(key=lambda x: x[1], reverse=True)
    return scored
```

### 步骤5:HyDE (假设文件嵌入)

```python
def hyde_generate_hypothesis(query):
    templates = {
        "what": "The answer to '{query}' is as follows: Based on our documentation, {topic} involves specific policies and procedures that define how the process works.",
        "how": "To address '{query}': The process involves several steps. First, you need to initiate the request. Then, the system processes it according to the defined rules.",
        "default": "Regarding '{query}': Our records indicate specific details and policies related to this topic that provide a comprehensive answer."
    }
    query_lower = query.lower()
    if query_lower.startswith("what"):
        template = templates["what"]
    elif query_lower.startswith("how"):
        template = templates["how"]
    else:
        template = templates["default"]

    topic_words = [w for w in query.lower().split()
                   if w not in {"what", "is", "the", "how", "do", "does", "a", "an",
                                "for", "of", "to", "in", "on", "at", "by", "and", "or"}]
    topic = " ".join(topic_words) if topic_words else "this topic"

    return template.format(query=query, topic=topic)


def hyde_search(query, chunks, vector_embeddings, vocab, idf, top_k=5):
    hypothesis = hyde_generate_hypothesis(query)
    hypothesis_emb = tfidf_embed(hypothesis, vocab, idf)
    results = search(hypothesis_emb, vector_embeddings, top_k)
    return results, hypothesis
```

### 第六步:父母与孩子的分化

```python
def create_parent_child_chunks(text, parent_size=200, child_size=50):
    words = text.split()
    parents = []
    children = []
    child_to_parent = {}

    parent_idx = 0
    start = 0
    while start < len(words):
        parent_end = min(start + parent_size, len(words))
        parent_text = " ".join(words[start:parent_end])
        parents.append(parent_text)

        child_start = start
        while child_start < parent_end:
            child_end = min(child_start + child_size, parent_end)
            child_text = " ".join(words[child_start:child_end])
            child_idx = len(children)
            children.append(child_text)
            child_to_parent[child_idx] = parent_idx
            child_start += child_size

        parent_idx += 1
        start += parent_size

    return parents, children, child_to_parent
```

### 第七步: 评估忠诚

```python
def evaluate_faithfulness(answer, retrieved_chunks):
    answer_sentences = [s.strip() for s in answer.split(".") if len(s.strip()) > 10]
    if not answer_sentences:
        return 1.0, []

    grounded = 0
    ungrounded = []
    context = " ".join(retrieved_chunks).lower()

    for sentence in answer_sentences:
        words = set(sentence.lower().split())
        stop_words = {"the", "a", "an", "is", "are", "was", "were", "and", "or",
                      "to", "of", "in", "for", "on", "at", "by", "it", "this", "that"}
        content_words = words - stop_words
        if not content_words:
            grounded += 1
            continue

        matched = sum(1 for w in content_words if w in context)
        ratio = matched / len(content_words) if content_words else 0

        if ratio >= 0.5:
            grounded += 1
        else:
            ungrounded.append(sentence)

    score = grounded / len(answer_sentences) if answer_sentences else 1.0
    return score, ungrounded


def evaluate_retrieval_recall(queries_with_relevant, retrieval_fn, k=5):
    total_recall = 0.0
    results = []

    for query, relevant_indices in queries_with_relevant:
        retrieved = retrieval_fn(query, k)
        retrieved_indices = set(idx for idx, _ in retrieved)
        relevant_set = set(relevant_indices)
        hits = len(retrieved_indices & relevant_set)
        recall = hits / len(relevant_set) if relevant_set else 1.0
        total_recall += recall
        results.append({
            "query": query,
            "recall": recall,
            "hits": hits,
            "total_relevant": len(relevant_set)
        })

    avg_recall = total_recall / len(queries_with_relevant) if queries_with_relevant else 0
    return avg_recall, results
```

## 用它

通过一个真正的跨编码器来重新排名:

```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

def rerank_with_cross_encoder(query, candidates, chunks, top_k=5):
    pairs = [(query, chunks[doc_id]) for doc_id, _ in candidates]
    scores = reranker.predict(pairs)
    scored = list(zip([doc_id for doc_id, _ in candidates], scores))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_k]
```

科赫的管理者:

```python
import cohere

co = cohere.Client()

def rerank_with_cohere(query, candidates, chunks, top_k=5):
    docs = [chunks[doc_id] for doc_id, _ in candidates]
    response = co.rerank(
        model="rerank-english-v3.0",
        query=query,
        documents=docs,
        top_n=top_k
    )
    return [(candidates[r.index][0], r.relevance_score) for r in response.results]
```

对于HyDE,具有真正的法学士学位:

```python
import anthropic

client = anthropic.Anthropic()

def hyde_with_llm(query):
    response = client.messages.create(
        model="claude-sonnet-5",
        max_tokens=256,
        messages=[{
            "role": "user",
            "content": f"Write a short paragraph that would be a good answer to this question. Do not say you don't know. Just write what the answer would look like.\n\nQuestion: {query}"
        }]
    )
    return response.content[0].text
```

对于Weaviate的生产混合搜索:

```python
import weaviate

client = weaviate.connect_to_local()

collection = client.collections.get("Documents")
response = collection.query.hybrid(
    query="enterprise refund policy",
    alpha=0.5,
    limit=10
)
```

位数控制了平衡:0.0 =纯键词 (BM25),1.0 =纯向量,0.5 =等重.大多数生产系统使用0.3至0.7之间的位数.

## 运送它

这一课产生了:
- `outputs/prompt-advanced-rag-debugger.md`-- 诊断和解决RAG质量问题的提示
- `outputs/skill-advanced-rag.md`-- 通过混合搜索和重新排名建立生产级RAG的技能

## 运动

1. 对于每一个5个测试查询,记录哪个方法返回最相关的部分位置#1. 混合搜索应该至少在5中赢得3个.

2. 执行一个元数据过器. 添加一个"类别"字段到每个文档 (安全,账单,API,产品). 在运行向量搜索之前,过块到只有相关类别. 测试使用"使用什么加密?"并验证它只搜索安全类别的块.

3. 通过从06课程中简单生成函数构建一个完整的HyDE管道.在所有5项测试查询中,比较直接查询和HyDE搜索之间的检索质量 (前三相关性).HyDE应改善模糊查询的结果.

4. 执行父母-孩子分量策略.使用 child_size=30和 parent_size=100.使用儿童分量搜索,但返回提示中父母分量.将生成的标准分量答案与 chunk_size=50进行比较.

5. 创建评估数据集: 10 个问题,已知答案分类. 测量 Recall@3, Recall@5, Recall@10 仅用于 (a) 矢量搜索, (b) 仅用于 BM25, (c) 混合搜索, (d) 混合+重新排名. 绘制结果并确定重新排名最有帮助的地方.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| BM25 | "Keyword search" | A probabilistic ranking algorithm that scores documents by term frequency, inverse document frequency, and document length normalization |
| Hybrid search | "Best of both worlds" | Running semantic (vector) and keyword (BM25) search in parallel, then merging results with rank fusion |
| Reciprocal Rank Fusion | "Merge ranked lists" | Combining multiple ranked lists by summing 1/(k + rank) for each document across all lists |
| Reranking | "Second pass scoring" | Using a more expensive cross-encoder model to re-score a candidate set from initial retrieval |
| Cross-encoder | "Joint query-document model" | A model that takes a query and document as a single input, producing a relevance score; more accurate than bi-encoders but too slow for full corpus search |
| Bi-encoder | "Independent embedding model" | A model that embeds queries and documents independently; fast because embeddings are precomputed, but less accurate than cross-encoders |
| HyDE | "Search with a fake answer" | Generate a hypothetical answer to the query, embed it, and search for real documents similar to it |
| Parent-child chunking | "Small search, big context" | Index small chunks for precise retrieval but return the larger parent chunk to provide sufficient context |
| Metadata filtering | "Narrow before searching" | Filtering documents by attributes (date, source, category) before running vector search to reduce the search space |
| Faithfulness | "Did it stay grounded" | Whether the generated answer is supported by the retrieved documents, as opposed to hallucinated from the model's training data |

## 进一步阅读

- 罗伯逊和萨拉戈萨,"概率相关性框架:BM25和其它" (2009) - - 概率相关性框架的最终参考,解释了公式背后的概率基础
- 科尔麦克等人",互惠级合并优于康多塞特和个人级学习方法" (2009) - 原始的RRF论文显示它超过了更复杂的合并方法
- 盖奥等人",没有相关标签的精确零射击密集检索" (2022) -- HyDE论文证明假设文件嵌入式改善了没有任何培训数据的检索
- 诺格耶拉和乔, "通过BERT重新排名" (2019) -- 显示,在BM25上方的跨编码重新排名显著提高了检索质量
- [Khattab et al., "DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines" (2023)](https://arxiv.org/abs/2310.03714)根据"快速LLM"的定义, 快速构建和重量选择是对检索管道进行优化的问题.
- [Edge et al., "From Local to Global: A Graph RAG Approach to Query-Focused Summarization" (Microsoft Research 2024)](https://arxiv.org/abs/2404.16130)-- 图形RAG论文:实体关系提取+莱登社区检测,以查询为重点的总结;全球与本地检索区别.
- [Asai et al., "Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection" (ICLR 2024)](https://arxiv.org/abs/2310.11511)通过反射代币进行自我评估, 通过静态检索生成的代理边界.
- [LangChain Query Construction blog](https://blog.langchain.dev/query-construction/)如何将自然语言查询转化为结构化数据库查询 (文本到SQL,加密)
