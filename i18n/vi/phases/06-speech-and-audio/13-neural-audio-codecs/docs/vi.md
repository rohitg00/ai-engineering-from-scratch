# Codec âm thanh thần kinh  EnCodec, SNAC, Mimi, DAC và sự chia rẽ ngữ nghĩa-những âm thanh

> 2026 audio generation gần như là tất cả các token. EnCodec, SNAC, Mimi và DAC biến hình dạng sóng liên tục thành chuỗi riêng biệt mà một biến thể có thể dự đoán.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms), Phase 10 · 11 (Quantization), Phase 5 · 19 (Subword Tokenization)
**Time:** ~60 minutes

## Vấn đề

Các mô hình ngôn ngữ hoạt động trên các mã thông báo riêng biệt. Âm thanh là liên tục. Nếu bạn muốn một mô hình LLM kiểu cho ngôn ngữ / âm nhạc  MusicGen, Moshi, Sesame CSM, VibeVoice, Orpheus  bạn cần một **neural audio codec**: một bộ mã hóa học tập phân loại âm thanh thành một từ vựng nhỏ của các token, và một bộ mã hóa phù hợp tái tạo hình dạng sóng.

Hai gia đình đã xuất hiện:

1. **Reconstruction-first codecs** EnCodec, DAC. Tối ưu hóa chất lượng âm thanh nhận thức. Các token là "những âm thanh"  chúng ghi lại mọi thứ bao gồm danh tính loa, timbre, tiếng ồn nền.
2. **Semantic-first codecs** Mimi (Kyutai), SpeechTokenizer. Bắt đầu sách mã đầu tiên mã hóa nội dung ngôn ngữ / âm thanh (thường bằng cách chưng cất từ WavLM).

Những thông tin sâu sắc về năm 2024-2026: **a pure reconstruction codec gives you blurry speech when you try to generate from text.**Các mã codec của LLM phải học cả cấu trúc ngôn ngữ và cấu trúc âm thanh trong cùng một codebook, không có quy mô.

## Khái niệm

![Four codec landscape: EnCodec, DAC, SNAC (multi-scale), Mimi (semantic+acoustic)](../assets/codec-comparison.svg)

### Tránh cốt lõi: Quantization Vektor còn lại (RVQ)

Thay vì một cuốn sách mã lớn (có thể cần hàng triệu mã để có chất lượng tốt), tất cả các codec âm thanh hiện đại sử dụng **RVQ**: một loạt các codebook nhỏ. codebook đầu tiên định lượng sản xuất encoder; thứ hai định lượng dư lượng; vv Mỗi codebook là 1024 codebook. 8 codebook = từ vựng hiệu quả của $1024^8 = 10^{24}$- Tôi không biết.

Vào thời điểm suy luận, bộ giải mã tổng hợp tất cả các mã được chọn cho mỗi khung để tái cấu trúc.

### Bốn codec quan trọng vào năm 2026

**EnCodec (Meta, 2022).**Hình cơ bản. Mã mã hóa-bẻ khóa trên dạng sóng, nút nút rơm RVQ. 24 kHz, 32 sổ mã có thể, mặc định 4 sổ mã @ 1.5 kbps. Sử dụng `1D conv + transformer + 1D conv`Thiết kế, được sử dụng bởi MusicGen.

**DAC (Descript, 2023).**RVQ với sổ mã L2-tự chuẩn hóa, chức năng kích hoạt định kỳ, lỗ hổng cải thiện. Độ trung thực tái tạo cao nhất của bất kỳ codec mở nào  đôi khi không thể phân biệt với ngôn ngữ gốc với 12 sổ mã. 44.1 kHz băng thông đầy đủ.

**SNAC (Hubert Siuzdak, 2024).**RVQ nhiều quy mô  các sổ mã thô hoạt động với tốc độ khung thấp hơn so với các sổ cái tốt. Nó hiệu quả mô hình âm thanh theo cấp bậc: một "phác thảo" thô ở ~ 12 Hz cộng với chi tiết ở 50 Hz. Được sử dụng bởi Orpheus-3B vì cấu trúc bậc bậc được lập bản đồ tốt cho thế hệ dựa trên LM.

