# Tái nhận ngôn ngữ (ASR)  CTC, RNN-T, chú ý

> Sự nhận dạng giọng nói là phân loại âm thanh tại mỗi bước thời gian, được gắn với nhau bởi một mô hình chuỗi biết tiếng Anh và im lặng. CTC, RNN-T và chú ý là ba cách để làm điều đó. Chọn một và hiểu tại sao.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 08 (CNNs & RNNs for Text), Phase 5 · 10 (Attention)
**Time:** ~45 minutes

## Vấn đề

Bạn có một clip 10 giây 16 kHz. Bạn muốn một chuỗi: "đóng đèn nhà bếp". Thách thức là cấu trúc: khung âm thanh không phù hợp với các ký tự. Từ "okay" có thể mất 200 ms hoặc 1200 ms. Sự im lặng chấm dứt phát biểu. Một số âm thanh dài hơn những người khác. Số lượng các mã thông báo đầu ra không được biết trước.

Ba công thức giải quyết vấn đề này:

1. **CTC (Connectionist Temporal Classification).**Phát ra xác suất token mỗi khung bao gồm một * trống đặc biệt*. Phản ứng sụp đổ lặp lại và trống trong thời gian giải mã. Không tự rút, nhanh. Được sử dụng bởi wav2vec 2.0, MMS.
2. **RNN-T (Recurrent Neural Network Transducer).**Mạng lưới chung dự đoán mã thông báo tiếp theo được cung cấp khung mã hóa và mã thông báo trước đó. Streamable. được sử dụng bởi ASR trên thiết bị của Google, NVIDIA Parakeet.
3. **Attention encoder-decoder.**Encoder nén âm thanh vào trạng thái ẩn, decoder phục vụ chéo để tạo token tự động.

Năm 2026, SOTA WER trên LibriSpeech test-clean là 1,4% (Parakeet-TDT-1.1B, NVIDIA) và 1,58% (Whisper-Large-v3-turbo).

## Khái niệm

![Three ASR formulations: CTC, RNN-T, attention-encoder-decoder](../assets/asr-formulations.svg)

**CTC intuition.**Để mã hóa phát `T`phân phối cấp khung trên `V+1`token (V chars + blank). Đối với một chuỗi mục tiêu `y`dài `U < T`, bất kỳ đường thẳng khung nào bị sập xuống`y`số lượng. CTC mất tổng trên tất cả các sự sắp xếp như vậy. Inference: per frame argmax, sụp đổ lặp lại, loại bỏ trống.

Lợi ích: không tự rút, có thể phát trực tuyến, không có đầu nhìn. Khối thấu: * giả định độc lập điều kiện *  mỗi dự đoán khung tự do khỏi các khung khác, do đó không có mô hình ngôn ngữ nội bộ.

**RNN-T intuition.**Thêm một mạng * predictor * nhúng lịch sử token và một * joiner * kết hợp trạng thái dự đoán với khung mã hóa thành một phân phối chung trên `V+1`(the `+1`là null / no-emitt). Mô hình rõ ràng phụ thuộc điều kiện CTC bỏ qua. Streamable vì mỗi bước chỉ điều kiện trên khung trước và token trước.

Lợi ích: Streamable + LM nội bộ. Khác điểm: đào tạo phức tạp hơn và đói trí nhớ (3D grid); RNN-T hạt nhân mất mát là một toàn bộ danh mục thư viện riêng.

**Attention encoder-decoder.**Bộ mã hóa (6-32 lớp biến đổi) trên khung log-mail. Bộ mã hóa (6-32 lớp biến đổi) phục vụ qua nhau để tạo ra mã hóa tự động. Không có hạn chế sắp xếp  sự chú ý có thể nhìn bất cứ nơi nào trong âm thanh. Không thể phát trực tuyến trừ khi bạn hạn chế sự chú ý (Whisper-Streaming, 2024).

Lợi ích: chất lượng cao nhất trên ASR ngoài khơi, dễ đào tạo với công cụ seq2seq tiêu chuẩn. Khối thối: độ trễ tự động tương xứng với chiều dài đầu ra; không thể phát trực tuyến mà không cần kỹ thuật.

### WER: số một

**Word Error Rate**= $(S + D + I) / N$, nơi $S$= thay thế,$D$=trong bỏ,$I$=lên vào,$N$=những từ tham chiếu. Đáp ứng với khoảng cách chỉnh sửa Levenshtein ở mức từ. Thấp hơn là tốt hơn. WER trên 20% thường không thể sử dụng; dưới 5% là bình đẳng con người cho bài đọc.

| Model | LibriSpeech test-clean | LibriSpeech test-other | Size |
|-------|------------------------|------------------------|------|
| Parakeet-TDT-1.1B | 1.40% | 2.78% | 1.1B params |
| Whisper-Large-v3-turbo | 1.58% | 3.03% | 809M |
| Canary-1B Flash | 1.48% | 2.87% | 1B |
| Seamless M4T v2 | 1.7% | 3.5% | 2.3B |

Tất cả các hệ thống này đều dựa trên mã hóa-tử lý hoặc RNN-T. Hệ thống CTC tinh khiết (wav2vec 2.0) nằm ở khoảng 1,82,1% trên test-clean.

```figure
ctc-collapse
```

## Hãy xây dựng nó

### Bước 1: CTC tham lam

```python
def ctc_greedy(frame_logits, blank=0, vocab=None):
    # frame_logits: list of per-frame probability vectors
    preds = [max(range(len(p)), key=lambda i: p[i]) for p in frame_logits]
    out = []
    prev = -1
    for p in preds:
        if p != prev and p != blank:
            out.append(p)
        prev = p
    return "".join(vocab[i] for i in out) if vocab else out
```

