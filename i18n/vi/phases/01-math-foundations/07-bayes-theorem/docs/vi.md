# Lý thuyết Bayes

> Thiếu khả năng là về những gì bạn mong đợi. Lý thuyết Bayes là về những gì bạn học được.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lesson 06 (Probability Fundamentals)
**Time:** ~75 minutes

## Mục tiêu học tập

- Sử dụng định lý Bayes để tính toán xác suất sau từ trước, xác suất và bằng chứng
- Xây dựng một phân loại văn bản Bayes ngây thơ từ đầu với Laplace làm mượt mà và tính toán log-space
- So sánh ước tính MLE và MAP và giải thích cách MAP tương ứng với L2
- Thực hiện cập nhật Bayesian theo trình tự bằng cách sử dụng các kết hợp trước Beta-Binomial cho thử nghiệm A / B

## Vấn đề

Một xét nghiệm y tế chính xác 99%. Bạn kiểm tra dương tính.

Hầu hết mọi người nói 99% câu trả lời thực sự phụ thuộc vào sự hiếm hoi của bệnh. Nếu 1 trong 10.000 người bị bệnh, kết quả tích cực chỉ cho bạn cơ hội 1% bị bệnh. 99% kết quả tích cực còn lại là báo động sai lầm từ những người khỏe mạnh.

Đây không phải là câu hỏi lừa đảo. Đó là định lý Bayes. Mỗi bộ lọc spam, mỗi chẩn đoán y tế, mỗi mô hình học máy đo lường sự không chắc chắn đều sử dụng lý luận chính xác này. Bạn bắt đầu với một niềm tin. Bạn thấy bằng chứng. Bạn cập nhật.

Nếu bạn xây dựng các hệ thống ML mà không hiểu điều này, bạn sẽ hiểu sai các sản phẩm mô hình, đặt ngưỡng xấu, và đưa ra dự đoán quá tự tin.

## Khái niệm

### Từ xác suất chung đến Bayes

Bạn đã biết từ bài học 06 rằng xác suất có điều kiện là:

```math
P(A \mid B) = \frac{P(A \text{ and } B)}{P(B)}
```

Và đối xứng:

```math
P(B \mid A) = \frac{P(A \text{ and } B)}{P(A)}
```

Cả hai biểu hiện đều có cùng số liệu: $P(A \text{ and } B)$Đặt chúng bằng nhau và sắp xếp lại:

```math
\begin{aligned}
P(A \text{ and } B) &= P(A \mid B) \cdot P(B) = P(B \mid A) \cdot P(A) \\[4pt]
&\text{Therefore:} \\[4pt]
P(A \mid B) &= \frac{P(B \mid A) \cdot P(A)}{P(B)}
\end{aligned}
```

Đó là định lý Bayes. 4 số lượng, 1 phương trình.

### Bốn phần

| Part | Name | What it means |
|------|------|---------------|
| $P(A \mid B)$ | Posterior | Your updated belief about $A$ after seeing evidence $B$ |
| $P(B \mid A)$ | Likelihood | How probable the evidence $B$ is if $A$ is true |
| $P(A)$ | Prior | Your belief about $A$ before seeing any evidence |
| $P(B)$ | Evidence | Total probability of seeing $B$ under all possibilities |

Thời gian chứng minh$P(B)$Nó hoạt động như một chất bình thường hóa. Bạn có thể mở rộng nó bằng cách sử dụng luật xác suất tổng thể:

```math
P(B) = P(B \mid A) \cdot P(A) + P(B \mid \text{not } A) \cdot P(\text{not } A)
```

### Ví dụ về xét nghiệm y tế

Một bệnh ảnh hưởng đến 1 trong 10.000 người.

