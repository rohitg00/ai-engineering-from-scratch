# NLP đa ngôn ngữ

> Một mô hình, 100+ ngôn ngữ, không có dữ liệu đào tạo cho hầu hết. Chuyển chuyển xuyên ngôn ngữ là phép lạ thực tế của những năm 2020.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 04 (GloVe, FastText, Subword), Phase 5 · 11 (Machine Translation)
**Time:** ~45 minutes

## Vấn đề

Tiếng Anh có hàng tỷ ví dụ được dán nhãn. Tiếng Urdu có hàng ngàn ví dụ. Tiếng Maithili gần như không có ví dụ nào. Bất kỳ hệ thống NLP thực tế nào phục vụ một khán giả toàn cầu phải làm việc trên đuôi dài của các ngôn ngữ mà không có dữ liệu đào tạo cụ thể về nhiệm vụ.

Các mô hình đa ngôn ngữ giải quyết vấn đề này bằng cách đào tạo một mô hình trên nhiều ngôn ngữ cùng một lúc. Sự đại diện được chia sẻ cho phép mô hình chuyển giao các kỹ năng được học trong các ngôn ngữ có nguồn lực cao sang các ngôn ngữ có nguồn lực thấp. Định chỉnh mô hình dựa trên phân tích cảm xúc tiếng Anh, và nó tạo ra những dự đoán cảm xúc đáng ngạc nhiên về tiếng Urdu. Đó là chuyển đổi ngôn ngữ qua không, và nó đã định hình lại cách NLP chuyển sang thế giới.

Bài học này nêu tên những sự thỏa hiệp, các mô hình truyền thống, và quyết định duy nhất khiến các nhóm mới làm việc đa ngôn ngữ: chọn một ngôn ngữ nguồn để chuyển.

## Khái niệm

![Cross-lingual transfer via shared multilingual embedding space](../assets/multilingual.svg)

**Shared vocabulary.**Các mô hình đa ngôn ngữ sử dụng một token SentencePiece hoặc WordPiece được đào tạo trên văn bản từ tất cả các ngôn ngữ mục tiêu.`anti-`bằng tiếng Anh và tiếng Ý có được cùng một dấu hiệu.

**Shared representation.**Một người biến đổi được đào tạo trước trên mô hình hóa ngôn ngữ mặt nạ trên nhiều ngôn ngữ học được rằng các câu ngữ nghĩa tương tự trong các ngôn ngữ khác nhau tạo ra các trạng thái ẩn tương tự. mBERT, XLM-R và NLLB đều thể hiện điều này.

**Zero-shot transfer.**Định chỉnh mô hình trên dữ liệu được dán nhãn bằng một ngôn ngữ (thường là tiếng Anh). Khi suy luận, chạy nó trên bất kỳ ngôn ngữ nào khác mà mô hình hỗ trợ. Không cần các nhãn ngôn ngữ mục tiêu. Kết quả mạnh mẽ cho các ngôn ngữ có liên quan theo kiểu và yếu hơn cho các ngôn ngữ xa hơn.

**Few-shot fine-tuning.**Thêm 100-500 ví dụ được dán nhãn trong ngôn ngữ mục tiêu. Độ chính xác nhảy lên 95-98% của đường cơ sở tiếng Anh về các nhiệm vụ phân loại. Đây là đòn bẩy chi phí hiệu quả nhất trong NLP đa ngôn ngữ.

## Các mô hình

| Model | Year | Coverage | Notes |
|-------|------|----------|-------|
| mBERT | 2018 | 104 languages | Trained on Wikipedia. First practical multilingual LM. Weak on low-resource. |
| XLM-R | 2019 | 100 languages | Trained on CommonCrawl (much larger than Wikipedia). Sets the cross-lingual baseline. Base 270M, Large 550M. |
| XLM-V | 2023 | 100 languages | XLM-R with 1M-token vocabulary (vs 250k). Better on low-resource. |
| mT5 | 2020 | 101 languages | T5 architecture for multilingual generation. |
| NLLB-200 | 2022 | 200 languages | Meta's translation model; includes 55 low-resource languages. |
| BLOOM | 2022 | 46 languages + 13 programming | Open 176B LLM trained multilingually. |
| Aya-23 | 2024 | 23 languages | Cohere's multilingual LLM. Strong on Arabic, Hindi, Swahili. |

