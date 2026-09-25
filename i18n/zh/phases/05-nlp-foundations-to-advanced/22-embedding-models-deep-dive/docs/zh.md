# 嵌入模型 —— 2026 年深度解析

> Word2Vec 给你一个词级别的向量。现代嵌入模型为你提供段落级向量、跨语言能力，以及稀疏、稠密和多向量三种视角，并且尺寸可适配你的索引。选错了，你的 RAG 就会检索到错误的内容。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 5 · 03 (Word2Vec)、Phase 5 · 14 (信息检索)
**Time:** ~60 分钟

## 问题所在

你的 RAG 系统有 40% 的时间检索到错误的段落。罪魁祸首很少是向量数据库或提示词，而是嵌入模型。

在 2026 年选择嵌入模型，意味着要在五个维度上权衡：

1. **稠密 vs 稀疏 vs 多向量。** 每个段落一个向量、每个 token 一个向量，还是稀疏的加权词袋。
2. **语言覆盖。** 单语英语模型在纯英语任务上仍然占优。当语料混合时，多语模型更胜一筹。
3. **上下文长度。** 512 tokens vs 8,192 vs 32,768 —— 而实际有效容量往往只有标称最大值的 60-70%。
4. **维度预算。** 全精度 3,072 个浮点数 = 每个向量 12 KB。1 亿个向量时，存储成本为每月 1,300 美元。Matryoshka 截断可将其降低 4 倍。
5. **开源 vs 托管。** 开源权重意味着你掌控技术栈和数据。托管意味着用控制权换取始终保持最新。

本课将点明这些权衡，让你基于证据做选择，而不是跟风上个季度的流行款。

## 核心概念

![Dense, sparse, and multi-vector embeddings](../assets/embedding-modes.svg)

**稠密嵌入。** 每个段落一个向量（通常 384-3,072 维）。余弦相似度按语义接近程度对段落排序。OpenAI `text-embedding-3-large`、BGE-M3 dense 模式、Voyage-3。默认之选。

**稀疏嵌入。** SPLADE 风格。一个 transformer 为词表中的每个 token 预测一个权重，然后将大部分置零。结果是大小为 |vocab| 的稀疏向量。捕捉词汇匹配（类似 BM25），但权重是学习得到的。在关键词密集的查询上表现出色。

**多向量（后期交互）。** ColBERTv2、Jina-ColBERT。每个 token 一个向量。用 MaxSim 打分：对每个查询 token，找到最相似的文档 token，然后求和。存储和打分成本更高，但在长查询和特定领域语料上表现更好。

**BGE-M3：三者兼备。** 单一模型同时输出稠密、稀疏和多向量表示。每种表示可独立查询；得分通过加权和融合。当你想从一个 checkpoint 获得灵活性时，这是 2026 年的默认选择。

**Matryoshka 表示学习。** 训练时保证向量的前 N 维本身就是一个可用的独立嵌入。将 1,536 维向量截断为 256 维，仅损失约 1% 的准确率，却节省 6 倍存储。OpenAI text-3、Cohere v4、Voyage-4、Jina v5、Gemini Embedding 2、Nomic v1.5+ 均支持。

### MTEB 排行榜只讲了一半故事

Massive Text Embedding Benchmark —— 发布时（2022 年）有 8 类任务共 56 个任务，在 MTEB v2 中扩展到 100+ 个任务。2026 年初，Gemini Embedding 2 在检索上居首（67.71 MTEB-R）。Cohere embed-v4 领跑综合榜（65.2 MTEB）。BGE-M3 领跑开源多语榜（63.0）。排行榜必要但不充分 —— 一定要在你自己的领域上做基准测试。

### 三层模式

| 使用场景 | 模式 |
|----------|---------|
| 快速初筛 | 稠密双塔编码器（BGE-M3、text-3-small） |
| 提升召回 | 稀疏（SPLADE、BGE-M3 sparse）+ RRF 融合 |
| top-50 精排 | 多向量（ColBERTv2）或 cross-encoder 重排序器 |

大多数生产系统三者并用。

```figure
gx-matryoshka
```

## 动手构建

### 步骤 1：基线 —— 用 Sentence-BERT 构建稠密嵌入

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

`normalize_embeddings=True` 会使点积等于余弦相似度。务必设置它。

### 步骤 2：Matryoshka 截断

```python
def truncate(vectors, dim):
    out = vectors[:, :dim]
    return out / np.linalg.norm(out, axis=1, keepdims=True)

emb_256 = truncate(emb, 256)
emb_128 = truncate(emb, 128)
```

截断后要重新归一化。Nomic v1.5、OpenAI text-3 和 Voyage-4 经过训练，前几个层级的截断几乎无损。非 Matryoshka 模型（初版 Sentence-BERT）在截断后性能会急剧下降。

### 步骤 3：BGE-M3 的多功能性

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

一次推理调用，三个索引。得分融合：

