# Tìm kiếm và tìm kiếm thông tin

> BM25 chính xác nhưng hỏng. Thiết bị dày đặc ném một mạng lưới rộng nhưng bỏ lỡ từ khóa. Hybrid là mặc định 2026. Mọi thứ khác đều được điều chỉnh.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 04 (GloVe, FastText, Subword)
**Time:** ~75 minutes

## Vấn đề

Người dùng gõ "điều xảy ra nếu ai đó nói dối để kiếm tiền" và hy vọng sẽ tìm ra quy định thực sự bao gồm điều đó: "Gụ 420 IPC". Một tìm kiếm từ khóa bỏ qua hoàn toàn (không có từ vựng được chia sẻ).

IR là đường ống dưới mỗi hệ thống RAG, mỗi thanh tìm kiếm, tìm kiếm mờ của mỗi trang web tài liệu. Kiến trúc 2026 hoạt động trong sản xuất không phải là một phương pháp duy nhất.

Bài học này xây dựng từng mảnh và tên mà thất bại mỗi bắt.

## Khái niệm

![Hybrid retrieval: BM25 + dense + RRF + cross-encoder rerank](../assets/retrieval.svg)

Bốn lớp, chọn những lớp mà anh cần.

1. **Sparse retrieval (BM25).**Nhanh chóng, chính xác trong sự phù hợp chính xác, khủng khiếp trong ngữ nghĩa chạy qua một chỉ số đảo ngược Sub-10ms mỗi truy vấn trên hàng triệu tài liệu có bạn tham chiếu quy định, mã sản phẩm, thông điệp lỗi, tên thực thể đúng.
2. **Dense retrieval.**Mã hóa truy vấn và tài liệu thành vector. Tìm kiếm hàng xóm gần nhất. Chụp các cụm từ và sự tương đồng ngữ nghĩa. Chưa có sự phù hợp chính xác từ khóa khác nhau bằng một ký tự. 50-200ms cho mỗi truy vấn với FAISS hoặc một vector DB.
3. **Fusion.**Thủy lại danh sách xếp hạng từ hiếm và dày đặc. Phối hợp xếp hạng tương đối (RRF) là mặc định dễ dàng vì nó bỏ qua điểm số thô (có sống trong các cân bằng khác nhau) và chỉ sử dụng các vị trí xếp hạng. Phối hợp trọng lượng là một lựa chọn khi bạn biết một tín hiệu thống trị cho miền của bạn.
4. **Cross-encoder rerank.**Hãy lấy top-30 từ fusion. chạy một cross-encoder (query + document cùng nhau, ghi điểm mỗi cặp). Giữ top-5. Cross-encoder chậm hơn mỗi cặp so với bi-encoder nhưng chính xác hơn nhiều. Bạn giảm giá bằng cách chỉ chạy chúng trên top-30.

Việc lấy lại ba chiều (BM25 + dày + học-sparse như SPLADE) vượt qua hai chiều trong các chỉ số chuẩn năm 2026 nhưng cần cơ sở hạ tầng cho các chỉ số học-sparse. Đối với hầu hết các đội, xếp hạng lại hai chiều cộng với mã hóa chéo là điểm tốt nhất.

```figure
gx-hybrid-retrieval
```

## Hãy xây dựng nó

### Bước 1: BM25 từ đầu

