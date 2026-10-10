# embedding 模型——2026 年深入看

> Word2Vec 給你每個詞一個向量。現代 embedding 模型給你每段一個向量，跨語言，並有稀疏、稠密、多向量三種看法，大小配得上你的索引。選錯，RAG 就檢索到錯的東西。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 5 · 03 (Word2Vec), Phase 5 · 14 (Information Retrieval)
**Time:** ~60 minutes

## The Problem｜問題

你的 RAG 系統有 40% 的時候檢索到錯的段落。元兇很少是向量資料庫或 prompt。是 embedding 模型。

2026 年選 embedding，是在五條軸上挑：

1. **稠密對稀疏對多向量。** 每段一個向量，或每個 token 一個，或一個稀疏的加權詞袋（bag of words）。
2. **語言覆蓋。** 只有英文的單語模型，在純英文任務上仍然會贏。語料庫（corpus）混在一起時，多語模型會贏。
3. **脈絡長度。** 512 個 token 對上 8,192 對上 32,768——實際有效容量常常只有宣傳上限的 60% 到 70%。
4. **維度（dimension）預算。** 全精度 3,072 個浮點數（float）是每個向量 12 KB。1 億個向量時，儲存是每月 1,300 美元。Matryoshka 截斷把這砍成四分之一。
5. **開放對託管。** 開放權重表示你控管整條堆疊和資料。託管表示你用控制權換永遠最新。

這一課把取捨點名，讓你照證據挑，而不是照上季流行什麼挑。

## The Concept｜核心概念

![Dense, sparse, and multi-vector embeddings](../assets/embedding-modes.svg)

**稠密 embedding。** 每段一個向量（通常 384 到 3,072 維）。餘弦（cosine）相似度按語意接近程度為段落排名。OpenAI `text-embedding-3-large`、BGE-M3 的稠密模式、Voyage-3。預設選擇。

**稀疏 embedding。** SPLADE 風格。transformer 為詞彙表（vocabulary）裡每個 token 預測一個權重，再把大多數清成零。結果是大小為 |詞彙表| 的稀疏向量（sparse vector）。抓得到詞彙相符（像 BM25），但詞的權重是學出來的。關鍵字很多的查詢上很強。

**多向量（晚期互動）。** ColBERTv2、Jina-ColBERT。每個 token 一個向量。用 MaxSim 打分：對每個查詢 token，找最相似的文件 token，再把分數加總。儲存和打分都更貴，但長查詢和領域語料庫上會贏。

**BGE-M3：三種一次給。** 一個模型同時輸出稠密、稀疏、多向量表示。每一種可以獨立查詢；分數用加權總和融合。2026 年想從一個 checkpoint 得到彈性時的預設。

**Matryoshka 表示學習（Matryoshka Representation Learning）。** 訓練得讓向量的前 N 維自己就是一個能用的 embedding。把 1,536 維截到 256 維，準確率（accuracy）大約少 1%，儲存省下 6 倍。OpenAI text-3、Cohere v4、Voyage-4、Jina v5、Gemini Embedding 2、Nomic v1.5 以後都支援。

### MTEB 排行榜只說了一部分

大規模文本 embedding 評測（Massive Text Embedding Benchmark，MTEB）——推出時（2022）8 類任務共 56 個，MTEB v2 擴到 100 個以上。2026 年初，Gemini Embedding 2 在檢索居前（MTEB-R 67.71）。Cohere embed-v4 在一般任務領先（MTEB 65.2）。BGE-M3 在開放權重多語領先（63.0）。排行榜必要，但不充分——永遠在你的領域上評測。

### 三層模式

| 用途 | 模式 |
|----------|---------|
| 快速的第一輪 | 稠密雙編碼器（bi-encoder）（BGE-M3、text-3-small） |
| 拉高召回率（recall） | 稀疏（SPLADE、BGE-M3 稀疏）加 RRF 融合 |
| 前 50 的精確率（precision） | 多向量（ColBERTv2）或交叉編碼器（cross-encoder）重排器 |

多數正式環境（production）組合三層都用。

```figure
gx-matryoshka
```

## Build It｜動手實作

### 步驟 1：基準模型（baseline）——用 Sentence-BERT 做稠密 embedding

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

`normalize_embeddings=True` 讓內積（dot product）等於餘弦相似度。永遠要設。

### 步驟 2：Matryoshka 截斷

```python
def truncate(vectors, dim):
    out = vectors[:, :dim]
    return out / np.linalg.norm(out, axis=1, keepdims=True)

emb_256 = truncate(emb, 256)
emb_128 = truncate(emb, 128)
```

截斷之後要重新正規化（normalization）。Nomic v1.5、OpenAI text-3、Voyage-4 訓練得讓在前幾個截斷層級幾乎不會損失品質。不是 Matryoshka 的模型（原本的 Sentence-BERT）一截斷就掉得很兇。

### 步驟 3：BGE-M3 的多功能

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

三個索引，一次推論（inference）。分數融合：

```python
dense_score = ... # cosine over dense_vecs
sparse_score = model.compute_lexical_matching_score(q_lex, d_lex)
colbert_score = model.colbert_score(q_col, d_col)
final = 0.4 * dense_score + 0.2 * sparse_score + 0.4 * colbert_score
```

