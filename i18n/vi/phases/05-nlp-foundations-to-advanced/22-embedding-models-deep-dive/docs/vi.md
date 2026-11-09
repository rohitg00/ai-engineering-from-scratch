# Đêm vào các mô hình  Thủy sâu năm 2026

> Word2Vec cho bạn một vector cho mỗi từ. Các mô hình nhúng hiện đại cho bạn một vector cho mỗi đoạn, xuyên ngôn ngữ, với tầm nhìn hiếm, dày đặc và đa vector, kích thước phù hợp với chỉ mục của bạn. Chọn sai và RAG của bạn lấy lại sai thứ.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 03 (Word2Vec), Phase 5 · 14 (Information Retrieval)
**Time:** ~60 minutes

## Vấn đề

Hệ thống RAG của bạn lấy lại đoạn đường sai 40% thời gian. người phạm tội hiếm khi là cơ sở dữ liệu vector hoặc prompt. Đó là mô hình nhúng.

Chọn một nhúng vào năm 2026 có nghĩa là chọn qua năm trục:

1. **Dense vs sparse vs multi-vector.**Một vector mỗi đoạn, hoặc một mỗi token, hoặc một túi chữ nặng rác.
2. **Language coverage.**Các mô hình tiếng Anh đơn ngôn ngữ vẫn thắng trong các nhiệm vụ chỉ bằng tiếng Anh.
3. **Context length.**512 token vs 8.192 vs 32.768  và dung lượng hiệu quả thực tế thường là 60-70% của số lượng quảng cáo tối đa.
4. **Dimension budget.**3,072 floats at full precision = 12 KB per vector. ở 100M vector, lưu trữ là $ 1,300 / tháng.
5. **Open vs hosted.**Open-weight có nghĩa là bạn kiểm soát các tập tin và dữ liệu. Hosted có nghĩa là bạn trao đổi kiểm soát cho luôn là mới nhất.

Bài học này chỉ ra tên những sự thỏa hiệp để bạn có thể lấy bằng chứng, không phải những gì phổ biến trong quý trước.

## Khái niệm

![Dense, sparse, and multi-vector embeddings](../assets/embedding-modes.svg)

**Dense embeddings.**Một vector mỗi đoạn (thường là 384-3,072 chiều).`text-embedding-3-large`, BGE-M3 chế độ dày đặc, Voyage-3.

**Sparse embeddings.**SPLADE-style. Một biến thể dự đoán trọng lượng cho mỗi mã từ ngữ, sau đó số không ra hầu hết chúng. Kết quả là một vector nhỏ bé có kích thước .

**Multi-vector (late interaction).**ColBERTv2, Jina-ColBERT. Một vector cho mỗi token. Điểm số với MaxSim: cho mỗi token truy vấn, tìm kiếm token tài liệu tương tự nhất, tổng số điểm. Thắt hơn để lưu trữ và ghi điểm, nhưng thắng trên các truy vấn dài và các tập đoàn cụ thể về miền.

**BGE-M3: all three at once.**Một mô hình đầu ra cùng một lúc đại diện mật, hiếm và đa vector. Mỗi mô hình có thể được truy vấn độc lập; điểm kết hợp thông qua tổng cân.

**Matryoshka Representation Learning.**Được đào tạo để các kích thước N đầu tiên của vector tạo thành một nhúng độc lập hữu ích. Truncate một vector 1.536-dim đến 256 dim và trả cho chính xác ~ 1% để tiết kiệm lưu trữ 6x.

### bảng xếp hạng MTEB kể một câu chuyện một phần

Định hướng tích hợp văn bản lớn 56 nhiệm vụ trên 8 loại nhiệm vụ khi ra mắt (2022), mở rộng lên 100 + nhiệm vụ trong MTEB v2. Vào đầu năm 2026, Gemini Embedding 2 đạt mức độ truy xuất (67.71 MTEB-R). Cohere embed-v4 dẫn đầu chung (65.2 MTEB). BGE-M3 dẫn đầu đa ngôn ngữ trọng lượng mở (63.0). Định hướng bảng xếp hạng là cần thiết nhưng không đủ.

### Mô hình ba cấp

| Use case | Pattern |
|----------|---------|
| Fast first-pass | Dense bi-encoder (BGE-M3, text-3-small) |
| Recall boost | Sparse (SPLADE, BGE-M3 sparse) + RRF fuse |
| Precision on top-50 | Multi-vector (ColBERTv2) or cross-encoder reranker |

Hầu hết các sản phẩm sử dụng cả ba.

```figure
gx-matryoshka
```

## Hãy xây dựng nó

### Bước 1: đường cơ bản  nhúng dày đặc với Sentence-BERT

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

`normalize_embeddings=True`làm cho điểm sản phẩm bằng với cosine tương tự.

### Bước 2: Truncation Matryoshka

```python
def truncate(vectors, dim):
    out = vectors[:, :dim]
    return out / np.linalg.norm(out, axis=1, keepdims=True)

emb_256 = truncate(emb, 256)
emb_128 = truncate(emb, 128)
```

Phân chỉnh lại sau khi cắt. Nomic v1.5, OpenAI text-3, và Voyage-4 được đào tạo để không mất cho vài cấp độ đầu tiên.

### Bước 3: Vận dụng nhiều chức năng của BGE-M3

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

Ba chỉ số, một cuộc gọi suy luận.

