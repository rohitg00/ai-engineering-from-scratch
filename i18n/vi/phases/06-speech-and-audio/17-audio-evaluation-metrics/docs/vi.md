# Đánh giá âm thanh  WER, MOS, UTMOS, MMAU, FAD và bảng xếp hạng mở

> Bạn không thể gửi những gì bạn không thể đo lường. Bài học này nêu tên các số liệu 2026 cho mỗi nhiệm vụ âm thanh: ASR (WER, CER, RTFx), TTS (MOS, UTMOS, SECS, WER-on-ASR-round-trip), ngôn ngữ âm thanh (MMAU, LongAudioBench), âm nhạc (FAD, CLAP), và loa (EER).

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04, 06, 07, 09, 10; Phase 2 · 09 (Model Evaluation)
**Time:** ~60 minutes

## Vấn đề

Mỗi nhiệm vụ âm thanh có nhiều métrics, mỗi đo một trục khác nhau. Sử dụng métrics sai là cách bạn vận chuyển một mô hình trông tuyệt vời trên bảng điều khiển của bạn và khủng khiếp trong sản xuất. Danh sách 2026:

| Task | Primary | Secondary |
|------|---------|-----------|
| ASR | WER | CER · RTFx · first-token latency |
| TTS | MOS / UTMOS | SECS · WER-on-ASR-round-trip · CER · TTFA |
| Voice cloning | SECS (ECAPA cosine) | MOS · CER |
| Speaker verification | EER | minDCF · FAR / FRR at operating point |
| Diarization | DER | JER · speaker confusion |
| Audio classification | top-1 · mAP | macro F1 · per-class recall |
| Music generation | FAD | CLAP · listening panel MOS |
| Audio language model | MMAU-Pro | LongAudioBench · AudioCaps FENSE |
| Streaming S2S | latency P50/P95 | WER · MOS |

## Khái niệm

![Audio evaluation matrix — metrics vs tasks vs 2026 leaderboards](../assets/eval-landscape.svg)

### Các số liệu ASR

**WER (Word Error Rate).** `(S + D + I) / N`- chữ nhỏ, dấu chấm, bình thường hóa số trước khi ghi điểm.`jiwer`hoặc OpenAI `whisper_normalizer`. &lt;5% = đọc ngôn ngữ bằng con người.

**CER (Character Error Rate).**Tương tự công thức, cấp độ ký tự. được sử dụng cho ngôn ngữ âm thanh (Mandarin, tiếng Cantonese) nơi phân đoạn từ là mơ hồ.

**RTFx (inverse real-time factor).**2 giây âm thanh được xử lý mỗi giây. cao hơn là tốt hơn. Parakeet-TDT đạt 3380x. Whisper-large-v3 là ~30x.

**First-token latency.**Đường đồng hồ từ đầu vào âm thanh đến mã bản sao đầu tiên.

### TTS

**MOS (Mean Opinion Score).**1-5 người xếp hạng. tiêu chuẩn vàng nhưng chậm. Thu thập 20+ người nghe mỗi mẫu, 100+ mẫu mỗi mẫu.

**UTMOS (2022-2026).**Tiến sĩ đã học được dự báo MOS. tương quan với MOS con người trên các tiêu chuẩn tiêu chuẩn. F5-TTS: UTMOS 3.95; sự thật cơ bản: 4.08.

**SECS (Speaker Encoder Cosine Similarity).**Đối với việc nhân bản giọng nói. ECAPA nhúng cosine giữa tham chiếu và đầu ra nhân bản. &gt; 0,75 = nhân bản nhận ra.

**WER-on-ASR-round-trip.**Tiếp tục chạy Whisper trên đầu ra TTS, tính WER với văn bản nhập. Chụp lại khả năng hiểu biết. 2026 SOTA: &lt; 2% WER trên các bộ thử nghiệm tiếng Anh (chúng là bộ tiếng Mandarin báo cáo CER).

**TTFA (time-to-first-audio).**Thời gian trễ của đồng hồ tường. Kokoro-82M: ~ 100 ms; F5-TTS: ~ 1 giây.

### Đặc biệt về nhân tạo giọng nói

**SECS + MOS + CER**Một bản sao có điểm SECS cao nhưng MOS thấp có nghĩa là timbre-trực nhưng không tự nhiên; ngược lại có nghĩa là giọng nói tự nhiên nhưng không đúng.

### Kiểm tra loa

**EER (Equal Error Rate).**Giá trị ngưỡng khi tỷ lệ chấp nhận sai bằng tỷ lệ từ chối sai. ECAPA trên VoxCeleb1-O: 0,87%.

