# Voice Anti-Spoofing & Audio Watermarking  ASVspoof 5, AudioSeal, WaveVerify

> Phân phối giọng nói được vận chuyển nhanh hơn phòng thủ. Hệ thống giọng nói sản xuất năm 2026 cần hai thứ: một bộ phát hiện (AASIST, RawNet2) phân loại giọng nói thực và giả, và một dấu nước (AudioSeal) tồn tại sau khi nén và chỉnh sửa.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 06 (Speaker Recognition), Phase 6 · 08 (Voice Cloning)
**Time:** ~75 minutes

## Vấn đề

Ba biện pháp phòng thủ liên quan:

1. **Anti-spoofing / deepfake detection.**Với một đoạn băng âm thanh, nó là tổng hợp hay thực sự?
2. **Audio watermarking.**Đưa một tín hiệu không thể nhận thấy vào âm thanh được tạo ra mà một máy dò có thể lấy ra sau đó.
3. **Authenticated provenance.**Chữ ký mã hóa của các tệp âm thanh + siêu dữ liệu.

Khám phá xử lý đối thủ không hợp tác. Watermarking xử lý tuân thủ  âm thanh được tạo ra bởi AI nên được xác định như vậy. Cả hai đều cần thiết vào năm 2026.

## Khái niệm

![Anti-spoofing vs watermarking vs provenance — three defense layers](../assets/spoofing-watermark.svg)

### ASVspoof 5  điểm tham chiếu 2024-2025

Thay đổi lớn nhất so với các phiên bản trước đây:

- **Crowdsourced data**(không phải studio sạch)  điều kiện thực tế.
- **~2000 speakers**(Vì ~ 100 trước đó).
- **32 attack algorithms.**TTS + chuyển đổi giọng nói + nhiễu loạn đối kháng.
- **Two tracks.**Phản ứng (CM) phát hiện độc lập; ASV mạnh mẽ chống lừa đảo (SASV) cho hệ thống sinh trắc học.

State of the art trên ASVspoof 5: ~ 7,23% EER. Trên ASVspoof cũ hơn 2019 LA: 0,42% EER.

### AASIST và RawNet2  gia đình mô hình phát hiện

**AASIST**(2021, cập nhật đến 2026). Chú ý đồ họa về các tính năng quang phổ. SOTA hiện tại về nhiệm vụ phản biện ASVspoof 5.

**RawNet2.**Convolutional front-end trên dạng sóng nguyên liệu + TDNN xương sống.

**NeXt-TDNN + SSL features.**2025: ECAPA-style + WavLM tính năng + mất tiêu cực. đạt được 0,42% EER trên ASVspoof 2019 LA.

### AudioSeal  watermark 2024 mặc định

Meta's **AudioSeal**(Từ tháng 1 năm 2024, v0.2 tháng 12 năm 2024).

- **Localized.**Khám nhận thấy dấu nước mỗi khung ở độ phân giải mẫu 16 kHz (1/16000 s).
- **Generator + detector jointly trained.**Máy phát điện học cách nhúng tín hiệu không nghe; máy phát hiện học cách tìm thấy nó thông qua tăng cường.
- **Robust.**Thử nghiệm nén MP3 / AAC, EQ, thay đổi tốc độ ± 10%, hỗn hợp tiếng ồn + 10 dB SNR.
- **Fast.**Máy phát hiện chạy 485x thời gian thực; 1000x nhanh hơn WavMark.
- **Capacity.**Load hữu ích 16 bit (có thể mã hóa ID mô hình, dấu thời gian tạo, ID người dùng) được nhúng vào mỗi phát biểu.

### WavMark

Hướng dẫn mở trước AudioSeal, mạng thần kinh đảo ngược, 32 bit/thì.

- Đồng bộ hóa lực lượng thô là chậm.
- Có thể được loại bỏ bằng tiếng ồn Gaussian hoặc nén MP3.
- Không thân thiện trong thời gian thực.

### WaveVerify (tháng 7 năm 2025)

Giải quyết các điểm yếu của AudioSeal  đặc biệt là thao tác thời gian (phản hồi, tốc độ). Sử dụng máy phát điện dựa trên FiLM + máy dò Mixture-of-Experts. Thang với AudioSeal trong các cuộc tấn công tiêu chuẩn; xử lý chỉnh sửa thời gian.

### Những kẻ thù khai thác khoảng cách

Từ AudioMarkBench: "trong độ chuyển động, tất cả các dấu nước cho thấy độ chính xác phục hồi Bit dưới 0,6, cho thấy loại bỏ gần như hoàn chỉnh". **Pitch-shift is the universal attack.**Watermark No 2026 hoàn toàn mạnh mẽ để thay đổi độ cao tích cực.

### C2PA / Động thái xác thực nội dung

Không phải kỹ thuật ML  định dạng biểu hiện. Các tệp âm thanh mang lại metadata được ký mã hóa về công cụ tạo, tác giả, ngày. Audobox / Seamless sử dụng nó.

```figure
v4-audio-watermark
```

## Hãy xây dựng nó

### Bước 1: một máy dò tính quang phổ đơn giản ( đồ chơi)

```python
def spectral_rolloff(spec, percentile=0.85):
    cum = 0
    total = sum(spec)
    if total == 0:
        return 0
    threshold = total * percentile
    for k, v in enumerate(spec):
        cum += v
        if cum >= threshold:
            return k
    return len(spec) - 1

def is_suspicious(audio):
    spec = magnitude_spectrum(audio)
    rolloff = spectral_rolloff(spec)
    return rolloff / len(spec) > 0.92
```

