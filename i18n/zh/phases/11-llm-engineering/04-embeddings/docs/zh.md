# 嵌入与向量表示

> 文本是离散的，数学是连续的。每当你让 LLM 查找“相似”文档、比较语义，或进行超越关键词的搜索时，你都在依赖这两个世界之间的桥梁。这座桥梁就是嵌入（embedding）。如果你不理解嵌入，你就不理解现代 AI——你只是在使用它而已。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 11, Lesson 01（提示词工程）
**Time:** ~75 分钟
**Related:** Phase 5 · 22（嵌入模型深入解析）涵盖稠密 vs 稀疏 vs 多向量、Matryoshka 截断以及按维度选择模型。本课聚焦于生产级流水线（向量数据库、HNSW、相似度数学）。在选定模型之前，请先阅读 Phase 5 · 22。

## 学习目标

- 使用 API 提供商和开源模型生成文本嵌入，并计算它们之间的余弦相似度
- 解释为什么嵌入能解决关键词搜索无法处理的词汇不匹配问题
- 构建一个按语义而非精确关键词匹配来检索文档的语义搜索索引
- 使用检索基准（precision@k、recall）评估嵌入质量，并针对你的任务选择合适的嵌入模型

## 问题

你有 10,000 条客服工单。一位客户写道“我的付款没有成功”。你需要找到类似的过往工单。关键词搜索能找到包含“payment”和“didn't go through”的工单，但会漏掉“transaction failed”、“charge was declined”和“billing error”。这些工单描述的是完全相同的问题，却使用了完全不同的词语。

这就是词汇不匹配问题。人类语言有数十种表达同一事物的方式。关键词搜索把每个词当作没有含义的独立符号。它无法知道“declined”和“didn't go through”指的是同一个概念。

你需要一种文本表示方式，使相似性由含义而非拼写决定。你需要一种方法，把“我的付款没有成功”和“交易被拒绝了”在某个数学空间中放得很近，同时把“我的付款按时到账了”推得很远——即使它们共享“付款”这个词。

这种表示就是嵌入。

## 概念

### 什么是嵌入？

嵌入是一个表示文本含义的稠密浮点数向量。“稠密”这个词很重要——每个维度都携带信息，不同于大多数维度为零的稀疏表示（词袋、TF-IDF）。

"The cat sat on the mat" 会变成类似 `[0.023, -0.041, 0.087, ..., 0.012]` 的东西——一个包含 768 到 3072 个数字的列表，具体取决于模型。这些数字编码了含义。你从不需要直接检查它们，你只需要比较它们。

### Word2Vec 的突破

2013 年，Google 的 Tomas Mikolov 及其同事发表了 Word2Vec。其核心洞见是：训练一个神经网络从邻居词预测一个词（或从一个词预测邻居词），隐藏层的权重就会成为有意义的向量表示。

那个著名的结果：

```
king - man + woman = queen
```

词嵌入上的向量算术可以捕捉语义关系。从“man”到“woman”的方向大致与从“king”到“queen”的方向相同。这正是这个领域意识到几何可以编码含义的时刻。

Word2Vec 生成 300 维向量。无论上下文如何，每个词只有一个向量。"river bank"中的"bank"和"bank account"中的"bank"拥有相同的嵌入。这一局限推动了之后十年的研究。

### 从词到句子

词嵌入表示单个 token。生产系统需要嵌入整个句子、段落或文档。出现了四种方法：

**平均法**：取句子中所有词向量的均值。廉价、有损，但对短文本效果出奇地不错。它完全丢失了词序——“狗咬人”和“人咬狗”会得到相同的嵌入。

**CLS token**：Transformer 模型（BERT，2018）输出一个特殊的 [CLS] token 嵌入来表示整个输入。比平均法更好，但 [CLS] token 是为下一句预测训练的，而不是为相似度。

**对比学习**：明确地训练模型把相似的对拉近、把不相似的对推远。Sentence-BERT（Reimers & Gurevych，2019）采用了这一方法，并成为现代嵌入模型的基础。给定"How do I reset my password?"和"I need to change my password"，模型会学到这两个句子应该有几乎相同的向量。

**指令微调嵌入**：最新的方法。E5 和 GTE 等模型接受任务前缀（"search_query:"、"search_document:"），告诉模型要生成哪种类型的嵌入。这让一个模型可以服务多个任务。

