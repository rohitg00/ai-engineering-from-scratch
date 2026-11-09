# GAN điều kiện & Pix2Pix

> Sự mở khóa lớn đầu tiên của năm 2014-2017 là kiểm soát những gì một GAN tạo ra. Lên nhãn, hoặc hình ảnh, hoặc một câu. Pix2Pix đã làm phiên bản hình ảnh và nó vẫn đánh bại mọi mô hình văn bản chung-to-photos trong các nhiệm vụ hình ảnh-to-photos hẹp.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 03 (GANs), Phase 4 · 06 (U-Net), Phase 3 · 07 (CNNs)
**Time:** ~75 minutes

## Vấn đề

Một mẫu GAN vô điều kiện lấy mẫu khuôn mặt tùy ý. hữu ích cho một bản demo, vô dụng trong sản xuất. Bạn muốn: *mở bản phác thảo sang một bức ảnh*, *mở bản đồ sang một bức ảnh trên không*, *mở cảnh ban ngày sang ban đêm*, *mở màu một hình ảnh quy mô xám*. Trong tất cả những hình ảnh này, bạn được cung cấp một hình ảnh nhập$x$và phải phát hành $y$Có nhiều điều đáng tin cậy.$y$- Đúng vậy .$x$Một thất bại đối thủ không làm, bởi vì "có vẻ thật" là sắc bén.

GAN có điều kiện (Mirza & Osindero, 2014) thêm một điều kiện $c$như là một đầu vào cho cả hai $G$và $D$Pix2Pix (Isola et al., 2017) chuyên về điều này: điều kiện là một hình ảnh nhập đầy đủ, máy phát điện là một U-Net, phân biệt là một phân loại dựa trên các bản vá (PatchGAN), và mất mát là đối kháng + L1.

## Khái niệm

![Pix2Pix: U-Net generator, PatchGAN discriminator](../assets/pix2pix.svg)

**Conditional G.** $G(x, z) \to y$Trong Pix2Pix,$z$là trượt trong G (không có tiếng ồn nhập  Isola tìm thấy tiếng ồn rõ ràng bị bỏ qua).

**Conditional D.** $D(x, y) \to [0, 1]$. Input là *pair* (cấp, đầu ra). Đây là sự khác biệt chính: D phải đánh giá liệu$y$phù hợp với $x$, không chỉ là$y$trông thật.

**U-Net generator.**Mã hóa-kết giải có kết nối skip trên nút chai. Khí yết cho các nhiệm vụ mà đầu vào và đầu ra chia sẻ cấu trúc cấp thấp (về, hình xảo).

**PatchGAN discriminator.**Thay vì đưa ra một điểm thực/sự giả, D đưa ra một $N \times N$lưới mà mỗi tế bào đánh giá một lĩnh vực thụ thể của ~ 70 × 70 pixel. trung bình. Đây là một giả định trường ngẫu nhiên Markov: thực tế là địa phương.

**Loss.**

```math
\begin{aligned}
\text{loss}_G &= -\log D(x, G(x)) + \lambda \cdot \lVert y - G(x) \rVert_1 \\
\text{loss}_D &= -\log D(x, y) - \log(1 - D(x, G(x)))
\end{aligned}
```

Thuật ngữ L1 ổn định đào tạo và đẩy G về phía mục tiêu được biết đến. L1 cung cấp cạnh sắc nét hơn L2 (tương đương, không phải là trung bình). $\lambda = 100$là Pix2Pix mặc định.

## CycleGAN  khi bạn không có cặp

Pix2Pix cần được ghép $(x, y)$Data. CycleGAN (Zhu et al., 2017) giảm yêu cầu này với chi phí của một tổn thất thêm: mất * chu kỳ nhất quán * hai máy phát $G: X \to Y$và $F: Y \to X$- Đọc cho họ làm thế này$F(G(x)) \approx x$và $G(F(y)) \approx y$Điều này cho phép bạn chuyển đổi ngựa thành ngựa, mùa hè sang mùa đông, mà không có những ví dụ.

Năm 2026, không cặp hình ảnh-to-photos được thực hiện chủ yếu thông qua phân tán (ControlNet, IP-Adapter) thay vì CycleGAN, nhưng ý tưởng nhất quán chu kỳ tồn tại trong hầu hết các giấy thích ứng miền không cặp.

```figure
gx-patchgan
```

## Hãy xây dựng nó

`code/main.py`thực hiện một GAN điều kiện nhỏ trên dữ liệu 1D.$c$là một nhãn lớp (0 hoặc 1). Nhiệm vụ: tạo ra một mẫu từ phân phối có điều kiện cho lớp được đưa ra.

### Bước 1: thêm điều kiện cho cả hai đầu vào G và D

```python
def G(z, c, params):
    return mlp(concat([z, one_hot(c)]), params)

def D(x, c, params):
    return mlp(concat([x, one_hot(c)]), params)
```

Mã hóa một lần là cách đơn giản nhất. Các mô hình lớn hơn sử dụng nhúng học, mô-đun FiLM hoặc sự chú ý chéo.

### Bước 2: Đường xe có điều kiện

```python
for step in range(steps):
    x, c = sample_real_conditional()
    noise = sample_noise()
    update_D(x_real=x, x_fake=G(noise, c), c=c)
    update_G(noise, c)
```

Máy phát điện phải phù hợp với phân bố thực * cho điều kiện được đưa ra *, chứ không phải là biên.

### Bước 3: xác minh đầu ra mỗi lớp

```python
for c in [0, 1]:
    samples = [G(noise, c) for noise in batch]
    mean_c = mean(samples)
    assert_near(mean_c, real_mean_for_class_c)
```

## Những bẫy