```python
import math
import re
from collections import Counter

TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(text):
    return TOKEN_RE.findall(text.lower())


class BM25:
    def __init__(self, corpus, k1=1.5, b=0.75):
        if not corpus:
            raise ValueError("corpus must not be empty")
        self.corpus = [tokenize(d) for d in corpus]
        self.k1 = k1
        self.b = b
        self.n_docs = len(self.corpus)
        self.avg_dl = sum(len(d) for d in self.corpus) / self.n_docs
        self.df = Counter()
        for doc in self.corpus:
            for term in set(doc):
                self.df[term] += 1

    def idf(self, term):
        n = self.df.get(term, 0)
        return math.log(1 + (self.n_docs - n + 0.5) / (n + 0.5))

    def score(self, query, doc_idx):
        q_tokens = tokenize(query)
        doc = self.corpus[doc_idx]
        dl = len(doc)
        freq = Counter(doc)
        score = 0.0
        for term in q_tokens:
            f = freq.get(term, 0)
            if f == 0:
                continue
            numerator = f * (self.k1 + 1)
            denominator = f + self.k1 * (1 - self.b + self.b * dl / self.avg_dl)
            score += self.idf(term) * numerator / denominator
        return score

    def rank(self, query, top_k=10):
        scored = [(self.score(query, i), i) for i in range(self.n_docs)]
        scored.sort(reverse=True)
        return scored[:top_k]
```

Hai tham số đáng biết.`k1=1.5`điều khiển độ bão hòa tần số thuật ngữ; cao hơn có nghĩa là trọng lượng nhiều hơn khi lặp lại thuật ngữ. `b=0.75`Điều khiển bình thường hóa chiều dài; 0 bỏ qua chiều dài tài liệu, 1 bình thường hóa hoàn toàn.

### Bước 2: lấy lại dày đặc với một bộ mã hóa đôi

```python
from sentence_transformers import SentenceTransformer
import numpy as np


def build_dense_index(corpus, model_id="sentence-transformers/all-MiniLM-L6-v2"):
    encoder = SentenceTransformer(model_id)
    embeddings = encoder.encode(corpus, normalize_embeddings=True)
    return encoder, embeddings


def dense_search(encoder, embeddings, query, top_k=10):
    q_emb = encoder.encode([query], normalize_embeddings=True)
    sims = (embeddings @ q_emb.T).flatten()
    order = np.argsort(-sims)[:top_k]
    return [(float(sims[i]), int(i)) for i in order]
```

L2- bình thường hóa các nhúng nhúng vì vậy điểm sản phẩm bằng cosine. `all-MiniLM-L6-v2`là 384 chiều, nhanh, và đủ mạnh để lấy lại tiếng Anh.`paraphrase-multilingual-MiniLM-L12-v2`Để có độ chính xác cao nhất,`bge-large-en-v1.5`hoặc `e5-large-v2`- Tôi không biết.

### Bước 3: Sự hợp nhất cấp bậc

```python
def reciprocal_rank_fusion(rankings, k=60):
    scores = {}
    for ranking in rankings:
        for rank, (_, doc_idx) in enumerate(ranking):
            scores[doc_idx] = scores.get(doc_idx, 0.0) + 1.0 / (k + rank + 1)
    fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [(score, doc_idx) for doc_idx, score in fused]
```

- `k=60`liên tục đến từ giấy RRF gốc.`k`làm phẳng hơn sự đóng góp của sự khác biệt cấp bậc; thấp hơn `k`60 là tiêu chuẩn mặc định được xuất bản và hiếm khi cần điều chỉnh.

### Bước 4: Tìm kiếm lai + xếp hạng lại

```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")


def hybrid_search(query, bm25, encoder, dense_embeddings, corpus, top_k=5, pool_size=30, reranker=reranker):
    sparse_ranking = bm25.rank(query, top_k=pool_size)
    dense_ranking = dense_search(encoder, dense_embeddings, query, top_k=pool_size)
    fused = reciprocal_rank_fusion([sparse_ranking, dense_ranking])[:pool_size]

    pairs = [(query, corpus[doc_idx]) for _, doc_idx in fused]
    scores = reranker.predict(pairs)
    reranked = sorted(zip(scores, [doc_idx for _, doc_idx in fused]), reverse=True)
    return reranked[:top_k]
```

BM25 tìm thấy sự phù hợp từ điển. Thiết bị mật độ tìm thấy sự phù hợp ngữ nghĩa. RRF hợp nhất hai thứ hạng mà không cần phải chuẩn lập điểm số. Cross-encoder ghi lại top-30 bằng cách sử dụng cặp truy vấn-tài liệu cùng nhau, thu thập sự liên quan tinh tế của các bi-encoder bị bỏ lỡ. Giữ top-5.