```mermaid
graph LR
    subgraph "2013: Word2Vec"
        W1["king"] --> V1["[0.2, -0.1, ...]"]
        W2["queen"] --> V2["[0.3, -0.2, ...]"]
    end

    subgraph "2019: Sentence-BERT"
        S1["How do I reset my password?"] --> E1["[0.04, 0.12, ...]"]
        S2["I need to change my password"] --> E2["[0.05, 0.11, ...]"]
    end

    subgraph "2024: Instruction-Tuned"
        I1["search_query: password reset"] --> T1["[0.08, 0.09, ...]"]
        I2["search_document: To reset your password, click..."] --> T2["[0.07, 0.10, ...]"]
    end
```

### 现代嵌入模型

市场已经收敛到少数几个生产级选项（截至 2026 年初的 MTEB 分数，MTEB v2）：

| 模型 | 提供商 | 维度 | MTEB | 上下文 | 成本 / 1M tokens |
|-------|----------|-----------|------|---------|------------------|
| Gemini Embedding 2 | Google | 3072 (Matryoshka) | 67.7 (retrieval) | 8192 | $0.15 |
| embed-v4 | Cohere | 1024 (Matryoshka) | 65.2 | 128K | $0.12 |
| voyage-4 | Voyage AI | 1024/2048 (Matryoshka) | 66.8 | 32K | $0.12 |
| text-embedding-3-large | OpenAI | 3072 (Matryoshka) | 64.6 | 8192 | $0.13 |
| text-embedding-3-small | OpenAI | 1536 (Matryoshka) | 62.3 | 8192 | $0.02 |
| BGE-M3 | BAAI | 1024 (dense+sparse+ColBERT) | 63.0 multilingual | 8192 | 开放权重 |
| Qwen3-Embedding | Alibaba | 4096 (Matryoshka) | 66.9 | 32K | 开放权重 |
| Nomic-embed-v2 | Nomic | 768 (Matryoshka) | 63.1 | 8192 | 开放权重 |

MTEB（Massive Text Embedding Benchmark）v2 涵盖检索、分类、聚类、重排序和摘要等 100 多个任务。分数越高越好。到 2026 年，开放权重模型（Qwen3-Embedding、BGE-M3）在大多数维度上已能匹敌或超越闭源托管模型。Gemini Embedding 2 在纯检索上领先；Voyage/Cohere 在特定领域（金融、法律、代码）领先。在确定使用之前，务必在你自己的查询上做基准测试。

### 相似度度量

给定两个嵌入向量，有三种衡量它们相似程度的方法：

**余弦相似度**：两个向量夹角的余弦。范围从 -1（方向相反）到 1（方向相同）。忽略幅值——一个 10 词的句子和一个 500 词的文档，只要方向相同，得分也可以是 1.0。这是 90% 用例的默认选择。

```
cosine_sim(a, b) = dot(a, b) / (||a|| * ||b||)
```

**点积**：两个向量的原始内积。当向量已归一化（单位长度）时，与余弦相似度完全等价。计算更快。OpenAI 的嵌入是归一化的，因此点积和余弦给出相同的排序。

```
dot(a, b) = sum(a_i * b_i)
```

**欧几里得（L2）距离**：向量空间中的直线距离。越小越相似。对幅值差异敏感。当空间中的绝对位置（而不仅仅是方向）重要时使用。

```
L2(a, b) = sqrt(sum((a_i - b_i)^2))
```

何时使用哪种：

| 度量 | 适用场景 | 避免场景 |
|--------|----------|------------|
| 余弦相似度 | 比较不同长度的文本；大多数检索任务 | 幅值携带信息时 |
| 点积 | 嵌入已归一化；追求最快速度 | 向量幅值差异较大时 |
| 欧几里得距离 | 聚类；空间最近邻问题 | 比较长度差异极大的文档时 |

### 向量数据库与 HNSW

暴力相似度搜索会把查询与每个存储的向量进行比较。对于 100 万个 1536 维的向量，每次查询需要 15 亿次乘加运算。太慢了。

向量数据库使用近似最近邻（ANN）算法解决这个问题。主流算法是 HNSW（Hierarchical Navigable Small World）：

