# Phân quang, Scale Mel & Audio Features

> Các mạng thần kinh không tiêu thụ các dạng sóng nguyên liệu tốt. Chúng tiêu thụ quang phổ. Chúng tiêu thụ quang phổ mel thậm chí tốt hơn. Mỗi bộ phân loại âm thanh ASR, TTS và vào năm 2026 sống hoặc chết do lựa chọn xử lý trước này.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 01 (Audio Fundamentals)
**Time:** ~45 minutes

## Vấn đề

Hãy lấy một clip 10 giây 16 kHz. đó là 160.000 float, tất cả trong`[-1, 1]`, gần như hoàn toàn không liên quan đến nhãn "cô ốc" hoặc "những từ mèo". dạng sóng thô có thông tin nhưng trong một hình thức mô hình không thể dễ dàng trích xuất. Hai âm thanh giống nhau nói cách nhau 100 ms có mẫu nguyên liệu hoàn toàn khác nhau.

Một quang phổ sửa chữa điều này. Nó phá vỡ chi tiết thời gian nơi nhận thức của con người bỏ qua nó (microsecond jitter) và bảo tồn cấu trúc nơi nhận thức tham dự (đôi tần số là năng lượng, qua cửa sổ thời gian ~ 1025 ms).

Các quang phổ mel đẩy xa hơn. Con người nhận thức âm thanh theo cách logaritm: 100 Hz vs 200 Hz âm thanh "các khoảng cách nhau" như 1000 Hz vs 2000 Hz. Skala mel biến dạng trục tần số để phù hợp.

## Khái niệm

![Waveform to STFT to mel spectrogram to MFCC ladder](../assets/mel-features.svg)

**STFT (Short-Time Fourier Transform).**Cắt hình dạng sóng thành khung chồng chéo (tình thường: cửa sổ 25 ms, hop 10 ms = 400 mẫu / 160 mẫu ở 16 kHz).`(n_frames, n_freq_bins)`Đó là quang phổ của anh.

**Log-magnitude.**Tầm độ lớn có thể dao động từ 5-6 bậc.`log(|X| + 1e-6)`hoặc `20 * log10(|X|)`Mỗi đường ống sản xuất sử dụng log magnitude, không phải là nguyên liệu.

**Mel scale.**Tần suất `f`trong bản đồ Hz đến mel `m`bởi $m = 2595 \cdot \log_{10}(1 + f / 700)$. Bản đồ là đường thẳng dưới 1 kHz và logarithmic trên. 80 mel bins bao gồm 08 kHz là đầu vào ASR tiêu chuẩn.

**Mel filterbank.**Một bộ bộ bộ lọc tam giác nằm trong khoảng cách bằng nhau trên thang mel. Mỗi bộ lọc là tổng cân của các thùng FFT lân cận.

**Log-mel spectrogram.** `log(mel_spec + 1e-10)`- Hướng dẫn của Whisper, hướng dẫn của Parakeet, hướng dẫn của SeamlessM4T, hướng dẫn âm thanh toàn cầu năm 2026.

**MFCCs.**Hãy lấy quang phổ log-mel, áp dụng một DCT (tiêu II), giữ 13 nhân tố đầu tiên. Khóa các tính năng và nén hơn nữa. tính năng thống trị cho đến khoảng năm 2015 khi các CNN / Transformers trên log-mel thô bắt kịp.

**Resolution trade.**FFT lớn hơn = độ phân giải tần số tốt hơn nhưng độ phân giải thời gian tồi tệ hơn. 25 ms / 10 ms là mặc định của âm thanh-ML; 50 ms / 12,5 ms cho âm nhạc; 5 ms / 2 ms cho phát hiện tạm thời (những đập trống, âm thanh).

```figure
spectrogram-window
```

## Hãy xây dựng nó

### Bước 1: khung hình sóng

```python
def frame(signal, frame_len, hop):
    n = 1 + (len(signal) - frame_len) // hop
    return [signal[i * hop : i * hop + frame_len] for i in range(n)]
```

Một clip 10 giây 16 kHz với `frame_len=400, hop=160`Tạo ra 998 khung hình.

### Bước 2: cửa sổ Hann

```python
import math

def hann(N):
    return [0.5 * (1 - math.cos(2 * math.pi * n / (N - 1))) for n in range(N)]
```

Tăng số nhân tố trước FFT. loại bỏ rò rỉ quang phổ do cắt giảm ở các điểm cuối không bằng 0.

### Bước 3: Độ lớn STFT

```python
def stft_magnitude(signal, frame_len=400, hop=160):
    win = hann(frame_len)
    frames = frame(signal, frame_len, hop)
    return [magnitudes(dft([w * s for w, s in zip(win, f)])) for f in frames]
```

Sử dụng sản xuất `torch.stft`hoặc `librosa.stft`(FFT hỗ trợ, vectorized). vòng lặp ở đây là giáo dục; nó chạy trên clip ngắn trong `code/main.py`- Tôi không biết.

### Bước 4: Mel filterbank

```python
def hz_to_mel(f):
    return 2595.0 * math.log10(1.0 + f / 700.0)

def mel_to_hz(m):
    return 700.0 * (10 ** (m / 2595.0) - 1)

def mel_filterbank(n_mels, n_fft, sr, fmin=0, fmax=None):
    fmax = fmax or sr / 2
    mels = [hz_to_mel(fmin) + (hz_to_mel(fmax) - hz_to_mel(fmin)) * i / (n_mels + 1)
            for i in range(n_mels + 2)]
    hzs = [mel_to_hz(m) for m in mels]
    bins = [int(h * n_fft / sr) for h in hzs]
    fb = [[0.0] * (n_fft // 2 + 1) for _ in range(n_mels)]
    for m in range(n_mels):
        for k in range(bins[m], bins[m + 1]):
            fb[m][k] = (k - bins[m]) / max(1, bins[m + 1] - bins[m])
        for k in range(bins[m + 1], bins[m + 2]):
            fb[m][k] = (bins[m + 2] - k) / max(1, bins[m + 2] - bins[m + 1])
    return fb
```

