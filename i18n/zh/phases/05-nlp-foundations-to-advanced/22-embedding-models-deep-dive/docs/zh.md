# 嵌入模型 2026年深度潜水

> Word2Vec给你一个单词的向量.现代嵌入式模型给你一个单词的向量,跨语言,稀疏,密集和多向量视图,以适合你的索引.选择错误,你的RAG检索错误的东西.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 03 (Word2Vec), Phase 5 · 14 (Information Retrieval)
**Time:** ~60 minutes

## 问题

您的RAG系统40%的时间检索错误的通道. 犯人很少是向量数据库或提示.

2026年选择嵌入式意味着在五个轴中选择:

1. **Dense vs sparse vs multi-vector.**通过一个向量,或者一个符号,或者一个稀有重量的词包.
2. **Language coverage.**单语言的英语模型仍然在仅用英语任务上获胜.多语言的模型在混合体时获胜.
3. **Context length.**实际有效容量通常是广告最大的60-70%.
4. **Dimension budget.**在100万个向量时,存储成本为1300美元/月. 马特里奥斯卡切割削减4倍.
5. **Open vs hosted.**开放权重意味着你控制了堆和数据. 托管意味着你交易控制的总是最新.

这一课中,我们给出了这些交易的名字,以便你能根据证据来选择,而不是上个季度的流行.

## 概念

![Dense, sparse, and multi-vector embeddings](../assets/embedding-modes.svg)

**Dense embeddings.**每个通道的向量 (通常是384-3,072维度).宇宙相似性按语义近距离排列通道.`text-embedding-3-large`,BGE-M3密集模式,旅行-3.默认选择.

**Sparse embeddings.**变压器预测每个词汇代号的重量,然后将大部分的重量计算为零.结果是尺寸的稀疏向量.捕获词汇匹配 (如BM25),但具有学习的术语重量.

**Multi-vector (late interaction).**博电子游戏平台, 博电子游戏平台, 博电子游戏平台, 博电子游戏平台, 博电子游戏平台, 博电子游戏平台, 博电子游戏平台, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏, 博电子游戏

**BGE-M3: all three at once.**单个模型同时输出密度,稀少和多向量表示.每个可以独立查询;通过权重数量结合.当你想要从一个检查点灵活性时,2026年默认.

**Matryoshka Representation Learning.**训练为这样,向量的第一个N维度形成一个有用的独立嵌入.将 1,536 个dim 向量缩小到 256 个dim,并为 6 个存储节省付出 ~ 1% 的精度.支持 OpenAI 文本-3,Cohere v4, Voyage-4,Jina v5,Gemini Embedding 2,Nomic v1.5+.

### 马特伯排名榜单讲述了部分故事

马西维文字嵌入基准:2022年发布时,在8个任务类型中实现了56项任务,在MTEB v2中扩展到100多项任务.2026年初,Gemini Embedding 2将达到67.71 MTEB-R的顶级检索.Cohere Embed-v4将带来一般 (65.2 MTEB).BGE-M3将带来开放权重多语言 (63.0).

### 三层格式

| Use case | Pattern |
|----------|---------|
| Fast first-pass | Dense bi-encoder (BGE-M3, text-3-small) |
| Recall boost | Sparse (SPLADE, BGE-M3 sparse) + RRF fuse |
| Precision on top-50 | Multi-vector (ColBERTv2) or cross-encoder reranker |

许多生产堆都使用了三种.

```figure
gx-matryoshka
```

## 建立它

### 步骤1:基线 加载文本-BERT的密集嵌入

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

`normalize_embeddings=True`总是设置它.

### 步骤2: 马特里奥斯卡切割

```python
def truncate(vectors, dim):
    out = vectors[:, :dim]
    return out / np.linalg.norm(out, axis=1, keepdims=True)

emb_256 = truncate(emb, 256)
emb_128 = truncate(emb, 128)
```

经过切割后重新正常化. Nomic v1.5, OpenAI text-3,和 Voyage-4 训练,因此在前几级别中,这种模式是无损的.非马特里奥斯卡模型 (原始的句子-BERT) 在切割时会大幅降低.

### 步骤3:BGE-M3多功能

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

两个指数,一个推断号码.

```python
dense_score = ... # cosine over dense_vecs
sparse_score = model.compute_lexical_matching_score(q_lex, d_lex)
colbert_score = model.colbert_score(q_col, d_col)
final = 0.4 * dense_score + 0.2 * sparse_score + 0.4 * colbert_score
```

