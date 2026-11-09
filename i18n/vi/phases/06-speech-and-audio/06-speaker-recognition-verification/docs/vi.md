# Nhận thức và xác minh loa

> ASR hỏi "bọn họ nói gì?" nhận dạng loa hỏi "người nói nó?" toán học trông giống nhau  nhúng cộng với cosine  nhưng mọi quyết định sản xuất phụ thuộc vào một số EER duy nhất.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 22 (Embedding Models)
**Time:** ~45 minutes

## Vấn đề

Người dùng nói một từ khóa. Bạn muốn biết: liệu đây là người mà họ tuyên bố là (* xác minh*, 1:1), hay liệu đây là người đầu tiên trong ngân hàng đăng ký của bạn (* xác định*, 1:N)?

Trước năm 2018: GMM-UBM + i-vector. EER hợp lý nhưng dễ bị hỏng khi chuyển đổi kênh (cô điện thoại so với máy tính xách tay) và cảm xúc. 20182022: x-vector (cột sống TDNN được đào tạo với biên góc). 2022+: ECAPA-TDNN và WavLM-bích sâu lớn. Đến năm 2026 lĩnh vực này bị thống trị bởi ba mô hình và một métric.

Métric là**EER** Tỷ lệ lỗi bình đẳng. Đặt ngưỡng quyết định của bạn để Tỷ lệ chấp nhận sai = Tỷ lệ từ chối sai.

## Khái niệm

![Enrollment + verification pipeline with embedding + cosine + EER](../assets/speaker-verification.svg)

**The pipeline.**Đăng ký: ghi lại 530 giây của loa mục tiêu; tính toán một kết hợp kích thước cố định (192-d cho ECAPA-TDNN, 256-d cho WavLM-lớn).

**ECAPA-TDNN (2020, still dominant 2026).**Căng cường Chuyện Chăm sóc kênh, Chuyện truyền và Tập hợp - Mạng thần kinh chậm thời gian. 1D conv khối với kích thích squeeze, tập hợp sự chú ý đa đầu, tiếp theo là một lớp tuyến tính đến 192-d. Được đào tạo trên VoxCeleb 1 + 2 (2,700 loa, 1.1M phát biểu) với mất biên độ góc phụ (AAM-softmax).

**WavLM-SV (2022+).**Định chỉnh xương sống SSL WavLM lớn được đào tạo trước với mất AAM. chất lượng cao hơn nhưng chậm hơn  300+ MB so với 15 MB.

**x-vector (baseline).**TDNN + thống kê tập hợp. Classic; vẫn hữu ích trên CPU / cạnh.

**AAM-softmax.**Softmax tiêu chuẩn với margin bổ sung `m`trong không gian góc: `cos(θ + m)`cho lớp đúng. lực phân tách góc giữa các lớp. điển hình `m=0.2`, quy mô `s=30`- Tôi không biết.

### Điểm số

- **Cosine**giữa việc đăng ký và việc thử nghiệm.
- **PLDA (Probabilistic LDA).**Dự án nhúng vào một không gian ẩn trong đó cùng một loa so với người nói khác có tỷ lệ xác suất hình thức đóng. Thêm trên cosine để giảm +1020% EER. tiêu chuẩn trước năm 2020; bây giờ chỉ được sử dụng trong thiết lập tập hợp đóng.
- **Score normalization.** `S-norm`hoặc `AS-norm`: bình thường hóa mỗi điểm với một nhóm các phương tiện giả mạo và các loại khác.

### Số bạn nên biết (2026)

| Model | VoxCeleb1-O EER | Params | Throughput (A100) |
|-------|-----------------|--------|-------------------|
| x-vector (classic) | 3.10% | 5 M | 400× RT |
| ECAPA-TDNN | 0.87% | 15 M | 200× RT |
| WavLM-SV large | 0.42% | 316 M | 20× RT |
| Pyannote 3.1 segmentation + embedding | 0.65% | 6 M | 100× RT |
| ReDimNet (2024) | 0.39% | 24 M | 100× RT |

### Lượng chảy máu

"Ai nói khi nào" trong clip multi-speaker. Pipeline: VAD → phân đoạn → nhúng mỗi phân đoạn → cluster (gộp hoặc quang phổ) → ranh giới mịn.`pyannote.audio`3.1, kết hợp phân đoạn loa + nhúng + tập hợp sau một cuộc gọi.

```figure
sp-eer-crossover
```

## Hãy xây dựng nó

### Bước 1: Nhập đồ chơi từ số liệu thống kê của MFCC

```python
def embed_mfcc_stats(signal, sr):
    frames = featurize_mfcc(signal, sr, n_mfcc=13)
    mean = [sum(f[i] for f in frames) / len(frames) for i in range(13)]
    std = [
        math.sqrt(sum((f[i] - mean[i]) ** 2 for f in frames) / len(frames))
        for i in range(13)
    ]
    return mean + std  # 26-d
```

Không phải là một dặm để chỉ dạy.`code/main.py`sử dụng điều này như là một bằng chứng về khái niệm trên dữ liệu loa tổng hợp.