```math
\begin{aligned}
P(\text{sick}) &= 0.0001 \quad \text{(prior: disease is rare)} \\
P(\text{positive} \mid \text{sick}) &= 0.99 \quad \text{(likelihood: test catches it)} \\
P(\text{positive} \mid \text{healthy}) &= 0.01 \quad \text{(false positive rate)} \\[6pt]
P(\text{positive}) &= P(\text{positive} \mid \text{sick}) \cdot P(\text{sick}) + P(\text{positive} \mid \text{healthy}) \cdot P(\text{healthy}) \\
&= 0.99 \cdot 0.0001 + 0.01 \cdot 0.9999 \\
&= 0.000099 + 0.009999 \\
&= 0.010098 \\[6pt]
P(\text{sick} \mid \text{positive}) &= P(\text{positive} \mid \text{sick}) \cdot P(\text{sick}) / P(\text{positive}) \\
&= 0.99 \cdot 0.0001 / 0.010098 \\
&= 0.0098 \\
&= 0.98\%
\end{aligned}
```

Khi một tình trạng hiếm, ngay cả xét nghiệm chính xác cũng có kết quả dương tính hầu hết là sai.

### Ví dụ về bộ lọc spam

Bạn nhận được một email có chứa từ "nhà cờ bạc".

```math
\begin{aligned}
P(\text{spam}) &= 0.3 \quad \text{(30\% of email is spam)} \\
P(\text{"lottery"} \mid \text{spam}) &= 0.05 \quad \text{(5\% of spam emails contain "lottery")} \\
P(\text{"lottery"} \mid \text{not spam}) &= 0.001 \quad \text{(0.1\% of legitimate emails contain "lottery")} \\[6pt]
P(\text{"lottery"}) &= 0.05 \cdot 0.3 + 0.001 \cdot 0.7 \\
&= 0.015 + 0.0007 \\
&= 0.0157 \\[6pt]
P(\text{spam} \mid \text{"lottery"}) &= 0.05 \cdot 0.3 / 0.0157 \\
&= 0.955 \\
&= 95.5\%
\end{aligned}
```

Một từ thay đổi xác suất từ 30% lên 95,5%. Một bộ lọc spam thực sự áp dụng Bayes trên hàng trăm từ cùng một lúc.

### Bayes ngây thơ: giả định độc lập

Bayes ngây thơ mở rộng điều này đến nhiều tính năng bằng cách giả định tất cả các tính năng đều độc lập theo điều kiện khi xem xét lớp học:

```math
P(\text{class} \mid \text{feature}_1, \text{feature}_2, \ldots, \text{feature}_n) = \frac{P(\text{class}) \cdot P(\text{feature}_1 \mid \text{class}) \cdot P(\text{feature}_2 \mid \text{class}) \cdots P(\text{feature}_n \mid \text{class})}{P(\text{feature}_1, \text{feature}_2, \ldots, \text{feature}_n)}
```

Phần "tâm nhiên" là giả định độc lập. Trong văn bản, các sự xuất hiện của từ không độc lập ("New" và "York" có liên quan). Nhưng giả định hoạt động rất tốt trong thực tế bởi vì trình phân loại chỉ cần xếp hạng các lớp, không tạo ra xác suất được chuẩn bị.

Vì tên gọi là giống nhau cho tất cả các lớp học, bạn có thể bỏ qua nó và chỉ cần so sánh số:

```math
\text{score}(\text{class}) = P(\text{class}) \cdot \prod_i P(\text{feature}_i \mid \text{class})
```

Chọn lớp có điểm cao nhất.

### Đánh giá xác suất tối đa (MLE)

Làm sao anh có được $P(\text{feature} \mid \text{class})$từ dữ liệu huấn luyện?

```math
P(\text{"free"} \mid \text{spam}) = \frac{\text{number of spam emails containing "free"}}{\text{total spam emails}}
```

Đây là MLE: chọn các giá trị tham số làm cho dữ liệu quan sát có khả năng cao nhất. Bạn đang tối đa hóa hàm xác suất, mà cho các đếm riêng lẻ giảm xuống tần số tương đối.

Vấn đề: nếu một từ không bao giờ xuất hiện trong spam trong quá trình đào tạo, MLE cho nó xác suất bằng không. Một từ không được nhìn thấy sẽ giết chết toàn bộ sản phẩm.

```math
P(\text{word} \mid \text{class}) = \frac{\text{count}(\text{word}, \text{class}) + 1}{\text{total\_words\_in\_class} + \text{vocabulary\_size}}
```

