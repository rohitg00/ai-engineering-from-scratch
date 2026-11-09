# MusicGen, Stable Audio, Suno, và trận động đất cấp phép

> Thế hệ âm nhạc năm 2026: Suno v5 và Udio v4 thống trị thương mại; MusicGen, Stable Audio Open và ACE-Step dẫn đầu nguồn mở. Vấn đề kỹ thuật chủ yếu được giải quyết. Vấn đề pháp lý (Warner Music $ 500M giải quyết, UMG giải quyết) đã định hình lại lĩnh vực trong năm 2025-2026.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms), Phase 4 · 10 (Diffusion Models)
**Time:** ~75 minutes

## Vấn đề

Text → một đoạn nhạc từ 30 giây đến 4 phút, với lời bài hát, giọng hát và cấu trúc. Ba phụ vấn đề:

1. **Instrumental generation.**Các văn bản như "lo-fi hip-hop trống với khóa ấm áp" → âm thanh. MusicGen, Stable Audio, AudioLDM.
2. **Song generation (with vocals + lyrics).**"Câu nhạc nhạc quốc gia về những đêm mưa ở Texas" → bài hát đầy đủ.
3. **Conditional / controllable.**Lũ rộng clip hiện có, tái tạo cầu, đổi thể loại, tách gốc hoặc sơn.

## Khái niệm

![Music generation: token-LM vs diffusion, the 2026 model map](../assets/music-generation.svg)

### LM token trên mã codec thần kinh

Meta's **MusicGen**(2023, MIT) và nhiều phái sinh: điều kiện trên các bản ghi văn bản / giai điệu, dự đoán tự động các token EnCodec (32 kHz, 4 cuốn codebook), giải mã với EnCodec. 300M - 3.3B param. Nguyên tắc cơ bản mạnh; đấu tranh vượt quá 30 giây.

**ACE-Step**(có nguồn mở, 4B XL phát hành tháng 4 năm 2026) mở rộng điều này cho thế hệ đầy đủ bài hát theo điều kiện lyric.

### Sự pha trộn trên các chất tan chảy hoặc ẩn

**Stable Audio (2023)**và **Stable Audio Open (2024)**: phát sóng ẩn trên âm thanh nén. xuất sắc trong vòng lặp, thiết kế âm thanh, kết cấu môi trường. Không tốt cho các bài hát đầy đủ cấu trúc.

**AudioLDM / AudioLDM2**: văn bản-đâu âm thanh thông qua truyền tải ẩn hình kiểu T2I, tổng quát đến âm nhạc, hiệu ứng âm thanh, nói chuyện.

### Hybrid (sản xuất)  Suno, Udio, Lyria

Vòng đóng. Có lẽ là codec AR LM + vocoder dựa trên sự pha trộn với đầu giọng / trống / giai điệu chuyên dụng. Suno v5 (2026) là nhà lãnh đạo chất lượng ELO 1293. Udio v4 thêm inpainting + phân tách gốc (bass, trống, giọng hát tải về riêng biệt).

### Đánh giá

- **FAD (Fréchet Audio Distance).**Khoảng cách cấp độ nhúng giữa phân phối âm thanh được tạo vs thực sử dụng các tính năng VGGish hoặc PANN.
- **Musicality (subjective).**Suno v5 ELO 1293 dẫn.
- **Text-audio alignment.**CLAP điểm giữa prompt và output.
- **Musicality artifacts.**Chuyển đổi ngoài nhịp, chuyển động từ ngữ giọng, mất cấu trúc sau 30 giây.

## Bản đồ mô hình 2026

| Model | Params | Length | Vocals | License |
|-------|--------|--------|--------|---------|
| MusicGen-large | 3.3B | 30 s | no | MIT |
| Stable Audio Open | 1.2B | 47 s | no | Stability non-commercial |
| ACE-Step XL (Apr 2026) | 4B | &gt; 2 min | yes | Apache-2.0 |
| YuE | 7B | &gt; 2 min | yes, multilingual | Apache-2.0 |
| Suno v5 (closed) | ? | 4 min | yes, ELO 1293 | commercial |
| Udio v4 (closed) | ? | 4 min | yes + stems | commercial |
| Google Lyria 3 (closed) | ? | real-time | yes | commercial |
| MiniMax Music 2.5 | ? | 4 min | yes | commercial API |

## Tâm lý pháp lý (2025-2026)

- **Warner Music vs Suno settlement.**500 triệu đô la. WMG hiện đang giám sát sự giống AI, quyền âm nhạc và các bài hát được tạo bởi người dùng trên Suno.
- **EU AI Act**+ **California SB 942**: Âm nhạc được tạo ra bởi AI phải được tiết lộ.
- **Riffusion / MusicGen**theo MIT không có hành lý tuân thủ nhưng cũng không có giọng hát thương mại.

Các mô hình an toàn để tàu:

1. Tạo chỉ công cụ (MusicGen, Stable Audio Open, MIT/CC0 đầu ra).
2. Sử dụng API thương mại (Suno, Udio, ElevenLabs Music) với giấy phép mỗi thế hệ.
3. Đường sắt trên danh mục sở hữu hoặc được cấp phép (những doanh nghiệp hầu hết kết thúc ở đây).
4. Tag các thế hệ với dấu nước + siêu dữ liệu.