**minDCF (min Detection Cost).**Chi phí cân nhắc tại một điểm hoạt động được chọn (thường là FAR=0,01).

### Lượng chảy máu

**DER (Diarization Error Rate).** `(FA + Miss + Confusion) / total_speaker_time`. Phản ứng không được phát âm + phát âm báo động giả + confusion loa, mỗi lần là một phần nhỏ.

**JER (Jaccard Error Rate).**Thay vì DER, mạnh mẽ để phân đoạn ngắn thiên vị.

### Định dạng âm thanh

Nhiều nhãn: **mAP (mean Average Precision)**trên tất cả các lớp. AudioSet: 0.548 mAP cho BEATs-iter3.

Tác dụng độc quyền đa lớp: **top-1, top-5 accuracy**. Phân lệnh nói v2: 99,0% top-1 (Audio-MAE).

Không cân bằng: **macro F1**+ **per-class recall**. Báo cáo cho mỗi lớp  tổng độ chính xác ẩn các lớp thất bại.

### Tạo nhạc

**FAD (Fréchet Audio Distance).**Khoảng cách giữa các phân phối vGGish-trúng âm thanh thực vs. tạo. MusicGen- nhỏ trên MusicCaps: 4.5. MusicLM: 4.0. Thấp hơn tốt hơn.

**CLAP Score.**Điểm so sánh văn bản-audio bằng cách sử dụng nhúng CLAP. &gt; 0,3 = sự sắp xếp hợp lý.

**Listening panel MOS.**Suno v5 đạt ELO 1293 trên chuẩn ưu tiên cặp của Suno. Đó là số nhà cung cấp; TTS Arena xếp hạng ngôn ngữ, không phải âm nhạc.

### Các tiêu chuẩn ngôn ngữ âm thanh

**MMAU (Massive Multi-Audio Understanding).**10k cặp âm thanh-QA.

**MMAU-Pro.**1800 vật liệu cứng, bốn loại: giọng nói / âm thanh / âm nhạc / đa âm thanh. Cơ hội ngẫu nhiên 25% trên 4 chiều. Gemini 2.5 Pro tổng thể ~ 60%; đa âm thanh ~ 22% trên tất cả các mô hình.

**LongAudioBench.**Các đoạn clip dài vài phút với các truy vấn ngữ nghĩa.

**AudioCaps / Clotho.**Các tiêu chuẩn tiêu chuẩn: SPICE, CIDER, FENSE.

### Streaming speech-to-speech

**Latency P50 / P95 / P99.**Đồng hồ tường từ cuối người dùng nói đến phản ứng âm thanh đầu tiên.

**WER / MOS**trên đầu ra.

**Barge-in responsiveness.**Thời gian từ người dùng gián đoạn đến trợ lý câm.

### Các bảng xếp hạng năm 2026

| Leaderboard | Tracks | URL |
|------------|--------|-----|
| Open ASR Leaderboard (HF) | English + multilingual + long-form | `huggingface.co/spaces/hf-audio/open_asr_leaderboard` |
| TTS Arena (HF) | English TTS | `huggingface.co/spaces/TTS-AGI/TTS-Arena` |
| Artificial Analysis Speech | TTS + STT, ELO from paired votes | `artificialanalysis.ai/speech` |
| MMAU-Pro | LALM reasoning | `sonalkum.github.io/mmau-pro` |
| SpeakerBench / VoxSRC | Speaker recognition | `voxsrc.github.io` |
| MMAU music subset | Music LALM | (within MMAU) |
| HEAR benchmark | Self-supervised audio | `hearbenchmark.com` |

```figure
sp-wer-align
```

## Hãy xây dựng nó

### Bước 1: WER với bình thường hóa

```python
from jiwer import wer, Compose, ToLowerCase, RemovePunctuation, Strip

transform = Compose([ToLowerCase(), RemovePunctuation(), Strip()])
score = wer(
    truth="Please turn on the lights.",
    hypothesis="please turn on the light",
    truth_transform=transform,
    hypothesis_transform=transform,
)
# ~0.17
```

### Bước 2: TTS WER đi về

```python
def ttr_wer(tts_model, asr_model, texts):
    errors = []
    for txt in texts:
        audio = tts_model.synthesize(txt)
        recog = asr_model.transcribe(audio)
        errors.append(wer(truth=txt, hypothesis=recog))
    return sum(errors) / len(errors)
```

### Bước 3: SECS cho việc nhân bản giọng nói

