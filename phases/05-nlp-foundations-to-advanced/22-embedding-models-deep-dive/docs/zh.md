# 嵌入模型 — 2026 深度解析 (Embedding Models — The 2026 Deep Dive)

> Word2Vec 给你每个词一个向量。现代嵌入模型给你每个段落一个向量，跨语言，支持稀疏、稠密和多向量视图，适配你的索引。选错了，你的 RAG 就会检索到错误的内容。

**类型:** 学习 (Learn)
**语言:** Python
**前置知识:** 阶段 5 · 03 (Word2Vec), 阶段 5 · 14 (信息检索)
**时间:** ~60 分钟

## 问题 (The Problem)

你的 RAG 系统有 40% 的概率检索到错误的段落。罪魁祸首极少是向量数据库或提示词，而是嵌入模型。

2026 年选择嵌入模型意味着在以下五个维度上做出抉择：

1. **稠密 vs 稀疏 vs 多向量 (Dense vs sparse vs multi-vector).** 每个段落一个向量，或每个词元一个向量，或一个稀疏加权词袋。
2. **语言覆盖 (Language coverage).** 单语言英语模型在纯英语任务上仍然占优。当语料混合多种语言时，多语言模型胜出。
3. **上下文长度 (Context length).** 512 词元 vs 8,192 词元 vs 32,768 词元——实际有效容量通常只有标称最大值的 60-70%。
4. **维度预算 (Dimension budget.)** 3,072 个浮点数，全精度 = 每个向量 12 KB。对于 1 亿个向量，存储费用为每月 $1,300。Matryoshka 截断可将其缩减 4 倍。
5. **开源 vs 托管 (Open vs hosted).** 开源权重意味着你掌控整个栈和数据。托管意味着你用控制权换取始终最新的模型。

本课将阐明这些权衡，让你基于证据做出选择，而不是追随上一季度的流行趋势。

## 概念 (The Concept)

![稠密、稀疏和多向量嵌入示意](../assets/embedding-modes.svg)

**稠密嵌入 (Dense embeddings).** 每个段落一个向量（通常 384-3,072 维）。余弦相似度按语义接近程度对段落进行排序。OpenAI `text-embedding-3-large`、BGE-M3 稠密模式、Voyage-3。默认选择。

**稀疏嵌入 (Sparse embeddings).** SPLADE 风格。Transformer 为每个词表中的词元预测一个权重，然后将大部分权重归零。结果是大小为 |vocab| 的稀疏向量。捕获词法匹配（类似 BM25），但使用学习得到的词元权重。在关键词密集的查询上表现强劲。

**多向量（后期交互）(Multi-vector (late interaction)).** ColBERTv2、Jina-ColBERT。每个词元一个向量。使用 MaxSim 评分：对于每个查询词元，找到最相似的文档词元，求和得分。存储和评分成本更高，但在长查询和领域特定语料上表现更好。

**BGE-M3：三者合一 (BGE-M3: all three at once).** 单个模型同时输出稠密、稀疏和多向量表示。每种表示可独立查询；通过加权求和融合分数。2026 年当你希望从一个检查点获得灵活性时的默认选择。

**Matryoshka 表示学习 (Matryoshka Representation Learning).** 训练时确保向量的前 N 个维度构成一个有用的独立嵌入。将 1,536 维向量截断至 256 维，以约 1% 的精度代价换取 6 倍的存储节省。支持者：OpenAI text-3、Cohere v4、Voyage-4、Jina v5、Gemini Embedding 2、Nomic v1.5+。

### MTEB 排行榜讲述了一个片面的故事 (The MTEB leaderboard tells a partial story)

大规模文本嵌入基准——发布时（2022 年）涵盖 8 类任务的 56 个任务，在 MTEB v2 中扩展至 100+ 任务。2026 年初，Gemini Embedding 2 在检索任务上名列榜首（67.71 MTEB-R）。Cohere embed-v4 综合领先（65.2 MTEB）。BGE-M3 在开源多语言模型中领先（63.0）。排行榜是必要的，但不够——始终要在你的领域上进行基准测试。

### 三层模式 (The three-tier pattern)

| 使用场景 | 模式 |
|----------|---------|
| 快速初筛 | 稠密双编码器 (BGE-M3, text-3-small) |
| 召回提升 | 稀疏 (SPLADE, BGE-M3 sparse) + RRF 融合 |
| 前 50 名精排 | 多向量 (ColBERTv2) 或交叉编码器重排序 |