Chọn theo trường hợp sử dụng. Việc phân loại hoạt động tốt với XLM-R-base như là mặc định hợp lý. Các nhiệm vụ thế hệ yêu cầu mT5 hoặc NLLB tùy thuộc vào phiên dịch so với thế hệ mở. Các cặp làm việc theo phong cách LLM với Aya-23 hoặc Claude sử dụng nhắc nhở đa ngôn ngữ rõ ràng.

## Quyết định về ngôn ngữ nguồn (2026 nghiên cứu)

Hầu hết các nhóm đều mặc định sử dụng tiếng Anh như nguồn điều chỉnh tinh tế.

Sự tương đồng ngôn ngữ dự đoán chất lượng chuyển giao tốt hơn kích thước cơ thể thô. Đối với các mục tiêu Slavic, tiếng Đức hoặc tiếng Nga thường đánh bại tiếng Anh. Đối với các mục tiêu Ấn Độ, tiếng Hindi thường đánh bại tiếng Anh.**qWALS**Metric tương đồng (2026, dựa trên các tính năng của World Atlas of Language Structures) định lượng điều này. **LANGRANK**(Lin et al., ACL 2019) là một phương pháp riêng biệt, sớm hơn xếp hạng các ngôn ngữ nguồn ứng cử viên từ sự kết hợp của sự tương đồng ngôn ngữ, kích thước cơ thể và liên quan di truyền.

Quy tắc thực tế: nếu ngôn ngữ mục tiêu của bạn có một người thân có nguồn lực cao, hãy thử điều chỉnh kỹ trước, sau đó so sánh với tiếng Anh.

```figure
n5-crosslingual-bridge
```

## Hãy xây dựng nó

### Bước 1: phân loại qua ngôn ngữ không có dấu hiệu

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

tok = AutoTokenizer.from_pretrained("joeddav/xlm-roberta-large-xnli")
model = AutoModelForSequenceClassification.from_pretrained("joeddav/xlm-roberta-large-xnli")


def classify(text, candidate_labels, hypothesis_template="This text is about {}."):
    scores = {}
    for label in candidate_labels:
        hypothesis = hypothesis_template.format(label)
        inputs = tok(text, hypothesis, return_tensors="pt", truncation=True)
        with torch.no_grad():
            logits = model(**inputs).logits[0]
        entail_score = torch.softmax(logits, dim=-1)[2].item()
        scores[label] = entail_score
    return dict(sorted(scores.items(), key=lambda x: -x[1]))


print(classify("I love this product!", ["positive", "negative", "neutral"]))
print(classify("मुझे यह उत्पाद पसंद है!", ["positive", "negative", "neutral"]))
print(classify("J'adore ce produit !", ["positive", "negative", "neutral"]))
```

Một mô hình, ba ngôn ngữ, cùng một API. XLM-R được đào tạo trên NLI dữ liệu chuyển tốt đến phân loại thông qua thủ thuật liên kết.

### Bước 2: không gian nhúng đa ngôn ngữ

```python
from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

pairs = [
    ("The cat is sleeping.", "Le chat dort."),
    ("The cat is sleeping.", "El gato está durmiendo."),
    ("The cat is sleeping.", "Die Katze schläft."),
    ("The cat is sleeping.", "The dog is barking."),
]

for eng, other in pairs:
    emb_eng = model.encode([eng], normalize_embeddings=True)[0]
    emb_other = model.encode([other], normalize_embeddings=True)[0]
    sim = float(np.dot(emb_eng, emb_other))
    print(f"  {eng!r} <-> {other!r}: cos={sim:.3f}")
```

Các bản dịch kết thúc gần trong không gian nhúng. Một câu tiếng Anh khác đi xa hơn. Đây là điều làm cho việc tìm kiếm, nhóm và tương đồng giữa các ngôn ngữ hoạt động.

### Bước 3: Chiến lược điều chỉnh tinh tế ít ảnh

```python
from transformers import TrainingArguments, Trainer
from datasets import Dataset