Thêm 1 vào mỗi con số đảm bảo không có khả năng nào là không.

Một từ chưa bao giờ xuất hiện trong bất kỳ thông điệp đào tạo nào không có trong từ vựng. `predict`bỏ qua nó, bởi vì nó không cung cấp bằng chứng cho cả hai lớp.

### Tối đa a posteriori (MAP)

MLE hỏi: những tham số nào tối đa hóa $P(\text{data} \mid \text{parameters})$- Không .

MAP hỏi: những tham số nào tối đa hóa $P(\text{parameters} \mid \text{data})$- Không .

Theo định lý Bayes:

```math
P(\text{parameters} \mid \text{data}) \propto P(\text{data} \mid \text{parameters}) \cdot P(\text{parameters})
```

MAP thêm một tiền lệ trên các tham số. Nếu bạn tin rằng các tham số nên nhỏ, bạn mã hóa nó như một tiền lệ phạt các giá trị lớn. Điều này giống như việc điều chỉnh L2 trong ML.

| Estimation | Optimizes | ML equivalent |
|------------|-----------|---------------|
| MLE | $P(\text{data} \mid \text{params})$ | Unregularized training |
| MAP | $P(\text{data} \mid \text{params}) \cdot P(\text{params})$ | L2 / L1 regularization |

### Bayesian vs frequentist: sự khác biệt thực tế

Những người thường xuyên học xem các thông số như là những điều không thể biết được. Họ hỏi: "Nếu tôi lặp lại thí nghiệm này nhiều lần, sẽ xảy ra gì?"

Người Bayesian coi các tham số như là phân bố. Họ hỏi: "Vì những gì tôi đã quan sát, tôi tin về các tham số là gì?"

Đối với các hệ thống ML xây dựng, sự khác biệt thực tế:

| Aspect | Frequentist | Bayesian |
|--------|-------------|----------|
| Output | Point estimate | Distribution over values |
| Uncertainty | Confidence intervals (about procedure) | Credible intervals (about parameter) |
| Small data | Can overfit | Prior acts as regularization |
| Computation | Usually faster | Often requires sampling (MCMC) |

Hầu hết các phương pháp ML sản xuất là thường xuyên (SGD, ước tính điểm). phương pháp Bayesian sáng khi bạn cần sự không chắc chắn được cân bằng (phác định y tế, hệ thống an toàn quan trọng) hoặc khi dữ liệu là hiếm (làm học ít, bắt đầu lạnh).

### Tại sao tư duy Bayesian quan trọng cho ML

Sự kết nối sâu sắc hơn cả sự tương tự:

**Priors are regularization.**Một Gaussian trước trên trọng lượng là L2 thường xuyên. một Laplace trước là L1. Mỗi khi bạn thêm một thuật ngữ thường xuyên, bạn đang làm cho một tuyên bố Bayesian về các giá trị tham số bạn mong đợi.

**Posteriors are uncertainty.**Một xác suất dự đoán duy nhất không cho bạn biết mô hình có thể tự tin như thế nào trong ước tính đó.$P(\text{spam})$là từ 0,8 đến 0,95. "

**Bayes updates are online learning.**Khi mô hình của bạn nhìn thấy dữ liệu mới, nó sẽ cập nhật niềm tin của mình theo từng bước thay vì tái tập từ đầu.

**Model comparison is Bayesian.**Kiểm soạn thông tin Bayesian (BIC), xác suất biên và các yếu tố Bayes đều sử dụng lý luận Bayesian để lựa chọn giữa các mô hình mà không quá phù hợp.

```figure
bayes-update
```

## Hãy xây dựng nó

### Bước 1: hàm định lý Bayes

```python
def bayes(prior, likelihood, false_positive_rate):
    evidence = likelihood * prior + false_positive_rate * (1 - prior)
    posterior = likelihood * prior / evidence
    return posterior

result = bayes(prior=0.0001, likelihood=0.99, false_positive_rate=0.01)
print(f"P(sick|positive) = {result:.4f}")
```

### Bước 2: Cân loại Bayes ngây thơ

