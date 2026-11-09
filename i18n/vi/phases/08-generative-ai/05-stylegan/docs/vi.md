# StyleGAN

> Hầu hết các máy phát điện đều làm động$z$StyleGAN chia nó ra: bản đồ đầu tiên$z$cho một trung gian $w$, sau đó * tiêm * $w$Sự thay đổi duy nhất đó đã giải quyết không gian ẩn và làm cho những khuôn mặt chân thực ảnh trở thành một vấn đề được giải quyết trong bảy năm liên tiếp.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 03 (GANs), Phase 4 · 08 (Normalization), Phase 3 · 07 (CNNs)
**Time:** ~45 minutes

## Vấn đề

Một bản đồ DCGAN $z$để hình ảnh thông qua một loạt các biến chuyển chuyển. Vấn đề:$z$điều khiển mọi thứ  tư thế, ánh sáng, danh tính, nền  dính dáng với nhau.$z$Bạn không thể hỏi mô hình "một người, tư thế khác nhau" bởi vì đại diện không tính đến cách đó.

Karras et al. (2019, NVIDIA) đề xuất: ngừng ăn $z$trực tiếp vào các lớp chứa.`4×4×512`Tensor như đầu vào mạng. Học một MLP 8 lớp mà bản đồ $z \in Z \to w \in W$. Tiêm $w$ở mỗi độ phân giải thông qua * Adaptive Instant Normalization* (AdaIN): bình thường hóa mỗi bản đồ tính năng conv, sau đó quy mô và chuyển đổi bằng các dự đoán tương tự của $w$Thêm tiếng ồn mỗi lớp để chi tiết stochastic (các lỗ da, sợi tóc).

Kết quả là:$W$có các trục gần như thẳng thắn cho " phong cách cấp cao " (phong, danh tính) vs " phong cách tốt " (của ánh sáng, màu sắc). Bạn có thể trao đổi phong cách giữa hai hình ảnh bằng cách sử dụng hình ảnh A $w$cho các mức độ độ phân giải thấp và hình ảnh B $w$Việc chỉnh sửa mở, phong cách hóa các lĩnh vực và toàn bộ nghiên cứu về "StyleGAN-inversion".

## Khái niệm

![StyleGAN: mapping network + AdaIN + per-layer noise](../assets/stylegan.svg)

**Mapping network.** $f: Z \to W$, một MLP 8 lớp. $Z = \mathcal{N}(0, I)^{512}$- $W$không bị buộc phải là Gaussian  nó học một hình dạng thích nghi với dữ liệu.

**Synthesis network.**Bắt đầu từ một định vị học hỏi`4×4×512`. Mỗi khối phân giải: `upsample → conv → AdaIN(w_i) → noise → conv → AdaIN(w_i) → noise`- Nghị quyết hai lần: 4, 8, 16, 32, 64, 128, 256, 512, 1024.

**AdaIN.**

```math
\mathop{\mathrm{AdaIN}}(x, y) = y_{\text{scale}} \cdot \frac{x - \mathop{\mathrm{mean}}(x)}{\mathop{\mathrm{std}}(x)} + y_{\text{bias}}
```

nơi $y_{\text{scale}}$và $y_{\text{bias}}$đến từ các dự đoán tương tự của $w$. bình thường hóa theo bản đồ tính năng, sau đó tái tạo. "Style" ở đây là số liệu thống kê thứ nhất và thứ hai của bản đồ tính năng.

**Per-layer noise.**Giọng nói Gaussian kênh duy nhất được thêm vào mỗi bản đồ tính năng, được quy mô bằng một yếu tố mỗi kênh được học.

**Truncation trick.**Khi suy luận, mẫu $z$, tính toán$w = \text{mapping}(z)$, sau đó $w' = \hat{w} + \psi \cdot (w - \hat{w})$nơi $\hat{w}$là trung bình$w$trên nhiều mẫu. $\psi < 1$gần như mọi bản demo của StyleGAN đều sử dụng$\psi \approx 0.7$- Tôi không biết.

## StyleGAN 1 → 2 → 3

