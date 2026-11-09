# Audio Fundamentals  Waveforms, Sampling, Fourier Transform

> Các dạng sóng là tín hiệu nguyên liệu. Các quang phổ là đại diện. Các tính năng Mel là dạng thân thiện với ML. Mỗi đường ống ASR và TTS hiện đại đi qua bậc thang này, và bước đầu tiên là hiểu lấy mẫu và Fourier.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1 · 06 (Vectors & Matrices), Phase 1 · 14 (Probability Distributions)
**Time:** ~45 minutes

## Vấn đề

Một micrô tạo ra tín hiệu áp suất so với thời gian. Mạng thần kinh của bạn tiêu thụ các tensor. Giữa chúng nằm một loạt các quy tắc, khi bị vi phạm, tạo ra các lỗi im lặng: mô hình hoạt động tốt nhưng WER tăng gấp đôi, hoặc TTS gửi một tiếng ồn, hoặc một hệ thống nhân bản giọng nói ghi nhớ micro thay vì loa.

Mỗi lỗi trong hệ thống ngôn ngữ đều có thể được tìm thấy từ một trong ba câu hỏi:

1. Dữ liệu được ghi lại ở mức độ mẫu nào, và mô hình mong đợi gì?
2. tín hiệu có tên gọi không?
3. Bạn đang vận hành trên mẫu nguyên liệu hay trên một đại diện tần số?

Nếu làm đúng, phần còn lại của giai đoạn 6 sẽ dễ xử lý, nếu làm sai, thậm chí cả Whisper-Large-v4 cũng sẽ tạo ra rác.

## Khái niệm

![Waveform, sampling, DFT, and frequency bins visualized](../assets/audio-fundamentals.svg)

**Waveform.**Một bộ sưu tập một chiều của các floats trong `[-1.0, 1.0]`Để chuyển đổi thành giây, chia bằng tỷ lệ mẫu:`t = n / sr`Một clip 10 giây ở 16 kHz là một dải 160.000 float.

**Sampling rate (sr).**Số lượng mẫu mỗi giây.

| Rate | Use |
|------|-----|
| 8 kHz | Telephony, legacy VOIP. Nyquist at 4 kHz kills consonants. Avoid for ASR. |
| 16 kHz | ASR standard. Whisper, Parakeet, SeamlessM4T v2 all consume 16 kHz. |
| 22.05 kHz | TTS vocoder training for older models. |
| 24 kHz | Modern TTS (Kokoro, F5-TTS, xTTS v2). |
| 44.1 kHz | CD audio, music. |
| 48 kHz | Film, pro audio, high-fidelity TTS (VALL-E 2, NaturalSpeech 3). |

**Nyquist-Shannon.**Tỷ lệ mẫu của `sr`có thể thể đại diện một cách rõ ràng cho tần số lên đến `sr/2`- `sr/2`giới hạn là tần số Nyquist. năng lượng trên Nyquist được * aliased *  gấp xuống tần số thấp hơn  và làm hỏng tín hiệu.

**Bit depth.**PCM 16-bit (được ký int16, phạm vi ±32,767) là định dạng trao đổi phổ biến.`soundfile`đọc int16 nhưng phơi bày float32 array trong `[-1, 1]`- Tôi không biết.

**Fourier Transform.**Bất kỳ tín hiệu hữu hạn nào là tổng số các sinus ở tần số khác nhau.`N`mẫu, `N`Tỷ lệ liên quan phức tạp  một trong mỗi thùng tần số. `bin k`bản đồ tần số `k · sr / N`Hz. Tầm là độ dốc ở tần số đó, góc là pha.

**FFT.**Chuyển đổi Fourier nhanh: một `O(N log N)`thuật toán cho DFT khi `N`Mỗi thư viện âm thanh sử dụng FFT dưới nắp. một FFT mẫu 1024 ở 16 kHz cung cấp 512 thùng tần số có thể sử dụng trải dài 08 kHz ở độ phân giải 15,6 Hz.

**Framing + window.**Chúng tôi không làm FFT toàn bộ clip. Chúng tôi cắt nó thành các khung chồng chéo (thường là 25 ms với 10 ms hop), nhân mỗi khung bằng một chức năng cửa sổ (Hann, Hamming) để loại bỏ sự gián đoạn cạnh, sau đó FFT mỗi khung. Đây là chuyển đổi Fourier thời gian ngắn (STFT). Bài học 02 bắt đầu từ đây.

```figure
mel-scale
```

## Hãy xây dựng nó

### Bước 1: đọc một clip và vẽ hình dạng sóng

