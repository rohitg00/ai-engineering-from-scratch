# 埋め込みモデル — 2026 年版ディープダイブ

> Word2Vec は単語ごとにベクトルを与えました。現代の埋め込みモデルは、パッセージごとに、言語横断で、sparse / dense / multi-vector の見方を持ち、インデックスに収まるサイズのベクトルを与えます。選び方を間違えると、RAG は間違ったものを検索します。

**種別:** 学習
**言語:** Python
**前提条件:** Phase 5 · 03 (Word2Vec), Phase 5 · 14 (Information Retrieval)
**所要時間:** 約60分

## 問題

あなたの RAG システムは 40% の確率で間違ったパッセージを検索しています。原因は、vector database や prompt であることはめったにありません。embedding model です。

2026 年に embedding を選ぶということは、5 つの軸で選択するということです。

1. **Dense vs sparse vs multi-vector。** パッセージごとに 1 ベクトルか、トークンごとに 1 ベクトルか、重み付き bag of words の sparse 表現か。
2. **言語カバレッジ。** 英語のみのタスクでは、今でも単一英語モデルが勝ちます。コーパスが混在する場合は多言語モデルが勝ちます。
3. **コンテキスト長。** 512 tokens vs 8,192 vs 32,768。実効容量は、公称最大値の 60-70% にとどまることも多いです。
4. **次元予算。** full precision の 3,072 floats = ベクトル 1 本あたり 12 KB。1 億ベクトルならストレージは月額 $1,300。Matryoshka truncation はこれを 4× 削減します。
5. **Open vs hosted。** open-weight はスタックとデータを自分で制御できるということです。hosted は、常に最新版を使う代わりに制御を手放すということです。

このレッスンでは、直近の流行ではなく根拠に基づいて選べるよう、トレードオフに名前をつけます。

## 概念

![Dense, sparse, and multi-vector embeddings](../assets/embedding-modes.svg)

**Dense embeddings。** パッセージごとに 1 ベクトル (通常 384-3,072 次元)。Cosine similarity が意味的な近さでパッセージをランクづけします。OpenAI `text-embedding-3-large`、BGE-M3 dense mode、Voyage-3。デフォルトの選択肢です。

**Sparse embeddings。** SPLADE 方式です。transformer が vocab token ごとに重みを予測し、その大半をゼロにします。結果はサイズ |vocab| の sparse vector です。BM25 のような語彙一致を捉えますが、語の重みは学習されています。キーワードの多いクエリに強いです。

**Multi-vector (late interaction)。** ColBERTv2、Jina-ColBERT。トークンごとに 1 ベクトル。MaxSim でスコアリングします。各 query token について最も類似した document token を見つけ、そのスコアを合計します。保存とスコアリングは高コストですが、長いクエリやドメイン特化コーパスで勝ちます。

**BGE-M3: 3 つすべてを同時に。** 1 つのモデルが dense、sparse、multi-vector 表現を同時に出力します。それぞれ個別に検索でき、スコアは weighted sum で融合します。1 つの checkpoint から柔軟性が欲しいときの 2026 年のデフォルトです。

**Matryoshka Representation Learning。** ベクトルの先頭 N 次元だけで有用な単独 embedding になるよう訓練されています。1,536 次元ベクトルを 256 次元に切り詰めると、約 1% の精度低下でストレージを 6× 節約できます。OpenAI text-3、Cohere v4、Voyage-4、Jina v5、Gemini Embedding 2、Nomic v1.5+ が対応しています。

### MTEB leaderboard が語るのは一部だけ

Massive Text Embedding Benchmark は、公開時 (2022) に 8 タスクタイプ 56 タスクで構成され、MTEB v2 では 100+ タスクに拡張されました。2026 年初頭には、Gemini Embedding 2 が retrieval で首位 (67.71 MTEB-R)、Cohere embed-v4 が general で首位 (65.2 MTEB)、BGE-M3 が open-weight multilingual で首位 (63.0) です。leaderboard は必要ですが十分ではありません。必ず自分のドメインで benchmark してください。

