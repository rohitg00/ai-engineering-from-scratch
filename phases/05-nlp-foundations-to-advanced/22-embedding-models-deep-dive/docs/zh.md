# 嵌入模型（Embedding Models）——2026 深度解析

> Word2Vec 为每个词提供一个向量。现代嵌入模型为每个段落提供一个向量，支持跨语言，包含稀疏（sparse）、稠密（dense）和多向量（multi-vector）视图，大小适配你的索引。选错模型，你的 RAG 就会检索到错误内容。

**类型：** 学习
**语言：** Python
**预备知识：** 阶段 5 · 03（Word2Vec），阶段 5 · 14（信息检索）
**耗时：** 约 60 分钟

## 问题

你的 RAG 系统有 40% 的时间检索到错误段落。罪魁祸首很少是向量数据库或提示词（prompt），而是嵌入模型。

2026 年选择嵌入模型需要在五个维度上做出权衡：

1. **稠密（Dense）vs 稀疏（Sparse）vs 多向量（Multi-vector）。** 每个段落一个向量，或者每个词一个向量，或者一个稀疏加权的词袋。
2. **语言覆盖。** 仅英文模型在仅英文任务上仍然表现优异。多语言模型在语料混合时胜出。
3. **上下文长度。** 512 词元 vs 8,192 vs 32,768——实际有效容量通常只有标称最大值的 60-70%。
4. **维度预算。** 3,072 个浮点数（全精度）等于每个向量 12 KB。在 1 亿向量规模下，存储成本为每月 1,300 美元。Matryoshka 截断（Matryoshka truncation）可将存储降低 4 倍。
5. **开源（Open）vs 托管（Hosted）。** 开源权重意味着你掌控技术和数据。托管意味着你用控制权换取始终最新的模型。

本课程揭示了这些权衡，让你基于证据做出选择，而不是盲目追随上一季度的流行趋势。

## 概念

![稠密、稀疏和多向量嵌入](../assets/embedding-modes.svg)

**稠密嵌入。** 每个段落一个向量（通常 384-3,072 维）。余弦相似度按语义接近程度对段落排序。例如 OpenAI `text-embedding-3-large`、BGE-M3 稠密模式、Voyage-3。默认选择。

**稀疏嵌入。** SPLADE 风格。一个 Transformer 为每个词汇表中的词元预测一个权重，然后将大部分权重置零。结果是一个大小为 |vocab| 的稀疏向量。它捕捉词汇匹配（如 BM25），但使用学习到的词权重。在关键词密集型查询上表现出色。

**多向量（后期交互，Late Interaction）。** ColBERTv2、Jina-ColBERT。每个词元一个向量。使用 MaxSim 进行评分：对每个查询词元，找到最相似的文档词元，求和所有分数。存储和评分成本更高，但在长查询和特定领域语料上胜出。

**BGE-M3：三者合一。** 单个模型同时输出稠密、稀疏和多向量表示。每种表示可独立查询；分数通过加权求和融合。当你想从单个检查点获得灵活性时，这是 2026 年的默认选择。

**Matryoshka 表示学习（Matryoshka Representation Learning）。** 经过训练，向量的前 N 维形成一个有用的独立嵌入。将 1,536 维向量截断为 256 维，仅牺牲约 1% 的准确率，即可节省 6 倍的存储。支持该技术的模型：OpenAI text-3、Cohere v4、Voyage-4、Jina v5、Gemini Embedding 2、Nomic v1.5+。

### MTEB 排行榜只反映了部分情况

大规模文本嵌入基准（Massive Text Embedding Benchmark，MTEB）——在 2022 年发布时包含 8 个任务类型的 56 个任务，到 MTEB v2 已扩展到 100+ 个任务。在 2026 年初，Gemini Embedding 2 在检索任务上排名第一（MTEB-R 67.71）。Cohere embed-v4 在通用任务上领先（MTEB 65.2）。BGE-M3 在开源多语言模型中领先（63.0）。排行榜是必要的，但并不充分——一定要在你的领域上进行基准测试。

