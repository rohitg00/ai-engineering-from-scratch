# Thùng từ, TF-IDF và biểu diễn văn bản

> TF-IDF vẫn đánh bại các nhiệm vụ được xác định rõ ràng vào năm 2026.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 02 (Linear Regression from Scratch)
**Time:** ~75 minutes

## Vấn đề

Mô hình cần số, anh có dây.

Mỗi đường ống NLP phải trả lời cùng một câu hỏi. Làm thế nào để biến một dòng token dài biến thành một vector kích thước cố định mà một trình phân loại có thể tiêu thụ. Câu trả lời đầu tiên mà trường đáp lại là câu trả lời ngu ngốc nhất.

Dòng vector đó đã mang lại nhiều NLP sản xuất hơn bất kỳ mô hình nhúng nào. Trình lọc spam, phân loại chủ đề, phát hiện bất thường nhật ký, xếp hạng tìm kiếm (trước BM25), làn sóng đầu tiên của phân tích cảm xúc, thập kỷ đầu tiên của các tiêu chuẩn NLP học thuật. 2026 các học viên vẫn tiếp cận nó trước tiên trong các nhiệm vụ phân loại hẹp. Nó nhanh chóng, có thể giải thích và thường không thể phân biệt với mô hình tích hợp các tham số 400M trong các nhiệm vụ mà sự hiện diện của từ ngữ là điều quan trọng.

Bài học này xây dựng túi từ, sau đó là TF-IDF, từ đầu. sau đó cho thấy scikit-learn làm điều tương tự trong ba dòng. sau đó đặt tên chế độ thất bại khiến bạn tìm kiếm các bản nhúng.

## Khái niệm

**Bag of Words (BoW)**cho mỗi tài liệu, đếm bao nhiêu lần mỗi từ vựng xuất hiện. chiều dài vector là kích thước từ vựng. vị trí `i`là số từ `i`- Tôi không biết.

**TF-IDF**Một từ xuất hiện trong mọi tài liệu là không thông tin, vì vậy hãy giảm nó. Một từ hiếm trên toàn bộ bộ các tập hợp nhưng thường xuyên trong một tài liệu là tín hiệu, vì vậy hãy tăng nó.

```math
\begin{aligned}
\text{TF-IDF}(w, d) &= \text{TF}(w, d) \cdot \text{IDF}(w) \\
&= \frac{\mathop{\mathrm{count}}(w \text{ in } d)}{|d|} \cdot \log\frac{N}{\mathop{\mathrm{df}}(w)}
\end{aligned}
```

Ở đâu `TF`là tần số thuật ngữ trong tài liệu, `df`là tần số tài liệu (nhiều tài liệu bao nhiêu chứa từ),`N`là tổng số tài liệu.`log`giữ trọng lượng giới hạn cho các từ ở khắp mọi nơi.

Cấu trúc: cả hai tạo ra các vector hiếm có với trục giải thích. Bạn có thể xem trọng lượng của một phân loại được đào tạo và đọc những từ đẩy một tài liệu hướng tới mỗi lớp. Bạn không thể làm điều này với một nhúng BERT 768 chiều.

```figure
bow-tfidf
```

## Hãy xây dựng nó

### Bước 1: xây dựng từ vựng

```python
def build_vocab(docs):
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    return vocab
```

Nhập: danh sách các tài liệu được token hóa (bất kỳ token level nào sẽ làm được; `code/main.py`trong bài học này sử dụng một biến thể chữ nhỏ đơn giản).`{word: index}`Thiết lập lệnh nhập ổn định nghĩa là chữ index 0 là từ đầu tiên được nhìn thấy trong tài liệu đầu tiên.

### Bước 2: túi từ

```python
def bag_of_words(docs, vocab):
    matrix = [[0] * len(vocab) for _ in docs]
    for i, doc in enumerate(docs):
        for token in doc:
            if token in vocab:
                matrix[i][vocab[token]] += 1
    return matrix
```

```python
>>> docs = [["cat", "sat", "on", "mat"], ["cat", "cat", "ran"]]
>>> vocab = build_vocab(docs)
>>> bag_of_words(docs, vocab)
[[1, 1, 1, 1, 0], [2, 0, 0, 0, 1]]
```

Các hàng là tài liệu, cột là chỉ số từ vựng.`[i][j]`là "tôi bao nhiêu lần từ `j`xuất hiện trong tài liệu `i`. " Doc 1 đã có `cat`2 lần vì nó đã làm.`ran`không lần vì nó không làm.

### Bước 3: Tần suất thuật ngữ và tần suất tài liệu

```python
import math


def term_frequency(doc_bow, doc_length):
    return [c / doc_length if doc_length else 0 for c in doc_bow]


def document_frequency(bow_matrix):
    df = [0] * len(bow_matrix[0])
    for row in bow_matrix:
        for j, count in enumerate(row):
            if count > 0:
                df[j] += 1
    return df


def inverse_document_frequency(df, n_docs):
    return [math.log((n_docs + 1) / (d + 1)) + 1 for d in df]
```

