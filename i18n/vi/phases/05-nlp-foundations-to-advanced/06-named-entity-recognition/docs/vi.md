# Định nghĩa của đơn vị

> Nghe dễ dàng cho đến khi bạn đối phó với ranh giới mơ hồ, các thực thể tổ và thuật ngữ miền.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 03 (Word Embeddings)
**Time:** ~75 minutes

## Vấn đề

"Apple đã kiện Google về thỏa thuận tìm kiếm iPhone của mình ở Mỹ". Năm thực thể: Apple (ORG), Google (ORG), iPhone (PRODUCT), thỏa thuận tìm kiếm (có lẽ), US (GPE).

NER là con ngựa làm việc dưới mỗi đường ống dẫn khai thác có cấu trúc. Phân tích sơ khai, quét nhật ký tuân thủ, ẩn danh hồ sơ y tế, hiểu truy vấn tìm kiếm, cơ sở cho các phản ứng chatbot, khai thác hợp đồng pháp lý. Bạn không bao giờ hoàn toàn thấy nó; bạn luôn phụ thuộc vào nó.

Bài học này đi theo con đường cổ điển (thương pháp dựa trên quy tắc, HMM, CRF) vào con đường hiện đại (BiLSTM-CRF, sau đó là các biến đổi).

## Khái niệm

**BIO tagging**(hoặc BILOU) biến khai thác thực thể thành một vấn đề gắn nhãn chuỗi.`B-TYPE`(sự khởi đầu của tổ chức), `I-TYPE`(các tổ chức bên trong), hoặc `O`(ngoài bất kỳ đơn vị nào).

```
Apple    B-ORG
sued     O
Google   B-ORG
over     O
its      O
iPhone   B-PRODUCT
search   O
deal     O
in       O
the      O
US       B-GPE
.        O
```

Dòng các đơn vị đa token: `New B-GPE`- `York I-GPE`- `City I-GPE`Một mô hình hiểu được BIO có thể thu thập các khoảng thời gian tùy ý.

Sự tiến triển kiến trúc:

- **Rule-based.**Tìm kiếm Regex + báo chí. độ chính xác cao trên các thực thể đã biết, không bao gồm các thực thể mới.
- **HMM.**Mô hình Markov ẩn, xác suất phát hành của thẻ token, xác suất chuyển đổi từ thẻ đến thẻ, mã hóa Viterbi, được đào tạo trên dữ liệu được dán nhãn.
- **CRF.**Field Random Conditional. Giống như HMM nhưng phân biệt đối xử, vì vậy bạn có thể trộn các tính năng tùy tiện (phụng chữ, chữ viết to, từ lân cận).
- **BiLSTM-CRF.**Các tính năng thần kinh thay vì làm bằng tay. LSTM đọc câu cả hai hướng, lớp CRF ở trên thực thi các chuỗi thẻ nhất quán.
- **Transformer-based.**Định chỉnh BERT với đầu phân loại token, độ chính xác tốt nhất, tính toán tốt nhất.

```figure
ner-bio-tagging
```

## Hãy xây dựng nó

### Bước 1: Đánh dấu BIO trợ lý

```python
def spans_to_bio(tokens, spans):
    labels = ["O"] * len(tokens)
    for start, end, label in spans:
        labels[start] = f"B-{label}"
        for i in range(start + 1, end):
            labels[i] = f"I-{label}"
    return labels


def bio_to_spans(tokens, labels):
    spans = []
    current = None
    for i, label in enumerate(labels):
        if label.startswith("B-"):
            if current:
                spans.append(current)
            current = (i, i + 1, label[2:])
        elif label.startswith("I-") and current and current[2] == label[2:]:
            current = (current[0], i + 1, current[2])
        else:
            if current:
                spans.append(current)
                current = None
    if current:
        spans.append(current)
    return spans
```

