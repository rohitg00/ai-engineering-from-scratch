# Nhầm  Kiến trúc & Định vị

> Whisper là một bộ mã hóa-tử toán biến đổi cửa sổ 30 giây, được đào tạo trên 680k giờ của các cặp âm thanh văn bản đa ngôn ngữ bị giám sát kém.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04 (ASR), Phase 5 · 10 (Attention), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## Vấn đề

Whisper, được phát hành bởi OpenAI vào tháng 9 năm 2022, là mô hình ASR đầu tiên được xuất khẩu như một hàng hóa: dán âm thanh, nhận văn bản, 99 ngôn ngữ, mạnh mẽ với tiếng ồn, chạy trên máy tính xách tay. Đến năm 2024 OpenAI đã xuất khẩu các biến thể Large-v3 và Turbo; đến năm 2026, Whisper là cơ sở mặc định cho mọi thứ từ bản sao podcast đến trợ lý giọng nói đến phụ đề YouTube.

Nhưng Whisper không phải là một đường ống dẫn mà bạn có thể đối xử như một hộp đen mãi mãi.

1. Cái gì đó thực sự là bên trong.
2. Làm thế nào để cung cấp nó chunked, streaming, hoặc hình thức dài âm thanh chính xác.
3. Khi nào và làm thế nào để điều chỉnh.

## Khái niệm

![Whisper encoder-decoder, tasks, chunked inference, fine-tune](../assets/whisper.svg)

**Architecture.**Bộ mã hóa-tử toán biến đổi tiêu chuẩn.

- Nhập: 30 giây log-mel spectrogram, 80 mels, 10 ms hop → 3000 khung hình. clip ngắn hơn là không đệm, clip dài hơn là mảnh.
- Mã hóa: con-downsample (phases 2) + `N`Các khối biến đổi. cho V3 lớn: 32 lớp, 1280 độ sâu, 20 đầu.
- - Thử giải mã:`N`khối biến đổi với tự-attn nguyên nhân + giao tiếp với đầu ra mã hóa. cùng kích thước với mã hóa.
- Kết quả: BPE token trên một từ ngữ 51,865 token.

Large-v3 có param 1.55B. Turbo sử dụng một decoder 4 lớp (từ 32), cắt độ trễ 8x với một hit WER < 1%.

**The prompt format.**Whisper là một mô hình đa nhiệm được điều khiển bởi các token đặc biệt trong lệnh giải mã:

```
<|startoftranscript|><|en|><|transcribe|><|notimestamps|> Hello world.<|endoftext|>
```

- `<|en|>`: Tag ngôn ngữ; tên ngôn ngữ được nói trong âm thanh. Hãy bỏ nó ra và Whisper phát hiện ngôn ngữ trước.
- `<|transcribe|>`hoặc `<|translate|>`: task tag; dịch bài phát biểu vào ngôn ngữ nguồn của nó, hoặc dịch nó sang văn bản tiếng Anh.
- `<|notimestamps|>`: bỏ qua các dấu thời gian ở mức từ (quá hơn).

Các prompt là những gì cho phép một mô hình thực hiện nhiều nhiệm vụ. Thay đổi `<|en|>`đến`<|fr|>`và nó viết lại tiếng Pháp.

**30-second window.**Mọi thứ được gắn vào 30 giây. Các clip dài hơn cần phải được chia nhỏ; các clip ngắn hơn được đệm. Windows không được phát trực tuyến bản địa  đó là lý do tại sao WhisperX, Whisper-Streaming và faster-whisper tồn tại.

**Log-mel normalization.** `(log_mel - mean) / std`nơi số liệu thống kê đến từ tập thể huấn luyện của Whisper.`whisper.audio.log_mel_spectrogram`), không `librosa.feature.melspectrogram`- Tôi không biết.

### Các biến thể vào năm 2026

