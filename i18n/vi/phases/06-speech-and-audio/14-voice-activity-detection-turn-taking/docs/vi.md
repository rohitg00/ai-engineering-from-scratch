# Khám phá và quay động hoạt động giọng nói  Silero, Cobra và thủ thuật Flush

> Mỗi đại lý giọng nói sống hoặc chết dựa trên hai quyết định: người dùng đang nói và họ đã hoàn thành chưa? VAD trả lời câu đầu tiên. Khám phá quay (VAD + âm thầm-hành động + mô hình điểm cuối ngữ nghĩa) trả lời câu thứ hai.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 11 (Real-Time Audio), Phase 6 · 12 (Voice Assistant)
**Time:** ~45 minutes

## Vấn đề

Ba quyết định khác nhau mà một đại lý giọng nói đưa ra cho mỗi 20 ms:

1. **Is this frame speech?**VAD, nhị phân, mỗi khung hình.
2. **Has the user started a new utterance?** phát hiện sự khởi phát.
3. **Has the user finished?** hướng cuối (turn-end).

Câu trả lời ngây thơ (giới hạn năng lượng) thất bại trong bất kỳ tiếng  giao thông, bàn phím, tiếng đùa đám đông. Câu trả lời 2026: Silero VAD (cởi mở, học sâu) + mô hình phát hiện lượt (số kết thúc ngữ nghĩa) + một cơn sưng lặng được định đo VAD.

## Khái niệm

![VAD cascade: energy → Silero → turn-detector → flush trick](../assets/vad-turn-taking.svg)

### Các 3 cấp VAD Cascade

**Tier 1: energy gate.**Giá rẻ nhất, RMS ở -40 dBFS, lọc âm thầm rõ ràng nhưng bắn vào bất kỳ tiếng ồn nào trên ngưỡng.

**Tier 2: Silero VAD**(2020-2026, MIT). 1M tham số. Được đào tạo trên 6000 + ngôn ngữ. chạy trong ~ 1 ms cho mỗi 30 ms phần trên một chuỗi CPU duy nhất. 87,7% TPR tại 5% FPR.

**Tier 3: semantic turn detector.**Mô hình phát hiện lượt của LiveKit (2024-2026) hoặc phân loại nhỏ của riêng bạn. Hóa ra sự khác biệt giữa "phát ngơi giữa câu" và "sự nói xong".

### Các tham số chính và các mặc định của chúng

- **Threshold.**Silero đưa ra một xác suất; phân loại bài phát biểu ở &gt; 0.5 (phụ mặc định) hoặc &gt; 0.3 (cảm xúc). ngưỡng thấp hơn = ít clip từ đầu tiên, nhiều tích cực sai hơn.
- **Minimum speech duration.**Tháo lời ngắn hơn 250 ms  thường ho hoặc tiếng ồn ghế.
- **Silence hangover (end-pointing).**Sau khi VAD trở lại 0, chờ 500-800 ms trước khi tuyên bố kết thúc lượt.
- **Pre-roll buffer.**Giữ 300-500 ms âm thanh trước khi VAD phát nổ.

### Tránh lội (Kyutai 2025)

Các mô hình STT phát trực tuyến có độ chậm nhìn về phía trước (500 ms cho Kyutai STT-1B, 2,5 s cho STT-2.6B).**send a flush signal to the STT**STT xử lý ở thời gian thực 4x, do đó bộ đệm 500 ms hoàn thành trong ~ 125 ms.

End-to-end: 125 ms VAD + flush STT = thời gian trễ cuộc trò chuyện.

### So sánh VAD 2026

| VAD | TPR @ 5% FPR | Latency | License |
|-----|--------------|---------|---------|
| WebRTC VAD (Google, 2013) | 50.0% | 30 ms | BSD |
| Silero VAD (2020-2026) | 87.7% | ~1 ms | MIT |
| Cobra VAD (Picovoice) | 98.9% | ~1 ms | commercial |
| pyannote segmentation | 95% | ~10 ms | MIT-ish |

Silero là mặc định đúng. Cobra là nâng cấp tuân thủ / độ chính xác. VAD chỉ sử dụng năng lượng không có chỗ trong sản xuất năm 2026.

```figure
sp-vad-cascade
```

## Hãy xây dựng nó

### Bước 1: cổng năng lượng

```python
def energy_vad(chunk, threshold_dbfs=-40.0):
    rms = (sum(x * x for x in chunk) / len(chunk)) ** 0.5
    dbfs = 20.0 * math.log10(max(rms, 1e-10))
    return dbfs > threshold_dbfs
```

### Bước 2: Silero VAD trong Python

```python
from silero_vad import load_silero_vad, get_speech_timestamps

vad = load_silero_vad()
audio = torch.tensor(waveform_16k, dtype=torch.float32)
segments = get_speech_timestamps(
    audio, vad, sampling_rate=16000,
    threshold=0.5,
    min_speech_duration_ms=250,
    min_silence_duration_ms=500,
    speech_pad_ms=300,
)
for s in segments:
    print(f"{s['start']/16000:.2f}s - {s['end']/16000:.2f}s")
```