### Bước 5: đánh giá

| Metric | Meaning |
|--------|---------|
| Recall@k | Of queries where the correct document exists, how often is it in the top-k? |
| MRR (Mean Reciprocal Rank) | Average of 1/rank of first relevant document. |
| nDCG@k | Accounts for relevance gradations, not just binary relevant/not. |

Đặc biệt là cho RAG,**Recall@k**của bộ truy cập là số quan trọng nhất. Người đọc của bạn không thể trả lời nếu đoạn văn đúng không trong bộ truy cập.

Mẹo gỡ lỗi: cho các truy vấn thất bại, phân biệt các thứ hạng hiếm và dày đặc. Nếu một tìm thấy tài liệu đúng và người khác không tìm thấy, bạn có một sự không phù hợp từ vựng (sửa: thêm nửa thiếu) hoặc sự mơ hồ ngữ nghĩa (sửa: nhúng tốt hơn hoặc một trình xếp hạng lại).

## Sử dụng nó

Số 2026:

| Scale | Stack |
|-------|-------|
| 1k-100k docs | In-memory BM25 + `all-MiniLM-L6-v2` embeddings + RRF. No separate DB. |
| 100k-10M docs | FAISS or pgvector for dense + Elasticsearch / OpenSearch for BM25. Run in parallel. |
| 10M+ docs | Qdrant / Weaviate / Vespa / Milvus with hybrid support. Cross-encoder rerank on top-30. |
| Best-quality frontier | Three-way (BM25 + dense + SPLADE) + ColBERT late-interaction reranking |

Bất cứ điều gì bạn chọn, ngân sách để đánh giá. Nhận lại điểm chuẩn trước khi đánh giá chính xác RAG đầu đến cuối. Một người đọc không thể sửa chữa những gì người tìm lại đã bỏ lỡ.

### Những bài học khó khăn từ sản xuất RAG năm 2026

- **80% of RAG failures trace to ingestion and chunking, not the model.**Các nhóm dành hàng tuần để trao đổi LLM và điều chỉnh các yêu cầu trong khi việc tìm lại lặng lặng trả lại bối cảnh sai lầm mỗi truy vấn thứ ba.
- **Chunking strategy matters more than chunk size.**Các phân chia kích thước cố định phá vỡ các bảng, mã và tiêu đề tổ hợp. Tiếng nói nhận thức là mặc định; phân tích dựa trên ngữ nghĩa hoặc LLM trả tiền cho các tài liệu kỹ thuật và hướng dẫn sản phẩm.
- **Parent-doc pattern.**Nhận lại các mảnh nhỏ "child" để chính xác. Khi nhiều trẻ em từ cùng một phần cha mẹ xuất hiện, hãy thay đổi trong khối cha mẹ để giữ được ngữ cảnh. Điều này liên tục nâng cao chất lượng trả lời mà không cần đào tạo lại.
- **k_rerank=3 is usually optimal.**Mỗi phần thêm vào trong quá khứ mà thêm chi phí token và thời gian trễ tạo mà không nâng cao chất lượng trả lời. Nếu k=8 vẫn tốt hơn k=3 cho bạn, reanker đang hoạt động kém.
- **HyDE / query expansion.**Tạo ra một câu trả lời giả thuyết từ câu hỏi, nhúng vào đó, lấy lại. Cắt cầu khoảng cách cụm từ giữa câu hỏi ngắn và tài liệu dài.
- **Context budget under 8K tokens.**Những cú đánh liên tục ở giới hạn đó có nghĩa là ngưỡng tái xếp hạng quá lỏng lẻo.
- **Version everything.**Các yêu cầu, quy tắc chia nhỏ, mô hình nhúng, xếp hạng lại. Bất kỳ sự lở hở nào lặng lẽ phá vỡ chất lượng câu trả lời. Cổng CI về độ trung thành, độ chính xác ngữ cảnh và tỷ lệ câu hỏi không trả lời chặn sự lùi lại trước khi người dùng nhìn thấy chúng.
- **Three-way retrieval (BM25 + dense + learned-sparse like SPLADE) outperforms two-way**trên các tiêu chuẩn 2026 đặc biệt là cho các truy vấn trộn các từ chính xác với ngữ nghĩa.

