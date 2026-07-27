# RAG（检索增强生成）

> 你的大语言模型知道截止到训练数据截止日期前的一切。但它对你的公司文档、代码库或上周的会议纪要一无所知。RAG 通过检索相关文档并将其填充到提示中来解决这个问题。它是生产环境 AI 中部署最广泛的模式。如果这门课程你只学一样东西，那就构建一个 RAG 流水线。

**类型：** 构建
**语言：** Python
**前置条件：** 阶段 10（从零构建 LLM），阶段 11 课程 01-05
**时长：** 约 90 分钟
**相关：** 阶段 5·23（RAG 的分块策略）涵盖六种分块算法及其适用场景。阶段 5·22（嵌入模型深度解析）帮助选择嵌入器。阶段 11·07（高级 RAG）涵盖混合搜索、重排序和查询转换。

## 学习目标

- 构建完整的 RAG 流水线：文档加载、分块、嵌入、向量存储、检索和生成
- 使用向量数据库（ChromaDB、FAISS 或 Pinecone）并通过适当的索引实现语义搜索
- 解释为什么在知识驱动的应用中 RAG 优于微调（成本、时效性、可归因性）
- 使用检索指标（精确率、召回率）和生成指标（忠实度、相关性）评估 RAG 质量

## 问题

你为公司构建了一个聊天机器人。客户问"企业版计划的退款政策是什么？"LLM 用一个关于典型 SaaS 退款政策的通用回答来回应。实际的退款政策——埋藏在一份 200 页的内部 Wiki 中——规定企业客户有 60 天的退款窗口期并享受按比例退款。LLM 从未见过这份文档。它不可能知道它没有被训练过的内容。

微调是一种解决方案。获取 LLM，在你的内部文档上训练它，然后部署更新后的模型。这种方式有效，但存在严重问题。微调需要耗费数千美元的计算成本。文档一旦发生变更，模型就会过时。你无法知道模型从哪个来源获取了信息。而且如果公司下个月收购了另一个产品线，你又得重新微调。

RAG 是另一种解决方案。保持模型不变。当问题到来时，搜索你的文档库找到相关段落，将它们粘贴到提示中的问题之前，让模型使用这些段落作为上下文来回答。文档库可以在几分钟内更新。你可以确切地看到哪些文档被检索到了。模型本身从不改变。这就是为什么 RAG 是生产环境中的主导模式：它更便宜、更新鲜、更可审计，并且适用于任何 LLM。

## 概念

### RAG 模式

整个模式分为四个步骤：

```mermaid
graph LR
    Q["用户查询"] --> R["检索"]
    R --> A["增强提示"]
    A --> G["生成"]
    G --> Ans["回答"]

    subgraph "检索"
        R --> Embed["嵌入查询"]
        Embed --> Search["搜索向量存储"]
        Search --> TopK["返回 top-k 个块"]
    end

    subgraph "增强"
        TopK --> Format["将块格式化为提示"]
        Format --> Combine["与用户问题合并"]
    end

    subgraph "生成"
        Combine --> LLM["LLM 生成答案"]
        LLM --> Cite["答案基于检索到的文档"]
    end
```

查询 -> 检索 -> 增强提示 -> 生成。每个 RAG 系统都遵循这种模式。生产级 RAG 系统之间的差异在于每个步骤的细节：如何分块、如何嵌入、如何搜索以及如何构建提示。

### 为什么 RAG 优于微调

| 关注点 | 微调 | RAG |
|---------|------|-----|
| 成本 | 每次训练 $1,000-$100,000+ | 每次查询 $0.01-$0.10（嵌入 + LLM） |
| 时效性 | 过时直到重新训练 | 通过重新索引文档，几分钟内更新 |
| 可审计性 | 无法追溯答案来源 | 可显示精确检索到的段落 |
| 幻觉 | 仍然自由地产生幻觉 | 基于检索到的文档 |
| 数据隐私 | 训练数据嵌入到权重中 | 文档保留在你的向量存储中 |

