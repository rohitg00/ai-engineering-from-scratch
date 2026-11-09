# Sự pha trộn ẩn và sự pha trộn ổn định

> Sự phân tán không gian phích số trên hình ảnh 512 × 512 là một tội ác chiến tranh tính toán. Rombach et al. (2022) nhận thấy rằng bạn không cần tất cả các kích thước 786k để tạo ra một hình ảnh  bạn cần đủ để chụp cấu trúc ngữ nghĩa, và một bộ giải mã riêng cho phần còn lại.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 02 (VAE), Phase 8 · 06 (DDPM), Phase 7 · 09 (ViT)
**Time:** ~75 minutes

## Vấn đề

Sự phân tán trong không gian phím tại 5122 có nghĩa là U-Net chạy trên các tensor hình dạng .`[B, 3, 512, 512]`Mỗi bước lấy mẫu là ~ 100 GFLOPS cho một U-Net 500M-param. 50 bước là 5 TFLOPS cho mỗi hình ảnh. Đưa trên một tỷ hình ảnh và hóa đơn tính toán là vô lý.

Hầu hết các FLOP đó đi đến đẩy các chi tiết không quan trọng về nhận thức qua mạng  kết cấu tần số cao mà một VAE bị mất có thể nén ra. Ý tưởng của Rombach: đào tạo một VAE một lần (tầng * đầu tiên*), đóng băng nó, và chạy truyền hoàn toàn trong không gian ẩn 64×64 4 kênh (tầng * hai*).

Đây là công thức Stable Diffusion. SD 1.x / 2.x sử dụng một U-Net 860M trên `64×64×4`Các hệ thống này được phát triển trong các trường hợp tiềm ẩn, SDXL sử dụng một mạng U-Net 2.6B trên `128×128×4`, SD3 thay đổi U-Net với một Difusion Transformer (DiT) với dòng chảy phù hợp. Flux.1-dev (Black Forest Labs, 2024) vận chuyển một DiT-MMDiT 12B-param. Tất cả chạy trên cùng một nền hai giai đoạn.

## Khái niệm

![Latent diffusion: VAE compression + diffusion in latent space](../assets/latent-diffusion.svg)

**Two stages, separately trained.**

1. **Stage 1 — VAE.**Mã hóa $E(x) \to z$, decoder $D(z) \to x$. Nhấn mục tiêu: 8x mẫu xuống trong mỗi trục không gian + điều chỉnh các kênh để tổng kích thước ẩn là ~ 1/16 của số lượng pixel.$z$không phải là quá Gaussian, bởi vì chúng tôi không cần mẫu chính xác từ $z$Thường được huấn luyện với một thất bại đối thủ vì vậy hình ảnh được giải mã là sắc nét.

2. **Stage 2 — diffusion on $z$.**Chữa bệnh$z = E(x_{\text{real}})$Đào tạo một U-Net (hoặc DiT) để phản đối$z_t$- Khi kết luận: mẫu$z_0$qua sự phân tán, sau đó $x = D(z_0)$- Tôi không biết.

**Text conditioning.**Hai thành phần bổ sung. Một mã hóa văn bản đóng băng (CLIP-L cho SD 1.x, CLIP-L+OpenCLIP-G cho SD 2/XL, T5-XXL cho SD3 và Flux).`[Q = image features, K = V = text tokens]`Các mã chỉ là cách duy nhất văn bản ảnh hưởng đến hình ảnh.

**The loss function is identical to Lesson 06.**DDPM / dòng chảy tương ứng MSE trên tiếng ồn. Bạn chỉ cần thay đổi miền dữ liệu.

## Các biến thể kiến trúc

| Model | Year | Backbone | Latent shape | Text encoder | Params |
|-------|------|----------|--------------|--------------|--------|
| SD 1.5 | 2022 | U-Net | 64×64×4 | CLIP-L (77 tokens) | 860M |
| SD 2.1 | 2022 | U-Net | 64×64×4 | OpenCLIP-H | 865M |
| SDXL | 2023 | U-Net + refiner | 128×128×4 | CLIP-L + OpenCLIP-G | 2.6B + 6.6B |
| SDXL-Turbo | 2023 | Distilled | 128×128×4 | same | 1-4 step sampling |
| SD3 | 2024 | MMDiT (multimodal DiT) | 128×128×16 | T5-XXL + CLIP-L + CLIP-G | 2B / 8B |
| Flux.1-dev | 2024 | MMDiT | 128×128×16 | T5-XXL + CLIP-L | 12B |
| Flux.1-schnell | 2024 | MMDiT distilled | 128×128×16 | T5-XXL + CLIP-L | 12B, 1-4 step |