大多数生产栈会同时使用这三种模式。

## 动手构建 (Build It)

### 第 1 步：基线——使用 Sentence-BERT 的稠密嵌入 (Step 1: baseline — dense embeddings with Sentence-BERT)

```python
from sentence_transformers import SentenceTransformer
import numpy as np

encoder = SentenceTransformer("BAAI/bge-small-en-v1.5")
corpus = [
    "The first iPhone launched in 2007.",
    "Apple released the iPod in 2001.",
    "Android is an operating system from Google.",
]
emb = encoder.encode(corpus, normalize_embeddings=True)

query = "When was the iPhone released?"
q_emb = encoder.encode([query], normalize_embeddings=True)[0]
scores = emb @ q_emb
print(sorted(enumerate(scores), key=lambda x: -x[1]))
```

`normalize_embeddings=True` 使得点积等于余弦相似度。始终设置它。

### 第 2 步：Matryoshka 截断 (Step 2: Matryoshka truncation)

```python
def truncate(vectors, dim):
    out = vectors[:, :dim]
    return out / np.linalg.norm(out, axis=1, keepdims=True)

emb_256 = truncate(emb, 256)
emb_128 = truncate(emb, 128)
```

截断后重新归一化。Nomic v1.5、OpenAI text-3 和 Voyage-4 经过训练，使得前几级截断几乎无损。非 Matryoshka 模型（原始 Sentence-BERT）在截断时性能急剧下降。

### 第 3 步：BGE-M3 多功能 (Step 3: BGE-M3 multi-functionality)

```python
from FlagEmbedding import BGEM3FlagModel

model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)

output = model.encode(
    corpus,
    return_dense=True,
    return_sparse=True,
    return_colbert_vecs=True,
)
# output["dense_vecs"]:    (n_docs, 1024)
# output["lexical_weights"]: list of dict {token_id: weight}
# output["colbert_vecs"]:  list of (n_tokens, 1024) arrays
```

三个索引，一次推理调用。分数融合：

```python
dense_score = ... # cosine over dense_vecs
sparse_score = model.compute_lexical_matching_score(q_lex, d_lex)
colbert_score = model.colbert_score(q_col, d_col)
final = 0.4 * dense_score + 0.2 * sparse_score + 0.4 * colbert_score
```

根据你的领域调整权重。

### 第 4 步：在自定义任务上进行 MTEB 评估 (Step 4: MTEB eval on a custom task)

```python
from mteb import MTEB

tasks = ["ArguAna", "SciFact", "NFCorpus"]
evaluation = MTEB(tasks=tasks)
results = evaluation.run(encoder, output_folder="./mteb-results")
```

在你的*代表性*子集上运行候选模型。不要仅相信排行榜排名——你的领域很重要。

### 第 5 步：从头实现手写余弦相似度 (Step 5: hand-rolled cosine from scratch)

参见 `code/main.py`。平均哈希技巧嵌入（仅限标准库）。无法与 Transformer 嵌入竞争，但展示了基本流程：分词 → 向量 → 归一化 → 点积。

## 陷阱 (Pitfalls)

- **查询和文档使用同一模型 (Same model for query and doc).** 某些模型（Voyage、Jina-ColBERT）使用非对称编码——查询和文档经过不同的路径。始终检查模型卡片。
- **缺失前缀 (Missing prefix).** `bge-*` 模型需要在查询前添加 `"Represent this sentence for searching relevant passages: "`。如果忘记，召回率会下降 3-5 个点。
- **过度截断 Matryoshka (Over-trimming Matryoshka).** 1,536 → 256 通常是安全的。1,536 → 64 则不是。请在你的评估集上验证。
- **上下文截断 (Context truncation).** 大多数模型会静默截断超出其最大长度的输入。长文档需要分块（见第 23 课）。
- **忽略延迟尾部 (Ignoring latency tail).** MTEB 分数隐藏了 p99 延迟。一个 600M 的模型可能比 335M 的模型高 2 分，但每次查询的成本高出 3 倍。

## 实践应用 (Use It)

2026 年推荐栈：