微调会永久改变模型的权重。RAG 临时改变模型的上下文。对于大多数应用来说，临时的上下文正是你所需要的。

微调胜出的唯一场景：当你需要模型采用特定的风格、语气或推理模式，而这些无法通过提示工程实现时。对于事实性知识检索，RAG 每次都能取胜。

### 嵌入模型

嵌入模型将文本转换为稠密向量。相似的文本会在这个高维空间中产生距离相近的向量。"How do I reset my password?" 和 "I need to change my password" 尽管共享的词汇很少，但会生成几乎相同的向量。"The cat sat on the mat" 则会生成一个非常不同的向量。

常见嵌入模型（2026 年阵容——详见阶段 5·22 的完整分析）：

| 模型 | 维度 | 提供商 | 说明 |
|-------|------|--------|------|
| text-embedding-3-small | 1536（Matryoshka） | OpenAI | 大多数用例的最佳性价比 |
| text-embedding-3-large | 3072（Matryoshka） | OpenAI | 更高精度，可截断至 256/512/1024 |
| Gemini Embedding 2 | 3072（Matryoshka） | Google | MTEB 检索最高分；8K 上下文 |
| voyage-4 | 1024/2048（Matryoshka） | Voyage AI | 领域变体（代码、金融、法律） |
| Cohere embed-v4 | 1024（Matryoshka） | Cohere | 强大多语言能力，128K 上下文 |
| BGE-M3 | 1024（稠密 + 稀疏 + ColBERT） | BAAI（开源权重） | 一个模型三种视角 |
| Qwen3-Embedding | 4096（Matryoshka） | 阿里巴巴（开源权重） | 检索评分最高的开源权重模型 |
| all-MiniLM-L6-v2 | 384 | 开源权重（Sentence Transformers） | 原型开发基线 |

在本课中，我们使用 TF-IDF 构建自己的简单嵌入。不是因为生产系统使用 TF-IDF，而是因为它让概念变得具体：输入文本，输出向量，相似的文本产生相似的向量。

### 向量相似度

给定两个向量，如何衡量相似度？三种选择：

**余弦相似度**：两个向量之间夹角的余弦值。范围从 -1（相反）到 1（相同）。忽略大小，只关注方向。这是 RAG 的默认选择。

```
cosine_sim(a, b) = dot(a, b) / (||a|| * ||b||)
```

**点积**：原始内积。更大的向量获得更高的分数。当向量大小携带信息时有用（较长的文档可能更相关）。

```
dot(a, b) = sum(a_i * b_i)
```

**L2（欧几里得）距离**：向量空间中的直线距离。距离越小 = 越相似。对大小差异敏感。

```
L2(a, b) = sqrt(sum((a_i - b_i)^2))
```

余弦相似度是标准做法。它通过按大小归一化，优雅地处理了不同长度的文档。当人们说"向量搜索"时，几乎总是指余弦相似度。

### 分块策略

文档太长，不能作为单个向量嵌入。一份 50 页的 PDF 可能因为包含几十个主题而产生糟糕的嵌入。因此，你需要将文档拆分成多个块，并分别嵌入每个块。

**固定大小分块**：每 N 个 token 拆分一次。简单且可预测。512 token 的块加上 50 token 的重叠意味着块 1 是 token 0-511，块 2 是 token 462-973，依此类推。重叠确保你不会在一个不幸的边界上把一个句子拆开。

**语义分块**：在自然边界处拆分。段落、章节或 Markdown 标题。每个块是一个连贯的意义单元。实现起来更复杂，但能产生更好的检索效果。

**递归分块**：首先尝试在最大的边界处拆分（章节标题）。如果某个章节仍然太大，则在段落边界处拆分。如果某个段落仍然太大，则在句子边界处拆分。这是 LangChain 的 RecursiveCharacterTextSplitter 采用的方法，在实践中效果良好。

块大小比人们想象的要重要得多：