| Variant | Params | Latency (A100) | WER (LibriSpeech-clean) |
|---------|--------|----------------|------------------------|
| Tiny | 39M | 1× realtime | 5.4% |
| Base | 74M | 1× | 4.1% |
| Small | 244M | 1× | 3.0% |
| Medium | 769M | 1× | 2.7% |
| Large-v3 | 1.55B | 2× | 1.8% |
| Large-v3-turbo | 809M | 8× | 1.58% |
| Whisper-Streaming (2024) | 1.55B | streaming | 2.0% |

### Định nghĩa tinh tế

Phòng làm việc theo quy định trong năm 2026:

1. Thu thập 10100 giờ âm thanh miền mục tiêu với bản ghi được sắp xếp.
2. Đi chạy`transformers.Seq2SeqTrainer`với `generate_with_loss`gọi lại.
3. Tỷ lệ hiệu quả tham số: LoRA `q_proj`- `k_proj`- `v_proj`của các lớp chú ý làm giảm bộ nhớ GPU 4x với < 0,3 WER chi phí.
4. Đóng băng bộ mã hóa nếu bạn có < 10 giờ. Chỉ điều chỉnh bộ giải mã.
5. Sử dụng tokeniser của Whisper và định dạng prompt; không bao giờ trao đổi tokeniser.

Kết quả của cộng đồng: điều chỉnh tinh tế Mức độ trung bình trên 20 giờ của lệnh y tế giảm WER từ 12% đến 4,5% trên từ vựng y tế.

```figure
sp-asr-attention
```

## Hãy xây dựng nó

### Bước 1: chạy Whisper ra khỏi hộp

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe(
    "clip.wav",
    language="en",
    task="transcribe",
    temperature=0.0,
    condition_on_previous_text=False,  # prevents runaway repetition
)
print(result["text"])
for seg in result["segments"]:
    print(f"[{seg['start']:.2f}–{seg['end']:.2f}] {seg['text']}")
```

Các lỗi mặc định chính bạn nên luôn bỏ qua: `temperature=0.0`(chọn mẫu các mặc định đến 0.0 → 0.2 → 0.4 ... chuỗi quay trở lại), `condition_on_previous_text=False`(đang ngăn ngừa vấn đề ảo giác ngập ngập), và`no_speech_threshold=0.6`(khám phá âm thầm).

### Bước 2: hình dạng dài bị cắt

```python
# whisperx is the 2026 reference for long-form with word-level timestamps
import whisperx
model = whisperx.load_model("large-v3-turbo", device="cuda", compute_type="float16")
segments = model.transcribe("1hour.mp3", batch_size=16, chunk_size=30)
```

WhisperX thêm (1) Silero VAD gating, (2) Word level alignment thông qua wav2vec 2.0, (3) nhật ký thông qua `pyannote.audio`- Chiếc ngựa lao động năm 2026 cho việc chuyển bản sản xuất.

### Bước 3: Hoạt động với LoRA

```python
from transformers import WhisperForConditionalGeneration, WhisperProcessor
from peft import LoraConfig, get_peft_model

model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-large-v3-turbo")
lora = LoraConfig(
    r=16, lora_alpha=32, target_modules=["q_proj", "v_proj"],
    lora_dropout=0.1, bias="none", task_type="SEQ_2_SEQ_LM",
)
model = get_peft_model(model, lora)
# model.print_trainable_parameters()  -> ~3M trainable / 809M total
```

Sau đó là vòng tròn huấn luyện viên tiêu chuẩn, kiểm tra mỗi 1000 bước, đánh giá WER khi bị kéo dài.

### Bước 4: kiểm tra những gì mỗi lớp học được

```python
# Grab cross-attention weights during decode to see what the decoder attends to.
with torch.inference_mode():
    out = model.generate(
        input_features=features,
        return_dict_in_generate=True,
        output_attentions=True,
    )