Hai quy tắc: sụp đổ liên tiếp lặp lại, bỏ trống. ví dụ: `a a _ _ a b b _ c`→ `a a b c`- Tôi không biết.

### Bước 2: CTC tìm kiếm chùm

```python
def ctc_beam(frame_logits, beam=8, blank=0):
    import math
    beams = [([], 0.0)]  # (tokens, log_prob)
    for p in frame_logits:
        log_p = [math.log(max(pi, 1e-10)) for pi in p]
        candidates = []
        for seq, lp in beams:
            for t, lpt in enumerate(log_p):
                new = seq[:] if t == blank else (seq + [t] if not seq or seq[-1] != t else seq)
                candidates.append((new, lp + lpt))
        candidates.sort(key=lambda x: -x[1])
        beams = candidates[:beam]
    return beams[0][0]
```

Sản xuất sử dụng tìm kiếm chùm cây tiền tố với hợp nhất LM; đây là bộ xương khái niệm.

### Bước 3: WER

```python
def wer(ref, hyp):
    r, h = ref.split(), hyp.split()
    dp = [[0] * (len(h) + 1) for _ in range(len(r) + 1)]
    for i in range(len(r) + 1):
        dp[i][0] = i
    for j in range(len(h) + 1):
        dp[0][j] = j
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            cost = 0 if r[i - 1] == h[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )
    return dp[len(r)][len(h)] / max(1, len(r))
```

### Bước 4: suy luận chống lại Whisper

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("clip.wav")
print(result["text"])
```

Một dòng cho ASR chung mạnh nhất vào năm 2026. chạy trên một GPU 24 GB với thời gian thực ~ 20x.

### Bước 5: phát trực tuyến với Parakeet hoặc wav2vec 2.0

```python
from transformers import pipeline
asr = pipeline("automatic-speech-recognition", model="nvidia/parakeet-tdt-1.1b")
for chunk in streaming_audio():
    print(asr(chunk, return_timestamps=True))
```

Streaming ASR cần tập trung phần mềm mã hóa và trạng thái chuyển tải; sử dụng thư viện hỗ trợ nó (NeMo cho Parakeet, `transformers`đường ống với `chunk_length_s`().

## Sử dụng nó

Số 2026:

| Situation | Pick |
|-----------|------|
| English, offline, max quality | Whisper-large-v3-turbo |
| Multilingual, robust | SeamlessM4T v2 |
| Streaming, low latency | Parakeet-TDT-1.1B or Riva |
| Edge, mobile, <500 ms latency | Whisper-Tiny quantized or Moonshine (2024) |
| Long-form | Whisper with VAD-based chunking (WhisperX) |
| Domain-specific (medical, legal) | Fine-tune wav2vec 2.0 + domain LM fusion |

## Những bẫy vẫn còn tồn tại vào năm 2026

- **No VAD.**Điệu Vô lên im lặng tạo ra ảo giác ("Cảm ơn đã xem!").
- **Character vs word vs subword WER.**Báo cáo WER cấp từ * sau * bình thường hóa (như chữ viết lách, dấu chấm bị loại bỏ).
- **Language ID drift.**LID tự động của Whisper sai đường cho các clip tiếng ồn đến tiếng Nhật hoặc tiếng Wales; lực `language="en"`Khi anh biết.
- **Long clips without chunking.**Whisper có một cửa sổ 30 giây.`chunk_length_s=30, stride=5`cho bất cứ điều gì lâu hơn.

## Chuyển nó

Cứ như `outputs/skill-asr-picker.md`Chọn mô hình, giải mã chiến lược, chunking, và LM hợp nhất cho một mục tiêu triển khai nhất định.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`Nó tham lam giải mã một đầu ra CTC được làm bằng tay và tính WER với một tham chiếu.
2. **Medium.**Thực hiện tìm kiếm chùm cây tiền tố trong bước 2 một cách đúng đắn (tự tính quy tắc hợp nhất trống). So sánh với tham lam trên một tập dữ liệu tổng hợp 10 ví dụ.
3. **Hard.**Sử dụng `whisper-large-v3-turbo`[LibriSpeech test-clean](https://www.openslr.org/12)- Xét WER trên 100 phát biểu đầu tiên. So sánh với số lượng được công bố.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| CTC | The blank-token loss | Marginal over all frame-to-token alignments; non-AR. |
| RNN-T | The streaming loss | CTC + next-token predictor; handles word-order. |
| Attention enc-dec | Whisper-style | Encoder + cross-attending decoder; best offline quality. |
| WER | The number you report | `(S+D+I)/N` at word level. |
| Blank | The emptiness | Special token in CTC signalling "no emission this frame". |
| LM fusion | External language model | Add weighted LM log-probs during beam search. |
| VAD | The silence gate | Voice activity detector; trims non-speech. |

## Đọc thêm

- [Graves et al. (2006). Connectionist Temporal Classification](https://www.cs.toronto.edu/~graves/icml_2006.pdf) giấy tờ CTC.
- [Graves (2012). Sequence Transduction with RNNs](https://arxiv.org/abs/1211.3711) tờ RNN-T.
- [Radford et al. / OpenAI (2022). Whisper: Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) giấy phép năm 2022; v3-turbo mở rộng vào năm 2024.
- [NVIDIA NeMo — Parakeet-TDT card](https://huggingface.co/nvidia/parakeet-tdt-1.1b) 2026 Open ASR Leaderboard dẫn đầu.
- [Hugging Face — Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) chỉ số chuẩn trực tiếp trên 25+ mô hình.
