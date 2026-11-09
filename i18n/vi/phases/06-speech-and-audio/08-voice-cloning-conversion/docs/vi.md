# Phân phối giọng nói & chuyển đổi giọng nói

> Phân bản giọng nói đọc văn bản của bạn bằng giọng nói của người khác. Chuyển đổi giọng nói viết lại giọng nói của bạn vào tiếng nói của người khác trong khi vẫn giữ lại những gì bạn nói. Cả hai đều gắn liền với sự phân hủy tương tự: tách biệt danh tính loa khỏi nội dung.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 06 (Speaker Recognition), Phase 6 · 07 (TTS)
**Time:** ~75 minutes

## Vấn đề

Năm 2026, một đoạn âm thanh 5 giây là đủ để tạo ra một bản sao âm thanh chất lượng cao của bất kỳ ai với GPU tiêu dùng. ElevenLabs, F5-TTS, OpenVoice v2, VoiceBox tất cả các tàu không bắn hoặc ít bắn sao. Công nghệ là một ân phước (tải tiếp cận TTS, dubbing, tiếng nói hỗ trợ) và một vũ khí (scam cuộc gọi, deepfakes chính trị, IP trộm cắp).

Hai nhiệm vụ liên quan chặt chẽ:

- **Voice cloning (TTS-side):**văn bản + giọng nói tham chiếu 5 giây → âm thanh trong giọng nói đó.
- **Voice conversion (speech-side):**âm thanh nguồn (người A nói X) + giọng nói tham chiếu của người B → âm thanh của B nói X.

Cả hai đều tính toán một dạng sóng thành (container, speaker, prosody) và tái kết hợp nội dung từ một nguồn với speaker từ một nguồn khác.

Một hạn chế quan trọng mà bạn đang phải đặt vào năm 2026:**watermarking and consent gates are legally required in the EU (AI Act, enforceable August 2026) and in California (AB 2905, effective 2025)**Đường ống của bạn phải phát ra một dấu nước không thể nghe được và từ chối các bản sao không đồng ý.

## Khái niệm

![Voice cloning vs conversion: factorize, swap speaker, recombine](../assets/voice-cloning.svg)

**Zero-shot cloning.**Chuyển một clip 5 giây cho một mô hình đã được đào tạo trên hàng ngàn loa. Bộ mã hóa loa lập bản đồ clip cho một loa nhúng; bộ mã hóa TTS điều kiện trên nhúng cộng với văn bản.

Được sử dụng bởi: F5-TTS (2024), YourTTS (2022), XTTS v2 (2024), OpenVoice v2 (2024).

**Few-shot fine-tuning.**Lập lại 5-30 phút của giọng nói mục tiêu. LoRA-định chỉnh một mô hình cơ bản trong một giờ. chất lượng nhảy từ "tốt" đến "không thể phân biệt". Coqui và ElevenLabs đều hỗ trợ mô hình này; cộng đồng sử dụng nó với F5-TTS.

**Voice conversion (VC).**Hai gia đình:

- **Recognition-synthesis.**Động cơ ASR để lấy biểu diễn nội dung (ví dụ: hậu âm mềm, PPG), sau đó tổng hợp lại với nhúng loa mục tiêu. Năng bằng ngôn ngữ và giọng nói. Được sử dụng bởi KNN-VC (2023), Diff-HierVC (2023).
- **Disentanglement.**Trình tạo một bộ mã hóa tự động phân tách nội dung, loa và prosody trong không gian ẩn tại nút chai. Swap loa nhúng tại suy luận. chất lượng thấp hơn nhưng nhanh hơn. Được sử dụng bởi AutoVC (2019), biến thể VITS-VC.

**Neural codec-based cloning (2024+).**VALL-E, VALL-E 2, NaturalSpeech 3, VoiceBox  xử lý âm thanh như các token riêng biệt từ SoundStream / EnCodec, đào tạo mô hình tự rút hoặc phù hợp dòng chảy lớn hơn các token codec. Chất lượng tương đương với ElevenLabs trên các lời nhắc ngắn.

### Một phần đạo đức, không phải là một cái nắp

**Watermarking.**PerTh (Perth) và SilentCipher (2024) nhúng một ID ~ 16-32 bit vô hình trong âm thanh. tồn tại mã hóa lại, phát trực tuyến và chỉnh sửa phổ biến.

**Consent gates.**"Tôi, Rohit, vào ngày 2026-04-22, cho phép giọng nói này cho mục đích X".

**Detection.**AASIST, RawNet2 và Wav2Vec2-AASIST đóng vai trò là các máy dò. ASVspoof 2025 Challenge đã công bố EER 0,82,3% cho các máy dò hiện đại chống lại các sản phẩm ElevenLabs, VALL-E 2 và Bark.

### Số (2026)

| Model | Zero-shot? | SECS (target sim) | WER (intel.) | Params |
|-------|-----------|--------------------|--------------|--------|
| F5-TTS | Yes | 0.72 | 2.1% | 335M |
| XTTS v2 | Yes | 0.65 | 3.5% | 470M |
| OpenVoice v2 | Yes | 0.70 | 2.8% | 220M |
| VALL-E 2 | Yes | 0.77 | 2.4% | 370M |
| VoiceBox | Yes | 0.78 | 2.1% | 330M |

SECS > 0,70 thường không thể phân biệt với mục tiêu đối với hầu hết người nghe.

```figure
sp-voice-factorize
```

## Hãy xây dựng nó

### Bước 1: phân hủy với công nhận-sínhết (chỉ dùng mã demo trong main.py)

