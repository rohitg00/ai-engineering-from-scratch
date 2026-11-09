# Định dạng âm thanh  Từ k-NN trên MFCC đến AST và BEAT

> Mọi thứ từ "dog barking vs siren" đến "thế ngữ này là gì" là phân loại âm thanh. Các tính năng là melt. Kiến trúc di chuyển mỗi thập kỷ. Thử nghiệm vẫn là AUC, F1, và nhớ mỗi lớp.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 3 · 06 (CNNs), Phase 5 · 08 (CNNs & RNNs for Text)
**Time:** ~75 minutes

## Vấn đề

Bạn có một đoạn clip 10 giây. Bạn muốn biết: "đó là gì?" âm thanh đô thị (siren, khoan, chó), lệnh nói (có/không/ dừng), ID ngôn ngữ (en/es/ar), cảm xúc loa (cực tức/ trung lập), hoặc âm thanh môi trường (trang / ngoài trời, đùa). Tất cả những điều này là * phân loại âm thanh*, và vào năm 2026 kiến trúc cơ bản đã trưởng thành: log-mel → CNN hoặc Transformer → softmax.

Vấn đề cốt lõi không phải là mạng. Đó là dữ liệu. Dữ liệu âm thanh có sự mất cân bằng lớp học tàn bạo, chuyển đổi miền mạnh mẽ (t sạch so với tiếng ồn), và tiếng ồn nhãn (người nào quyết định "bố ồn đô thị" so với "bồn ồn nhà hàng"?). 80% vấn đề là bảo quản, tăng cường và đánh giá, không thay đổi CNN với Transformer.

## Khái niệm

![Audio classification ladder: k-NN on MFCCs to AST to BEATs](../assets/audio-classification.svg)

**k-NN on MFCCs (the 1990s baseline).**MFCCs phẳng mỗi clip, tính toán sự tương tự cosine với một ngân hàng được dán nhãn, trả lại phiếu đa số của K trên cùng. Đáng ngạc nhiên mạnh mẽ trên các bộ dữ liệu sạch, nhỏ (Speech Commands, ESC-50).

**2D CNN on log-mels (2015-2019).**Chăm sóc `(T, n_mels)`Log-mail như một hình ảnh. áp dụng ResNet-18 hoặc kiểu VGG. trung bình toàn cầu tích hợp trục thời gian. Softmax trên lớp học.

**Audio Spectrogram Transformer, AST (2021-2024).**Lắp đặt log-mail (ví dụ: 16×16 patches), thêm các vị trí nhúng, cấp dữ liệu cho một ViT. State of the art trên AudioSet (mAP 0.485) cho việc học theo giám sát.

**BEATs and WavLM-base (2024-2026).**Bản thân giám sát trước khi tập luyện hàng triệu giờ. Hoạt động tốt cho nhiệm vụ của bạn với 1-10% dữ liệu giám sát bạn cần. Năm 2026 đây là điểm khởi đầu mặc định cho âm thanh không nói. BEATs-iter3 đánh bại AST 1-2 mAP trên AudioSet trong khi sử dụng 1/4 tính toán.

**Whisper-encoder as a frozen backbone (2024).**Hãy lấy bộ mã hóa của Whisper, bỏ bộ mã hóa, gắn một bộ phân loại tuyến tính gần SOTA trên ID ngôn ngữ và phân loại sự kiện đơn giản với không tăng âm thanh.

### Sự mất cân bằng lớp học là thách thức thực sự

ESC-50: 50 lớp, 40 clip mỗi  cân bằng, dễ dàng. UrbanSound8K: 10 lớp, không cân bằng 10:1. AudioSet: 632 lớp với đuôi dài 100.000: 1.

- Tiêu chuẩn lấy mẫu cân bằng trong quá trình đào tạo (không phải trong đánh giá).
- Trộn lại: liên kết trực tuyến hai clip (và nhãn của chúng) như sự tăng cường.
- SpecAugment: che giấu thời gian ngẫu nhiên và băng tần số.

### Đánh giá

- Tác dụng độc quyền đa lớp (Thật lệnh nói): độ chính xác top-1, độ chính xác top-5.
- Multi-class multi-label (AudioSet, UrbanSound-style): độ chính xác trung bình (mAP).
- Không cân bằng nặng: thu hồi mỗi lớp + macro F1.

2026 số bạn nên biết:

| Benchmark | Baseline | SOTA 2026 | Source |
|-----------|----------|-----------|--------|
| ESC-50 | 82% (AST) | 97.0% (BEATs-iter3) | BEATs paper (2024) |
| AudioSet mAP | 0.485 (AST) | 0.548 (BEATs-iter3) | HEAR leaderboard 2026 |
| Speech Commands v2 | 98% (CNN) | 99.0% (Audio-MAE) | HEAR v2 results |

```figure
mfcc-pipeline
```

## Hãy xây dựng nó

### Bước 1: Featurise

```python
def featurize_mfcc(signal, sr, n_mfcc=13, n_mels=40, frame_len=400, hop=160):
    mag = stft_magnitude(signal, frame_len, hop)
    fb = mel_filterbank(n_mels, frame_len, sr)
    mels = apply_filterbank(mag, fb)
    log = log_transform(mels)
    return [dct_ii(frame, n_mfcc) for frame in log]
```

### Bước 2: Tổng kết dài cố định

```python
def summarize(mfcc_frames):
    n = len(mfcc_frames[0])
    mean = [sum(f[i] for f in mfcc_frames) / len(mfcc_frames) for i in range(n)]
    var = [
        sum((f[i] - mean[i]) ** 2 for f in mfcc_frames) / len(mfcc_frames) for i in range(n)
    ]
    return mean + var
```

