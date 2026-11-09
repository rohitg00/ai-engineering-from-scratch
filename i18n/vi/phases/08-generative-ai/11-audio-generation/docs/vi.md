# Tạo âm thanh

> Âm thanh là tín hiệu 1-D ở 16-48 kHz. Một clip năm giây là 80-240k mẫu. Không một biến thể nào trực tiếp tham gia vào chuỗi đó. Giải pháp cho mọi mô hình âm thanh sản xuất vào năm 2026 là giống nhau: một codec thần kinh (Encodec, SoundStream, DAC) nén âm thanh thành các token riêng biệt ở 50-75 Hz, và một mô hình biến thể hoặc phân tán tạo ra các token.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Audio Features), Phase 6 · 04 (ASR), Phase 8 · 06 (DDPM)
**Time:** ~45 minutes

## Vấn đề

Ba nhiệm vụ tạo âm thanh:

1. **Text-to-speech.**Với văn bản, tạo ra giọng nói. giọng nói sạch là băng thông hẹp và có cấu trúc âm thanh mạnh mẽ được giải quyết tốt bởi các biến đổi-over-tokens. VALL-E (Microsoft), NaturalSpeech 3, ElevenLabs, OpenAI TTS.
2. **Music generation.**Với một prompt (text, melody, chord progression, genre), sản xuất âm nhạc.
3. **Audio effects / sound design.**Khi được yêu cầu, tạo âm thanh xung quanh hoặc Foley.

Cả ba chạy trên cùng một nền: codec âm thanh thần kinh + token-AR hoặc máy phát sóng.

## Khái niệm

![Audio generation: codec tokens + transformer or diffusion](../assets/audio-generation.svg)

### Các codec âm thanh thần kinh

Encodec (Meta, 2022), SoundStream (Google, 2021), Descript Audio Codec (DAC, 2023). Một mã hóa xoắn nén nén nén nén nén hình dạng sóng thành một vector từng bước thời gian; RVQ chuyển đổi từng vector thành một loạt chỉ số codebook K. Decoder đảo ngược nó.

```
waveform (16000 samples/sec)
    └─ encoder conv ─┐
                     ├─ RVQ layer 1 → indices at 75 Hz
                     ├─ RVQ layer 2 → indices at 75 Hz
                     ├─ ...
                     └─ RVQ layer 8
```

### Hai mô hình tạo ra trên cùng

**Token-autoregressive.**Phẳng các token RVQ thành một chuỗi, chạy một bộ biến đổi chỉ có trình giải mã. MusicGen sử dụng "đối tương đồng bị trì hoãn" để phát ra các dòng K codebook song song với các dòng offset. VALL-E tạo các token giọng nói từ một lời nhắn văn bản + mẫu giọng nói 3 giây.

**Latent diffusion.**Lập mã codec như các dấu ẩn liên tục hoặc mô hình chúng với sự phân tán danh mục. Stable Audio 2.5 sử dụng sự phù hợp dòng chảy trên các dấu ẩn âm thanh liên tục. AudioLDM 2 sử dụng sự phân tán văn bản-đối với email-đối với âm thanh.

Xu hướng 2024-2026: sự phù hợp dòng chảy đang thắng lợi cho âm nhạc (sự suy luận nhanh hơn, các mẫu sạch hơn) trong khi token-AR vẫn thống trị ngôn ngữ vì nó tự nhiên là nguyên nhân và chảy tốt.

## Tâm lý sản xuất

| System | Task | Backbone | Latency |
|--------|------|----------|---------|
| ElevenLabs V3 | TTS | Token-AR + neural vocoder | ~300ms first token |
| OpenAI GPT-4o audio | Full-duplex speech | End-to-end multimodal AR | ~200ms |
| NaturalSpeech 3 | TTS | Latent flow matching | Non-streaming |
| Stable Audio 2.5 | Music / SFX | DiT + flow matching on audio latents | ~10s for 1-minute clip |
| Suno v4 | Full songs | Undisclosed; token-AR suspected | ~30s per song |
| Udio v1.5 | Full songs | Undisclosed | ~30s per song |
| MusicGen 3.3B | Music | Token-AR on Encodec 32kHz | Real-time |
| AudioCraft 2 | Music + SFX | Flow matching | ~5s for 5s clip |
| Riffusion v2 | Music | Spectrogram diffusion | ~10s |

