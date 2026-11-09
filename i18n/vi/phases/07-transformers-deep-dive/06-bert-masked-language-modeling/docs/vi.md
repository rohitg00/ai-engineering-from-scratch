# BERT  Mô hình hóa ngôn ngữ che đậy

> GPT dự đoán từ tiếp theo. BERT dự đoán một từ bị mất. Một câu khác biệt  và nửa thập kỷ của mọi thứ hình dạng nhúng.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 5 · 02 (Text Representation)
**Time:** ~45 minutes

## Vấn đề

Năm 2018, mỗi nhiệm vụ NLP  cảm xúc, NER, QA, liên quan  đã đào tạo mô hình riêng của nó từ đầu trên dữ liệu được dán nhãn của riêng nó. Không có điểm kiểm soát "nghiểu tiếng Anh" được đào tạo trước mà bạn có thể điều chỉnh. ELMo (2018) cho thấy bạn có thể đào tạo trước các nhúng ngữ cảnh bằng LSTM hai chiều; nó giúp nhưng không phổ biến.

BERT (Devlin et al. 2018) hỏi: nếu chúng ta lấy một bộ mã hóa biến đổi, đào tạo nó trên mỗi câu trên internet, và buộc nó dự đoán từ thiếu trong ngữ cảnh ở cả hai bên?

Kết quả: trong vòng 18 tháng BERT và các biến thể của nó (RoBERTa, ALBERT, ELECTRA) thống trị mọi bảng xếp hạng NLP hiện có. Đến năm 2020 mọi công cụ tìm kiếm, đường ống dẫn kiểm soát nội dung và hệ thống tìm kiếm ngữ nghĩa trên trái đất đều có BERT bên trong.

Trong năm 2026, các mô hình chỉ có mã hóa vẫn là công cụ phù hợp để phân loại, lấy lại và lấy lại cấu trúc. Chúng chạy nhanh hơn 510x mỗi token so với các mã hóa và nhúng của chúng là xương sống của mọi ngăn xếp tìm kiếm hiện đại. ModernBERT (Dec 2024) đã đẩy kiến trúc đến bối cảnh 8K với Flash Attention + RoPE + GeGLU.

## Khái niệm

![Masked language modeling: pick tokens, mask them, predict originals](../assets/bert-mlm.svg)

### Đèn huấn luyện

Hãy lấy một câu:`the quick brown fox jumps over the lazy dog`- Tôi không biết.

Mái 15% mã thông báo theo cách ngẫu nhiên:

```
input:  the [MASK] brown fox jumps [MASK] the lazy dog
target: the  quick brown fox jumps  over  the lazy dog
```

Tập mô hình để dự đoán các token gốc ở các vị trí che giấu.`[MASK]`ở vị trí 1 có thể sử dụng `brown fox jumps`ở vị trí 2+. Đó là điều mà GPT không thể làm.

### Quy tắc mặt nạ BERT

Trong số 15% các token được chọn để dự đoán:

- 80% được thay thế bằng `[MASK]`- Tôi không biết.
- 10% được thay thế bằng một token ngẫu nhiên.
- 10% vẫn không thay đổi.

Tại sao không phải lúc nào cũng vậy?`[MASK]`Vì...`[MASK]`Không bao giờ xuất hiện tại thời điểm suy luận.`[MASK]`ở 100% các vị trí che giấu sẽ tạo ra sự thay đổi phân phối giữa việc tập luyện trước và điều chỉnh tinh tế. 10% ngẫu nhiên + 10% không thay đổi giữ cho mô hình trung thực.

### Next Sentence Prediction (NSP)  và tại sao nó đã bị bỏ rơi

BERT gốc cũng được đào tạo về NSP: được đưa ra hai câu A và B, dự đoán nếu B theo A. RoBERTa (2019) đã xóa nó và cho thấy NSP bị tổn thương, không giúp đỡ.

### Điều gì đã thay đổi vào năm 2026: ModernBERT

Bảng ModernBERT năm 2024 đã xây dựng lại khối với những nguyên thủy năm 2026:

| Component | Original BERT (2018) | ModernBERT (2024) |
|-----------|----------------------|-------------------|
| Positional | Learned absolute | RoPE |
| Activation | GELU | GeGLU |
| Normalization | LayerNorm | Pre-norm RMSNorm |
| Attention | Full dense | Alternating local (128) + global |
| Context length | 512 | 8192 |
| Tokenizer | WordPiece | BPE |

Và không giống như đống 2018 , nó là Flash-Attention-native. Inference là 23x nhanh hơn với độ dài chuỗi 8K so với DeBERTa-v3 với điểm số GLUE tốt hơn.

### Use cases vẫn chọn một encoder vào năm 2026

| Task | Why encoder beats decoder |
|------|---------------------------|
| Retrieval / semantic search embeddings | Bidirectional context = better embedding quality per token |
| Classification (sentiment, intent, toxicity) | One forward pass; no generation overhead |
| NER / token labeling | Per-position output, natively bidirectional |
| Zero-shot entailment (NLI) | Classifier head on top of encoder |
| Reranker for RAG | Cross-encoder scoring, 10x faster than LLM rerankers |

```figure
transformer-residual
```

## Hãy xây dựng nó

### Bước 1: Hình lý che giấu

Nhìn xem`code/main.py`- chức năng`create_mlm_batch`lấy danh sách các thẻ ID, kích thước từ ngữ và xác suất mặt nạ. trả về các thẻ ID đầu vào (với mặt nạ được áp dụng) và nhãn (chỉ ở các vị trí che giấu, -100 ở nơi khác  Phản ứng chỉ số của PyTorch).