```python
dense_score = ... # cosine over dense_vecs
sparse_score = model.compute_lexical_matching_score(q_lex, d_lex)
colbert_score = model.colbert_score(q_col, d_col)
final = 0.4 * dense_score + 0.2 * sparse_score + 0.4 * colbert_score
```

Định trắc trọng lượng trên miền của bạn.

### Bước 4: đánh giá MTEB trên một nhiệm vụ tùy chỉnh

```python
from mteb import MTEB

tasks = ["ArguAna", "SciFact", "NFCorpus"]
evaluation = MTEB(tasks=tasks)
results = evaluation.run(encoder, output_folder="./mteb-results")
```

Tiếp tục chạy các mô hình ứng cử viên của bạn trên một bộ phụ * đại diện *. Đừng tin vào chỉ xếp hạng bảng xếp hạng  lĩnh vực của bạn quan trọng.

### Bước 5: Cozin được xoay bằng tay từ đầu

Nhìn xem`code/main.py`. Phân tích Hashing Trick trung bình (stdlib-chỉ). Không cạnh tranh với các bản nhúng biến thể, nhưng cho thấy hình dạng: token → vector → normalize → dot product.

## Những bẫy

- **Same model for query and doc.**Một số mô hình (Voyage, Jina-ColBERT) sử dụng mã hóa không đối xứng  truy vấn và tài liệu đi qua các con đường khác nhau.
- **Missing prefix.** `bge-*`mô hình cần `"Represent this sentence for searching relevant passages: "`- Đặt khoảng cách nhớ từ 3-5 điểm nếu quên.
- **Over-trimming Matryoshka.**1.536 → 256 thường là an toàn. 1.536 → 64 không.
- **Context truncation.**Hầu hết các mô hình âm thầm cắt giảm đầu vào trên chiều dài tối đa của họ.
- **Ignoring latency tail.**MTEB điểm ẩn độ trễ p99 một mô hình 600M có thể đánh bại một mô hình 335M bằng 2 điểm nhưng chi phí 3x nhiều hơn cho mỗi truy vấn.

## Sử dụng nó

Số 2026:

| Situation | Pick |
|-----------|------|
| English-only, fast, API | `text-embedding-3-large` or `voyage-3-large` |
| Open-weight, English | `BAAI/bge-large-en-v1.5` |
| Open-weight, multilingual | `BAAI/bge-m3` or `Qwen3-Embedding-8B` |
| Long context (32k+) | Voyage-3-large, Cohere embed-v4, Qwen3-Embedding-8B |
| CPU-only deployment | Nomic Embed v2 (137M params, MoE) |
| Storage-constrained | Matryoshka-truncated + int8 quantization |
| Keyword-heavy queries | Add SPLADE sparse, RRF-fuse with dense |

Mô hình 2026: bắt đầu với BGE-M3 hoặc văn bản-3-lớn, đánh giá trên miền của bạn với MTEB, đổi nếu một mô hình cụ thể về miền thắng hơn 3 điểm.

## Chuyển nó

Cứ như `outputs/skill-embedding-picker.md`- Có thể là:

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

## Các bài tập

1. **Easy.**Mã hóa 100 câu với `bge-small-en-v1.5`ở độ tối đầy (384), sau đó ở Matryoshka 128. đo MRR giảm trên 10 truy vấn.
2. **Medium.**So sánh BGE-M3 dày đặc, hiếm và colbert trên 500 đoạn từ miền của bạn.
3. **Hard.**Tiếp tục MTEB trên ba mô hình ứng cử viên trên các nhiệm vụ miền 2 hàng đầu của bạn. báo cáo điểm MTEB, độ trễ p99 trên một loạt 100 truy vấn, và truy vấn $ / 1M. Chọn một Pareto tối ưu.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Dense embedding | The vector | One fixed-size vector per text. Cosine similarity for ranking. |
| Sparse embedding | Learned BM25 | One weight per vocab token; mostly zeros; trained end-to-end. |
| Multi-vector | ColBERT-style | One vector per token; MaxSim scoring; bigger index, better recall. |
| Matryoshka | Russian doll trick | First N dims are a valid smaller embedding on their own. |
| MTEB | The benchmark | Massive Text Embedding Benchmark — 56 tasks at launch, 100+ in v2. |
| BEIR | The retrieval benchmark | 18 zero-shot retrieval tasks; often cited for cross-domain robustness. |
| Asymmetric encoding | Query ≠ doc path | Model uses different projections for queries and documents. |

## Đọc thêm

- [Reimers, Gurevych (2019). Sentence-BERT](https://arxiv.org/abs/1908.10084) giấy có mã hóa hai.
- [Muennighoff et al. (2022). MTEB: Massive Text Embedding Benchmark](https://arxiv.org/abs/2210.07316) giấy bảng xếp hạng.
- [Chen et al. (2024). BGE-M3: Multi-lingual, Multi-functionality, Multi-granularity](https://arxiv.org/abs/2402.03216) mô hình ba chế độ thống nhất.
- [Kusupati et al. (2022). Matryoshka Representation Learning](https://arxiv.org/abs/2205.13147) mục tiêu đào tạo thang chiều kích.
- [Santhanam et al. (2022). ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction](https://arxiv.org/abs/2112.01488) tương tác muộn trong sản xuất.
- [MTEB leaderboard on Hugging Face](https://huggingface.co/spaces/mteb/leaderboard) xếp hạng trực tiếp.