```figure
score-matching
```

## Hãy xây dựng nó

`code/main.py`mô phỏng ý tưởng cốt lõi: đào tạo một biến thể nhỏ next-token trên chuỗi "tốc hiệu âm thanh" tổng hợp được tạo ra từ hai "tốc hiệu" khác nhau (đổi thay các token thấp và cao cho phong cách A, ramp đơn điệu cho phong cách B). Điều kiện trên phong cách và mẫu.

### Bước 1: Các token âm thanh tổng hợp

```python
def make_tokens(style, length, vocab_size, rng):
    if style == 0:  # "speech-like": alternating
        return [i % vocab_size for i in range(length)]
    # "music-like": ramp
    return [(i * 3) % vocab_size for i in range(length)]
```

### Bước 2: đào tạo một dự báo token nhỏ

Một dự đoán kiểu Bigram được điều chỉnh theo kiểu. Điểm là mô hình: mã codec → đào tạo entropy chéo → lấy mẫu tự động.

### Bước 3: mẫu theo điều kiện

Với biểu tượng phong cách và biểu tượng khởi điểm, lấy mẫu biểu tượng tiếp theo từ phân phối dự đoán.

## Những bẫy

- **Codec quality caps output quality.**Nếu codec không thể đại diện cho âm thanh một cách trung thành, không có lượng chất lượng máy phát điện giúp.
- **RVQ error accumulation.**Mỗi lớp RVQ mô hình hóa các phần còn lại của lớp trước. sai sót trên lớp 1 lây lan.
- **Musical structure.**30 giây của các token là 20k + token ở 75 Hz. Khó cho các bộ biến đổi. MusicGen sử dụng cửa sổ trượt + tiếp tục nhanh chóng; Stable Audio sử dụng clip ngắn hơn + giao diện chéo.
- **Artifacts at boundaries.**Sự trộn lẫn giữa các clip được tạo ra cần phải được chồng chéo cẩn thận.
- **Clean-data appetite.**Các máy phát âm nhạc cần hàng chục ngàn giờ âm nhạc được cấp phép.
- **Voice cloning ethics.**Một mẫu 3 giây cộng với một lời nhắc văn bản là đủ để VALL-E / XTTS / ElevenLabs nhân bản một giọng nói.

## Sử dụng nó

| Task | 2026 stack |
|------|------------|
| Commercial TTS | ElevenLabs, OpenAI TTS, or Azure Neural |
| Voice cloning (consent-verified) | XTTS v2 (open) or ElevenLabs Pro |
| Background music, fast | Stable Audio 2.5 API, Suno, or Udio |
| Music with lyrics | Suno v4 or Udio v1.5 |
| Sound effects / Foley | AudioCraft 2, ElevenLabs SFX, or Stable Audio Open |
| Real-time voice agent | GPT-4o realtime or Gemini Live |
| Open-weights music research | MusicGen 3.3B, Stable Audio Open 1.0, AudioLDM 2 |
| Dubbing / translation | HeyGen, ElevenLabs Dubbing |

## Chuyển nó