```python
dense_score = ... # cosine over dense_vecs
sparse_score = model.compute_lexical_matching_score(q_lex, d_lex)
colbert_score = model.colbert_score(q_col, d_col)
final = 0.4 * dense_score + 0.2 * sparse_score + 0.4 * colbert_score
```

在你的领域数据上调优权重。

### 步骤 4：在自定义任务上运行 MTEB 评估

```python
from mteb import MTEB

tasks = ["ArguAna", "SciFact", "NFCorpus"]
evaluation = MTEB(tasks=tasks)
results = evaluation.run(encoder, output_folder="./mteb-results")
```

让候选模型在*有代表性*的子集上运行。不要只信排行榜名次 —— 你的领域才是关键。

### 步骤 5：从零手写余弦相似度

见 `code/main.py`。Averaged Hashing Trick 嵌入（仅用标准库）。竞争力不如 transformer 嵌入，但展示了基本流程：分词 → 向量化 → 归一化 → 点积。

## 常见陷阱

- **查询和文档使用同一模型。** 有些模型（Voyage、Jina-ColBERT）采用非对称编码 —— 查询和文档走不同的路径。务必查看模型卡片。
- **缺少前缀。** `bge-*` 模型需要在查询前加上 `"Represent this sentence for searching relevant passages: "`。忘了的话召回率会差 3-5 个点。
- **Matryoshka 过度截断。** 1,536 → 256 通常安全。1,536 → 64 则不行。在你的评估集上验证。
- **上下文截断。** 大多数模型会静默截断超过最大长度的输入。长文档需要分块（见第 23 课）。
- **忽略延迟尾部。** MTEB 分数掩盖了 p99 延迟。一个 600M 的模型可能比 335M 的模型高 2 个点，但每次查询成本高 3 倍。

## 实际应用

2026 年的技术栈：

| 场景 | 选择 |
|-----------|------|
| 纯英语、快速、API | `text-embedding-3-large` 或 `voyage-3-large` |
| 开源权重、英语 | `BAAI/bge-large-en-v1.5` |
| 开源权重、多语 | `BAAI/bge-m3` 或 `Qwen3-Embedding-8B` |
| 长上下文（32k+） | Voyage-3-large、Cohere embed-v4、Qwen3-Embedding-8B |
| 纯 CPU 部署 | Nomic Embed v2（137M 参数，MoE） |
| 存储受限 | Matryoshka 截断 + int8 量化 |
| 关键词密集查询 | 加上 SPLADE 稀疏，与稠密做 RRF 融合 |

2026 年的套路：从 BGE-M3 或 text-3-large 起步，用 MTEB 在你的领域上评估，若某个领域专用模型领先超过 3 个点则替换。

## 上线部署

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

## 练习

1. **简单。** 用 `bge-small-en-v1.5` 以全维度（384）编码 100 个句子，再以 Matryoshka 128 维编码。在 10 个查询上测量 MRR 降幅。
2. **中等。** 在你领域的 500 个段落上比较 BGE-M3 的 dense、sparse 和 colbert 三种模式。哪种在 recall@10 上胜出？RRF 融合是否优于最好的单一模式？
3. **困难。** 在你排名前二的领域任务上对三个候选模型运行 MTEB。报告 MTEB 分数、100 个查询批次上的 p99 延迟，以及 $/1M 查询。选出 Pareto 最优的那个。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 稠密嵌入 | 那个向量 | 每个文本一个固定大小的向量。用余弦相似度排序。 |
| 稀疏嵌入 | 学习版 BM25 | 词表中每个 token 一个权重；大部分为零；端到端训练。 |
| 多向量 | ColBERT 风格 | 每个 token 一个向量；MaxSim 打分；索引更大，召回更好。 |
| Matryoshka | 俄罗斯套娃技巧 | 前 N 维本身就是一个有效的更小嵌入。 |
| MTEB | 那个基准 | Massive Text Embedding Benchmark —— 发布时 56 个任务，v2 中 100+ 个。 |
| BEIR | 检索基准 | 18 个零样本检索任务；常被引用来衡量跨领域鲁棒性。 |
| 非对称编码 | 查询 ≠ 文档路径 | 模型对查询和文档使用不同的投影。 |

## 延伸阅读

- [Reimers, Gurevych (2019). Sentence-BERT](https://arxiv.org/abs/1908.10084) —— 双塔编码器论文。
- [Muennighoff et al. (2022). MTEB: Massive Text Embedding Benchmark](https://arxiv.org/abs/2210.07316) —— 排行榜论文。
- [Chen et al. (2024). BGE-M3: Multi-lingual, Multi-functionality, Multi-granularity](https://arxiv.org/abs/2402.03216) —— 统一的三模式模型。
- [Kusupati et al. (2022). Matryoshka Representation Learning](https://arxiv.org/abs/2205.13147) —— 维度阶梯训练目标。
- [Santhanam et al. (2022). ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction](https://arxiv.org/abs/2112.01488) —— 生产环境中的后期交互。
- [MTEB leaderboard on Hugging Face](https://huggingface.co/spaces/mteb/leaderboard) —— 实时排名。