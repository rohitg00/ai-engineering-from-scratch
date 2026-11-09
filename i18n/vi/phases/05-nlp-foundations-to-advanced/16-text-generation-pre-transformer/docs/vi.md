# Tạo văn bản trước khi chuyển đổi  N-gram Language Models

> Nếu một từ là đáng ngạc nhiên, mô hình là xấu. Sự bối rối làm cho một số ngạc nhiên. Nhấp nhàng giữ cho nó hữu hạn.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## Vấn đề

Trước khi biến đổi, trước khi RNN, trước khi nhúng từ, một mô hình ngôn ngữ dự đoán từ tiếp theo bằng cách đếm số lần nó sau từ trước `n-1`đếm "mẹ" → "ngồi" 47 lần, "mẹ" → " nhảy" 12 lần, "mẹ" → "tủ lạnh" 0 lần. bình thường để có được phân bố xác suất.

Đây là mô hình ngôn ngữ n-gram. Nó chạy mọi bộ nhận dạng ngôn ngữ, mỗi bộ kiểm tra đánh vần, và mọi hệ thống dịch thuật máy dựa trên cụm từ năm 1980 đến năm 2015. Nó vẫn chạy khi bạn cần mô hình ngôn ngữ giá rẻ trên thiết bị.

Vấn đề thú vị là phải làm gì với n-gram không thấy. Một mô hình dựa trên số liệu thô gán xác suất không cho bất cứ điều gì mà nó không thấy, điều này là thảm họa vì các câu dài và gần như mọi câu dài chứa ít nhất một chuỗi không thấy. Năm mươi năm nghiên cứu làm trơn đã khắc phục điều đó.

## Khái niệm

![N-gram model: count, smooth, generate](../assets/ngram.svg)

### Trò chơi dự đoán

Trước khi bất kỳ thiết bị nào tồn tại, một thí nghiệm đã xác định mô hình ngôn ngữ là gì. Hãy bao phủ chữ cái tiếp theo của một câu tiếng Anh. Hãy yêu cầu ai đó đoán nó, một đoán một lần, cho đến khi họ làm đúng. Hãy ghi lại số lượng đoán. Hãy lặp lại cho vài trăm chữ cái.

Số lượng đoán không phải là thứ thường. Chúng là một mã hóa lại không mất mát của văn bản: trao chuỗi đếm cho một người đoán thứ hai, giống nhau và họ có thể tái cấu trúc mọi chữ cái, bởi vì ở mỗi vị trí họ biết chính xác những đoán nào đi trước. Một thông điệp bạn có thể mã hóa lại bằng ít biểu tượng hơn mang lại ít thông tin hơn cho mỗi biểu tượng, vì vậy số liệu thống kê đoán đặt một giới hạn cho sự nhập khẩu của tiếng Anh.

Shannon đã thực hiện điều này vào năm 1951 và có một số mà vẫn thống trị lĩnh vực.`log2(27) ≈ 4.75`Các con người đoán với 100 chữ cái của ngữ cảnh hạ cánh giữa 0,6 và 1,3 bit mỗi chữ cái. tiếng Anh là khoảng ba phần tư các chuyển động buộc.

Mỗi mô hình ngôn ngữ kể từ đó là một người chơi cơ học của trò chơi này, và mỗi số đánh giá trong bài học này là trò chơi ghi điểm:

- **Cross-entropy loss**là số lượng bit trung bình mà mô hình cần cho mỗi biểu tượng.
- **Perplexity**là `2^bits`(hoặc `e^nats`): yếu tố phân nhánh vẫn đối mặt với mô hình sau khi phỏng đoán.
- **Context length is the player's memory.**Một mô hình trigram chơi với hai token bộ nhớ. Một biến thể chơi cùng một trò chơi với 100K token. Các quy tắc không bao giờ thay đổi; người chơi đã tốt hơn.

Một đơn vị chuyển đổi sang đường đua: điểm số của trò chơi cho mỗi chữ cái trong bit (`log2`), trong khi các công thức n-gram dưới đây ghi điểm cho mỗi từ biểu tượng trong nats (logbock tự nhiên)  và kể từ sự bối rối `e^H`trong nats bằng nhau `2^H`trong bit, hai quan điểm là cùng một thước đo trong các đơn vị khác nhau.