- 太小（64-128 token）：每个块缺乏上下文。"上季度增长了 15%" 如果不知道"它"指的是什么，就毫无意义。
- 太大（2048+ token）：每个块覆盖多个主题，稀释了相关性。当你搜索营收数据时，你会得到一个 10% 关于营收、90% 关于人员编制的块。
- 最佳区间（256-512 token）：有足够的上下文使其自包含，又足够聚焦以保持相关。

大多数生产级 RAG 系统使用 256-512 token 的块，带有 50 token 的重叠。Anthropic 的 RAG 指南推荐这个范围。

### 向量数据库

一旦你有了嵌入，就需要一个地方来存储和搜索它们。选择方案：

| 数据库 | 类型 | 最适合 |
|----------|------|----------|
| FAISS | 库（进程内） | 原型开发，中小型数据集 |
| Chroma | 轻量级数据库 | 本地开发，小规模部署 |
| Pinecone | 托管服务 | 需要生产环境且不想处理运维 |
| Weaviate | 开源数据库 | 自托管生产环境 |
| pgvector | Postgres 扩展 | 已在用 Postgres |
| Qdrant | 开源数据库 | 高性能自托管 |

在本课中，我们构建一个简单的内存向量存储。它将向量存储在一个列表中并进行暴力余弦相似度搜索。这等同于使用扁平索引的 FAISS。它在达到约 100,000 个向量之前不会变慢。生产系统使用近似最近邻（ANN）算法（如 HNSW）在毫秒内搜索数百万个向量。

### 完整流水线

```mermaid
graph TD
    subgraph "索引（离线）"
        D["文档"] --> C["分块"]
        C --> E["嵌入每个块"]
        E --> S["存储向量 + 文本"]
    end

    subgraph "查询（在线）"
        Q["用户查询"] --> QE["嵌入查询"]
        QE --> VS["向量搜索（top-k）"]
        VS --> P["用块构建提示"]
        P --> LLM["LLM 生成答案"]
    end

    S -.->|"同一向量空间"| VS
```

索引阶段在每次文档变更时运行一次（或定期运行）。查询阶段在每个用户请求时运行。在生产环境中，索引可能在数小时内处理数百万份文档。查询必须在不到一秒内响应。

### 实际参数

大多数生产级 RAG 系统使用以下参数：

- **k = 5 到 10** 个每次查询检索的块
- **块大小 = 256 到 512 token**，50 token 重叠
- **上下文预算**：每次查询 2,500-5,000 token 的检索内容
- **总提示**：约 8,000-16,000 token（系统提示 + 检索块 + 对话历史 + 用户查询）
- **嵌入维度**：384-3072，取决于模型
- **索引吞吐量**：API 嵌入每秒处理 100-1,000 份文档
- **查询延迟**：检索 50-200ms，生成 500-3000ms

```figure
rag-chunking
```

## 动手构建

### 步骤 1：文档分块

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
```

### 步骤 2：TF-IDF 嵌入

我们构建一个简单的嵌入函数。TF-IDF（词频-逆文档频率）不是神经嵌入，但它以一种捕捉词重要性的方式将文本转换为向量。文档中频繁出现的词获得更高的 TF。整个语料库中的稀有词获得更高的 IDF。两者的乘积产生一个向量，其中重要且独特的词具有高值。

```python
import math
from collections import Counter

def build_vocabulary(documents):
    vocab = set()
    for doc in documents:
        vocab.update(doc.lower().split())
    return sorted(vocab)

def compute_tf(text, vocab):
    words = text.lower().split()
    count = Counter(words)
    total = len(words)
    return [count.get(word, 0) / total for word in vocab]

def compute_idf(documents, vocab):
    n = len(documents)
    idf = []
    for word in vocab:
        doc_count = sum(1 for doc in documents if word in doc.lower().split())
        idf.append(math.log((n + 1) / (doc_count + 1)) + 1)
    return idf

