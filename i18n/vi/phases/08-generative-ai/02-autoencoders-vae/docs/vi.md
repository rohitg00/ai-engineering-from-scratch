# Tự động mã hóa & Tự động mã hóa biến thể (VAE)

> Một mã mã tự động đơn giản nén lại sau đó tái tạo. Nó ghi nhớ. Nó không tạo ra. Thêm một thủ thuật  buộc mã để trông Gaussian  và bạn có được một mẫu.$z = \mu + \sigma \cdot \epsilon$, đó là lý do tại sao mỗi mô hình ảnh phân tán tiềm ẩn và tương thích dòng chảy mà bạn sử dụng vào năm 2026 có một VAE tại đầu vào.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 3 · 07 (CNNs), Phase 8 · 01 (Taxonomy)
**Time:** ~75 minutes

## Vấn đề

Nhiết nét MNIST 784 pixel thành mã số 16, sau đó tái tạo. Một mã tự động đơn giản sẽ làm tái tạo MSE nhưng không gian mã là một sự lộn xộn. Chọn một điểm ngẫu nhiên trong không gian mã, giải mã nó, và bạn sẽ có tiếng ồn. Nó không có mẫu. Đó là một mô hình nén mặc trang phục.

Điều bạn thực sự muốn là: (a) không gian mã là một phân bố sạch, trơn tru bạn có thể lấy mẫu từ  nói là một Gaussian isotropic $\mathcal{N}(0, I)$, (b) giải mã bất kỳ mẫu nào tạo ra một con số đáng tin cậy, và (c) bộ mã hóa và bộ giải mã vẫn nén tốt. Ba mục tiêu, một kiến trúc, một lỗ.

VAE 2013 của Kingma giải quyết vấn đề này bằng cách đào tạo bộ mã hóa để phát ra một * phân phối * $q(z \mid x) = \mathcal{N}(\mu(x), \sigma(x)^2)$, kéo phân phối đó về phía trước $\mathcal{N}(0, I)$thông qua một hình phạt KL, và sau đó lấy mẫu $z$từ $q(z \mid x)$Khi suy luận, hãy thả bộ mã hóa, lấy mẫu$z \sim \mathcal{N}(0, I)$Cảnh phạt KL là điều buộc không gian mã phải được cấu trúc.

Trong năm 2026, VAE hiếm khi được vận chuyển độc lập  chúng đã được vượt trội bởi sự phân tán về chất lượng hình ảnh nguyên thô  nhưng chúng là bộ mã hóa lựa chọn cho mọi mô hình phân tán tiềm ẩn (SD 1/2/XL/3, Flux, AudioCraft).

## Khái niệm

![Autoencoder vs VAE: the reparameterization trick](../assets/vae.svg)

**Autoencoder.** $z = \text{encoder}(x)$- $\hat{x} = \text{decoder}(z)$, mất mát = $\lVert x - \hat{x} \rVert^2$Không gian mã không có cấu trúc.

**VAE encoder.**Tạo ra hai vector: $\mu(x)$và $\log \sigma^2(x)$- Chúng định nghĩa$q(z \mid x) = \mathcal{N}(\mu, \mathop{\mathrm{diag}}(\sigma^2))$- Tôi không biết.

**Reparameterization trick.**Tiêu chuẩn lấy mẫu từ $q(z \mid x)$không phân biệt được.$z = \mu + \sigma \cdot \epsilon$nơi $\epsilon \sim \mathcal{N}(0, I)$Giờ thì$z$là một hàm xác định của $(\mu, \sigma)$cộng với tiếng ồn không phải tham số  gradient chảy qua `μ`và $\sigma$- Tôi không biết.

**Loss.**Bằng chứng Bind thấp hơn (ELBO), hai thuật ngữ:

```math
\begin{aligned}
\text{loss} &= \text{reconstruction} + \beta \cdot \mathrm{KL}[q(z \mid x) \,\Vert\, \mathcal{N}(0, I)] \\
&= \lVert x - \hat{x} \rVert^2 + \beta \cdot \sum_i \frac{\sigma_i^2 + \mu_i^2 - \log \sigma_i^2 - 1}{2}
\end{aligned}
```