**Mimi (Kyutai, 2024).**Game-changer 2026: tốc độ khung hình 12,5 Hz ( cực thấp), 8 codebook @ 4.4 kbps. Codebook 0 là **distilled from WavLM** được đào tạo để dự đoán các tính năng nội dung nói chuyện của WavLM. Các codebook 1-7 là dư lượng âm thanh.

### Tốc độ khung hình quan trọng cho mô hình hóa ngôn ngữ

Tốc độ khung hình thấp hơn = chuỗi ngắn hơn = LM nhanh hơn.

| Codec | Frame rate | 1 s = N frames | Good for |
|-------|-----------|----------------|---------|
| EnCodec-24k | 75 Hz | 75 | music, general audio |
| DAC-44.1k | 86 Hz | 86 | high-fidelity music |
| SNAC-24k (coarse) | ~12 Hz | 12 | AR-LM efficient |
| Mimi | 12.5 Hz | 12.5 | streaming speech |

Ở 12,5 Hz, một phát biểu 10 giây chỉ là 125 khung codec  một bộ biến thể có thể dễ dàng dự đoán chúng.

### Các token ngữ nghĩa so với âm thanh

```
frame_t → [semantic_token_t, acoustic_token_0_t, acoustic_token_1_t, ..., acoustic_token_6_t]
```

- **Semantic token (codebook 0 in Mimi).**Mã hóa những gì đã được nói  âm, từ, nội dung.
- **Acoustic tokens (codebooks 1-7).**Định nghĩa âm thanh, danh tính loa, âm nhạc, tiếng ồn nền, chi tiết tinh tế.

Một LM AR dự đoán đầu tiên token ngữ nghĩa (được điều chỉnh trên văn bản), sau đó dự đoán token âm thanh (được điều chỉnh trên tham chiếu ngữ nghĩa + loa).

### 2026 chất lượng tái tạo (bit/s, tốc độ bit thấp hơn là tốt hơn)

| Codec | Bitrate | PESQ | ViSQOL |
|-------|---------|------|--------|
| Opus-20kbps | 20 kbps | 4.0 | 4.3 |
| EnCodec-6kbps | 6 kbps | 3.2 | 3.8 |
| DAC-6kbps | 6 kbps | 3.5 | 4.0 |
| SNAC-3kbps | 3 kbps | 3.3 | 3.8 |
| Mimi-4.4kbps | 4.4 kbps | 3.1 | 3.7 |

Các codec truyền thống như Opus vẫn thắng từng bit về chất lượng nhận thức.**discrete tokens**(mà Opus không sản xuất) và **generative-model quality**(làm gì LM có thể làm với những token).

```figure
rvq-codec-cascade
```

## Hãy xây dựng nó

### Bước 1: mã hóa bằng EnCodec

```python
from encodec import EncodecModel
import torch

model = EncodecModel.encodec_model_24khz()
model.set_target_bandwidth(6.0)  # kbps

wav = torch.randn(1, 1, 24000)
with torch.no_grad():
    encoded = model.encode(wav)
codes, scale = encoded[0]
# codes: (1, n_codebooks, n_frames), dtype=int64
```

`n_codebooks=8`với tốc độ 6 kbps. Mỗi mã là 0-1023 (10 bit).

### Bước 2: giải mã và đo tái tạo

```python
with torch.no_grad():
    wav_recon = model.decode([(codes, scale)])

from torchaudio.functional import compute_deltas
import torch.nn.functional as F

mse = F.mse_loss(wav_recon[:, :, :wav.shape[-1]], wav).item()
```

### Bước 3: chia cắt âm nghĩa-tâm âm (tình hình Mimi)

```python
from moshi.models import loaders
mimi = loaders.get_mimi()

with torch.no_grad():
    codes = mimi.encode(wav)  # shape (1, 8, frames@12.5Hz)

semantic = codes[:, 0]
acoustic = codes[:, 1:]
```

Bộ mã ngữ nghĩa 0 được sắp xếp với WavLM. Bạn có thể đào tạo một bộ biến đổi văn bản sang ngữ nghĩa  từ vựng nhỏ hơn nhiều so với đi trực tiếp sang âm thanh. Sau đó một điều kiện giải mã dạng âm thanh riêng biệt cho dạng sóng trên một tham chiếu loa.