def tfidf_embed(text, vocab, idf):
    tf = compute_tf(text, vocab)
    return [t * i for t, i in zip(tf, idf)]
```

### 步骤 3：余弦相似度搜索

```python
def cosine_similarity(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)

def search(query_embedding, stored_embeddings, top_k=5):
    scores = []
    for i, emb in enumerate(stored_embeddings):
        sim = cosine_similarity(query_embedding, emb)
        scores.append((i, sim))
    scores.sort(key=lambda x: x[1], reverse=True)
    return scores[:top_k]
```

### 步骤 4：提示构建

这就是 RAG 中"增强"发生的环节。将检索到的块格式化到提示中，并让 LLM 基于提供的上下文来回答。

```python
def build_rag_prompt(query, retrieved_chunks):
    context = "\n\n---\n\n".join(
        f"[来源 {i+1}]\n{chunk}"
        for i, chunk in enumerate(retrieved_chunks)
    )
    return f"""请仅基于以下上下文回答问题。
如果上下文没有包含足够的信息，请说"我没有足够的信息来回答这个问题。"

上下文：
{context}

问题：{query}

回答："""
```

### 步骤 5：完整 RAG 流水线

```python
class RAGPipeline:
    def __init__(self):
        self.chunks = []
        self.embeddings = []
        self.vocab = []
        self.idf = []

    def index(self, documents):
        all_chunks = []
        for doc in documents:
            all_chunks.extend(chunk_text(doc))
        self.chunks = all_chunks
        self.vocab = build_vocabulary(all_chunks)
        self.idf = compute_idf(all_chunks, self.vocab)
        self.embeddings = [
            tfidf_embed(chunk, self.vocab, self.idf)
            for chunk in all_chunks
        ]

    def query(self, question, top_k=5):
        query_emb = tfidf_embed(question, self.vocab, self.idf)
        results = search(query_emb, self.embeddings, top_k)
        retrieved = [(self.chunks[i], score) for i, score in results]
        prompt = build_rag_prompt(
            question, [chunk for chunk, _ in retrieved]
        )
        return prompt, retrieved
```

### 步骤 6：生成（模拟）

在生产环境中，这是你调用 LLM API 的地方。在本课中，我们通过从检索到的上下文中提取最相关的句子来模拟生成。

```python
def simple_generate(prompt, retrieved_chunks):
    query_words = set(prompt.lower().split("question:")[-1].split())
    best_sentence = ""
    best_score = 0
    for chunk in retrieved_chunks:
        for sentence in chunk.split("."):
            sentence = sentence.strip()
            if not sentence:
                continue
            words = set(sentence.lower().split())
            overlap = len(query_words & words)
            if overlap > best_score:
                best_score = overlap
                best_sentence = sentence
    return best_sentence if best_sentence else "我没有足够的信息。"
```

## 使用它

使用真正的嵌入模型和 LLM，代码几乎不变：

```python
from openai import OpenAI

client = OpenAI()

def embed(text):
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding

def generate(prompt):
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0
    )
    return response.choices[0].message.content
```

或者使用 Anthropic：

```python
import anthropic

client = anthropic.Anthropic()

def generate(prompt):
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.content[0].text
```

流水线是一样的。替换嵌入函数。替换生成函数。检索逻辑、分块、提示构建——无论你使用哪种模型，所有这些都完全相同。

对于大规模向量存储，将暴力搜索替换为合适的向量数据库：

```python
import chromadb

client = chromadb.Client()
collection = client.create_collection("my_docs")

collection.add(
    documents=chunks,
    ids=[f"chunk_{i}" for i in range(len(chunks))]
)

