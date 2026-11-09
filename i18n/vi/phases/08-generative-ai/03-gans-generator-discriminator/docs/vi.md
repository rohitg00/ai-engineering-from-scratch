# GANs  Generator vs. Discriminator

> Trù của Goodfellow năm 2014 là bỏ qua mật độ hoàn toàn. Hai mạng. Một tạo giả mạo. Một bắt chúng. Họ chiến đấu cho đến khi giả mạo không thể phân biệt với thực. Nó không nên hoạt động. Nó thường không hoạt động. Khi nó làm, các mẫu vẫn là sắc nét nhất trong văn học cho các miền hẹp.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 3 · 08 (Optimizers), Phase 8 · 02 (VAE)
**Time:** ~75 minutes

## Vấn đề

VAE sản xuất mẫu mờ vì mất mát của decoder MSE của họ là Bayes tối ưu cho hình ảnh * trung bình *  và trung bình của nhiều chữ số hợp lý là một chữ số mờ. Bạn muốn một lỗ hổng thưởng cho * khả thi *, không phải gần gũi với một mục tiêu nào đó. Không có hình thức đóng kín cho khả thi. Bạn phải học nó.

Ý tưởng của Goodfellow: đào tạo một bộ phân loại.$D(x)$để phân biệt hình ảnh thực với hình ảnh giả.$G(z)$để làm trò lừa$D$. tín hiệu mất mát cho $G$là bất cứ điều gì $D$hiện đang nghĩ làm cho một cái gì đó trông thật.$G$Nếu cả hai mạng hội tụ,$G$đã học cách phân phối dữ liệu mà không bao giờ viết xuống `log p(x)`- Tôi không biết.

Đây là huấn luyện đối kháng.

```math
\min_G \max_D \; \mathbb{E}_{\text{real}}[\log D(x)] + \mathbb{E}_{\text{fake}}[\log(1 - D(G(z)))]
```

Năm 2026, GAN không còn là máy phát điện SOTA (sự pha trộn và phù hợp dòng chảy ăn đống vương miện đó). Nhưng StyleGAN 2/3 vẫn là mô hình khuôn mặt sắc nét nhất từng được vận chuyển, các phân biệt đối xử GAN được sử dụng như là * mất mát nhận thức * trong đào tạo pha trộn, và đào tạo đối kháng cung cấp năng lực cho các loại chưng cất nhanh 1 bước (SDXL-Turbo, SD3-Turbo, LCM) cho phép bạn vận chuyển pha trộn thời gian thực.

## Khái niệm

![GAN training: generator and discriminator in minimax](../assets/gan.svg)

**Generator $G(z)$.**Bản đồ một vector tiếng $z \sim \mathcal{N}(0, I)$cho một mẫu $\hat{x}$Một mạng hình dạng decoder (cụ thể hoặc chuyển thể con).

**Discriminator $D(x)$.**Bản đồ một mẫu đến một xác suất scalar (hoặc điểm số).

**Loss.**Hai bản cập nhật thay thế:

- **Train $D$:** $\text{loss}_D = -[ \log D(x) + \log(1 - D(G(z))) ]$- Binary cross-entropy trên real=1, fake=0.
- **Train $G$:** $\text{loss}_G = -\log D(G(z))$Đây là hình thức không bão hòa được Goodfellow sử dụng (tôi ban đầu)$\log(1 - D(G(z)))$saturates và giết chết gradients khi $D$là tự tin).

**Training loop.**Một bước đi của $D$, một bước đi của $G$- Lặp lại.

**Why it works.**Nếu$G$Đúng là phù hợp.$p_{\text{data}}$, sau đó $D$không thể làm tốt hơn so với tình cờ và kết quả là 0,5 ở khắp mọi nơi;$G$không còn gradient nữa.