```figure
prediction-game
```

**N-gram probability:** `P(w_i | w_{i-n+1}, ..., w_{i-1})`- Đặt lại .`n`(thường là 3 cho trigram, 4 cho 4 gram).

```math
P(w \mid \text{context}) = \frac{\mathop{\mathrm{count}}(\text{context}, w)}{\mathop{\mathrm{count}}(\text{context})}
```

**The zero-count problem.**Bất kỳ n-gram nào không được nhìn thấy trong đào tạo đều có xác suất bằng không. Một nghiên cứu năm 2007 trên Brown corpus cho thấy rằng ngay cả một mô hình 4 gram có 30% 4 gram không được nhìn thấy trong đào tạo. Bạn không thể đánh giá trên bất kỳ văn bản thực nào mà không làm trơn.

**Smoothing approaches, in order of sophistication:**

1. **Laplace (add-one).**Thêm 1 vào mỗi con số.
2. **Good-Turing.**Đổi lại khối lượng xác suất từ các sự kiện tần số cao hơn đến những sự kiện không thể thấy dựa trên tần số tần số.
3. **Interpolation.**Kết hợp n-gram, (n-1)-gram, vv, ước tính với trọng lượng có thể điều chỉnh.
4. **Backoff.**Nếu n-gram có số không, hãy giảm xuống (n-1) -gram.
5. **Absolute discounting.**Giảm giảm giá cố định `D`Từ mọi thứ, phân phối lại cho những gì không thể thấy được.
6. **Kneser-Ney.**Sự giảm giá tuyệt đối cộng với một lựa chọn thông minh cho mô hình thứ tự thấp hơn: sử dụng * xác suất tiếp tục * (nhiều ngữ ngữ ngữ một từ xuất hiện) thay vì tần số nguyên liệu.

Sự hiểu biết của Kneser-Ney rất sâu sắc. "San Francisco" là một chữ lớn phổ biến. Unigram "Francisco" xuất hiện chủ yếu sau "San. " Sự giảm giá tuyệt đối ngây thơ cho "Francisco" xác suất unigram cao (vì số lượng là cao). Kneser-Ney nhận thấy rằng "Francisco" chỉ xuất hiện trong một bối cảnh và giảm khả năng tiếp tục của nó tương ứng. Kết quả: một biểu tượng lớn mới kết thúc bằng "Francisco" có được xác suất thấp thích hợp.

**Evaluation: perplexity.**Tỷ lệ nhân của tỷ lệ trung bình âm tính log-cho khả năng mỗi từ trên một tập hợp thử nghiệm được tổ chức. thấp hơn là tốt hơn. Một sự bối rối của 100 có nghĩa là mô hình là bối rối như nó sẽ chọn đồng đều trong số 100 từ.

```math
\text{perplexity} = \exp\left(-\frac{1}{N} \sum_i \log P(w_i \mid \text{context}_i)\right)
```

```figure
ngram-backoff
```

## Hãy xây dựng nó

### Bước 1: đếm trigram

```python
from collections import Counter, defaultdict


def train_ngram(corpus_tokens, n=3):
    ngrams = Counter()
    contexts = Counter()
    for sentence in corpus_tokens:
        padded = ["<s>"] * (n - 1) + sentence + ["</s>"]
        for i in range(len(padded) - n + 1):
            ctx = tuple(padded[i:i + n - 1])
            word = padded[i + n - 1]
            ngrams[ctx + (word,)] += 1
            contexts[ctx] += 1
    return ngrams, contexts


def raw_probability(ngrams, contexts, context, word):
    ctx = tuple(context)
    if contexts.get(ctx, 0) == 0:
        return 0.0
    return ngrams.get(ctx + (word,), 0) / contexts[ctx]
```

Input là một danh sách các câu được token hóa. Output là n-gram và contexts. `<s>`và `</s>`là giới hạn của câu.