调整你的权重.

### 步骤4: MTEB 评估一个定制任务

```python
from mteb import MTEB

tasks = ["ArguAna", "SciFact", "NFCorpus"]
evaluation = MTEB(tasks=tasks)
results = evaluation.run(encoder, output_folder="./mteb-results")
```

运行你的候选模型在一个*代表性*子集. 不要只相信排名榜单排名你的域名是重要的.

### 步骤5:从零开始手动滚动的子

看到`code/main.py`.平均哈希技嵌入式 (仅仅在stdlib).与变压器嵌入式不竞争,但显示形状:代币化 →向量 →正常化 →点产品.

## 陷

- **Same model for query and doc.**一些模型 (Voyage,Jina-ColBERT) 使用不对称编码查询和文档通过不同的路径.
- **Missing prefix.** `bge-*`模型需要`"Represent this sentence for searching relevant passages: "`如果忘记了,就会有3-5点的回忆差距.
- **Over-trimming Matryoshka.**根据你的评估设置验证.
- **Context truncation.**大多数模型默默地缩小输入,超过其最大长度.长档需要缩小 (见23课).
- **Ignoring latency tail.** MTEB 评分隐藏了p99延迟. 600M 模型可能比 335M 模型超过 2 分,但每次查询成本 3 倍多.

## 用它

现在,我们要做什么?

| Situation | Pick |
|-----------|------|
| English-only, fast, API | `text-embedding-3-large` or `voyage-3-large` |
| Open-weight, English | `BAAI/bge-large-en-v1.5` |
| Open-weight, multilingual | `BAAI/bge-m3` or `Qwen3-Embedding-8B` |
| Long context (32k+) | Voyage-3-large, Cohere embed-v4, Qwen3-Embedding-8B |
| CPU-only deployment | Nomic Embed v2 (137M params, MoE) |
| Storage-constrained | Matryoshka-truncated + int8 quantization |
| Keyword-heavy queries | Add SPLADE sparse, RRF-fuse with dense |

2026模式:从BGE-M3或文本-3大开始,在您的域名上评估MTEB,如果域名特定模型赢得超过3分,则更换.

## 运送它

保存如`outputs/skill-embedding-picker.md`其他:

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

## 运动

1. **Easy.**编码100个句子`bge-small-en-v1.5`在全 (384),然后在Matryoshka 128.
2. **Medium.**根据您的域名的500个段落,比较BGE-M3密度,稀疏和Colbert. 哪个在回忆@10中获胜?
3. **Hard.**在两个顶级域名任务中运行MTEB的三个候选模型. 报告MTEB的分数,100个查询批量上的p99延迟,以及1万美元的查询. 选择Pareto最佳的.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Dense embedding | The vector | One fixed-size vector per text. Cosine similarity for ranking. |
| Sparse embedding | Learned BM25 | One weight per vocab token; mostly zeros; trained end-to-end. |
| Multi-vector | ColBERT-style | One vector per token; MaxSim scoring; bigger index, better recall. |
| Matryoshka | Russian doll trick | First N dims are a valid smaller embedding on their own. |
| MTEB | The benchmark | Massive Text Embedding Benchmark — 56 tasks at launch, 100+ in v2. |
| BEIR | The retrieval benchmark | 18 zero-shot retrieval tasks; often cited for cross-domain robustness. |
| Asymmetric encoding | Query ≠ doc path | Model uses different projections for queries and documents. |

## 进一步阅读

- [Reimers, Gurevych (2019). Sentence-BERT](https://arxiv.org/abs/1908.10084)双码码纸.
- [Muennighoff et al. (2022). MTEB: Massive Text Embedding Benchmark](https://arxiv.org/abs/2210.07316)排名表纸
- [Chen et al. (2024). BGE-M3: Multi-lingual, Multi-functionality, Multi-granularity](https://arxiv.org/abs/2402.03216)统一三模式模型.
- [Kusupati et al. (2022). Matryoshka Representation Learning](https://arxiv.org/abs/2205.13147) 维度梯子培训目标.
- [Santhanam et al. (2022). ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction](https://arxiv.org/abs/2112.01488)生产中迟到的相互作用.
- [MTEB leaderboard on Hugging Face](https://huggingface.co/spaces/mteb/leaderboard)现场排名.
