# T5, BART  Mô hình mã hóa-tử lý

> Các mã hóa hiểu. Các mã hóa tạo ra. Hãy đặt chúng lại với nhau và bạn sẽ có một mô hình được xây dựng cho các nhiệm vụ đầu vào → đầu ra: dịch, tóm tắt, viết lại, sao chép.

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## Vấn đề

Chỉ có GPT và BERT chỉ có mã hóa mỗi đoạn cắt theo kiến trúc năm 2017 cho một mục tiêu khác nhau.

- Dịch: tiếng Anh → tiếng Pháp.
- Kết luận: 5000 token bài viết → 200 token tổng kết.
- Nhận dạng giọng nói: mã thông báo âm thanh → mã thông báo văn bản.
- Phân xuất cấu trúc: prose → JSON.

Đối với những thứ này, bộ mã hóa-cập mã làm cho phù hợp nhất. bộ mã hóa tạo ra một đại diện dày đặc của nguồn. bộ mã hóa tạo ra đầu ra, phục vụ chéo cho đại diện đó ở mỗi bước. Trình luyện là chuyển đổi từng người ở phía đầu ra.

Hai bài báo đã định nghĩa cuốn sách chơi game hiện đại:

1. **T5**(Raffel et al. 2019). "Transformer Transfer Text-to-Text". Mỗi nhiệm vụ NLP được định dạng lại như text-in, text-out. kiến trúc đơn, từ vựng đơn, mất mát đơn. Được đào tạo trước trên dự đoán thời gian đeo mặt nạ (nhanh tham nhũng trong đầu vào, giải mã chúng trong đầu ra).
2. **BART**(Lewis et al. 2019). "Tranformator hai chiều và tự động hồi phục". Phể bỏ autoencoder: nhập nhập bị hư hại theo nhiều cách (xuy nhộn, che giấu, xóa, xoay), yêu cầu máy giải mã tái tạo bản gốc.

Năm 2026, định dạng mã hóa-tài mã hóa sẽ tồn tại ở những nơi cấu trúc đầu vào quan trọng:

- Nhầm (những lời nói → văn bản).
- Google dịch vụ.
- Một số mô hình hoàn thành / sửa chữa mã có cấu trúc ngữ cảnh và chỉnh sửa khác nhau.
- Flan-T5 và các biến thể cho các nhiệm vụ lý luận có cấu trúc.

Chỉ có decoder đã giành được sự chú ý, nhưng decoder không bao giờ biến mất.

## Khái niệm

![Encoder-decoder with cross-attention](../assets/encoder-decoder.svg)

### Chuyện chuyển tiếp

```
source tokens ─▶ encoder ─▶ (N_src, d_model)  ──┐
                                                 │
target tokens ─▶ decoder block                   │
                 ├─▶ masked self-attention       │
                 ├─▶ cross-attention ◀───────────┘
                 └─▶ FFN
                ↓
              next-token logits
```

Điều quan trọng là bộ mã hóa chạy một lần mỗi đầu vào. Bộ mã hóa chạy tự động nhưng phục vụ qua nhau cho * cùng một * đầu ra mã hóa tại mỗi bước. Caching đầu ra mã hóa là một tốc độ miễn phí cho đầu vào dài.

### T5 trước khi đào tạo  tham nhũng thời gian

Chọn các khoảng thời gian ngẫu nhiên của đầu vào (giờ trung bình là 3 token, tổng cộng là 15%). Thay thế mỗi khoảng thời gian bằng một sentinel độc đáo: `<extra_id_0>`- `<extra_id_1>`, vv. Các decoder chỉ phát ra các span bị hỏng với tiền tố của họ Sentinel:

```
source: The quick <extra_id_0> fox jumps <extra_id_1> dog
target: <extra_id_0> brown <extra_id_1> over the lazy
```

tín hiệu rẻ hơn so với dự đoán toàn bộ chuỗi. cạnh tranh với MLM (BERT) và tiền tố-LM (UniLM) trong giấy T5 của ablation.

### BART trước khi tập                                                                                                                                                                                                                                                             

BART thử nghiệm năm chức năng âm thanh:

1. - Đánh dấu.
2. - Đánh dấu.
3. Đơn văn bản (đóng một khoảng thời gian, trình giải mã chèn chiều dài đúng).
4. Chuyển đổi câu.
5. Chuyển đổi tài liệu.

Kết hợp việc lấp đầy văn bản + chuyển đổi câu tạo ra các số lượng thấp nhất. Bộ giải mã luôn tái tạo nguyên bản. Kết quả của BART là toàn bộ chuỗi, không chỉ là các khoảng thời gian bị hỏng  vì vậy tính toán trước khi tập là cao hơn T5.

### Nhận định

Tạo tự động ngược giống như GPT. Phân tích tham lam / chùm / top-p áp dụng. Tìm kiếm chùm (thiều 45) là tiêu chuẩn cho dịch và tóm tắt vì phân phối đầu ra hẹp hơn trò chuyện.

### Khi nào để chọn mỗi biến thể vào năm 2026

| Task | Encoder-decoder? | Why |
|------|------------------|-----|
| Translation | Yes, usually | Clear source sequence; fixed output distribution; beam search works |
| Speech-to-text | Yes (Whisper) | Input modality differs from output; encoder shapes audio features |
| Chat / reasoning | No, decoder-only | No persistent "input" — the conversation is the sequence |
| Code completion | Usually no | Decoder-only with long context wins; code models like Qwen 2.5 Coder are decoder-only |
| Summarization | Either works | BART, PEGASUS beat earlier decoder-only baselines; modern decoder-only LLMs match them |
| Structured extraction | Either | T5 is clean because "text → text" absorbs any output format |