Hai thủ thuật làm trơn đáng để đặt tên.`(n+1)/(d+1)`tránh `log(x/0)`- Đường sau`+1`đảm bảo một từ trong mỗi tài liệu vẫn có IDF 1 (không phải 0), phù hợp với mặc định của scikit-learn.`log(N/df)`Cả hai đều hoạt động, phiên bản trơn hơn là thân thiện hơn.

### Bước 4: TF-IDF

```python
def tfidf(bow_matrix):
    n_docs = len(bow_matrix)
    df = document_frequency(bow_matrix)
    idf = inverse_document_frequency(df, n_docs)
    out = []
    for row in bow_matrix:
        length = sum(row)
        tf = term_frequency(row, length)
        out.append([tf_j * idf_j for tf_j, idf_j in zip(tf, idf)])
    return out
```

```python
>>> docs = [
...     ["the", "cat", "sat"],
...     ["the", "dog", "sat"],
...     ["the", "cat", "ran"],
... ]
>>> vocab = build_vocab(docs)
>>> bow = bag_of_words(docs, vocab)
>>> tfidf(bow)
```

Ba tài liệu, năm từ ngữ (`the`- `cat`- `sat`- `dog`- `ran` ).`the`xuất hiện trong cả ba, vì vậy IDF của nó là thấp. `dog`với một từ vựng thực sự của hàng ngàn từ, các vector này là hiếm (những mục nhập hầu hết là không). ngay cả trong đồ chơi này, các từ phân biệt đối xử pop.

### Bước 5: L2- bình thường hóa hàng

```python
def l2_normalize(matrix):
    out = []
    for row in matrix:
        norm = math.sqrt(sum(x * x for x in row))
        out.append([x / norm if norm else 0 for x in row])
    return out
```

Nếu không có bình thường hóa, một tài liệu dài hơn sẽ có một vector lớn hơn và thống trị điểm tương đồng. bình thường hóa L2 đặt mọi tài liệu trên siêu cầu đơn vị. Sự tương đồng cosine giữa các hàng bây giờ chỉ là một sản phẩm điểm.

## Sử dụng nó

Scikit-learn sẽ đưa ra phiên bản sản xuất.

```python
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer

docs = ["the cat sat on the mat", "the dog sat on the mat", "the cat ran"]

bow_vectorizer = CountVectorizer()
bow = bow_vectorizer.fit_transform(docs)
print(bow_vectorizer.get_feature_names_out())
print(bow.toarray())

tfidf_vectorizer = TfidfVectorizer()
tfidf = tfidf_vectorizer.fit_transform(docs)
print(tfidf.toarray().round(3))
```

`CountVectorizer`làm tokenization, từ vựng, và BoW trong một cuộc gọi. `TfidfVectorizer`Thêm trọng lượng IDF và bình thường hóa L2. Cả hai đều trả lại các matrix mỏng. Đối với 100k tài liệu, phiên bản dày đặc không phù hợp với bộ nhớ; giữ mỏng cho đến khi phân loại yêu cầu dày đặc.

Những nút mà thay đổi mọi thứ:

| Arg | Effect |
|-----|--------|
| `ngram_range=(1, 2)` | Include bigrams. Usually boosts classification. |
| `min_df=2` | Drop words in fewer than 2 docs. Trims vocabulary on noisy data. |
| `max_df=0.95` | Drop words in more than 95% of docs. Approximates stopword removal without a hardcoded list. |
| `stop_words="english"` | scikit-learn's builtin stopword list. Task-dependent — sentiment analysis should *not* drop negations. |
| `sublinear_tf=True` | Use `1 + log(tf)` instead of raw `tf`. Helps when a term repeats many times in one doc. |

### Khi TF-IDF vẫn thắng (từ 2026)

- Phát hiện spam, đánh dấu chủ đề, đánh dấu bất thường nhật ký.
- Các chế độ dữ liệu thấp (chỉ trăm ví dụ được dán nhãn). TF-IDF cộng với sự lùi hậu cần không có chi phí trước khi đào tạo.
- Bất cứ nơi nào thời gian trễ quan trọng. TF-IDF cộng với mô hình tuyến tính trả lời trong microsecond. Nhập một tài liệu thông qua một biến thể mất 10-100ms.
- Hệ thống phải giải thích dự đoán của họ kiểm tra các hệ số phân loại từ tích cực cao là lý do.

### Khi TF-IDF thất bại

Sự thất bại về mù ngữ học. Hãy xem xét hai tài liệu này:

- "Trong phim không tốt cả".
- "Tác phẩm phim rất tuyệt vời".

Một là một đánh giá tiêu cực, một là tích cực, sự chồng chéo giữa TF và IDF của họ chính xác`{the, movie, was}`Một người phân loại từ phải ghi nhớ từ đó`not`gần `good`Nó có thể học được điều này với đủ dữ liệu, nhưng không bao giờ như một mô hình hiểu tổng hợp.

