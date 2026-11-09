# Text-to-Speech (TTS)  Từ Tacotron đến F5 và Kokoro

> ASR đảo ngược giọng nói thành văn bản; TTS đảo ngược văn bản thành giọng nói. Dòng 2026 gồm ba phần: văn bản → token, token → mel, mel → dạng sóng. Mỗi phần có mô hình mặc định phù hợp với máy tính xách tay.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 09 (Seq2Seq), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## Vấn đề

Bạn có một chuỗi: "Xin hãy nhắc tôi để tưới cây vào 6 giờ chiều". Bạn cần một đoạn âm thanh 3 giây có âm thanh tự nhiên, có âm âm âm chính xác (phát ngơi, căng thẳng), phát âm "cây" với giọng nói đúng, và chạy trong dưới 300 ms trên một CPU cho một trợ lý giọng nói trực tiếp. Bạn cũng cần phải trao đổi giọng nói, xử lý nhập mã chuyển đổi ("hoàn ý tôi vào 6 giờ chiều, daijoubu?"), và không xấu hổ về tên.

Các đường ống TTS hiện đại trông như thế này:

1. **Text frontend.**Tiêu chuẩn hóa văn bản (thang ngày, số, email), chuyển đổi thành âm hoặc mã thông báo từ phụ, dự đoán các tính năng prosody.
2. **Acoustic model.**Text → mel spectrogram. Tacotron 2 (2017), FastSpeech 2 (2020), VITS (2021), F5-TTS (2024), Kokoro (2024).
3. **Vocoder.**Mel → dạng sóng. WaveNet (2016), WaveRNN, HiFi-GAN (2020), BigVGAN (2022), các bộ phận codec thần kinh trong năm 2024+.

Năm 2026, âm thanh + vocoder phân chia mờ với các mô hình phân tán đầu đến cuối và phù hợp với dòng chảy.

## Khái niệm

![Tacotron, FastSpeech, VITS, F5/Kokoro side-by-side](../assets/tts.svg)

**Tacotron 2 (2017).**Seq2seq: chár-embedding → BiLSTM encoder → vị trí nhạy cảm chú ý → autogressive LSTM decoder phát ra khung mel. chậm (AR), dao động trên văn bản dài.

**FastSpeech 2 (2020).**Không tự rút. Tự đoán thời gian đưa ra số khung mel mỗi âm thanh nhận được. 1 vượt qua, nhanh hơn Tacotron 10x. mất một số tự nhiên (sự sắp xếp đơn giản) nhưng tàu khắp nơi.

**VITS (2021).**Cùng đào tạo bộ mã hóa + thời gian dựa trên dòng chảy + bộ giọng HiFi-GAN kết thúc đến kết thúc với suy luận biến đổi. chất lượng cao, mô hình đơn. TTS nguồn mở thống trị 20222024. Các biến thể: YourTTS (những loa không bắn), XTTS v2 (2024, Coqui).

**F5-TTS (2024).**Bộ biến đổi truyền thông trên dòng chảy phù hợp. Prosody tự nhiên, sao chép âm thanh bằng không chụp với 5 giây âm thanh tham chiếu.

**Kokoro (2024).**Tiểu (82M), có thể chạy CPU, tốt nhất trong lớp TTS tiếng Anh cho sử dụng thời gian thực.

**OpenAI TTS-1-HD, ElevenLabs v2.5, Google Chirp-3.**ElevenLabs v2.5 thẻ cảm xúc ("[môn thì thầm]", "[cười]") và giọng nói nhân vật thống trị sản xuất sách âm thanh vào năm 2026.

### Sự phát triển của Vocoder

| Era | Vocoder | Latency | Quality |
|-----|---------|---------|---------|
| 2016 | WaveNet | offline only | SOTA at release |
| 2018 | WaveRNN | ~realtime | good |
| 2020 | HiFi-GAN | 100× realtime | near-human |
| 2022 | BigVGAN | 50× realtime | generalizes across speakers/langs |
| 2024 | SNAC, DAC (neural codecs) | integrated with AR models | discrete tokens, bit-efficient |

Đến năm 2026, hầu hết các mô hình "TTS" đều là kết thúc từ văn bản đến dạng sóng; quang phổ mel là một đại diện nội bộ.

### Đánh giá

- **MOS (Mean Opinion Score).**1/5 scale, nguồn từ đám đông.
- **CMOS (Comparative MOS).**Tương tự A-vs-B, khoảng thời gian tin cậy chặt chẽ hơn cho mỗi chú thích.
- **UTMOS, DNSMOS.**Các dự báo MOS thần kinh không tham chiếu được sử dụng cho bảng xếp hạng.
- **CER (Character Error Rate) via ASR.**Lấy TTS ra qua Whisper, tính CER so với văn bản nhập.
- **SECS (Speaker Embedding Cosine Similarity).**Chất lượng nhân tạo giọng nói.

Số 2026 trên kiểm tra-tẩy sạch LibriTTS:

| Model | UTMOS | CER (via Whisper) | Size |
|-------|-------|-------------------|------|
| Ground truth | 4.08 | 1.2% | — |
| F5-TTS | 3.95 | 2.1% | 335M |
| XTTS v2 | 3.81 | 3.5% | 470M |
| VITS | 3.62 | 3.1% | 25M |
| Kokoro v0.19 | 3.87 | 1.8% | 82M |
| Parler-TTS Large | 3.76 | 2.8% | 2.3B |

```figure
sp-tts-stack
```

## Hãy xây dựng nó

### Bước 1: Phóng âm nhập