```python
def create_mlm_batch(tokens, vocab_size, mask_prob=0.15, rng=None):
    input_ids = list(tokens)
    labels = [-100] * len(tokens)
    for i, t in enumerate(tokens):
        if rng.random() < mask_prob:
            labels[i] = t
            r = rng.random()
            if r < 0.8:
                input_ids[i] = MASK_ID
            elif r < 0.9:
                input_ids[i] = rng.randrange(vocab_size)
            # else: keep original
    return input_ids, labels
```

### Bước 2: chạy dự đoán MLM trên một cơ thể nhỏ

Căn luyện một bộ mã hóa 2 lớp + đầu MLM trên một từ vựng 20 từ, 200 câu. Không gradient  chúng tôi làm kiểm tra tâm trí tiến hành.

### Bước 3: so sánh các loại mặt nạ

Hãy cho thấy cách thức của quy tắc ba chiều giữ cho mô hình có thể sử dụng mà không cần `[MASK]`- Dự đoán về một câu không che giấu và một câu che giấu. Cả hai đều nên tạo ra phân phối biểu tượng hợp lý bởi vì mô hình đã thấy cả hai mô hình trong đào tạo.

### Bước 4: đầu tinh chỉnh

Thay thế đầu MLM bằng đầu phân loại trên bộ dữ liệu cảm xúc đồ chơi. Chỉ có đầu tàu; bộ mã hóa bị đóng băng. Đây là mô hình mà mọi ứng dụng BERT theo.

## Sử dụng nó

```python
from transformers import AutoModel, AutoTokenizer

tok = AutoTokenizer.from_pretrained("answerdotai/ModernBERT-base")
model = AutoModel.from_pretrained("answerdotai/ModernBERT-base")

text = "Attention is all you need."
inputs = tok(text, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, N, 768)
```

**Embedding models are fine-tuned BERT.** `sentence-transformers`mô hình như `all-MiniLM-L6-v2`BRT được đào tạo với mất mát tương phản.

**Cross-encoder rerankers are also fine-tuned BERT.**Định dạng cặp trên `[CLS] query [SEP] doc [SEP]`Sự chú ý hai chiều giữa truy vấn và doc chính là điều cung cấp cho cross-encoder cạnh chất lượng của họ so với biencoders.

**When not to pick BERT in 2026.**Bất cứ thứ gì tạo ra. Các mã hóa không có cách hợp lý để tự tạo ra các token. Ngoài ra: bất cứ thứ gì dưới các tham số 1B nơi một decoder nhỏ có thể phù hợp với chất lượng với tính linh hoạt hơn (Phi-3-Mini, Qwen2-1.5B).

## Chuyển nó

Nhìn xem`outputs/skill-bert-finetuner.md`. Khả năng mở rộng một sự điều chỉnh BERT (chọn lựa xương sống, đặc điểm đầu, dữ liệu, đánh giá, dừng) cho một nhiệm vụ phân loại hoặc khai thác mới.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`Và in phân phối mặt nạ trên 10.000 token. xác nhận ~ 15% được chọn, và ~ 80% trở thành `[MASK]`- Tôi không biết.
2. **Medium.**Thực hiện che giấu toàn từ: nếu một từ được mã hóa thành các từ phụ, che giấu tất cả các từ phụ cùng nhau hoặc không. đo lường xem điều này có cải thiện độ chính xác MLM trên một tập hợp 500 câu không.
3. **Hard.**Trình luyện một BERT nhỏ (2 lớp, d=64) trên 10.000 câu từ một tập dữ liệu công cộng.`[CLS]`So sánh với một đường cơ sở chỉ có trình giải mã ở các param phù hợp  nào thắng?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MLM | "Masked language modeling" | Training signal: randomly replace 15% of tokens with `[MASK]`, predict the originals. |
| Bidirectional | "Looks both ways" | Encoder attention has no causal mask — every position sees every other position. |
| `[CLS]` | "The pooler token" | A special token prepended to every sequence; its final embedding is used as the sentence-level representation. |
| `[SEP]` | "Segment separator" | Separates paired sequences (e.g. query/doc, sentence A/B). |
| NSP | "Next sentence prediction" | BERT's second pretraining task; shown to be useless in RoBERTa, dropped after 2019. |
| Fine-tuning | "Adapt to a task" | Keep the encoder mostly frozen; train a small head on top for the downstream task. |
| Cross-encoder | "A reranker" | A BERT that takes both query and doc as input, outputs a relevance score. |
| ModernBERT | "2024 refresh" | Encoder rebuilt with RoPE, RMSNorm, GeGLU, alternating local/global attention, 8K context. |

## Đọc thêm

- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding](https://arxiv.org/abs/1810.04805) giấy gốc.
- [Liu et al. (2019). RoBERTa: A Robustly Optimized BERT Pretraining Approach](https://arxiv.org/abs/1907.11692) cách đào tạo BERT đúng cách; giết chết NSP.
- [Clark et al. (2020). ELECTRA: Pre-training Text Encoders as Discriminators Rather Than Generators](https://arxiv.org/abs/2003.10555) phát hiện mã hóa thay thế vượt qua MLM ở tính toán phù hợp.
- [Warner et al. (2024). Smarter, Better, Faster, Longer: A Modern Bidirectional Encoder](https://arxiv.org/abs/2412.13663) Báo ModernBERT.
- [HuggingFace `modeling_bert.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/bert/modeling_bert.py) tham chiếu mã hóa theo quy định.
