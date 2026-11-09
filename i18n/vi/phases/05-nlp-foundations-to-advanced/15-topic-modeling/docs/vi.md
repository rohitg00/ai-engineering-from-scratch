# Chủ đề mô hình hóa  LDA và BERTopic

> LDA: tài liệu là hỗn hợp các chủ đề, các chủ đề là phân phối trên các từ. BERTopic: các tập hợp tài liệu trong không gian nhúng, các tập hợp là các chủ đề. Mục tiêu tương tự, phân hủy khác nhau.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 03 (Word2Vec)
**Time:** ~45 minutes

## Vấn đề

Bạn có 10.000 vé hỗ trợ khách hàng, 50.000 bài báo tin tức, hoặc 200.000 tweet. Bạn cần biết bộ sưu tập là gì mà không cần đọc nó. Bạn không có nhãn danh mục. Bạn thậm chí không biết có bao nhiêu danh mục tồn tại.

Mô hình hóa chủ đề trả lời mà không cần giám sát. Hãy đưa cho nó một tập hợp, lấy lại một bộ nhỏ các chủ đề liên kết và, cho mỗi tài liệu, phân phối trên các chủ đề đó.

LDA (2003) xử lý mỗi tài liệu như là một hỗn hợp các chủ đề ẩn và mỗi chủ đề như là một phân phối trên các từ.

BERTopic (2020) mã hóa tài liệu bằng BERT, giảm chiều kích với UMAP, tập hợp với HDBSCAN, và trích xuất từ chủ đề thông qua lớp dựa trên TF-IDF. Nó thắng trên văn bản ngắn, phương tiện truyền thông xã hội và bất cứ thứ gì mà sự tương đồng ngữ nghĩa quan trọng hơn sự chồng chéo từ. Một tài liệu nhận được một chủ đề, đó là một giới hạn cho nội dung dạng dài.

Bài học này xây dựng trực giác cho cả hai và tên cho một người để chọn cho một tập hợp nhất định.

## Khái niệm

![LDA mixture model vs BERTopic clustering](../assets/topic-modeling.svg)

**LDA generative story.**Mỗi chủ đề là một phân phối trên các từ. Mỗi tài liệu là một hỗn hợp của các chủ đề. Để tạo ra một từ trong một tài liệu, lấy mẫu một chủ đề từ hỗn hợp tài liệu, sau đó lấy mẫu một từ từ phân phối của chủ đề đó. Thuyết dẫn ngược điều này: cho các từ được quan sát, suy luận phân phối chủ đề trên mỗi tài liệu và phân phối từ trên mỗi chủ đề.

Khả năng phát LDA chính:

- `doc_topic`: matrix `(n_docs, n_topics)`, mỗi hàng tổng cộng đến 1 (phối hợp chủ đề của tài liệu).
- `topic_word`: matrix `(n_topics, vocab_size)`, mỗi hàng tổng cộng đến 1 (khác định từ của chủ đề).

**BERTopic pipeline.**

1. Mã hóa mỗi tài liệu bằng một bộ biến đổi câu (ví dụ: `all-MiniLM-L6-v2`). 384 chiều vector.
2. Giảm kích thước với UMAP xuống còn ~ 5 kích thước.
3. Cluster với HDBSCAN. dựa trên mật độ, tạo ra các cluster kích thước thay đổi và một nhãn "outlier".
4. Đối với mỗi cluster, tính toán TF-IDF dựa trên lớp trên các tài liệu của cluster để trích xuất các từ hàng đầu.

Output là một chủ đề cho mỗi tài liệu (cộng với một nhãn ngoại lệ -1).

```figure
topic-drift
```

## Hãy xây dựng nó

### Bước 1: LDA thông qua scikit-learn