### 三层模式

| 使用场景 | 模式 |
|----------|------|
| 快速初筛 | 稠密双编码器（BGE-M3, text-3-small） |
| 召回提升 | 稀疏（SPLADE, BGE-M3 稀疏模式）+ RRF 融合 |
| 前 50 的精排 | 多向量（ColBERTv2）或交叉编码器（Cross-encoder）重排序器 |

大多数生产系统都使用这三种模式。

## 动手实践

### 第 1 步：基准——使用 Sentence-BERT 进行稠密嵌入

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

`normalize_embeddings=True` 使得点积等于余弦相似度。始终设置此参数。

### 第 2 步：Matryoshka 截断

```python
def truncate(vectors, dim):
    out = vectors[:, :dim]
    return out / np.linalg.norm(out, axis=1, keepdims=True)

emb_256 = truncate(emb, 256)
emb_128 = truncate(emb, 128)
```

截断后重新归一化。Nomic v1.5、OpenAI text-3 和 Voyage-4 经过训练，在前几级截断中几乎无损。非 Matryoshka 模型（原始 Sentence-BERT）在截断后性能急剧下降。

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
# output["lexical_weights"]: list of dict {token_id: weight}
# output["colbert_vecs"]:  list of (n_tokens, 1024) arrays
```

一次推理调用，三个索引。分数融合：

```python
dense_score = ... # 对 dense_vecs 进行余弦计算
sparse_score = model.compute_lexical_matching_score(q_lex, d_lex)
colbert_score = model.colbert_score(q_col, d_col)
final = 0.4 * dense_score + 0.2 * sparse_score + 0.4 * colbert_score
```

根据你的领域调整权重。

### 第 4 步：对自定义任务进行 MTEB 评估

```python
from mteb import MTEB

tasks = ["ArguAna", "SciFact", "NFCorpus"]
evaluation = MTEB(tasks=tasks)
results = evaluation.run(encoder, output_folder="./mteb-results")
```

在你的*代表性*子集上运行候选模型。不要只依赖排行榜排名——你的领域很重要。

### 第 5 步：从头实现余弦相似度

参见 `code/main.py`。平均哈希技巧（Averaged Hashing Trick）嵌入（仅使用标准库）。无法与 Transformer 嵌入竞争，但展示了基本流程：分词 → 向量化 → 归一化 → 点积。

## 陷阱

- **查询和文档使用同一个模型。** 某些模型（Voyage、Jina-ColBERT）使用不对称编码——查询和文档经过不同的路径。始终查看模型卡片。
- **缺少前缀。** `bge-*` 模型需要在查询前添加 `"Represent this sentence for searching relevant passages: "`。忘记添加会导致召回率下降 3-5 个点。
- **过度截断 Matryoshka。** 1,536 → 256 通常安全。1,536 → 64 不安全。需要在你的评估集上验证。
- **上下文截断。** 大多数模型会静默截断超过最大长度的输入。长文档需要分块（参见第 23 课）。
- **忽略延迟尾部（Latency tail）。** MTEB 分数隐藏了 p99 延迟。一个 600M 的模型可能比 335M 的模型高出 2 个点，但每次查询的成本高出 3 倍。

## 使用场景

2026 年的选型栈：

| 场景 | 选择 |
|-------|------|
| 仅英文、快速、API | `text-embedding-3-large` 或 `voyage-3-large` |
| 开源权重、英文 | `BAAI/bge-large-en-v1.5` |
| 开源权重、多语言 | `BAAI/bge-m3` 或 `Qwen3-Embedding-8B` |
| 长上下文（32k+） | Voyage-3-large、Cohere embed-v4、Qwen3-Embedding-8B |
| 仅 CPU 部署 | Nomic Embed v2（137M 参数，MoE） |
| 存储受限 | Matryoshka 截断 + int8 量化 |
| 关键词密集型查询 | 添加 SPLADE 稀疏模式，与稠密模式进行 RRF 融合 |

2026 年模式：从 BGE-M3 或 text-3-large 开始，使用 MTEB 在你的领域上评估，如果某个领域专用模型胜出超过 3 个点，则进行替换。

## 交付

保存为 `outputs/skill-embedding-picker.md`：

```markdown
---
name: embedding-picker
description: 为给定语料和部署场景选择嵌入模型、维度和检索模式。
version: 1.0.0
phase: 5
lesson: 22
tags: [nlp, embeddings, retrieval]
---