- Cứu lại`outputs/skill-audio-brief.md`. Skill lấy một đoạn văn âm thanh (phác vụ, thời gian, phong cách, giọng nói, giấy phép) và các kết quả: mô hình + lưu trữ, định dạng nhanh (chèn tag, mô tả phong cách, dấu hiệu cấu trúc), codec + máy phát điện + chuỗi vocoder, giao thức hạt giống, và kế hoạch đánh giá (MOS / CLAP điểm số / CER cho TTS / người dùng A / B).

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`và thiết lập phong cách rõ ràng. Kiểm tra các chuỗi được tạo phù hợp với mô hình phong cách.
2. **Medium.**Thêm giải mã song song chậm: mô phỏng 2 dòng token phải được bù đắp bằng 1 bước. Đào tạo một dự đoán chung.
3. **Hard.**Sử dụng các bộ chuyển đổi HuggingFace để chạy MusicGen-small tại địa phương. Tạo clip 10 giây với ba yêu cầu khác nhau; A / B cho sự tuân thủ phong cách.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Codec | "Neural compression" | Encoder / decoder for audio; typical output is 50-75 Hz tokens. |
| RVQ | "Residual VQ" | Cascade of K quantizers; each models the residual of the previous. |
| Token | "One codec symbol" | Discrete index into a codebook; 1024 or 2048 typical. |
| Delayed parallel | "Offset codebooks" | Emit K token streams with staggered offsets to reduce sequence length. |
| Flow matching | "The 2024 win for audio" | Straighter-path alternative to diffusion; faster sampling. |
| Voice prompt | "3-second sample" | Speaker embedding or token prefix that steers the cloned voice. |
| Mel spectrogram | "The visual" | Log-magnitude perceptual spectrogram; used by many TTS systems. |
| Vocoder | "Mel to wave" | Neural component that converts mel spectrograms back to audio. |

## Lưu ý sản xuất: âm thanh là một vấn đề phát trực tuyến

Âm thanh là một phương thức đầu ra người dùng mong đợi sẽ đến * khi nó được tạo ra*, không phải tất cả một lần. Trong các thuật ngữ sản xuất điều này có nghĩa là TPOT quan trọng (Thời gian mỗi mã thông báo đầu ra) bởi vì tốc độ nghe của người dùng là thông suất mục tiêu  chứ không phải tốc độ đọc của họ. Đối với âm thanh 16kHz được mã thông báo ở ~ 75 mã thông báo / giây (Encodec), máy chủ phải tạo ≥75 mã thông báo / giây cho mỗi người dùng để giữ cho phát lại mượt mà.

Hai hậu quả kiến trúc:

- **Flow-matching audio models cannot stream trivially.**Stable Audio 2.5 và AudioCraft 2 hiển thị độ dài clip cố định trong một lần truyền. Để phát trực tuyến, bạn làm nhỏ clip và biên giới chồng chéo  nghĩ về sự pha trộn cửa sổ  thêm 100-300ms độ trễ trên mặt so với mô hình AR codec.

Nếu sản phẩm là "tác động thoại trực tiếp" hoặc "chuyển tiếp âm nhạc thời gian thực", chọn con đường codec AR. Nếu nó là "đưa ra một clip 30 giây khi gửi", dòng chảy phù hợp thắng về chất lượng và độ trễ tổng thể.

## Đọc thêm

- [Défossez et al. (2022). Encodec: High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) tiêu chuẩn codec.
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) bộ xử lý âm thanh thần kinh đầu tiên được sử dụng rộng rãi.
- [Kumar et al. (2023). High-Fidelity Audio Compression with Improved RVQGAN (DAC)](https://arxiv.org/abs/2306.06546) DAC.
- [Wang et al. (2023). Neural Codec Language Models are Zero-Shot Text to Speech Synthesizers (VALL-E)](https://arxiv.org/abs/2301.02111) VALL-E.
- [Copet et al. (2023). Simple and Controllable Music Generation (MusicGen)](https://arxiv.org/abs/2306.05284) MusicGen.
- [Liu et al. (2023). AudioLDM 2: Learning Holistic Audio Generation with Self-supervised Pretraining](https://arxiv.org/abs/2308.05734) AudioLDM 2.
- [Stability AI (2025). Stable Audio 2.5](https://stability.ai/news-updates/stability-ai-introduces-stable-audio-25-the-first-audio-model-built-for-enterprise-sound-production-at-scale) 2025 text-to-music với dòng chảy phù hợp.