Xu hướng: thay thế U-Net bằng DiT (giới chuyển đổi trên các bản vá ẩn), mở rộng mã hóa văn bản (T5 vượt CLIP để tuân thủ nhanh chóng), tăng các kênh ẩn (4 → 16 cung cấp nhiều không gian phân tích hơn).

```figure
noise-schedule
```

## Hãy xây dựng nó

`code/main.py`đạp một đồ chơi 1-D "VAE" (một mã hóa quy mô cố định bằng 0,5 và ngược chính xác của nó như decoder, để minh họa; một VAE thực sự sẽ là một con conv net) trên đầu của DDPM từ Bài học 06 và thêm điều kiện lớp với hướng dẫn không phân loại. Nó cho thấy rằng cùng một mất phân tán hoạt động cho dù bạn chạy trên giá trị nguyên liệu 1-D hoặc trên giá trị mã hóa. Đó là hiểu biết chính.

### Bước 1: mã hóa/bản giải mã

```python
def encode(x):    return x * 0.5          # toy "compression" to smaller scale
def decode(z):    return z * 2.0
```

Một VAE thực sự có trọng lượng được đào tạo.$z$không quan tâm đến không gian dữ liệu gốc.

### Bước 2: phân tán trong `z`- Không gian

DDPM tương tự như bài học 06.$z = E(x)$Sau khi lấy mẫu$z_0$, giải mã với $D(z_0)$- Tôi không biết.

### Bước 3: hướng dẫn không có phân loại

Trong quá trình đào tạo, hãy bỏ nhãn lớp 10% thời gian (đổi lại bằng một token không).$\epsilon_{\text{cond}}$và $\epsilon_{\text{uncond}}$, sau đó:

```python
eps_cfg = (1 + w) * eps_cond - w * eps_uncond
```

$w = 0$= không có hướng dẫn (cụ thể đa dạng),$w = 3$= mặc định, $w = 7+$= bão hòa / quá sắc nét.

### Bước 4: Điều kiện văn bản (định nghĩa, không phải mã)

Thay thế nhãn lớp bằng một đầu ra mã hóa văn bản đóng băng. Cho các văn bản nhúng vào U-Net thông qua sự chú ý chéo:

```python
h = h + CrossAttention(Q=h, K=text_embed, V=text_embed)
```

Đây là sự khác biệt đáng kể duy nhất giữa mô hình phân tán theo điều kiện lớp và phân tán ổn định.

## Những bẫy