results = collection.query(
    query_texts=["退款政策是什么？"],
    n_results=5
)
```

Chroma 在内部处理嵌入（默认使用 all-MiniLM-L6-v2）并将向量存储在本地数据库中。相同的模式，不同的管道。

## 产出

本课程产出：
- `outputs/prompt-rag-architect.md` —— 一个用于为特定用例设计 RAG 系统的提示模板
- `outputs/skill-rag-pipeline.md` —— 一个教代理如何构建和调试 RAG 流水线的技能

## 练习

1. 将 TF-IDF 嵌入替换为简单的词袋方法（二值化：词出现为 1，不出现为 0）。在样本文档上比较检索质量。TF-IDF 应该表现更好，因为它给稀有词更高的权重。

2. 尝试不同的块大小：对同一文档集分别使用 50、100、200 和 500 个词。对每种大小，运行相同的 5 个查询，统计有多少个查询在 top-3 结果中返回了相关的块。找到检索质量达到峰值的理想区间。

3. 为每个块添加元数据（源文档名称、块位置）。修改提示模板以包含来源归属，使 LLM 能够引用其来源。

4. 实现一个简单的评估：给定 10 个问答对，将每个问题送入 RAG 流水线，并测量检索到的块中包含答案的百分比。这是 top-k 检索召回率。

5. 构建一个对话感知的 RAG 流水线：维护最近 3 轮对话的历史，并将其与检索到的块一起包含在提示中。使用诸如"那企业版呢？"这样的后续问题（在询问定价之后）进行测试。

## 关键词汇

| 术语 | 通常说法 | 实际含义 |
|------|----------|---------|
| RAG | "能读取你文档的 AI" | 检索相关文档，将其粘贴到提示中，并生成基于这些文档的答案 |
| 嵌入 | "将文本转换为数字" | 文本的稠密向量表示，其中含义相似的文本产生相似的向量 |
| 向量数据库 | "AI 搜索引擎" | 一种优化用于存储向量并通过相似度查找最近邻的数据存储 |
| 分块 | "将文档拆分成小块" | 将文档分割成较小的片段（通常为 256-512 token），以便每个片段可以独立嵌入和检索 |
| 余弦相似度 | "两个向量有多相似" | 两个向量之间夹角的余弦值；1 = 方向相同，0 = 正交，-1 = 相反 |
| Top-k 检索 | "获取最匹配的 k 个结果" | 从向量存储中返回与查询最相似的 k 个块 |
| 上下文窗口 | "LLM 能看到多少文本" | LLM 在单个请求中能处理的最大 token 数；检索到的块必须适合这个窗口 |
| 增强生成 | "使用给定上下文回答" | 使用检索到的文档作为上下文生成响应，而不是仅仅依赖训练知识 |
| TF-IDF | "词重要性评分" | 词频乘以逆文档频率；通过词在语料库中的独特程度来加权 |
| 索引 | "为搜索准备文档" | 对文档进行分块、嵌入和存储的离线过程，以便在查询时可以被搜索 |

## 延伸阅读

- Lewis 等人，"Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks"（2020）—— Facebook AI Research 提出的原始 RAG 论文，正式定义了检索-生成模式
- Anthropic 的 RAG 文档（docs.anthropic.com）—— 关于块大小、提示构建和评估的实用指南
- Pinecone 学习中心，"What is RAG?"—— 包含生产环境考量的 RAG 流水线清晰可视化说明
- Sentence-BERT：Reimers & Gurevych（2019）—— all-MiniLM 嵌入模型背后的论文，展示了如何训练双编码器进行语义相似度计算
- [Karpukhin 等人，"Dense Passage Retrieval for Open-Domain Question Answering"（EMNLP 2020）](https://arxiv.org/abs/2004.04906) —— DPR 论文，证明了稠密双编码器检索在开放域问答上超越了 BM25，并为现代 RAG 检索器确立了模式
- [LlamaIndex 高级概念](https://docs.llamaindex.ai/en/stable/getting_started/concepts.html) —— 构建 RAG 流水线时需要了解的主要概念：数据加载器、节点解析器、索引、检索器、响应合成器
- [LangChain RAG 教程](https://python.langchain.com/docs/tutorials/rag/) —— 另一种风格的编排框架；以可运行链的方式展示相同的检索-生成模式