1. 构建向量的多层图
2. 顶层稀疏—— distant 簇之间的长程连接
3. 底层稠密——邻近向量之间的细粒度连接
4. 搜索从顶层开始，贪心式逐层向下细化
5. 以 O(log n) 时间而非 O(n) 返回近似的 top-k 结果

HNSW 用少量精度损失（通常 95-99% 的召回率）换取巨大的速度提升。在 1000 万向量的规模下，暴力搜索需要数秒，HNSW 只需数毫秒。

```mermaid
graph TD
    subgraph "HNSW Layers"
        L2["Layer 2 (sparse)"] -->|"long jumps"| L1["Layer 1 (medium)"]
        L1 -->|"shorter jumps"| L0["Layer 0 (dense, all vectors)"]
    end

    Q["Query vector"] -->|"enter at top"| L2
    L0 -->|"nearest neighbors"| R["Top-k results"]
```

生产级选项：

| 数据库 | 类型 | 最适合 | 最大规模 |
|----------|------|----------|-----------|
| Pinecone | 托管 SaaS | 零运维生产环境 | 数十亿 |
| Weaviate | 开源 | 自托管、混合搜索 | 1 亿+ |
| Qdrant | 开源 | 高性能、过滤 | 1 亿+ |
| ChromaDB | 嵌入式 | 原型开发、本地开发 | 100 万 |
| pgvector | Postgres 扩展 | 已在使用 Postgres | 1000 万 |
| FAISS | 库 | 进程内、研究 | 10 亿+ |

### 分块策略

文档太长，无法作为单个向量嵌入。一份 50 页的 PDF 涵盖数十个主题——它的嵌入会变成所有内容的平均值，与任何具体内容都不相似。你需要把文档切分为块（chunk），并分别嵌入每一块。

**固定大小分块**：每 N 个 token 切一次，重叠 M 个 token。简单且可预测。适用于没有清晰结构的文档。例如 512-token 的块、50-token 的重叠：块 1 是 token 0-511，块 2 是 token 462-973。

**基于句子的分块**：在句子边界切分，将句子累积分组直到达到 token 上限。每个块至少包含一个完整句子。比固定大小更好，因为你不会把一个完整的意思切成两半。

**递归分块**：先尝试在最大的边界切分（章节标题）。如果仍然太大，再尝试段落边界，然后是句子边界，最后是字符限制。这就是 LangChain 的 `RecursiveCharacterTextSplitter`，对混合格式的语料效果很好。

**语义分块**：嵌入每个句子，然后把嵌入相似的连续句子分为一组。当嵌入相似度低于某个阈值时，开始新块。开销大（需要单独嵌入每个句子），但能产生最连贯的块。

| 策略 | 复杂度 | 质量 | 最适合 |
|----------|-----------|---------|----------|
| 固定大小 | 低 | 尚可 | 非结构化文本、日志 |
| 基于句子 | 低 | 良好 | 文章、邮件 |
| 递归 | 中 | 良好 | Markdown、HTML、混合文档 |
| 语义 | 高 | 最佳 | 关键检索质量 |

对大多数系统而言，最佳平衡点是：256-512 token 的块，50 token 的重叠。

### Bi-Encoder 与 Cross-Encoder

Bi-encoder 分别独立地嵌入查询和文档，然后比较向量。速度快——你只需嵌入查询一次，然后与预先计算好的文档嵌入进行比较。这就是检索所用的方法。

Cross-encoder 把查询和文档作为单个输入，输出一个相关性分数。速度慢——它要通过完整模型处理每个查询-文档对。但准确得多，因为它可以同时在查询和文档的 token 之间进行注意力计算。

生产模式：bi-encoder 检索 top-100 候选，cross-encoder 将其重排序为 top-10。这就是“先检索后重排序”流水线。

```mermaid
graph LR
    Q["Query"] --> BE["Bi-Encoder: embed query"]
    BE --> VS["Vector search: top 100"]
    VS --> CE["Cross-Encoder: rerank"]
    CE --> R["Top 10 results"]
```

重排序模型：Cohere Rerank 3.5（每 1000 次查询 $2）、BGE-reranker-v2（免费、开源）、Jina Reranker v2（免费、开源）。

### Matryoshka 嵌入

