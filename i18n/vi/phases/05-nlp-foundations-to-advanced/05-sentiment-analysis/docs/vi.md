# Phân tích cảm xúc

> Nhiệm vụ NLP theo quy luật. Hầu hết những gì bạn cần biết về phân loại văn bản cổ điển được hiển thị ở đây.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 2 · 14 (Naive Bayes)
**Time:** ~75 minutes

## Vấn đề

"Món ăn không ngon lắm". Tốt hay xấu?

Một nhà phê bình nói rằng họ thích hoặc không thích một thứ gì đó. Đánh dấu câu. Lý do nó trở thành nhiệm vụ NLP công giáo là mỗi trường hợp dễ nhìn ẩn một trường hợp khó khăn. Phản ứng đảo chiều ý nghĩa. Sự khinh bỉ đảo ngược nó. "Không tệ chút nào" là tích cực mặc dù hai từ có mã âm. Emoji mang theo nhiều tín hiệu hơn văn bản xung quanh.`tight`trong bài đánh giá âm nhạc`tight`trong cuộc xem xét thời trang).

Sentiment là một phòng thí nghiệm làm việc cho NLP cổ điển. Nếu bạn hiểu tại sao mỗi dòng cơ sở ngây thơ có một chế độ thất bại cụ thể, bạn sẽ hiểu tại sao mọi mô hình giàu có hơn đã được phát minh ra. Bài học này xây dựng một dòng cơ sở Bayes ngây thơ từ đầu, thêm sự lùi lại hậu cần, và đặt tên những cái bẫy làm cho tình cảm sản xuất trở thành vấn đề cấp độ tuân thủ.

## Khái niệm

Tâm lý cổ điển là một công thức hai bước.

1. **Represent.**Chuyển văn bản thành một vector tính năng.
2. **Classify.**Đưa ra một mô hình tuyến tính (Naive Bayes, sự lùi hậu cần, SVM) trên các ví dụ được dán nhãn.

Bayes ngây thơ là mô hình ngu ngốc nhất có thể làm việc.`P(word | positive)`và `P(word | negative)`Trong khi đó, các phương pháp phân loại có thể được sử dụng để phân tích các tính năng của các chữ cái.

Sự lùi hậu cần sửa chữa giả định độc lập. Nó học được trọng lượng cho mỗi tính năng, bao gồm cả trọng lượng âm. `not good`Bayes ngây thơ không thể làm điều đó cho các hình ảnh mà nó chưa bao giờ dán nhãn.

```figure
sentiment-logits
```

## Hãy xây dựng nó

### Bước 1: một bộ dữ liệu mini thực sự

```python
POSITIVE = [
    "absolutely loved this movie",
    "beautiful cinematography and a great story",
    "one of the best films of the year",
    "brilliant acting from the lead",
    "heartwarming and funny",
]

NEGATIVE = [
    "boring and far too long",
    "not worth your time",
    "the plot made no sense",
    "terrible acting, awful script",
    "i want my two hours back",
]
```

Công việc thực sự sử dụng hàng chục ngàn ví dụ (IMDb, SST-2, độ cực của Yelp).

### Bước 2: Bayes đa số ngây thơ từ đầu

```python
import math
from collections import Counter


def train_nb(docs_by_class, vocab, alpha=1.0):
    class_priors = {}
    class_word_probs = {}
    total_docs = sum(len(d) for d in docs_by_class.values())

    for cls, docs in docs_by_class.items():
        class_priors[cls] = len(docs) / total_docs
        counts = Counter()
        for doc in docs:
            for token in doc:
                counts[token] += 1
        total = sum(counts.values()) + alpha * len(vocab)
        class_word_probs[cls] = {
            w: (counts[w] + alpha) / total for w in vocab
        }
    return class_priors, class_word_probs


def predict_nb(doc, class_priors, class_word_probs):
    scores = {}
    for cls in class_priors:
        s = math.log(class_priors[cls])
        for token in doc:
            if token in class_word_probs[cls]:
                s += math.log(class_word_probs[cls][token])
        scores[cls] = s
    return max(scores, key=scores.get)
```

Đơn giản hóa phụ gia (alpha = 1.0) là Đơn giản hóa Laplace. Không có nó, một từ không được nhìn thấy trong một lớp có xác suất bằng không và nhật ký nổ ra. `alpha=0.01`là phổ biến trong thực tế. `alpha=1.0`là trường học không được dạy.

### Bước 3: Khản hồi hậu cần từ đầu

```python
import numpy as np


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -20, 20)))


def train_lr(X, y, epochs=500, lr=0.05, l2=0.01):
    n_features = X.shape[1]
    w = np.zeros(n_features)
    b = 0.0
    for _ in range(epochs):
        logits = X @ w + b
        preds = sigmoid(logits)
        err = preds - y
        grad_w = X.T @ err / len(y) + l2 * w
        grad_b = err.mean()
        w -= lr * grad_w
        b -= lr * grad_b
    return w, b


def predict_lr(X, w, b):
    return (sigmoid(X @ w + b) >= 0.5).astype(int)
```