80 mels bao gồm 08 kHz với `n_fft=400`cho một `(80, 201)`Matrix.`(n_frames, 201)`STFT lớn bằng chuyển để có được `(n_frames, 80)`MEL spectrogram.

### Bước 5: log-mail

```python
def log_mel(mel_spec, eps=1e-10):
    return [[math.log(max(v, eps)) for v in frame] for frame in mel_spec]
```

Các lựa chọn thay thế chung: `librosa.power_to_db`(Db chuẩn hóa tham chiếu),`10 * log10(power + eps)`Whisper sử dụng một clip liên quan hơn + bình thường hóa thói quen (xem Whisper's `log_mel_spectrogram`().

### Bước 6: MFCC

```python
def dct_ii(x, n_coeffs):
    N = len(x)
    return [
        sum(x[n] * math.cos(math.pi * k * (2 * n + 1) / (2 * N)) for n in range(N))
        for k in range(n_coeffs)
    ]
```

Đưa DCT vào mỗi khung log-mel, giữ 13 hợp đồng đầu tiên. đó là matrix MFCC của bạn. hợp đồng đầu tiên thường bị giảm (nó mã hóa năng lượng tổng thể).

## Sử dụng nó

Số 2026:

| Task | Features |
|------|----------|
| ASR (Whisper, Parakeet, SeamlessM4T) | 80 log-mels, 10 ms hop, 25 ms window |
| TTS acoustic model (VITS, F5-TTS, Kokoro) | 80 mels, 5–12 ms hop for fine temporal control |
| Audio classification (AST, PANNs, BEATs) | 128 log-mels, 10 ms hop |
| Speaker embedding (ECAPA-TDNN, WavLM) | 80 log-mels or raw-waveform SSL |
| Music (MusicGen, Stable Audio 2) | EnCodec discrete tokens (not mels) |
| Keyword spotting | 40 MFCCs for tiny devices |

Quy tắc: **if you are not working on music, start with 80 log-mels.**Cánh nặng bằng chứng là bất kỳ sự lệch lạc nào.

## Những bẫy vẫn còn tồn tại vào năm 2026

- **Mel count mismatch.**Đào tạo với 80 m, suy luận với 128 m, thất bại im lặng, ghi hình dạng tính năng ở cả hai đầu.
- **Sample-rate mismatch upstream.**Mels tính toán ở 22,05 kHz trông khác với 16 kHz.
- **dB vs log.**Whisper mong đợi log-mel, không phải dB-mel. Một số đường ống HF tự phát hiện; mã tùy chỉnh của bạn sẽ không.
- **Normalization drift.**Tự bình thường hóa trong quá trình đào tạo, bình thường hóa toàn cầu trong quá trình suy luận.
- **Leakage from padding.**Việc đệm không cuối của clip tạo ra một quang phổ phẳng trong khung sau.

## Chuyển nó

Cứ như `outputs/skill-feature-extractor.md`. Khả năng chọn loại tính năng, số lượng mel, khung / hop và bình thường hóa cho một mục tiêu mô hình nhất định.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`Nó tổng hợp một chirp (tần số quét 200 → 4000 Hz) và in các argmax mel bin mỗi khung.
2. **Medium.**Lại chạy với `n_mels`trong `{40, 80, 128}`và `frame_len`trong `{200, 400, 800}`- Đo băng thông cao độ qua trục thời gian.
3. **Hard.**Thực hiện`power_to_db`và so sánh độ chính xác ASR của một phân loại CNN nhỏ trên AudioMNIST bằng cách sử dụng (a) log-mel nguyên liệu, (b) dB-mel với `ref=max`, (c) MFCC-13 + delta + delta-delta.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Frame | A slice | 25 ms chunk of waveform fed to one FFT. |
| Hop | Stride | Samples between consecutive frames; 10 ms is ASR default. |
| Window | Hann/Hamming thing | Point-wise multiplier that tapers the frame edges to zero. |
| STFT | Spectrogram generator | Framed + windowed FFT; yields time × frequency matrix. |
| Mel | Warped frequency | Log-perception scale; `m = 2595·log10(1 + f/700)`. |
| Filterbank | The matrix | Triangular filters that project STFT onto mel bins. |
| Log-mel | Whisper's input | `log(mel_spec + eps)`; standardized in 2026. |
| MFCC | Old-school feature | DCT of log-mel; 13 coeffs, decorrelated. |

## Đọc thêm

- [Davis, Mermelstein (1980). Comparison of parametric representations for monosyllabic word recognition](https://ieeexplore.ieee.org/document/1163420) báo cáo của MFCC.
- [Stevens, Volkmann, Newman (1937). A Scale for the Measurement of the Psychological Magnitude Pitch](https://pubs.aip.org/asa/jasa/article-abstract/8/3/185/735757/) thang điểm mel ban đầu.
- [OpenAI — Whisper source, log_mel_spectrogram](https://github.com/openai/whisper/blob/main/whisper/audio.py) đọc thực hiện tham chiếu.
- [librosa feature extraction docs](https://librosa.org/doc/latest/api/feature.html) tham chiếu cho `mfcc`- `melspectrogram`, và nhảy / cửa sổ.
- [NVIDIA NeMo — audio preprocessing](https://docs.nvidia.com/deeplearning/nemo/user-guide/docs/en/main/asr/asr_all.html#featurizers) đường ống quy mô sản xuất cho các mô hình Parakeet + Canary.