def few_shot_finetune(base_model, base_tokenizer, examples):
    ds = Dataset.from_list(examples)

    def tokenize_fn(ex):
        out = base_tokenizer(ex["text"], truncation=True, max_length=128)
        out["labels"] = ex["label"]
        return out

    ds = ds.map(tokenize_fn)
    args = TrainingArguments(
        output_dir="out",
        per_device_train_batch_size=8,
        num_train_epochs=5,
        learning_rate=2e-5,
        save_strategy="no",
    )
    trainer = Trainer(model=base_model, args=args, train_dataset=ds)
    trainer.train()
    return base_model
```

Đối với 100-500 ví dụ về ngôn ngữ mục tiêu, `num_train_epochs=5`và `learning_rate=2e-5`Tỷ lệ học tập cao hơn khiến sự sắp xếp đa ngôn ngữ sụp đổ và bạn có được mô hình chỉ bằng tiếng Anh.

## Đánh giá thực sự hiệu quả

- **Per-language accuracy on held-out sets.**Không được tổng hợp, tổng hợp ẩn lại đuôi dài.
- **Benchmark against monolingual baseline.**Đối với các ngôn ngữ có đủ dữ liệu, một mô hình đơn ngôn ngữ được đào tạo từ đầu đôi khi vượt qua một ngôn ngữ đa ngôn ngữ.
- **Entity-level tests.**Các mô hình đa ngôn ngữ thường có biểu tượng yếu cho các chữ viết xa từ tiếng Latinh.
- **Cross-lingual consistency.**cùng một ý nghĩa trong hai ngôn ngữ nên tạo ra dự đoán tương tự.

## Sử dụng nó

Số 2026:

| Task | Recommended |
|-----|-------------|
| Classification, 100 languages | XLM-R-base (~270M) fine-tuned |
| Zero-shot text classification | `joeddav/xlm-roberta-large-xnli` |
| Multilingual sentence embeddings | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| Translation, 200 languages | `facebook/nllb-200-distilled-600M` (see lesson 11) |
| Generative multilingual | Claude, GPT-4, Aya-23, mT5-XXL |
| Low-resource language NLP | XLM-V or a domain-specific fine-tune on related high-resource language |

Luôn luôn có ngân sách để điều chỉnh kỹ lưỡng trong ngôn ngữ mục tiêu nếu hiệu suất quan trọng.

### Thuế token hóa (điều gì sẽ không ổn cho các ngôn ngữ nguồn lực thấp)

Các mô hình đa ngôn ngữ chia sẻ một token trên tất cả các ngôn ngữ của họ. Thuật từ đó được đào tạo trên một tập hợp thống trị bởi tiếng Anh, tiếng Pháp, tiếng Tây Ban Nha, tiếng Trung, tiếng Đức. Đối với bất kỳ ngôn ngữ nào bên ngoài tập hợp thống trị, ba loại thuế được hợp tác lặng lẽ:

- **Fertility tax.**Các văn bản ngôn ngữ có nguồn lực thấp được mã hóa thành nhiều mã thông báo hơn nhiều so với tiếng Anh. Một câu tiếng Hindi có thể cần 3-5 lần mã thông báo của một câu tiếng Anh tương đương. 3-5 lần đó tiêu thụ cửa sổ ngữ cảnh, hiệu quả đào tạo và độ trễ của bạn.
- **Variant recovery tax.**Mỗi lỗi đánh chữ, biến thể biểu ngữ, sự không phù hợp của chuẩn hóa Unicode hoặc biến thể trường hợp trở thành một chuỗi không liên quan bắt đầu lạnh trong không gian nhúng. Mô hình không thể học các tương ứng chữ viết mà người nói bản địa coi là hiển nhiên.
- **Capacity spillover tax.**Thuế 1 và 2 tiêu thụ vị trí ngữ cảnh, độ sâu lớp và kích thước nhúng. Những gì còn lại cho lý luận thực tế là hệ thống nhỏ hơn những gì một ngôn ngữ có nguồn lực cao nhận được từ cùng một mô hình.

Các triệu chứng thực tế: mô hình của bạn thường tập luyện bằng tiếng Hindi, đường cong mất mát trông đúng, sự bối rối đánh giá trông hợp lý, và kết quả sản xuất là sai lầm tinh tế. Morphology sụp đổ giữa câu.**You cannot data-scale your way out of a broken tokenizer.**

Giảm thiểu: chọn một tokenizer với sự bao phủ tốt cho ngôn ngữ mục tiêu của bạn (từ 1M-token của XLM-V là một sự cố trực tiếp); kiểm tra khả năng sinh sản của token hóa trên văn bản mục tiêu được giữ trước khi đào tạo; sử dụng các fallback cấp byte (SentencePiece `byte_fallback=True`, GPT-2- kiểu BPE cấp bayt) cho thực sự long-tail script vì vậy không có gì là OOV bao giờ.

## Chuyển nó

Cứ như `outputs/skill-multilingual-picker.md`- Có thể là:

```markdown
---
name: multilingual-picker
description: Pick source language, target model, and evaluation plan for a multilingual NLP task.
version: 1.0.0
phase: 5
lesson: 18
tags: [nlp, multilingual, cross-lingual]
---