```python
>>> tokens = ["Apple", "sued", "Google", "over", "iPhone", "sales", "."]
>>> labels = ["B-ORG", "O", "B-ORG", "O", "B-PRODUCT", "O", "O"]
>>> bio_to_spans(tokens, labels)
[(0, 1, 'ORG'), (2, 3, 'ORG'), (4, 5, 'PRODUCT')]
```

### Bước 2: Các tính năng được làm bằng tay

Đối với NER cổ điển (không thần kinh), các tính năng là trò chơi.

```python
def token_features(token, prev_token, next_token):
    return {
        "lower": token.lower(),
        "is_upper": token.isupper(),
        "is_title": token.istitle(),
        "has_digit": any(c.isdigit() for c in token),
        "suffix_3": token[-3:].lower(),
        "shape": word_shape(token),
        "prev_lower": prev_token.lower() if prev_token else "<BOS>",
        "next_lower": next_token.lower() if next_token else "<EOS>",
    }


def word_shape(word):
    out = []
    for c in word:
        if c.isupper():
            out.append("X")
        elif c.islower():
            out.append("x")
        elif c.isdigit():
            out.append("d")
        else:
            out.append(c)
    return "".join(out)
```

`word_shape("iPhone")`trả lại `xXxxxx`- `word_shape("USA-2024")`trả lại `XXX-dddd`Các mô hình vốn hóa là tín hiệu cao cho các từ chính xác.

### Bước 3: một quy tắc đơn giản + từ điển cơ sở

```python
ORG_GAZETTEER = {"Apple", "Google", "Microsoft", "OpenAI", "Meta", "Amazon", "Netflix"}
GPE_GAZETTEER = {"US", "USA", "UK", "India", "Germany", "France"}
PRODUCT_GAZETTEER = {"iPhone", "Android", "Windows", "ChatGPT", "Claude"}


def rule_based_ner(tokens):
    labels = []
    for token in tokens:
        if token in ORG_GAZETTEER:
            labels.append("B-ORG")
        elif token in GPE_GAZETTEER:
            labels.append("B-GPE")
        elif token in PRODUCT_GAZETTEER:
            labels.append("B-PRODUCT")
        else:
            labels.append("O")
    return labels
```

Các tờ báo sản xuất có hàng triệu mục được thu thập từ Wikipedia và DBpedia.`Apple`(The company vs. the fruit) là khủng khiếp. Đó là lý do tại sao các mô hình thống kê đã thắng.

### Bước 4: Bước CRF (phác thảo, không phải impl hoàn chỉnh)

CRF đầy đủ từ đầu trong 50 dòng không có sự sáng tỏ mà không có cơ sở lý thuyết xác suất.`sklearn-crfsuite`thay vào đó:

```python
import sklearn_crfsuite

def to_features(tokens):
    out = []
    for i, tok in enumerate(tokens):
        prev = tokens[i - 1] if i > 0 else ""
        nxt = tokens[i + 1] if i + 1 < len(tokens) else ""
        out.append({
            "word.lower()": tok.lower(),
            "word.isupper()": tok.isupper(),
            "word.istitle()": tok.istitle(),
            "word.isdigit()": tok.isdigit(),
            "word.suffix3": tok[-3:].lower(),
            "word.shape": word_shape(tok),
            "prev.word.lower()": prev.lower(),
            "next.word.lower()": nxt.lower(),
            "BOS": i == 0,
            "EOS": i == len(tokens) - 1,
        })
    return out


crf = sklearn_crfsuite.CRF(algorithm="lbfgs", c1=0.1, c2=0.1, max_iterations=100, all_possible_transitions=True)
X_train = [to_features(s) for s in sentences_tokenized]
crf.fit(X_train, bio_labels_train)
```

`c1`và `c2`là L1 và L2 đều được điều chỉnh. `all_possible_transitions=True`cho phép mô hình học các chuỗi bất hợp pháp (ví dụ:`I-ORG`sau đó`O`) không có khả năng, đó là cách mà một CRF thực thi sự phù hợp của BIO mà không cần bạn viết ra giới hạn.

### Bước 5: BiLSTM-CRF thêm gì

