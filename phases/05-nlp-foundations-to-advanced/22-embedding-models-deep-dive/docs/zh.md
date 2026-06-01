# 22 · 嵌入模型——2026 年深度剖析

> Word2Vec 为每个词提供一个向量。现代嵌入模型则为每段文本提供一个向量，支持跨语言，并提供稀疏、稠密和多向量等多种视图，且可裁剪到适配你的索引的尺寸。一旦选错，你的 RAG 就会检索到错误的内容。

**类型：** 学习
**语言：** Python
**前置：** 第 5 阶段 · 03（Word2Vec）、第 5 阶段 · 14（信息检索）
**时长：** 约 60 分钟

## 问题所在

你的 RAG 系统有 40% 的概率检索到错误的段落。罪魁祸首很少是向量数据库或提示词，而是嵌入模型。

在 2026 年选择一个嵌入模型，意味着要在五个维度上做出取舍：

1. **稠密（dense）vs 稀疏（sparse）vs 多向量（multi-vector）。** 每段文本一个向量，或每个 token 一个向量，或一个稀疏的加权词袋。
2. **语言覆盖范围。** 单语英文模型在纯英文任务上仍然占优。当语料混杂时，多语言模型更胜一筹。
3. **上下文长度。** 512 token vs 8,192 vs 32,768——而真实的有效容量往往只有标称最大值的 60-70%。
4. **维度预算。** 3,072 个全精度浮点数 = 每个向量 12 KB。在 1 亿个向量的规模下，存储成本为 1,300 美元/月。Matryoshka 截断可将其削减 4 倍。
5. **开源 vs 托管。** 开源权重意味着你掌控整个技术栈和数据。托管则用控制权换取始终最新的版本。

本课会把这些取舍点逐一讲清，让你能基于证据来选择，而不是基于上个季度流行什么。

## 核心概念

〔图：稠密、稀疏与多向量嵌入对比〕

**稠密嵌入（dense embeddings）。** 每段文本一个向量（通常为 384-3,072 维）。用余弦相似度按语义相近程度对段落排序。代表有 OpenAI `text-embedding-3-large`、BGE-M3 稠密模式、Voyage-3。默认选择。

**稀疏嵌入（sparse embeddings）。** SPLADE 风格。一个 Transformer 为词表中的每个 token 预测一个权重，然后把绝大多数置零。结果是一个大小为 |vocab| 的稀疏向量。它捕捉词法匹配（类似 BM25），但使用的是学习得到的词项权重。在关键词密集的查询上表现强劲。

**多向量（晚期交互，late interaction）。** 代表有 ColBERTv2、Jina-ColBERT。每个 token 一个向量。用 MaxSim 打分：对每个查询 token，找到最相似的文档 token，再把这些分数求和。存储和打分开销更大，但在长查询和领域特定语料上表现更优。

**BGE-M3：三种模式一次到位。** 单个模型同时输出稠密、稀疏和多向量三种表示。每种都可以独立查询；分数通过加权求和融合。当你希望从一个检查点（checkpoint）获得灵活性时，它就是 2026 年的默认之选。

**Matryoshka 表示学习（Matryoshka Representation Learning）。** 经过专门训练，使向量的前 N 维本身就能构成一个有用的独立嵌入。把一个 1,536 维向量截断到 256 维，只需付出约 1% 的精度代价，便可换来 6 倍的存储节省。OpenAI text-3、Cohere v4、Voyage-4、Jina v5、Gemini Embedding 2、Nomic v1.5+ 均支持。

### MTEB 排行榜只讲述了部分故事

大规模文本嵌入基准（Massive Text Embedding Benchmark，MTEB）——发布时（2022 年）覆盖 8 类任务下的 56 项任务，在 MTEB v2 中扩展到 100+ 项任务。在 2026 年初，Gemini Embedding 2 在检索榜居首（67.71 MTEB-R）。Cohere embed-v4 在综合榜领先（65.2 MTEB）。BGE-M3 在开源权重多语言领域领先（63.0）。排行榜是必要的，但并不充分——务必在你自己的领域上做基准测试。

### 三层模式

| 使用场景 | 模式 |
|----------|------|
| 快速初筛 | 稠密双编码器（BGE-M3、text-3-small） |
| 提升召回 | 稀疏（SPLADE、BGE-M3 sparse）+ RRF 融合 |
| 在 top-50 上提升精度 | 多向量（ColBERTv2）或交叉编码器重排器（cross-encoder reranker） |

大多数生产系统会同时使用这三层。

## 动手构建

### 第 1 步：基线——用 Sentence-BERT 生成稠密嵌入

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

`normalize_embeddings=True` 使点积等于余弦相似度。务必设置它。

### 第 2 步：Matryoshka 截断

```python
def truncate(vectors, dim):
    out = vectors[:, :dim]
    return out / np.linalg.norm(out, axis=1, keepdims=True)

emb_256 = truncate(emb, 256)
emb_128 = truncate(emb, 128)
```

截断后要重新归一化。Nomic v1.5、OpenAI text-3 和 Voyage-4 经过专门训练，使得在前几个层级上这种截断是无损的。非 Matryoshka 模型（原版 Sentence-BERT）在被截断时会急剧退化。