Đơn giản nhưng mạnh mẽ: trung bình + sự khác biệt qua thời gian cung cấp một nhúng cố định 26 chiều cho một MFCC 13 khoang.

### Bước 3: k-NN

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1e-12
    nb = math.sqrt(sum(x * x for x in b)) or 1e-12
    return dot / (na * nb)

def knn_classify(q, bank, labels, k=5):
    sims = sorted(range(len(bank)), key=lambda i: -cosine(q, bank[i]))[:k]
    votes = Counter(labels[i] for i in sims)
    return votes.most_common(1)[0][0]
```

### Bước 4: nâng cấp lên CNN trên log-mels

Trong PyTorch:

```python
import torch.nn as nn

class AudioCNN(nn.Module):
    def __init__(self, n_mels=80, n_classes=50):
        super().__init__()
        self.body = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(64, 128, 3, padding=1), nn.ReLU(),
            nn.AdaptiveAvgPool2d(1),
        )
        self.head = nn.Linear(128, n_classes)

    def forward(self, x):  # x: (B, 1, T, n_mels)
        return self.head(self.body(x).flatten(1))
```

Các thông số 3M. Các tàu trong ~ 10 phút trên ESC-50 với một RTX 4090. 80% + độ chính xác.

### Bước 5: chỉnh sửa một bộ biến đổi âm thanh được đào tạo trước (AST được hiển thị)

```python
from transformers import ASTFeatureExtractor, ASTForAudioClassification

ext = ASTFeatureExtractor.from_pretrained("MIT/ast-finetuned-audioset-10-10-0.4593")
model = ASTForAudioClassification.from_pretrained(
    "MIT/ast-finetuned-audioset-10-10-0.4593",
    num_labels=50,
    ignore_mismatched_sizes=True,
)

inputs = ext(audio, sampling_rate=16000, return_tensors="pt")
logits = model(**inputs).logits
```

Ví dụ chỉnh sửa AST từ Hub. BEATs, mặc định 2026, không có trên Hugging Face Hub: tải xuống một điểm kiểm soát từ [BEATs release in microsoft/unilm](https://github.com/microsoft/unilm/tree/master/beats)và tải nó với repo đó `BEATs`và `BEATsConfig`lớp; vòng tròn điều chỉnh tinh tế giữ hình dạng tương tự.

## Sử dụng nó

Số 2026:

| Situation | Start with |
|-----------|-----------|
| Tiny dataset (<1000 clips) | k-NN on MFCC means (your baseline) + audio augmentation |
| Medium dataset (1K–100K) | BEATs or AST fine-tune |
| Large dataset (>100K) | Train from scratch or fine-tune Whisper-encoder |
| Real-time, edge | 40-MFCC CNN, quantized to int8 (KWS-style) |
| Multi-label (AudioSet) | BEATs-iter3 with BCE loss + mixup + SpecAugment |
| Language ID | MMS-LID, SpeechBrain VoxLingua107 baseline |

Quy tắc quyết định: **start with a frozen backbone, not a fresh model**Định chỉnh đầu của BEATs sẽ giúp bạn có được 95% SOTA chỉ trong vài giờ, không phải vài tuần.

## Chuyển nó

Cứ như `outputs/skill-classifier-designer.md`Chọn kiến trúc, tăng cường, chiến lược cân bằng lớp học và đánh giá métrics cho một nhiệm vụ phân loại âm thanh nhất định.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`Nó đào tạo k-NN MFCC cơ sở trên một tập dữ liệu tổng hợp 4 lớp (tôn tinh khiết ở các độ cao khác nhau).
2. **Medium.**Thay thế `summarize`với [tỷ lệ trung bình, var, skew, kurtosis]. 4 khoảnh khắc tích hợp đánh giá trung bình + var trên cùng một tập dữ liệu tổng hợp?
3. **Hard.**Sử dụng `torchaudio`, đào tạo một 2D CNN trên ESC-50 gấp 1. báo cáo độ chính xác xác xác thực hóa chéo 5 lần. Thêm SpecAugment (mác thời gian = 20, mác tần số = 10) và báo cáo delta.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| AudioSet | The ImageNet of audio | Google's 2M-clip, 632-class weakly-labeled YouTube dataset. |
| ESC-50 | Small classification benchmark | 50 classes × 40 clips of environmental sounds. |
| AST | Audio Spectrogram Transformer | ViT on log-mel patches; 2021 SOTA. |
| BEATs | Self-supervised audio | Microsoft model, iter3 leads AudioSet as of 2026. |
| Mixup | Pair augmentation | `x = λ·x1 + (1-λ)·x2; y = λ·y1 + (1-λ)·y2`. |
| SpecAugment | Mask-based augmentation | Zero-out random time and frequency bands of the spectrogram. |
| mAP | Main multi-label metric | Mean average precision across classes and thresholds. |

## Đọc thêm

- [Gong, Chung, Glass (2021). AST: Audio Spectrogram Transformer](https://arxiv.org/abs/2104.01778) kiến trúc ghi chép từ 20212024.
- [Chen et al. (2022, rev. 2024). BEATs: Audio Pre-Training with Acoustic Tokenizers](https://arxiv.org/abs/2212.09058) dự định 2024+.
- [Park et al. (2019). SpecAugment](https://arxiv.org/abs/1904.08779) sự tăng cường âm thanh chiếm ưu thế.
- [Piczak (2015). ESC-50 dataset](https://github.com/karolpiczak/ESC-50) Định nghĩa 50 lớp sống sót.
- [Gemmeke et al. (2017). AudioSet](https://research.google.com/audioset/) Định dạng phân loại YouTube lớp 632; vẫn là tiêu chuẩn vàng.