给定语料（大小、语言、领域、平均长度）、部署目标（云/边缘/本地）、延迟预算和存储预算，输出：

1. 模型。命名检查点或 API。一句原因。
2. 维度。完整 / Matryoshka 截断 / int8 量化。原因与存储预算相关。
3. 模式。稠密 / 稀疏 / 多向量 / 混合。原因。
4. 查询前缀/模板（如果模型卡片要求）。
5. 评估计划。与领域相关的 MTEB 任务 + 保留领域评估（nDCG@10）。

拒绝在未经领域验证的情况下将 Matryoshka 截断到小于 64 维的建议。拒绝为语料少于 10k 段落的场景推荐 ColBERTv2（开销不合理）。标记将长文档语料（>8k 词元）路由到窗口为 512 词元的模型。
```

## 练习

1. **简单。** 使用 `bge-small-en-v1.5` 以完整维度（384）编码 100 个句子，然后在 Matryoshka 128 维下编码。在 10 个查询上测量 MRR 的下降。
2. **中等。** 在你的领域内的 500 个段落上比较 BGE-M3 的稠密、稀疏和 ColBERT 模式。哪个在 recall@10 上胜出？RRF 融合是否优于最佳单一模式？
3. **困难。** 在你的前 2 个领域任务上，对三个候选模型运行 MTEB。报告 MTEB 分数、100 个查询批次的 p99 延迟以及 $/1M 查询。选择帕累托最优的模型。

## 关键术语

| 术语 | 大家说的意思 | 实际含义 |
|------|-----------------|-----------------------|
| 稠密嵌入（Dense embedding） | 向量 | 每个文本一个固定大小的向量。余弦相似度用于排序。 |
| 稀疏嵌入（Sparse embedding） | 学习到的 BM25 | 每个词汇表中的词元一个权重；大部分为零；端到端训练。 |
| 多向量（Multi-vector） | ColBERT 风格 | 每个词元一个向量；MaxSim 评分；索引更大，召回更好。 |
| Matryoshka | 俄罗斯套娃技巧 | 前 N 维本身就是一个有效的较小嵌入。 |
| MTEB | 基准测试 | 大规模文本嵌入基准——发布时 56 个任务，v2 中有 100+。 |
| BEIR | 检索基准测试 | 18 个零样本检索任务；常被引用用于跨领域鲁棒性。 |
| 不对称编码（Asymmetric encoding） | 查询 ≠ 文档路径 | 模型对查询和文档使用不同的投影。 |

## 延伸阅读

- [Reimers, Gurevych (2019). Sentence-BERT](https://arxiv.org/abs/1908.10084) —— 双编码器论文。
- [Muennighoff et al. (2022). MTEB: Massive Text Embedding Benchmark](https://arxiv.org/abs/2210.07316) —— 排行榜论文。
- [Chen et al. (2024). BGE-M3: Multi-lingual, Multi-functionality, Multi-granularity](https://arxiv.org/abs/2402.03216) —— 统一三模式模型。
- [Kusupati et al. (2022). Matryoshka Representation Learning](https://arxiv.org/abs/2205.13147) —— 维度阶梯训练目标。
- [Santhanam et al. (2022). ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction](https://arxiv.org/abs/2112.01488) —— 生产环境中的后期交互。
- [MTEB leaderboard on Hugging Face](https://huggingface.co/spaces/mteb/leaderboard) —— 实时排名。