# Thuyết ngữ tự nhiên  Sự liên quan văn bản

> "t liên quan đến h" có nghĩa là một đọc của con người t sẽ kết luận h là đúng. NLI là nhiệm vụ dự đoán liên quan / mâu thuẫn / trung lập.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 05 (Sentiment Analysis), Phase 5 · 13 (Question Answering)
**Time:** ~60 minutes

## Vấn đề

Anh đã xây dựng một cái tóm tắt, nó tạo ra một cái tóm tắt.

Anh đã xây dựng một chatbot. nó trả lời "có". Làm sao anh biết câu trả lời được hỗ trợ bởi đoạn trích được tìm thấy?

Bạn cần phân loại 10.000 bài báo theo chủ đề. Bạn không có nhãn huấn luyện. Bạn có thể tái sử dụng mô hình?

Cả ba vấn đề đều giảm xuống là ngôn ngữ tự nhiên.`t`và một giả thuyết `h`, là `h`liên quan đến `t`, mâu thuẫn, hoặc trung lập (không liên quan)?

- **Hallucination check:** `t`= tài liệu nguồn, `h`= tuyên bố tổng kết. Không liên quan = ảo giác.
- **Grounded QA:** `t`= đoạn truy cập,`h`= tạo ra câu trả lời. Không liên quan = tạo ra.
- **Zero-shot classification:** `t`= tài liệu,`h`= nhãn bằng lời ("Đây là về thể thao").

Một nhiệm vụ, ba sử dụng sản xuất. Đó là lý do tại sao mỗi khung đánh giá RAG gửi một mô hình NLI dưới nắp.

## Khái niệm

![NLI: three-way classification, premise vs hypothesis](../assets/nli.svg)

**The three labels.**

- **Entailment.** `t`→ `h`"Căn trên thảm" có nghĩa là "Có một con mèo".
- **Contradiction.** `t`→`h`"Căn trên thảm" mâu thuẫn với "Không có mèo".
- **Neutral.**Không có kết luận nào. "Căn chó đang trên thảm" là trung lập với "Căn chó đói".

**Not logical entailment.**NLI là suy luận ngôn ngữ * tự nhiên *  điều mà một người đọc con người điển hình sẽ suy luận, không phải là logic nghiêm ngặt. "John đi bộ với con chó của mình" liên quan đến "John có con chó" trong NLI, nhưng logic thứ nhất nghiêm ngặt chỉ thừa nhận điều đó nếu bạn chủ nghĩa hóa sở hữu.

**Datasets.**

- **SNLI**(2015). 570k cặp ghi chú của con người, tiêu đề hình ảnh như tiền đề.
- **MultiNLI**(2017). 433k cặp trên 10 thể loại.
- **ANLI**(2019). NLI đối lập. Con người đã viết các ví dụ được thiết kế đặc biệt để phá vỡ các mô hình hiện có. Khó hơn.
- **DocNLI, ConTRoL**(202021). Các cơ sở dài tài liệu.

**The architecture.**Một bộ mã hóa biến thể (BERT, RoBERTa, DeBERTa) đọc `[CLS] premise [SEP] hypothesis [SEP]`- `[CLS]`mô tả cung cấp một Softmax 3 chiều. Đào trên MNLI, đánh giá trên các điểm chuẩn đã được giữ, nhận 90% + độ chính xác trên cặp trong phân phối.

**Zero-shot via NLI.**Với một tài liệu và nhãn ứng cử viên, biến mỗi nhãn thành một giả thuyết ("Đây văn bản là về thể thao").`zero-shot-classification`đường ống.

```figure
nli-router
```

## Hãy xây dựng nó

### Bước 1: chạy mô hình NLI được đào tạo trước

```python
from transformers import pipeline

nli = pipeline("text-classification",
               model="facebook/bart-large-mnli",
               top_k=None)  # return all labels; replaces deprecated return_all_scores=True

premise = "The cat is sleeping on the couch."
hypothesis = "There is a cat in the room."

result = nli({"text": premise, "text_pair": hypothesis})[0]
print(result)
# [{'label': 'entailment', 'score': 0.97},
#  {'label': 'neutral', 'score': 0.02},
#  {'label': 'contradiction', 'score': 0.01}]
```

Đối với NLI sản xuất, `facebook/bart-large-mnli`và `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli`DeBERTa-v3 đứng đầu bảng xếp hạng.

### Bước 2: Đánh phân loại không bắn

```python
zs = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

text = "The stock market rallied after the central bank cut interest rates."
labels = ["finance", "sports", "politics", "technology"]

result = zs(text, candidate_labels=labels)
print(result)
# {'labels': ['finance', 'politics', 'technology', 'sports'],
#  'scores': [0.92, 0.05, 0.02, 0.01]}
```

Các mẫu là "ví dụ này là về {label}." theo mặc định.`hypothesis_template`Không cần dữ liệu huấn luyện, không cần điều chỉnh, hoạt động ngoài hộp.

### Bước 3: Kiểm tra độ trung thành cho RAG

```python
def is_faithful(answer, context, threshold=0.5):
    result = nli({"text": context, "text_pair": answer})[0]
    entail = next(s for s in result if s["label"] == "entailment")
    return entail["score"] > threshold
```

Đây là cốt lõi của sự trung thành RAGAS. Chia câu trả lời được tạo thành các yêu cầu nguyên tử. Kiểm tra từng yêu cầu với bối cảnh được lấy lại. Báo cáo phần nhỏ liên quan.

### Bước 4: NLI được đánh dấu bằng tay (tầm nhìn)

