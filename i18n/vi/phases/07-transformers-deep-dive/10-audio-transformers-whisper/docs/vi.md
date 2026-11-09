# Các bộ biến âm thanh  Thiết kế thì thầm

> Âm thanh là hình ảnh tần số theo thời gian. Whisper là một ViT ăn nhiều quang phổ và nói lại.

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 08 (Encoder-Decoder), Phase 7 · 09 (ViT)
**Time:** ~45 minutes

## Vấn đề

Trước khi Whisper (OpenAI, Radford et al. 2022), nhận dạng giọng nói tự động tiên tiến (ASR) có nghĩa là wav2vec 2.0 và HuBERT  máy thu thập tính tự giám sát cộng với một đầu điều chỉnh tinh tế.

Whisper đã đặt cược ba lần:

1. **Train on everything.**680.000 giờ âm thanh có nhãn yếu được thu thập từ internet trong 97 ngôn ngữ, không có tập hợp học thuật sạch, không có nhãn âm thanh.
2. **Multi-task single model.**Một bộ giải mã được đào tạo chung về bản sao chép, dịch, phát hiện hoạt động giọng nói, nhận dạng ngôn ngữ và dấu thời gian thông qua các mã công việc.
3. **Standard encoder-decoder transformer.**Các mã hóa sử dụng các quang phổ log-mail. Các mã hóa phát hành mã thông báo văn bản tự động. Không vocoder, không CTC, không HMM.

Kết quả: Whisper large-v3 là mạnh mẽ trên các giọng, tiếng ồn và ngôn ngữ có dữ liệu có nhãn sạch không. Nó là đầu tiên mặc định của giọng nói cho mọi trợ lý giọng nói nguồn mở và hầu hết các ngôn ngữ thương mại vào năm 2026.

## Khái niệm

![Whisper pipeline: audio → mel → encoder → decoder → text](../assets/whisper.svg)

### Bước 1  mẫu lại + cửa sổ

Audio ở 16 kHz. Clip/pad đến 30 giây. tính toán log-mel spectrogram: 80 mel bin, 10 ms bước → ~ 3.000 khung hình × 80 tính năng. Đây là "hình ảnh đầu vào" mà Whisper nhìn thấy.

### Bước 2  thân lưng

Hai lớp Conv1D với hạt nhân 3 và bước 2 làm giảm 3.000 khung hình thành 1.500.

### Bước 3  mã hóa

Một bộ mã hóa biến thể 24 tầng (đối với lớn) trên 1.500 bước thời gian. mã hóa vị trí sinus, tự chú ý, GELU FFN. Tạo ra 1.500 × 1.280 trạng thái ẩn.

### Bước 4  decoder

Một decoder biến đổi 24 lớp. Nó tự lập tạo ra các token từ một từ vựng BPE là một bộ siêu của GPT-2 với một vài token đặc biệt cụ thể.

### Bước 5  mã công việc

Việc giải mã bắt đầu với các mã kiểm soát cho mô hình biết phải làm gì:

```
<|startoftranscript|>  <|en|>  <|transcribe|>  <|0.00|>
```

hoặc

```
<|startoftranscript|>  <|fr|>  <|translate|>   <|0.00|>
```

Mô hình được đào tạo theo hội nghị này. Bạn kiểm soát nhiệm vụ bằng tiền tố. tương đương với điều chỉnh hướng dẫn năm 2026, nhưng áp dụng cho ngôn ngữ.

### Bước 6  đầu ra

Tìm kiếm chùm (thiều rộng 5) với ngưỡng log-prob.`<|notimestamps|>`token bị vắng mặt.

### Kích thước thì thầm

| Model | Params | Layers | d_model | Heads | VRAM (fp16) |
|-------|--------|--------|---------|-------|-------------|
| Tiny | 39M | 4 | 384 | 6 | ~1 GB |
| Base | 74M | 6 | 512 | 8 | ~1 GB |
| Small | 244M | 12 | 768 | 12 | ~2 GB |
| Medium | 769M | 24 | 1024 | 16 | ~5 GB |
| Large | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3 | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3-turbo | 809M | 32 | 1280 | 20 | ~6 GB (4-layer decoder) |