# out.cross_attentions: layer × head × step × src_len
```

Hình ảnh với một heatmap  bạn sẽ thấy sự sắp xếp đường chọc khi các bước decoder quét qua khung encoder.

## Sử dụng nó

Số 2026:

| Situation | Pick |
|-----------|------|
| General English, offline | Large-v3-turbo via `whisperx` |
| Mobile / edge | Whisper-Tiny quantized (int8) or Moonshine |
| Multilingual long-form | Large-v3 via `whisperx` + diarization |
| Low-resource language | Fine-tune Medium or Turbo with LoRA |
| Streaming (2 s latency) | Whisper-Streaming or Parakeet-TDT |
| Word-level timestamps | WhisperX (forced alignment via wav2vec 2.0) |

`faster-whisper`(CTranslate2 backend) là thời gian chạy suy luận CPU + GPU nhanh nhất vào năm 2026  4x nhanh hơn vanilla với đầu ra giống nhau.

## Những bẫy vẫn còn tồn tại vào năm 2026

- **Hallucinated text on silence.**Whisper được đào tạo trên tiêu đề bao gồm "Cảm ơn đã xem!", "Đăng ký!", lời bài hát.
- **`condition_on_previous_text` cascade.**Một ảo giác làm ô nhiễm các cửa sổ sau đó.`False`trừ khi bạn cần sự thịnh vượng giữa các mảnh.
- **Short-clip padding.**Một clip 2 giây được đệm đến 30 giây có thể ảo giác trong sự im lặng sau đó.`pad=False`hay VAD-gate.
- **Wrong mel stats.**Sử dụng mels của librosa thay vì Whisper tạo ra kết quả gần như ngẫu nhiên.`whisper.audio.log_mel_spectrogram`- Tôi không biết.

## Chuyển nó

Cứ như `outputs/skill-whisper-tuner.md`Thiết kế một đường ống dẫn suy luận hoặc điều chỉnh tinh tế của Whisper cho một miền nhất định.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`Nó tạo ra một biểu tượng kiểu Whisper, tính toán các ngân sách hình dạng được giải mã và in lịch trình phần cho một clip 10 phút.
2. **Medium.**Thiết lập `faster-whisper`, sao chép một podcast 10 phút, so sánh WER với một bản sao con người.`language="auto"`vs buộc `language="en"`- Tôi không biết.
3. **Hard.**Sử dụng HF `datasets`, chọn một ngôn ngữ mà Whisper đấu tranh với (ví dụ, Urdu), điều chỉnh Medium với LoRA trong 2 thời kỳ trong 2 giờ, và báo cáo WER delta.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| 30-sec window | Whisper's limit | Hard input cap; chunk longer audio. |
| SOT | Start-of-transcript | `<\|startoftranscript\|>` kicks off the decoder prompt. |
| Timestamps token | Temporal alignment | Every 0.02 s offset is a special token in the 51k vocab. |
| Turbo | The fast variant | 4-decoder layers, 8× faster, <1% WER regression. |
| WhisperX | The long-form wrapper | VAD + Whisper + wav2vec alignment + diarization. |
| LoRA fine-tune | Efficient tuning | Add low-rank adapters to attention; train ~0.3% of params. |
| Hallucination | The silent failure | Whisper produces fluent English from noise/silence. |

## Đọc thêm

- [Radford et al. (2022). Whisper paper](https://arxiv.org/abs/2212.04356) kiến trúc và công thức đào tạo ban đầu.
- [OpenAI (2024). Whisper Large-v3-turbo release](https://github.com/openai/whisper/discussions/2363) 4 lớp decoder, tăng tốc 8x.
- [Bain et al. (2023). WhisperX](https://arxiv.org/abs/2303.00747) hình dạng dài, chữ phù hợp, nhật ký.
- [Systran — faster-whisper repo](https://github.com/SYSTRAN/faster-whisper) CTranslate2 hỗ trợ, nhanh hơn 4x.
- [HuggingFace — Whisper fine-tune tutorial](https://huggingface.co/blog/fine-tune-whisper) LoRA truyền thống / đi bộ toàn bộ FT.
