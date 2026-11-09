# Đánh dấu POS và phân tích tổng hợp

> ngữ pháp đã không còn thời trang trong một thời gian, sau đó mỗi LLM cần phải xác nhận việc khai thác có cấu trúc, và nó trở lại.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## Vấn đề

Bài học 01 hứa rằng việc làm lemmatization cần một phần của bài phát biểu mà không biết.`running`là động từ, một lemmatizer không thể giảm nó xuống `run`Không biết`better`là một từ đặc tính, nó không thể giảm xuống `good`- Tôi không biết.

Lời hứa đó che giấu một lĩnh vực phụ. Việc gắn thẻ phần của bài phát biểu gán các danh mục ngữ pháp. Phân tích tổng hợp phục hồi cấu trúc cây của câu: từ nào sửa đổi cái nào, động từ nào cai trị lập luận nào. NLP cổ điển dành hai mươi năm để tinh chế cả hai. Sau đó học sâu đã đổ chúng thành một nhiệm vụ phân loại token trên đỉnh của một biến thể được đào tạo trước, và cộng đồng nghiên cứu chuyển tiếp.

Không phải cộng đồng ứng dụng. Mỗi đường ống khai thác cấu trúc vẫn sử dụng cây POS và cây phụ thuộc dưới nắp. JSON được tạo bằng LLM được xác nhận chống lại các hạn chế ngữ pháp. Hệ thống trả lời câu hỏi phân hủy các truy vấn bằng cách sử dụng phân tích phụ thuộc. Các nhà đánh giá chất lượng dịch thuật máy kiểm tra sự sắp xếp của cây phân tích.

Bài học này giới thiệu các thẻ, đường cơ sở, và điểm bạn ngừng thực hiện từ đầu và gọi spaCy.

## Khái niệm

**POS tagging**Đánh dấu mỗi biểu tượng với một danh mục ngữ pháp.**Penn Treebank (PTB)**Tagset là mặc định tiếng Anh. 36 thẻ với sự khác biệt người đọc thường thấy khó khăn: `NN`singular noun, `NNS`danh từ đa số, `NNP`tự danh nghĩa đơn vị, `VBD`động từ quá khứ, `VBZ`động từ 3rd person singular present, và như vậy.**Universal Dependencies (UD)**Tagset là thô hơn (17 thẻ) và ngôn ngữ-người ngộ; nó trở thành mặc định cho công việc xuyên ngôn ngữ.

```
The/DET cats/NOUN were/AUX running/VERB at/ADP 3pm/NOUN ./PUNCT
```

**Syntactic parsing**tạo ra một cây. Hai phong cách chính:

- **Constituency parsing.**Các cụm từ danh nghĩa, cụm từ động từ, cụm từ tiền định tổ bên trong nhau.
- **Dependency parsing.**Mỗi từ có một từ đầu duy nhất mà nó phụ thuộc vào, được dán nhãn với một mối quan hệ ngữ pháp.

Phân tích phụ thuộc đã giành chiến thắng trong những năm 2010 bởi vì nó tổng quát rõ ràng qua các ngôn ngữ, đặc biệt là các ngôn ngữ tự do.

```
running is ROOT
cats is nsubj of running
were is aux of running
at is prep of running
3pm is pobj of at
```

```figure
pos-tagger
```

```figure
dependency-arcs
```

## Hãy xây dựng nó

### Bước 1: Tỷ lệ cơ bản thẻ thường xuyên nhất

Đánh dấu POS ngu ngốc nhất có thể làm việc.

```python
from collections import Counter, defaultdict


def train_mft(train_examples):
    word_tag_counts = defaultdict(Counter)
    all_tags = Counter()
    for tokens, tags in train_examples:
        for token, tag in zip(tokens, tags):
            word_tag_counts[token.lower()][tag] += 1
            all_tags[tag] += 1
    word_best = {w: c.most_common(1)[0][0] for w, c in word_tag_counts.items()}
    default_tag = all_tags.most_common(1)[0][0]
    return word_best, default_tag


def predict_mft(tokens, word_best, default_tag):
    return [word_best.get(t.lower(), default_tag) for t in tokens]
```

Trên cơ thể Brown, đường cơ sở này đạt độ chính xác khoảng 85%.

### Bước 2: Bigram HMM Tagger

Mô hình xác suất chung của chuỗi:

```math
P(\text{tags}, \text{words}) = \prod_i P(\text{tag}_i \mid \text{tag}_{i-1}) \cdot P(\text{word}_i \mid \text{tag}_i)
```

Hai bảng: xác suất chuyển tiếp (tag cho thẻ trước), xác suất phát thải (tag cho từ).