```python
from phonemizer import phonemize
ph = phonemize("Hello world", language="en-us", backend="espeak")
# 'həloʊ wɜːld'
```

Phoneme là cầu phổ quát. Tránh cung cấp văn bản thô cho bất cứ thứ gì dưới chất lượng cấp độ VITS.

### Bước 2: chạy Kokoro (2026 CPU mặc định)

```python
from kokoro import KPipeline
tts = KPipeline(lang_code="a")  # "a" = American English
audio, sr = tts("Please remind me to water the plants at 6 pm.", voice="af_bella")
# audio: float32 tensor, sr=24000
```

- Không hoạt động, một tập tin, 82M param.

### Bước 3: chạy F5-TTS với sao chép giọng nói

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="my_voice_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please remind me to water the plants.",
)
```

Gửi một đoạn video tham chiếu 5 giây + bản sao của nó; F5 nhân bản prosody và timbre.

### Bước 4: HiFi-GAN vocoder từ đầu

Quá lớn để phù hợp với một kịch bản hướng dẫn, nhưng hình dạng là:

```python
class HiFiGAN(nn.Module):
    def __init__(self, mel_channels=80, upsample_rates=[8, 8, 2, 2]):
        super().__init__()
        # 4 upsample blocks, total 256x to go from mel-rate to audio-rate
        ...
    def forward(self, mel):
        return self.blocks(mel)  # -> waveform
```

Việc đào tạo: đối kháng (chống phân biệt đối xử trên cửa sổ ngắn) + mất tích tái tạo quang phổ mel + mất tích phù hợp với tính năng.`hifi-gan`repo hoặc nvidia-neMo.

### Bước 5: toàn bộ đường ống (phép code)

```python
text = "Please remind me at 6 pm."
phones = phonemize(text)
mel = acoustic_model(phones, speaker=alice)      # [T, 80]
wav = vocoder(mel)                                # [T * 256]
soundfile.write("out.wav", wav, 24000)
```

## Sử dụng nó

Số 2026:

| Situation | Pick |
|-----------|------|
| Real-time English voice assistant | Kokoro (CPU) or XTTS v2 (GPU) |
| Voice cloning from 5 s reference | F5-TTS |
| Commercial character voices | ElevenLabs v2.5 |
| Audiobook narration | ElevenLabs v2.5 or XTTS v2 + fine-tune |
| Low-resource language | Train VITS on 5–20 h target-lang data |
| Expressive / emotion tags | ElevenLabs v2.5 or StyleTTS 2 fine-tune |

Nhà lãnh đạo nguồn mở từ năm 2026: **F5-TTS for quality, Kokoro for efficiency**Đừng tìm Tacotron trừ khi bạn là nhà sử học.

## Những bẫy

- **No text normalizer.**"Dr. Smith" đọc như "Doctor" hoặc "Drive"? "2026" như "twenty twenty six" hoặc "two zero two six"?
- **OOV proper nouns.**"Ghumare" → "ghyu-mair"? gửi một mô hình từ biểu đồ đến biểu ngữ cho các token không rõ.
- **Clipping.**Nguồn phát ra của Vocoder hiếm khi clip, nhưng sự không phù hợp quy mô mel khi suy luận có thể vượt quá ± 1.0.`np.clip(wav, -1, 1)`- Tôi không biết.
- **Sample-rate mismatch.**Kokoro phát ra 24 kHz; đường ống dẫn dòng chảy của bạn mong đợi 16 kHz → lấy mẫu lại hoặc nhận được danh hiệu.

## Chuyển nó

Cứ như `outputs/skill-tts-designer.md`Thiết kế một đường ống TTS cho một giọng nói, độ trễ và ngôn ngữ mục tiêu nhất định.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`- Xây dựng một từ điển âm từ từ ngữ đồ chơi, ước tính thời gian mỗi âm và in một lịch trình "mel" giả.
2. **Medium.**Lắp đặt Kokoro, tổng hợp cùng một câu với giọng nói `af_bella`và `am_adam`So sánh thời gian âm thanh và chất lượng chủ quan.
3. **Hard.**Hãy ghi lại một đoạn video tham chiếu 5 giây của chính mình, sử dụng F5-TTS để nhân bản nó, báo cáo SECS giữa tham chiếu và đầu ra nhân bản.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Phoneme | Sound unit | Abstract sound class; 39 in English (ARPABet). |
| Duration predictor | How long each phoneme lasts | Non-AR model output; integer frames per phoneme. |
| Vocoder | Mel → waveform | Neural net mapping mel-spec to raw samples. |
| HiFi-GAN | Standard vocoder | GAN-based; dominant 2020–2024. |
| MOS | Subjective quality | 1–5 mean opinion score from human raters. |
| SECS | Voice-clone metric | Cosine similarity between target and output speaker embedding. |
| F5-TTS | 2024 open-source SOTA | Flow-matching diffusion; zero-shot cloning. |
| Kokoro | CPU English leader | 82M-param model, Apache 2.0. |

## Đọc thêm

- [Shen et al. (2017). Tacotron 2](https://arxiv.org/abs/1712.05884) đường cơ sở của seq2seq.
- [Kim, Kong, Son (2021). VITS](https://arxiv.org/abs/2106.06103) dựa trên dòng chảy từ đầu đến cuối.
- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) SOTA mã nguồn mở hiện tại.
- [Kong, Kim, Bae (2020). HiFi-GAN](https://arxiv.org/abs/2010.05646) Vocoder vẫn được đưa vào năm 2026.
- [Kokoro-82M on HuggingFace](https://huggingface.co/hexgrad/Kokoro-82M) 2024 TTS tiếng Anh thân thiện với CPU.