### Bước 2: Lượt nhẵn Laplace

```python
def laplace_probability(ngrams, contexts, vocab_size, context, word):
    ctx = tuple(context)
    numerator = ngrams.get(ctx + (word,), 0) + 1
    denominator = contexts.get(ctx, 0) + vocab_size
    return numerator / denominator
```

Thêm 1 vào mỗi đếm, làm cho khối lượng của các sự kiện không thể nhìn thấy được phân bổ quá mức, làm tổn thương những sự kiện hiếm gặp.

### Bước 3: Kneser-Ney (những chữ cái lớn, được phân tích)

```python
def kneser_ney_bigram_model(corpus_tokens, discount=0.75):
    unigrams = Counter()
    bigrams = Counter()
    unigram_contexts = defaultdict(set)

    for sentence in corpus_tokens:
        padded = ["<s>"] + sentence + ["</s>"]
        for i, w in enumerate(padded):
            unigrams[w] += 1
            if i > 0:
                prev = padded[i - 1]
                bigrams[(prev, w)] += 1
                unigram_contexts[w].add(prev)

    total_unique_bigrams = sum(len(ctx_set) for ctx_set in unigram_contexts.values())
    continuation_prob = {
        w: len(ctx_set) / total_unique_bigrams for w, ctx_set in unigram_contexts.items()
    }

    context_totals = Counter()
    for (prev, w), count in bigrams.items():
        context_totals[prev] += count

    unique_follow = defaultdict(set)
    for (prev, w) in bigrams:
        unique_follow[prev].add(w)

    def prob(prev, w):
        count = bigrams.get((prev, w), 0)
        denom = context_totals.get(prev, 0)
        if denom == 0:
            return continuation_prob.get(w, 1e-9)
        first_term = max(count - discount, 0) / denom
        lambda_prev = discount * len(unique_follow[prev]) / denom
        return first_term + lambda_prev * continuation_prob.get(w, 1e-9)

    return prob
```

Ba phần di chuyển.`continuation_prob`"Thật ngữ này xuất hiện trong bao nhiêu ngữ cảnh khác nhau?" (khiến đổi Kneser-Ney).`lambda_prev`là khối lượng được giải phóng bởi giá giảm, được sử dụng để cân nặng backkoff.

### Bước 4: tạo văn bản bằng cách lấy mẫu

```python
import random


def generate(prob_fn, vocab, prefix, max_len=30, seed=0):
    rng = random.Random(seed)
    tokens = list(prefix)
    for _ in range(max_len):
        candidates = [(w, prob_fn(tokens[-1], w)) for w in vocab]
        total = sum(p for _, p in candidates)
        r = rng.random() * total
        acc = 0.0
        for w, p in candidates:
            acc += p
            if r <= acc:
                tokens.append(w)
                break
        if tokens[-1] == "</s>":
            break
    return tokens
```

Các mẫu tương ứng với xác suất. luôn cho ra hiệu suất khác nhau cho mỗi hạt. Đối với hiệu suất giống như chùm tìm kiếm, chọn argmax tại mỗi bước (cười tham) và thêm một nút ngẫu nhiên nhỏ (giới nhiệt).

### Bước 5: bối rối

```python
import math


def perplexity(prob_fn, sentences):
    total_log_prob = 0.0
    total_tokens = 0
    for sentence in sentences:
        padded = ["<s>"] + sentence + ["</s>"]
        for i in range(1, len(padded)):
            p = prob_fn(padded[i - 1], padded[i])
            total_log_prob += math.log(max(p, 1e-12))
            total_tokens += 1
    return math.exp(-total_log_prob / total_tokens)
```

Với Brown corpus, một mô hình KN 4 gram được điều chỉnh tốt đạt độ phức tạp khoảng 140. Một biến thể LM đạt 15-30 trên cùng bộ thử nghiệm. khoảng cách là khoảng 10x.

## Sử dụng nó

