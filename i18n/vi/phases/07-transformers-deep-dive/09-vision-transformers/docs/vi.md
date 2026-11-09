# Máy biến hình thị giác (ViT)

> Một hình ảnh là một lưới các bản vá. Một câu là một lưới các mã thông báo. cùng một biến thể ăn cả hai.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 4 · 03 (CNNs), Phase 4 · 14 (Vision Transformers intro)
**Time:** ~45 minutes

## Vấn đề

Trước năm 2020, tầm nhìn máy tính có nghĩa là biến động. Mỗi SOTA trên ImageNet, COCO, và các tiêu chuẩn phát hiện sử dụng một xương sống CNN.

Dosovitskiy et al. (2020)  "Một hình ảnh có giá trị 16x16 từ"  cho thấy bạn có thể giảm hoàn toàn các biến dạng. Cắt một hình ảnh thành các bản vá kích thước cố định, chiếu theo tuyến tính mỗi bản vá vào một bản nhúng, cung cấp chuỗi cho một bộ mã hóa biến thể vanilla. Ở quy mô đủ (ImageNet-21k trước khi đào tạo hoặc lớn hơn), ViT phù hợp hoặc vượt qua các mô hình dựa trên ResNet.

ViT là khởi đầu của một mô hình rộng hơn vào năm 2026: một kiến trúc, nhiều phương pháp. Whisper biểu thị âm thanh. ViT biểu thị hình ảnh. Action token cho robot. Pixel token cho video. Transformer không quan tâm  cung cấp cho nó một chuỗi và nó học.

Đến năm 2026, ViT và các hậu duệ của nó (DeiT, Swin, DINOv2, ViT-22B, SAM 3) sở hữu hầu hết tầm nhìn. CNN vẫn giành chiến thắng trên các thiết bị cạnh và nhiệm vụ nhạy cảm với độ trễ. Mọi thứ khác đều có ViT ở đâu đó trong đống.

## Khái niệm

![Image → patches → tokens → transformer](../assets/vit.svg)

### Bước 1  Lắp đặt

Chia một `H × W × C`hình ảnh thành một `N × (P·P·C)`Dòng dải phẳng.`224 × 224`hình ảnh, `16 × 16`các bản vá → 196 bản vá có giá trị 768 mỗi.

```
image (224, 224, 3) → 14 × 14 grid of 16x16x3 patches → 196 vectors of length 768
```

kích thước patch là đòn bẩy. patch nhỏ hơn = nhiều token, độ phân giải tốt hơn, chi phí chú ý vuông. patch lớn hơn = thô hơn, rẻ hơn.

### Bước 2  nhúng tuyến tính

Một matrix học tập duy nhất dự đoán mỗi phát phẳng đến `d_model`. Tương đương với một convolution kích thước hạt nhân `P`và bước đi.`P`Trong PyTorch , đây là từ ngữ`nn.Conv2d(C, d_model, kernel_size=P, stride=P)` một thực hiện hai dòng.

### Bước 3  Prepend `[CLS]`token, thêm các tích hợp vị trí

- Hãy chuẩn bị cho một bài học được học`[CLS]`Đơn vị ẩn cuối cùng của nó là đại diện hình ảnh được sử dụng để phân loại.
- Thêm các embedment vị trí có thể học được (ViT- gốc) hoặc 2D sinusoidal (những biến thể sau đó).
- Năm 2024+ RoPE mở rộng thành 2D cho vị trí, đôi khi không có nhúng rõ ràng.

### Bước 4  mã hóa biến đổi tiêu chuẩn

Lập các khối của `LayerNorm → Self-Attention → + → LayerNorm → MLP → +`- Không có lớp đặc biệt về tầm nhìn. Đây là điểm nhấn giáo dục của bài báo.

### Bước 5  đầu

Để phân loại: lấy `[CLS]`trạng thái ẩn → tuyến tính → softmax. Đối với DINOv2 hoặc SAM, loại bỏ `[CLS]`, sử dụng các bản che đính trực tiếp.

### Các biến thể quan trọng

| Model | Year | Change |
|-------|------|--------|
| ViT | 2020 | The original. Fixed patch size, full global attention. |
| DeiT | 2021 | Distillation; trainable on ImageNet-1k only. |
| Swin | 2021 | Hierarchical with shifted windows. Fixed sub-quadratic cost. |
| DINOv2 | 2023 | Self-supervised (no labels). Best general vision features. |
| ViT-22B | 2023 | 22B params; scaling laws apply. |
| SigLIP | 2023 | ViT + language pair, sigmoid contrastive loss. |
| SAM 3 | 2025 | Segment anything; ViT-Large + promptable mask decoder. |

### Tại sao nó mất một thời gian

ViT cần *chất lượng dữ liệu rất nhiều* để phù hợp với CNN vì nó không có bất kỳ thiên vị cảm ứng của CNN (trình ảnh không thay đổi dịch, địa điểm). Không có hình ảnh có nhãn > 100M hoặc tự giám sát trước khi tập luyện mạnh mẽ, CNN vẫn chiến thắng ở tính toán phù hợp. DeiT đã khắc phục điều này vào năm 2021 bằng các thủ thuật chưng cất; DINOv2 đã khắc phục vĩnh viễn vào năm 2023 bằng tự giám sát.

```figure
n5-patch-stream
```

## Hãy xây dựng nó