Given requirements (target languages, task type, available labeled data per language), output:

1. Source language for fine-tuning. Default English; check LANGRANK or qWALS if target language has a typologically close high-resource language.
2. Base model. XLM-R (classification), mT5 (generation), NLLB (translation), Aya-23 (generative LLM).
3. Few-shot budget. Start with 100-500 target-language examples if available. Zero-shot only if labeling is infeasible.
4. Evaluation plan. Per-language accuracy (not aggregate), cross-lingual consistency, entity-level F1 on non-Latin scripts.

Refuse to ship a multilingual model without per-language evaluation — aggregate metrics hide long-tail failures. Flag scripts with low tokenization coverage (Amharic, Tigrinya, many African languages) as needing a model with byte-fallback (SentencePiece with byte_fallback=True, or byte-level tokenizer like GPT-2).
```

## Các bài tập

1. **Easy.**Hãy chạy đường ống phân loại bằng cách không chụp trên 10 câu mỗi ngôn ngữ trên tiếng Anh, tiếng Pháp, tiếng Hindi và tiếng Ả Rập. Báo cáo chính xác trên mỗi. Bạn nên thấy tiếng Pháp mạnh mẽ, tiếng Hindi tốt, tiếng Ả Rập biến.
2. **Medium.**Sử dụng `paraphrase-multilingual-MiniLM-L12-v2`để xây dựng một máy tìm kiếm đa ngôn ngữ trên một tập hợp ngôn ngữ hỗn hợp nhỏ.
3. **Hard.**So sánh nguồn tiếng Anh và nguồn tiếng Hindi để làm việc trong phân loại tiếng Hindi. Sử dụng 500 ví dụ ngôn ngữ mục tiêu để làm việc trong hai chế độ. Báo cáo nguồn nào tạo ra độ chính xác tiếng Hindi tốt hơn và bằng bao nhiêu. Đây là luận án LANGRANK trong mô hình nhỏ.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Multilingual model | One model, many languages | Shared vocabulary and parameters across languages. |
| Cross-lingual transfer | Train on one language, run on another | Fine-tune on source, evaluate on target without target-language labels. |
| Zero-shot | No target-language labels | Transfer without fine-tuning on the target language. |
| Few-shot | Small target labels | 100-500 target-language examples used for fine-tuning. |
| mBERT | First multilingual LM | 104-language BERT pretrained on Wikipedia. |
| XLM-R | Standard cross-lingual baseline | 100-language RoBERTa pretrained on CommonCrawl. |
| NLLB | Meta's 200-language MT | No Language Left Behind. Includes 55 low-resource languages. |

## Đọc thêm

- [Conneau et al. (2019). Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116) giấy XLM-R.
- [Pires, Schlinger, Garrette (2019). How Multilingual is Multilingual BERT?](https://arxiv.org/abs/1906.01502) bài phân tích bắt đầu dòng nghiên cứu chuyển đổi xuyên ngôn ngữ.
- [Costa-jussà et al. (2022). No Language Left Behind](https://arxiv.org/abs/2207.04672) NLLB-200 giấy tờ.
- [Üstün et al. (2024). Aya Model: An Instruction Finetuned Open-Access Multilingual Language Model](https://arxiv.org/abs/2402.07827)Aya, Thạc sĩ Luật đa ngôn ngữ của Cohere.
- [Language Similarity Predicts Cross-Lingual Transfer Learning Performance (2026)](https://www.mdpi.com/2504-4990/8/3/65) giấy ngôn ngữ nguồn QWALS / LANGRANK.