传统嵌入是“全有或全无”的。一个 1536 维的向量使用 1536 个浮点数。你无法截断到 256 维，除非重新训练。

Matryoshka Representation Learning（Kusupati 等，2022）解决了这个问题。模型在训练时使前 N 个维度捕捉最重要的信息，就像俄罗斯套娃一样。把 1536 维的 Matryoshka 嵌入截断到 256 维会损失一些精度，但仍然可用。

OpenAI 的 text-embedding-3-small 和 text-embedding-3-large 通过 `dimensions` 参数支持 Matryoshka 截断。请求 256 维而非 1536 维可将存储减少 6 倍，在 MTEB 基准上大约损失 3-5% 的精度。

### 二值量化

一个以 float32 存储的 1536 维嵌入占用 6,144 字节。乘以 1000 万个文档：仅向量就需要 61 GB。

二值量化把每个浮点数转成单个比特：正值变为 1，负值变为 0。存储从 6,144 字节降到 192 字节——32 倍的缩减。相似度用汉明距离（统计不同的比特数）计算，CPU 可以用单条指令完成。

精度损失在检索召回率上大约是 5-10%。常见的模式是：用二值量化对数百万向量进行第一轮搜索，然后用全精度向量对 top-1000 重新打分。这样可以用少 32 倍的内存获得全精度 95% 以上的精度。

```figure
cosine-similarity
```

## 动手构建

我们从零构建一个语义搜索引擎。不用向量数据库，不用外部嵌入 API，只用纯 Python 和 numpy 做数学运算。

### 步骤 1：文本分块

```python
def chunk_text(text, chunk_size=200, overlap=50):
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        start += chunk_size - overlap
    return chunks


def chunk_by_sentences(text, max_chunk_tokens=200):
    sentences = text.replace("\n", " ").split(".")
    sentences = [s.strip() + "." for s in sentences if s.strip()]
    chunks = []
    current_chunk = []
    current_length = 0
    for sentence in sentences:
        sentence_length = len(sentence.split())
        if current_length + sentence_length > max_chunk_tokens and current_chunk:
            chunks.append(" ".join(current_chunk))
            current_chunk = []
            current_length = 0
        current_chunk.append(sentence)
        current_length += sentence_length
    if current_chunk:
        chunks.append(" ".join(current_chunk))
    return chunks
```

### 步骤 2：从零构建嵌入

我们使用带 L2 归一化的 TF-IDF 实现一个简单的稠密嵌入。这不是神经嵌入，但它遵循同样的契约：文本输入，输出固定大小的向量，相似的文本产生相似的向量。

```python
import math
import numpy as np
from collections import Counter

class SimpleEmbedder:
    def __init__(self):
        self.vocab = []
        self.idf = []
        self.word_to_idx = {}

    def fit(self, documents):
        vocab_set = set()
        for doc in documents:
            vocab_set.update(doc.lower().split())
        self.vocab = sorted(vocab_set)
        self.word_to_idx = {w: i for i, w in enumerate(self.vocab)}
        n = len(documents)
        self.idf = np.zeros(len(self.vocab))
        for i, word in enumerate(self.vocab):
            doc_count = sum(1 for doc in documents if word in doc.lower().split())
            self.idf[i] = math.log((n + 1) / (doc_count + 1)) + 1

    def embed(self, text):
        words = text.lower().split()
        count = Counter(words)
        total = len(words) if words else 1
        vec = np.zeros(len(self.vocab))
        for word, freq in count.items():
            if word in self.word_to_idx:
                tf = freq / total
                vec[self.word_to_idx[word]] = tf * self.idf[self.word_to_idx[word]]
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec
```

### 步骤 3：相似度函数

```python
def cosine_similarity(a, b):
    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot / (norm_a * norm_b))


def dot_product(a, b):
    return float(np.dot(a, b))


def euclidean_distance(a, b):
    return float(np.linalg.norm(a - b))
```

### 步骤 4：带暴力搜索的向量索引