| Version | Year | Innovation |
|---------|------|------------|
| StyleGAN | 2019 | Mapping network + AdaIN + noise + progressive growing. |
| StyleGAN2 | 2020 | Weight demodulation replaces AdaIN (fixes droplet artifacts); skip/residual architecture; path-length regularization. |
| StyleGAN3 | 2021 | Alias-free convolution + equivariant kernels; eliminates texture sticking to pixel grid. |
| StyleGAN-XL | 2022 | Class-conditional, 1024², ImageNet. |
| R3GAN | 2024 | Rebrands with stronger reg; closes gap to diffusion on FFHQ-1024 with 20x fewer params. |

Trong năm 2026, StyleGAN3 vẫn là mặc định cho (a) quang học miền hẹp với FPS cao, (b) điều chỉnh miền ít ảnh (đào trên một tập dữ liệu mới với 100 hình ảnh, lập bản đồ đóng băng), (c) chỉnh sửa dựa trên đảo ngược (để tìm ra các $w$mà tái tạo lại một bức ảnh thực, sau đó chỉnh sửa nó.$w$). Đối với các miền mở văn bản-đối với hình ảnh, nó không phải là công cụ  phân tán là.

```figure
gx-stylegan-mapping
```

## Hãy xây dựng nó

`code/main.py`thực hiện một đồ chơi "style-GAN lite" trong 1-D: một MLP bản đồ, một chức năng tổng hợp lấy một vector liên tục được học và điều chỉnh nó bằng $w$- dẫn đến quy mô/ thiên vị, và tiếng ồn mỗi lớp.$w$qua các trận đấu hoặc nhịp concatenating của các mô-đun hợp$z$vào đầu vào của máy phát điện.

### Bước 1: mạng bản đồ

```python
def mapping(z, M):
    h = z
    for i in range(num_layers):
        h = leaky_relu(add(matmul(M[f"W{i}"], h), M[f"b{i}"]))
    return h
```

### Bước 2: Tiêu chuẩn hóa phiên bản thích ứng

```python
def adain(x, w_scale, w_bias):
    mu = mean(x)
    sd = std(x)
    x_norm = [(xi - mu) / (sd + 1e-8) for xi in x]
    return [w_scale * xi + w_bias for xi in x_norm]
```

Skala và thiên vị của bản đồ tính năng xuất phát từ $w$qua chiếu tuyến tính.

### Bước 3: Phế độ tiếng ồn mỗi lớp

```python
def add_noise(x, sigma, rng):
    return [xi + sigma * rng.gauss(0, 1) for xi in x]
```

Sigma per-channel là có thể học được.

## Những bẫy

- **Droplet artifacts.**StyleGAN 1 đã tạo ra một giọt nhỏ trong các bản đồ tính năng vì AdaIN đã đánh giá trung bình bằng không.
- **Texture sticking.**Các kết cấu StyleGAN 1 và 2 theo các phối hợp pixel, không phải các phối hợp đối tượng (có thể nhìn thấy khi liên kết).
- **Mode coverage.**Truncation `ψ < 0.7`trông sạch nhưng các mẫu từ một cái nếp hẹp; sử dụng `ψ = 1.0`nếu bạn cần sự đa dạng.
- **Inversion is lossy.**Chuyển một bức ảnh thực vào $W$thường được thực hiện thông qua tối ưu hóa hoặc một bộ mã hóa (e4e, ReStyle, HyperStyle). Kết quả trôi qua nhiều lần lặp lại.

## Sử dụng nó

| Use case | Approach |
|----------|----------|
| Photoreal human faces (anime, product, narrow) | StyleGAN3 FFHQ / custom fine-tune |
| Face editing from a photo | e4e inversion + StyleSpace / InterFaceGAN directions |
| Face swap / reenactment | StyleGAN + encoder + blending |
| Avatar pipelines | StyleGAN3 w/ ADA for low-data fine-tune |
| Domain adaptation from a few images | Freeze mapping network, fine-tune synthesis |
| Multi-modal or text-conditioned generation | Don't — use diffusion |

Đối với các bản demo cấp sản phẩm mà câu trả lời là "photos of a person's face", StyleGAN đánh bại sự pha trộn về chi phí suy luận (single forward pass, <10ms on a 4090) và sắc thái cho cùng một thanh chất lượng.

## Chuyển nó