```figure
sp-codec-tokens
```

## Hãy xây dựng nó

### Bước 1: tạo bằng MusicGen

```python
from audiocraft.models import MusicGen
import torchaudio

model = MusicGen.get_pretrained("facebook/musicgen-small")
model.set_generation_params(duration=10)
wav = model.generate(["upbeat synthwave with driving drums, 128 BPM"])
torchaudio.save("out.wav", wav[0].cpu(), 32000)
```

Ba kích thước: `small`(300M, nhanh),`medium`(1.5B), `large`(3.3B) Tự nhỏ là đủ để "làm ý tưởng hạ cánh".

### Bước 2: Điều kiện âm thanh

```python
melody, sr = torchaudio.load("humming.wav")
wav = model.generate_with_chroma(
    ["jazz piano cover"],
    melody.squeeze(),
    sr,
)
```

MusicGen-melody lấy một sắc tố và bảo tồn giai điệu trong khi thay đổi timbre. hữu ích cho "giữ cho tôi giai điệu này như một quartet dây".

### Bước 3: Đánh giá FAD

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()

fad.get_fad_score("generated_folder/", "reference_folder/")
```

Xét khoảng cách tích hợp VGGish. hữu ích cho các bài kiểm tra hồi quy cấp thể loại; không thay thế cho người nghe.

### Bước 4: bổ sung vào dòng công việc LLM- nhạc

Kết hợp với những ý tưởng từ Bài học 7-8:

```python
prompt = "Write a 30-second jazz loop. Describe the drums, bass, and piano voicing."
description = llm.complete(prompt)
music = musicgen.generate([description], duration=30)
```

## Sử dụng nó

| Goal | Stack |
|------|-------|
| Instrumental sound design | Stable Audio Open |
| Game / adaptive music | Google Lyria RealTime (closed) |
| Full songs with vocals (commercial) | Suno v5 or Udio v4 with explicit license |
| Full songs with vocals (open) | ACE-Step XL or YuE |
| Short ad jingle | MusicGen melody-conditioned on a hummed reference |
| Music-video background | MusicGen + Stable Video Diffusion |

## Những bẫy vẫn còn tồn tại vào năm 2026

- **Copyright-laundering prompts.**"Song in the style of Taylor Swift"  Suno / Audio quảng cáo lọc những cái này bây giờ, mô hình mở không.
- **Repetition / drift past 30 s.**Các mô hình AR loop. Crossfade nhiều thế hệ, hoặc sử dụng ACE-Step để kết hợp cấu trúc.
- **Tempo drift.**Các mô hình đi xa BPM. Sử dụng thẻ BPM trong prompt và post-filter với librosa `beat_track`- Tôi không biết.
- **Vocal intelligibility.**Suno là một bài hát tuyệt vời; các mô hình mở thường bị nhạt về từ ngữ.
- **Mono output.**Các mô hình mở tạo ra mono hoặc giả stereo. nâng cấp với một tái thiết stereo thích hợp (ví dụ, sự pha trộn stereo của Cartesia).

## Chuyển nó

Cứ như `outputs/skill-music-designer.md`. Chọn mô hình, chiến lược cấp phép, kế hoạch chiều dài / cấu trúc và tiết lộ metadata cho việc triển khai nhạc-gen.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`Nó tạo ra một tiến trình hợp âm "tạo ra" + mô hình trống như các biểu tượng ASCII  một phim hoạt hình nhạc-gen.
2. **Medium.**Thiết lập `audiocraft`, tạo clip 10 giây trên 4 genre prompt với MusicGen-small, đo FAD với một tập hợp thể loại tham chiếu.
3. **Hard.**Sử dụng ACE-Step (hoặc MusicGen-melody), tạo ba biến thể của cùng một giai điệu với các lời nhắc timbre khác nhau.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| FAD | Audio FID | Fréchet distance between embedding distributions of real vs generated. |
| Chromagram | Melody as pitches | 12-dim per-frame vector; input to melody conditioning. |
| Stems | Instrument tracks | Separated bass / drums / vocals / melody as WAV. |
| Inpainting | Regen a section | Mask a time window; model regenerates just that. |
| CLAP | Text-audio CLIP | Contrastive audio-text embedding; eval text-audio alignment. |
| EnCodec | Music codec | Meta's neural codec used by MusicGen; 32 kHz, 4 codebooks. |

## Đọc thêm

- [Copet et al. (2023). MusicGen](https://arxiv.org/abs/2306.05284) chỉ số chuẩn tự động mở.
- [Evans et al. (2024). Stable Audio Open](https://arxiv.org/abs/2407.14358) thiết kế âm thanh mặc định.
- [ACE-Step](https://github.com/ace-step/ACE-Step) mở máy phát điện 4B đầy nhạc, tháng 4 năm 2026.
- [Suno v5 platform docs](https://suno.com) nhà lãnh đạo chất lượng thương mại.
- [AudioLDM2](https://arxiv.org/abs/2308.05734) Phân phối ẩn cho âm nhạc + hiệu ứng âm thanh.
- [WMG-Suno settlement coverage](https://www.musicbusinessworldwide.com/warner-music-group-settles-with-suno-strikes-first-of-its-kind-deal-with-ai-song-generator/) Tháng 11 năm 2025 tiền lệ.