### 3 層パターン

| ユースケース | パターン |
|----------|---------|
| 高速な first-pass | Dense bi-encoder (BGE-M3, text-3-small) |
| recall の底上げ | Sparse (SPLADE, BGE-M3 sparse) + RRF fuse |
| top-50 上の precision | Multi-vector (ColBERTv2) または cross-encoder reranker |

多くの本番スタックはこの 3 つをすべて使います。

## 作ってみる

### Step 1: baseline — Sentence-BERT による dense embeddings

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

`normalize_embeddings=True` にすると dot product が cosine similarity と等しくなります。必ず設定してください。

### Step 2: Matryoshka truncation

```python
def truncate(vectors, dim):
    out = vectors[:, :dim]
    return out / np.linalg.norm(out, axis=1, keepdims=True)

emb_256 = truncate(emb, 256)
emb_128 = truncate(emb, 128)
```

切り詰めた後は再度 normalize してください。Nomic v1.5、OpenAI text-3、Voyage-4 は、先頭のいくつかのレベルではこの処理がほぼ lossless になるよう訓練されています。非 Matryoshka モデル (元の Sentence-BERT など) は、切り詰めると急激に劣化します。

### Step 3: BGE-M3 の多機能性

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

3 つの index を 1 回の inference call で作れます。スコア融合:

```python
dense_score = ... # cosine over dense_vecs
sparse_score = model.compute_lexical_matching_score(q_lex, d_lex)
colbert_score = model.colbert_score(q_col, d_col)
final = 0.4 * dense_score + 0.2 * sparse_score + 0.4 * colbert_score
```

重みは自分のドメインでチューニングしてください。

### Step 4: custom task での MTEB eval

```python
from mteb import MTEB

tasks = ["ArguAna", "SciFact", "NFCorpus"]
evaluation = MTEB(tasks=tasks)
results = evaluation.run(encoder, output_folder="./mteb-results")
```

候補モデルを *代表的な* サブセットで実行します。leaderboard rank だけを信用してはいけません。自分のドメインが重要です。

### Step 5: ゼロから手作りする cosine

`code/main.py` を参照してください。平均化した Hashing Trick embeddings (stdlib のみ) です。transformer embeddings には到底及びませんが、tokenize → vector → normalize → dot product という形を示しています。

## 落とし穴

- **query と doc で同じモデル。** 一部のモデル (Voyage, Jina-ColBERT) は非対称エンコーディングを使います。query と document が別経路を通ります。必ず model card を確認してください。
- **prefix の付け忘れ。** `bge-*` モデルでは、query に `"Represent this sentence for searching relevant passages: "` を前置する必要があります。忘れると recall が 3-5 ポイント落ちます。
- **Matryoshka の切り詰めすぎ。** 1,536 → 256 はたいてい安全です。1,536 → 64 は安全ではありません。eval set で検証してください。
- **コンテキスト切り捨て。** ほとんどのモデルは最大長を超えた入力を静かに切り捨てます。長い文書には chunking が必要です (lesson 23 参照)。
- **latency tail の無視。** MTEB スコアは p99 latency を隠します。600M モデルが 335M モデルを 2 ポイント上回っても、query あたりのコストが 3× になるかもしれません。

## 使う

2026 年のスタック:

| 状況 | 選択 |
|-----------|------|
| 英語のみ、高速、API | `text-embedding-3-large` または `voyage-3-large` |
| Open-weight、英語 | `BAAI/bge-large-en-v1.5` |
| Open-weight、多言語 | `BAAI/bge-m3` または `Qwen3-Embedding-8B` |
| 長いコンテキスト (32k+) | Voyage-3-large, Cohere embed-v4, Qwen3-Embedding-8B |
| CPU のみのデプロイ | Nomic Embed v2 (137M params, MoE) |
| ストレージ制約あり | Matryoshka-truncated + int8 quantization |
| キーワードの多いクエリ | SPLADE sparse を追加し、dense と RRF-fuse |