L2 điều chỉnh quan trọng ở đây. các tính năng văn bản là hiếm; mà không có L2 mô hình ghi nhớ các ví dụ đào tạo.`0.01`và âm thanh.

### Bước 4: xử lý từ chối (cơ chế thất bại)

Hãy xem xét "không tốt" và "không xấu". Một phân loại BoW thấy `{not, good}`và `{not, bad}`và học hỏi từ những người xuất hiện nhiều hơn trong huấn luyện.`not_good`và `not_bad`Và nó học được những đặc điểm khác nhau.

Một phương pháp khắc phục khó khăn hơn có hiệu quả khi bạn không có bigram: **negation scoping**. Đơn vị tiền ký sau từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ từ`NOT_`cho đến dấu chấm tiếp theo.

```python
NEGATION_WORDS = {"not", "no", "never", "nor", "none", "nothing", "neither"}
NEGATION_TERMINATORS = {".", "!", "?", ",", ";"}


def apply_negation(tokens):
    out = []
    negate = False
    for token in tokens:
        if token in NEGATION_TERMINATORS:
            negate = False
            out.append(token)
            continue
        if token in NEGATION_WORDS:
            negate = True
            out.append(token)
            continue
        out.append(f"NOT_{token}" if negate else token)
    return out
```

```python
>>> apply_negation(["not", "good", "at", "all", ".", "but", "funny"])
['not', 'NOT_good', 'NOT_at', 'NOT_all', '.', 'but', 'funny']
```

Giờ thì`good`và `NOT_good`3 dòng xử lý trước, độ chính xác có thể đo lường nhảy trên các điểm chuẩn cảm xúc.

### Bước 5: Các số liệu đánh giá quan trọng

Sự chính xác đơn độc là sai lầm nếu các lớp không cân bằng. Các quan điểm cảm xúc thực sự thường là 70-80% tích cực hoặc 70-80% tiêu cực; một phân loại đa số liên tục có độ chính xác 80% và không có giá trị.

- **Per-class precision and recall.**Một cặp cho mỗi lớp, và phân tích chúng để có được một số duy nhất tôn trọng sự cân bằng của lớp.
- **Macro-F1 (primary metric for imbalanced data).**Tỷ lệ trung bình điểm F1 cho mỗi lớp, cân nặng bằng nhau. Sử dụng nó thay vì độ chính xác khi các lớp không cân bằng.
- **Weighted-F1 (alternative).**Tương tự như macro nhưng cân nặng theo tần số lớp. báo cáo cùng với macro-F1 khi sự mất cân bằng có ý nghĩa kinh doanh.
- **Confusion matrix.**Luôn kiểm tra trước khi tin tưởng bất kỳ métric scalar nào; nó cho thấy cặp lớp nào mô hình nhầm lẫn.
- **Per-class error samples.**Hãy rút ra 5 dự đoán sai lầm cho mỗi lớp học. Hãy đọc chúng. Không gì thay thế việc đọc sai lầm thực tế.

Đối với dữ liệu mất cân bằng nghiêm trọng (> tỷ lệ 95-5), báo cáo **AUROC**và **AUPRC**AUPRC nhạy cảm hơn với tầng lớp thiểu số, đó là điều bạn thường quan tâm (như spam, gian lận, cảm xúc hiếm hoi).

**Common bug to avoid.**Báo cáo micro-F1 thay vì macro-F1 trên dữ liệu không cân bằng cung cấp một số có vẻ cao bởi vì nó bị chi phối bởi lớp đa số.

```python
def evaluate(y_true, y_pred):
    tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
    tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)
    precision = tp / (tp + fp) if tp + fp else 0
    recall = tp / (tp + fn) if tp + fn else 0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0
    return {"tp": tp, "fp": fp, "tn": tn, "fn": fn, "precision": precision, "recall": recall, "f1": f1}
```

## Sử dụng nó

Scikit-learn làm nó trong sáu dòng, đúng.

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