- Cứu lại`outputs/skill-stylegan-inversion.md`. Skill chụp ảnh thực tế và kết quả: phương pháp đảo ngược (e4e / ReStyle / HyperStyle), dự kiến mất mát ẩn, ngân sách chỉnh sửa (từ đâu $W$bạn có thể di chuyển trước các đồ tạo vật), và một danh sách các hướng sửa đổi được biết đến (năm, biểu hiện, tư thế).

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`với `adain_on=True`và `adain_on=False`So sánh sự lây lan của các đầu ra cho một cố định tiềm ẩn vs bị rối loạn tiềm ẩn.
2. **Medium.**Thực hiện quy định trộn: cho một loạt đào tạo, tính toán $w_a$- $w_b$, và áp dụng $w_a$cho nửa đầu của tổng hợp và $w_b$Bộ giải mã học được các phong cách không liên quan?
3. **Hard.**Hãy lấy một mô hình StyleGAN3 FFHQ được đào tạo trước (ffhq-1024.pkl).$w$hướng điều khiển "mỉm cười" bằng cách đào tạo một SVM trên các mẫu được dán nhãn; báo cáo về mức độ bạn có thể đẩy trước khi danh tính biến mất.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mapping network | "The MLP" | $f: Z \to W$, 8 layers, decouples latent geometry from data statistics. |
| W space | "The style space" | Output of the mapping network; roughly disentangled. |
| AdaIN | "Adaptive instance norm" | Normalize feature map, then scale + shift by $w$-projection. |
| Truncation trick | "Psi" | $w = \text{mean} + \psi \cdot (w - \text{mean})$, $\psi<1$ trades diversity for quality. |
| Path-length regularization | "PL reg" | Penalizes large changes in image per unit change in $w$; makes $W$ smoother. |
| Weight demodulation | "The StyleGAN2 fix" | Normalize conv weights instead of activations; kills droplet artifacts. |
| Alias-free | "StyleGAN3's trick" | Windowed sinc filters; eliminates texture sticking to the pixel grid. |
| Inversion | "Find w for a real image" | Optimize or encode $x \to w$ so $G(w) \approx x$. |

## Lưu ý sản xuất: tại sao StyleGAN vẫn được vận chuyển vào năm 2026

StyleGAN3 trên một 4090 tạo ra một khuôn mặt 10242 FFHQ trong vòng dưới 10 ms `num_steps = 1`, không có mã hóa VAE, không có thông qua sự chú ý chéo. Về mặt sản xuất đây là độ trễ sàn cho bất kỳ máy phát hình ảnh nào. Một đường ống giải mã SDXL + VAE 50 bước với cùng độ phân giải là ~ 3 giây.**300× gap**, và đối với các sản phẩm miền hẹp (các dịch vụ avatar, đường ống giấy tờ ID, sản xuất mặt hàng) nó thắng trên TCO.

Hai hậu quả hoạt động:

- **No scheduler, no batcher.**Các lô hàng tĩnh tại chỗ chiếm được mục tiêu là tối ưu. Lớp hàng liên tục (tất yếu cho LLM và phân phối) cung cấp lợi ích không vì mỗi yêu cầu có cùng FLOP.
- **Truncation `ψ` is the safety knob.** `ψ < 0.7`mẫu từ một con hẹp của phạm vi của mạng bản đồ. Đây là đòn bẩy duy nhất mà lớp phục vụ có trên sự khác biệt mẫu.`ψ`khi tải cao nhất, tăng nó cho người dùng cao cấp.

## Đọc thêm

- [Karras et al. (2019). A Style-Based Generator Architecture for GANs](https://arxiv.org/abs/1812.04948) StyleGAN.
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) StyleGAN2.
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) StyleGAN3.
- [Tov et al. (2021). Designing an Encoder for StyleGAN Image Manipulation](https://arxiv.org/abs/2102.02766) đảo ngược e4e.
- [Sauer et al. (2022). StyleGAN-XL: Scaling StyleGAN to Large Diverse Datasets](https://arxiv.org/abs/2202.00273) StyleGAN-XL.
- [Huang et al. (2024). R3GAN: The GAN is dead; long live the GAN!](https://arxiv.org/abs/2501.05441) Công thức GAN tối thiểu hiện đại.