Nhìn xem`code/main.py`cho một đồ chơi chỉ có stdlib: tiền đề và giả thuyết được so sánh thông qua sự chồng chéo từ ngữ + phát hiện phủ nhận. Không cạnh tranh với các mô hình biến thể  nhưng nó cho thấy hình dạng của nhiệm vụ: hai văn bản vào, nhãn 3 chiều ra, mất = entropy chéo trên `{entail, contradict, neutral}`- Tôi không biết.

## Những bẫy

- **Hypothesis-only shortcuts.**Các mô hình có thể dự đoán nhãn từ giả thuyết đơn độc ở ~ 60% trên SNLI vì "không", "không ai", "không bao giờ" tương quan với mâu thuẫn.
- **Lexical overlap heuristic.**Các heuristic hậu thuẫn ("mỗi hậu thuẫn được liên quan") vượt qua SNLI nhưng không đạt HANS/ANLI. Sử dụng các điểm tham khảo đối kháng.
- **Document-length degradation.**Các mô hình NLI đơn câu giảm 20+ F1 trên các cơ sở dài tài liệu. Sử dụng các mô hình được đào tạo bằng DocNLI cho bối cảnh dài.
- **Zero-shot template sensitivity.**" ví dụ này là về {label}" so với "{label}" so với "Mem là {label}" có thể dao động độ chính xác bằng 10 điểm.
- **Domain mismatch.**MNLI đào tạo về tiếng Anh chung. Các văn bản pháp lý, y học và khoa học cần các mô hình NLI cụ thể về lĩnh vực (ví dụ: SciNLI, MedNLI).

## Sử dụng nó

Số 2026:

| Use case | Model |
|---------|-------|
| General-purpose NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| Fast / edge | `cross-encoder/nli-deberta-v3-base` |
| Zero-shot classification (lightweight) | `facebook/bart-large-mnli` |
| Document-level NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| Multilingual | `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` |
| Hallucination detection in RAG | NLI layer inside RAGAS / DeepEval |

Các 2026 met-pattern: NLI là băng dán của hiểu văn bản. Bất cứ khi nào bạn cần "a hỗ trợ B?" hoặc "a mâu thuẫn B?"  tìm kiếm NLI trước khi bạn tìm kiếm một cuộc gọi LLM khác.

## Chuyển nó

Cứ như `outputs/skill-nli-picker.md`- Có thể là:

```markdown
---
name: nli-picker
description: Pick an NLI model, label template, and evaluation setup for a classification / faithfulness / zero-shot task.
version: 1.0.0
phase: 5
lesson: 21
tags: [nlp, nli, zero-shot]
---

Given a use case (faithfulness check, zero-shot classification, document-level inference), output:

1. Model. Named NLI checkpoint. Reason tied to domain, length, language.
2. Template (if zero-shot). Verbalization pattern. Example.
3. Threshold. Entailment cutoff for the decision rule. Reason based on calibration.
4. Evaluation. Accuracy on held-out labeled set, hypothesis-only baseline, adversarial subset.

Refuse to ship zero-shot classification without a 100-example labeled sanity check. Refuse to use a sentence-level NLI model on document-length premises. Flag any claim that NLI solves hallucination — it reduces it; it does not eliminate it.
```

## Các bài tập

1. **Easy.**Đi chạy`facebook/bart-large-mnli`trên 20 bộ ba được chế tạo bằng tay (tầm, giả thuyết, nhãn) bao gồm cả ba lớp. đo độ chính xác. Thêm các cái bẫy "thông theo dõi" đối lập ("Tôi không ăn bánh" so với "Tôi ăn bánh") và xem nó bị vỡ hay không.
2. **Medium.**So sánh mẫu không chụp `"This text is about {label}"`chống lại`"The topic is {label}"`và `"{label}"`100 tiêu đề của AG News.
3. **Hard.**Xây dựng một kiểm tra độ trung thực RAG: phân hủy nguyên tử + NLI cho mỗi yêu cầu. Đánh giá trên 50 câu trả lời được tạo ra bởi RAG với bối cảnh vàng. đo tỷ lệ dương tính sai và âm tính sai so với nhãn tay.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NLI | Natural Language Inference | 3-way classification of premise-hypothesis relationship. |
| RTE | Recognizing Textual Entailment | Older name for NLI; same task. |
| Entailment | "t implies h" | A typical reader would conclude h is true given t. |
| Contradiction | "t rules out h" | A typical reader would conclude h is false given t. |
| Neutral | "undecided" | No inference from t to h either way. |
| Zero-shot classification | NLI as classifier | Verbalize labels as hypotheses, pick max entailment. |
| Faithfulness | Is the answer supported? | NLI over (retrieved context, generated answer). |

## Đọc thêm

- [Bowman et al. (2015). A large annotated corpus for learning natural language inference](https://arxiv.org/abs/1508.05326) SNLI.
- [Williams, Nangia, Bowman (2017). A Broad-Coverage Challenge Corpus for Sentence Understanding through Inference](https://arxiv.org/abs/1704.05426) MultiNLI.
- [Nie et al. (2019). Adversarial NLI](https://arxiv.org/abs/1910.14599) chỉ số chuẩn ANLI.
- [Yin, Hay, Roth (2019). Benchmarking Zero-shot Text Classification](https://arxiv.org/abs/1909.00161) NLI-as-classifier.
- [He et al. (2021). DeBERTa: Decoding-enhanced BERT with Disentangled Attention](https://arxiv.org/abs/2006.03654) con ngựa làm việc của NLI năm 2026.