- **Classical NLP teaching.**Sự tiếp xúc rõ ràng nhất với sự trơn tru, MLE, và sự bối rối mà bạn có thể nhận được.
- **KenLM.**Tác phẩm n-gram thư viện. được sử dụng như một rescorer trong các hệ thống nói chuyện và MT nơi độ trễ thấp quan trọng.
- **On-device autocomplete.**Mô hình hình âm âm trong bàn phím.
- **Baselines.**Luôn tính toán một n-gram LM phức tạp trước khi tuyên bố LM thần kinh của bạn tốt.

## Chuyển nó

Cứ như `outputs/prompt-lm-baseline.md`- Có thể là:

```markdown
---
name: lm-baseline
description: Build a reproducible n-gram language model baseline before training a neural LM.
phase: 5
lesson: 16
---

Given a corpus and target use (next-word prediction, rescoring, perplexity baseline), output:

1. N-gram order. Trigram for general English, 4-gram if corpus is large, 5-gram for speech rescoring.
2. Smoothing. Modified Kneser-Ney is the default; Laplace only for teaching.
3. Library. `kenlm` for production, `nltk.lm` for teaching, roll your own only to learn.
4. Evaluation. Held-out perplexity with consistent tokenization between train and test sets.

Refuse to report perplexity computed with different tokenization between systems being compared — perplexity numbers are comparable only under identical tokenization. Flag OOV rate in test set; KN handles OOV poorly unless you reserve a special <UNK> token during training.
```

## Các bài tập

1. **Easy.**Hãy tập một chữ trigram LM trên một tập thể Shakespeare 1000 câu. tạo ra 20 câu. Chúng sẽ có khả năng tại địa phương nhưng không phù hợp trên toàn cầu. Đây là bản demo truyền thống.
2. **Medium.**Thực hiện sự bối rối cho mô hình KN của bạn trên một phân chia Shakespeare kéo dài. So sánh với Laplace. Bạn nên thấy sự bối rối KN thấp hơn 30-50%.
3. **Hard.**Xây dựng một trình chỉnh đúc chữ trigram: với một từ bị đánh dấu sai và bối cảnh của nó, tạo ra các sửa đổi và xếp hạng theo xác suất ngữ cảnh theo LM. Đánh giá trên các chữ viết Birkbeck (thường).

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| N-gram | Word sequence | Sequence of `n` consecutive tokens. |
| Smoothing | Avoiding zeros | Reallocating probability mass so unseen events get non-zero probability. |
| Perplexity | LM quality metric | `exp(-average log-prob)` on held-out data. Lower is better. |
| Backoff | Fallback to shorter context | If trigram count is zero, use bigram. Katz backoff formalizes this. |
| Kneser-Ney | Best smoothing for n-grams | Absolute discounting + continuation probability for the lower-order model. |
| Continuation probability | KN-specific | `P(w)` weighted by number of contexts `w` appears in, not by raw count. |
| Entropy of text | Information per symbol | Average bits needed to encode the next symbol given the context. Shannon's 1951 estimate for printed English with up to 100 letters of context: 0.6-1.3 bits/letter, measured before any model existed. |

## Đọc thêm

- [Shannon (1951). Prediction and Entropy of Printed English](https://www.princeton.edu/~wbialek/rome/refs/shannon_51.pdf) thí nghiệm trò chơi đoán định nghĩa mục tiêu mà mỗi mô hình ngôn ngữ vẫn tối ưu hóa.
- [Jurafsky and Martin — Speech and Language Processing, Chapter 3 (2026 draft)](https://web.stanford.edu/~jurafsky/slp3/3.pdf) xử lý và làm trơn các LM n-gram theo quy định.
- [Chen and Goodman (1998). An Empirical Study of Smoothing Techniques for Language Modeling](https://dash.harvard.edu/handle/1/25104739)- tờ báo đã xác định Kneser-Ney là tốt nhất n-gram smoother.
- [Kneser and Ney (1995). Improved Backing-off for M-gram Language Modeling](https://ieeexplore.ieee.org/document/479394) giấy KN gốc.
- [KenLM](https://kheafield.com/code/kenlm/) sản xuất nhanh n-gram LM, vẫn được sử dụng vào năm 2026 cho các ứng dụng nhạy cảm với độ trễ.