```python
import math


def train_hmm(train_examples, alpha=0.01):
    transitions = defaultdict(Counter)
    emissions = defaultdict(Counter)
    tags = set()
    vocab = set()

    for tokens, ts in train_examples:
        prev = "<BOS>"
        for token, tag in zip(tokens, ts):
            transitions[prev][tag] += 1
            emissions[tag][token.lower()] += 1
            tags.add(tag)
            vocab.add(token.lower())
            prev = tag
        transitions[prev]["<EOS>"] += 1

    return transitions, emissions, tags, vocab


def log_prob(table, given, key, smooth_denom, alpha):
    return math.log((table[given].get(key, 0) + alpha) / smooth_denom)


def viterbi(tokens, transitions, emissions, tags, vocab, alpha=0.01):
    tags_list = list(tags)
    n = len(tokens)
    V = [[0.0] * len(tags_list) for _ in range(n)]
    back = [[0] * len(tags_list) for _ in range(n)]

    for j, tag in enumerate(tags_list):
        em_denom = sum(emissions[tag].values()) + alpha * (len(vocab) + 1)
        tr_denom = sum(transitions["<BOS>"].values()) + alpha * (len(tags_list) + 1)
        tr = log_prob(transitions, "<BOS>", tag, tr_denom, alpha)
        em = log_prob(emissions, tag, tokens[0].lower(), em_denom, alpha)
        V[0][j] = tr + em
        back[0][j] = 0

    for i in range(1, n):
        for j, tag in enumerate(tags_list):
            em_denom = sum(emissions[tag].values()) + alpha * (len(vocab) + 1)
            em = log_prob(emissions, tag, tokens[i].lower(), em_denom, alpha)
            best_prev = 0
            best_score = -1e30
            for k, prev_tag in enumerate(tags_list):
                tr_denom = sum(transitions[prev_tag].values()) + alpha * (len(tags_list) + 1)
                tr = log_prob(transitions, prev_tag, tag, tr_denom, alpha)
                score = V[i - 1][k] + tr + em
                if score > best_score:
                    best_score = score
                    best_prev = k
            V[i][j] = best_score
            back[i][j] = best_prev

    last_best = max(range(len(tags_list)), key=lambda j: V[n - 1][j])
    path = [last_best]
    for i in range(n - 1, 0, -1):
        path.append(back[i][path[-1]])
    return [tags_list[j] for j in reversed(path)]
```

Bigram HMM trên Brown đạt độ chính xác ~ 93%.`DET NOUN`là phổ biến và `NOUN DET`là hiếm.

### Bước 3: tại sao các tagger hiện đại đánh bại điều này

Chuyển đổi + khả năng phát thải là địa phương.`saw`là một từ trong "Tôi mua một cây đeo" nhưng là một động từ trong "Tôi đã xem phim". Một CRF với các tính năng tùy tiện (đối hậu, hình chữ, từ trước và sau, từ chính nó) đạt ~97%. Một BiLSTM-CRF hoặc biến thể đạt ~98%+.

Các nhà ghi chú con người đồng ý khoảng 97% thời gian trên Penn Treebank.

### Bước 4: bản phác thảo phân tích phụ thuộc

Việc phân tích phụ thuộc hoàn toàn từ đầu là không có phạm vi; việc xử lý sách giáo khoa kinh điển là ở Jurafsky và Martin.

- **Transition-based**Các parsers (tham dự arc, arc-standard) hoạt động giống như một trình phân tích giảm chuyển: chúng đọc token, chuyển chúng vào một đống, và áp dụng các hành động giảm tạo cung.
- **Graph-based**Các parsers (định thuật của Eisner, Dozat-Manning biaffine) ghi điểm mỗi cạnh phụ thuộc vào đầu có thể và chọn cây trải dài tối đa.

Đối với hầu hết các công việc được áp dụng, gọi spaCy:

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("The cats were running at 3pm.")
for token in doc:
    print(f"{token.text:10s} tag={token.tag_:5s} pos={token.pos_:6s} dep={token.dep_:10s} head={token.head.text}")