| 场景 | 选择 |
|-----------|------|
| 纯英语、快速、API | `text-embedding-3-large` 或 `voyage-3-large` |
| 开源、英语 | `BAAI/bge-large-en-v1.5` |
| 开源、多语言 | `BAAI/bge-m3` 或 `Qwen3-Embedding-8B` |
| 长上下文 (32k+) | Voyage-3-large、Cohere embed-v4、Qwen3-Embedding-8B |
| 仅 CPU 部署 | Nomic Embed v2 (137M 参数, MoE) |
| 存储受限 | Matryoshka 截断 + int8 量化 |
| 关键词密集查询 | 添加 SPLADE 稀疏，与稠密做 RRF 融合 |

2026 模式：从 BGE-M3 或 text-3-large 开始，用 MTEB 在你的领域上评估，如果某个领域特定模型胜出超过 3 分则进行替换。

## 交付 (Ship It)

保存为 `outputs/skill-embedding-picker.md`：

```markdown
---
name: embedding-picker
description: Pick embedding model, dimension, and retrieval mode for a given corpus and deployment.
version: 1.0.0
phase: 5
lesson: 22
tags: [nlp, embeddings, retrieval]
---

Given a corpus (size, languages, domain, avg length), deployment target (cloud / edge / on-prem), latency budget, and storage budget, output:

1. Model. Named checkpoint or API. One-sentence reason.
2. Dimension. Full / Matryoshka-truncated / int8-quantized. Reason tied to storage budget.
3. Mode. Dense / sparse / multi-vector / hybrid. Reason.
4. Query prefix / template if required by the model card.
5. Evaluation plan. MTEB tasks relevant to domain + held-out domain eval with nDCG@10.

Refuse recommendations that truncate Matryoshka to <64 dims without domain validation. Refuse ColBERTv2 for corpora under 10k passages (overhead not justified). Flag long-document corpora (>8k tokens) routed to models with 512-token windows.
```

## 练习 (Exercises)

1. **简单 (Easy).** 使用 `bge-small-en-v1.5` 以全维度（384）编码 100 个句子，然后使用 Matryoshka 128 维编码。测量 10 个查询上的 MRR 下降。
2. **中等 (Medium).** 在你的领域中的 500 个段落上比较 BGE-M3 的稠密、稀疏和 ColBERT 模式。哪种模式在 recall@10 上胜出？RRF 融合是否优于最佳单一模式？
3. **困难 (Hard).** 在你的前两个领域任务上对三个候选模型运行 MTEB。报告 MTEB 分数、100 个查询批次的 p99 延迟以及 $/1M 查询。选择帕累托最优的模型。

## 关键术语 (Key Terms)

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| 稠密嵌入 (Dense embedding) | 那个向量 (The vector) | 每个文本一个固定大小的向量。使用余弦相似度进行排序。 |
| 稀疏嵌入 (Sparse embedding) | 学习版 BM25 (Learned BM25) | 每个词表词元一个权重；大部分为零；端到端训练。 |
| 多向量 (Multi-vector) | ColBERT 风格 (ColBERT-style) | 每个词元一个向量；MaxSim 评分；索引更大，召回更好。 |
| Matryoshka | 套娃技巧 (Russian doll trick) | 前 N 个维度本身就是一个有效的较小嵌入。 |
| MTEB | 那个基准 (The benchmark) | 大规模文本嵌入基准——发布时 56 个任务，v2 中 100+。 |
| BEIR | 那个检索基准 (The retrieval benchmark) | 18 个零样本检索任务；常被引用于跨领域鲁棒性。 |
| 非对称编码 (Asymmetric encoding) | 查询 ≠ 文档路径 (Query ≠ doc path) | 模型对查询和文档使用不同的投影。 |

## 延伸阅读 (Further Reading)

- [Reimers, Gurevych (2019). Sentence-BERT](https://arxiv.org/abs/1908.10084) — 双编码器论文。
- [Muennighoff et al. (2022). MTEB: Massive Text Embedding Benchmark](https://arxiv.org/abs/2210.07316) — 排行榜论文。
- [Chen et al. (2024). BGE-M3: Multi-lingual, Multi-functionality, Multi-granularity](https://arxiv.org/abs/2402.03216) — 统一三模式模型。
- [Kusupati et al. (2022). Matryoshka Representation Learning](https://arxiv.org/abs/2205.13147) — 维度阶梯训练目标。
- [Santhanam et al. (2022). ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction](https://arxiv.org/abs/2112.01488) — 生产环境中的后期交互。
- [Hugging Face 上的 MTEB 排行榜](https://huggingface.co/spaces/mteb/leaderboard) — 实时排名。