**Why it breaks.**Phong trào chế độ ($G$tìm thấy một chế độ $D$không thể phân loại và mint nó mãi mãi), biến mất gradient ($D$học quá nhanh và $\log D$(tỷ lệ học tập, kích thước lô, bất cứ thứ gì).

## Các biến thể làm cho các GAN hoạt động

| Year | Innovation | Fix |
|------|------------|-----|
| 2015 | DCGAN | Conv/deconv, batch norm, LeakyReLU — the first stable architecture. |
| 2017 | WGAN, WGAN-GP | Replace BCE with Wasserstein distance + gradient penalty. Fixes vanishing gradient. |
| 2017 | Spectral normalization | Lipschitz-bound the discriminator. Still used in 2026 discriminators. |
| 2018 | Progressive GAN | Train low-res first, add layers. First megapixel results. |
| 2019 | StyleGAN / StyleGAN2 | Mapping network + adaptive instance norm. State of the art for fixed-domain photorealism. |
| 2021 | StyleGAN3 | Alias-free, translation-equivariant — still the face gold standard in 2026. |
| 2022 | StyleGAN-XL | Conditional, class-aware, larger scale. |
| 2024 | R3GAN | Rebrands with stronger regularization; works on 1024² without tricks. |

```figure
gan-minimax
```

## Hãy xây dựng nó

`code/main.py`tạo ra một GAN nhỏ trên dữ liệu 1-D: một hỗn hợp của hai Gaussians. Generator và phân biệt là MLP một lớp ẩn. Chúng tôi thực hiện phía trước, ngược, và vòng minimax bằng tay. Mục tiêu là để xem hai chế độ thất bại chính (các trạng thái sụp đổ + độ sụp đổ) khi chúng xảy ra.

### Bước 1: mất không bão hòa

Cái vanilla Goodfellow mất đi$\log(1 - D(G(z)))$D phân loại giả của G là giả với độ tin cậy cao. Tại thời điểm đó gradient cho G về cơ bản là không  G không thể cải thiện.$-\log D(G(z))$có asymptote ngược lại: nó nổ ra khi D tự tin, cho G một tín hiệu mạnh mẽ.

```python
def g_loss(d_fake):
    # maximize log D(G(z))  <=>  minimize -log D(G(z))
    return -sum(math.log(max(p, 1e-8)) for p in d_fake) / len(d_fake)
```

### Bước 2: một bước phân biệt đối xử cho mỗi bước máy phát

```python
for step in range(steps):
    # train D
    real_batch = sample_real(batch_size)
    fake_batch = [G(z) for z in sample_noise(batch_size)]
    update_D(real_batch, fake_batch)

    # train G
    fake_batch = [G(z) for z in sample_noise(batch_size)]  # fresh fakes
    update_G(fake_batch)
```

G mới giả, nếu không thì độ lệch sẽ không còn.

### Bước 3: xem cho chế độ sụp đổ

```python
if step % 200 == 0:
    samples = [G(z) for z in sample_noise(500)]
    mode_a = sum(1 for s in samples if s < 0)
    mode_b = 500 - mode_a
    if min(mode_a, mode_b) < 50:
        print("  [!] mode collapse: one mode is starved")
```

Các triệu chứng của các phương pháp này là một trong hai chế độ thực sự ngừng được tạo ra.

## Những bẫy

- **Discriminator too strong.**Giảm tốc độ học tập của D 2-5x, hoặc thêm tiếng ồn trường hợp/phần. Nếu D đạt độ chính xác > 95%, G đã chết.
- **Generator memorizes a mode.**Thêm tiếng ồn vào đầu vào D, sử dụng lớp phân biệt bộ mini-batch, hoặc chuyển sang WGAN-GP.
- **Batch norm leaking statistics.**Các lô thực + lô giả chảy qua cùng một lớp BN trộn lại số liệu thống kê của họ.
- **Inception-score gaming.**FID và IS có tiếng ồn ở số lượng mẫu thấp. Sử dụng ≥ 10k mẫu trong eval.
- **One-shot sampling is a lie for conditional tasks.**Bạn vẫn cần cân CFG, thủ thuật cắt ngắn, và lấy lại mẫu để có được kết quả có thể sử dụng.

## Sử dụng nó

GAN 2026:

| Situation | Pick |
|-----------|------|
| Photoreal human faces, fixed pose | StyleGAN3 (sharpest, smallest) |
| Anime / stylized faces | StyleGAN-XL or Stable Diffusion LoRA |
| Image-to-image translation | Pix2Pix / CycleGAN (Phase 8 · 04) or ControlNet (Phase 8 · 08) |
| Fast 1-step text-to-image | Adversarial distillation of diffusion (SDXL-Turbo, SD3-Turbo) |
| Perceptual loss inside a diffusion trainer | Small GAN discriminator on image crops |
| Anything multi-modal, open-ended | Don't — use diffusion or flow matching |

GAN là sắc nét nhưng hẹp. Một khi miền của bạn mở  ảnh, các lời nhắc văn bản tùy ý, video  chuyển sang phổ biến. Tránh chống lại tồn tại như một thành phần (khuyết cảm, chưng cất), không phải là một máy phát điện độc lập.

## Chuyển nó

- Cứu lại`outputs/skill-gan-debugger.md`. Skill lấy một lần chạy GAN thất bại (cập lỗ, lưới mẫu, kích thước tập dữ liệu) và đưa ra một danh sách xếp hạng các nguyên nhân có thể xảy ra, sửa chữa một dòng và một giao thức tái chạy.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`với các cài đặt cổ phiếu.`D_LR = 5 * G_LR`G mất mát của G sụp đổ nhanh như thế nào?
2. **Medium.**Thay thế lỗ của Goodfellow BCE bằng lỗ của WGAN: $\text{loss}_D = \mathbb{E}[D(\text{fake})] - \mathbb{E}[D(\text{real})]$- $\text{loss}_G = -\mathbb{E}[D(\text{fake})]$, và clip D's trọng lượng để `[-0.01, 0.01]`- Trình luyện ổn định hơn không?
3. **Hard.**Cải nghiệm các mô hình 1D cho các dữ liệu 2D (sự trộn lẫn của 8 Gaussians trên một vòng). Theo dõi bao nhiêu trong số 8 chế độ máy phát điện bắt được ở các bước 1k, 5k, 10k. Thực hiện phân biệt bộ phận nhỏ và đo lại.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Generator | "G" | Noise-to-sample network, `G: z → x̂`. |
| Discriminator | "D" | Classifier `D: x → [0, 1]`, real vs fake. |
| Minimax | "The game" | $\min_G \max_D$ of a joint objective. |
| Non-saturating loss | "The fix" | Use $-\log D(G(z))$ for G instead of $\log(1 - D(G(z)))$. |
| Mode collapse | "G memorized one thing" | Generator produces few distinct outputs despite diverse data. |
| WGAN | "Wasserstein" | Replace BCE with Earth-Mover distance + gradient penalty; smoother gradient. |
| Spectral norm | "Lipschitz trick" | Constrain D's weight norms to bound its slope; stabilizes training. |
| StyleGAN | "The one that works" | Mapping network + AdaIN; best-in-class for faces, still in 2026. |

## Lưu ý sản xuất: suy luận một lần là lợi thế lâu dài của GAN

GAN không còn giành chiến thắng trên chất lượng mẫu cho việc tạo ra miền mở, nhưng họ vẫn giành chiến thắng trên chi phí suy luận.

- **No prefill, no decode stages.**Một người đơn $G(z)$TTFT ≈ thời gian trễ hoàn toàn.
- **No KV-cache pressure.**Chỉ có trạng thái là trọng lượng, kích thước của lô được giới hạn bởi bộ nhớ kích hoạt, không phải bộ nhớ cache.
- **Trivial continuous batching.**Vì mỗi yêu cầu có cùng FLOPs cố định, một lô tĩnh ở vị trí chiếm đóng mục tiêu của máy chủ thường là tối ưu. Không cần lập lịch trong chuyến bay.

Đây là lý do tại sao việc chưng cất GAN (SDXL-Turbo, SD3-Turbo, ADD, LCM) là kỹ thuật thống trị cho văn bản nhanh chóng đến hình ảnh vào năm 2026: nó phá vỡ một đường ống dẫn phân phối 20-50 bước thành 1-4 đường chuyền về phía trước theo phong cách GAN trong khi giữ phân phối cơ sở phân phối.

## Đọc thêm

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) giấy GAN gốc.
- [Radford et al. (2015). Unsupervised Representation Learning with DCGAN](https://arxiv.org/abs/1511.06434) kiến trúc ổn định đầu tiên.
- [Arjovsky, Chintala, Bottou (2017). Wasserstein GAN](https://arxiv.org/abs/1701.07875) WGAN.
- [Miyato et al. (2018). Spectral Normalization for GANs](https://arxiv.org/abs/1802.05957) SN.
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) StyleGAN2.
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) StyleGAN3.
- [Sauer et al. (2023). Adversarial Diffusion Distillation](https://arxiv.org/abs/2311.17042) SDXL-Turbo.