```

```
The        tag=DT    pos=DET    dep=det        head=cats
cats       tag=NNS   pos=NOUN   dep=nsubj      head=running
were       tag=VBD   pos=AUX    dep=aux        head=running
running    tag=VBG   pos=VERB   dep=ROOT       head=running
at         tag=IN    pos=ADP    dep=prep       head=running
3pm        tag=NN    pos=NOUN   dep=pobj       head=at
.          tag=.     pos=PUNCT  dep=punct      head=running
```

Đọc `dep`cột dưới lên và cấu trúc ngữ pháp của câu rơi ra.

## Sử dụng nó

Mỗi thư viện sản xuất NLP gửi POS và các bộ phân tích phụ thuộc như là một phần của một đường ống tiêu chuẩn.

- **spaCy**(`en_core_web_sm`- `md`- `lg`- `trf`). Nhanh chóng, chính xác, tích hợp với tokenization + NER + lemmatization. `token.tag_`(Penn), `token.pos_`(UD), `token.dep_`(sự tương quan phụ thuộc).
- **Stanford NLP (stanza)**- Đại học Stanford kế nhiệm CoreNLP.
- **trankit**- Dựa trên biến thể, độ chính xác UD tốt.
- **NLTK**- `pos_tag`- Thậm chí, chậm, già hơn, tốt cho việc dạy.

### Nếu điều này vẫn quan trọng vào năm 2026

- **Lemmatization.**Bài học 01 cần POS để làm việc đúng.
- **Structured extraction from LLM outputs.**Thiết lập rằng một câu được tạo tuân thủ các hạn chế ngữ pháp (ví dụ: thỏa thuận đối tượng và động từ, các sửa đổi cần thiết).
- **Aspect-based sentiment.**Các phân tích phụ thuộc cho bạn biết từ đặc tính nào thay đổi từ nào.
- **Query understanding.**"Những bộ phim do Wes Anderson đạo diễn với Bill Murray" phân hủy thành những hạn chế cấu trúc thông qua phân tích.
- **Cross-lingual transfer.**Các thẻ UD và mối quan hệ phụ thuộc là ngôn ngữ-người, cho phép phân tích cấu trúc không chụp ảnh của các ngôn ngữ mới.
- **Low-compute pipelines.**Nếu bạn không thể vận chuyển một biến đổi, POS + phụ thuộc phân tích + báo chí đưa bạn xa lạ.

## Chuyển nó

Cứ như `outputs/skill-grammar-pipeline.md`- Có thể là:

```markdown
---
name: grammar-pipeline
description: Design a classical POS + dependency pipeline for a downstream NLP task.
version: 1.0.0
phase: 5
lesson: 07
tags: [nlp, pos, parsing]
---

Given a downstream task (information extraction, rewrite validation, query decomposition, lemmatization), you output:

1. Tagset to use. Penn Treebank for English-only legacy pipelines, Universal Dependencies for multilingual or cross-lingual.
2. Library. spaCy for most production, stanza for academic-grade multilingual, trankit for highest UD accuracy. Name the specific model ID.
3. Integration pattern. Show the 3-5 lines that call the library and consume the needed attributes (`.pos_`, `.dep_`, `.head`).
4. Failure mode to test. Noun-verb ambiguity (`saw`, `book`, `can`) and PP-attachment ambiguity are the classical traps. Sample 20 outputs and eyeball.

Refuse to recommend rolling your own parser. Building parsers from scratch is a research project, not an application task. Flag any pipeline that consumes POS tags without handling lowercase/uppercase variants as fragile.
```

## Các bài tập

1. **Easy.**Sử dụng đường cơ sở thẻ thường xuyên nhất trên một tập hợp nhỏ được dán nhãn (ví dụ, bộ phụ Brown của NLTK), đo độ chính xác trên các câu được giữ.
2. **Medium.**Đọc các HMM lớn trên và báo cáo độ chính xác / thu hồi mỗi thẻ.
3. **Hard.**Sử dụng phân tích phụ thuộc của spaCy để lấy các đối tượng-tên-từ-từ từ một mẫu 1000 câu. Đánh giá trên 50 bộ ba được dán nhãn bằng tay. Tài liệu khi thu thập thất bại (thường là thụ động, phối hợp và đối tượng bị loại bỏ).

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| POS tag | Word's type | Grammatical category. PTB has 36; UD has 17. |
| Penn Treebank | Standard tagset | English-specific. Fine-grained verb tenses and noun number. |
| Universal Dependencies | Multilingual tagset | Coarser than PTB; language-neutral; defaults for cross-lingual work. |
| Dependency parse | Sentence tree | Each word has one head, each edge has a grammatical relation. |
| Viterbi | Dynamic programming | Finds the highest-probability tag sequence given emissions and transitions. |

## Đọc thêm

- [Jurafsky and Martin — Speech and Language Processing, chapters 8 and 18](https://web.stanford.edu/~jurafsky/slp3/) việc xử lý sách giáo khoa kinh điển của POS và phân tích.
- [Universal Dependencies project](https://universaldependencies.org/) bộ taget và bộ sưu tập treebank đa ngôn ngữ được sử dụng bởi mỗi trình phân tích đa ngôn ngữ.
- [spaCy linguistic features guide](https://spacy.io/usage/linguistic-features) tham chiếu thực tế cho mỗi thuộc tính được nêu trên `Token`- Tôi không biết.
- [Chen and Manning (2014). A Fast and Accurate Dependency Parser using Neural Networks](https://nlp.stanford.edu/pubs/emnlp2014-depparser.pdf) tờ báo đưa các bộ phận phân tích thần kinh vào dòng chính.