### Bước 4: tại sao AR LM trên mã codec hoạt động

Đối với một clip phát biểu 10 giây tại 12.5 Hz của Mimi × 8 codebook:

```math
N_{\text{tokens}} = 10 \times 12.5 \times 8 = 1000 \text{ tokens}
```

1000 token là một bối cảnh tầm thường cho một bộ biến đổi. Một bộ biến đổi tham số 256M có thể tạo ra 10 giây nói chuyện trong vài millisecond trên một GPU hiện đại.

## Sử dụng nó

Vấn đề bản đồ → codec:

| Task | Codec |
|------|-------|
| General music generation | EnCodec-24k |
| Highest-fidelity reconstruction | DAC-44.1k |
| AR LM over speech (TTS) | SNAC or Mimi |
| Streaming full-duplex speech | Mimi (12.5 Hz) |
| Sound-effect library with text | EnCodec + T5 condition |
| Fine-grained audio editing | DAC + inpainting |

Quy tắc: **if you're building a generative model, start with Mimi or SNAC. If you're building a compression pipeline, use Opus.**

## Những bẫy

- **Too many codebooks.**Thêm codebook tăng độ trung thực theo đường thẳng nhưng chiều dài chuỗi LM cũng theo đường thẳng.
- **Frame-rate mismatch.**LM đào tạo trên 12,5 Hz Mimi sau đó điều chỉnh tinh tế trên 50 Hz EnCodec thất bại lặng lẽ.
- **Assuming all codebooks equal.**Trong Mimi, codebook 0 mang nội dung; mất nó phá hủy khả năng hiểu biết.
- **Using reconstruction quality as the only metric.**Một codec có thể có sự tái tạo tuyệt vời nhưng không thể sử dụng cho thế hệ dựa trên LM nếu cấu trúc ngữ nghĩa không tốt.

## Chuyển nó

Cứ như `outputs/skill-codec-picker.md`Chọn một codec cho một nhiệm vụ tạo hoặc nén nhất định.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`Nó thực hiện một bộ định lượng đồ chơi scalar + dư và đo lỗi tái tạo khi bạn thêm sách mã.
2. **Medium.**Thiết lập `encodec`và so sánh 1, 4, 8, 32 codebook trên một clip bài phát biểu kéo dài.
3. **Hard.**Load Mimi. Encode một clip. Thay thế codebook 0 bằng số nguyên số ngẫu nhiên; decode. Sau đó thay thế codebook 7 tương tự. So sánh hai sự tham nhũng  codebook 0 tham nhũng nên phá hủy khả năng hiểu biết; codebook 7 tham nhũng hầu như không thay đổi bất cứ điều gì.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| RVQ | Residual quantization | Cascade of small codebooks; each quantizes the previous residual. |
| Frame rate | Codec speed | How many token-frames per second. Lower = faster LM. |
| Semantic codebook | Codebook 0 (Mimi) | Codebook distilled from SSL features; encodes content. |
| Acoustic codebooks | Everything else | Timbre, prosody, noise, fine detail. |
| PESQ / ViSQOL | Perceptual quality | Objective metrics correlating with MOS. |
| EnCodec | Meta codec | The RVQ baseline; used by MusicGen. |
| Mimi | Kyutai codec | 12.5 Hz frame rate; semantic-acoustic split; powers Moshi. |

## Đọc thêm

- [Défossez et al. (2023). EnCodec](https://arxiv.org/abs/2210.13438) Hình điểm cơ bản RVQ.
- [Kumar et al. (2023). Descript Audio Codec (DAC)](https://arxiv.org/abs/2306.06546) Cung cấp trung thành nhất mở.
- [Siuzdak (2024). SNAC](https://arxiv.org/abs/2410.14411) RVQ đa quy mô.
- [Kyutai (2024). Mimi codec](https://kyutai.org/codec-explainer) phân chia âm nghĩa-tâm âm, chưng cất WavLM.
- [Borsos et al. (2023). AudioLM](https://arxiv.org/abs/2209.03143) mô hình ngữ nghĩa/ âm thanh hai giai đoạn.
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) codec RVQ được phát trực tuyến ban đầu.