### 第 3 步：BGE-M3 多功能性

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
# output["lexical_weights"]: 字典列表 {token_id: weight}
# output["colbert_vecs"]:  (n_tokens, 1024) 数组的列表
```

三个索引，一次推理调用。分数融合：

```python
dense_score = ... # 对 dense_vecs 计算余弦相似度
sparse_score = model.compute_lexical_matching_score(q_lex, d_lex)
colbert_score = model.colbert_score(q_col, d_col)
final = 0.4 * dense_score + 0.2 * sparse_score + 0.4 * colbert_score
```

在你自己的领域上调整这些权重。

### 第 4 步：在自定义任务上做 MTEB 评测

```python
from mteb import MTEB

tasks = ["ArguAna", "SciFact", "NFCorpus"]
evaluation = MTEB(tasks=tasks)
results = evaluation.run(encoder, output_folder="./mteb-results")
```

在一个*有代表性的*子集上运行你的候选模型。不要只相信排行榜排名——你的领域才是关键。

### 第 5 步：从零手写余弦相似度

参见 `code/main.py`。其中是基于哈希技巧（Hashing Trick）的平均嵌入（仅用标准库）。它在性能上无法与 Transformer 嵌入相比，但展示了基本流程：分词 → 向量 → 归一化 → 点积。

## 常见陷阱

- **查询和文档使用同一模型。** 某些模型（Voyage、Jina-ColBERT）采用非对称编码——查询和文档走不同的路径。务必查看模型卡（model card）。
- **缺少前缀。** `bge-*` 模型需要在查询前拼接 `"Represent this sentence for searching relevant passages: "`。如果忘记，召回率会有 3-5 个点的差距。
- **Matryoshka 截得太狠。** 1,536 → 256 通常是安全的；1,536 → 64 则不然。请在你自己的评测集上验证。
- **上下文截断。** 大多数模型会悄悄截断超过其最大长度的输入。长文档需要分块（见第 23 课）。
- **忽视延迟长尾。** MTEB 分数掩盖了 p99 延迟。一个 600M 模型可能比 335M 模型高出 2 个点，但每次查询的成本却高出 3 倍。

## 实战应用

2026 年的技术栈：

| 情形 | 选择 |
|------|------|
| 纯英文、快速、API | `text-embedding-3-large` 或 `voyage-3-large` |
| 开源权重、英文 | `BAAI/bge-large-en-v1.5` |
| 开源权重、多语言 | `BAAI/bge-m3` 或 `Qwen3-Embedding-8B` |
| 长上下文（32k+） | Voyage-3-large、Cohere embed-v4、Qwen3-Embedding-8B |
| 仅 CPU 部署 | Nomic Embed v2（137M 参数，MoE） |
| 存储受限 | Matryoshka 截断 + int8 量化 |
| 关键词密集的查询 | 加入 SPLADE 稀疏向量，与稠密向量做 RRF 融合 |

2026 年的模式：从 BGE-M3 或 text-3-large 起步，用 MTEB 在你自己的领域上评测，如果某个领域专用模型领先超过 3 个点，则切换过去。

## 交付落地

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

1. **简单。** 用 `bge-small-en-v1.5` 以全维度（384）编码 100 个句子，再以 Matryoshka 128 维编码一次。测量在 10 个查询上的 MRR 下降幅度。
2. **中等。** 在你自己领域的 500 个段落上，对比 BGE-M3 的 dense、sparse 和 colbert 三种模式。哪种在 recall@10 上获胜？RRF 融合能否超过最优的单一模式？
3. **困难。** 在你领域排名前 2 的任务上，对三个候选模型运行 MTEB。报告 MTEB 分数、在 100 条查询批次上的 p99 延迟，以及每百万次查询的成本（$/1M queries）。挑选出帕累托最优（Pareto-optimal）的那个。

## 关键术语

| 术语 | 人们常说 | 它实际的含义 |
|------|----------|--------------|
| 稠密嵌入（Dense embedding） | 那个向量 | 每段文本一个固定大小的向量。用余弦相似度排序。 |
| 稀疏嵌入（Sparse embedding） | 学习版 BM25 | 词表中每个 token 一个权重；大部分为零；端到端训练得到。 |
| 多向量（Multi-vector） | ColBERT 风格 | 每个 token 一个向量；MaxSim 打分；索引更大，召回更好。 |
| Matryoshka | 俄罗斯套娃技巧 | 向量的前 N 维本身就是一个有效的更小嵌入。 |
| MTEB | 那个基准 | 大规模文本嵌入基准——发布时 56 项任务，v2 中达 100+ 项。 |
| BEIR | 那个检索基准 | 18 个零样本检索任务；常被引用来衡量跨领域鲁棒性。 |
| 非对称编码（Asymmetric encoding） | 查询 ≠ 文档路径 | 模型对查询和文档使用不同的投影。 |

## 延伸阅读

- [Reimers, Gurevych (2019). Sentence-BERT](https://arxiv.org/abs/1908.10084) —— 双编码器论文。
- [Muennighoff 等 (2022). MTEB: Massive Text Embedding Benchmark](https://arxiv.org/abs/2210.07316) —— 排行榜论文。
- [Chen 等 (2024). BGE-M3: Multi-lingual, Multi-functionality, Multi-granularity](https://arxiv.org/abs/2402.03216) —— 统一的三模式模型。
- [Kusupati 等 (2022). Matryoshka Representation Learning](https://arxiv.org/abs/2205.13147) —— 维度阶梯训练目标。
- [Santhanam 等 (2022). ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction](https://arxiv.org/abs/2112.01488) —— 生产环境中的晚期交互。
- [Hugging Face 上的 MTEB 排行榜](https://huggingface.co/spaces/mteb/leaderboard) —— 实时排名。