pipe = Pipeline([
    ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True, stop_words=None)),
    ("clf", LogisticRegression(C=1.0, max_iter=1000)),
])
pipe.fit(X_train, y_train)
print(pipe.score(X_test, y_test))
```

Ba điều cần chú ý.`stop_words=None`giữ sự phủ nhận. `ngram_range=(1, 2)`thêm các biểu tượng lớn như vậy `not good`trở thành một tính năng (scikit-learn kết hợp hai từ với một không gian). `sublinear_tf=True`Những dấu hiệu này là sự khác biệt giữa một đường cơ sở chính xác 75% và một đường cơ sở chính xác 85% trên SST-2.

### Khi nào để tìm một bộ biến đổi

- Chẩn đoán sự ngạo mạn, mô hình cổ điển thất bại ở đây.
- Những bài đánh giá dài nơi tình cảm thay đổi giữa tài liệu.
- "Hình ảnh rất tuyệt, nhưng pin rất tệ". Bạn cần phải gán cảm xúc cho các khía cạnh.
- Các ngôn ngữ không phải tiếng Anh, nguồn lực thấp. BERT đa ngôn ngữ cung cấp cho bạn một đường cơ sở không chụp miễn phí.

Nếu bạn cần bất kỳ điều gì trên, hãy vượt qua giai đoạn 7 (cấp sâu biến áp). Nếu không, Bayes ngây thơ hoặc sự lùi lại hậu cần trên TF-IDF cộng với các bigram cộng với xử lý phủ nhận là cơ sở sản xuất của bạn vào năm 2026.

### Trầm lẫy tái tạo (một lần nữa)

Việc đào tạo lại các mô hình cảm xúc là thói quen. Việc đánh giá lại chúng không phải là. Số liệu chính xác được báo cáo trong các giấy sử dụng phân chia cụ thể, xử lý trước cụ thể, các mã hóa cụ thể. Nếu bạn so sánh mô hình mới của bạn với một đường cơ sở mà không sử dụng đường ống giống nhau, bạn sẽ nhận được các điểm phân tích gây hiểu lầm. Luôn tái tạo đường cơ sở trên đường ống của bạn, chứ không phải số giấy.

## Chuyển nó

Cứ như `outputs/prompt-sentiment-baseline.md`- Có thể là:

```markdown
---
name: sentiment-baseline
description: Design a sentiment analysis baseline for a new dataset.
phase: 5
lesson: 05
---

Given a dataset description (domain, language, size, label granularity, latency budget), you output:

1. Feature extraction recipe. Specify tokenizer, n-gram range, stopword policy (usually keep), negation handling (scoped prefix or bigrams).
2. Classifier. Naive Bayes for baseline, logistic regression for production, transformer only if the domain needs sarcasm / aspects / cross-lingual.
3. Evaluation plan. Report precision, recall, F1, confusion matrix, and per-class error samples (not just scalars).
4. One failure mode to monitor post-deployment. Domain drift and sarcasm are the top two.

Refuse to recommend dropping stopwords for sentiment tasks. Refuse to report accuracy as the sole metric when classes are imbalanced (e.g., 90% positive). Flag subword-rich languages as needing FastText or transformer embeddings over word-level TF-IDF.
```

## Các bài tập

1. **Easy.**Thêm `apply_negation`như một bước xử lý trước trong đường ống học scikit và đo đạc F1 delta trên một bộ dữ liệu cảm xúc nhỏ.
2. **Medium.**Thực hiện sự lùi lại hậu cần cân bằng lớp học (thành `class_weight="balanced"`để học scikit-, hoặc lấy gradient tự mình). đo tác động đến sự mất cân bằng lớp 90-10 tổng hợp.
3. **Hard.**Xây dựng một máy dò khạo báng bằng cách đào tạo một bộ phân loại thứ hai về các dư lượng của mô hình cảm xúc. Tài liệu thiết lập thí nghiệm của bạn. Hãy cảnh báo người đọc khi độ chính xác của bạn thấp hơn sự ngẫu nhiên (thực suất trên khạo báng 2 lớp là ~ 50% và hầu hết các nỗ lực đầu tiên hạ cánh ở đó).

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Polarity | Positive or negative | Binary label; sometimes extended to neutral or fine-grained (5-star). |
| Aspect-based sentiment | Per-aspect polarity | Attribute sentiment to specific entities or attributes mentioned in text. |
| Negation scoping | Reversing nearby tokens | Prefix tokens after "not" with `NOT_` until punctuation. |
| Laplace smoothing | Adding 1 to counts | Prevents zero-probability features in Naive Bayes. |
| L2 regularization | Shrinking weights | Adds `lambda * sum(w^2)` to loss. Essential for sparse text features. |

## Đọc thêm

- [Pang and Lee (2008). Opinion Mining and Sentiment Analysis](https://www.cs.cornell.edu/home/llee/opinion-mining-sentiment-analysis-survey.html) cuộc khảo sát cơ bản. dài, nhưng bốn phần đầu tiên bao gồm tất cả mọi thứ cổ điển.
- [Wang and Manning (2012). Baselines and Bigrams: Simple, Good Sentiment and Topic Classification](https://aclanthology.org/P12-2018/) tờ báo cho thấy Bigrams + Naive Bayes khó đánh bại bằng văn bản ngắn.
- [scikit-learn text feature extraction docs](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) tham chiếu cho `CountVectorizer`- `TfidfVectorizer`, và mỗi nút mà bạn sẽ điều chỉnh.