Các tính năng được học. Các đầu vào: token embed (GloVe hoặc fastText). LSTM đọc từ trái sang phải và phải sang trái. Các trạng thái ẩn bị kết hợp đi qua một lớp sản xuất CRF. CRF vẫn áp dụng tính nhất quán chuỗi thẻ; LSTM thay thế các tính năng thủ công bằng các tính năng được học.

```python
import torch
import torch.nn as nn


class BiLSTM_CRF_Head(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, n_labels):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, bidirectional=True, batch_first=True)
        self.fc = nn.Linear(hidden_dim * 2, n_labels)

    def forward(self, token_ids):
        e = self.embed(token_ids)
        h, _ = self.lstm(e)
        emissions = self.fc(h)
        return emissions
```

Đối với lớp CRF, sử dụng `torchcrf.CRF`(pip cài đặt pytorch-crf). lợi nhuận trên CRF thủ công là có thể đo lường nhưng nhỏ hơn bạn mong đợi trừ khi bạn có hàng chục ngàn câu được dán nhãn.

## Sử dụng nó

spaCy đưa NER cấp sản xuất ra khỏi hộp.

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("Apple sued Google over its iPhone search deal in the US.")
for ent in doc.ents:
    print(f"{ent.text:20s} {ent.label_}")
```

```
Apple                ORG
Google               ORG
iPhone               ORG
US                   GPE
```

Lưu ý`iPhone`được dán nhãn`ORG`thay vì`PRODUCT` Mô hình nhỏ của spaCy có sự bảo hiểm đối với các đơn vị sản phẩm yếu.`en_core_web_lg`(văn hình biến đổi)`en_core_web_trf`) làm tốt hơn nữa.

Nhấp mặt cho NER dựa trên BERT:

```python
from transformers import pipeline

ner = pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")
print(ner("Apple sued Google over its iPhone in the US."))
```

```
[{'entity_group': 'ORG', 'word': 'Apple', ...},
 {'entity_group': 'ORG', 'word': 'Google', ...},
 {'entity_group': 'MISC', 'word': 'iPhone', ...},
 {'entity_group': 'LOC', 'word': 'US', ...}]
```

`aggregation_strategy="simple"`nếu bạn kết hợp các token B-X, I-X liên kết thành một span. mà không có nó, bạn sẽ nhận được các nhãn cấp token và phải tự kết hợp.

### NER dựa trên LLM (tương tự là 2026)

LLM NER không bắn và ít bắn hiện nay cạnh tranh với các mô hình được điều chỉnh tốt trên nhiều lĩnh vực, và tốt hơn đáng kể khi dữ liệu được dán nhãn là hiếm.

- **Zero-shot prompting.**Đưa cho LLM một danh sách các loại thực thể và một sơ đồ ví dụ.
- **ZeroTuneBio-style prompting.**Phân tích nhiệm vụ thành khai thác ứng viên → nghĩa giải thích → phán xét → kiểm tra lại. Một lời nhắc nhiều giai đoạn (không phải một lần) nâng độ chính xác đáng kể trên NER y sinh.
- **Dynamic prompting with RAG.**Nhận lại các ví dụ có nhãn tương tự nhất từ một bộ hạt giống nhỏ có chú thích cho mỗi cuộc gọi suy luận; xây dựng các cú nhắc vài lần trên đường bay.
- **Per-entity-type decomposition.**Đối với các tài liệu dài, một cuộc gọi duy nhất trích xuất tất cả các loại thực thể cùng một lúc sẽ mất hồi tưởng khi chiều dài tăng lên.

khuyến nghị sản xuất từ năm 2026: bắt đầu với một điểm khởi đầu bằng LLM trước khi thu thập dữ liệu đào tạo.

### Khi NER cổ điển vẫn thắng

Ngay cả khi có LLM có sẵn, NER cổ điển thắng khi:

- Ngân sách trễ dưới 50ms.
- Bạn có hàng ngàn ví dụ được dán nhãn và cần 98% + F1.
- Khu vực có một ontology ổn định nơi một CRF hoặc BiLSTM được đào tạo trước chuyển giao tốt.
- Các hạn chế quy định đòi hỏi một mô hình không tạo ra trên địa điểm.

### Ở đâu nó rơi ra

- **Domain shift.**NER có chuyên môn hợp đồng pháp lý tốt hơn một nhà báo.
- **Nested entities.**"Bank of America Tower" là một ORG và một FASILITY. BIO tiêu chuẩn không thể đại diện cho các khoảng cách chồng chéo. Bạn cần NER nhúng (những mô hình đa vượt hoặc dựa trên khoảng cách).
- **Long entities.**"Công ty bảo hiểm tiền gửi liên bang Hoa Kỳ". Các mô hình cấp token đôi khi chia rẽ điều này. Sử dụng `aggregation_strategy`hoặc sau quá trình.
- **Sparse types.**Các nhãn NER y tế như DRUG_BRAND, ADVERSE_EVENT, DOSE. Các mô hình sử dụng chung không có ý tưởng. Scispacy và BioBERT là điểm khởi đầu ở đây.

## Chuyển nó

Cứ như `outputs/skill-ner-picker.md`- Có thể là:

```markdown
---
name: ner-picker
description: Pick the right NER approach for a given extraction task.
version: 1.0.0
phase: 5
lesson: 06
tags: [nlp, ner, extraction]
---