在你的領域上調校這些權重。

### 步驟 4：在自訂任務上做 MTEB 評估

```python
from mteb import MTEB

tasks = ["ArguAna", "SciFact", "NFCorpus"]
evaluation = MTEB(tasks=tasks)
results = evaluation.run(encoder, output_folder="./mteb-results")
```

在*有代表性*的子集上跑候選模型。不要只信排行榜名次——你的領域才要緊。

### 步驟 5：從零實作餘弦相似度

見 `code/main.py`。平均過的雜湊技巧 embedding（只用標準函式庫，library）。打不過 transformer embedding，但露出形狀：tokenize → 向量 → 正規化 → 內積。

## 坑

- **查詢和文件用同一個模型。** 有些模型（Voyage、Jina-ColBERT）用不對稱編碼——查詢和文件走不同的路徑。永遠看模型卡。
- **漏了前綴。** `bge-*` 模型要在查詢前面加上 `"Represent this sentence for searching relevant passages: "`。忘了，召回率差 3 到 5 分。
- **Matryoshka 剪太短。** 1,536 到 256 通常安全。1,536 到 64 不安全。在你的評估集上驗證。
- **脈絡被截斷。** 多數模型對超過最大長度的輸入會悄悄截斷。長文件需要切塊（見第 23 課）。
- **不理延遲（latency）的尾端。** MTEB 分數藏起 p99 延遲。6 億參數的模型可能比 3.35 億的高 2 分，但每個查詢貴 3 倍。

## Use It｜實際應用

2026 年的組合：

| 情況 | 選擇 |
|-----------|------|
| 只有英文、要快、走 API | `text-embedding-3-large` 或 `voyage-3-large` |
| 開放權重、英文 | `BAAI/bge-large-en-v1.5` |
| 開放權重、多語 | `BAAI/bge-m3` 或 `Qwen3-Embedding-8B` |
| 長脈絡（3.2 萬以上） | Voyage-3-large、Cohere embed-v4、Qwen3-Embedding-8B |
| 只有 CPU 的部署（deployment） | Nomic Embed v2（1.37 億參數，MoE） |
| 儲存受限 | Matryoshka 截斷加 int8 量化（quantization） |
| 關鍵字很多的查詢 | 加上 SPLADE 稀疏，和稠密做 RRF 融合 |

2026 年的模式：從 BGE-M3 或 text-3-large 開始，用 MTEB 在你的領域上評估，若領域專用模型贏超過 3 分再換。

## Ship It｜交付成果

存成 `outputs/skill-embedding-picker.md`：

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

## Exercises｜練習

1. **簡單。** 用 `bge-small-en-v1.5` 把 100 句編成全維（384），再編成 Matryoshka 128。量 10 個查詢上的 MRR 掉多少。
2. **中等。** 在你領域的 500 段上比較 BGE-M3 的稠密、稀疏和 ColBERT。前 10 的召回率誰贏？RRF 融合有沒有贏過最好的單一模式？
3. **困難。** 在你最主要的 2 個領域任務上，對三個候選模型跑 MTEB。報告 MTEB 分數、100 個查詢的批次（batch）上的 p99 延遲，以及每 100 萬次查詢的美元成本。選出帕累托最佳解。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 稠密 embedding | 那個向量 | 每段文本一個固定大小的向量。用餘弦相似度排名。 |
| 稀疏 embedding | 學出來的 BM25 | 詞彙表每個 token 一個權重；大多是零；端到端訓練。 |
| 多向量 | ColBERT 風格 | 每個 token 一個向量；MaxSim 打分；索引更大，召回更好。 |
| Matryoshka | 俄羅斯娃娃那一招 | 前 N 維自己就是一個更小、仍然合法的 embedding。 |
| MTEB | 那個評測 | 大規模文本 embedding 評測——推出時 56 個任務，v2 有 100 個以上。 |
| BEIR | 檢索評測 | 18 個零樣本（zero-shot）檢索任務；常被拿來談跨領域穩健。 |
| 不對稱編碼 | 查詢路徑不等於文件路徑 | 模型對查詢和文件用不同的投影。 |

## Further Reading｜延伸閱讀

- [Reimers, Gurevych (2019). Sentence-BERT](https://arxiv.org/abs/1908.10084) ——雙編碼器論文。
- [Muennighoff et al. (2022). MTEB: Massive Text Embedding Benchmark](https://arxiv.org/abs/2210.07316) ——排行榜論文。
- [Chen et al. (2024). BGE-M3: Multi-lingual, Multi-functionality, Multi-granularity](https://arxiv.org/abs/2402.03216) ——三種模式合一的模型。
- [Kusupati et al. (2022). Matryoshka Representation Learning](https://arxiv.org/abs/2205.13147) ——維度階梯的訓練目標。
- [Santhanam et al. (2022). ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction](https://arxiv.org/abs/2112.01488) ——正式環境裡的晚期互動。
- [MTEB leaderboard on Hugging Face](https://huggingface.co/spaces/mteb/leaderboard) ——即時排名。