Thiết kế thu hồi đúng cách làm giảm ảo giác 70-90% theo các phép đo ngành công nghiệp năm 2026. Hầu hết các lợi ích hiệu suất RAG đến từ việc thu hồi tốt hơn, chứ không phải điều chỉnh mô hình.

## Chuyển nó

Cứ như `outputs/skill-retrieval-picker.md`- Có thể là:

```markdown
---
name: retrieval-picker
description: Pick a retrieval stack for a given corpus and query pattern.
version: 1.0.0
phase: 5
lesson: 14
tags: [nlp, retrieval, rag, search]
---

Given requirements (corpus size, query pattern, latency budget, quality bar, infra constraints), output:

1. Stack. BM25 only, dense only, hybrid (BM25 + dense + RRF), hybrid + cross-encoder rerank, or three-way (BM25 + dense + learned-sparse).
2. Dense encoder. Name the specific model. Match to language(s), domain, and context length.
3. Reranker. Name the specific cross-encoder model if used. Flag that rerank adds 30-100ms latency on top-30.
4. Evaluation plan. Recall@10 is the primary retriever metric. MRR for multi-answer. Baseline first, incremental improvements measured against it.

Refuse to recommend dense-only for corpora with named entities, error codes, or product SKUs unless the user has evidence dense handles exact matches. Refuse to skip reranking for high-stakes retrieval (legal, medical) where the final top-5 decides the user's answer.
```

## Các bài tập

1. **Easy.**Thực hiện`hybrid_search`trên một tập hợp 500 tài liệu. kiểm tra 20 câu hỏi. So sánh nhớ ở 5 giữa chỉ BM25, chỉ mật, và lai.
2. **Medium.**Thêm tính toán MRR. Đối với mỗi truy vấn thử nghiệm với tài liệu chính xác được biết, tìm xếp hạng tài liệu chính xác trong xếp hạng BM25, mật và lai.
3. **Hard.**Định chỉnh một bộ mã hóa dày đặc trên miền của bạn bằng cách sử dụng MultipleNegativesRankingLoss (Sentence Transformers). Xây dựng một bộ đào tạo từ 500 cặp truy vấn-tài liệu. So sánh pre- và post-fine-tune recall.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BM25 | Keyword search | Okapi BM25. Scores documents by term frequency, IDF, and length. |
| Dense retrieval | Vector search | Encode query + doc into vectors, find nearest neighbors. |
| Bi-encoder | Embedding model | Encodes query and doc independently. Fast at query time. |
| Cross-encoder | Reranker model | Encodes query + doc together. Slow but accurate. |
| RRF | Rank fusion | Combine two rankings by summing `1/(k + rank)`. |
| Recall@k | Retrieval metric | Fraction of queries where a relevant doc is in the top-k. |

## Đọc thêm

- [Robertson and Zaragoza (2009). The Probabilistic Relevance Framework: BM25 and Beyond](https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf) điều trị BM25 cuối cùng.
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) DPR, bộ mã hóa hai chữ theo luật.
- [Formal et al. (2021). SPLADE: Sparse Lexical and Expansion Model](https://arxiv.org/abs/2107.05720) máy thu hồi nhỏ gọn học tập đóng lại khoảng cách bằng dense.
- [Cormack, Clarke, Büttcher (2009). Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf) Bảng giấy RRF.
- [Khattab and Zaharia (2020). ColBERT: Efficient and Effective Passage Search](https://arxiv.org/abs/2004.12832) Khôi phục tương tác muộn.