Given a task description (domain, label set, language, latency, data volume), output:

1. Approach. Rule-based + gazetteer, CRF, BiLSTM-CRF, or transformer fine-tune.
2. Starting model. Name it (spaCy model ID, Hugging Face checkpoint ID, or "custom, trained from scratch").
3. Labeling strategy. BIO, BILOU, or span-based. Justify in one sentence.
4. Evaluation. Use `seqeval`. Always report entity-level F1 (not token-level).

Refuse to recommend fine-tuning a transformer for under 500 labeled examples unless the user already has a pretrained domain model. Flag nested entities as needing span-based or multi-pass models. Require a gazetteer audit if the user mentions "production scale" and labels are unchanged from CoNLL-2003.
```

## Các bài tập

1. **Easy.**Thực hiện`bio_to_spans`(người ngược lại của `spans_to_bio`) và kiểm tra sự phù hợp về lại và về trên 10 câu.
2. **Medium.**Đào tạo các sklearn-crfsuite CRF trên trên trên bộ dữ liệu NER tiếng Anh CoNLL-2003.`seqeval`Kết quả điển hình: ~ 84 F1.
3. **Hard.**- Đúng rồi.`distilbert-base-cased`trên một tập dữ liệu NER cụ thể về lĩnh vực (tiếu y tế, pháp lý hoặc tài chính).So sánh với mô hình spaCy nhỏ.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NER | Extract names | Label token spans with types (PERSON, ORG, GPE, DATE, ...). |
| BIO | Tagging scheme | `B-X` begins, `I-X` continues, `O` outside. |
| BILOU | Better BIO | Adds `L-X` (last), `U-X` (unit) for cleaner boundaries. |
| CRF | Structured classifier | Models transitions between labels, not just emissions. Enforces valid sequences. |
| Nested NER | Overlapping entities | One span is a different entity than a sub-span of it. BIO cannot express this. |
| Entity-level F1 | Proper NER metric | Predicted span must match true span exactly. Token-level F1 overstates accuracy. |

## Đọc thêm

- [Lample et al. (2016). Neural Architectures for Named Entity Recognition](https://arxiv.org/abs/1603.01360) giấy BiLSTM-CRF. Canonical.
- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers](https://arxiv.org/abs/1810.04805) giới thiệu mô hình phân loại token đã trở thành tiêu chuẩn.
- [spaCy linguistic features — named entities](https://spacy.io/usage/linguistic-features#named-entities) tham chiếu thực tế cho mỗi thuộc tính trên `Doc.ents`và `Span`- Tôi không biết.
- [seqeval](https://github.com/chakki-works/seqeval) thư viện métric đúng.