Sự thất bại khác: từ ngoài từ vựng khi suy luận. Một mô hình BoW được đào tạo trên đánh giá IMDb không biết phải làm gì với `Zoomer-approved`Nếu token đó không xuất hiện trong đào tạo. Subword Embeddings (đọc 04) xử lý điều này. TF-IDF không thể.

### Hybrid: Thiết bị nhúng trọng TF-IDF

Các mặc định thực tế năm 2026 cho phân loại dữ liệu trung bình: sử dụng trọng lượng TF-IDF như sự chú ý hơn so với việc nhúng từ.

```python
def tfidf_weighted_embedding(doc, tfidf_scores, embedding_table, dim):
    vec = [0.0] * dim
    total_weight = 0.0
    for token in doc:
        if token not in embedding_table or token not in tfidf_scores:
            continue
        weight = tfidf_scores[token]
        emb = embedding_table[token]
        for i in range(dim):
            vec[i] += weight * emb[i]
        total_weight += weight
    if total_weight == 0:
        return vec
    return [v / total_weight for v in vec]
```

Bạn có được khả năng ngữ nghĩa từ nhúng, và nhấn mạnh từ hiếm từ từ TF-IDF. Classifier đào tạo trên vector tập hợp. Điều này vượt qua một mình cho tình cảm, chủ đề và định mệnh phân loại dưới khoảng 50k ví dụ được dán nhãn.

## Chuyển nó

Cứ như `outputs/prompt-vectorization-picker.md`- Có thể là:

```markdown
---
name: vectorization-picker
description: Given a text-classification task, recommend BoW, TF-IDF, embeddings, or a hybrid.
phase: 5
lesson: 02
---

You recommend a text-vectorization strategy. Given a task description, output:

1. Representation (BoW, TF-IDF, transformer embeddings, or a hybrid). Explain why in one sentence.
2. Specific vectorizer configuration. Name the library. Quote the arguments (`ngram_range`, `min_df`, `max_df`, `sublinear_tf`, `stop_words`).
3. One failure mode to test before shipping.

Refuse to recommend embeddings when the user has under 500 labeled examples unless they show evidence of semantic failure in a TF-IDF baseline. Refuse to remove stopwords for sentiment analysis (negations carry signal). Flag class imbalance as needing more than a vectorizer change.

Example input: "Classifying 30k customer support tickets into 12 categories. Most tickets are 2-3 sentences. English only. Need explainability for audit logs."

Example output:

- Representation: TF-IDF. 30k examples is not small; explainability requirement rules out dense embeddings.
- Config: `TfidfVectorizer(ngram_range=(1, 2), min_df=3, max_df=0.95, sublinear_tf=True, stop_words=None)`. Keep stopwords because category keywords sometimes are stopwords ("not working" vs "working").
- Failure to test: verify `min_df=3` does not drop rare category keywords. Run `get_feature_names_out` filtered by class and eyeball.
```

## Các bài tập

1. **Easy.**Thực hiện`cosine_similarity(doc_vec_a, doc_vec_b)`trên các output TF-IDF chuẩn hóa L2. Kiểm tra rằng các tài liệu giống hệt có điểm số 1.0 và các tài liệu từ vựng không liên kết có điểm số 0.0.
2. **Medium.**Thêm `n-gram`hỗ trợ`bag_of_words`- Parameter`n`tạo ra số lượng hơn `n`- Thử thử.`n=2``["the", "cat", "sat"]`tạo ra số lượng lớn cho `["the cat", "cat sat"]`- Tôi không biết.
3. **Hard.**Xây dựng bộ lắp ráp hợp chất TF-IDF cân nặng trên bằng cách sử dụng các vector GloVe 100d (tải xuống một lần, cache). So sánh độ chính xác phân loại với TF-IDF đơn giản và các bản lắp ráp trung bình đơn giản trên bộ dữ liệu 20 Newsgroups.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BoW | Word frequency vector | Counts of vocabulary words in one document. Throws away order. |
| TF | Term frequency | Count of a word in a document, optionally normalized by document length. |
| DF | Document frequency | Count of documents containing the word at least once. |
| IDF | Inverse document frequency | `log(N / df)` smoothed. Downweights words that appear everywhere. |
| Sparse vector | Mostly zeros | Vocabulary is typically 10k-100k words; most are absent from any given document. |
| Cosine similarity | Vector angle | Dot product of L2-normalized vectors. 1 is identical, 0 is orthogonal. |

## Đọc thêm

- [scikit-learn — feature extraction from text](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) tham chiếu API theo quy định, cộng với ghi chú trên mỗi nút.
- [Salton, G., & Buckley, C. (1988). Term-weighting approaches in automatic text retrieval](https://www.sciencedirect.com/science/article/pii/0306457388900210) tờ báo đã làm cho TF-IDF trở thành khoản mặc định trong một thập kỷ.
- ["Why TF-IDF Still Beats Embeddings" — Ashfaque Thonikkadavan (Medium)](https://medium.com/@cmtwskb/why-tf-idf-still-beats-embeddings-ad85c123e1b2) 2026 bắt đầu khi phương pháp cũ thắng và tại sao.