```python
import math
from collections import defaultdict

class NaiveBayes:
    def __init__(self, smoothing=1.0):
        self.smoothing = smoothing
        self.class_counts = defaultdict(int)
        self.word_counts = defaultdict(lambda: defaultdict(int))
        self.class_word_totals = defaultdict(int)
        self.vocab = set()

    def train(self, documents, labels):
        for doc, label in zip(documents, labels):
            self.class_counts[label] += 1
            words = doc.lower().split()
            for word in words:
                self.word_counts[label][word] += 1
                self.class_word_totals[label] += 1
                self.vocab.add(word)

    def predict(self, document):
        words = [word for word in document.lower().split() if word in self.vocab]
        total_docs = sum(self.class_counts.values())
        vocab_size = len(self.vocab)
        best_class = None
        best_score = float("-inf")
        for cls in self.class_counts:
            score = math.log(self.class_counts[cls] / total_docs)
            for word in words:
                count = self.word_counts[cls].get(word, 0)
                total = self.class_word_totals[cls]
                score += math.log((count + self.smoothing) / (total + self.smoothing * vocab_size))
            if score > best_score:
                best_score = score
                best_class = cls
        return best_class
```

Các xác suất log ngăn chặn dòng chảy thấp. Bội số nhiều xác suất nhỏ tạo ra các con số quá nhỏ cho điểm nổi. Kết hợp xác suất log ổn định về mặt số và tương đương về mặt toán học.

### Bước 3: Đào tạo dữ liệu spam

```python
train_docs = [
    "win free money now",
    "free lottery ticket winner",
    "claim your prize today free",
    "urgent offer free cash",
    "congratulations you won free",
    "meeting tomorrow at noon",
    "project update attached",
    "can we schedule a call",
    "quarterly report review",
    "lunch on thursday sounds good",
    "team standup notes attached",
    "please review the pull request",
]

train_labels = [
    "spam", "spam", "spam", "spam", "spam",
    "ham", "ham", "ham", "ham", "ham", "ham", "ham",
]

classifier = NaiveBayes()
classifier.train(train_docs, train_labels)

test_messages = [
    "free money waiting for you",
    "meeting rescheduled to friday",
    "you won a free prize",
    "please review the attached report",
]

for msg in test_messages:
    print(f"  '{msg}' -> {classifier.predict(msg)}")
```

### Bước 4: Kiểm tra xác suất được học

```python
def show_top_words(classifier, cls, n=5):
    vocab_size = len(classifier.vocab)
    total = classifier.class_word_totals[cls]
    probs = {}
    for word in classifier.vocab:
        count = classifier.word_counts[cls].get(word, 0)
        probs[word] = (count + classifier.smoothing) / (total + classifier.smoothing * vocab_size)
    sorted_words = sorted(probs.items(), key=lambda x: x[1], reverse=True)
    for word, prob in sorted_words[:n]:
        print(f"    {word}: {prob:.4f}")

print("\nTop spam words:")
show_top_words(classifier, "spam")
print("\nTop ham words:")
show_top_words(classifier, "ham")
```

## Sử dụng nó

Tàu học Scikit sẵn sàng sản xuất Bayes thực hiện ngây thơ:

```python
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import classification_report

vectorizer = CountVectorizer()
X_train = vectorizer.fit_transform(train_docs)
clf = MultinomialNB()
clf.fit(X_train, train_labels)

X_test = vectorizer.transform(test_messages)
predictions = clf.predict(X_test)
for msg, pred in zip(test_messages, predictions):
    print(f"  '{msg}' -> {pred}")
```

Same algorithm. CountVectorizer xử lý tokenization và xây dựng từ vựng. MultinomialNB xử lý smoothing và log-probabilities nội bộ. phiên bản của bạn từ đầu làm điều tương tự trong 40 dòng.

## Chuyển nó

Các lớp NaiveBayes được xây dựng ở đây cho thấy toàn bộ đường ống: tokenization, ước tính xác suất với Laplace smoothing, dự đoán log-space.`code/bayes.py`chạy kết thúc đến kết thúc mà không có phụ thuộc ngoài thư viện tiêu chuẩn của Python.`code/bayes.ts`chỉ sử dụng thư viện tiêu chuẩn Node.