Xu hướng từ ~2022: chỉ có trình giải mã tiếp quản các nhiệm vụ mà trình giải mã giải mã đã từng sở hữu bởi vì (a) các LLM chỉ có trình giải mã theo hướng dẫn tổng quát đến bất cứ thứ gì thông qua lời nhắc nhở, (b) một kiến trúc quy mô dễ dàng hơn hai, (c) RLHF giả định một trình giải mã.

```figure
encoder-decoder
```

## Hãy xây dựng nó

Nhìn xem`code/main.py`Chúng tôi thực hiện sự tham nhũng thời gian kiểu T5 cho một bộ đồ chơi. Đây là một phần hữu ích nhất của bài học này bởi vì nó xuất hiện trong mọi công thức trước khi tập lập trình và giải mã kể từ đó.

### Bước 1: sự tham nhũng span

```python
def corrupt_spans(tokens, mask_rate=0.15, mean_span=3.0, rng=None):
    """Pick spans summing to ~mask_rate of tokens. Return (corrupted_input, target)."""
    n = len(tokens)
    n_mask = max(1, int(n * mask_rate))
    n_spans = max(1, int(round(n_mask / mean_span)))
    ...
```

Các định dạng mục tiêu là T5 ước: `<sent0> span0 <sent1> span1 ...`. Lập nhập bị hỏng để lại các token không thay đổi với các token Sentinel tại các vị trí span.

### Bước 2: xác minh đi lại và đi lại

Với các mục tiêu và đầu vào bị hỏng, hãy xây dựng lại câu gốc. Nếu sự hỏng của bạn là đảo ngược, thông qua trước được xác định rõ ràng. Đây là kiểm tra tâm lý  đào tạo thực sự không bao giờ làm điều này, nhưng bài kiểm tra rẻ và bắt được lỗi theo một trong sổ sách thời gian của bạn.

### Bước 3: BART tiếng ồn

Năm chức năng: `token_mask`- `token_delete`- `text_infill`- `sentence_permute`- `document_rotate`- Tạo hai trong số đó và cho thấy kết quả.

## Sử dụng nó

Chuyện em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em em

```python
from transformers import T5ForConditionalGeneration, T5Tokenizer
tok = T5Tokenizer.from_pretrained("google/flan-t5-base")
model = T5ForConditionalGeneration.from_pretrained("google/flan-t5-base")

inputs = tok("translate English to French: Attention is all you need.", return_tensors="pt")
out = model.generate(**inputs, max_new_tokens=32)
print(tok.decode(out[0], skip_special_tokens=True))
```

Trù T5: tên nhiệm vụ đi vào văn bản nhập. mô hình tương tự xử lý hàng chục nhiệm vụ vì mỗi nhiệm vụ là text-in, text-out. Năm 2026 mô hình này đã được phổ biến bởi các mô hình chỉ định-tuning decoder, nhưng T5 đã mã hóa nó trước.

## Chuyển nó

Nhìn xem`outputs/skill-seq2seq-picker.md`. Kỹ năng chọn giữa mã hóa-decoder và mã hóa-chỉ cho một nhiệm vụ mới do cấu trúc đầu vào-tả ra, độ trễ và mục tiêu chất lượng.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`, áp dụng sự tham nhũng khoảng thời gian cho một câu 30 token, xác minh rằng kết nối các token nguồn không phải Sentinel với các khoảng thời gian mục tiêu được giải mã tái tạo bản gốc.
2. **Medium.**Thực hiện BART `text_infill`tiếng ồn: thay thế các khoảng thời gian ngẫu nhiên bằng một `<mask>`token, và decoder phải suy luận chiều dài span đúng cộng với nội dung.
3. **Hard.**- Đúng rồi.`flan-t5-small`trên một bộ hình tiếng Anh → Lâm-Latin nhỏ (200 cặp). đo BLEU trên một bộ 50 cặp kéo dài. So sánh với điều chỉnh tinh tế `Llama-3.2-1B`trên cùng một dữ liệu với cùng một tính toán.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Encoder-decoder | "Seq2seq transformer" | Two stacks: bidirectional encoder for input, causal decoder with cross-attention for output. |
| Cross-attention | "Where source talks to target" | Decoder's Q × encoder's K/V. The only place encoder information enters the decoder. |
| Span corruption | "T5's pretraining trick" | Replace random spans with sentinel tokens; decoder outputs the spans. |
| Denoising objective | "BART's game" | Apply a noise function to the input, train the decoder to reconstruct the clean sequence. |
| Sentinel token | "The `<extra_id_N>` placeholder" | Special tokens that tag corrupted spans in the source and re-tag them in the target. |
| Flan | "Instruction-tuned T5" | T5 fine-tuned on >1,800 tasks; made encoder-decoder competitive at instruction-following. |
| Beam search | "Decoding strategy" | Keep top-k partial sequences at each step; standard for translation/summarization. |
| Teacher forcing | "Training-time input" | During training, feed the true previous output token to the decoder, not the sampled one. |

## Đọc thêm

- [Raffel et al. (2019). Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer](https://arxiv.org/abs/1910.10683) T5.
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training for Natural Language Generation, Translation, and Comprehension](https://arxiv.org/abs/1910.13461) BART.
- [Chung et al. (2022). Scaling Instruction-Finetuned Language Models](https://arxiv.org/abs/2210.11416) Flan-T5.
- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) Whisper, bộ mã hóa-tử toán của năm 2026
- [HuggingFace `modeling_t5.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/t5/modeling_t5.py) thực hiện tham chiếu.