Nói cách tổng hợp thường có năng lượng tần số cao không thường xuyên.

### Bước 2: AudioSeal embed + detect

```python
from audioseal import AudioSeal
import torch

generator = AudioSeal.load_generator("audioseal_wm_16bits")
detector = AudioSeal.load_detector("audioseal_detector_16bits")

audio = load_wav("generated.wav", sr=16000)[None, None, :]
payload = torch.tensor([[1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0]])
watermark = generator.get_watermark(audio, sample_rate=16000, message=payload)
watermarked = audio + watermark

result, decoded_payload = detector.detect_watermark(watermarked, sample_rate=16000)
# result: float in [0, 1] — probability of watermark presence
# decoded_payload: 16 bits; match against embedded payload
```

### Bước 3: đánh giá  EER

```python
def eer(real_scores, fake_scores):
    thresholds = sorted(set(real_scores + fake_scores))
    best = (1.0, 0.0)
    for t in thresholds:
        far = sum(1 for s in fake_scores if s >= t) / len(fake_scores)
        frr = sum(1 for s in real_scores if s < t) / len(real_scores)
        if abs(far - frr) < best[0]:
            best = (abs(far - frr), (far + frr) / 2)
    return best[1]
```

### Bước 4: sự tích hợp sản xuất

```python
def safe_tts(text, voice, clone_reference=None):
    if clone_reference is not None:
        verify_consent(user_id, clone_reference)
    audio = tts_model.synthesize(text, voice)
    audio_with_wm = audioseal_embed(audio, payload=build_payload(user_id, model_id))
    manifest = c2pa_sign(audio_with_wm, user_id, timestamp=now())
    return audio_with_wm, manifest
```

Mỗi dòng tàu: (1) dấu nước, (2) bản ghi ký, (3) sổ kiểm toán tuân thủ chính sách lưu giữ.

## Sử dụng nó

| Use case | Defense |
|----------|---------|
| Shipping TTS / voice cloning | AudioSeal embed on every output (non-negotiable) |
| Biometric voice unlock | AASIST + ECAPA ensemble; liveness challenge |
| Call-center fraud detection | AASIST on 20% sample of incoming calls |
| Podcast authenticity | C2PA signing on upload, AudioSeal if AI-generated |
| Research / training detectors | ASVspoof 5 train/dev/eval sets |

## Những bẫy

- **Watermark without detector ever running.**Không có ý nghĩa, đưa máy dò vào máy tính thông tin của anh.
- **Detection without calibration.**AASIST được đào tạo về các vụ phóng to của Mỹ, giảm độ chính xác trong thế giới thực.
- **Pitch-shift gap.**Chuyển độ hung hăng sẽ loại bỏ hầu hết các dấu hiệu nước.
- **Metadata strip-and-rehost.**C2PA là không có gì khác với mã hóa lại. Luôn thêm hệ thống bảo vệ mật mã + nhận thức (chước biển) cùng nhau.
- **Liveness as detection.**Hãy yêu cầu người dùng nói một cụm từ ngẫu nhiên.

## Chuyển nó

Cứ như `outputs/skill-spoof-defender.md`. Chọn mô hình phát hiện, dấu nước, biểu đồ xuất xứ và sổ tay hoạt động cho việc triển khai voice-gen.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`. Máy phát hiện đồ chơi + dấu nước đồ chơi nhúng/ phát hiện trên âm thanh tổng hợp.
2. **Medium.**Thiết lập `audioseal`, nhúng tải 16 bit vào đầu ra TTS, mã hóa lại, làm hỏng âm thanh bằng tiếng ồn và đo độ chính xác phục hồi bit.
3. **Hard.**Định chỉnh một RawNet2 hoặc AASIST trên ASVspoof 2019 LA. đo EER. Thử nghiệm trên một bộ clip được tạo ra bằng F5-TTS  xem việc phát hiện OOD suy giảm như thế nào.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| ASVspoof | The benchmark | Biennial challenge; 2024 = ASVspoof 5. |
| CM (countermeasure) | Detector | Classifier: real speech vs synthetic / converted. |
| SASV | Speaker verif + CM | Integrated biometric + spoof detection. |
| AudioSeal | Meta watermark | Localized, 16-bit payload, 485× faster than WavMark. |
| Bit Recovery Accuracy | Watermark survival | Fraction of payload bits recovered after attack. |
| C2PA | Provenance manifest | Cryptographic metadata about creation / authorship. |
| AASIST | Detector family | Graph-attention-based anti-spoofing SOTA. |

## Đọc thêm

- [Todisco et al. (2024). ASVspoof 5](https://dl.acm.org/doi/10.1016/j.csl.2025.101825) chỉ số chuẩn hiện tại.
- [Defossez et al. (2024). AudioSeal](https://arxiv.org/abs/2401.17264) watermark mặc định.
- [Chen et al. (2025). WaveVerify](https://arxiv.org/abs/2507.21150) Bộ dò MoE cho các cuộc tấn công thời gian.
- [Jung et al. (2022). AASIST](https://arxiv.org/abs/2110.01200) xương sống phát hiện SOTA.
- [AudioMarkBench (2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/5d9b7775296a641a1913ab6b4425d5e8-Paper-Datasets_and_Benchmarks_Track.pdf) Đánh giá độ bền.
- [C2PA specification](https://spec.c2pa.org/specifications/specifications/2.4/index.html) định dạng biểu hiện xuất xứ.
