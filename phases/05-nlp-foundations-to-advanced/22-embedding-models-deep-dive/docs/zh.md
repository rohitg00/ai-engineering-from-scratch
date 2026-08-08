# Embedding Models — The 2026 Deep Dive

> Word2Vec为每个单词提供了一个向量。现代嵌入模型为您提供了每个段落的向量，跨语言，具有稀疏，密集和多向量视图，大小适合您的索引。选错了，你的RAG会检索到错误的东西。

** 类型：** 学习
** 语言：** Python
** 前提：** 阶段5 · 03（Word 2 Vec），阶段5 · 14（信息检索）
** 时间：** ~60分钟

## The Problem

您的RAG系统有40%的时间检索错误的段落。罪魁祸首很少是载体数据库或提示。这是嵌入模型。

选择2026年嵌入意味着要跨越五个轴：

1. ** 密集vs稀疏vs多载体。**每条段落一个载体，或每个记号一个载体，或稀疏加权的词袋。
2. ** 语言覆盖。**单语英语模式仍然在纯英语任务中获胜。当数据库混合时，多语言模型获胜。
3. ** 上下文长度。** 512个代币vs 8，192个代币vs 32，768个代币-实际有效容量通常是广告最大容量的60-70%。
4. ** 维度预算。** 3，072个浮点数，全精度=每个载体12 KB。在1亿个载体时，存储费用为1，300美元/月。Matryoshka截断将其削减4倍。
5. ** 开放vs托管。**开重意味着您控制堆栈和数据。托管意味着您将控制权换成始终最新的。

这堂课列出了权衡，以便您可以选择证据，而不是上季度流行的东西。

## The Concept

![Dense, sparse, and multi-vector embeddings](../assets/embedding-modes.svg)

** 密集嵌入。**每段一个载体（通常为384- 3，072维）。Cosine相似度根据语义接近度对段落进行排名。OpenAI“文本嵌入-3-大”，BGE-M3密集模式，Voyage-3。默认选择。

** 稀疏嵌入。** SPLADE风格。Transformer预测每个vocab令牌的权重，然后将其中大部分归零。结果是一个稀疏的大小载体|vocab|.捕获词汇匹配（例如BM 25），但使用学习的术语权重。对关键字较多的查询表现出色。

** 多载体（后期交互）。** ColBERTv 2，Jina-ColBERT。每个令牌一个载体。使用MaxSim评分：对于每个查询令牌，找到最相似的文档令牌，将分数相加。存储和评分更昂贵，但在长查询和特定领域的数据库中获胜。

**BGE-M3：同时完成这三者。**单个模型同时输出密集、稀疏和多载体表示。每个都可以独立查询;分数通过加权和融合。当您希望从一个检查点获得灵活性时，默认为2026年。

**Matryoshka表示学习。**经过训练，使该载体的前N个维度形成有用的独立嵌入。将1，536 dim的载体截断为256 dim，并支付约1%的准确性，可节省6倍的存储空间。受OpenAI text-3、Kohere v4、Voyage-4、Jina v5、Gemini Embedding 2、Nomic v1.5+支持。

### The MTEB leaderboard tells a partial story

Massive Text Embedding Benchmark -在发布时（2022年），涵盖8种任务类型中的56项任务，在MTEB v2中扩展到100多项任务。2026年初，Gemini Embeding 2的检索率位居榜首（67.71 MTEB-R）。Kohere embed-v4领先将军（65.2 MTEB）。BGE-M3领先开量级多语言（63.0）。排行榜是必要的，但还不够-总是在你的领域基准。

### The three-tier pattern

| 用例 | 图案 |
|----------|---------|
| 快速首过 | 密集双编码器（BGE-M3，文本-3-small） |
| 召回提升 | 稀疏（SPLADE、BGE-M3稀疏）+ RRF熔丝 |
| 精确度名列前茅-50 | 多载体（ColBERTv 2）或交叉编码器重排序器 |

大多数生产栈都使用这三种。

## Build It

### Step 1: baseline — dense embeddings with Sentence-BERT

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

“normalize_embeddings=True”使点积等于cos相似度。始终设置它。

### Step 2: Matryoshka truncation

```python
def truncate(vectors, dim):
    out = vectors[:, :dim]
    return out / np.linalg.norm(out, axis=1, keepdims=True)

emb_256 = truncate(emb, 256)
emb_128 = truncate(emb, 128)
```

截断后重新正常化。Nomic v1.5、OpenAI text-3和Voyage-4都经过训练，因此这在前几个级别中是无损的。非Matryoshka模型（最初的Sentence-BERT）在截断时会急剧退化。

### Step 3: BGE-M3 multi-functionality

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

三个索引，一个推断调用。评分融合：