2026 年のパターン: BGE-M3 または text-3-large から始め、自分のドメインで MTEB を使って評価し、ドメイン特化モデルが 3 ポイント超の差で勝つなら置き換えます。

## 出荷する

`outputs/skill-embedding-picker.md` として保存:

```markdown
---
name: embedding-picker
description: 与えられたコーパスとデプロイ条件に対して、embedding model、次元、retrieval mode を選ぶ。
version: 1.0.0
phase: 5
lesson: 22
tags: [nlp, embeddings, retrieval]
---

コーパス（サイズ、言語、ドメイン、平均長）、デプロイ先（cloud / edge / on-prem）、latency budget、storage budget が与えられたら、次を出力してください。

1. モデル。名前つき checkpoint または API。1 文の理由。
2. 次元。Full / Matryoshka-truncated / int8-quantized。ストレージ予算に結びついた理由。
3. モード。Dense / sparse / multi-vector / hybrid。理由。
4. model card で必要とされる場合の query prefix / template。
5. 評価計画。ドメインに関連する MTEB tasks + nDCG@10 を使ったホールドアウトの domain eval。

ドメイン検証なしに Matryoshka を <64 dims へ切り詰める推奨は拒否する。10k passages 未満のコーパスに ColBERTv2 を推奨することは拒否する (overhead に見合わない)。長文コーパス (>8k tokens) が 512-token windows のモデルに送られている場合は警告する。
```

## 演習

1. **Easy.** `bge-small-en-v1.5` で 100 文を full dim (384) と Matryoshka 128 で encode してください。10 queries での MRR 低下を測ります。
2. **Medium.** 自分のドメインから 500 passages を取り、BGE-M3 の dense、sparse、colbert を比較してください。recall@10 でどれが勝ちますか。RRF fusion は最良の単一 mode を上回りますか。
3. **Hard.** 上位 2 つのドメインタスクで、3 つの候補モデルを MTEB で実行してください。MTEB score、100-query batch での p99 latency、$/1M queries を報告します。Pareto-optimal なものを選んでください。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| Dense embedding | ベクトル | テキストごとに固定サイズベクトル 1 本。ランキングには cosine similarity を使う。 |
| Sparse embedding | 学習済み BM25 | vocab token ごとに 1 重み。ほとんどはゼロ。end-to-end で訓練される。 |
| Multi-vector | ColBERT 方式 | トークンごとに 1 ベクトル。MaxSim scoring。index は大きくなるが recall は上がる。 |
| Matryoshka | ロシア人形トリック | 先頭 N dims だけで、有効な小型 embedding として単独で使える。 |
| MTEB | ベンチマーク | Massive Text Embedding Benchmark。公開時は 56 tasks、v2 では 100+。 |
| BEIR | 検索ベンチマーク | 18 の zero-shot retrieval tasks。cross-domain robustness の文脈でよく引用される。 |
| Asymmetric encoding | Query ≠ doc path | モデルが queries と documents に異なる projections を使う。 |

## 参考文献

- [Reimers, Gurevych (2019). Sentence-BERT](https://arxiv.org/abs/1908.10084) — bi-encoder 論文。
- [Muennighoff et al. (2022). MTEB: Massive Text Embedding Benchmark](https://arxiv.org/abs/2210.07316) — leaderboard 論文。
- [Chen et al. (2024). BGE-M3: Multi-lingual, Multi-functionality, Multi-granularity](https://arxiv.org/abs/2402.03216) — 3 mode 統合モデル。
- [Kusupati et al. (2022). Matryoshka Representation Learning](https://arxiv.org/abs/2205.13147) — 次元ラダー訓練目標。
- [Santhanam et al. (2022). ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction](https://arxiv.org/abs/2112.01488) — 本番における late interaction。
- [MTEB leaderboard on Hugging Face](https://huggingface.co/spaces/mteb/leaderboard) — ライブランキング。