```python
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.decomposition import LatentDirichletAllocation
import numpy as np


def fit_lda(documents, n_topics=5, max_features=1000):
    cv = CountVectorizer(
        max_features=max_features,
        stop_words="english",
        min_df=2,
        max_df=0.9,
    )
    X = cv.fit_transform(documents)
    lda = LatentDirichletAllocation(
        n_components=n_topics,
        random_state=42,
        max_iter=50,
        learning_method="online",
    )
    doc_topic = lda.fit_transform(X)
    feature_names = cv.get_feature_names_out()
    return lda, cv, doc_topic, feature_names


def print_top_words(lda, feature_names, n_top=10):
    for idx, topic in enumerate(lda.components_):
        top_idx = np.argsort(-topic)[:n_top]
        words = [feature_names[i] for i in top_idx]
        print(f"topic {idx}: {' '.join(words)}")
```

Lưu ý: từ dừng được xóa, min_df và max_df lọc các thuật ngữ hiếm và phổ biến, CountVectorizer (không phải TfidfVectorizer) vì LDA mong đợi số liệu thô.

### Bước 2: BERTopic (sản xuất)

```python
from bertopic import BERTopic

topic_model = BERTopic(
    embedding_model="sentence-transformers/all-MiniLM-L6-v2",
    min_topic_size=15,
    verbose=True,
)

topics, probs = topic_model.fit_transform(documents)
info = topic_model.get_topic_info()
print(info.head(20))
valid_topics = info[info["Topic"] != -1]["Topic"].tolist()
for topic_id in valid_topics[:5]:
    print(f"topic {topic_id}: {topic_model.get_topic(topic_id)[:10]}")
```

Bộ lọc bật `Topic != -1`bỏ các loại tài liệu khác của BERTopic (HQBSCAN không thể tập hợp). `min_topic_size`kiểm soát kích thước cluster tối thiểu của HDBSCAN; thư viện mặc định của BERTopic là 10. ví dụ này đặt nó lên 15 rõ ràng cho quy mô bài học. Đối với các tài liệu trên 10.000, tăng lên 50 hoặc 100.

### Bước 3: đánh giá

Cả hai phương pháp đều tạo ra các từ chủ đề.

- **Topic coherence (c_v).**Kết hợp NPMI ( thông tin tương tác theo hướng điểm chuẩn hóa) của cặp từ hàng đầu trên các bối cảnh cửa sổ trượt, tổng hợp điểm số thành vector chủ đề, và so sánh các vector đó thông qua sự tương đồng cosine. cao hơn là tốt hơn. Sử dụng `gensim.models.CoherenceModel`với `coherence="c_v"`- Tôi không biết.
- **Topic diversity.**Phụ phần các từ độc đáo trên tất cả các từ hàng đầu của các chủ đề.
- **Qualitative inspection.**Hãy đọc những từ đầu của mỗi chủ đề.

## Khi nào để chọn

| Situation | Pick |
|-----------|------|
| Short text (tweets, reviews, headlines) | BERTopic |
| Long documents with topic mixtures | LDA |
| No GPU / limited compute | LDA or NMF |
| Need document-level multi-topic distributions | LDA |
| LLM integration for topic labeling | BERTopic (direct support) |
| Resource-constrained edge deployment | LDA |
| Max semantic coherence | BERTopic |

Các tính toán thực tế lớn nhất là chiều dài tài liệu. BERT nhúng cắt giảm; LDA đếm làm việc trên bất kỳ chiều dài nào. Đối với các tài liệu dài hơn bối cảnh của mô hình nhúng, hoặc chunk + tổng hợp hoặc sử dụng LDA.

## Sử dụng nó

Số 2026:

- **BERTopic.**Tiểu định cho văn bản ngắn và bất cứ thứ gì mà ngữ nghĩa quan trọng.
- **`gensim.models.LdaModel`.**LDA cổ điển cho sản xuất, trưởng thành, được thử nghiệm trong trận chiến.
- **`sklearn.decomposition.LatentDirichletAllocation`.**LDA dễ dàng cho thí nghiệm.
- **NMF.**Không tính toán tử liệu âm tính. thay thế nhanh cho LDA, chất lượng tương đương trên văn bản ngắn.
- **Top2Vec.**Thiết kế tương tự như BERTopic. Cộng đồng nhỏ hơn nhưng tốt về một số điểm chuẩn.
- **FASTopic.**Tới hơn, nhanh hơn BERTopic trên các cơ quan rất lớn.
- **LLM-based labeling.**Thực hiện bất kỳ cluster nào, sau đó yêu cầu một mô hình để đặt tên cho mỗi cluster.

## Chuyển nó

Cứ như `outputs/skill-topic-picker.md`- Có thể là:

```markdown
---
name: topic-picker
description: Pick LDA or BERTopic for a corpus. Specify library, knobs, evaluation.
version: 1.0.0
phase: 5
lesson: 15
tags: [nlp, topic-modeling]
---

Given a corpus description (document count, avg length, domain, language, compute budget), output:

1. Algorithm. LDA / NMF / BERTopic / Top2Vec / FASTopic. One-sentence reason.
2. Configuration. Number of topics: `recommended = max(5, round(sqrt(n_docs)))`, clamped to 200 for corpora under 40,000 docs; permit >200 only when the corpus is genuinely large (>40k) and note the increased compute cost. `min_df` / `max_df` filters and embedding model for neural approaches also belong here.
3. Evaluation. Topic coherence (c_v) via `gensim.models.CoherenceModel`, topic diversity, and a 20-sample human read.
4. Failure mode to probe. For LDA, "junk topics" absorbing stopwords and frequent terms. For BERTopic, the -1 outlier cluster swallowing ambiguous documents.

Refuse BERTopic on documents longer than the embedding model's context window without a chunking strategy. Refuse LDA on very short text (tweets, reviews under 10 tokens) as coherence collapses. Flag any n_topics choice below 5 as likely wrong; flag >200 on corpora under 40k docs as likely over-splitting.
```

## Các bài tập

1. **Easy.**LDA phù hợp với 5 chủ đề trên bộ dữ liệu 20 Newsgroups. In 10 từ hàng đầu cho mỗi chủ đề. Đánh dấu mỗi chủ đề bằng tay. Algoritm đã tìm thấy các loại thực sự?
2. **Medium.**Đáp BERTopic trên cùng 20 Newsgroups. So sánh số lượng các chủ đề được tìm thấy, từ hàng đầu và tính kết hợp chất lượng so với LDA.
3. **Hard.**Xét tính độ liên kết c_v cho cả LDA và BERTopic trên cơ sở của bạn. Đi kèm với 5, 10, 20, 50 chủ đề.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Topic | A thing the corpus is about | A probability distribution over words (LDA) or a cluster of similar documents (BERTopic). |
| Mixed membership | Doc is multiple topics | LDA assigns each document a distribution over all topics. |
| UMAP | Dimensionality reduction | Manifold learning that preserves local structure; used in BERTopic. |
| HDBSCAN | Density clustering | Finds variable-size clusters; produces "noise" label (-1) for outliers. |
| c_v coherence | Topic quality metric | NPMI of top topic words over sliding windows, turned into context vectors and compared with cosine similarity. |

## Đọc thêm

- [Blei, Ng, Jordan (2003). Latent Dirichlet Allocation](https://www.jmlr.org/papers/volume3/blei03a/blei03a.pdf) báo LDA.
- [Grootendorst (2022). BERTopic: Neural topic modeling with a class-based TF-IDF procedure](https://arxiv.org/abs/2203.05794) Báo chí BERTopic.
- [Röder, Both, Hinneburg (2015). Exploring the Space of Topic Coherence Measures](https://svn.aksw.org/papers/2015/WSDM_Topic_Evaluation/public.pdf) tờ báo giới thiệu c_v và bạn bè.
- [BERTopic documentation](https://maartengr.github.io/BERTopic/) tài liệu tham khảo sản xuất.