```python
def clone_pipeline(ref_audio, text, target_embedder, tts_model):
    speaker_emb = target_embedder.encode(ref_audio)
    mel = tts_model(text, speaker=speaker_emb)
    return vocoder(mel)
```

Khả năng thực hiện là rất đơn giản.`tts_model`và bộ mã hóa loa.

### Bước 2: Klon không bắn với F5-TTS

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="rohit_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please add milk and bread to my list.",
)
```

Bản sao tham chiếu phải phù hợp chính xác với âm thanh; sự không phù hợp phá vỡ sự sắp xếp.

### Bước 3: chuyển đổi giọng nói với KNN-VC

```python
import torch
from knnvc import KNNVC  # 2023 model, https://github.com/bshall/knn-vc
vc = KNNVC.load("wavlm-base-plus")
out_wav = vc.convert(source="my_voice.wav", target_pool=["alice_1.wav", "alice_2.wav"])
```

KNN-VC chạy WavLM để trích xuất các nhúng mỗi khung cho nguồn và mục tiêu pool, sau đó thay thế mỗi khung nguồn với hàng xóm gần nhất trong hồ.

### Bước 4: Nhập một dấu nước

```python
from silentcipher import SilentCipher
sc = SilentCipher(model="2024-06-01")
payload = b"consent_id:abc123;ts:1745353200"
watermarked = sc.embed(wav, sr=24000, message=payload)
detected = sc.detect(watermarked, sr=24000)   # returns payload bytes
```

~ 32 bit tải trọng hữu ích, có thể phát hiện sau khi mã hóa lại MP3 và tiếng ồn nhẹ.

### Bước 5: Cổng đồng ý

```python
def cloned_inference(text, ref_audio, consent_record):
    assert verify_signature(consent_record), "Signed consent required"
    assert consent_record["speaker_id"] == hash_speaker(ref_audio)
    wav = tts.infer(ref_file=ref_audio, gen_text=text)
    wav = watermark(wav, payload=consent_record["id"])
    return wav
```

## Sử dụng nó

Số 2026:

| Situation | Pick |
|-----------|------|
| 5-sec zero-shot clone, open-source | F5-TTS or OpenVoice v2 |
| Commercial production cloning | ElevenLabs Instant Voice Clone v2.5 |
| Voice conversion (rewriting) | KNN-VC or Diff-HierVC |
| Many-speaker fine-tune | StyleTTS 2 + speaker adapter |
| Cross-lingual cloning | XTTS v2 or VALL-E X |
| Deepfake detection | Wav2Vec2-AASIST |

## Những bẫy

- **Misaligned reference transcript.**F5-TTS và các loại tương tự yêu cầu văn bản tham chiếu phù hợp chính xác với âm thanh tham chiếu, bao gồm dấu chấm.
- **Reverberant reference.**Echo giết người.
- **Emotional mismatch.**Thuật ngữ "hạnh phúc" tạo ra những bản sao vui vẻ của mọi thứ.
- **Language leakage.**Khả năng nhân bản một người nói tiếng Anh sau đó yêu cầu mô hình nói tiếng Pháp thường mang theo giọng nói; sử dụng các mô hình đa ngôn ngữ (XTTS, VALL-E X).
- **No watermark.**Không được vận chuyển hợp pháp tại EU từ tháng 8 năm 2026.

## Chuyển nó

Cứ như `outputs/skill-voice-cloner.md`Thiết kế một đường ống khống chế hoặc chuyển đổi với cổng đồng ý + dấu nước + mục tiêu chất lượng.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`. Kiểm tra sự trao đổi nhúng loa bằng cách tính toán cosine giữa hai "những loa" trước và sau khi trao đổi.
2. **Medium.**Sử dụng OpenVoice v2 để nhân bản giọng nói của riêng bạn. đo SECS giữa tham chiếu và nhân bản. đo CER thông qua Whisper.
3. **Hard.**Lấy dấu nước SilentCipher vào 20 bản sao, chạy chúng qua mã MP3 128 kbps + mã hóa, phát hiện tải trọng hữu ích.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Zero-shot clone | 5 seconds is enough | Pretrained model + speaker embedding; no training. |
| PPG | Phonetic posteriorgram | Per-frame ASR posteriors used as language-agnostic content rep. |
| KNN-VC | Nearest-neighbor conversion | Replace each source frame with nearest target-pool frame. |
| Neural codec TTS | VALL-E style | AR model over EnCodec/SoundStream tokens. |
| Watermark | Inaudible signature | Bits embedded in audio, survive re-encode. |
| SECS | Cloning fidelity | Cosine between target and clone speaker embeddings. |
| AASIST | Deepfake detector | Anti-spoof model; detects synthesized speech. |

## Đọc thêm

- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) SOTA mã nguồn mở - sao chép không bắn.
- [Baevski et al. / Microsoft (2023). VALL-E](https://arxiv.org/abs/2301.02111)và [VALL-E 2 (2024)](https://arxiv.org/abs/2406.05370) TTS codec thần kinh.
- [Qian et al. (2019). AutoVC](https://arxiv.org/abs/1905.05879) chuyển đổi giọng nói dựa trên sự tách rời.
- [Baas, Waubert de Puiseau, Kamper (2023). KNN-VC](https://arxiv.org/abs/2305.18975) VC dựa trên tìm kiếm.
- [SilentCipher (2024) — Audio Watermarking](https://github.com/sony/silentcipher) Biểu tượng âm thanh 32 bit sẵn sàng sản xuất.
- [ASVspoof 2025 results](https://www.asvspoof.org/) cuộc đua vũ khí máy dò chống lại máy tổng hợp, được cập nhật vào năm 2026.