### Những người trước tiên kết hợp

Khi trước và sau thuộc cùng một gia đình phân phối, trước được gọi là "cùng". Điều này làm cho việc cập nhật Bayesian về mặt đại số sạch - bạn có được một hình thức đóng sau mà không có sự tích hợp số.

| Likelihood | Conjugate Prior | Posterior | Example |
|-----------|----------------|-----------|---------|
| Bernoulli | $\text{Beta}(a, b)$ | $\text{Beta}(a + \text{successes}, b + \text{failures})$ | Coin flip bias estimation |
| Normal (known variance) | $\text{Normal}(\mu_0, \sigma_0)$ | Normal(weighted mean, smaller variance) | Sensor calibration |
| Poisson | $\text{Gamma}(a, b)$ | $\text{Gamma}(a + \text{sum of counts}, b + n)$ | Modeling arrival rates |
| Multinomial | $\text{Dirichlet}(\alpha)$ | $\text{Dirichlet}(\alpha + \text{counts})$ | Topic modeling, language models |

Tại sao điều này quan trọng: không có con số trước kết hợp, bạn cần lấy mẫu Monte Carlo hoặc suy luận biến số để gần gũi với con số sau.

Phân bố Beta là con số kết hợp trước phổ biến nhất trong thực tế. $\text{Beta}(a, b)$đại diện cho niềm tin của bạn về một tham số xác suất.$a/(a+b)$- Tối lớn hơn$a+b$, phân phối tập trung (tự tin) hơn.

Các trường hợp đặc biệt của Beta trước:
- $\text{Beta}(1, 1)$Bạn không có ý kiến gì về các tham số.
- $\text{Beta}(10, 10)$= đạt đỉnh ở 0,5. Bạn tin rằng tham số gần 0,5.
- $\text{Beta}(1, 10)$= ngơ về phía 0. Bạn tin rằng tham số nhỏ.

Quy tắc cập nhật là rất đơn giản:

```math
\begin{aligned}
\text{Prior:} \quad & \text{Beta}(a, b) \\
\text{Data:} \quad & s \text{ successes}, f \text{ failures} \\
\text{Posterior:} \quad & \text{Beta}(a + s, b + f)
\end{aligned}
```

Không có tích hợp, không lấy mẫu, chỉ là cộng.

### Việc cập nhật theo trình Bayesian

Bayesian inference tự nhiên là theo trình tự. ngày hôm nay trở thành ngày mai trước. Đây là cách các hệ thống thực học dần mà không cần xử lý lại tất cả dữ liệu lịch sử.

Ví dụ cụ thể: ước tính xem một đồng xu có công bằng hay không.

**Day 1: No data yet.**
Bắt đầu với $\text{Beta}(1, 1)$- Ông không có ý kiến.
- Tỷ lệ trung bình trước: 0,5
- Prior là phẳng trên [0, 1]

**Day 2: Observe 7 heads, 3 tails.**
$\text{Posterior} = \text{Beta}(1 + 7, 1 + 3) = \text{Beta}(8, 4)$
- Tỷ lệ trung bình sau: $8/12 = 0.667$
- Bằng chứng cho thấy đồng xu này có khuynh hướng hướng hướng về đầu

**Day 3: Observe 5 more heads, 5 more tails.**
Sử dụng hình hậu của hôm qua như hình trước của hôm nay.
$\text{Posterior} = \text{Beta}(8 + 5, 4 + 5) = \text{Beta}(13, 9)$
- Tỷ lệ trung bình sau: $13/22 = 0.591$
- Các dữ liệu mới cân bằng kéo ước tính trở lại phía 0.5

```mermaid
graph LR
    A["Prior<br/>Beta(1,1)<br/>mean = 0.50"] -->|"7H, 3T"| B["Posterior 1<br/>Beta(8,4)<br/>mean = 0.67"]
    B -->|"becomes prior"| C["Prior 2<br/>Beta(8,4)"]
    C -->|"5H, 5T"| D["Posterior 2<br/>Beta(13,9)<br/>mean = 0.59"]
```