- **Condition ignored.**G học cách bớt đi xa, D không bao giờ phạt vì tín hiệu điều kiện yếu.
- **L1 weight too low.**G hướng đến các kết quả có vẻ thực sự tùy ý, không phải những kết quả trung thành.$\lambda \approx 100$cho các nhiệm vụ kiểu Pix2Pix.
- **L1 weight too high.**G tạo ra các kết quả mờ vì L1 vẫn là một $L_p$- Thử hạ cổ khi tập luyện ổn định.
- **Ground-truth leakage in D.**Concatenate $(x, y)$như D đầu vào, không chỉ $y$Không có D này thì không thể kiểm tra sự phù hợp.
- **Mode collapse per class.**Mỗi lớp có thể sụp đổ một cách độc lập.

## Sử dụng nó

2026 trạng thái các nhiệm vụ hình ảnh-đối với hình ảnh:

| Task | Best approach |
|------|---------------|
| Sketch → photo, same domain, paired data | Pix2Pix / Pix2PixHD (still fast, still sharp) |
| Sketch → photo, unpaired | ControlNet with a Scribble conditioning model |
| Semantic seg → photo | SPADE / GauGAN2 or SD + ControlNet-Seg |
| Style transfer | Diffusion with IP-Adapter or LoRA; GAN methods are legacy |
| Depth → photo | ControlNet-Depth over Stable Diffusion |
| Super-resolution | Real-ESRGAN (GAN), ESRGAN-Plus, or SD-Upscale (diffusion) |
| Colorization | ColTran, diffusion-based colorizers, or Pix2Pix-color |
| Daytime → nighttime, seasons, weather | CycleGAN or ControlNet-based |

Pix2Pix vẫn là công cụ phù hợp khi (a) bạn có hàng ngàn ví dụ cặp, (b) nhiệm vụ là hẹp và lặp lại, và (c) bạn cần suy luận nhanh.

## Chuyển nó

- Cứu lại`outputs/skill-img2img-chooser.md`. Skill lấy mô tả nhiệm vụ, tính sẵn có dữ liệu (cặp với không cặp, mẫu N) và ngân sách độ trễ/ chất lượng, sau đó đưa ra: phương pháp tiếp cận (Pix2Pix, CycleGAN, biến thể ControlNet, SDXL + IP-Adapter), yêu cầu dữ liệu đào tạo, chi phí suy luận và giao thức đánh giá (LPIPS, FID, cụ thể cho nhiệm vụ).

## Các bài tập

1. **Easy.**Thay đổi `code/main.py`để thêm một lớp thứ ba. xác nhận G vẫn lập bản đồ tiếng ồn của mỗi lớp vào chế độ chính xác.
2. **Medium.**Thay thế L1 bằng một mất mát theo kiểu nhận thức trong thiết lập 1-D (ví dụ: một D đông lạnh nhỏ hoạt động như chất thu thập tính năng).
3. **Hard.**Chụp một CycleGAN trong cài đặt 1-D: hai phân phối, hai bộ phát điện, mất chu kỳ.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Conditional GAN | "GAN with labels" | G(z, c), D(x, c). Both networks see the condition. |
| Pix2Pix | "Image-to-image GAN" | Paired cGAN with U-Net G and PatchGAN D + L1 loss. |
| U-Net | "Encoder-decoder with skips" | Symmetric conv network; skips preserve high-freq. |
| PatchGAN | "Local-realism classifier" | D outputs per-patch score instead of global score. |
| CycleGAN | "Unpaired image translation" | Two G's + cycle-consistency loss; no paired data. |
| SPADE | "GauGAN" | Normalizes intermediate activations with the semantic map; segmentation-to-image. |
| FiLM | "Feature-wise linear modulation" | Per-feature affine transform from the condition; cheap conditioning. |

## Lưu ý sản xuất: Pix2Pix như một đường cơ sở bị ràng buộc bởi độ trễ

Khi bạn kết hợp dữ liệu và một nhiệm vụ hẹp (phác thảo → render, bản đồ ngữ nghĩa → ảnh, ban ngày → đêm), kết luận một lần của Pix2Pix đánh bại sự phân tán bằng một thứ tự về độ trễ.

| Path | Steps | Typical latency at 512² on a single L4 |
|------|-------|----------------------------------------|
| Pix2Pix (U-Net forward) | 1 | ~30 ms |
| SD-Inpaint or SD-Img2Img | 20 | ~1.2 s |
| SDXL-Turbo Img2Img | 1-4 | ~0.15-0.35 s |
| ControlNet + SDXL base | 20-30 | ~3-5 s |

Pix2Pix thắng trên thông suất trong các lô tĩnh (mỗi yêu cầu đều là FLOPs tương tự). Diffusion thắng trên chất lượng và tổng quát.

## Đọc thêm

- [Mirza & Osindero (2014). Conditional Generative Adversarial Nets](https://arxiv.org/abs/1411.1784) giấy cGAN.
- [Isola et al. (2017). Image-to-Image Translation with Conditional Adversarial Networks](https://arxiv.org/abs/1611.07004) Pix2Pix.
- [Zhu et al. (2017). Unpaired Image-to-Image Translation using Cycle-Consistent Adversarial Networks](https://arxiv.org/abs/1703.10593) CycleGAN.
- [Wang et al. (2018). High-Resolution Image Synthesis with Conditional GANs](https://arxiv.org/abs/1711.11585) Pix2PixHD.
- [Park et al. (2019). Semantic Image Synthesis with Spatially-Adaptive Normalization](https://arxiv.org/abs/1903.07291) SPADE / GauGAN.
- [Miyato & Koyama (2018). cGANs with Projection Discriminator](https://arxiv.org/abs/1802.05637) chiếu D.