- **VAE-scale mismatch.**SD 1.x VAEs có một định lượng không đổi (`scaling_factor ≈ 0.18215`(Phần 2) được áp dụng sau khi mã hóa.
- **Text encoder silently wrong.**SD3 cần T5-XXL với >=128 token, và sự quay lại CLIP-chỉ là thua lỗ.`use_t5=True`hoặc các miệng núi lửa trung thành.
- **Mixing latent spaces.**SDXL, SD3, Flux đều sử dụng các VAE khác nhau. LoRA được đào tạo trên các laten SDXL sẽ không hoạt động trên SD3.
- **CFG too high.** `w > 10`tạo ra những hình ảnh bão hòa, dầu và quá phù hợp với các yêu cầu với chi phí của sự đa dạng.`w = 3-7`- Tôi không biết.
- **Negative prompts leaking.**Lần báo âm trống trở thành biểu tượng không; một lời báo âm đầy trở thành $\epsilon_{\text{uncond}}$Chúng không giống nhau; một số đường ống âm thầm mặc định đến null.

## Sử dụng nó

Các đống sản xuất vào năm 2026:

| Target | Recommended backbone |
|--------|----------------------|
| Narrow domain, paired data, training a model from scratch | SDXL fine-tune (LoRA / full) — fastest to ship |
| Open-domain text-to-image, open weights | Flux.1-dev (12B, Apache / non-commercial) or SD3.5-Large |
| Fastest inference, open weights | Flux.1-schnell (1-4 step, Apache) or SDXL-Lightning |
| Best prompt adherence, hosted | GPT-Image / DALL-E 3 (still), Midjourney v7, Imagen 4 |
| Edit workflows | Flux.1-Kontext (Dec 2024) — natively accepts image + text |
| Research, baseline | SD 1.5 — ancient but well-studied |

## Chuyển nó

- Cứu lại`outputs/skill-sd-prompter.md`. Skill lấy một prompt văn bản + phong cách mục tiêu và đầu ra: mô hình + điểm kiểm tra, thang CFG, mẫu, prompt tiêu cực, độ phân giải, sự kết hợp tùy chọn ControlNet / IP-Adapter, và danh sách kiểm tra QA từng bước.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`Với hướng dẫn$w \in \lbrace 0, 1, 3, 7, 15 \rbrace$- Đăng mẫu trung bình theo lớp.$w$có phải các phương tiện lớp khác nhau ngoài phương tiện dữ liệu thực?
2. **Medium.**Thay đổi bộ mã hóa hàng tuyến đồ chơi cho cặp mã hóa / mã hóa tanh-MLP với mất tích tái tạo. Phục trệ phân tán trên các dấu ẩn mới.
3. **Hard.**Thiết lập một suy luận Stable Diffusion thực sự với các diffuser: tải `sdxl-base`, chạy 30 bước Euler với CFG=7, thời gian nó.`sdxl-turbo`cùng chủ đề, chất lượng khác nhau  mô tả những gì đã thay đổi và tại sao.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| First stage | "The VAE" | Trained encoder/decoder pair; compresses 512² to 64². |
| Second stage | "The U-Net" | Diffusion model over the latent space. |
| CFG | "Guidance scale" | $(1+w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$; tunes conditioning strength. |
| Null token | "Empty prompt embed" | Unconditional embed used for $\epsilon_{\text{uncond}}$. |
| Cross-attention | "How text gets in" | Each U-Net block attends to text tokens as K and V. |
| DiT | "Diffusion Transformer" | Replace U-Net with a transformer over latent patches; scales better. |
| MMDiT | "Multi-modal DiT" | SD3's architecture: text and image streams with joint attention. |
| VAE scaling factor | "Magic number" | Divides latents by ~5.4 so diffusion operates in unit-variance space. |

## Lưu ý sản xuất: chạy Flux-12B trên GPU tiêu dùng 8GB

Liên kết Flux là công thức "Tôi có một GPU tiêu dùng, tôi có thể vận chuyển này không?"

1. **Staggered loading.**Flux có bốn mạng không bao giờ cần tồn tại cùng nhau trong VRAM: T5-XXL mã hóa văn bản (~ 10 GB trong fp32), CLIP-L (còn), 12B MMDiT và VAE. Mã hóa yêu cầu trước, * xóa * các mã hóa, tải DiT, từ chối, * xóa * DiT, tải VAE, giải mã. GPU 8GB tiêu dùng chỉ phù hợp với một giai đoạn tại một thời điểm.
2. **4-bit quantization via bitsandbytes.** `BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16)`trên cả mã hóa T5 và DiT. Giảm bộ nhớ 8x, giảm chất lượng không thể nhận thấy cho văn bản-đến hình ảnh theo các tiêu chuẩn của Aritra (được liên kết trong sổ ghi chép).
3. **CPU offload.** `pipe.enable_model_cpu_offload()`tự động đổi các mô-đun giữa CPU và GPU khi mỗi bước tiến tiến.

Việc ghi nhớ là: `10 GB T5 / 8 = 1.25 GB`được định lượng,`12 B params × 0.5 bytes = ~6 GB`TP=1 kết luận không có mô hình song song, lượng hóa tối đa. Đối với sản xuất bạn sẽ chạy TP=2 hoặc TP=4 trên H100s; cho một máy tính xách tay phát triển duy nhất, đây là công thức.

## Đọc thêm

- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) Sự pha trộn ổn định.
- [Podell et al. (2023). SDXL: Improving Latent Diffusion Models for High-Resolution Image Synthesis](https://arxiv.org/abs/2307.01952) SDXL.
- [Peebles & Xie (2023). Scalable Diffusion Models with Transformers (DiT)](https://arxiv.org/abs/2212.09748) DiT.
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) SD3, MMDiT.
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) CFG.
- [Labs (2024). Flux.1 — Black Forest Labs announcement](https://blackforestlabs.ai/announcing-black-forest-labs/) Gia đình Flux1.
- [Hugging Face Diffusers docs](https://huggingface.co/docs/diffusers/index) thực hiện tham chiếu cho mỗi điểm kiểm soát trên.