`code/main.py`chỉ sử dụng stdlib `wave`module để giữ cho demo miễn phí phụ thuộc.`soundfile`hoặc `torchaudio.load`(cả hai đều trở lại `(waveform, sr)`(Tuples):

```python
import soundfile as sf
waveform, sr = sf.read("clip.wav", dtype="float32")  # shape (T,), sr=int
```

### Bước 2: tổng hợp một sóng âm từ các nguyên tắc đầu tiên

```python
import math

def sine(freq_hz, sr, seconds, amp=0.5):
    n = int(sr * seconds)
    return [amp * math.sin(2 * math.pi * freq_hz * i / sr) for i in range(n)]
```

Một âm đạo 440 Hz (công nhạc A) ở 16 kHz trong 1 giây là 16.000 float.`wave.open(..., "wb")`sử dụng mã hóa PCM 16-bit.

### Bước 3: tính toán DFT bằng tay

```python
def dft(x):
    N = len(x)
    out = []
    for k in range(N):
        re = sum(x[n] * math.cos(-2 * math.pi * k * n / N) for n in range(N))
        im = sum(x[n] * math.sin(-2 * math.pi * k * n / N) for n in range(N))
        out.append((re, im))
    return out
```

`O(N²)` tốt cho `N=256`để xác nhận sự chính xác, vô dụng cho âm thanh thực sự.`numpy.fft.rfft`hoặc `torch.fft.rfft`- Tôi không biết.

### Bước 4: tìm tần số thống trị

Chỉ số đỉnh độ lớn `k_star`bản đồ tần số `k_star * sr / N`- Động hành này trên âm đạo 440 Hz sẽ trả lại một đỉnh ở bin`440 * N / sr`- Tôi không biết.

### Bước 5: thể hiện danh tính ẩn danh

Mô hình 7 kHz sinus ở 10 kHz (Nyquist = 5 kHz).`10 − 7 = 3 kHz`. FFT đỉnh xuất hiện ở 3 kHz. Đây là biểu diễn tên gọi cổ điển và lý do tại sao mọi DAC / ADC tàu với một tường gạch lọc đi thấp.

## Sử dụng nó

Những gì bạn sẽ gửi vào năm 2026:

| Task | Library | Why |
|------|---------|-----|
| Read/write WAV/FLAC/OGG | `soundfile` (libsndfile wrapper) | Fastest, stable, returns float32. |
| Resample | `torchaudio.transforms.Resample` or `librosa.resample` | Correct anti-aliasing built in. |
| STFT / Mel | `torchaudio` or `librosa` | GPU-friendly; PyTorch ecosystem. |
| Real-time streaming | `sounddevice` or `pyaudio` | Cross-platform PortAudio bindings. |
| Inspect a file | `ffprobe` or `soxi` | CLI, fast, reports sr/channels/codec. |

Quy tắc quyết định: **match sample rate before you match anything else**Whisper dự kiến 16 kHz mono float32 . Đưa nó 44,1 kHz stereo và bạn sẽ có rác giống như một lỗi mô hình.

## Chuyển nó

Cứ như `outputs/skill-audio-loader.md`Kỹ năng này giúp bạn kiểm tra rằng đầu vào âm thanh phù hợp với kỳ vọng của mô hình dòng chảy và lấy lại đúng khi không.

## Các bài tập

1. **Easy.**Kết hợp một hỗn hợp 1 giây của 220 Hz + 440 Hz + 880 Hz ở 16 kHz.
2. **Medium.**Tải lại một WAV 3 giây của giọng nói của bạn ở 48 kHz.`torchaudio.transforms.Resample`(với chống liêm), sau đó lên 16 kHz bằng cách sử dụng sự phân số ngây thơ (mỗi mẫu thứ ba).
3. **Hard.**Xây dựng STFT từ đầu chỉ sử dụng `math`và DFT từ bước 3. kích thước khung 400, hop 160, cửa sổ Hann.`matplotlib.pyplot.imshow`Đây là quang phổ của bài học 02.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Sample rate | How many samples per second | Frequency in Hz at which the ADC measures the signal. |
| Nyquist | The max frequency you can represent | `sr/2`; energy above it aliases back down. |
| Bit depth | Resolution of each sample | `int16` = 65,536 levels; `float32` = 24-bit precision in `[-1, 1]`. |
| DFT | The Fourier transform for sequences | `N` samples → `N` complex frequency coefficients. |
| FFT | The fast DFT | `O(N log N)` algorithm requiring `N` = power of 2. |
| Bin | Frequency column | `k · sr / N` Hz; resolution = `sr / N`. |
| STFT | Spectrogram under the hood | Framed + windowed FFT over time. |
| Aliasing | Weird frequency ghosts | Energy above Nyquist mirroring down to lower bins. |

## Đọc thêm

- [Shannon (1949). Communication in the Presence of Noise](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf) bài báo đằng sau định lý lấy mẫu.
- [Smith — The Scientist and Engineer's Guide to Digital Signal Processing](https://www.dspguide.com/ch8.htm) sách giáo khoa DSP miễn phí, theo luật.
- [librosa docs — audio primer](https://librosa.org/doc/latest/auto_tutorials/index.html) thực tế đi bộ với mã.
- [Heinrich Kuttruff — Room Acoustics (6th ed.)](https://www.taylorfrancis.com/books/mono/10.1201/9781315372150/room-acoustics-heinrich-kuttruff) tham khảo lý do tại sao âm thanh trong thế giới thực không phải là một sinus sạch.
- [Steve Eddins — FFT Interpretation notebook](https://blogs.mathworks.com/steve/2020/03/30/fft-spectrum-and-spectral-densities/) Nhận thức của con số tần số đã được giải quyết trong 10 phút.