Việc tái thiết thúc đẩy $\hat{x}$hướng tới$x$KL đẩy.$q(z \mid x)$Họ đổi lấy.$\beta$($<1$) = mẫu sắc hơn, không gian mã ít Gaussian.$\beta$($>1$(Higgins 2017) đã làm cho nút này nổi tiếng và bắt đầu nghiên cứu giải quyết.

**Sampling.**Khi kết luận: vẽ$z \sim \mathcal{N}(0, I)$Một lần đi trước không có mẫu lặp lại như phân tán.

```figure
vae-latent-grid
```

## Hãy xây dựng nó

`code/main.py`thực hiện một VAE nhỏ bé mà không có numpy hoặc ngọn đuốc. Input là dữ liệu tổng hợp 8-dimensional được lấy từ một hỗn hợp Gaussian 2 thành phần trong 8-D. Encoder và decoder là một lớp ẩn MLPs. Chúng tôi thực hiện hoạt động tanh, đi trước, mất, và một chữ viết tay đi ngược. Không sản xuất  giáo dục.

### Bước 1: mã hóa về phía trước

```python
def encode(x, enc):
    h = tanh(add(matmul(enc["W1"], x), enc["b1"]))
    mu = add(matmul(enc["W_mu"], h), enc["b_mu"])
    log_sigma2 = add(matmul(enc["W_sig"], h), enc["b_sig"])
    return mu, log_sigma2
```

$\log \sigma^2$thay vì $\sigma$Vì vậy, đầu ra mạng không bị hạn chế (softplus của σ là một cái bẫy  gradient chết ở $\sigma \approx 0$().

### Bước 2: tái định đo và giải mã

```python
def reparameterize(mu, log_sigma2, rng):
    eps = [rng.gauss(0, 1) for _ in mu]
    sigma = [math.exp(0.5 * lv) for lv in log_sigma2]
    return [m + s * e for m, s, e in zip(mu, sigma, eps)]

def decode(z, dec):
    h = tanh(add(matmul(dec["W1"], z), dec["b1"]))
    return add(matmul(dec["W_out"], h), dec["b_out"])
```

### Bước 3: ELBO

```python
def elbo(x, x_hat, mu, log_sigma2, beta=1.0):
    recon = sum((a - b) ** 2 for a, b in zip(x, x_hat))
    kl = 0.5 * sum(math.exp(lv) + m * m - lv - 1 for m, lv in zip(mu, log_sigma2))
    return recon + beta * kl, recon, kl
```

Kế hoạch này được thực hiện bởi các nhà phân phối của các hệ thống phân phối là Gaussian. không tích hợp số. người ta vẫn gửi mã với ước tính Monte-carlo KL vào năm 2026  nó là 3x chậm hơn mà không có lý do.

### Bước 4: tạo

```python
def sample(dec, z_dim, rng):
    z = [rng.gauss(0, 1) for _ in range(z_dim)]
    return decode(z, dec)
```

Đó là mô hình tạo ra. 5 dòng.

## Những bẫy

- **Posterior collapse.**KL term drive $q(z \mid x) \to \mathcal{N}(0, I)$quá mạnh mẽ mà$z$không có thông tin nào về $x$Phong sửa: β- hủy bỏ (bắt đầu $\beta=0$, ramp đến 1), free bits, hoặc bỏ qua KL trên kích thước không hoạt động.
- **Blurry samples.**Thiết lập: decoder phân biệt (VQ-VAE, NVAE), hoặc chỉ sử dụng VAE như một bộ mã hóa và phân tán chồng trên các laten (đó là điều Stable Diffusion làm).
- **β too large, too early.**Xem sự sụp đổ sau.$\beta \approx 0.01$và đường băng.
- **Latent dim too small.**16-D hoạt động cho MNIST, 256-D cho ImageNet 2562, 2048-D cho ImageNet 10242. VAE của Stable Diffusion nén 512×512×3 → 64×64×4 (8x downsample mỗi bên, 64x trong không gian; kênh đi từ 3 đến 4, do đó tổng thể ít hơn 48x giá trị).

## Sử dụng nó

Bộ VAE năm 2026:

| Situation | Pick |
|-----------|------|
| Image-latent encoder for diffusion | Stable Diffusion VAE (`sd-vae-ft-ema`) or Flux VAE |
| Audio-latent encoder | Encodec (Meta), SoundStream, or DAC (Descript) |
| Video latents | Sora's spatiotemporal patches, Latte VAE, WAN VAE |
| Disentangled representation learning | β-VAE, FactorVAE, TCVAE |
| Discrete latents (for transformer modelling) | VQ-VAE, RVQ (ResidualVQ) |
| Continuous latents for generation | Plain VAE, then condition a flow/diffusion model in that latent space |

Một mô hình phân tán ẩn là một mô hình phân tán có một mô hình phân tán sống giữa mã hóa và mã hóa. VAE làm nén thô, mô hình phân tán làm việc nặng.

## Chuyển nó

- Cứu lại`outputs/skill-vae-trainer.md`- Tôi không biết.

Các kỹ năng được lấy: hồ sơ bộ dữ liệu + mục tiêu trộm laten + sử dụng tiếp theo (tái tạo, lấy mẫu hoặc đầu vào trộm laten) và đầu ra: lựa chọn kiến trúc (sơn/β/VQ/RVQ), lịch trình β, trộm laten, xác suất giải mã (Gaussian vs categorical), và kế hoạch đánh giá (recon MSE, KL per dim, khoảng cách Fréchet giữa $q(z \mid x)$và $\mathcal{N}(0, I))$- Tôi không biết.

## Các bài tập

1. **Easy.**Thay đổi$\beta$trong `code/main.py`đến`0.01`- `0.1`- `1.0`- `5.0`. ghi lại việc tái thiết cuối cùng của MSE và KL.$\beta$Pareto là tốt nhất cho dữ liệu tổng hợp của bạn?
2. **Medium.**Thay thế xác suất decoder Gaussian bằng xác suất Bernoulli (sự mất mát entropy chéo). So sánh chất lượng mẫu trên một phiên bản nhị phân của cùng một dữ liệu tổng hợp.
3. **Hard.**Tăng `code/main.py`thành một VQ-VAE mini: thay thế liên tục $z$- so sánh MSE tái thiết và báo cáo số lượng các mục codebook được sử dụng (sự sụp đổ codebook là thực).

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Autoencoder | Encode-decode network | $x \to z \to \hat{x}$, learn MSE. Not generative. |
| VAE | AE with a sampler | Encoder outputs a distribution, KL penalty shapes code space. |
| ELBO | Evidence lower bound | $\log p(x) \ge \text{recon} - \mathrm{KL}[q(z \mid x) \Vert p(z)]$; tight when $q = p(z \mid x)$. |
| Reparameterization | $z = \mu + \sigma \cdot \epsilon$ | Rewrites stochastic node as deterministic + pure noise. Enables backprop through sampling. |
| Prior | $p(z)$ | Target distribution for the latent, typically $\mathcal{N}(0, I)$. |
| Posterior collapse | "KL term wins" | Encoder ignores $x$, outputs the prior; decoder must hallucinate. |
| β-VAE | Tunable KL weight | $\text{loss} = \text{recon} + \beta \cdot \mathrm{KL}$. Higher $\beta$ = more disentangled but blurrier. |
| VQ-VAE | Discrete latent | Replace continuous $z$ with nearest codebook vector; enables transformer modelling. |

## Lưu ý sản xuất: VAE là con đường nóng nhất trong máy chủ phân phối

Trong một đường ống dẫn Stable Diffusion / Flux / SD3, VAE được gọi hai lần theo yêu cầu  một lần để mã hóa (nếu thực hiện img2img / inpainting) và một lần để giải mã. Tại 10242, đoạn giải mã thường là đỉnh kích hoạt lớn nhất trong toàn bộ đường ống vì nó có thể tăng lên `128×128×16`Lưu ý về `1024×1024×3`Hai hậu quả thực tế:

- **Slice or tile the decode.** `diffusers`- Tự động`pipe.vae.enable_slicing()`và `pipe.vae.enable_tiling()`Tiiling giao dịch một đồ tạo tác nhỏ cho $O(\text{tile}^2)$trí nhớ thay vì $O(H \cdot W)$- Khả năng thiết yếu cho 10242+ trên các GPU tiêu dùng.
- **bf16 decoder, fp32 numerics for the final resize.**SD 1.x VAE được phát hành trong fp32 và * lặng lẽ sản xuất NaNs* khi đúc lên fp16 tại 10242+. tàu SDXL `madebyollin/sdxl-vae-fp16-fix` luôn thích biến thể cố định fp16 hoặc sử dụng bf16.

## Đọc thêm

- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) tờ VAE.
- [Higgins et al. (2017). β-VAE: Learning Basic Visual Concepts with a Constrained Variational Framework](https://openreview.net/forum?id=Sy2fzU9gl) chia tách β-VAE.
- [van den Oord et al. (2017). Neural Discrete Representation Learning](https://arxiv.org/abs/1711.00937) VQ-VAE.
- [Vahdat & Kautz (2021). NVAE: A Deep Hierarchical Variational Autoencoder](https://arxiv.org/abs/2007.03898) hình ảnh hiện đại nhất VAE.
- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) Sự pha trộn ổn định; VAE như một bộ mã hóa.
- [Défossez et al. (2022). High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) Encodec, tiêu chuẩn âm thanh VAE.