Nhìn xem`code/main.py`Không có đào tạo ViT ở bất kỳ quy mô thực tế nào cần PyTorch và giờ GPU thời gian.

### Bước 1: hình ảnh giả

Một hình ảnh RGB 24 × 24 như một danh sách các hàng của `(R, G, B)`Chúng tôi sử dụng 6×6 patch → 16 patch, mỗi vector nhúng 108-d.

### Bước 2: Lắp đặt

```python
def patchify(image, P):
    H = len(image)
    W = len(image[0])
    patches = []
    for i in range(0, H, P):
        for j in range(0, W, P):
            patch = []
            for di in range(P):
                for dj in range(P):
                    patch.extend(image[i + di][j + dj])
            patches.append(patch)
    return patches
```

Trình tự Raster: hàng lớn trên lưới.

### Bước 3: nhúng tuyến tính

Bội mỗi phố phẳng bằng một số ngẫu nhiên `(patch_flat_size, d_model)`Matrix. kiểm tra hình dạng đầu ra là `(N_patches + 1, d_model)`sau khi chuẩn bị `[CLS]`- Tôi không biết.

### Bước 4: đếm các tham số cho ViT thực tế

Bác in số param cho ViT-Base: 12 lớp, 12 đầu, d=768, vá=16. So sánh với ResNet-50 (~25M). ViT-Base hạ cánh ở ~86M. ViT-Large ~307M. ViT-Huge ~632M.

## Sử dụng nó

```python
from transformers import ViTImageProcessor, ViTModel
import torch
from PIL import Image

processor = ViTImageProcessor.from_pretrained("google/vit-base-patch16-224-in21k")
model = ViTModel.from_pretrained("google/vit-base-patch16-224-in21k")

img = Image.open("cat.jpg")
inputs = processor(img, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, 197, 768): [CLS] + 196 patches
cls_emb = out[:, 0]                       # image representation
```

**DINOv2 embeddings are the 2026 default for image features.**Làm lạnh xương sống, tập luyện một cái đầu nhỏ. Nó hoạt động cho phân loại, lấy lại, phát hiện, ghi chú. Các điểm kiểm tra DINOv2 của Meta vượt qua CLIP trong mọi nhiệm vụ nhìn không văn bản.

**Patch-size picking.**Các mô hình nhỏ sử dụng 16×16 (ViT-B/16). Dự đoán mật (tín phân) sử dụng 8×8 hoặc 14×14 (SAM, DINOv2).

## Chuyển nó

Nhìn xem`outputs/skill-vit-configurator.md`. Khả năng chọn một biến thể ViT và kích thước vá cho một nhiệm vụ tầm nhìn mới do kích thước tập dữ liệu, độ phân giải và ngân sách tính toán.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`- Kiểm tra số lượng các vết bẻ bằng nhau`(H/P) * (W/P)`và kích thước của đệm phẳng bằng nhau `P*P*C`- Tôi không biết.
2. **Medium.**Thực hiện 2D sinusoidal vị trí nhúng  hai mã sinusoidal độc lập cho `row`và `col`Đưa chúng vào một PyTorch ViT nhỏ và so sánh độ chính xác vs. các vị trí có thể học được trên CIFAR-10.
3. **Hard.**Xây dựng một ViT (PyTorch) 3 tầng, đào tạo trên 1.000 hình ảnh MNIST với 4×4 bản vá. đo độ chính xác của thử nghiệm. Bây giờ thêm DINOv2 trước khi đào tạo trên cùng 1.000 hình ảnh (đơn giản hóa: chỉ cần đào tạo trình mã hóa để dự đoán nhúng bản vá từ các bản vá che giấu).

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Patch | "The vision-transformer token" | Flat vector of pixel values for a `P × P × C` region of the image. |
| Patchify | "Chop + flatten" | Slice image into non-overlapping patches, flatten each to a vector. |
| `[CLS]` token | "The image summary" | Prepended learnable token; its final embedding is the image representation. |
| Inductive bias | "What the model assumes" | ViT has fewer priors than CNNs; needs more data to make up the gap. |
| DINOv2 | "Self-supervised ViT" | Trained without labels using image augmentation + momentum teacher. Best general image features in 2026. |
| SigLIP | "CLIP's successor" | ViT + text encoder trained with sigmoid contrastive loss; better than CLIP on matched compute. |
| Swin | "Windowed ViT" | Hierarchical ViT with local attention + shifted windows; sub-quadratic. |
| Register tokens | "2023 trick" | A few extra learnable tokens that soak up attention sinks; improves DINOv2 features. |

## Đọc thêm

- [Dosovitskiy et al. (2020). An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale](https://arxiv.org/abs/2010.11929) tờ ViT.
- [Touvron et al. (2021). Training data-efficient image transformers & distillation through attention](https://arxiv.org/abs/2012.12877) Định nghĩa.
- [Liu et al. (2021). Swin Transformer: Hierarchical Vision Transformer using Shifted Windows](https://arxiv.org/abs/2103.14030) Động.
- [Oquab et al. (2023). DINOv2: Learning Robust Visual Features without Supervision](https://arxiv.org/abs/2304.07193) DINOv2.
- [Darcet et al. (2023). Vision Transformers Need Registers](https://arxiv.org/abs/2309.16588) sửa đổi mã đăng ký cho DINOv2.