```python
from speechbrain.inference.speaker import EncoderClassifier
sv = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb")

emb_ref = sv.encode_batch(load_wav("reference.wav"))
emb_clone = sv.encode_batch(load_wav("cloned.wav"))
secs = torch.nn.functional.cosine_similarity(emb_ref, emb_clone, dim=-1).item()
```

### Bước 4: FAD cho việc tạo ra âm nhạc

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()
score = fad.get_fad_score("generated_folder/", "reference_folder/")
```

### Bước 5: EER cho xác minh loa (cód giống như bài học 6)

```python
def eer(same_scores, diff_scores):
    thresholds = sorted(set(same_scores + diff_scores))
    best = (1.0, 0.0)
    for t in thresholds:
        far = sum(1 for s in diff_scores if s >= t) / len(diff_scores)
        frr = sum(1 for s in same_scores if s < t) / len(same_scores)
        if abs(far - frr) < best[0]:
            best = (abs(far - frr), (far + frr) / 2)
    return best[1]
```

## Sử dụng nó

Kết hợp mỗi triển khai với một vòng đánh giá cố định chạy trên mỗi bản cập nhật mô hình. Ba quy tắc chính:

1. **Normalize before scoring.**chữ nhỏ, dấu chấm, số mở rộng.
2. **Report distributions, not averages.**P50/P95/P99 cho thời gian trễ. Nhận hồi mỗi lớp cho phân loại. Mỗi loại cho MMAU.
3. **Run one canonical public benchmark.**Ngay cả khi dữ liệu sản xuất của bạn khác nhau, báo cáo trên Open ASR / TTS Arena / MMAU cho phép các nhà phê bình so sánh táo với táo.

## Những bẫy

- **UTMOS extrapolation.**Được đào tạo về ngôn ngữ sạch theo kiểu VCTK; ghi âm âm thanh ồn ào / sao chép / cảm xúc kém.
- **MOS panel bias.**20 nhân viên Amazon Mechanical Turk ≠ 20 người dùng mục tiêu.
- **FAD depends on reference set.**So sánh với phân phối tham chiếu tương tự trên các mô hình.
- **Aggregate WER.**Một WER tổng thể 5% có thể che giấu 30% WER trên giọng nói nhấn mạnh.
- **Public benchmark saturation.**Hầu hết các mô hình biên giới gần trần nhà trên các tiêu chuẩn chuẩn.

## Chuyển nó

Cứ như `outputs/skill-audio-evaluator.md`Chọn số liệu, chuẩn và định dạng báo cáo cho bất kỳ phiên bản mô hình âm thanh nào.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`- Xét WER / CER / EER / SECS / FAD-ish / MMAU-ish trên đầu vào đồ chơi.
2. **Medium.**Xây dựng một dây thừng WER đi lại và đi lại TTS. Tiêu chuẩn đầu ra Kokoro hoặc F5-TTS của bạn thông qua Whisper. Xét WER trên 50 lần.
3. **Hard.**Điểm lựa chọn Lớp 10 LALM của bạn trên bài phát biểu MMAU-Pro + đa bộ phận âm thanh (50 mục mỗi).

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| WER | ASR score | `(S+D+I)/N` at word level after normalization. |
| CER | Character WER | For tone languages or char-level systems. |
| MOS | Human opinion | 1-5 rating; 20+ listeners × 100 samples. |
| UTMOS | ML MOS predictor | Learned model; correlates ~0.9 with human MOS. |
| SECS | Voice-clone similarity | ECAPA cosine between reference and clone. |
| EER | Speaker verif score | Threshold where FAR = FRR. |
| DER | Diarization score | (FA + Miss + Confusion) / total. |
| FAD | Music-gen quality | Fréchet distance on VGGish embeddings. |
| RTFx | Throughput | Audio seconds per wall-clock second. |

## Đọc thêm

- [jiwer](https://github.com/jitsi/jiwer) Thư viện WER/CER với các tiện ích bình thường hóa.
- [UTMOS (Saeki et al. 2022)](https://arxiv.org/abs/2204.02152) học được dự đoán MOS.
- [Fréchet Audio Distance (Kilgour et al. 2019)](https://arxiv.org/abs/1812.08466) tiêu chuẩn âm nhạc.
- [Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) Định vị trực tiếp năm 2026
- [TTS Arena](https://huggingface.co/spaces/TTS-AGI/TTS-Arena) bảng xếp hạng TTS với số phiếu của con người.
- [MMAU-Pro benchmark](https://sonalkum.github.io/mmau-pro/) Đơn vị xếp hạng lý luận LALM.
- [HEAR benchmark](https://hearbenchmark.com/) các tiêu chuẩn SSL âm thanh.