Large-v3-turbo (2024) cắt giảm bộ giải mã từ 32 lớp xuống 4.8x nhanh hơn với sự lùi điểm <1 WER.

### Những gì Whisper không làm

- Không có nhật ký (người đang nói) kết hợp với ghi chú phấn cho điều đó.
- Không có luồng trực tuyến thời gian thực bản địa  cửa sổ 30 giây được cố định.`faster-whisper`- `WhisperX`) điện thoại thông minh trên VAD + chồng chéo.
- Không có ngữ cảnh hình thức dài hơn 30 s mà không có sự phân mảnh bên ngoài.

### 2026 phong cảnh

| Task | Model | Notes |
|------|-------|-------|
| English ASR | Whisper-turbo, Moonshine | Moonshine is 4× faster on edge |
| Multilingual ASR | Whisper-large-v3 | 97 languages |
| Streaming ASR | faster-whisper + VAD | 150 ms latency targets achievable |
| TTS | Piper, XTTS-v2, Kokoro | Encoder-decoder pattern, but Whisper-shaped |
| Audio + language | AudioLM, SeamlessM4T | Text tokens + audio tokens in one transformer |

```figure
n5-mel-decode
```

## Hãy xây dựng nó

Nhìn xem`code/main.py`Chúng tôi không đào tạo Whisper, chúng tôi xây dựng đường ống quang phổ log-mail + định dạng lệnh giao thức. Đó là những bộ phận bạn thực sự chạm vào trong sản xuất.

### Bước 1: tổng hợp âm thanh

Tạo ra một sóng âm âm 1 giây ở 440 Hz lấy mẫu ở 16 kHz. 16.000 mẫu.

### Bước 2: Nhìn quang phổ log-mel (đơn giản hóa)

Phân quang phổ mel đầy đủ cần FFT. Chúng tôi làm một khung đơn giản + mỗi khung năng lượng phiên bản cho thấy đường ống mà không cần `librosa`- Có thể là:

```python
def frame_signal(x, frame_size=400, hop=160):
    frames = []
    for start in range(0, len(x) - frame_size + 1, hop):
        frames.append(x[start:start + frame_size])
    return frames
```

Frame = 25 ms, hop = 10 ms. Tương tự như Whisper's Windowing.

### Bước 3: Pad đến 30 s

Whisper luôn xử lý các mảnh 30 giây. Pad (hoặc clip) quang phổ đến 3.000 khung hình.

### Bước 4: xây dựng các mã thông báo nhanh

```python
def whisper_prompt(lang="en", task="transcribe", timestamps=True):
    tokens = ["<|startoftranscript|>", f"<|{lang}|>", f"<|{task}|>"]
    if not timestamps:
        tokens.append("<|notimestamps|>")
    return tokens
```

Đó là toàn bộ bề mặt kiểm soát nhiệm vụ.

## Sử dụng nó

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("meeting.wav", language="en", task="transcribe")
print(result["text"])
print(result["segments"][0]["start"], result["segments"][0]["end"])
```

Tốc độ nhanh hơn, tương thích với OpenAI:

```python
from faster_whisper import WhisperModel
model = WhisperModel("large-v3-turbo", compute_type="int8_float16")
segments, info = model.transcribe("meeting.wav", vad_filter=True)
for s in segments:
    print(f"{s.start:.2f} - {s.end:.2f}: {s.text}")