### Bước 2: tương tự cosine + ngưỡng

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0

def verify(enroll, test, threshold=0.75):
    return cosine(enroll, test) >= threshold
```

### Bước 3: EER từ các cặp tương đồng

```python
def eer(same_scores, diff_scores):
    thresholds = sorted(set(same_scores + diff_scores))
    best = (1.0, 1.0, 0.0)  # (fa, fr, threshold)
    for t in thresholds:
        fr = sum(1 for s in same_scores if s < t) / len(same_scores)
        fa = sum(1 for s in diff_scores if s >= t) / len(diff_scores)
        if abs(fa - fr) < abs(best[0] - best[1]):
            best = (fa, fr, t)
    return (best[0] + best[1]) / 2, best[2]
```

Trả về (eer, threshold_at_eer). báo cáo cả hai.

### Bước 4: sản xuất với SpeechBrain

```python
from speechbrain.pretrained import EncoderClassifier

clf = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb")

# enroll: average the embeddings of 3-5 clean samples
enroll = torch.stack([clf.encode_batch(load(x)) for x in enrollment_clips]).mean(0)
# verify
score = clf.similarity(enroll, clf.encode_batch(load("test.wav"))).item()
verdict = score > 0.25   # ECAPA typical threshold; tune on your data
```

### Bước 5: ghi nhật ký với note

```python
from pyannote.audio import Pipeline

pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
diarization = pipe("meeting.wav", num_speakers=None)
for turn, _, speaker in diarization.itertracks(yield_label=True):
    print(f"{turn.start:.1f}–{turn.end:.1f}  {speaker}")
```

## Sử dụng nó

Số 2026:

| Situation | Pick |
|-----------|------|
| Closed-set 1:1 verification, edge | ECAPA-TDNN + cosine threshold |
| Open-set verification, cloud | WavLM-SV + AS-norm |
| Diarization (meetings, podcasts) | `pyannote/speaker-diarization-3.1` |
| Anti-spoofing (replay / deepfake detection) | AASIST or RawNet2 |
| Tiny embedded (KWS + enrollment) | Titanet-Small (NeMo) |

## Những bẫy

- **Channel mismatch.**Mô hình được đào tạo trên VoxCeleb (video web) ≠ âm thanh cuộc gọi điện thoại.
- **Short utterances.**EER giảm mạnh dưới 3 giây âm thanh thử nghiệm.
- **Enrollment with noise.**Một lần ghi âm tiếng ồn sẽ làm độc đinh.
- **Fixed threshold across conditions.**Luôn điều chỉnh ngưỡng trên một bộ phát triển được giữ từ miền mục tiêu.
- **Cosine on non-normalized embeddings.**L2- bình thường trước; nếu không, độ lớn thống trị.

## Chuyển nó

Cứ như `outputs/skill-speaker-verifier.md`- Chọn mô hình, giao thức đăng ký, kế hoạch điều chỉnh ngưỡng và bảo vệ gian lận.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`- Xây dựng "những loa" tổng hợp (những hồ sơ âm thanh khác nhau), ghi danh, tính toán EER trong danh sách thử nghiệm 100 cặp.
2. **Medium.**Sử dụng SpeechBrain ECAPA trên 30 phát biểu VoxCeleb1 (mỗi phát ngôn viên 5 × 6).
3. **Hard.**Xây dựng toàn bộ đăng ký → nhật ký → xác minh đường ống với `pyannote.audio`Đánh giá DER trên bộ phát triển AMI.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| EER | The headline metric | Threshold where False Accept = False Reject. |
| Verification | 1:1 | "Is this Alice?" |
| Identification | 1:N | "Who is speaking?" |
| Open-set | Unknown possible | Test set can contain unenrolled speakers. |
| Enrollment | Registering | Computing a speaker's reference embedding. |
| AAM-softmax | The loss | Softmax with additive angular margin; forces cluster separation. |
| PLDA | Classic scoring | Probabilistic LDA; likelihood-ratio scoring on top of embeddings. |
| DER | Diarization metric | Diarization Error Rate — miss + false alarm + confusion. |

## Đọc thêm

- [Snyder et al. (2018). X-Vectors: Robust DNN Embeddings for Speaker Recognition](https://www.danielpovey.com/files/2018_icassp_xvectors.pdf) giấy sâu sâu cổ điển.
- [Desplanques et al. (2020). ECAPA-TDNN](https://arxiv.org/abs/2005.07143) kiến trúc thống trị 20202026.
- [Chen et al. (2022). WavLM: Large-Scale Self-Supervised Pre-Training for Full Stack Speech Processing](https://arxiv.org/abs/2110.13900) Lớp xương sống SSL cho SV và nhật ký hóa.
- [Bredin et al. (2023). pyannote.audio 3.1](https://github.com/pyannote/pyannote-audio) nhật ký sản xuất + đống nhúng.
- [VoxCeleb leaderboard (updated 2026)](https://www.robots.ox.ac.uk/~vgg/data/voxceleb/) Định dạng EER hiện tại trên các mô hình.