```python
class VectorIndex:
    def __init__(self):
        self.vectors = []
        self.texts = []
        self.metadata = []

    def add(self, vector, text, meta=None):
        self.vectors.append(vector)
        self.texts.append(text)
        self.metadata.append(meta or {})

    def search(self, query_vector, top_k=5, metric="cosine"):
        scores = []
        for i, vec in enumerate(self.vectors):
            if metric == "cosine":
                score = cosine_similarity(query_vector, vec)
            elif metric == "dot":
                score = dot_product(query_vector, vec)
            elif metric == "euclidean":
                score = -euclidean_distance(query_vector, vec)
            else:
                raise ValueError(f"Unknown metric: {metric}")
            scores.append((i, score))
        scores.sort(key=lambda x: x[1], reverse=True)
        results = []
        for idx, score in scores[:top_k]:
            results.append({
                "text": self.texts[idx],
                "score": score,
                "metadata": self.metadata[idx],
                "index": idx
            })
        return results

    def size(self):
        return len(self.vectors)
```

### 步骤 5：语义搜索引擎

```python
class SemanticSearchEngine:
    def __init__(self, chunk_size=200, overlap=50):
        self.embedder = SimpleEmbedder()
        self.index = VectorIndex()
        self.chunk_size = chunk_size
        self.overlap = overlap

    def index_documents(self, documents, source_names=None):
        all_chunks = []
        all_sources = []
        for i, doc in enumerate(documents):
            chunks = chunk_text(doc, self.chunk_size, self.overlap)
            all_chunks.extend(chunks)
            name = source_names[i] if source_names else f"doc_{i}"
            all_sources.extend([name] * len(chunks))
        self.embedder.fit(all_chunks)
        for chunk, source in zip(all_chunks, all_sources):
            vec = self.embedder.embed(chunk)
            self.index.add(vec, chunk, {"source": source})
        return len(all_chunks)

    def search(self, query, top_k=5, metric="cosine"):
        query_vec = self.embedder.embed(query)
        return self.index.search(query_vec, top_k, metric)

    def search_with_scores(self, query, top_k=5):
        results = self.search(query, top_k)
        return [
            {
                "text": r["text"][:200],
                "source": r["metadata"].get("source", "unknown"),
                "score": round(r["score"], 4)
            }
            for r in results
        ]
```

### 步骤 6：比较相似度度量

```python
def compare_metrics(engine, query, top_k=3):
    results = {}
    for metric in ["cosine", "dot", "euclidean"]:
        hits = engine.search(query, top_k=top_k, metric=metric)
        results[metric] = [
            {"score": round(h["score"], 4), "preview": h["text"][:80]}
            for h in hits
        ]
    return results
```

## 使用它

使用生产级嵌入 API 时，架构保持不变，只更换嵌入器（embedder）：

```python
from openai import OpenAI

client = OpenAI()

def openai_embed(texts, model="text-embedding-3-small", dimensions=None):
    kwargs = {"model": model, "input": texts}
    if dimensions:
        kwargs["dimensions"] = dimensions
    response = client.embeddings.create(**kwargs)
    return [item.embedding for item in response.data]
```

配合 OpenAI 的 Matryoshka 截断——同一模型，更少维度，更低存储：

```python
full = openai_embed(["semantic search query"], dimensions=1536)
compact = openai_embed(["semantic search query"], dimensions=256)
```

256 维向量的存储减少 6 倍。对 1000 万个文档来说，就是 10 GB 对 61 GB。在标准基准上精度损失大约 3-5%。

配合 Cohere 进行重排序：

```python
import cohere

co = cohere.ClientV2()

results = co.rerank(
    model="rerank-v3.5",
    query="What is the refund policy?",
    documents=["Full refund within 30 days...", "No refunds after 90 days..."],
    top_n=3
)
```