```

**When to pick Whisper in 2026:**

- ASR đa ngôn ngữ với một mô hình.
- Bản sao âm thanh ồn ào, đa dạng.
- Nghiên cứu / nguyên mẫu ASR  điểm khởi đầu nhanh nhất.

**When to pick something else:**

- Tiếng lưu điện cực thấp trên cạnh  Moonshine đánh bại Whisper với chất lượng phù hợp.
- AI trò chuyện thời gian thực cần <200 ms  chuyên dụng phát trực tuyến ASR.
- Đăng ký loa  Whisper không làm điều này; đệm trên pianonote.

## Chuyển nó

Nhìn xem`outputs/skill-asr-configurator.md`. Khả năng chọn một mô hình ASR, giải mã các tham số và đường ống xử lý trước cho một ứng dụng giọng nói mới.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`- Đảm nhận số khung hình cho một tín hiệu 1 giây ở 16 kHz với 10 ms hop là ~ 100 khung hình.
2. **Medium.**Xây dựng toàn bộ log-mel spectrogram sử dụng `numpy.fft`- Thêm 80 miếng nhựa .`librosa.feature.melspectrogram(n_mels=80)`trong lỗi số.
3. **Hard.**Thực hiện suy luận phát trực tuyến: phần âm thanh vào cửa sổ 10 giây với sự chồng chéo 2 giây, chạy Whisper trên mỗi phần, kết hợp bản ghi chép. đo tỷ lệ lỗi từ so với một lần qua trên một mẫu podcast 5 phút.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mel spectrogram | "Audio image" | 2D representation: frequency bins on one axis, time frames on the other; log-scaled energy per cell. |
| Log-mel | "What Whisper sees" | Mel spectrogram passed through log; approximates human perception of loudness. |
| Frame | "One time slice" | A 25 ms window of samples; overlapping at 10 ms stride. |
| Task token | "Prompt prefix for speech" | Special tokens like `<\|transcribe\|>` / `<\|translate\|>` in the decoder prompt. |
| Voice activity detection (VAD) | "Find the speech" | Gate that removes silence before ASR; cuts cost massively. |
| CTC | "Connectionist Temporal Classification" | Classic ASR loss for alignment-free training; Whisper does NOT use it. |
| Whisper-turbo | "Small decoder, full encoder" | large-v3 encoder + 4-layer decoder; 8× faster decoding. |
| Faster-whisper | "The production wrapper" | CTranslate2 reimplementation; int8 quantization; 4× faster than OpenAI's reference. |

## Đọc thêm

- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) Bức giấy.
- [OpenAI Whisper repo](https://github.com/openai/whisper) mã tham chiếu + trọng lượng mô hình.`whisper/model.py`để xem conv1D gốc + mã hóa + mã hóa từ trên xuống dưới trong ~ 400 dòng.
- [OpenAI Whisper — `whisper/decoding.py`](https://github.com/openai/whisper/blob/main/whisper/decoding.py) logic tìm kiếm chùm + mã công việc được mô tả trong Bước 56 ở đây; 500 dòng, hoàn toàn có thể đọc được.
- [Baevski et al. (2020). wav2vec 2.0: A Framework for Self-Supervised Learning of Speech Representations](https://arxiv.org/abs/2006.11477) tiền thân; vẫn có tính năng SOTA trong một số cài đặt.
- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) bọc sản xuất, nhanh hơn 4x so với tham chiếu.
- [Jia et al. (2024). Moonshine: Speech Recognition for Live Transcription and Voice Commands](https://arxiv.org/abs/2410.15608) 2024 ASR thân thiện với cạnh, hình dạng Hầm nhưng nhỏ hơn.
- [HuggingFace blog — "Fine-Tune Whisper For Multilingual ASR with 🤗 Transformers"](https://huggingface.co/blog/fine-tune-whisper) công thức điều chỉnh tinh tế theo quy luật bao gồm bộ xử lý trước của quang phổ mel và xử lý dấu thời gian token.
- [HuggingFace `modeling_whisper.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/whisper/modeling_whisper.py) thực hiện đầy đủ (code, decoder, sự chú ý chéo, tạo ra) phản ánh sơ đồ kiến trúc của bài học.