Lệnh trình độ quan sát không quan trọng. $\text{Beta}(1,1)$cập nhật với tất cả 12 đầu và 8 đuôi cùng một lúc cung cấp $\text{Beta}(13, 9)$-- kết quả tương tự. Cập nhật theo trình tự và cập nhật hàng loạt là tương đương về mặt toán học. Nhưng cập nhật theo trình tự cho phép bạn đưa ra quyết định ở từng bước mà không cần lưu trữ dữ liệu thô.

Đây là nền tảng của việc học trực tuyến trong các hệ thống ML sản xuất. Thompson lấy mẫu cho tên cướp, hệ thống khuyến nghị tăng và các máy dò biến chứng phát sóng đều sử dụng mô hình này.

### Kết nối với thử nghiệm A/B

Kiểm tra A/B là suy luận Bayesian trong mờ.

Thiết lập: bạn đang thử nghiệm hai màu nút: biến thể A (màu xanh) và biến thể B (màu xanh). Bạn muốn biết có cái nào được nhấp nhiều hơn.

Thử nghiệm A/B Bayesian:

1. **Prior.**Bắt đầu với $\text{Beta}(1, 1)$cho cả hai biến thể. Không có ưu tiên trước.
2. **Data.**Phân biến A: 50 lần nhấp trên 1000 lượt xem. Phân biến B: 65 lần nhấp trên 1000 lượt xem.
3. **Posteriors.**
   - A: $\text{Beta}(1 + 50, 1 + 950) = \text{Beta}(51, 951)$- Tỷ lệ trung bình = 0,051
   - B: $\text{Beta}(1 + 65, 1 + 935) = \text{Beta}(66, 936)$- Tỷ lệ trung bình = 0,066
4. **Decision.**Lưu ý$P(B > A)$-- xác suất tỷ lệ chuyển đổi thực của B cao hơn tỷ lệ chuyển đổi của A.

Máy tính $P(B > A)$Nhưng Monte Carlo làm cho nó tầm thường:

```
1. Draw 100,000 samples from Beta(51, 951)  -> samples_A
2. Draw 100,000 samples from Beta(66, 936)  -> samples_B
3. P(B > A) = fraction of samples where B > A
```

Nếu$P(B > A) > 0.95$, bạn gửi biến thể B. Nếu nó là giữa 0,05 và 0,95, bạn tiếp tục thu thập dữ liệu.$P(B > A) < 0.05$, con tàu biến thể A.

Lợi ích so với thử nghiệm A/B thường xuyên:
- Bạn nhận được một tuyên bố xác suất trực tiếp: "có 97% cơ hội B tốt hơn"
- Không có sự nhầm lẫn về giá trị p, không có việc "không thể từ chối giả thuyết không"
- Bạn có thể kiểm tra kết quả bất cứ lúc nào mà không làm tăng tỷ lệ dương tính sai (không có "vấn đề tìm kiếm")
- Bạn có thể kết hợp kiến thức trước đó (ví dụ, các thử nghiệm trước đây cho thấy tỷ lệ chuyển đổi thường là 3-8%)

| Aspect | Frequentist A/B | Bayesian A/B |
|--------|----------------|--------------|
| Output | p-value | $P(B > A)$ |
| Interpretation | "How surprising is this data if A=B?" | "How likely is B better than A?" |
| Early stopping | Inflates false positives | Safe at any point (given a well-chosen prior and correctly specified model) |
| Prior knowledge | Not used | Encoded as Beta prior |
| Decision rule | $p < 0.05$ | $P(B > A) > \text{threshold}$ |

## Các bài tập

1. **Multiple tests.**Một bệnh nhân có kết quả dương tính hai lần trên các xét nghiệm độc lập (cả hai đều chính xác 99%, tỷ lệ mắc bệnh là 1 trong 10.000).$P(\text{sick})$Sau cả hai thử nghiệm? Sử dụng phía sau từ thử nghiệm đầu tiên như trước cho thử nghiệm thứ hai.