使用无 API 依赖的本地嵌入：

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("BAAI/bge-small-en-v1.5")
embeddings = model.encode(["semantic search query", "another document"])
```

我们构建的 VectorIndex 类可以配合以上任何一种方式使用。只需替换嵌入函数，保留搜索逻辑。

## 上线部署

本课产出：
- `outputs/prompt-embedding-advisor.md` —— 一个针对特定用例选择嵌入模型与策略的提示词
- `outputs/skill-embedding-patterns.md` —— 一个教 Agent 如何在生产环境中有效使用嵌入的技能

## 练习

1. **度量比较**：使用余弦相似度、点积和欧几里得距离对示例文档运行相同的 5 个查询。记录每种度量的 top-3 结果。哪些查询上这些度量结果不一致？为什么？

2. **块大小实验**：分别用 50、100、200 和 500 词的块大小对示例文档建立索引。对每种设置运行 5 个查询并记录 top-1 相似度分数。绘制块大小与检索质量之间的关系图。找出更大的块开始损害质量的位置。

3. **Matryoshka 模拟**：构建一个生成 500 维向量的 SimpleEmbedder。分别截断到 50、100、200 和 500 维。测量每次截断后检索召回率的下降情况。这可以在不使用真正训练技巧的情况下模拟 Matryoshka 的行为。

4. **二值量化**：取搜索引擎生成的嵌入，将它们转换为二值（正数为 1，负数为 0），并实现汉明距离搜索。将 top-10 结果与全精度余弦相似度进行比较。测量结果的重叠百分比。

5. **基于句子的分块**：将固定大小分块替换为 `chunk_by_sentences`。运行相同的查询并比较检索分数。尊重句子边界能否改善结果？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| 嵌入 | “文本变数字” | 一个稠密向量，几何上的接近程度编码语义相似性 |
| Word2Vec | “最早的嵌入” | 2013 年的模型，通过预测上下文词学习词向量；证明了向量算术可以编码含义 |
| 余弦相似度 | “两个向量有多相似” | 向量夹角的余弦；1 = 方向相同，0 = 正交，-1 = 方向相反 |
| HNSW | “快速向量搜索” | 分层可导航小世界图——多层结构，支持 O(log n) 的近似最近邻搜索 |
| Bi-encoder | “分别嵌入，快速比较” | 将查询和文档独立编码为向量；支持预计算和快速检索 |
| Cross-encoder | “慢但准确的重排序器” | 将查询-文档对联合输入完整模型处理；精度更高，无法预计算 |
| Matryoshka 嵌入 | “可截断的向量” | 训练时使前 N 维捕捉最重要信息的嵌入，支持可变大小的存储 |
| 二值量化 | “1 比特嵌入” | 将浮点向量转换为二值（仅符号位），实现 32 倍存储缩减，配合汉明距离搜索 |
| 分块 | “切分文档以便嵌入” | 将文档切分为 256-512 token 的片段，使每段可以独立嵌入和检索 |
| 向量数据库 | “嵌入的搜索引擎” | 针对存储向量和大规模近似最近邻搜索优化的数据存储 |
| 对比学习 | “通过比较来训练” | 一种训练方法，将相似对的嵌入拉近，将不相似对的嵌入推远 |
| MTEB | “嵌入基准” | Massive Text Embedding Benchmark——8 个任务类别共 56 个数据集；比较嵌入模型的标准 |

## 延伸阅读

- Mikolov 等，"Efficient Estimation of Word Representations in Vector Space"（2013）——开启嵌入革命的 Word2Vec 论文，包含 king-queen 类比
- Reimers & Gurevych，"Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks"（2019）——如何训练 bi-encoder 进行句子级相似度计算，是现代嵌入模型的基础
- Kusupati 等，"Matryoshka Representation Learning"（2022）——可变维度嵌入背后的技术，OpenAI 已在 text-embedding-3 中采用
- Malkov & Yashunin，"Efficient and Robust Approximate Nearest Neighbor using Hierarchical Navigable Small World Graphs"（2018）——HNSW 论文，大多数生产级向量搜索背后的算法
- OpenAI Embeddings 指南（platform.openai.com/docs/guides/embeddings）——text-embedding-3 模型的实用参考，包括 Matryoshka 维度缩减
- MTEB 排行榜（huggingface.co/spaces/mteb/leaderboard）——跨任务和跨语言比较所有嵌入模型的实时基准
- [Muennighoff 等，"MTEB: Massive Text Embedding Benchmark"（EACL 2023）](https://arxiv.org/abs/2210.07316) ——定义了排行榜所报告的 8 个任务类别（分类、聚类、成对分类、重排序、检索、STS、摘要、bitext mining）的基准论文；在信任任何单一 MTEB 分数之前先读它。
- [Sentence Transformers 文档](https://www.sbert.net/) —— bi-encoder 与 cross-encoder、池化策略，以及本课实现的 ingest-split-embed-store RAG 流水线的权威参考。