### Bước 3: Máy chế độ quay cuối

```python
class TurnDetector:
    def __init__(self, silence_hangover_ms=500, min_speech_ms=250):
        self.state = "idle"
        self.speech_ms = 0
        self.silence_ms = 0
        self.silence_hangover_ms = silence_hangover_ms
        self.min_speech_ms = min_speech_ms

    def update(self, is_speech, chunk_ms=20):
        if is_speech:
            self.speech_ms += chunk_ms
            self.silence_ms = 0
            if self.state == "idle" and self.speech_ms >= self.min_speech_ms:
                self.state = "speaking"
                return "START"
        else:
            self.silence_ms += chunk_ms
            if self.state == "speaking" and self.silence_ms >= self.silence_hangover_ms:
                self.state = "idle"
                self.speech_ms = 0
                return "END"
        return None
```

### Bước 4: bộ xương trò chơi lồng

```python
def flush_on_end(stt_client, audio_buffer):
    stt_client.send_audio(audio_buffer)
    stt_client.send_flush()
    return stt_client.recv_transcript(timeout_ms=150)
```

STT (Kyutai, Deepgram, AssemblyAI) phải hỗ trợ flush để điều này hoạt động.

## Sử dụng nó

| Situation | VAD choice |
|-----------|-----------|
| Open, fast, general | Silero VAD |
| Commercial call center | Cobra VAD |
| On-device (phone) | Silero VAD ONNX |
| Research / diarization | pyannote segmentation |
| Zero-dependency fallback | WebRTC VAD (legacy) |
| Need turn-ending quality | Silero + LiveKit turn-detector layered |

Quy tắc: không bao giờ vận chuyển VAD chỉ sử dụng năng lượng trừ khi bạn thực sự không có lựa chọn khác.

## Những bẫy

- **Fixed threshold.**Nó hoạt động trong âm thanh, thất bại trong tiếng ồn.
- **Too-short silence hangover.**Cảnh sát ngắt lời giữa câu. 500-800 ms là điểm thích hợp cho cuộc trò chuyện.
- **Too-long hangover.**Cảm thấy chậm chạp.
- **No pre-roll buffer.**200-300 ms đầu tiên của âm thanh người dùng bị mất.
- **Ignoring semantic endpointing.**"Hmm, để tôi nghĩ"... chứa những khoảng thời gian dừng lại dài người dùng ghét bị cắt đứt trong lúc suy nghĩ.

## Chuyển nó

Cứ như `outputs/skill-vad-tuner.md`Chọn mô hình VAD, ngưỡng, ngứa, chiến lược phát hiện và phát hiện vòng cho một khối lượng công việc.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`Nó mô phỏng một chuỗi nói + im lặng + nói + ho và kiểm tra ba cấp độ VAD.
2. **Medium.**Thiết lập `silero-vad`, xử lý một ghi âm 5 phút, điều chỉnh ngưỡng để giảm thiểu cả hai clip từ đầu tiên và kích hoạt sai.
3. **Hard.**Xây dựng một bộ phát hiện vòng mini: Silero VAD + một MLP 3 tầng trên 10 từ cuối cùng ( Sử dụng các bộ chuyển đổi câu). Đào tạo trên một tập dữ liệu vòng cuối được dán nhãn bằng tay.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| VAD | Voice detector | Binary per-frame: is this speech? |
| Turn detection | End-pointing | VAD + silence-hangover + semantic endpoint. |
| Silence hangover | Wait-after-speech | Time to wait before declaring turn end; 500-800 ms. |
| Pre-roll | Pre-speech buffer | Keep 300-500 ms audio before VAD fires. |
| Flush trick | Kyutai hack | VAD → flush-STT → 125 ms instead of 500 ms delay. |
| Semantic endpoint | "Did they mean to stop?" | ML classifier that looks at words, not just silence. |
| TPR @ FPR 5% | ROC point | Standard VAD benchmark; 87.7% for Silero, 50% WebRTC. |

## Đọc thêm

- [Silero VAD](https://github.com/snakers4/silero-vad) VAD mở tham chiếu.
- [Picovoice Cobra VAD](https://picovoice.ai/products/voice/voice-activity-detection/) nhà lãnh đạo chính xác thương mại.
- [Kyutai — Unmute + flush trick](https://kyutai.org/stt) thủ thuật kỹ thuật sub-200 ms.
- [LiveKit — turn detection](https://docs.livekit.io/agents/logic/turns/) chỉ ra kết thúc ngữ nghĩa trong sản xuất.
- [WebRTC VAD](https://webrtc.googlesource.com/src/) dòng cơ sở thừa kế.
- [pyannote segmentation](https://github.com/pyannote/pyannote-audio) phân đoạn cấp nhật ký.