2. **Smoothing impact.**Hãy chạy phân loại spam với giá trị làm trơn bằng 0,01, 0,1, 1.0 và 10.0.

3. **Add features.**Lớn thêm lớp NaiveBayes để cũng sử dụng chiều dài thông điệp (cắn/dáu) như một tính năng bên cạnh số lượng từ.$P(\text{short} \mid \text{spam})$và $P(\text{short} \mid \text{ham})$từ dữ liệu đào tạo và gấp nó vào điểm dự đoán.

4. **MAP by hand.**Với dữ liệu quan sát (7 đầu trong 10 cú đánh đồng), tính toán ước tính MAP của sự thiên vị bằng cách sử dụng một $\text{Beta}(2,2)$so sánh với ước tính MLE ($7/10$().

### Những gợi ý

**Exercise 1.**Gọi`bayes`một lần để lấy phía sau sau xét nghiệm 1, sau đó gọi lại với phía sau như trước. `sequential_bayes(prior, likelihood, false_positive_rate, 2)`phải có cùng giá trị, gần 0,5.

**Exercise 2.**Tạo ra một cái `NaiveBayes(smoothing=s)`cho mỗi giá trị, đào tạo nó trên cùng các dữ liệu, và in `top_words`Với thanh toán 0, một từ không bao giờ xuất hiện trong spam có xác suất 0, vì vậy nhật ký của nó không được xác định.

**Exercise 3.**Đếm số lượng thư spam và ham ngắn, chia bằng số lượng thư trong mỗi lớp, và thêm nhật ký của tỷ lệ đó vào điểm trong `predict`Kiểm tra xem hai xác suất cho mỗi lớp cộng lên đến 1.

**Exercise 4.**Với một $\text{Beta}(\alpha, \beta)$trước đó, ước tính MAP là $\frac{h + \alpha - 1}{n + \alpha + \beta - 2}$Đặt vào.$h = 7$- $n = 10$; kết quả phải nằm giữa MLE (0.7) và chế độ trước (0,5).

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Prior | "My initial guess" | $P(\text{hypothesis})$ before observing evidence. In ML: the regularization term. |
| Likelihood | "How well the data fits" | $P(\text{evidence} \mid \text{hypothesis})$. How probable the observed data is under a specific hypothesis. |
| Posterior | "My updated belief" | $P(\text{hypothesis} \mid \text{evidence})$. The prior multiplied by the likelihood, then normalized. |
| Evidence | "The normalizing constant" | $P(\text{data})$ across all hypotheses. Ensures the posterior sums to 1. |
| Naive Bayes | "That simple text classifier" | A classifier that assumes features are independent given the class. Works well despite the false assumption. |
| Laplace smoothing | "Add-one smoothing" | Adding a small count to every feature to prevent zero probabilities from unseen data. |
| MLE | "Just use the frequencies" | Choose parameters that maximize $P(\text{data} \mid \text{parameters})$. No prior. Can overfit with small data. |
| MAP | "MLE with a prior" | Choose parameters that maximize $P(\text{data} \mid \text{parameters}) \cdot P(\text{parameters})$. Equivalent to regularized MLE. |
| Log-probability | "Work in log space" | Using $\log(P)$ instead of $P$ to avoid floating-point underflow when multiplying many small numbers. |
| False positive | "A wrong alarm" | The test says positive, but the true state is negative. Drives the base rate fallacy. |

## Đọc thêm

- [3Blue1Brown: Bayes' theorem](https://www.youtube.com/watch?v=HZGCoVF3YvM)- giải thích trực quan với ví dụ xét nghiệm y tế
- [Stanford CS229: Generative Learning Algorithms](https://cs229.stanford.edu/main_notes.pdf)- Bayes ngây thơ và mối liên hệ của nó với các mô hình phân biệt đối xử
- [Think Bayes](https://greenteapress.com/wp/think-bayes/)- sách miễn phí, thống kê Bayesian với mã Python
- [scikit-learn Naive Bayes](https://scikit-learn.org/stable/modules/naive_bayes.html)- các hoạt động sản xuất và khi nào sử dụng mỗi biến thể