```python
dense_score = ... # cosine over dense_vecs
sparse_score = model.compute_lexical_matching_score(q_lex, d_lex)
colbert_score = model.colbert_score(q_col, d_col)
final = 0.4 * dense_score + 0.2 * sparse_score + 0.4 * colbert_score
```

调整您的域的权重。

### Step 4: MTEB eval on a custom task

```python
from mteb import MTEB

tasks = ["ArguAna", "SciFact", "NFCorpus"]
evaluation = MTEB(tasks=tasks)
results = evaluation.run(encoder, output_folder="./mteb-results")
```

在 * 代表性 * 子集上运行您的候选模型。不要仅仅相信排行榜排名-您的领域很重要。

### Step 5: hand-rolled cosine from scratch

请参阅' code/main.py '。平均哈希技巧嵌入（仅限stdlib）。与Transformer嵌入不具有竞争力，但显示形状：标记化-载体-规范化-点积。

## Pitfalls

- ** 查询和文档模型相同。**某些模型（Voyage、Jina-ColBERT）使用非对称编码-查询和文档通过不同的路径传递。始终检查型号卡。
- ** 缺少前置码。** ' bge-*'模型需要'代表这句话以搜索相关段落：'前置于查询。3-5如果您忘记，则会出现点回忆差距。
- ** 过度修剪Matryoshka。** 1，536 - 256通常是安全的。1，536 - 64不是。在您的评估集上卸载。
- ** 上下文截断。**大多数模型都会在输入的最大长度范围内无声地截断输入。长文档需要分块（参见第23课）。
- ** 忽略延迟尾部。** MTEB分数隐藏了p99延迟。600 M型号可能比335 M型号高2个百分点，但每次查询的成本要高出3倍。

## Use It

2026年堆栈：

| 情况 | 接 |
|-----------|------|
| 纯英语、快速、API | “文本嵌入-3-大”或“航行-3-大” |
| 开量级，英语 | ' BAAI/bge-large-en-v1.5 ' |
| 开放重量、多语言 | ' BAAI/bge-m3 '或' Qwen 3-Embedding-8B ' |
| 长上下文（32k+） | Voyage-3-大，Kohere嵌入-v4，Qwen 3-嵌入-8B |
| 仅限MCU部署 | Nomic Embed v2（1.37亿参数，MoE） |
| 时间限制 | Matryoshka截断+int 8量化 |
| 关键词较多的查询 | 添加SPLADE稀疏、RRF融合和密集 |

2026模式：从BGE-M3或text-3-large开始，使用MTEB评估您的域名，如果特定领域的模型获胜超过3分，则进行交换。

## Ship It

另存为“输出/skill-embedding-picker.md”：

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

## Exercises

1. ** 简单。**用“bge-small-en-v1.5”在全暗（384）下编码100个句子，然后用Matryoshka 128编码。测量10个查询的MRR下降。
2. ** 中等。**比较您所在领域的500个段落的BGE-M3密集、稀疏和科尔伯特。哪一个在recall@10上获胜？RRF融合是否击败了最好的单一模式？
3. ** 很难。**在您的前2个域任务中的三个候选模型上运行MTEB。报告MTEB评分、100个查询批次的p99延迟和$/1 M查询。选择帕累托最优。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 密集嵌入 | 矢量 | 每个文本一个固定大小的载体。排名的Cosine相似性。 |
| 稀疏嵌入 | 习得BM 25 | 每个vocab令牌一个权重;大多数为零;经过端到端训练。 |
| 多向量 | 科尔伯特风格 | 每个标记一个向量; MaxSim评分;更大的索引，更好的召回。 |
| Matryoshka | 俄罗斯娃娃戏法 | 前N个dimm本身就是有效的较小嵌入。 |
| MTEB | 基准 | 大量文本嵌入基准-发布时有56项任务，v2中有100多项任务。 |
| BEIR | 检索基准 | 18个零镜头检索任务;经常因跨域稳健性而被引用。 |
| 不对称编码 | 查询DeliverDoc路径 | 模型对查询和文档使用不同的投影。 |

## Further Reading

- [Reimers，Gurevych（2019）。Sentence-BERT]（https：//arxiv.org/ab/1908.10084）-双编码器论文。
- [Muennighoff等人（2022）。MTEB：海量文本嵌入基准]（https：//arxiv.org/abs/2210.07316）-排行榜论文。
- [Chen等人（2024）。BGE-M3：多语言、多功能、多粒度]（https：//arxiv.org/abs/2402.03216）-统一的三模式模型。
- [Kusupati等人（2022）。Matryoshka Representative Learning]（https：//arxiv.org/ab/2205.13147）-维度阶梯培训目标。
- [Santhanam等人（2022）。ColBERTv 2：通过轻量级后期交互进行有效且高效的检索]（https：//arxiv.org/ab/2112.01488）-生产中的后期交互。
- [MTEB Hugging Face上的排行榜]（https：//huggingface.co/spaces/mteb/leaderboard）-实时排名。
